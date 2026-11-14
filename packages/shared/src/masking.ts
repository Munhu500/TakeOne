import { MASKING_FLAG_THRESHOLD } from './config';

export type MaskKind = 'email' | 'phone' | 'link' | 'handle' | 'phrase';
export interface MaskResult {
  masked: string;
  hadMasking: boolean;
  matches: { kind: MaskKind; text: string }[];
}

const MASK = '•••';

const PATTERNS: { kind: MaskKind; re: RegExp }[] = [
  { kind: 'email', re: /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}(?:\.[a-z]{2,})?/gi },
  { kind: 'link', re: /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|telegram\.dog|signal\.me|m\.me|discord\.gg)\/[^\s]*/gi },
  { kind: 'link', re: /(?:https?:\/\/|www\.)[^\s]+/gi },
  // 8+ digits allowing spaces, dashes, dots, brackets; optional +country code
  { kind: 'phone', re: /(?:\+|00)?\d(?:[\s().-]*\d){7,14}/g },
  { kind: 'handle', re: /(?:\b(?:insta(?:gram)?|ig|tiktok|snap(?:chat)?|telegram|tg)\b\s*(?:is|:|-|@)?\s*)@?[a-z0-9._]{3,30}\b(?<=[a-z0-9_])/gi },
  { kind: 'handle', re: /(?<![a-z0-9])@[a-z0-9._]{3,30}/gi },
  {
    kind: 'phrase',
    re: /\b(?:dm me|d\.m\. me|text me|call me|ping me|my (?:number|no\.?|phone|cell|mobile|email|e-mail|whats\s?app|insta|telegram)|whats\s?app(?: me)?|telegram me|off[\s-]?platform|outside (?:the |this )?(?:app|platform)|pay (?:me )?direct(?:ly)?|contact me (?:directly|on|at))\b/gi,
  },
];

/** Scan a chat message for contact details and off-platform phrases; mask what matches. */
export function maskContactInfo(text: string): MaskResult {
  const matches: MaskResult['matches'] = [];
  let masked = text;
  for (const { kind, re } of PATTERNS) {
    masked = masked.replace(re, (m) => {
      if (m.includes(MASK)) return m;
      matches.push({ kind, text: m.trim() });
      return MASK;
    });
  }
  return { masked, hadMasking: matches.length > 0, matches };
}

/** A user is flagged for admin review after this many masked attempts. */
export function shouldFlagUser(attempts: number): boolean {
  return attempts >= MASKING_FLAG_THRESHOLD;
}

export const MASKING_NOTICE = 'Contact details and off-platform requests are hidden. Keep the conversation on the platform so your payment stays protected.';
