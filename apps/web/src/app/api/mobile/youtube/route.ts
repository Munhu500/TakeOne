import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { json, mobileUser, preflight } from '@/lib/mobile-api';

export const OPTIONS = preflight;
/**
 * YouTube "Verified via API": exchanges the OAuth code, reads the creator's own channel statistics from the YouTube Data API
 * and stores them as verified. Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY (a badge is never client-writable).
 */
export async function POST(req: NextRequest) {
  const u = await mobileUser(req);
  if (!u) return json({ error: 'Sign in required' }, 401);
  const p = z.object({ code: z.string().min(4), redirect_uri: z.string().min(4) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: 'Invalid request' }, 400);
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, SUPABASE_SERVICE_ROLE_KEY: service } = process.env;
  if (!id || !secret || !service) return json({ error: 'YouTube verification is not configured on this server yet' }, 501);
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: p.data.code, client_id: id, client_secret: secret, redirect_uri: p.data.redirect_uri, grant_type: 'authorization_code' }) });
  const t = (await tok.json()) as { access_token?: string; error_description?: string };
  if (!t.access_token) return json({ error: t.error_description ?? 'Google sign-in failed' }, 400);
  const ch = (await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { authorization: `Bearer ${t.access_token}` } })).json()) as { items?: { snippet: { title: string; customUrl?: string }; statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string } }[] };
  const c = ch.items?.[0];
  if (!c) return json({ error: 'No YouTube channel found on that Google account' }, 404);
  const subs = Number(c.statistics.subscriberCount ?? 0);
  const videos = Math.max(1, Number(c.statistics.videoCount ?? 1));
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, { auth: { persistSession: false } });
  const { error } = await admin.from('social_accounts').upsert({
    creator_id: u.userId, platform: 'youtube', handle: (c.snippet.customUrl ?? c.snippet.title).replace(/^@/, ''), followers: subs, avg_views: Math.round(Number(c.statistics.viewCount ?? 0) / videos),
    verification: 'api_verified', ownership_verified_at: new Date().toISOString(), flags: [],
  }, { onConflict: 'creator_id,platform' });
  return error ? json({ error: error.message }, 500) : json({ ok: true, subscribers: subs });
}
