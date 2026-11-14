// Static preview replacement for the server actions: the browser calls the same Postgres functions directly.
// Those functions check the caller themselves, so nothing here needs (or has) elevated keys.
import { agencyBrandingSchema, campaignInputSchema } from '@takeone/shared';
import { go } from '@/preview/url';
import { supabaseBrowser } from './supabase-browser';

export interface ActionResult<T = unknown> { ok: boolean; error?: string; data?: T }

const ALLOWED = new Set([
  'create_brand', 'create_agency', 'create_client_brand', 'confirm_campaign_payment', 'set_application_status', 'invite_creator', 'select_variants',
  'purchase_license', 'approve_assignment', 'choose_winner', 'open_dispute', 'send_message', 'qa_review', 'admin_verify_social', 'admin_resolve_dispute',
  'admin_issue_credit', 'run_scheduled_jobs',
]);

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}, _path?: string): Promise<ActionResult<T>> {
  if (!ALLOWED.has(fn)) return { ok: false, error: 'Unknown operation' };
  const { data, error } = await supabaseBrowser().rpc(fn, args);
  return error ? { ok: false, error: error.message } : { ok: true, data: data as T };
}
export async function signOut() {
  await supabaseBrowser().auth.signOut();
  go('/login');
}
export async function setActiveBrand(brandId: string, to = '/brand') {
  localStorage.setItem('t1_brand', brandId);
  go(to);
}
export async function saveCampaign(input: unknown, id?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = campaignInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const sb = supabaseBrowser();
  const { brand_id, ...rest } = parsed.data;
  const { data: brand } = await sb.from('brands').select('currency, agency_id').eq('id', brand_id).single();
  if (!brand) return { ok: false, error: 'Brand not found' };
  const row = { ...rest, product_url: rest.product_url || null, deadline: new Date(rest.deadline).toISOString() };
  const { data, error } = id
    ? await sb.from('campaigns').update(row).eq('id', id).eq('status', 'draft').select('id').single()
    : await sb.from('campaigns').insert({ ...row, brand_id, agency_id: brand.agency_id, currency: brand.currency }).select('id').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save the campaign' };
  return { ok: true, data: { id: data.id as string } };
}
export async function updateAgencyBranding(agencyId: string, input: unknown): Promise<ActionResult> {
  const p = agencyBrandingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid branding' };
  const { error } = await supabaseBrowser().from('agencies').update(p.data).eq('id', agencyId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function updateRow(table: 'settings' | 'fx_rates' | 'brands', match: Record<string, string>, patch: Record<string, unknown>, _path: string): Promise<ActionResult> {
  const { error } = await supabaseBrowser().from(table).update({ ...patch, ...(table === 'brands' ? {} : { updated_at: new Date().toISOString() }) }).match(match);
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function signedUrl(bucket: 'variants' | 'verification' | 'takes' | 'kyc', path: string, download?: string): Promise<ActionResult<string>> {
  const { data, error } = await supabaseBrowser().storage.from(bucket).createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error || !data) return { ok: false, error: bucket === 'variants' && path.includes('/clean_') ? 'License this variant to unlock the watermark-free file.' : error?.message ?? 'Not available' };
  return { ok: true, data: data.signedUrl };
}
