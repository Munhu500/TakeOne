'use client';
import { buyLicense } from '@/lib/checkout';
import { ActionButton } from '@/components/client';

/** One-click renewal: another 90 days from the current expiry. */
export function RenewButton({ variantId, campaignId, label, primary }: { variantId: string; campaignId: string; label: string; primary: boolean }) {
  return (
    <ActionButton size="sm" variant={primary ? 'primary' : 'secondary'} action={async () => {
      const r = await buyLicense(variantId, 'renewal', campaignId, '/brand/licenses');
      if (r.ok && r.data?.url) window.location.href = r.data.url;
      return r;
    }}>{label}</ActionButton>
  );
}
