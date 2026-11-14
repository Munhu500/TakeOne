'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, Building2, CreditCard, FileClock, Gauge, LayoutGrid, MessageSquare, Palette, Receipt, Settings, ShieldCheck, Trophy, Users, Scale, Megaphone } from 'lucide-react';
import { setActiveBrand } from '@/lib/actions';
import { cn } from '@/lib/utils';

const ICONS = { grid: LayoutGrid, trophy: Trophy, clock: FileClock, card: CreditCard, building: Building2, palette: Palette, receipt: Receipt, shield: ShieldCheck, badge: BadgeCheck, users: Users, gauge: Gauge, settings: Settings, message: MessageSquare, scale: Scale, megaphone: Megaphone };

export function NavLinks({ nav, className, compact }: { nav: { href: string; label: string; icon: string }[]; className?: string; compact?: boolean }) {
  const path = usePathname();
  const active = [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => path === n.href || path.startsWith(`${n.href}/`))?.href;
  return (
    <nav className={className} aria-label="Main">
      {nav.map((n) => {
        const Icon = ICONS[n.icon as keyof typeof ICONS] ?? LayoutGrid;
        return (
          <Link key={n.href} href={n.href} aria-current={n.href === active ? 'page' : undefined}
            className={cn('flex items-center gap-2.5 whitespace-nowrap rounded-xl text-sm transition', compact ? 'px-3 py-1.5' : 'px-3 py-2', n.href === active ? 'bg-raised font-medium text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg')}>
            <Icon size={16} />{n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BrandSwitcher({ brands, active }: { brands: { id: string; name: string }[]; active: string | null }) {
  return (
    <label className="mt-5 block">
      <span className="label">Client workspace</span>
      <select className="input" value={active ?? ''} onChange={(e) => setActiveBrand(e.target.value)} aria-label="Client workspace">
        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
