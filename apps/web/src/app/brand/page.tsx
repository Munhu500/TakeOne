import Link from 'next/link';
import { Check, FileClock, Plus, Receipt, Video } from 'lucide-react';
import { FORMATS, type FormatId } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { creatorsByIds } from '@/lib/queries';
import { loadNotes } from '@/components/shell';
import { Avatar, Card, ICON, LinkButton, Money, PageHeader, ProductImage, ProgressBar, RowChevron, Stat, StatusBadge, VideoFrame } from '@/components/ui';
import { fmtDate } from '@/lib/utils';

const DAY = 86_400_000;
const dayLabel = (d: string) => { const n = Math.floor((Date.now() - new Date(d).getTime()) / DAY); return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : fmtDate(d); };
const NOTE_ICON: Record<string, typeof Video> = { delivered: Video, renewal: FileClock, license: Receipt, payment: Receipt };

export default async function BrandHome() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const now = new Date();
  const [{ data: campaigns }, { data: licences }, notes] = await Promise.all([
    sb.from('campaigns').select('id, title, product_name, product_images, status, creators_needed, fee_per_creator_minor, currency, deadline, created_at, assignments(id, status, creator_id, delivered_at)').eq('brand_id', s.brand.id).order('created_at', { ascending: false }),
    sb.from('licenses').select('variant_id, type, ends_at').eq('brand_id', s.brand.id),
    loadNotes(12),
  ]);
  type A = { id: string; status: string; creator_id: string; delivered_at: string | null };
  const list = (campaigns ?? []).map((c) => ({ ...c, assignments: (c.assignments ?? []) as A[] }));
  const assignments = list.flatMap((c) => c.assignments.map((a) => ({ ...a, campaignId: c.id })));
  // RLS: only variants that were delivered to this brand come back
  const { data: vs } = assignments.length ? await sb.from('variants').select('id, format, score, status, assignment_id, thumbnail').in('assignment_id', assignments.map((a) => a.id)).order('score', { ascending: false }) : { data: [] };
  const variants = (vs ?? []) as { id: string; format: FormatId; score: number | null; status: string; assignment_id: string; thumbnail: string | null }[];
  const byAssignment = new Map(assignments.map((a) => [a.id, a]));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const deliveredThisMonth = variants.filter((v) => { const d = byAssignment.get(v.assignment_id)?.delivered_at; return d && new Date(d).getTime() >= monthStart; }).length;
  const awaiting = assignments.filter((a) => a.status === 'delivered');
  const running = new Set((licences ?? []).filter((l) => l.type !== 'whitelist' && (l.ends_at === null || new Date(l.ends_at) > now)).map((l) => l.variant_id));
  const endsByVariant = new Map<string, number>();
  for (const l of licences ?? []) if (l.type !== 'whitelist') endsByVariant.set(l.variant_id, l.ends_at === null ? Infinity : Math.max(endsByVariant.get(l.variant_id) ?? 0, new Date(l.ends_at).getTime()));
  const endingSoon = [...endsByVariant.values()].filter((t) => t > now.getTime() && t <= now.getTime() + 7 * DAY).length;
  const toReview = variants.filter((v) => byAssignment.get(v.assignment_id)?.status === 'delivered' && v.status === 'delivered').slice(0, 10);
  const { creators } = await creatorsByIds([...new Set(toReview.map((v) => byAssignment.get(v.assignment_id)!.creator_id))]);
  const groups = new Map<string, typeof notes>();
  for (const n of notes) groups.set(dayLabel(n.created_at), [...(groups.get(dayLabel(n.created_at)) ?? []), n]);

  if (list.length === 0) {
    return (
      <>
        <PageHeader title={s.brand.name} sub="Three steps to your first creator ads." />
        <Card className="max-w-2xl p-8">
          <ol className="space-y-6">
            {[['Add a product link', 'Paste the product page and the brief and shot list are drafted for you.'], ['Choose creators', 'Set how many creators you want and what each is paid. Review applicants or invite from the leaderboard.'], ['Fund escrow', 'Your budget is held until you approve each creator’s work.']].map(([t, d], i) => (
              <li key={t} className="flex gap-4"><span className="tabular grid size-8 shrink-0 place-items-center rounded-full border border-border-strong text-small font-medium">{i + 1}</span><div><div className="text-body font-medium">{t}</div><p className="mt-1 text-small text-secondary">{d}</p></div></li>
            ))}
          </ol>
          <div className="mt-8"><LinkButton href="/brand/campaigns/new"><Plus size={16} {...ICON} />Start a campaign</LinkButton></div>
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title={s.brand.name} sub="Your ads, what is running, and what needs you today." action={<LinkButton href="/brand/campaigns/new"><Plus size={16} {...ICON} />New campaign</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ads delivered" value={variants.length} hint={`+${deliveredThisMonth} this month`} />
        <Stat label="Winners licensed" value={running.size} hint="Licensed and running now" />
        <Stat label="Awaiting your review" value={awaiting.length} hint="Auto-approved 5 days after delivery" />
        <Stat label="Licences ending soon" value={endingSoon} hint={<Link className="text-accent-text underline-offset-4 hover:underline" href="/brand/licenses">Review renewals</Link>} />
      </div>

      {toReview.length > 0 && (
        <section aria-labelledby="new-ads" className="mt-8">
          <h2 id="new-ads" className="text-h3">Review your new ads</h2>
          <ul className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {toReview.map((v) => {
              const a = byAssignment.get(v.assignment_id)!;
              const who = creators.get(a.creator_id)?.display_name ?? 'Creator';
              return (
                <li key={v.id} className="w-36 shrink-0">
                  <Link href={`/brand/campaigns/${a.campaignId}/review/${a.id}?v=${v.id}`} className="group block rounded-md" aria-label={`Review ${FORMATS[v.format]?.name ?? v.format} from ${who}, score ${v.score ?? 'not scored'}`}>
                    <span className="relative block">
                      <VideoFrame media={`variants/${v.format}`} label={FORMATS[v.format]?.name ?? v.format} controls={false} className="transition-colors duration-fast group-hover:border-border-strong" />
                      <span className="tabular absolute left-2 top-2 rounded-full bg-scrim px-2 text-caption text-on-media">{v.score ?? '—'}</span>
                      <span className="absolute bottom-2 left-2"><Avatar name={who} src={creators.get(a.creator_id)?.avatar} size="sm" /></span>
                    </span>
                    <span className="mt-2 block truncate text-small font-medium">{FORMATS[v.format]?.name ?? v.format}</span>
                    <span className="block truncate text-caption text-secondary">{who}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-main-narrow">
        <section aria-label="Campaigns" className="min-w-0">
          <div className="card divide-y divide-border overflow-hidden">
            {list.map((c) => {
              const delivered = c.assignments.filter((a) => a.status === 'delivered').length;
              return (
                <Link key={c.id} href={`/brand/campaigns/${c.id}`} className="flex min-h-row-media items-center gap-4 px-4 py-3 transition-colors duration-fast hover:bg-surface-3">
                  <ProductImage name={c.product_name} src={c.product_images?.[0]} ratio="square" radius="sm" className="w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium">{c.title}</div>
                    <div className="tabular mt-1 truncate text-caption text-secondary"><Money minor={c.fee_per_creator_minor} currency={c.currency} /> per creator · due {fmtDate(c.deadline)}{delivered > 0 ? ` · ${delivered} to review` : ''}</div>
                  </div>
                  <div className="hidden w-36 sm:block"><ProgressBar value={c.assignments.length} max={c.creators_needed} label="Creators" /></div>
                  <StatusBadge kind="campaign" status={c.status} />
                  <RowChevron />
                </Link>
              );
            })}
          </div>
        </section>
        <aside aria-label="Activity" className="min-w-0">
          <Card>
            <div className="caption-label">Activity</div>
            {notes.length === 0 ? (
              <div className="mt-4"><p className="text-small text-secondary">Your first ads will appear here within 7 days of a creator receiving your product.</p><div className="mt-4"><LinkButton href="/brand/campaigns/new" variant="secondary" size="sm">Start a campaign</LinkButton></div></div>
            ) : [...groups.entries()].map(([day, items]) => (
              <div key={day} className="mt-5 first:mt-4">
                <div className="text-caption text-tertiary">{day}</div>
                <ul className="mt-2 space-y-3">
                  {items.map((n) => { const Icon = NOTE_ICON[n.type] ?? Check; return (
                    <li key={n.id} className="flex gap-3 text-small">
                      <Icon size={16} {...ICON} className="mt-1 shrink-0 text-tertiary" aria-hidden />
                      <div className="min-w-0 flex-1"><div>{n.title}</div>{n.body && <div className="truncate text-caption text-tertiary">{n.body}</div>}</div>
                      {n.href && n.action && <Link href={n.href} className="shrink-0 text-caption text-accent-text underline-offset-4 hover:underline">{n.action}</Link>}
                    </li>
                  ); })}
                </ul>
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </>
  );
}
