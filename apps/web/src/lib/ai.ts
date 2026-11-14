import type { Brief, ShotList } from '@takeone/shared';

export interface DraftProduct { product_name: string; description: string; key_benefits: string[]; images: string[] }
export type AiResult<T> = { ok: true; data: T; provider: string; fetched?: boolean } | { ok: false; error: string };

/** Product URL → draft product facts (server route; Claude or the demo mock). */
export async function draftProduct(url: string): Promise<AiResult<DraftProduct>> {
  const res = await fetch('/api/ai/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
  const j = await res.json();
  return res.ok ? { ok: true, data: j.product, provider: j.provider, fetched: j.fetched } : { ok: false, error: j.error ?? 'Could not read that page' };
}
export async function draftShotList(product_name: string, brief: Brief): Promise<AiResult<ShotList>> {
  const res = await fetch('/api/ai/shot-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_name, brief }) });
  const j = await res.json();
  return res.ok ? { ok: true, data: j.shot_list, provider: j.provider } : { ok: false, error: j.error ?? 'Could not generate a shot list' };
}
