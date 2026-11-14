import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getLlm } from '@takeone/providers';
import type { FormatId, Transcript } from '@takeone/shared';
import { json, mobileUser, preflight } from '@/lib/mobile-api';

export const OPTIONS = preflight;
/** Win Predictor (Pro): three stronger rewrites of a weak hook, built only from the creator's own words. */
export async function POST(req: NextRequest) {
  const u = await mobileUser(req);
  if (!u) return json({ error: 'Sign in required' }, 401);
  const p = z.object({ variant_id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: 'Invalid request' }, 400);
  const { data: pro } = await u.sb.rpc('is_pro', { uid: u.userId });
  if (!pro) return json({ error: 'Win Predictor is a Pro feature' }, 403);
  const { data: v } = await u.sb.from('variants').select('format, hook_text, takes(transcript)').eq('id', p.data.variant_id).maybeSingle(); // RLS: own variants only
  if (!v) return json({ error: 'Variant not found' }, 404);
  const transcript = (v.takes as unknown as { transcript: Transcript | null } | null)?.transcript?.text ?? '';
  try {
    return json({ hooks: await getLlm().rewriteHook(v.hook_text ?? '', v.format as FormatId, transcript) });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
