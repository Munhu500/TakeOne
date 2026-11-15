'use server';
import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { AGENCY_HOST_TAG } from './site';
import { redirect } from 'next/navigation';
import { agencyBrandingSchema, campaignInputSchema } from '@takeone/shared';
import { supabaseServer } from './supabase-server';

export interface ActionResult<T = unknown> { ok: boolean; error?: string; data?: T }

/** Every privileged operation is a Postgres function that checks the caller; the web app only forwards the user's session. */
const ALLOWED = new Set([
  'create_brand', 'create_agency', 'create_client_brand', 'confirm_campaign_payment', 'set_application_status', 'invite_creator', 'select_variants',
  'purchase_license', 'approve_assignment', 'choose_winner', 'open_dispute', 'send_message', 'qa_review', 'admin_verify_social', 'admin_resolve_dispute',
  'admin_issue_credit', 'run_scheduled_jobs',
]);

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}, path?: string): Promise<ActionResult<T>> {
  if (!ALLOWED.has(fn)) return { ok: false, error: 'Unknown operation' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  if (path) revalidatePath(path, 'layout');
  return { ok: true, data: data as T };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect('/login');
}

export async function setActiveBrand(brandId: string, to = '/brand') {
  (await cookies()).set('t1_brand', brandId, { path: '/', httpOnly: true, sameSite: 'lax' });
  redirect(to);
}

export async function saveCampaign(input: unknown, id?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = campaignInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const sb = await supabaseServer();
  const { brand_id, ...rest } = parsed.data;
  const { data: brand } = await sb.from('brands').select('currency, agency_id').eq('id', brand_id).single();
  if (!brand) return { ok: false, error: 'Brand not found' };
  const row = { ...rest, product_url: rest.product_url || null, deadline: new Date(rest.deadline).toISOString() };
  const q = id
    ? sb.from('campaigns').update(row).eq('id', id).eq('status', 'draft').select('id').single()
    : sb.from('campaigns').insert({ ...row, brand_id, agency_id: brand.agency_id, currency: brand.currency }).select('id').single();
  const { data, error } = await q;
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save the campaign' };
  revalidatePath('/brand', 'layout');
  return { ok: true, data: { id: data.id as string } };
}

export async function updateAgencyBranding(agencyId: string, input: unknown): Promise<ActionResult> {
  const p = agencyBrandingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid branding' };
  const sb = await supabaseServer();
  const { error } = await sb.from('agencies').update(p.data).eq('id', agencyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  revalidateTag(AGENCY_HOST_TAG);
  return { ok: true };
}

export async function updateRow(table: 'settings' | 'fx_rates' | 'brands', match: Record<string, string>, patch: Record<string, unknown>, path: string): Promise<ActionResult> {
  const sb = await supabaseServer();
  const { error } = await sb.from(table).update({ ...patch, ...(table === 'brands' ? {} : { updated_at: new Date().toISOString() }) }).match(match);
  if (error) return { ok: false, error: error.message };
  revalidatePath(path, 'layout');
  return { ok: true };
}

/** Short-lived signed URL. Storage RLS decides: watermarked previews once delivered, clean files only while licensed. */
export async function signedUrl(bucket: 'variants' | 'verification' | 'takes' | 'kyc', path: string, download?: string): Promise<ActionResult<string>> {
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error || !data) return { ok: false, error: bucket === 'variants' && path.includes('/clean_') ? 'License this variant to unlock the watermark-free file.' : error?.message ?? 'Not available' };
  return { ok: true, data: data.signedUrl };
}
