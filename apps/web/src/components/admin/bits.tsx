import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, ICON, LinkButton } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Every queue's empty state: one sentence and the way back. */
export function QueueClear({ text = 'Queue clear.' }: { text?: string }) {
  return <EmptyState title={text} action={<LinkButton href="/admin" variant="secondary">Back to Overview</LinkButton>} />;
}
/** 50 rows a page. `href(n)` builds the address for page n so filters are kept. */
export function Pager({ page, pages, total, href }: { page: number; pages: number; total: number; href: (n: number) => string }) {
  if (pages <= 1) return <p className="tabular mt-3 text-caption text-tertiary">{total} {total === 1 ? 'row' : 'rows'}</p>;
  const link = 'grid size-9 place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary aria-disabled:pointer-events-none aria-disabled:opacity-40';
  return (
    <nav aria-label="Pages" className="tabular mt-3 flex items-center justify-between text-caption text-tertiary">
      <span>{total} rows · page {page} of {pages}</span>
      <span className="flex gap-1">
        <Link href={href(Math.max(1, page - 1))} aria-disabled={page === 1} aria-label="Previous page" className={link}><ChevronLeft size={20} {...ICON} /></Link>
        <Link href={href(Math.min(pages, page + 1))} aria-disabled={page === pages} aria-label="Next page" className={link}><ChevronRight size={20} {...ICON} /></Link>
      </span>
    </nav>
  );
}
export function FilterLink({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return <Link href={href} aria-current={on ? 'true' : undefined} className={cn('chip', on && 'is-on')}>{children}</Link>;
}
/** Label over value, used in drawers and detail panels. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-caption text-tertiary">{label}</dt><dd className="mt-1 text-small">{children}</dd></div>;
}
