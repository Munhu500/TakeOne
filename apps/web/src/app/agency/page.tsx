import { agencyInvoiceLine, COUNTRIES, countryName } from '@takeone/shared';
import { getFx, requireRole } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Avatar, Card, EmptyState, Flag, Money, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { convertMinor, type CurrencyCode } from '@takeone/shared';
import { AddClient, MarkupEdit, OpenWorkspace } from './client-form';

export default async function AgencyHome({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const s = await requireRole('agency_member');
  const agency = s.agency!;
  const sb = await supabaseServer();
  const ids = s.brands.map((b) => b.id);
  const [{ data: campaigns }, { data: payments }, fx] = await Promise.all([
    ids.length ? sb.from('campaigns').select('brand_id, status').in('brand_id', ids) : Promise.resolve({ data: [] as { brand_id: string; status: string }[] }),
    ids.length ? sb.from('payments').select('brand_id, gross_minor, currency, status, created_at').in('brand_id', ids).in('status', ['held', 'released']) : Promise.resolve({ data: [] as { brand_id: string; gross_minor: number; currency: string; status: string; created_at: string }[] }),
    getFx(),
  ]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const cur = s.profile.currency as CurrencyCode; // the agency's own reporting currency
  const bps = (brandId: string) => s.brands.find((b) => b.id === brandId)?.markup_bps ?? agency.markup_default_bps;
  const month = (payments ?? []).filter((p) => new Date(p.created_at).getTime() >= monthStart);
  const billedOf = (rows: typeof month) => rows.reduce((a, p) => a + convertMinor(agencyInvoiceLine(Number(p.gross_minor), bps(p.brand_id)).clientTotalMinor, p.currency as CurrencyCode, cur, fx), 0);
  const markupOf = (rows: typeof month) => rows.reduce((a, p) => a + convertMinor(agencyInvoiceLine(Number(p.gross_minor), bps(p.brand_id)).markupMinor, p.currency as CurrencyCode, cur, fx), 0);
  const active = (campaigns ?? []).filter((c) => ['live', 'in_progress'].includes(c.status));
  const countries = Object.keys(COUNTRIES).map((code) => ({ code, name: countryName(code) }));
  return (
    <>
      <PageHeader title="Clients" sub={`Each client sees ${agency.name} only. You are billed at standard prices and set your own markup per client.`} action={<AddClient agencyId={agency.id} defaultBps={agency.markup_default_bps} countries={countries} openInitially={add === '1'} />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Billed to clients" value={<Money minor={billedOf(month)} currency={cur} />} hint="This month" />
        <Stat label="Your markup earned" value={<Money minor={markupOf(month)} currency={cur} />} hint="This month" />
        <Stat label="Active campaigns" value={active.length} />
        <Stat label="Clients" value={s.brands.length} />
      </div>
      <div className="mt-8">
        {s.brands.length === 0 ? <EmptyState title="You have no clients yet. Add one to open their workspace under your brand." action={<AddClient agencyId={agency.id} defaultBps={agency.markup_default_bps} countries={countries} label="Add your first client" />} /> : (
          <div className="grid grid-cols-cards gap-4">
            {s.brands.map((b) => {
              const cs = (campaigns ?? []).filter((c) => c.brand_id === b.id);
              const act = cs.filter((c) => ['live', 'in_progress'].includes(c.status)).length;
              const billed = month.filter((p) => p.brand_id === b.id).reduce((a, p) => a + agencyInvoiceLine(Number(p.gross_minor), bps(b.id)).clientTotalMinor, 0);
              return (
                <Card key={b.id} className="flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={b.name} src={b.logo} size="lg" square />
                    <div className="min-w-0 flex-1"><div className="truncate text-body font-medium">{b.name}</div><div className="flex items-center gap-2 text-caption text-secondary"><Flag code={b.country} />{countryName(b.country)} · {b.currency}</div></div>
                    <StatusBadge kind="client" status={act > 0 ? 'active' : cs.length ? 'idle' : 'new'} />
                  </div>
                  <dl className="tabular grid grid-cols-3 gap-2 text-center">
                    {([['Campaigns', cs.length], ['Active', act], ['This month', <Money key="m" minor={billed} currency={b.currency} />]] as const).map(([k, v]) => <div key={k} className="rounded-sm bg-surface-2 px-2 py-3"><dd className="text-body font-semibold">{v}</dd><dt className="mt-1 text-caption text-tertiary">{k}</dt></div>)}
                  </dl>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                    <MarkupEdit brandId={b.id} name={b.name} bps={b.markup_bps ?? agency.markup_default_bps} isDefault={b.markup_bps === null} />
                    <OpenWorkspace brandId={b.id} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
