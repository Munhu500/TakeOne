import Link from 'next/link';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn, assetUrl } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110',
  secondary: 'bg-raised text-fg border border-line hover:border-faint',
  ghost: 'text-muted hover:text-fg hover:bg-raised',
  danger: 'bg-bad/15 text-bad hover:bg-bad/25',
};
export const btn = (variant: Variant = 'primary', size: 'sm' | 'md' = 'md') =>
  cn('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm', BTN[variant]);

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <button {...p} className={cn(btn(variant, size), className)} />;
}
export function LinkButton({ href, variant = 'primary', size = 'md', className, children }: { href: string; variant?: Variant; size?: 'sm' | 'md'; className?: string; children: ReactNode }) {
  return <Link href={href} className={cn(btn(variant, size), className)}>{children}</Link>;
}

const TONES = { neutral: 'bg-raised text-muted border-line', accent: 'bg-accent/15 text-accent border-accent/30', ok: 'bg-ok/10 text-ok border-ok/25', warn: 'bg-warn/10 text-warn border-warn/25', bad: 'bg-bad/10 text-bad border-bad/25' };
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span {...p} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', TONES[tone], className)} />;
}
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn('card p-5', className)} />;
}
export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1.5 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </Card>
  );
}
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="font-medium">{title}</div>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
/** Logo / avatar with an initials fallback. */
export function Avatar({ name, src, size = 36, square }: { name: string; src?: string | null; size?: number; square?: boolean }) {
  const url = assetUrl(src);
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={cn('shrink-0 object-cover', square ? 'rounded-lg' : 'rounded-full')} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center font-semibold text-white', square ? 'rounded-lg' : 'rounded-full')} style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 55% 42%)` }}>{initials}</span>
  );
}
export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? 'page' : undefined} className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm', t.href === active ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg')}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-raised px-1.5 py-0.5 text-[11px] text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
export const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral', live: 'ok', in_progress: 'accent', completed: 'neutral', cancelled: 'bad', applied: 'neutral', shortlisted: 'accent', accepted: 'ok', rejected: 'bad', invited: 'warn', declined: 'bad',
  processing: 'warn', variants_ready: 'accent', qa_review: 'warn', delivered: 'accent', approved: 'ok', disputed: 'bad', held: 'warn', released: 'ok', refunded: 'bad', paid: 'ok', licensed: 'ok', qa_pending: 'warn', open: 'warn',
};
