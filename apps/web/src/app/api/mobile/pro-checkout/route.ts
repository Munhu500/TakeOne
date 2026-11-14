import type { NextRequest } from 'next/server';
import { getPaymentProvider } from '@takeone/providers';
import { convertMinor, PRO_PRICE_USD_MINOR, type CurrencyCode, type FxRates } from '@takeone/shared';
import { json, mobileUser, preflight } from '@/lib/mobile-api';

export const OPTIONS = preflight;
/** Stripe subscription checkout for Creator Pro, priced in the creator's local currency. The webhook activates Pro. */
export async function POST(req: NextRequest) {
  const u = await mobileUser(req);
  if (!u) return json({ error: 'Sign in required' }, 401);
  const [{ data: profile }, { data: price }, { data: rates }] = await Promise.all([
    u.sb.from('profiles').select('currency, country').eq('id', u.userId).single(),
    u.sb.from('settings').select('value').eq('key', 'pro_price_usd_minor').maybeSingle(),
    u.sb.from('fx_rates').select('currency, rate_to_usd'),
  ]);
  const fx: FxRates = Object.fromEntries((rates ?? []).map((r) => [r.currency, Number(r.rate_to_usd)]));
  const currency = (profile?.currency ?? 'USD') as CurrencyCode;
  const origin = req.nextUrl.origin;
  try {
    const s = await getPaymentProvider().createCheckout({
      kind: 'pro_subscription', amountMinor: convertMinor(Number(price?.value ?? PRO_PRICE_USD_MINOR), 'USD', currency, fx), currency, description: 'TakeOne Pro (monthly)',
      successUrl: `${origin}/creators?pro=1`, cancelUrl: `${origin}/creators`, metadata: { creator_id: u.userId }, customerEmail: u.email,
    });
    if (s.paid) { const { error } = await u.sb.rpc('activate_pro'); if (error) return json({ error: error.message }, 400); } // mock provider
    return json({ url: s.url, paid: s.paid });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
