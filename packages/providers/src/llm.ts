import Anthropic from '@anthropic-ai/sdk';
import { extractedProductSchema, FORMATS, shotListSchema, type Brief, type ExtractedProduct, type FormatId, type ShotList } from '@takeone/shared';
import { z } from 'zod';
import { useReal } from './env';

export interface RankInput { format: FormatId; hook: string | null; transcript: string; brief: Brief; productName: string; durationSeconds: number }
export interface RankResult { score: number; reason: string }
export interface ProductCheck { visible: boolean; reason: string }
export interface Frame { mediaType: 'image/jpeg' | 'image/png'; base64: string }

export interface LlmProvider {
  readonly name: string;
  extractProduct(pageText: string, url: string, imageUrls: string[]): Promise<ExtractedProduct>;
  generateShotList(productName: string, brief: Brief): Promise<ShotList>;
  /** 3 hook options. Hooks may only restate what the creator said; they never add product claims. */
  writeHooks(format: FormatId, transcript: string, brief: Brief, language?: string): Promise<string[]>;
  rankVariant(input: RankInput): Promise<RankResult>;
  checkProductInFrame(frames: Frame[], reference: Frame | null, productName: string): Promise<ProductCheck>;
  /** Win Predictor: rewrite a weak hook, same constraints as writeHooks. */
  rewriteHook(hook: string, format: FormatId, transcript: string): Promise<string[]>;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';
const HOOK_RULES =
  'Rules: use only things the creator actually said in the transcript. Never add, strengthen or invent product claims, results, numbers or ingredients. Keep the creator’s verdict unchanged. Max 9 words each.';

export class ClaudeLlm implements LlmProvider {
  readonly name = 'claude';
  private client: Anthropic;
  constructor(apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  private async json<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, system: string, content: string | Anthropic.Beta.BetaContentBlockParam[]): Promise<T> {
    const res = await this.client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: `${system}\nReply with a single JSON object and nothing else.`,
      messages: [{ role: 'user', content }],
    });
    if (res.stop_reason === 'refusal') throw new Error('The model declined this request');
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Model did not return JSON');
    return schema.parse(JSON.parse(text.slice(start, end + 1)));
  }

  extractProduct(pageText: string, url: string, imageUrls: string[]) {
    return this.json(
      extractedProductSchema,
      'You extract product facts from a product web page for an ad brief. Use only facts on the page. JSON keys: product_name, description (2–3 sentences), key_benefits (3–6 short strings), images (up to 6 absolute URLs chosen from the candidates that most likely show the product).',
      `URL: ${url}\n\nCandidate image URLs:\n${imageUrls.slice(0, 40).join('\n')}\n\nPage text:\n${pageText}`,
    );
  }

  generateShotList(productName: string, brief: Brief) {
    return this.json(
      shotListSchema,
      'You write a creator-facing shot list for ONE continuous vertical take (30–60s) of a creator using a real product. JSON keys: shots (4–6 items: title, direction, seconds), talking_points (4–6), framing_tips (3). Respect must_say and must_not_say. The creator gives their honest opinion; never script a verdict.',
      `Product: ${productName}\nBrief: ${JSON.stringify(brief)}`,
    );
  }

  async writeHooks(format: FormatId, transcript: string, brief: Brief, language = 'English') {
    const f = FORMATS[format];
    const r = await this.json(
      z.object({ hooks: z.array(z.string().max(120)).length(3) }),
      `You write on-screen hook text for short UGC ads. ${HOOK_RULES} Write in ${language}. JSON: {"hooks": [3 strings]}.`,
      `Format: ${f.name} — ${f.description}\nFormat rules: ${f.rules.join('; ')}\nMust not say: ${brief.must_not_say.join('; ')}\nTranscript:\n${transcript}`,
    );
    return r.hooks;
  }

  rankVariant(i: RankInput) {
    const f = FORMATS[i.format];
    return this.json(
      z.object({ score: z.number().int().min(0).max(100), reason: z.string().max(300) }),
      'You score a UGC ad variant from 0–100 on three things: how well it follows the format rules, hook strength, and fit to the brand brief. JSON: {"score": int, "reason": "one or two short sentences"}.',
      `Format: ${f.name}\nRules: ${f.rules.join('; ')}\nHook: ${i.hook ?? '(none)'}\nDuration: ${i.durationSeconds}s\nProduct: ${i.productName}\nBrief: ${JSON.stringify(i.brief)}\nTranscript:\n${i.transcript}`,
    );
  }

  checkProductInFrame(frames: Frame[], reference: Frame | null, productName: string) {
    const img = (f: Frame): Anthropic.Beta.BetaImageBlockParam => ({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.base64 } });
    return this.json(
      z.object({ visible: z.boolean(), reason: z.string().max(300) }),
      'You check whether a product is clearly visible in frames sampled from a creator’s video. "visible" is true only if the product (matching the reference image when one is given) is clearly identifiable in at least 2 frames. JSON: {"visible": boolean, "reason": string}.',
      [
        ...(reference ? [{ type: 'text' as const, text: 'Reference image of the product:' }, img(reference)] : []),
        { type: 'text' as const, text: `Product name: ${productName}. Sampled frames follow.` },
        ...frames.map(img),
      ],
    );
  }

  async rewriteHook(hook: string, format: FormatId, transcript: string) {
    const r = await this.json(
      z.object({ hooks: z.array(z.string().max(120)).length(3) }),
      `You rewrite a weak hook for a short UGC ad into 3 stronger options. ${HOOK_RULES} JSON: {"hooks": [3 strings]}.`,
      `Format: ${FORMATS[format].name}\nCurrent hook: ${hook}\nTranscript:\n${transcript}`,
    );
    return r.hooks;
  }
}

