import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/lib/actions';
import { hostAgency, type Session } from '@/lib/session';
import { Avatar, DemoPill } from '@/components/ui';
import { SignOutButton, ThemeToggle } from '@/components/client';
import { BrandSwitcher, NavLinks } from '@/components/nav';
import { DEMO } from '@/lib/utils';

/** Who the product is "by" on this request: the agency (white-label) or TakeOne. Clients of an agency never see TakeOne branding. */
export async function whiteLabel(session?: Session | null) {
  const agency = session?.agency ?? (await hostAgency());
  return agency ? { name: agency.name, logo: agency.logo, agency } : { name: 'TakeOne', logo: null, agency: null };
}

export function Wordmark({ name, logo, href = '/' }: { name: string; logo?: string | null; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-sm text-body-lg font-semibold">
      {logo && <Avatar name={name} src={logo} size="sm" square />}
      {name}
    </Link>
  );
}

/** Dashboard frame: sidebar on desktop, glass top bar on mobile. Light mode is offered in the brand dashboard only. */
export async function Shell({ session, nav, themeToggle, children }: { session: Session; nav: { href: string; label: string; icon: string }[]; themeToggle?: boolean; children: ReactNode }) {
  const wl = await whiteLabel(session);
  const who = session.profile.display_name || session.email;
  return (
    <div className="mx-auto flex min-h-screen max-w-shell">
      <aside className="sticky top-0 hidden h-screen w-sidebar shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <div className="flex items-center justify-between gap-2 px-2"><Wordmark {...wl} href={nav[0]?.href} />{DEMO && <DemoPill />}</div>
        {session.profile.role === 'agency_member' && session.brands.length > 0 && <BrandSwitcher brands={session.brands.map((b) => ({ id: b.id, name: b.name }))} active={session.brand?.id ?? null} />}
        <NavLinks nav={nav} className="mt-6 flex flex-1 flex-col gap-1" />
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <Avatar name={who} src={session.profile.avatar} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-small font-medium">{session.profile.display_name}</div>
            <div className="truncate text-caption text-tertiary">{session.email}</div>
          </div>
          {themeToggle && <ThemeToggle />}
          <form action={signOut}><SignOutButton /></form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-nav flex items-center justify-between gap-3 px-5 py-3 md:hidden">
          <div className="flex items-center gap-3"><Wordmark {...wl} href={nav[0]?.href} />{DEMO && <DemoPill />}</div>
          <div className="flex items-center gap-1">{themeToggle && <ThemeToggle />}<form action={signOut}><SignOutButton /></form></div>
        </header>
        <NavLinks nav={nav} className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden" compact />
        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
