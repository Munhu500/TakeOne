import Stripe from 'stripe';
import { useReal } from './env';

export interface CheckoutRequest {
  kind: 'campaign' | 'license' | 'pro_subscription';
  amountMinor: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  /** echoed back by the webhook so the server knows what was paid for */
  metadata: Record<string, string>;
  customerEmail?: string;
}
export interface CheckoutSession { provider: string; id: string; url: string | null; /** mock: already paid, confirm immediately */ paid: boolean }
export interface PaymentEvent { type: 'paid' | 'subscription_ended' | 'ignored'; ref: string; metadata: Record<string, string> }

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** verify + parse a webhook body */
  parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent>;
  refund(ref: string, amountMinor?: number): Promise<{ ref: string }>;
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private stripe: Stripe;
  constructor(secretKey: string, private webhookSecret: string | undefined) {
    this.stripe = new Stripe(secretKey);
  }
  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sub = req.kind === 'pro_subscription';
    const s = await this.stripe.checkout.sessions.create({
      mode: sub ? 'subscription' : 'payment',
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      customer_email: req.customerEmail,
      metadata: { ...req.metadata, kind: req.kind },
      ...(sub ? { subscription_data: { metadata: { ...req.metadata, kind: req.kind } } } : { payment_intent_data: { metadata: { ...req.metadata, kind: req.kind } } }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: req.amountMinor,
            product_data: { name: req.description },
            ...(sub ? { recurring: { interval: 'month' as const } } : {}),
          },
        },
      ],
    });
    return { provider: this.name, id: s.id, url: s.url, paid: false };
  }
  async parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent> {
    if (!this.webhookSecret || !signature) throw new Error('Missing Stripe webhook secret or signature');
    const ev = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    if (ev.type === 'checkout.session.completed') {
      const s = ev.data.object;
      return { type: 'paid', ref: String(s.subscription ?? s.payment_intent ?? s.id), metadata: (s.metadata ?? {}) as Record<string, string> };
    }
    if (ev.type === 'customer.subscription.deleted') {
      return { type: 'subscription_ended', ref: ev.data.object.id, metadata: (ev.data.object.metadata ?? {}) as Record<string, string> };
    }
    return { type: 'ignored', ref: ev.id, metadata: {} };
  }
  async refund(ref: string, amountMinor?: number) {
    const r = await this.stripe.refunds.create({ payment_intent: ref, amount: amountMinor });
    return { ref: r.id };
  }
}

/** India. Same interface; wire up Razorpay Orders + webhook signature here. */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  constructor(private keyId: string, private keySecret: string) {}
  async createCheckout(): Promise<CheckoutSession> {
    void this.keyId; void this.keySecret;
    throw new Error('RazorpayProvider is a stub: implement Orders API checkout before enabling the razorpay feature flag');
  }
  async parseWebhook(): Promise<PaymentEvent> {
    throw new Error('RazorpayProvider is a stub');
  }
  async refund(): Promise<{ ref: string }> {
    throw new Error('RazorpayProvider is a stub');
  }
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const id = `mock_cs_${Math.random().toString(36).slice(2, 12)}`;
    const u = new URL(req.successUrl);
    u.searchParams.set('mock_session', id);
    return { provider: this.name, id, url: u.toString(), paid: true };
  }
  async parseWebhook(rawBody: string): Promise<PaymentEvent> {
    const j = JSON.parse(rawBody) as { ref: string; metadata: Record<string, string> };
    return { type: 'paid', ref: j.ref, metadata: j.metadata };
  }
  async refund(ref: string) {
    return { ref: `mock_re_${ref}` };
  }
}

export function getPaymentProvider(opts: { country?: string } = {}, env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  if (opts.country === 'IN' && env.RAZORPAY_ENABLED === 'true' && useReal(env.RAZORPAY_KEY_ID, env) && env.RAZORPAY_KEY_SECRET) {
    return new RazorpayProvider(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
  }
  return useReal(env.STRIPE_SECRET_KEY, env) ? new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET) : new MockPaymentProvider();
}

// ───────── payouts + KYC (mock only in v1) ─────────
export interface PayoutProvider { readonly name: string; send(p: { amountMinor: number; currency: string; method: string; destination: Record<string, string> }): Promise<{ ref: string; status: 'paid' | 'processing' }> }
export class MockPayoutProvider implements PayoutProvider {
  readonly name = 'mock';
  async send() {
    return { ref: `mock_po_${Math.random().toString(36).slice(2, 12)}`, status: 'paid' as const };
  }
}
export interface KycProvider { readonly name: string; verify(p: { idPhotoPath: string; selfiePath: string }): Promise<{ status: 'verified' | 'pending' | 'rejected' }> }
export class MockKycProvider implements KycProvider {
  readonly name = 'mock';
  async verify() {
    return { status: 'verified' as const };
  }
}
