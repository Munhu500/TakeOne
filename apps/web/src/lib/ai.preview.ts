// Static preview: no server, so drafts come from the same deterministic logic as the demo-mode mock provider.
import type { Brief, ShotList } from '@takeone/shared';
import type { AiResult, DraftProduct } from './ai';

export type { AiResult, DraftProduct } from './ai';

export async function draftProduct(url: string): Promise<AiResult<DraftProduct>> {
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, error: 'Enter a full product link (https://…)' }; }
  const slug = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? 'product').replace(/[-_]+/g, ' ').replace(/\.\w+$/, '');
  const name = slug.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || 'Your product';
  return {
    ok: true, provider: 'mock', fetched: false,
    data: { product_name: name, description: `${name} from ${u.hostname.replace(/^www\./, '')}. (Preview build: replace this with your own description. The full deployment reads the page for you.)`, key_benefits: ['Solves an everyday problem', 'Easy to use from day one', 'Looks great on camera'], images: [] },
  };
}
export async function draftShotList(product_name: string, brief: Brief): Promise<AiResult<ShotList>> {
  const b = brief.key_benefits[0] ?? brief.key_messages[0] ?? 'what you like most about it';
  return {
    ok: true, provider: 'mock',
    data: {
      shots: [
        { title: 'Hook', direction: `Look at the camera and name the problem ${product_name} solves for you.`, seconds: 5 },
        { title: 'Show the product', direction: `Hold ${product_name} at chest height with the label facing the lens.`, seconds: 8 },
        { title: 'Use it', direction: 'Use it on camera exactly as you normally would. Stay in frame.', seconds: 15 },
        { title: 'Your verdict', direction: 'Say what you honestly think and who it is for.', seconds: 10 },
      ],
      talking_points: [b, ...brief.must_say.map((m) => `Mention: ${m}`), 'How long you have used it', 'Who you would recommend it to'].slice(0, 6),
      framing_tips: ['Vertical, phone at eye level', 'Face a window for light', 'Keep the product inside the guide box'],
    },
  };
}
