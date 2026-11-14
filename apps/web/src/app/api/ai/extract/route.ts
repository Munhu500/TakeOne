import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getLlm } from '@takeone/providers';
import { supabaseServer } from '@/lib/supabase-server';

const body = z.object({ url: z.string().url().refine((u) => /^https?:/.test(u), 'Must be an http(s) link') });
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|.*\.internal$|.*\.local$)/i;

/** Paste a product URL → product name, description, key benefits and images for the brief form. */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  if (!(await sb.auth.getUser()).data.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid URL' }, { status: 400 });
  const url = new URL(parsed.data.url);
  if (PRIVATE.test(url.hostname)) return NextResponse.json({ error: 'That address cannot be fetched' }, { status: 400 });
  let html = '';
  let fetched = true;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; BriefBot/1.0)', accept: 'text/html' }, signal: AbortSignal.timeout(10_000), redirect: 'follow' });
    if (!res.ok) throw new Error(String(res.status));
    html = (await res.text()).slice(0, 400_000);
  } catch {
    fetched = false; // still return an editable draft
  }
  const abs = (s: string) => { try { return new URL(s, url).toString(); } catch { return null; } };
  const images = [...new Set([
    ...[...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/gi)].map((m) => m[1]!),
    ...[...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)/gi)].map((m) => m[1]!),
  ].map(abs).filter((x): x is string => !!x))].slice(0, 40);
  const title = /<title[^>]*>([^<]*)/i.exec(html)?.[0] ?? '';
  const text = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 20_000);
  try {
    const llm = getLlm();
    const product = await llm.extractProduct(`${title} ${text}`, url.toString(), images);
    return NextResponse.json({ product, provider: llm.name, fetched });
  } catch (e) {
    return NextResponse.json({ error: `Could not read that page: ${(e as Error).message}` }, { status: 502 });
  }
}
