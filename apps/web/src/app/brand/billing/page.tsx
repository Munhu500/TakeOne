import { agencyInvoiceLine, CREDITS_ENABLED, LICENSE_LABELS, type LicenseType } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, Card, EmptyState, LinkButton, Money, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { InvoiceLink } from '@/components/invoice-link';
import { daysLeft, fmtDate } from '@/lib/utils';

export default async function Billing() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data: payments }, { data: credits }] = await Promise.all([
    sb.from('payments').select('*, campaigns(title)').eq('brand_id', s.brand.id).order('created_at', { ascending: false }),
    CREDITS_ENABLED ? sb.from('credits').select('*').eq('brand_id', s.brand.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as { id: string; amount_minor: number; used_minor: number; expires_at: string; source_campaign_id: string | null }[] }),
  ]);
  const cur = s.brand.currency;
  const isAgency = s.profile.role === 'agency_member' && !!s.agency;
  const markup = s.brand.markup_bps ?? s.agency?.markup_default_bps ?? 0;
  const list = payments ?? [];
  const sum = (statuses: string[]) => list.filter((p) => statuses.includes(p.status)).reduce((a, p) => a + Number(p.amount_minor), 0);
  const active = (credits ?? []).filter((c) => new Date(c.expires_at) > new Date());
  return (
    <>
      <PageHeader title="Billing" sub="One invoice per payment. Campaign funds are held in escrow until you approve." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid to date" value={<Money minor={sum(['held', 'released'])} currency={cur} />} />
        <Stat label="In escrow" value={<Money minor={sum(['held'])} currency={cur} />} />
        <Stat label="Released to creators and fees" value={<Money minor={sum(['released'])} currency={cur} />} />
      </div>
      {CREDITS_ENABLED && active.length > 0 && (
        <Card className="mt-6">
          <div className="caption-label">Credits</div>
          <ul className="mt-4 space-y-2 text-small">{active.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2"><span><Money minor={Number(c.amount_minor) - Number(c.used_minor)} currency={cur} /> available</span><Badge tone={daysLeft(c.expires_at) <= 14 ? 'warning' : 'neutral'}>Expires {fmtDate(c.expires_at)}</Badge></li>
          ))}</ul>
        </Card>
      )}
      <h2 className="mb-4 mt-8 text-h3">Payments</h2>
      {list.length === 0 ? <EmptyState title="You have no payments yet. They appear here as soon as you fund a campaign." action={<LinkButton href="/brand/campaigns/new">New campaign</LinkButton>} /> : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-table">
            <thead><tr><th>Date</th><th>For</th><th>Status</th><th className="num">{isAgency ? 'Your cost' : 'Amount'}</th>{isAgency && <th className="num">Client invoice</th>}<th /></tr></thead>
            <tbody>
              {list.map((p) => {
                const line = agencyInvoiceLine(Number(p.gross_minor), markup);
                const type = (p.metadata as { type?: LicenseType } | null)?.type;
                return (
                  <tr key={p.id}>
                    <td className="tabular text-secondary">{fmtDate(p.created_at)}</td>
                    <td>{(p.campaigns as { title: string } | null)?.title ?? 'Campaign'}<div className="text-caption text-tertiary">{p.kind === 'license' ? (type ? LICENSE_LABELS[type] : 'Licence add-on') : 'Campaign escrow'}</div></td>
                    <td><StatusBadge kind="payment" status={p.status} /></td>
                    <td className="num font-medium"><Money minor={p.amount_minor} currency={p.currency} /></td>
                    {isAgency && <td className="num"><Money minor={line.clientTotalMinor} currency={p.currency} /><div className="text-caption text-tertiary">incl. {(markup / 100).toFixed(0)}% markup</div></td>}
                    <td className="text-right"><InvoiceLink paymentId={p.id} label={isAgency ? 'Client invoice PDF' : 'Invoice PDF'} /></td>
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
