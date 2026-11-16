import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/admin';
import { Shell } from '@/components/shell';

/**
 * Internal console: never white-labelled, and only for admin accounts that have passed two-factor.
 * The navigation shows what the admin's role covers; the database refuses everything else regardless.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const a = await requireAdmin();
  const c = a.counts;
  const nav = [
    { href: '/admin', label: 'Overview', icon: 'gauge' },
    ...(a.can('review') ? [{ href: '/admin/qa', label: 'QA review', icon: 'shield', count: c.qa }, { href: '/admin/verification', label: 'Verification', icon: 'badge', count: c.verification }] : []),
    { href: '/admin/users', label: 'Users', icon: 'users' },
    { href: '/admin/campaigns', label: 'Campaigns', icon: 'megaphone' },
    { href: '/admin/disputes', label: 'Disputes', icon: 'scale', count: c.disputes },
    ...(a.can('money') ? [{ href: '/admin/payouts', label: 'Payouts', icon: 'card', count: (c.payouts_on_hold ?? 0) + (c.payouts_failed ?? 0) }] : []),
    ...(a.can('review') ? [{ href: '/admin/masking', label: 'Masking flags', icon: 'message', count: c.masking }] : []),
    { href: '/admin/audit', label: 'Audit log', icon: 'history' },
    ...(a.can('settings') ? [{ href: '/admin/settings', label: 'Settings', icon: 'settings' }] : []),
  ];
  return <Shell session={a.session} nav={nav} internal>{children}</Shell>;
}
