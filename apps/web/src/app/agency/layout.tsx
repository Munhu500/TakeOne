import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { Shell } from '@/components/shell';

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const s = await requireRole('agency_member');
  if (!s.agency) redirect('/onboarding');
  return <Shell session={s} nav={[{ href: '/agency', label: 'Clients', icon: 'building' }, { href: '/agency/branding', label: 'White-label', icon: 'palette' }, { href: '/brand', label: 'Campaigns', icon: 'megaphone' }, { href: '/brand/billing', label: 'Billing', icon: 'card' }]}>{children}</Shell>;
}
