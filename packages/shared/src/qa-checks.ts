import type { Brief } from './schemas';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface AutoCheck { key: 'product_visible' | 'brief_match' | 'must_not_say' | 'captions_match' | 'translation' | 'ai_disclosure'; label: string; status: CheckStatus; detail: string }
export interface AutoCheckInput {
  productName: string; brief: Pick<Brief, 'description' | 'key_benefits' | 'must_not_say'>; transcript: string; hook: string | null; captions?: string[];
  format: string; isSynthetic: boolean; aiDisclosure: string | null; language?: string | null; productCheck?: 'passed' | 'failed' | null; productCheckReason?: string | null;
}

/** Words that belong to one kind of product. A hook using them for a different kind of product is a mismatch. */
const DOMAINS: Record<string, RegExp> = {
  skin: /\b(skin|complexion|glow(?:ing)?|acne|pimples?|wrinkles?|pores?|dark spots?)\b/i,
  hair: /\b(hair|scalp|frizz|dandruff|split ends)\b/i,
  food: /\b(taste|tasty|flavou?r|delicious|sip|brew(?:ed)?|snack|protein)\b/i,
  fitness: /\b(workout|run(?:ning)?|gym|training|sweat)\b/i,
  tech: /\b(battery|charge|charging|noise cancell?ing|bluetooth|sound quality)\b/i,
};
/** Claims no ad on the platform may make, whatever the brief says. */
const PROHIBITED: [RegExp, string][] = [
  [/\bguarantee[ds]?\b/i, 'a guaranteed result'],
  [/\b(?:in|within)\s+\d+\s+(?:days?|weeks?|months?)\b/i, 'a timed result claim'],
  [/\b(?:cures?|heals?|treats?|clinically proven|doctor recommended|medical grade)\b/i, 'a medical claim'],
];
const quote = (s: string) => `“${s.trim()}”`;

/**
 * Checks run when a variant is generated and stored with it, so reviewers see them at once.
 * They never block anything on their own: a person approves or rejects.
 */
export function computeAutoChecks(i: AutoCheckInput): AutoCheck[] {
  const said = [i.hook ?? '', ...(i.captions ?? [])].join(' \n ');
  const everything = `${said} \n ${i.transcript}`;
  const about = `${i.productName} ${i.brief.description ?? ''} ${(i.brief.key_benefits ?? []).join(' ')}`;
  const checks: AutoCheck[] = [];

  checks.push(i.productCheck === 'failed'
    ? { key: 'product_visible', label: 'Product visible in frame', status: 'fail', detail: i.productCheckReason ?? 'The product could not be seen clearly in the sampled frames.' }
    : { key: 'product_visible', label: 'Product visible in frame', status: i.productCheck === 'passed' ? 'pass' : 'warn', detail: i.productCheck === 'passed' ? i.productCheckReason ?? 'Product seen in the sampled frames.' : 'The frame check has not run for this take.' });

  const foreign = Object.entries(DOMAINS).filter(([, re]) => re.test(said) && !re.test(about) && !re.test(i.transcript)).map(([d]) => d);
  checks.push(foreign.length
    ? { key: 'brief_match', label: 'Hook and captions match the product', status: 'fail', detail: `The hook talks about ${foreign.join(' and ')}, which neither the brief nor the creator mentions.` }
    : { key: 'brief_match', label: 'Hook and captions match the product', status: 'pass', detail: 'No claims from another product category.' });

  const hits: string[] = [];
  for (const [re, what] of PROHIBITED) { const m = re.exec(said); if (m) hits.push(`${what} (${quote(m[0])})`); }
  for (const phrase of i.brief.must_not_say ?? []) {
    const p = phrase.trim();
    if (p.length >= 3 && p.split(/\s+/).length <= 4 && everything.toLowerCase().includes(p.toLowerCase())) hits.push(`listed by the brand (${quote(p)})`);
  }
  checks.push(hits.length
    ? { key: 'must_not_say', label: 'Nothing on the must-not-say list', status: 'fail', detail: `Found ${hits.join('; ')}.` }
    : { key: 'must_not_say', label: 'Nothing on the must-not-say list', status: 'pass', detail: 'Transcript, captions and hook scanned.' });

  const hookSaid = !i.hook || i.transcript.toLowerCase().includes(i.hook.toLowerCase().replace(/[.!?]+$/, ''));
  checks.push({ key: 'captions_match', label: 'Captions match the transcript', status: hookSaid ? 'pass' : 'warn', detail: hookSaid ? 'Captions are cut from the transcript.' : 'The hook line is written for the format; it is not a quote from the creator.' });

  if (i.format === 'language_version') {
    checks.push({ key: 'translation', label: 'Translation keeps the verdict', status: 'warn', detail: `Not checked automatically yet. Compare the ${i.language ?? 'translated'} version with the original verdict.` });
  }
  if (i.isSynthetic || i.format === 'day_in_life' || i.format === 'language_version') {
    const ok = i.isSynthetic && !!i.aiDisclosure;
    checks.push({ key: 'ai_disclosure', label: 'AI disclosure set', status: ok ? 'pass' : 'fail', detail: ok ? 'Marked AI-edited; the brand is told to enable the AI-info label.' : 'The scene or voice was changed but the variant is not marked AI-edited.' });
  }
  return checks;
}
export const worstCheck = (checks: AutoCheck[]): CheckStatus => (checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass');
