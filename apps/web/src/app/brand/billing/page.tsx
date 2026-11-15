import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { EmptyState, LinkButton, Money, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { InvoiceLink } from '@/components/invoice-link';
import { lineType } from '@/lib/billing';
import { cn, fmtDate } from '@/lib/utils';

const FILTERS = [['all', 'All'], ['held', 'In escrow'], ['released', 'Released']] as const;

export default async function Billing({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'all' } = await searchParams;
  const s = await requireBrand();
  const sb = await supabaseServer();
  const { data: payments } = await sb.from('payments').select('*, campaigns(title)').eq('brand_id', s.brand.id).order('created_at', { ascending: false });
  const cur = s.brand.currency;
  const list = payments ?? [];
  const sum = (rows: typeof list) => rows.reduce((a, p) => a + Number(p.amount_minor), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const shown = status === 'all' ? list : list.filter((p) => p.status === status);
  return (
    <>
      <PageHeader title="Billing" sub="Campaign budgets are held in escrow and released as you approve each creator’s work. One invoice per payment." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid to date" value={<Money minor={sum(list.filter((p) => ['held', 'released'].includes(p.status)))} currency={cur} />} />
        <Stat label="Held in escrow" value={<Money minor={sum(list.filter((p) => p.status === 'held'))} currency={cur} />} />
        <Stat label="Released this month" value={<Money minor={sum(list.filter((p) => p.status === 'released' && new Date(p.settled_at ?? p.created_at).getTime() >= monthStart))} currency={cur} />} />
      </div>
      <nav aria-label="Filter payments" className="mb-4 mt-8 flex gap-2">
        {FILTERS.map(([v, label]) => <a key={v} href={v === 'all' ? '/brand/billing' : `/brand/billing?status=${v}`} aria-current={status === v ? 'true' : undefined} className={cn('chip', status === v && 'is-on')}>{label}</a>)}
      </nav>
      {list.length === 0 ? <EmptyState title="You have no payments yet. They appear here as soon as you fund a campaign." action={<LinkButton href="/brand/campaigns/new">New campaign</LinkButton>} />
        : shown.length === 0 ? <EmptyState title="No payments match this filter." action={<LinkButton href="/brand/billing" variant="secondary">Show all</LinkButton>} /> : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-table">
            <thead><tr><th>Date</th><th>Description</th><th>Status</th><th className="num">Amount</th><th aria-label="Invoice" /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="tabular text-secondary">{fmtDate(p.created_at)}</td>
                  <td><div className="font-medium">{(p.campaigns as { title: string } | null)?.title ?? 'Campaign'}</div><div className="text-caption text-tertiary">{lineType(p)}</div></td>
                  <td><StatusBadge kind="payment" status={p.status} /></td>
                  <td className="num font-medium"><Money minor={p.amount_minor} currency={p.currency} /></td>
                  <td className="text-right"><InvoiceLink paymentId={p.id} label={`Download invoice for ${fmtDate(p.created_at)}`} icon /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
