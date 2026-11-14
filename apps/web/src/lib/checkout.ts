'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPaymentProvider } from '@takeone/providers';
import { campaignCharge, licensePrice, type LicensePricing, type LicenseType } from '@takeone/shared';
import type { ActionResult } from './actions';
import { supabaseServer } from './supabase-server';

async function origin() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

/**
 * Escrow checkout for a campaign. Amounts are recomputed on the server from the database, never taken from the client.
 * Mock provider (demo): "paid" immediately, so the escrow is confirmed right here.
 * Stripe: returns the Checkout URL; /api/webhooks/stripe confirms the payment.
 */
export async function payCampaign(campaignId: string): Promise<ActionResult<{ url: string | null }>> {
  const sb = await supabaseServer();
  const { data: c } = await sb.from('campaigns').select('id, title, status, fee_per_creator_minor, creators_needed, currency, brand_id, brands(country)').eq('id', campaignId).single();
  if (!c) return { ok: false, error: 'Campaign not found' };
  if (c.status !== 'draft') return { ok: false, error: 'This campaign is already funded' };
  const { data: credits } = await sb.from('credits').select('amount_minor, used_minor').eq('brand_id', c.brand_id).eq('currency', c.currency).gt('expires_at', new Date().toISOString());
  const credit = (credits ?? []).reduce((a, r) => a + (Number(r.amount_minor) - Number(r.used_minor)), 0);
  const charge = campaignCharge(Number(c.fee_per_creator_minor), c.creators_needed, credit);
  const base = await origin();
  const provider = getPaymentProvider({ country: (c.brands as unknown as { country: string } | null)?.country });
  const { data: user } = await sb.auth.getUser();
  const session = await provider.createCheckout({
    kind: 'campaign', amountMinor: charge.payableMinor, currency: c.currency, description: `Campaign escrow: ${c.title}`,
    successUrl: `${base}/brand/campaigns/${c.id}?paid=1`, cancelUrl: `${base}/brand/campaigns/${c.id}`, metadata: { campaign_id: c.id }, customerEmail: user.user?.email,
  });
  if (!session.paid) return { ok: true, data: { url: session.url } };
  const { error } = await sb.rpc('confirm_campaign_payment', { p_campaign_id: c.id, p_provider: provider.name, p_provider_ref: session.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/brand', 'layout');
  return { ok: true, data: { url: null } };
}

export async function buyLicense(variantId: string, type: Exclude<LicenseType, 'base'>, campaignId: string, reviewPath: string): Promise<ActionResult<{ url: string | null }>> {
  const sb = await supabaseServer();
  const [{ data: c }, { data: pricing }] = await Promise.all([
    sb.from('campaigns').select('title, fee_per_creator_minor, currency, brands(country)').eq('id', campaignId).single(),
    sb.from('settings').select('value').eq('key', 'license_pricing').single(),
  ]);
  if (!c) return { ok: false, error: 'Campaign not found' };
  const price = licensePrice(type, Number(c.fee_per_creator_minor), (pricing?.value ?? {}) as Partial<LicensePricing>);
  const base = await origin();
  const provider = getPaymentProvider({ country: (c.brands as unknown as { country: string } | null)?.country });
  const session = await provider.createCheckout({
    kind: 'license', amountMinor: price, currency: c.currency, description: `${type} license: ${c.title}`,
    successUrl: `${base}${reviewPath}`, cancelUrl: `${base}${reviewPath}`, metadata: { variant_id: variantId, license_type: type },
  });
  if (!session.paid) return { ok: true, data: { url: session.url } };
  const { error } = await sb.rpc('purchase_license', { p_variant_id: variantId, p_type: type, p_provider: provider.name, p_provider_ref: session.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/brand', 'layout');
  return { ok: true, data: { url: null } };
}
