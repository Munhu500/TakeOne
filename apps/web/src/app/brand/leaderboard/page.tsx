import { CATEGORIES, categoryLabel, COUNTRIES, countryName, earningsBand, exactEarnings, rankBrands, rankCreators, type RankedCreator } from '@takeone/shared';
import { getFx, requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { leaderboardRows, toStats, type BoardRow } from '@/lib/queries';
import { Avatar, Badge, EmptyState, Flag, LinkButton, PageHeader, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';
import { BoardFilters } from './filters';
import { InviteButton } from './invite';

type SP = { board?: string; period?: string; country?: string; category?: string };

export default async function Leaderboard({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const board = sp.board === 'rising' || sp.board === 'brands' ? sp.board : 'creators';
  const period = sp.period === 'all' ? 'all' : 'month';
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [rows, fx, { data: campaigns }] = await Promise.all([
    leaderboardRows(), getFx(),
    sb.from('campaigns').select('id, title').eq('brand_id', s.brand.id).in('status', ['live', 'in_progress']).order('created_at', { ascending: false }),
  ]);
  const byId = new Map(rows.map((r) => [r.creator_id, r]));
  const ranked = rankCreators(rows.map((r) => toStats(r, period)), { country: sp.country || undefined, category: sp.category || undefined, board: board === 'rising' ? 'rising' : 'main' }).slice(0, 50);
  const viewer = s.brand.currency;
  const invitable = (campaigns ?? []) as { id: string; title: string }[];
  const earnings = (row: BoardRow) => { const amount = period === 'month' ? row.month_earnings_usd_minor : row.total_earnings_usd_minor; return row.earnings_exact ? exactEarnings(amount, 'USD', viewer, fx) : earningsBand(amount, 'USD', viewer, fx); };
  const cols = (r: RankedCreator, row: BoardRow): [string, string][] => [['Win rate', `${Math.round(r.winRate * 100)}%`], ['Completed', String(r.campaignsCompleted)], ['Rating', r.ratingAvg?.toFixed(1) ?? '—'], ['Earnings', earnings(row)]];
  const tab = (b: string) => `/brand/leaderboard?board=${b}`;

  return (
    <>
      <PageHeader title="Leaderboard" sub="Ranked by results: win rate, completed campaigns and brand ratings. Never by follower count." />
      <Tabs active={tab(board)} tabs={[{ href: tab('creators'), label: 'Creators' }, { href: tab('rising'), label: 'Rising Stars' }, { href: tab('brands'), label: 'Brands' }]} />
      {board === 'brands' ? (async () => {
        const { data } = await sb.from('leaderboard_brands').select('*');
        const names = new Map((data ?? []).map((b) => [b.brand_id as string, b]));
        const rb = rankBrands((data ?? []).map((b) => ({ brandId: b.brand_id, campaignsRun: b.campaigns_run, avgApprovalHours: b.avg_approval_hours === null ? null : Number(b.avg_approval_hours), avgPaymentHours: b.avg_payment_hours === null ? null : Number(b.avg_payment_hours) })));
        if (rb.length === 0) return <EmptyState title="No brand has completed a campaign yet. Run one to appear here." action={<LinkButton href="/brand/campaigns/new">New campaign</LinkButton>} />;
        return (
          <ol className="card divide-y divide-border">
            {rb.map((b) => (
              <li key={b.brandId} className="flex min-h-row-media items-center gap-4 px-4 py-3">
                <span className="tabular w-8 text-body font-semibold text-tertiary">{b.rank}</span>
                <Avatar name={names.get(b.brandId)?.name ?? 'Brand'} src={names.get(b.brandId)?.logo} square />
                <div className="min-w-0 flex-1 truncate font-medium">{names.get(b.brandId)?.name}{b.brandId === s.brand.id && <Badge tone="outline" className="ml-2">You</Badge>}</div>
                <dl className="tabular hidden gap-8 text-right sm:flex">
                  {([['Campaigns', String(b.campaignsRun)], ['Approves in', b.avgApprovalHours === null ? '—' : `${Math.round(b.avgApprovalHours)}h`], ['Pays in', b.avgPaymentHours === null ? '—' : `${Math.round(b.avgPaymentHours)}h`]] as const).map(([k, v]) => <div key={k} className="w-24"><dt className="text-caption text-tertiary">{k}</dt><dd className="text-small font-semibold">{v}</dd></div>)}
                </dl>
              </li>
            ))}
          </ol>
        );
      })() : (
        <>
          <BoardFilters board={board} period={period} country={sp.country ?? ''} category={sp.category ?? ''}
            countries={Object.keys(COUNTRIES).slice(0, 2).map((code) => ({ value: code, label: countryName(code) }))} categories={CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))} />
          {ranked.length === 0 ? <EmptyState title={board === 'rising' ? 'No Rising Stars match these filters. Try another country or category.' : 'No creators match these filters. Try another country or category.'} action={<LinkButton href={tab(board)} variant="secondary">Clear filters</LinkButton>} /> : (
            <>
              {/* podium */}
              <ol className="grid gap-4 md:grid-cols-3">
                {ranked.slice(0, 3).map((r) => {
                  const row = byId.get(r.creatorId)!;
                  return (
                    <li key={r.creatorId} className={cn('card flex flex-col gap-4 p-5', r.rank === 1 && 'border-t-2 border-t-accent-brand')}>
                      <div className="flex items-center gap-3">
                        <span className="tabular text-stat-sm text-primary">{r.rank}</span>
                        <Avatar name={row.display_name} src={row.avatar} size="lg" />
                        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-body font-medium">{row.display_name}</span>{row.is_pro && <Badge tone="outline">Pro</Badge>}</div><div className="flex items-center gap-2 truncate text-caption text-secondary"><Flag code={row.country} />{row.categories.map(categoryLabel).join(' · ')}</div></div>
                      </div>
                      <dl className="tabular grid grid-cols-4 gap-2 text-center">{cols(r, row).map(([k, v]) => <div key={k}><dt className="text-caption text-tertiary">{k}</dt><dd className="truncate text-small font-semibold">{v}</dd></div>)}</dl>
                      <div className="flex justify-end border-t border-border pt-4"><InviteButton creatorId={r.creatorId} name={row.display_name} campaigns={invitable} /></div>
                    </li>
                  );
                })}
              </ol>
              {ranked.length > 3 && (
                <ol start={4} className="card mt-4 divide-y divide-border">
                  {ranked.slice(3).map((r) => {
                    const row = byId.get(r.creatorId)!;
                    return (
                      <li key={r.creatorId} className="flex min-h-row-media items-center gap-4 px-4 py-3">
                        <span className="tabular w-8 text-body font-semibold text-tertiary">{r.rank}</span>
                        <Avatar name={row.display_name} src={row.avatar} />
                        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-medium">{row.display_name}</span>{row.is_pro && <Badge tone="outline">Pro</Badge>}</div><div className="flex items-center gap-2 truncate text-caption text-secondary"><Flag code={row.country} />{row.categories.map(categoryLabel).join(' · ')}</div></div>
                        <dl className="tabular hidden gap-6 text-right lg:flex">{cols(r, row).map(([k, v], i) => <div key={k} className={i === 3 ? 'w-28' : 'w-20'}><dt className="text-caption text-tertiary">{k}</dt><dd className="truncate text-small font-semibold">{v}</dd></div>)}</dl>
                        <InviteButton creatorId={r.creatorId} name={row.display_name} campaigns={invitable} />
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
