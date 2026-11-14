import { agencyInvoiceLine, formatMoney } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, Card, Empty, PageHeader, Stat, STATUS_TONE } from '@/components/ui';
import { InvoiceLink } from '@/components/invoice-link';
import { daysLeft, fmtDate, titleCase } from '@/lib/utils';

export default async function Billing() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data: payments }, { data: credits }] = await Promise.all([
    sb.from('payments').select('*, campaigns(title)').eq('brand_id', s.brand.id).order('created_at', { ascending: false }),
    sb.from('credits').select('*').eq('brand_id', s.brand.id).order('created_at', { ascending: false }),
  ]);
  const money = (m: number) => formatMoney(m, s.brand.currency);
  const isAgency = s.profile.role === 'agency_member' && !!s.agency;
  const markup = s.brand.markup_bps ?? s.agency?.markup_default_bps ?? 0;
  const list = payments ?? [];
  const paid = list.filter((p) => ['held', 'released'].includes(p.status));
  const active = (credits ?? []).filter((c) => new Date(c.expires_at) > new Date());
  return (
    <>
      <PageHeader title="Billing" sub="One invoice per payment. Campaign funds are held in escrow until you approve." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid to date" value={money(paid.reduce((a, p) => a + Number(p.amount_minor), 0))} />
        <Stat label="Held in escrow" value={money(list.filter((p) => p.status === 'held').reduce((a, p) => a + Number(p.amount_minor), 0))} />
        <Stat label="Campaign credit" value={money(active.reduce((a, c) => a + Number(c.amount_minor) - Number(c.used_minor), 0))} hint="Applies to the platform fee on your next campaign" />
      </div>
      {active.length > 0 && (
        <Card className="mt-6">
          <div className="text-sm font-medium">Credits</div>
          <ul className="mt-3 space-y-2 text-sm">{active.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2"><span>{money(Number(c.amount_minor) - Number(c.used_minor))} available <span className="text-faint">of {money(Number(c.amount_minor))}{c.source_campaign_id ? ' · earned when your first campaign completed' : ' · issued by support'}</span></span><Badge tone={daysLeft(c.expires_at) <= 14 ? 'warn' : 'neutral'}>Expires {fmtDate(c.expires_at)}</Badge></li>
          ))}</ul>
          <p className="mt-3 text-xs text-muted">Credit reduces only the 25% platform fee. Creator payouts are never reduced.</p>
        </Card>
      )}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Payments</h2>
      {list.length === 0 ? <Empty title="No payments yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">For</th><th className="p-4 font-medium">Status</th><th className="p-4 text-right font-medium">{isAgency ? 'Your cost' : 'Amount'}</th>{isAgency && <th className="p-4 text-right font-medium">Client invoice</th>}<th className="p-4" /></tr></thead>
            <tbody className="tabular divide-y divide-line">
              {list.map((p) => {
                const line = agencyInvoiceLine(Number(p.gross_minor), markup);
                return (
                  <tr key={p.id}>
                    <td className="p-4 text-muted">{fmtDate(p.created_at)}</td>
                    <td className="p-4">{(p.campaigns as { title: string } | null)?.title ?? 'Campaign'}<div className="text-xs text-faint">{p.kind === 'license' ? `${titleCase((p.metadata as { type?: string })?.type ?? 'license')} license` : 'Campaign escrow'}{Number(p.credit_applied_minor) > 0 ? ` · ${money(Number(p.credit_applied_minor))} credit applied` : ''}</div></td>
                    <td className="p-4"><Badge tone={STATUS_TONE[p.status]}>{p.status === 'held' ? 'In escrow' : titleCase(p.status)}</Badge></td>
                    <td className="p-4 text-right font-medium">{formatMoney(Number(p.amount_minor), p.currency)}</td>
                    {isAgency && <td className="p-4 text-right">{formatMoney(line.clientTotalMinor, p.currency)}<div className="text-xs text-faint">incl. {(markup / 100).toFixed(0)}% markup</div></td>}
                    <td className="p-4 text-right"><InvoiceLink paymentId={p.id} label={isAgency ? 'Client invoice PDF' : 'Invoice PDF'} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
