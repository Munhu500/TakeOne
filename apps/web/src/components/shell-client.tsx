'use client';
// Interactive parts of the dashboard frame: navigation, workspace switcher, user menu, breadcrumb, notifications.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BadgeCheck, Bell, Building2, ChevronRight, ChevronsUpDown, CreditCard, FileClock, Gauge, History, LayoutGrid, LogOut, Megaphone, MessageSquare, Moon, Palette, Plus, Receipt, Scale, Search, Settings, ShieldCheck, Sun, Trophy, Users,
} from 'lucide-react';
import { COUNTRIES } from '@takeone/shared';
import { setActiveBrand } from '@/lib/actions';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Avatar, Flag, ICON } from '@/components/ui';
import { Popover, Tooltip } from '@/components/ui/overlays';
import { cn, timeAgo } from '@/lib/utils';

const ICONS = { grid: LayoutGrid, trophy: Trophy, clock: FileClock, card: CreditCard, building: Building2, palette: Palette, receipt: Receipt, shield: ShieldCheck, badge: BadgeCheck, users: Users, gauge: Gauge, settings: Settings, message: MessageSquare, scale: Scale, megaphone: Megaphone, history: History };
export interface NavItem { href: string; label: string; icon: string; /** live count shown as a badge, e.g. items waiting in a queue */ count?: number }

const activeHref = (nav: NavItem[], path: string) => [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => path === n.href || path.startsWith(`${n.href}/`))?.href;

/** Sidebar rows: 40px, 20px icons. Active row is surface-3 with primary text, never an accent fill. Icons only below 1024px. */
export function NavLinks({ nav, variant = 'sidebar' }: { nav: NavItem[]; variant?: 'sidebar' | 'bar' }) {
  const active = activeHref(nav, usePathname());
  return (
    <nav aria-label="Main" className={variant === 'sidebar' ? 'flex flex-1 flex-col gap-1' : 'flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden'}>
      {nav.map((n) => {
        const Icon = ICONS[n.icon as keyof typeof ICONS] ?? LayoutGrid;
        const link = (
          <Link key={n.href} href={n.href} aria-current={n.href === active ? 'page' : undefined}
            className={cn('flex h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-sm px-3 text-small transition-colors duration-fast', variant === 'sidebar' && 'justify-center xl:justify-start',
              n.href === active ? 'bg-surface-3 font-medium text-primary' : 'text-secondary hover:bg-surface-3 hover:text-primary')}>
            <span className="relative shrink-0"><Icon size={20} {...ICON} aria-hidden />{!!n.count && variant === 'sidebar' && <span aria-hidden className="absolute -right-1 -top-1 size-2 rounded-full bg-accent-brand xl:hidden" />}</span>
            <span className={variant === 'sidebar' ? 'sr-only xl:not-sr-only xl:flex-1' : undefined}>{n.label}</span>
            {!!n.count && <span className={cn('tabular rounded-full bg-surface-3 px-2 text-caption text-primary', variant === 'sidebar' && 'hidden xl:inline')} aria-label={`${n.count} waiting`}>{n.count}</span>}
          </Link>
        );
        // collapsed sidebar (1024px and below): the label is hidden, so each icon carries a tooltip
        return variant === 'sidebar' ? <Tooltip key={n.href} label={n.count ? `${n.label} · ${n.count} waiting` : n.label} side="right" className="xl:hidden">{link}</Tooltip> : link;
      })}
    </nav>
  );
}

