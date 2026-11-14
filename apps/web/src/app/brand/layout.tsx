import type { ReactNode } from 'react';
import { requireRole } from '@/lib/session';
import { Shell } from '@/components/shell';

export default async function BrandLayout({ children }: { children: ReactNode }) {
  const s = await requireRole('brand_member', 'agency_member');
  const nav = [
    { href: '/brand', label: 'Campaigns', icon: 'megaphone' },
    { href: '/brand/licenses', label: 'Usage & licences', icon: 'clock' },
    { href: '/brand/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { href: '/brand/billing', label: 'Billing', icon: 'card' },
    ...(s.profile.role === 'agency_member' ? [{ href: '/agency', label: 'Agency', icon: 'building' }] : []),
  ];
  return <Shell session={s} nav={nav} themeToggle>{children}</Shell>;
}
