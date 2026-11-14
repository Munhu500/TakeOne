import Link from 'next/link';
import { Plus } from 'lucide-react';
import { CREDITS_ENABLED } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, Card, EmptyState, ICON, LinkButton, Money, PageHeader, ProductImage, RowChevron, Stat, StatusBadge } from '@/components/ui';
import { daysLeftLabel, fmtDate, pluralise, timeAgo } from '@/lib/utils';

export default async function BrandHome() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data: campaigns }, { data: notes }, { data: credits }, { data: expiring }, { data: held }] = await Promise.all([
    sb.from('campaigns').select('id, title, product_name, product_images, status, creators_needed, fee_per_creator_minor, currency, deadline, created_at, applications(count), assignments(id, status)').eq('brand_id', s.brand.id).order('created_at', { ascending: false }),
    sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(6),
    CREDITS_ENABLED ? sb.from('credits').select('amount_minor, used_minor, expires_at, currency').eq('brand_id', s.brand.id).gt('expires_at', new Date().toISOString()) : Promise.resolve({ data: [] as { amount_minor: number; used_minor: number; expires_at: string }[] }),
    sb.from('licenses').select('id').eq('brand_id', s.brand.id).gt('ends_at', new Date().toISOString()).lt('ends_at', new Date(Date.now() + 7 * 86_400_000).toISOString()),
    sb.from('payments').select('amount_minor').eq('brand_id', s.brand.id).eq('status', 'held'),
  ]);
  const list = campaigns ?? [];
  type A = { id: string; status: string };
  const toReview = list.reduce((n, c) => n + (c.assignments as A[]).filter((a) => a.status === 'delivered').length, 0);
  const credit = (credits ?? []).reduce((a, c) => a + Number(c.amount_minor) - Number(c.used_minor), 0);
  const soonest = (credits ?? []).map((c) => c.expires_at).sort()[0];
  const escrow = (held ?? []).reduce((a, p) => a + Number(p.amount_minor), 0);
  return (
    <>
      <PageHeader title={s.brand.name} sub="Campaigns, deliveries and licences in one place." action={<LinkButton href="/brand/campaigns/new"><Plus size={16} {...ICON} />New campaign</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active campaigns" value={list.filter((c) => ['live', 'in_progress'].includes(c.status)).length} />
        <Stat label="Deliveries to review" value={toReview} hint={toReview ? 'Approved automatically 5 days after delivery' : 'You are up to date'} />
        {CREDITS_ENABLED
          ? <Stat label="Campaign credit" value={<Money minor={credit} currency={s.brand.currency} />} hint={credit && soonest ? `Applies to the platform fee · ${daysLeftLabel(soonest)}` : 'Earned when your first campaign completes'} />
          : <Stat label="In escrow" value={<Money minor={escrow} currency={s.brand.currency} />} hint="Released as you approve each submission" />}
        <Stat label="Licences ending in 7 days" value={expiring?.length ?? 0} hint={<Link className="text-accent-text underline-offset-4 hover:underline" href="/brand/licenses">Open usage tracker</Link>} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-main-narrow">
        <section aria-label="Campaigns">
          {list.length === 0 ? (
            <EmptyState title="You have no campaigns yet. Paste a product link and your brief is drafted for you." action={<LinkButton href="/brand/campaigns/new">Create your first campaign</LinkButton>} />
          ) : (
            <div className="card divide-y divide-border overflow-hidden">
              {list.map((c) => {
                const as = c.assignments as A[];
                const delivered = as.filter((a) => a.status === 'delivered').length;
                return (
                  <Link key={c.id} href={`/brand/campaigns/${c.id}`} className="flex min-h-row-media items-center gap-4 px-4 py-3 transition-colors duration-fast hover:bg-surface-3">
                    <ProductImage name={c.product_name} src={c.product_images?.[0]} radius="sm" className="w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body font-medium">{c.title}</div>
                      <div className="tabular mt-1 truncate text-caption text-secondary"><Money minor={c.fee_per_creator_minor} currency={c.currency} /> per creator · {as.length} of {pluralise(c.creators_needed, 'creator')} · due {fmtDate(c.deadline)}</div>
                    </div>
                    {delivered > 0 && <Badge tone="accent">{delivered} to review</Badge>}
                    {c.status === 'live' && <span className="tabular hidden text-caption text-secondary sm:block">{pluralise((c.applications as { count: number }[])[0]?.count ?? 0, 'applicant')}</span>}
                    <StatusBadge kind="campaign" status={c.status} />
                    <RowChevron />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <aside aria-label="Activity">
          <Card>
            <div className="caption-label">Activity</div>
            {(notes ?? []).length === 0 ? (
              <p className="mt-4 text-small text-secondary">Updates on applications, deliveries and licences appear here. <Link className="text-accent-text underline-offset-4 hover:underline" href="/brand/campaigns/new">Start a campaign</Link></p>
            ) : (
              <ul className="mt-4 space-y-4">
                {(notes ?? []).map((n) => (
                  <li key={n.id} className="text-small"><div>{n.title}</div><div className="mt-1 text-caption text-tertiary">{n.body ? `${n.body} · ` : ''}{timeAgo(n.created_at)}</div></li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
