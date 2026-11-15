import Link from 'next/link';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TdHTMLAttributes, TextareaHTMLAttributes, ThHTMLAttributes } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { assetUrl, cn, initials, money, pluralise } from '@/lib/utils';

export { StatusBadge, statusLabel, type StatusKind } from './status';
export { Flag } from './flag';
export { ProductImage, VideoFrame } from './media';
export const ICON = { strokeWidth: 1.5 } as const;

// ── Button ──────────────────────────────────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-inverse text-on-inverse hover:bg-inverse-hover',
  secondary: 'border border-border-strong text-primary hover:bg-surface-3',
  ghost: 'text-secondary hover:bg-surface-3 hover:text-primary',
  // at most one per view: the single most important action in a flow
  accent: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed',
  destructive: 'bg-danger-soft text-danger-text hover:bg-surface-3',
};
const SIZE: Record<ButtonSize, string> = { sm: 'h-control-sm px-4 text-small', md: 'h-control-md px-5 text-small', lg: 'h-control-lg px-6 text-body' };
/** Class string for anything that should look like a button (links, labels). */
export const btn = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md') =>
  cn('relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition duration-fast ease-standard active:scale-press disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40', SIZE[size], VARIANT[variant]);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }
/** Loading keeps the button's width: the label stays in the layout (invisible) and a spinner sits on top. */
export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, ...p }: ButtonProps) {
  return (
    <button {...p} disabled={disabled || loading} aria-busy={loading || undefined} className={cn(btn(variant, size), className)}>
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
      {loading && <span className="absolute inset-0 grid place-items-center"><Loader2 size={16} {...ICON} className="animate-spin" aria-hidden /></span>}
    </button>
  );
}
export function LinkButton({ href, variant = 'primary', size = 'md', className, children, ...rest }: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode; target?: string; rel?: string }) {
  return <Link href={href} {...rest} className={cn(btn(variant, size), className)}>{children}</Link>;
}

