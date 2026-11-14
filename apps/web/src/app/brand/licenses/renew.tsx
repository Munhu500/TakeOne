'use client';
import { buyLicense } from '@/lib/checkout';
import { ActionButton } from '@/components/client';

/** One-click renewal: another licence term from the current end date. */
export function RenewButton({ variantId, campaignId, label, urgent }: { variantId: string; campaignId: string; label: string; urgent: boolean }) {
  return (
    <ActionButton size="sm" variant={urgent ? 'primary' : 'secondary'} action={async () => {
      const r = await buyLicense(variantId, 'renewal', campaignId, '/brand/licenses');
      if (r.ok && r.data?.url) window.location.href = r.data.url;
      return r;
    }}>{label}</ActionButton>
  );
}
