import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getPaymentProvider } from '@takeone/providers';

/** Real payments only (DEMO_MODE=false). Confirms escrow / licenses / Pro with the service role after Stripe verifies the event. */
export async function POST(req: NextRequest) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for webhooks' }, { status: 500 });
  let ev;
  try {
    ev = await getPaymentProvider().parseWebhook(await req.text(), req.headers.get('stripe-signature'));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
  const m = ev.metadata;
  let error: { message: string } | null = null;
  if (ev.type === 'paid' && m.campaign_id) ({ error } = await sb.rpc('confirm_campaign_payment', { p_campaign_id: m.campaign_id, p_provider: 'stripe', p_provider_ref: ev.ref }));
  else if (ev.type === 'paid' && m.variant_id) ({ error } = await sb.rpc('purchase_license', { p_variant_id: m.variant_id, p_type: m.license_type, p_provider: 'stripe', p_provider_ref: ev.ref }));
  else if (ev.type === 'paid' && m.creator_id) ({ error } = await sb.rpc('activate_pro', { p_creator: m.creator_id, p_provider_ref: ev.ref }));
  else if (ev.type === 'subscription_ended' && m.creator_id) {
    await sb.from('subscriptions').update({ status: 'canceled' }).eq('creator_id', m.creator_id);
    ({ error } = await sb.from('creators').update({ tier: 'free' }).eq('profile_id', m.creator_id));
  }
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ received: true });
}
