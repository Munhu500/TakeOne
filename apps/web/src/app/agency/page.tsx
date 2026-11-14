import { COUNTRIES } from '@takeone/shared';
import { requireRole } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Avatar, Badge, Card, Flag, Money, PageHeader } from '@/components/ui';
import { ClientForm, MarkupField, OpenWorkspace } from './client-form';

export default async function AgencyHome() {
  const s = await requireRole('agency_member');
  const agency = s.agency!;
  const sb = await supabaseServer();
  const ids = s.brands.map((b) => b.id);
  const [{ data: campaigns }, { data: payments }] = await Promise.all([
    ids.length ? sb.from('campaigns').select('brand_id, status').in('brand_id', ids) : Promise.resolve({ data: [] as { brand_id: string; status: string }[] }),
    ids.length ? sb.from('payments').select('brand_id, amount_minor, currency, status').in('brand_id', ids).in('status', ['held', 'released']) : Promise.resolve({ data: [] as { brand_id: string; amount_minor: number; currency: string; status: string }[] }),
  ]);
  return (
    <>
      <PageHeader title="Client workspaces" sub={`Each client sees ${agency.name} branding only. You are billed at standard prices and set your own markup per client.`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.brands.map((b) => {
          const cs = (campaigns ?? []).filter((c) => c.brand_id === b.id);
          const spend = (payments ?? []).filter((p) => p.brand_id === b.id).reduce((a, p) => a + Number(p.amount_minor), 0);
          return (
            <Card key={b.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-3"><Avatar name={b.name} src={b.logo} size="md" square /><div className="flex-1"><div className="font-medium">{b.name}</div><div className="flex items-center gap-2 text-caption text-secondary"><Flag code={b.country} />{COUNTRIES[b.country as keyof typeof COUNTRIES]?.name} · {b.currency}</div></div>{s.brand?.id === b.id && <Badge tone="outline">Active</Badge>}</div>
              <dl className="tabular grid grid-cols-3 gap-2 text-center text-caption">
                <div className="rounded-sm bg-surface-2 py-2"><dt className="text-tertiary">Campaigns</dt><dd className="text-small font-semibold">{cs.length}</dd></div>
                <div className="rounded-sm bg-surface-2 py-2"><dt className="text-tertiary">Active</dt><dd className="text-small font-semibold">{cs.filter((c) => ['live', 'in_progress'].includes(c.status)).length}</dd></div>
                <div className="rounded-sm bg-surface-2 py-2"><dt className="text-tertiary">Your cost</dt><dd className="text-small font-semibold"><Money minor={spend} currency={b.currency} /></dd></div>
              </dl>
              <MarkupField brandId={b.id} bps={b.markup_bps ?? agency.markup_default_bps} isDefault={b.markup_bps === null} />
              <OpenWorkspace brandId={b.id} />
            </Card>
          );
        })}
        <Card><div className="caption-label">Add a client</div><ClientForm agencyId={agency.id} defaultBps={agency.markup_default_bps} countries={Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name }))} /></Card>
      </div>
    </>
  );
}
