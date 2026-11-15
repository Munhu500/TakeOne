import { agencyInvoiceLine, convertMinor, type CurrencyCode } from '@takeone/shared';
import { getFx, requireRole } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { EmptyState, LinkButton, Money, PageHeader, StatusBadge } from '@/components/ui';
import { InvoiceLink } from '@/components/invoice-link';
import { lineType } from '@/lib/billing';
import { fmtDate } from '@/lib/utils';

export default async function AgencyBilling() {
  const s = await requireRole('agency_member');
  const agency = s.agency!;
  const sb = await supabaseServer();
  const ids = s.brands.map((b) => b.id);
  const [{ data: payments }, fx] = await Promise.all([
    ids.length ? sb.from('payments').select('*, campaigns(title)').in('brand_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    getFx(),
  ]);
  const brands = new Map(s.brands.map((b) => [b.id, b]));
  const cur = s.profile.currency as CurrencyCode;
  const rows = (payments ?? []).map((p) => {
    const b = brands.get(p.brand_id);
    const bps = b?.markup_bps ?? agency.markup_default_bps;
    const line = agencyInvoiceLine(Number(p.gross_minor), bps);
    return { p, client: b?.name ?? 'Client', bps, line };
  });
  const counted = rows.filter((r) => ['held', 'released'].includes(r.p.status));
  const total = (pick: (r: (typeof rows)[number]) => number) => counted.reduce((a, r) => a + convertMinor(pick(r), r.p.currency as CurrencyCode, cur, fx), 0);
  const cost = total((r) => r.line.standardMinor), billed = total((r) => r.line.clientTotalMinor);
  return (
    <>
      <PageHeader title="Billing" sub="What TakeOne bills you at standard prices, and what each client is invoiced with your markup. Creators’ 75% is always worked out on the standard price." />
      {rows.length === 0 ? <EmptyState title="There are no payments yet. They appear here as soon as a client campaign is funded." action={<LinkButton href="/agency">Go to clients</LinkButton>} /> : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-table-wide">
            <thead><tr><th>Date</th><th>Client</th><th>Campaign</th><th>Status</th><th className="num">Your cost</th><th className="num">Client invoice</th><th>PDFs</th></tr></thead>
            <tbody>
              {rows.map(({ p, client, bps, line }) => (
                <tr key={p.id}>
                  <td className="tabular text-secondary">{fmtDate(p.created_at)}</td>
                  <td className="font-medium">{client}</td>
                  <td><div>{(p.campaigns as { title: string } | null)?.title ?? 'Campaign'}</div><div className="text-caption text-tertiary">{lineType(p)}</div></td>
                  <td><StatusBadge kind="payment" status={p.status} /></td>
                  <td className="num"><Money minor={line.standardMinor} currency={p.currency} /></td>
                  <td className="num"><div className="font-medium"><Money minor={line.clientTotalMinor} currency={p.currency} /></div><div className="text-caption text-tertiary">{bps / 100}% markup</div></td>
                  <td><div className="flex items-center gap-3"><InvoiceLink paymentId={p.id} label="Yours" view="cost" /><InvoiceLink paymentId={p.id} label="Client’s" /></div></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong">
                <td colSpan={4} className="px-4 py-4 text-small text-secondary">Totals for paid and escrowed payments, in {cur}</td>
                <td className="num px-4 py-4"><div className="text-caption text-tertiary">Cost</div><div className="font-semibold"><Money minor={cost} currency={cur} /></div></td>
                <td className="num px-4 py-4"><div className="text-caption text-tertiary">Billed</div><div className="font-semibold"><Money minor={billed} currency={cur} /></div></td>
                <td className="px-4 py-4"><div className="text-caption text-tertiary">Margin</div><div className="tabular font-semibold text-accent-text"><Money minor={billed - cost} currency={cur} /></div></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
