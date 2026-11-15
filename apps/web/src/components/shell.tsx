import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/lib/actions';
import { hostAgency, type Session } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { DemoPill } from '@/components/ui';
import { Tooltip } from '@/components/ui/overlays';
import { Logo } from '@/components/logo';
import { Breadcrumb, NavLinks, NotificationsBell, UserMenu, WorkspaceSwitcher, type NavItem, type Note } from '@/components/shell-client';
import { DEMO } from '@/lib/utils';

/** Who the product is "by" on this request: the agency (white-label) or TakeOne. Clients of an agency never see TakeOne branding. */
export async function whiteLabel(session?: Session | null) {
  const agency = session?.agency ?? (await hostAgency());
  return agency ? { name: agency.name, logo: agency.logo, agency } : { name: 'TakeOne', logo: null, agency: null };
}

export function Wordmark({ name, logo, href = '/' }: { name: string; logo?: string | null; href?: string }) {
  return <Link href={href} className="flex min-w-0 items-center rounded-sm"><Logo name={name} logo={logo} agency={name !== 'TakeOne'} /></Link>;
}

/** Where a notification should take the reader, and what the link says. */
function noteLink(n: { type: string; data: Record<string, unknown> | null }): Pick<Note, 'href' | 'action'> {
  const d = n.data ?? {};
  if (n.type === 'renewal') return { href: '/brand/licenses', action: 'Renew' };
  if (n.type === 'delivered' && d.campaign_id && d.assignment_id) return { href: `/brand/campaigns/${d.campaign_id}/review/${d.assignment_id}`, action: 'Review' };
  if (n.type === 'delivered') return { href: '/brand', action: 'Review' };
  if (d.campaign_id) return { href: `/brand/campaigns/${d.campaign_id}`, action: 'Open' };
  return { href: null, action: null };
}
export async function loadNotes(limit = 8): Promise<Note[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from('notifications').select('id, type, title, body, data, read_at, created_at').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, read_at: n.read_at, created_at: n.created_at, ...noteLink(n as { type: string; data: Record<string, unknown> | null }) }));
}

/**
 * Dashboard frame. Sidebar (248px, icons only at 1024px and below) from 768px up; a glass top bar with a scrolling
 * nav row on phones. The content column starts with a bar holding the breadcrumb, the Demo pill and notifications.
 */
export async function Shell({ session, nav, themeToggle, children }: { session: Session; nav: NavItem[]; themeToggle?: boolean; children: ReactNode }) {
  const [wl, notes] = await Promise.all([whiteLabel(session), loadNotes()]);
  const who = session.profile.display_name || session.email;
  const isAgency = session.profile.role === 'agency_member';
  const root = [wl.name];
  const brandRoot = isAgency && session.brand ? [wl.name, session.brand.name] : [session.brand?.name ?? wl.name];
  const home = nav[0]?.href ?? '/';
  const user = <UserMenu name={who} email={session.email} avatar={session.profile.avatar} themeToggle={themeToggle} signOut={signOut} />;
  return (
    <div className="mx-auto flex min-h-screen max-w-shell">
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col border-r border-border bg-surface-1 px-2 py-5 md:flex xl:w-sidebar xl:px-4">
        <Tooltip label={wl.name} side="right" className="xl:hidden">
          <Link href={home} className="flex h-10 items-center justify-center rounded-sm px-2 xl:justify-start" aria-label={wl.name}>
            <span className="xl:hidden"><Logo name={wl.name} logo={wl.logo} agency={!!wl.agency} wordmark={false} /></span>
            <span className="hidden min-w-0 xl:inline-flex"><Logo name={wl.name} logo={wl.logo} agency={!!wl.agency} /></span>
          </Link>
        </Tooltip>
        {isAgency && session.brands.length > 0 && <WorkspaceSwitcher workspaces={session.brands.map((b) => ({ id: b.id, name: b.name, logo: b.logo, country: b.country }))} active={session.brand?.id ?? null} />}
        <div className="mt-5 flex flex-1 flex-col"><NavLinks nav={nav} /></div>
        <div className="border-t border-border pt-3">{user}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-nav flex h-14 items-center justify-between gap-3 px-5 md:hidden">
          <div className="flex min-w-0 items-center gap-3"><Wordmark {...wl} href={home} />{DEMO && <DemoPill />}</div>
          <div className="flex items-center gap-1"><NotificationsBell notes={notes} /><UserMenu name={who} email={session.email} avatar={session.profile.avatar} themeToggle={themeToggle} signOut={signOut} compact /></div>
        </header>
        <NavLinks nav={nav} variant="bar" />
        <div className="hidden h-14 items-center justify-between gap-4 border-b border-border px-8 md:flex">
          <Breadcrumb root={root} brandRoot={brandRoot} />
          <div className="flex shrink-0 items-center gap-3">{DEMO && <DemoPill />}<NotificationsBell notes={notes} /></div>
        </div>
        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
