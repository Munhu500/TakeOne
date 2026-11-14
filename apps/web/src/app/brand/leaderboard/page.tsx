import Link from 'next/link';
import { Star } from 'lucide-react';
import { CATEGORIES, COUNTRIES, earningsBand, displayMoney, rankBrands, rankCreators } from '@takeone/shared';
import { getFx, requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { leaderboardRows, toStats } from '@/lib/queries';
import { Avatar, Badge, Empty, PageHeader, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';
import { InviteButton } from './invite';

type SP = { board?: string; period?: string; country?: string; category?: string };

export default async function Leaderboard({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const board = sp.board ?? 'creators';
  const period = sp.period === 'all' ? 'all' : 'month';
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [rows, fx, { data: campaigns }] = await Promise.all([
    leaderboardRows(), getFx(),
    sb.from('campaigns').select('id, title').eq('brand_id', s.brand.id).in('status', ['live', 'in_progress']).order('created_at', { ascending: false }),
  ]);
  const q = (patch: SP) => `/brand/leaderboard?${new URLSearchParams({ board, period, ...(sp.country ? { country: sp.country } : {}), ...(sp.category ? { category: sp.category } : {}), ...patch } as Record<string, string>)}`;
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-xs capitalize', on ? 'border-accent bg-accent/15 text-fg' : 'border-line bg-raised text-muted hover:text-fg');
  const byId = new Map(rows.map((r) => [r.creator_id, r]));
  const ranked = rankCreators(rows.map((r) => toStats(r, period)), { country: sp.country, category: sp.category, risingStars: board === 'rising' }).slice(0, 50);
  const viewer = s.brand.currency;

  return (
    <>
      <PageHeader title="Leaderboard" sub="Ranked by win rate, completed campaigns and brand rating. Never by follower count." />
      <Tabs active={`/brand/leaderboard?board=${board}`} tabs={[{ href: '/brand/leaderboard?board=creators', label: 'Creators' }, { href: '/brand/leaderboard?board=rising', label: 'Rising Stars' }, { href: '/brand/leaderboard?board=brands', label: 'Brands' }]} />
      {board === 'brands' ? (async () => {
        const { data } = await sb.from('leaderboard_brands').select('*');
        const names = new Map((data ?? []).map((b) => [b.brand_id as string, b]));
        const rb = rankBrands((data ?? []).map((b) => ({ brandId: b.brand_id, campaignsRun: b.campaigns_run, avgApprovalHours: b.avg_approval_hours === null ? null : Number(b.avg_approval_hours), avgPaymentHours: b.avg_payment_hours === null ? null : Number(b.avg_payment_hours) })));
        return (
          <div className="card divide-y divide-line">
            {rb.map((b) => (
              <div key={b.brandId} className="flex items-center gap-4 p-4">
                <span className="tabular w-8 font-display text-lg font-semibold text-muted">{b.rank}</span>
                <Avatar name={names.get(b.brandId)?.name ?? 'Brand'} src={names.get(b.brandId)?.logo} size={36} square />
                <div className="flex-1 font-medium">{names.get(b.brandId)?.name}{b.brandId === s.brand.id && <Badge tone="accent" className="ml-2">You</Badge>}</div>
                <dl className="tabular hidden gap-8 text-right text-xs sm:flex">
                  <div><dt className="text-faint">Campaigns run</dt><dd className="text-sm font-semibold">{b.campaignsRun}</dd></div>
                  <div><dt className="text-faint">Approval speed</dt><dd className="text-sm font-semibold">{b.avgApprovalHours === null ? '—' : `${Math.round(b.avgApprovalHours)}h`}</dd></div>
                  <div><dt className="text-faint">Payment speed</dt><dd className="text-sm font-semibold">{b.avgPaymentHours === null ? '—' : `${Math.round(b.avgPaymentHours)}h`}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        );
      })() : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Link className={chip(period === 'month')} href={q({ period: 'month' })}>This month</Link>
            <Link className={chip(period === 'all')} href={q({ period: 'all' })}>All-time</Link>
            <span className="mx-1 h-4 w-px bg-line" />
            <Link className={chip(!sp.country)} href={q({ country: '' })}>All countries</Link>
            {Object.entries(COUNTRIES).slice(0, 2).map(([code, c]) => <Link key={code} className={chip(sp.country === code)} href={q({ country: code })}>{c.flag} {c.name}</Link>)}
            <span className="mx-1 h-4 w-px bg-line" />
            <Link className={chip(!sp.category)} href={q({ category: '' })}>All categories</Link>
            {CATEGORIES.slice(0, 6).map((c) => <Link key={c} className={chip(sp.category === c)} href={q({ category: c })}>{c}</Link>)}
          </div>
          {ranked.length === 0 ? <Empty title="No creators match these filters" body={board === 'rising' ? 'Rising Stars joined in the last 90 days.' : undefined} /> : (
            <div className="card divide-y divide-line">
              {ranked.map((r) => {
                const row = byId.get(r.creatorId)!;
                const amount = period === 'month' ? row.month_earnings_usd_minor : row.total_earnings_usd_minor;
                return (
                  <div key={r.creatorId} className="flex flex-wrap items-center gap-4 p-4">
                    <span className={cn('tabular w-8 font-display text-lg font-semibold', r.rank <= 3 ? 'text-accent' : 'text-muted')}>{r.rank}</span>
                    <Avatar name={row.display_name} src={row.avatar} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-medium">{row.display_name}{row.is_pro && <Badge tone="accent">Pro</Badge>}{board === 'rising' && <Badge tone="ok">New</Badge>}</div>
                      <div className="text-xs capitalize text-muted">{COUNTRIES[row.country as keyof typeof COUNTRIES]?.flag} {row.categories.join(' · ')}</div>
                    </div>
                    <dl className="tabular hidden gap-7 text-right text-xs md:flex">
                      <div><dt className="text-faint">Win rate</dt><dd className="text-sm font-semibold">{Math.round(r.winRate * 100)}%</dd></div>
                      <div><dt className="text-faint">Completed</dt><dd className="text-sm font-semibold">{r.campaignsCompleted}</dd></div>
                      <div><dt className="text-faint">Rating</dt><dd className="flex items-center justify-end gap-1 text-sm font-semibold"><Star size={12} className="fill-warn text-warn" />{r.ratingAvg?.toFixed(1) ?? '—'}</dd></div>
                      <div className="w-36"><dt className="text-faint">Earnings</dt><dd className="text-sm font-semibold">{row.earnings_exact ? displayMoney(amount, 'USD', viewer, fx) : earningsBand(amount, 'USD', viewer, fx)}</dd></div>
                    </dl>
                    <InviteButton creatorId={r.creatorId} campaigns={(campaigns ?? []) as { id: string; title: string }[]} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