export interface Workspace { id: string; name: string; logo: string | null; country: string }
/** Agency only: pick the client workspace. Search, then "Add client" at the bottom. */
export function WorkspaceSwitcher({ workspaces, active }: { workspaces: Workspace[]; active: string | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = workspaces.find((w) => w.id === active) ?? workspaces[0];
  const shown = workspaces.filter((w) => w.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen} side="bottom" align="start" className="w-72 p-0"
      trigger={
        <button type="button" title={`Client: ${current?.name ?? 'none'}`} aria-label={`Client workspace: ${current?.name ?? 'none'}. Change`} className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-sm border border-border px-2 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-3 xl:justify-start">
          {/* the dot marks this tile as the client, so it is not mistaken for the agency's own mark above it */}
          <span className="relative shrink-0">{current ? <Avatar name={current.name} src={current.logo} size="sm" square /> : <Building2 size={20} {...ICON} />}<span aria-hidden className="absolute -right-1 -top-1 size-2 rounded-full bg-accent-brand ring-2 ring-surface-1" /></span>
          <span className="hidden min-w-0 flex-1 xl:block"><span className="block truncate text-small font-medium">{current?.name ?? 'Choose a client'}</span><span className="block truncate text-caption text-tertiary">Client workspace</span></span>
          <ChevronsUpDown size={16} {...ICON} className="hidden shrink-0 text-tertiary xl:block" aria-hidden />
        </button>
      }>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search size={16} {...ICON} className="text-tertiary" aria-hidden />
        <input autoFocus aria-label="Search clients" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full bg-transparent text-small outline-none placeholder:text-tertiary" />
      </div>
      <ul className="max-h-72 overflow-y-auto p-1">
        {shown.map((w) => (
          <li key={w.id}>
            <button type="button" aria-current={w.id === current?.id} onClick={() => { setOpen(false); void setActiveBrand(w.id); }} className={cn('flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors duration-fast hover:bg-surface-3', w.id === current?.id && 'bg-surface-3')}>
              <Avatar name={w.name} src={w.logo} size="sm" square />
              <span className="min-w-0 flex-1"><span className="block truncate text-small font-medium">{w.name}</span><span className="flex items-center gap-2 text-caption text-tertiary"><Flag code={w.country} />{COUNTRIES[w.country as keyof typeof COUNTRIES]?.name ?? w.country}</span></span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-4 text-small text-secondary">No client matches “{q}”.</li>}
      </ul>
      <Link href="/agency?add=1" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2 border-t border-border px-3 text-small text-secondary transition-colors duration-fast hover:text-primary"><Plus size={16} {...ICON} aria-hidden />Add client</Link>
    </Popover>
  );
}

/** Avatar, name and (truncated) email; theme and sign-out live inside the menu. Light mode is a brand-dashboard option only. */
export function UserMenu({ name, email, avatar, themeToggle, signOut, compact }: { name: string; email: string; avatar: string | null; themeToggle?: boolean; signOut: () => void | Promise<void>; compact?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => setTheme((document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark'), []);
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('t1-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };
  const item = 'flex h-10 w-full items-center gap-3 rounded-sm px-3 text-small text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary';
  return (
    <Popover side="top" align="start" className="w-64 p-1"
      trigger={
        <button type="button" title={name} aria-label={`Account menu for ${name}`} className={cn('flex items-center gap-3 rounded-sm text-left transition-colors duration-fast hover:bg-surface-3', compact ? 'p-1' : 'w-full justify-center p-2 xl:justify-start')}>
          <Avatar name={name} src={avatar} size="sm" />
          {!compact && (
            <span className="hidden min-w-0 flex-1 xl:block">
              <span className="block truncate text-small font-medium">{name}</span>
              <Tooltip label={email}><span className="block truncate text-caption text-tertiary">{email}</span></Tooltip>
            </span>
          )}
        </button>
      }>
      <div className="border-b border-border px-3 py-3"><div className="truncate text-small font-medium">{name}</div><div className="truncate text-caption text-tertiary">{email}</div></div>
      <div className="pt-1">
        {themeToggle && <button type="button" className={item} onClick={flip}>{theme === 'dark' ? <Sun size={20} {...ICON} aria-hidden /> : <Moon size={20} {...ICON} aria-hidden />}{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>}
        <form action={signOut}><button type="submit" className={item}><LogOut size={20} {...ICON} aria-hidden />Sign out</button></form>
      </div>
    </Popover>
  );
}

const SECTIONS: [RegExp, string[]][] = [
  [/^\/brand\/campaigns\/new/, ['Campaigns', 'New campaign']],
  [/^\/brand\/campaigns\/[^/]+\/review/, ['Campaigns', 'Campaign', 'Review']],
  [/^\/brand\/campaigns\/[^/]+/, ['Campaigns', 'Campaign']],
  [/^\/brand\/licenses/, ['Usage & licences']],
  [/^\/brand\/leaderboard/, ['Leaderboard']],
  [/^\/brand\/billing/, ['Billing']],
  [/^\/brand/, ['Campaigns']],
  [/^\/agency\/branding/, ['White-label']],
  [/^\/agency\/billing/, ['Billing']],
  [/^\/agency/, ['Clients']],
  [/^\/admin\/qa/, ['QA review']], [/^\/admin\/verification/, ['Verification']], [/^\/admin\/users/, ['Users']], [/^\/admin\/campaigns\/[^/]+/, ['Campaigns', 'Campaign']], [/^\/admin\/campaigns/, ['Campaigns']],
  [/^\/admin\/disputes/, ['Disputes']], [/^\/admin\/payouts/, ['Payouts']], [/^\/admin\/masking/, ['Masking flags']], [/^\/admin\/settings/, ['Settings']], [/^\/admin\/audit/, ['Audit log']], [/^\/admin/, ['Overview']],
];
/** e.g. Mirage Media › Noor Beauty › Campaigns. `root` comes from the session; the section from the address. */
export function Breadcrumb({ root, brandRoot }: { root: string[]; brandRoot: string[] }) {
  const path = usePathname();
  const section = SECTIONS.find(([re]) => re.test(path))?.[1] ?? [];
  const parts = [...(path.startsWith('/brand') ? brandRoot : root), ...section];
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-2 text-small text-secondary">
        {parts.map((p, i) => (
          <li key={`${p}-${i}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && <ChevronRight size={16} {...ICON} className="shrink-0 text-tertiary" aria-hidden />}
            <span className={cn('truncate', i === parts.length - 1 && 'text-primary')} aria-current={i === parts.length - 1 ? 'page' : undefined}>{p}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface Note { id: string; type: string; title: string; body: string | null; read_at: string | null; created_at: string; href: string | null; action: string | null }
/** Bell with an unread count. Opening the list marks everything shown as read (the user's own rows only). */
export function NotificationsBell({ notes }: { notes: Note[] }) {
  const [read, setRead] = useState(false);
  const unread = useMemo(() => (read ? 0 : notes.filter((n) => !n.read_at).length), [notes, read]);
  const onOpen = (open: boolean) => {
    if (!open || read || unread === 0) return;
    setRead(true);
    const ids = notes.filter((n) => !n.read_at).map((n) => n.id);
    void supabaseBrowser().from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).then(() => undefined);
  };
  return (
    <Popover align="end" onOpenChange={onOpen} className="w-80 p-0"
      trigger={
        <button type="button" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative grid size-control-sm place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary">
          <Bell size={20} {...ICON} aria-hidden />
          {unread > 0 && <span className="tabular absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-inverse px-1 text-caption text-on-inverse">{unread}</span>}
        </button>
      }>
      <div className="caption-label border-b border-border px-4 py-3">Notifications</div>
      {notes.length === 0 ? <p className="px-4 py-6 text-small text-secondary">You have no notifications yet.</p> : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <div className="text-small">{n.title}</div>
              <div className="mt-1 flex items-center justify-between gap-3 text-caption text-tertiary">
                <span className="truncate">{n.body ? `${n.body} · ` : ''}{timeAgo(n.created_at)}</span>
                {n.href && n.action && <Link href={n.href} className="shrink-0 text-accent-text underline-offset-4 hover:underline">{n.action}</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

export function Collapsed({ children }: { children: ReactNode }) {
  return <span className="xl:hidden">{children}</span>;
}
