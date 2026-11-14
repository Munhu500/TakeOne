import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatMoney } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, Card, Empty, LinkButton, PageHeader, Stat, STATUS_TONE } from '@/components/ui';
import { assetUrl, daysLeft, fmtDate, timeAgo, titleCase } from '@/lib/utils';

export default async function BrandHome() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data: campaigns }, { data: notes }, { data: credits }, { data: expiring }] = await Promise.all([
    sb.from('campaigns').select('id, title, product_name, product_images, status, creators_needed, fee_per_creator_minor, currency, deadline, created_at, applications(count), assignments(id, status)').eq('brand_id', s.brand.id).order('created_at', { ascending: false }),
    sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(6),
    sb.from('credits').select('amount_minor, used_minor, expires_at, currency').eq('brand_id', s.brand.id).gt('expires_at', new Date().toISOString()),
    sb.from('licenses').select('id').eq('brand_id', s.brand.id).gt('ends_at', new Date().toISOString()).lt('ends_at', new Date(Date.now() + 7 * 86_400_000).toISOString()),
  ]);
  const list = campaigns ?? [];
  type A = { id: string; status: string };
  const toReview = list.reduce((n, c) => n + (c.assignments as A[]).filter((a) => a.status === 'delivered').length, 0);
  const credit = (credits ?? []).reduce((a, c) => a + Number(c.amount_minor) - Number(c.used_minor), 0);
  const soonest = (credits ?? []).map((c) => c.expires_at).sort()[0];
  return (
    <>
      <PageHeader title={s.brand.name} sub="Campaigns, deliveries and licenses in one place." action={<LinkButton href="/brand/campaigns/new"><Plus size={16} />New campaign</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active campaigns" value={list.filter((c) => ['live', 'in_progress'].includes(c.status)).length} />
        <Stat label="Deliveries to review" value={toReview} hint={toReview ? 'Auto-approved 5 days after delivery' : undefined} />
        <Stat label="Campaign credit" value={formatMoney(credit, s.brand.currency)} hint={credit && soonest ? `Applies to the platform fee · expires in ${daysLeft(soonest)} days` : 'Earned when your first campaign completes'} />
        <Stat label="Licenses expiring in 7 days" value={expiring?.length ?? 0} hint={<Link className="text-accent hover:underline" href="/brand/licenses">Open usage tracker</Link>} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-label="Campaigns">
          {list.length === 0 ? (
            <Empty title="No campaigns yet" body="Paste a product link and your brief is drafted for you." action={<LinkButton href="/brand/campaigns/new">Create your first campaign</LinkButton>} />
          ) : (
            <div className="card divide-y divide-line">
              {list.map((c) => {
                const as = c.assignments as A[];
                const delivered = as.filter((a) => a.status === 'delivered').length;
                const img = assetUrl(c.product_images?.[0]);
                return (
                  <Link key={c.id} href={`/brand/campaigns/${c.id}`} className="flex items-center gap-4 p-4 transition hover:bg-raised/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img ? <img src={img} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" /> : <div className="h-14 w-12 shrink-0 rounded-lg bg-raised" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="mt-0.5 text-xs text-muted">{formatMoney(Number(c.fee_per_creator_minor), c.currency)} per creator · {as.length}/{c.creators_needed} creators · due {fmtDate(c.deadline)}</div>
                    </div>
                    {delivered > 0 && <Badge tone="accent">{delivered} to review</Badge>}
                    {c.status === 'live' && <span className="hidden text-xs text-muted sm:block">{(c.applications as { count: number }[])[0]?.count ?? 0} applicants</span>}
                    <Badge tone={STATUS_TONE[c.status]}>{c.status === 'draft' ? 'Draft · unpaid' : titleCase(c.status)}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <aside aria-label="Activity">
          <Card>
            <div className="text-sm font-medium">Activity</div>
            <ul className="mt-3 space-y-3">
              {(notes ?? []).length === 0 && <li className="text-sm text-muted">Nothing yet.</li>}
              {(notes ?? []).map((n) => (
                <li key={n.id} className="text-sm"><div>{n.title}</div><div className="text-xs text-faint">{n.body ? `${n.body} · ` : ''}{timeAgo(n.created_at)}</div></li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
