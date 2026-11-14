import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '..', '..', '.env') });

export const ASSETS = path.join(ROOT, 'assets');
export const WORK = process.env.WORK_DIR ?? path.join(ROOT, '.work');
export const SAMPLE_TAG = 'takeone-sample-take';
export const SAMPLE_WALL = '0x9FB8AD';

/**
 * Two ways to authenticate, same code path afterwards:
 *  - SUPABASE_SERVICE_ROLE_KEY: full service access (typical for a private deployment)
 *  - WORKER_EMAIL + WORKER_PASSWORD: a least-privilege login that can only call the worker_* functions and its storage paths
 */
export async function connect(): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not set');
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service) return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = process.env.SUPABASE_ANON_KEY;
  const { WORKER_EMAIL: email, WORKER_PASSWORD: password } = process.env;
  if (!anon || !email || !password) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY + WORKER_EMAIL + WORKER_PASSWORD');
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: true } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Worker sign-in failed: ${error.message}`);
  return sb;
}

export async function rpc<T = unknown>(sb: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
export async function upload(sb: SupabaseClient, bucket: string, key: string, file: string): Promise<void> {
  const body = await readFile(file);
  for (let attempt = 1; ; attempt++) {
    const { error } = await sb.storage.from(bucket).upload(key, body, { contentType: TYPES[path.extname(file)] ?? 'application/octet-stream', upsert: true });
    if (!error) return;
    if (attempt >= 3) throw new Error(`upload ${bucket}/${key}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}
