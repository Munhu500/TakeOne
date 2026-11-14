import type { ReactNode } from 'react';
import { requireRole } from '@/lib/session';
import { CREDITS_ENABLED } from '@takeone/shared';
import { Shell } from '@/components/shell';

const NAV = [
  ['qa', 'QA queue', 'shield'], ['verification', 'Verification', 'badge'], ['users', 'Users', 'users'], ['campaigns', 'Campaigns', 'megaphone'], ['disputes', 'Disputes & refunds', 'scale'],
  ['payouts', 'Payouts', 'card'], ['masking', 'Masking flags', 'message'], ['credits', 'Credits', 'receipt'], ['settings', 'Settings', 'settings'],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireRole('admin');
  return <Shell session={s} nav={NAV.filter(([k]) => k !== 'credits' || CREDITS_ENABLED).map(([k, label, icon]) => ({ href: `/admin/${k}`, label, icon }))}>{children}</Shell>;
}
