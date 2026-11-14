import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/actions';
import { hostAgency, type Session } from '@/lib/session';
import { Avatar, btn } from '@/components/ui';
import { ThemeToggle } from '@/components/client';
import { BrandSwitcher, NavLinks } from '@/components/nav';
import { DEMO } from '@/lib/utils';

/** Who the product is "by" on this request: the agency (white-label) or TakeOne. Clients of an agency never see TakeOne branding. */
export async function whiteLabel(session?: Session | null) {
  const agency = session?.agency ?? (await hostAgency());
  return agency ? { name: agency.name, logo: agency.logo, agency } : { name: 'TakeOne', logo: null, agency: null };
}

export function Wordmark({ name, logo, href = '/' }: { name: string; logo?: string | null; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-display text-lg font-semibold">
      {logo ? <Avatar name={name} src={logo} size={28} square /> : <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">{name[0]}</span>}
      {name}
    </Link>
  );
}

export async function Shell({ session, nav, children }: { session: Session; nav: { href: string; label: string; icon: string }[]; children: ReactNode }) {
  const wl = await whiteLabel(session);
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px]">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line px-4 py-5 md:flex">
        <Wordmark {...wl} href={nav[0]?.href} />
        {session.profile.role === 'agency_member' && session.brands.length > 0 && <BrandSwitcher brands={session.brands.map((b) => ({ id: b.id, name: b.name }))} active={session.brand?.id ?? null} />}
        <NavLinks nav={nav} className="mt-6 flex flex-1 flex-col gap-0.5" />
        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <Avatar name={session.profile.display_name || session.email} src={session.profile.avatar} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{session.profile.display_name}</div>
            <div className="truncate text-xs text-faint">{session.email}</div>
          </div>
          <ThemeToggle />
          <form action={signOut}><button className={btn('ghost', 'sm')} aria-label="Sign out"><LogOut size={15} /></button></form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:hidden">
          <Wordmark {...wl} href={nav[0]?.href} />
          <div className="flex items-center gap-1"><ThemeToggle /><form action={signOut}><button className={btn('ghost', 'sm')} aria-label="Sign out"><LogOut size={15} /></button></form></div>
        </header>
        <NavLinks nav={nav} className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" compact />
        {DEMO && <div className="border-b border-line bg-accent/10 px-6 py-1.5 text-center text-xs text-muted">Demo mode: payments, payouts and AI services are simulated.</div>}
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
