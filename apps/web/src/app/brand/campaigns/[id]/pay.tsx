'use client';
import { payCampaign } from '@/lib/checkout';
import { ActionButton } from '@/components/client';

export function PayButton({ campaignId, label }: { campaignId: string; label: string }) {
  return (
    <div className="mt-5">
      <ActionButton className="w-full" action={async () => {
        const r = await payCampaign(campaignId);
        if (r.ok && r.data?.url) window.location.href = r.data.url; // Stripe Checkout
        else if (r.ok) window.location.href = `/brand/campaigns/${campaignId}?paid=1`;
        return r;
      }}>{label}</ActionButton>
    </div>
  );
}
