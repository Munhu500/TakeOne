// Static preview: payments are simulated. The database only accepts these confirmations while its demo_mode setting is on.
import type { LicenseType } from '@takeone/shared';
import type { ActionResult } from './actions';
import { supabaseBrowser } from './supabase-browser';

const ref = () => `mock_cs_${Math.random().toString(36).slice(2, 12)}`;

export async function payCampaign(campaignId: string): Promise<ActionResult<{ url: string | null }>> {
  const { error } = await supabaseBrowser().rpc('confirm_campaign_payment', { p_campaign_id: campaignId, p_provider: 'mock', p_provider_ref: ref() });
  return error ? { ok: false, error: error.message } : { ok: true, data: { url: null } };
}
export async function buyLicense(variantId: string, type: Exclude<LicenseType, 'base'>, _campaignId: string, _reviewPath: string): Promise<ActionResult<{ url: string | null }>> {
  const { error } = await supabaseBrowser().rpc('purchase_license', { p_variant_id: variantId, p_type: type, p_provider: 'mock', p_provider_ref: ref() });
  return error ? { ok: false, error: error.message } : { ok: true, data: { url: null } };
}
