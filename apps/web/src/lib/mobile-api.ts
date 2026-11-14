import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });
export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });

/** The creator app calls these routes with its Supabase access token; queries run as that user (RLS applies). */
export async function mobileUser(req: NextRequest): Promise<{ sb: SupabaseClient; userId: string; email: string | undefined } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await sb.auth.getUser(token);
  return data.user ? { sb, userId: data.user.id, email: data.user.email } : null;
}
