import { agencyInvoiceLine, convertMinor, type CurrencyCode } from '@takeone/shared';
import { getFx, requireRole } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { EmptyState, LinkButton, Money, PageHeader, StatusBadge } from '@/components/ui';
import { InvoiceLink } from '@/components/invoice-link';
import { lineType } from '@/lib/billing';
import { Tooltip } from '@/components/ui/overlays';
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
  // totals are kept per currency; amounts in different currencies are never added together silently
  const currencies = [...new Set(counted.map((r) => r.p.currency as CurrencyCode))].sort();
  const totals = currencies.map((c) => {
    const rs = counted.filter((r) => r.p.currency === c);
    const cost = rs.reduce((a, r) => a + r.line.standardMinor, 0), billed = rs.reduce((a, r) => a + r.line.clientTotalMinor, 0);
    return { c, cost, billed, margin: billed - cost };
  });
  const combine = (pick: (t: (typeof totals)[number]) => number) => totals.reduce((a, t) => a + convertMinor(pick(t), t.c, cur, fx), 0);
  const rates = currencies.filter((c) => c !== cur).map((c) => `1 ${c} = ${(convertMinor(1_000_000, c, cur, fx) / 1_000_000).toFixed(4)} ${cur}`).join(' · ');
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
                  <td><div className="flex flex-col gap-1"><InvoiceLink paymentId={p.id} label="Your invoice" view="cost" /><InvoiceLink paymentId={p.id} label="Client invoice" /></div></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {totals.map((t, i) => (
                <tr key={t.c} className={i === 0 ? 'border-t border-border-strong' : undefined}>
                  <td colSpan={4} className="px-4 py-3 text-small text-secondary">Total in {t.c} <span className="text-tertiary">· paid and in escrow</span></td>
                  <td className="num px-4 py-3 font-semibold"><Money minor={t.cost} currency={t.c} /></td>
                  <td className="num px-4 py-3 font-semibold"><Money minor={t.billed} currency={t.c} /></td>
                  <td className="tabular px-4 py-3 text-small"><span className="text-tertiary">Margin </span><span className="font-semibold"><Money minor={t.margin} currency={t.c} /></span></td>
                </tr>
              ))}
              {totals.length > 1 && (
                <tr className="border-t border-border">
                  <td colSpan={4} className="px-4 py-3 text-small text-secondary">
                    Combined <Tooltip label={`Converted at today’s rate: ${rates}`}><span tabIndex={0} className="cursor-help text-tertiary underline decoration-dotted underline-offset-4">at today’s rate</span></Tooltip>
                  </td>
                  <td className="num px-4 py-3 text-secondary">≈ <Money minor={combine((t) => t.cost)} currency={cur} /></td>
                  <td className="num px-4 py-3 text-secondary">≈ <Money minor={combine((t) => t.billed)} currency={cur} /></td>
                  <td className="tabular px-4 py-3 text-small text-secondary"><span className="text-tertiary">Margin </span>≈ <Money minor={combine((t) => t.margin)} currency={cur} /></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
