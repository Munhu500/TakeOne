'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, Building2, CreditCard, FileClock, Gauge, LayoutGrid, Megaphone, MessageSquare, Palette, Receipt, Scale, Settings, ShieldCheck, Trophy, Users } from 'lucide-react';
import { setActiveBrand } from '@/lib/actions';
import { ICON } from '@/components/ui';
import { Select } from '@/components/ui/select';
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
            className={cn('flex items-center gap-3 whitespace-nowrap rounded-sm px-3 text-small transition-colors duration-fast', compact ? 'h-control-sm' : 'h-control-md', n.href === active ? 'bg-surface-3 font-medium text-primary' : 'text-secondary hover:bg-surface-3 hover:text-primary')}>
            <Icon size={16} {...ICON} />{n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BrandSwitcher({ brands, active }: { brands: { id: string; name: string }[]; active: string | null }) {
  return <Select id="client-workspace" className="mt-6" label="Client workspace" value={active ?? ''} onValueChange={(v) => setActiveBrand(v)} options={brands.map((b) => ({ value: b.id, label: b.name }))} />;
}