// ── Form fields ─────────────────────────────────────────────────────────────────────────────────────────
export interface FieldProps { label: string; helper?: ReactNode; error?: string | null; id: string }
export function Field({ label, helper, error, id, children }: FieldProps & { children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? <p id={`${id}-msg`} role="alert" className="mt-2 text-small text-danger-text">{error}</p> : helper ? <p id={`${id}-msg`} className="helper">{helper}</p> : null}
    </div>
  );
}
const invalid = (error?: string | null) => (error ? 'border-danger hover:border-danger focus:border-danger' : '');
export function Input({ label, helper, error, id, className, ...p }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} helper={helper} error={error} id={id}><input id={id} aria-invalid={!!error || undefined} aria-describedby={error || helper ? `${id}-msg` : undefined} {...p} className={cn('input', invalid(error), className)} /></Field>;
}
export function Textarea({ label, helper, error, id, className, ...p }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} helper={helper} error={error} id={id}><textarea id={id} aria-invalid={!!error || undefined} aria-describedby={error || helper ? `${id}-msg` : undefined} {...p} className={cn('input', invalid(error), className)} /></Field>;
}
/** Checkbox row used for consents. */
export function Checkbox({ id, checked, onChange, children, required }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-2 p-4 text-small transition-colors duration-fast hover:border-border-strong">
      <input id={id} type="checkbox" required={required} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 shrink-0 accent-accent" />
      <span className="text-secondary">{children}</span>
    </label>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────────────────────────────────
/** surface-1, 1px border, radius lg, no shadow. `interactive` adds hover + press for clickable cards. */
export function Card({ className, interactive, ...p }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div {...p} className={cn('card p-5 md:p-6', interactive && 'cursor-pointer transition duration-fast ease-standard hover:border-border-strong hover:bg-surface-3 active:scale-press', className)} />;
}
export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-h2">{title}</h1>
        {sub && <div className="mt-2 max-w-prose text-small text-secondary">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
export function Stat({ label, value, hint, delta }: { label: string; value: ReactNode; hint?: ReactNode; delta?: { text: string; tone: 'success' | 'danger' } }) {
  return (
    <Card>
      <div className="caption-label">{label}</div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="tabular text-stat-sm">{value}</span>
        {delta && <Badge tone={delta.tone}>{delta.text}</Badge>}
      </div>
      {hint && <div className="mt-2 text-small text-tertiary">{hint}</div>}
    </Card>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────────────────────────────────
const TONES = {
  neutral: 'bg-surface-3 text-secondary',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  outline: 'border border-border-strong text-secondary',
};
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span {...p} className={cn('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-caption', TONES[tone], className)} />;
}
/** One small neutral pill for the top bar. Replaces the old full-width demo strip and floating preview banner. */
export function DemoPill() {
  return <Badge tone="outline" title="Payments, payouts and AI services are simulated">Demo</Badge>;
}

// ── Avatar ──────────────────────────────────────────────────────────────────────────────────────────────
const AVATAR = { sm: 'size-8 text-caption', md: 'size-10 text-small', lg: 'size-12 text-body' };
export function Avatar({ name, src, size = 'md', square }: { name: string; src?: string | null; size?: keyof typeof AVATAR; square?: boolean }) {
  const shape = cn('shrink-0 border border-border object-cover', square ? 'rounded-sm' : 'rounded-full', AVATAR[size]);
  // eslint-disable-next-line @next/next/no-img-element
  const url = assetUrl(src);
  return url ? <img src={url} alt="" className={shape} /> : <span aria-hidden className={cn('inline-grid place-items-center bg-surface-3 font-medium text-secondary', shape)}>{initials(name)}</span>;
}

// ── Tabs (page-level navigation, accent underline) ──────────────────────────────────────────────────────
export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-border" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? 'page' : undefined}
          className={cn('-mb-px inline-flex h-control-md items-center gap-2 whitespace-nowrap border-b-2 px-3 text-small transition-colors duration-fast', t.href === active ? 'border-accent-brand font-medium text-primary' : 'border-transparent text-secondary hover:text-primary')}>
          {t.label}
          {t.count !== undefined && <span className="tabular rounded-full bg-surface-3 px-2 text-caption text-secondary">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────────────────────────────────
export function Table({ children, minWidth = 'table', className }: { children: ReactNode; minWidth?: 'table' | 'table-wide' | 'none'; className?: string }) {
  return (
    <div className={cn('card overflow-x-auto', className)}>
      <table className={cn('w-full border-collapse text-small', minWidth === 'table' && 'min-w-table', minWidth === 'table-wide' && 'min-w-table-wide')}>{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-sticky bg-surface-1"><tr className="border-b border-border">{children}</tr></thead>;
}
export function Th({ numeric, className, ...p }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th scope="col" {...p} className={cn('caption-label h-12 px-4 font-medium', numeric ? 'text-right' : 'text-left', className)} />;
}
export function Tr({ media, className, ...p }: HTMLAttributes<HTMLTableRowElement> & { media?: boolean }) {
  return <tr {...p} className={cn('border-b border-border transition-colors duration-fast last:border-b-0 hover:bg-surface-3', media ? 'h-row-media' : 'h-row', className)} />;
}
export function Td({ numeric, className, ...p }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td {...p} className={cn('px-4 py-2 align-middle', numeric && 'tabular text-right', className)} />;
}
export function RowChevron() {
  return <ChevronRight size={16} {...ICON} className="text-tertiary" aria-hidden />;
}

// ── Feedback ────────────────────────────────────────────────────────────────────────────────────────────
export function Skeleton({ className, shape = 'row' }: { className?: string; shape?: 'row' | 'card' | 'stat' | 'text' }) {
  const shapes = { row: 'h-row w-full', card: 'h-48 w-full rounded-lg', stat: 'h-32 w-full rounded-lg', text: 'h-4 w-48' };
  return <div aria-hidden className={cn('skeleton', shapes[shape], className)} />;
}
export function SkeletonPage() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton shape="text" className="mb-6 h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} shape="stat" />)}</div>
      <div className="card mt-6 divide-y divide-border">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="p-4"><Skeleton shape="text" className="w-2/3" /></div>)}</div>
    </div>
  );
}
/** One sentence and one action. No illustrations. */
export function EmptyState({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('card flex flex-col items-center gap-4 px-6 py-12 text-center', className)}>
      <p className="max-w-prose text-body text-secondary">{title}</p>
      {action}
    </div>
  );
}
/** @deprecated alias kept for older call sites: body is merged into the sentence. */
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <EmptyState title={body ? `${title.replace(/[.]$/, '')}. ${body}` : title} action={action} />;
}
export function ErrorState({ title = 'This could not be loaded.', retry }: { title?: string; retry?: ReactNode }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
      <p className="max-w-prose text-body text-secondary">{title}</p>
      {retry}
    </div>
  );
}
/** "2 of 3 creators" style values. */
export function ProgressBar({ value, max, label, tone = 'neutral' }: { value: number; max: number; label?: string; tone?: 'neutral' | 'accent' | 'success' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = { neutral: 'bg-inverse', accent: 'bg-accent-brand', success: 'bg-success' }[tone];
  return (
    <div>
      {label && <div className="tabular mb-2 flex justify-between text-small text-secondary"><span>{label}</span><span>{value} of {max}</span></div>}
      <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label ?? `${value} of ${max}`} className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full rounded-full transition-all duration-base ease-standard', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Formatting ──────────────────────────────────────────────────────────────────────────────────────────
/** Money in local currency with local grouping, tabular figures. No decimals in summaries; `precise` for invoices. */
export function Money({ minor, currency, precise, className }: { minor: number | string | null | undefined; currency: string; precise?: boolean; className?: string }) {
  return <span className={cn('tabular whitespace-nowrap', className)}>{money(minor, currency, { precise })}</span>;
}
export function Plural({ n, one, many }: { n: number; one: string; many?: string }) {
  return <>{pluralise(n, one, many)}</>;
}
/** Codes, IDs and references. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-surface-3 px-2 py-1 font-mono text-caption text-secondary">{children}</code>;
}
