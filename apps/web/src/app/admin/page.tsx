import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, Card, ICON, PageHeader, ProgressBar } from '@/components/ui';
import { Tooltip } from '@/components/ui/overlays';
import { money, pluralise } from '@/lib/utils';

interface Pair { now: number; prev: number }
interface Overview {
  approved_campaigns: Pair; gmv: Pair & { by_currency: Record<string, number> }; revenue: Pair & { licence_now: number }; renewals: Pair & { value_now: number };
  fill_rate: { filled: number; of: number }; hours_to_first_variant: number | null; approval_rate: { approved: number; of: number }; repeat_brands: { repeat: number; of: number };
}
/** "+18%" against last month; a plain note when last month had nothing to compare with. */
function Delta({ now, prev }: Pair) {
  if (!prev) return <Badge>{now ? 'New this month' : 'No change'}</Badge>;
  const pct = Math.round(((now - prev) / prev) * 100);
  return <Badge tone={pct > 0 ? 'success' : pct < 0 ? 'danger' : 'neutral'}>{pct > 0 ? '+' : ''}{pct}% on last month</Badge>;
}
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export default async function Overview() {
  const a = await requireAdmin();
  const sb = await supabaseServer();
  const { data } = await sb.rpc('admin_overview');
  const o = data as Overview;
  const c = a.counts;
  const usd = (n: number) => money(n, 'USD');
  const head: { label: string; value: string; pair: Pair; hint: React.ReactNode }[] = [
    { label: 'Approved paid campaigns', value: String(o.approved_campaigns.now), pair: o.approved_campaigns, hint: 'Funded, with at least one creator’s work approved' },
    { label: 'GMV', value: usd(o.gmv.now), pair: o.gmv, hint: <Tooltip label={Object.entries(o.gmv.by_currency).map(([cur, v]) => money(v, cur)).join(' · ') || 'No payments this month'}><span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">By currency</span></Tooltip> },
    { label: 'Platform revenue', value: usd(o.revenue.now), pair: o.revenue, hint: `25% of every payment · ${usd(o.revenue.licence_now)} from licences` },
    { label: 'Licence renewals', value: String(o.renewals.now), pair: o.renewals, hint: `${usd(o.renewals.value_now)} renewed this month` },
  ];
  const health = [
    { label: 'Fill rate', value: pct(o.fill_rate.filled, o.fill_rate.of), sub: `${o.fill_rate.filled} of ${pluralise(o.fill_rate.of, 'campaign')} filled within 72 hours`, bar: [o.fill_rate.filled, o.fill_rate.of] as const },
    { label: 'Time to first variant', value: o.hours_to_first_variant === null ? '—' : `${o.hours_to_first_variant}h`, sub: 'Median from product received to variants delivered' },
    { label: 'Brand approval rate', value: pct(o.approval_rate.approved, o.approval_rate.of), sub: `${o.approval_rate.approved} of ${pluralise(o.approval_rate.of, 'delivery', 'deliveries')} approved`, bar: [o.approval_rate.approved, o.approval_rate.of] as const },
    { label: 'Repeat brands', value: pct(o.repeat_brands.repeat, o.repeat_brands.of), sub: `${o.repeat_brands.repeat} of ${pluralise(o.repeat_brands.of, 'brand')} ran a second campaign within 60 days`, bar: [o.repeat_brands.repeat, o.repeat_brands.of] as const },
  ];
  const attention: { label: string; n: number | null; href: string; note?: string; show: boolean }[] = [
    { label: 'Submissions waiting for QA', n: c.qa, href: '/admin/qa', show: a.can('review') },
    { label: 'Verifications waiting', n: c.verification, href: '/admin/verification', show: a.can('review') },
    { label: 'Open disputes', n: c.disputes, href: '/admin/disputes', note: c.oldest_dispute_hours !== null ? `Oldest opened ${c.oldest_dispute_hours < 48 ? `${c.oldest_dispute_hours} hours` : `${Math.floor(c.oldest_dispute_hours / 24)} days`} ago` : undefined, show: true },
    { label: 'Payouts on hold', n: c.payouts_on_hold, href: '/admin/payouts?status=on_hold', show: a.can('money') },
    { label: 'Failed payouts', n: c.payouts_failed, href: '/admin/payouts?status=failed', show: a.can('money') },
    { label: 'Masking flags', n: c.masking, href: '/admin/masking', show: a.can('review') },
    { label: 'Campaigns past their deadline', n: c.past_deadline, href: '/admin/campaigns?late=1', show: true },
  ];
  const open = attention.filter((x) => x.show);
  return (
    <>
      <PageHeader title="Overview" sub="This month against last month, the health of the marketplace, and what needs someone today." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {head.map((h) => (
          <Card key={h.label}>
            <div className="caption-label">{h.label}</div>
            <div className="tabular mt-3 text-stat-sm">{h.value}</div>
            <div className="mt-3"><Delta {...h.pair} /></div>
            <div className="mt-3 text-small text-tertiary">{h.hint}</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-main-aside">
        <section aria-labelledby="health">
          <h2 id="health" className="caption-label">Marketplace health</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {health.map((h) => (
              <Card key={h.label}>
                <div className="text-small text-secondary">{h.label}</div>
                <div className="tabular mt-2 text-stat-sm">{h.value}</div>
                {h.bar && <div className="mt-4"><ProgressBar value={h.bar[0]} max={Math.max(1, h.bar[1])} /></div>}
                <p className="mt-3 text-small text-tertiary">{h.sub}</p>
              </Card>
            ))}
          </div>
        </section>
        <section aria-labelledby="attention">
          <h2 id="attention" className="caption-label">Needs attention</h2>
          <ul className="card mt-3 divide-y divide-border overflow-hidden">
            {open.map((x) => (
              <li key={x.label}>
                <Link href={x.href} className="flex min-h-row items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-3">
                  <span className={`tabular w-8 text-body font-semibold ${x.n ? 'text-primary' : 'text-tertiary'}`}>{x.n ?? 0}</span>
                  <span className="min-w-0 flex-1"><span className="block text-small">{x.label}</span>{x.note && !!x.n && <span className="block text-caption text-tertiary">{x.note}</span>}</span>
                  <ChevronRight size={16} {...ICON} className="text-tertiary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