function seeded(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
function firstSentences(t: string): string[] {
  return t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}
const clip = (s: string, words: number) => {
  const t = s.replace(/^(?:(?:okay|ok|so|um|uh|well|honestly)[,\s]+)+/i, '').replace(/[.!?]+$/, '');
  const cut = t.split(/\s+/).slice(0, words).join(' ').replace(/[,;:]$/, '');
  return cut.charAt(0).toUpperCase() + cut.slice(1);
};

/** Deterministic stand-in so the whole demo runs with no API key. Hooks are cut from the creator's own sentences. */
export class MockLlm implements LlmProvider {
  readonly name = 'mock';
  async extractProduct(pageText: string, url: string, imageUrls: string[]): Promise<ExtractedProduct> {
    const title = /<title[^>]*>([^<]+)/i.exec(pageText)?.[1]?.trim();
    const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'product').replace(/[-_]+/g, ' ').replace(/\.\w+$/, '');
    const name = (title ?? slug).split(/[|–—-]/)[0]!.trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || 'Your product';
    return {
      product_name: name,
      description: `${name} from ${new URL(url).hostname.replace(/^www\./, '')}. (Demo mode: replace this with your own description — connect an Anthropic API key to extract it from the page automatically.)`,
      key_benefits: ['Solves an everyday problem', 'Easy to use from day one', 'Looks great on camera'],
      images: imageUrls.slice(0, 4),
    };
  }
  async generateShotList(productName: string, brief: Brief): Promise<ShotList> {
    const b = brief.key_benefits[0] ?? brief.key_messages[0] ?? 'what you like most about it';
    return {
      shots: [
        { title: 'Hook', direction: `Look at the camera and name the problem ${productName} solves for you.`, seconds: 5 },
        { title: 'Show the product', direction: `Hold ${productName} at chest height with the label facing the lens.`, seconds: 8 },
        { title: 'Use it', direction: 'Use it on camera exactly as you normally would. Stay in frame.', seconds: 15 },
        { title: 'Your verdict', direction: 'Say what you honestly think and who it is for.', seconds: 10 },
      ],
      talking_points: [b, ...brief.must_say.map((m) => `Mention: ${m}`), 'How long you have used it', 'Who you would recommend it to'].slice(0, 6),
      framing_tips: ['Vertical, phone at eye level', 'Face a window for light', 'Keep the product inside the guide box'],
    };
  }
  async writeHooks(format: FormatId, transcript: string): Promise<string[]> {
    const s = firstSentences(transcript);
    const pick = (i: number) => clip(s[(seeded(format) + i) % Math.max(s.length, 1)] ?? 'My honest take', 9);
    const lead = format === 'hook_first' || format === 'silent_montage' ? clip(s[0] ?? 'My honest take', 9) : pick(0);
    return [...new Set([lead, pick(1), clip(s[s.length - 1] ?? 'Would I buy it again?', 9)])].concat(['My honest take', 'Watch this first']).slice(0, 3);
  }
  async rankVariant(i: RankInput): Promise<RankResult> {
    const f = FORMATS[i.format];
    const base: Record<string, number> = { hook_first: 88, testimonial_tight: 82, day_in_life: 77, silent_montage: 72, language_version: 70 };
    const hookWords = (i.hook ?? '').split(/\s+/).filter(Boolean).length;
    const score = Math.max(40, Math.min(97, (base[i.format] ?? 65) + (seeded(i.transcript + i.format) % 7) - 3 - (hookWords > 9 ? 6 : 0)));
    const fit = i.brief.key_benefits[0] ? `Speaks to “${i.brief.key_benefits[0]}”.` : 'Fits the brief.';
    return { score, reason: `${f.rules[0]}. ${hookWords ? `Hook is ${hookWords} words.` : 'No hook overlay in this format.'} ${fit}` };
  }
  async checkProductInFrame(frames: Frame[]): Promise<ProductCheck> {
    return frames.length > 0
      ? { visible: true, reason: `Product visible in ${Math.max(2, frames.length - 1)} of ${frames.length} sampled frames (demo check).` }
      : { visible: false, reason: 'No frames could be sampled from the video.' };
  }
  async rewriteHook(hook: string, _f: FormatId, transcript: string): Promise<string[]> {
    const s = firstSentences(transcript);
    return [clip(s[0] ?? hook, 7), `${clip(s[s.length - 1] ?? hook, 6)}?`, clip(hook, 6)];
  }
}

export function getLlm(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  return useReal(env.ANTHROPIC_API_KEY, env) ? new ClaudeLlm(env.ANTHROPIC_API_KEY) : new MockLlm();
}
