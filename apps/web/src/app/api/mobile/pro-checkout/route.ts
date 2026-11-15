import type { NextRequest } from 'next/server';
import { getPaymentProvider } from '@takeone/providers';
import { proPriceFor, type ProPrices } from '@takeone/shared';
import { json, mobileUser, preflight } from '@/lib/mobile-api';

export const OPTIONS = preflight;
/** Stripe subscription checkout for Creator Pro at the fixed price for the creator's market (never an FX conversion). The webhook activates Pro. */
export async function POST(req: NextRequest) {
  const u = await mobileUser(req);
  if (!u) return json({ error: 'Sign in required' }, 401);
  const [{ data: profile }, { data: prices }] = await Promise.all([
    u.sb.from('profiles').select('country').eq('id', u.userId).single(),
    u.sb.from('settings').select('value').eq('key', 'pro_prices').maybeSingle(),
  ]);
  const price = proPriceFor(profile?.country, prices?.value as ProPrices | undefined);
  const origin = req.nextUrl.origin;
  try {
    const s = await getPaymentProvider().createCheckout({
      kind: 'pro_subscription', amountMinor: price.minor, currency: price.currency, description: 'TakeOne Pro (monthly)',
      successUrl: `${origin}/creators?pro=1`, cancelUrl: `${origin}/creators`, metadata: { creator_id: u.userId }, customerEmail: u.email,
    });
    if (s.paid) { const { error } = await u.sb.rpc('activate_pro'); if (error) return json({ error: error.message }, 400); } // mock provider
    return json({ url: s.url, paid: s.paid });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
