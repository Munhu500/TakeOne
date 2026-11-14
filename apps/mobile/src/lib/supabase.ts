import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
export const DEMO = (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'true') !== 'false';
/** Static preview build: no web server behind the app, so server-backed extras fall back to local behaviour. */
export const STATIC_PREVIEW = process.env.EXPO_PUBLIC_STATIC_PREVIEW === 'true';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' },
});
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => (s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));
}

export const publicUrl = (path: string | null | undefined) => (!path ? null : /^https?:\/\//.test(path) ? path : `${SUPABASE_URL}/storage/v1/object/public/public-assets/${path}`);

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
/** Signed URLs for the creator's own private files (variants, takes). */
export async function signMany(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return out;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, 3600);
  for (const x of data ?? []) if (x.path && x.signedUrl) out[x.path] = x.signedUrl;
  return out;
}
/** Calls the Next.js API with the creator's session (AI rewrites, Stripe checkout). */
export async function webApi<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${WEB_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
  return j as T;
}
