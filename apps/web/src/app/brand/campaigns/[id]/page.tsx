import Link from 'next/link';
import { notFound } from 'next/navigation';
import { campaignCharge, categoryLabel, countryName, earningsBand, exactEarnings, FORMATS, LICENSE_DEFAULTS, LICENSE_LABELS, type Brief, type FormatId, type LicenseType, type ShotList } from '@takeone/shared';
import { getFx, requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { creatorsByIds, leaderboardRows, rankMap } from '@/lib/queries';
import { Avatar, Badge, Card, EmptyState, Flag, LinkButton, Money, ProductImage, StatusBadge, statusLabel, Tabs, VideoFrame } from '@/components/ui';
import { RpcButton } from '@/components/client';
import { Chat } from '@/components/chat';
import { CreatorCard } from '@/components/creator-card';
import { InvoiceLink } from '@/components/invoice-link';
import { cn, daysLeftLabel, fmtDate, money as fmtMoney, pluralise, timeAgo } from '@/lib/utils';
import { PayButton } from './pay';

const REVIEWABLE = ['delivered', 'approved', 'completed', 'disputed'];

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; with?: string; paid?: string }> }) {
  const { id } = await params;
  const { tab = 'overview', with: withCreator, paid } = await searchParams;
  const s = await requireBrand();
  const sb = await supabaseServer();
  const { data: c } = await sb.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const [{ data: apps }, { data: assignments }, { data: payments }, { data: licences }] = await Promise.all([
    sb.from('applications').select('*').eq('campaign_id', id).order('created_at'),
    sb.from('assignments').select('*').eq('campaign_id', id).order('created_at'),
    sb.from('payments').select('*').eq('campaign_id', id).order('created_at', { ascending: false }),
    sb.from('licenses').select('id, variant_id, type, ends_at, variants(format, assignment_id)').eq('campaign_id', id).order('ends_at', { ascending: true, nullsFirst: false }),
  ]);
  const as = assignments ?? [];
  const ids = [...new Set([...(apps ?? []).map((a) => a.creator_id), ...as.map((a) => a.creator_id)])] as string[];
  const [{ creators, socials }, ranks, board, fx] = await Promise.all([creatorsByIds(ids), rankMap(), leaderboardRows(), getFx()]);
  const boardById = new Map(board.map((r) => [r.creator_id, r]));
  const earnings = (cid: string) => { const r = boardById.get(cid); return r ? (r.earnings_exact ? exactEarnings(r.month_earnings_usd_minor, 'USD', c.currency, fx) : earningsBand(r.month_earnings_usd_minor, 'USD', c.currency, fx)) : undefined; };
  const brief = c.brief as Brief;
  const shots = c.shot_list as ShotList;
  const base = `/brand/campaigns/${id}`;
  const money = (m: number) => fmtMoney(m, c.currency);
  const payment = (payments ?? []).find((p) => p.kind === 'campaign');
  const charge = campaignCharge(Number(c.fee_per_creator_minor), c.creators_needed, 0);
  const open = (apps ?? []).filter((a) => !['accepted', 'declined', 'withdrawn', 'rejected'].includes(a.status));
  const slotsLeft = c.creators_needed - as.length;
  const deliveries = as.filter((a) => REVIEWABLE.includes(a.status));
  const term = c.license_term_days ?? LICENSE_DEFAULTS.termDays;
  const shownTab = tab === 'messages' ? 'creators' : tab;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <ProductImage name={c.product_name} shortName={c.product_short_name} src={c.product_images?.[0]} ratio="square" radius="md" className="w-20" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-h2">{c.title}</h1><StatusBadge kind="campaign" status={c.status} /></div>
          <p className="tabular mt-2 text-small text-secondary">Due {fmtDate(c.deadline)} · {money(charge.grossMinor)} budget · {money(Number(c.fee_per_creator_minor))} per creator · {pluralise(c.creators_needed, 'creator')}</p>
        </div>
        {c.status === 'draft' ? <PayButton campaignId={c.id} label={`Fund escrow · ${money(charge.payableMinor)}`} /> : deliveries.some((a) => a.status === 'delivered') ? <LinkButton href={`${base}/review/${deliveries.find((a) => a.status === 'delivered')!.id}`}>Review new ads</LinkButton> : null}
      </div>
      {paid && c.status !== 'draft' && <div role="status" className="mb-6 rounded-md bg-success-soft px-4 py-3 text-small text-success-text">Payment received and held in escrow. Your campaign is live. Pro creators see it first for 48 hours.</div>}
      <Tabs active={`${base}?tab=${shownTab}`} tabs={[
        { href: `${base}?tab=overview`, label: 'Overview' },
        { href: `${base}?tab=creators`, label: 'Creators', count: open.length + as.length },
        { href: `${base}?tab=deliveries`, label: 'Deliveries', count: deliveries.length },
        { href: `${base}?tab=licences`, label: 'Licences', count: new Set((licences ?? []).map((l) => l.variant_id)).size },
        { href: `${base}?tab=payments`, label: 'Payments', count: (payments ?? []).length },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-main-aside">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="caption-label">Product</div>
              <h2 className="mt-3 text-h3">{c.product_name}</h2>
              <p className="mt-2 max-w-prose text-small text-secondary">{brief.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">{(c.categories as string[]).map((x) => <Badge key={x}>{categoryLabel(x)}</Badge>)}{(c.countries as string[]).map((x) => <Badge key={x} tone="outline"><Flag code={x} />{countryName(x)}</Badge>)}</div>
            </Card>
            <Card>
              <div className="caption-label">Brief</div>
              <dl className="mt-4 grid gap-6 text-small sm:grid-cols-2">
                {([['Goals', [brief.goals]], ['Target audience', [brief.target_audience]], ['Key benefits', brief.key_benefits], ['Key messages', brief.key_messages], ['Must say', brief.must_say], ['Must not say', brief.must_not_say]] as [string, string[]][]).map(([k, v]) => (
                  <div key={k}><dt className="text-caption text-tertiary">{k}</dt><dd className="mt-1 text-secondary">{(v ?? []).filter(Boolean).length > 1 ? <ul className="list-disc space-y-1 pl-4">{v.map((x) => <li key={x}>{x}</li>)}</ul> : (v?.[0] || '—')}</dd></div>
                ))}
              </dl>
            </Card>
            <Card>
              <div className="caption-label">Creator shot list</div>
              <ol className="mt-4 space-y-4">{(shots.shots ?? []).map((sh, i) => (
                <li key={i} className="flex gap-3 text-small"><span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-caption text-secondary">{i + 1}</span><div><span className="font-medium">{sh.title}</span> <span className="tabular text-caption text-tertiary">{sh.seconds}s</span><div className="text-secondary">{sh.direction}</div></div></li>
              ))}</ol>
              {shots.talking_points?.length > 0 && <div className="mt-6 text-small"><div className="text-caption text-tertiary">Talking points</div><ul className="mt-1 list-disc space-y-1 pl-4 text-secondary">{shots.talking_points.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            </Card>
          </div>
          <aside className="min-w-0">
            <Card>
              <div className="caption-label">{c.status === 'draft' ? 'Fund escrow' : 'Escrow'}</div>
              <dl className="tabular mt-4 space-y-2 text-small">
                <div className="flex justify-between"><dt className="text-secondary">{c.creators_needed} × {money(Number(c.fee_per_creator_minor))}</dt><dd>{money(charge.grossMinor)}</dd></div>
                <div className="flex justify-between text-caption text-tertiary"><dt>Creators receive (75%)</dt><dd>{money(charge.creatorPoolMinor)}</dd></div>
                <div className="flex justify-between text-caption text-tertiary"><dt>TakeOne fee (25%)</dt><dd>{money(charge.platformFeeMinor)}</dd></div>
                <div className="flex justify-between border-t border-border pt-3 font-semibold"><dt>{c.status === 'draft' ? 'Due now' : 'Paid'}</dt><dd>{money(charge.payableMinor)}</dd></div>
              </dl>
              {payment && <div className="mt-4 flex items-center justify-between text-caption text-secondary"><span>Paid {fmtDate(payment.created_at)}</span><StatusBadge kind="payment" status={payment.status} /></div>}
              <ul className="mt-4 space-y-2 text-caption text-secondary">
                <li>Up to {LICENSE_DEFAULTS.baseIncludedVariants} selected variants per creator included</li><li>{pluralise(term, 'day')} of paid-ad usage, renewable · organic use on your channels never ends</li><li>Released on approval, or automatically 5 days after delivery</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'creators' && (
        <div className="space-y-8">
          {as.length > 0 && (
            <section aria-labelledby="accepted">
              <h2 id="accepted" className="caption-label">Creators on this campaign · {as.length} of {c.creators_needed}</h2>
              <div className="card mt-3 divide-y divide-border">
                {as.map((a) => {
                  const cr = creators.get(a.creator_id);
                  return (
                    <div key={a.id} className="flex min-h-row-media flex-wrap items-center gap-4 px-4 py-3">
                      <Avatar name={cr?.display_name ?? 'Creator'} src={cr?.avatar} />
                      <div className="min-w-0 flex-1"><div className="truncate font-medium">{cr?.display_name}</div>
                        <div className="truncate text-caption text-secondary">{a.status === 'accepted' ? `Filming · due ${fmtDate(a.due_at)}` : a.status === 'processing' ? 'The Variant Engine is building the variants' : a.status === 'variants_ready' ? 'Creator is checking the variants' : a.status === 'qa_review' ? 'In quality review before delivery' : a.delivered_at ? `Delivered ${timeAgo(a.delivered_at)}` : statusLabel('assignment', a.status)}{a.post_url ? ' · winning ad posted' : ''}</div></div>
                      <StatusBadge kind="assignment" status={a.status} />
                      <LinkButton size="sm" variant="ghost" href={`${base}?tab=messages&with=${a.creator_id}`}>Message</LinkButton>
                      {REVIEWABLE.includes(a.status) && <LinkButton size="sm" variant="secondary" href={`${base}/review/${a.id}`}>{a.status === 'delivered' ? 'Review' : 'Open'}</LinkButton>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <section aria-labelledby="applicants">
            <h2 id="applicants" className="caption-label">Applicants · {slotsLeft > 0 ? `${pluralise(slotsLeft, 'place')} open` : 'all places filled'}</h2>
            <div className="mt-3">
              {c.status === 'draft' ? <EmptyState title="Creators can apply as soon as the campaign is funded." action={<LinkButton href={`${base}?tab=overview`}>Go to payment</LinkButton>} />
                : open.length === 0 ? <EmptyState title={slotsLeft > 0 ? 'No one is waiting for a reply. Invite creators straight from the leaderboard.' : 'Every place on this campaign is filled.'} action={slotsLeft > 0 ? <LinkButton href="/brand/leaderboard" variant="secondary">Open the leaderboard</LinkButton> : undefined} /> : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[...open].sort((a, b) => (ranks.get(a.creator_id) ?? 999) - (ranks.get(b.creator_id) ?? 999)).map((a) => {
                    const cr = creators.get(a.creator_id);
                    if (!cr) return null;
                    return (
                      <CreatorCard key={a.id} c={cr} socials={socials.get(a.creator_id) ?? []} rank={ranks.get(a.creator_id)} earnings={earnings(a.creator_id)}>
                        {a.pitch && <p className="w-full text-caption text-secondary">“{a.pitch}”</p>}
                        <StatusBadge kind="application" status={a.status} />
                        <span className="flex-1" />
                        {a.status !== 'invited' && <>
                          <RpcButton size="sm" variant="ghost" fn="set_application_status" args={{ p_application_id: a.id, p_status: 'rejected' }} path={base}>Decline</RpcButton>
                          <RpcButton size="sm" variant="secondary" fn="set_application_status" args={{ p_application_id: a.id, p_status: 'accepted' }} path={base} disabled={slotsLeft <= 0}>Accept</RpcButton>
                        </>}
                      </CreatorCard>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'deliveries' && (deliveries.length === 0 ? <EmptyState title="Ads arrive here within 7 days of a creator receiving your product." action={<LinkButton href={`${base}?tab=creators`} variant="secondary">See creators</LinkButton>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {deliveries.map((a) => {
            const cr = creators.get(a.creator_id);
            return (
              <Link key={a.id} href={`${base}/review/${a.id}`} className="card flex items-center gap-4 p-4 transition-colors duration-fast hover:border-border-strong">
                <VideoFrame media="variants/hook_first" label={`Ads from ${cr?.display_name ?? 'creator'}`} controls={false} radius="sm" compact className="w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Avatar name={cr?.display_name ?? 'Creator'} src={cr?.avatar} size="sm" /><span className="truncate font-medium">{cr?.display_name}</span></div>
                  <div className="mt-2 text-caption text-secondary">{a.delivered_at ? `Delivered ${timeAgo(a.delivered_at)}` : statusLabel('assignment', a.status)}</div>
                  <div className="mt-3"><StatusBadge kind="assignment" status={a.status} /></div>
                </div>
              </Link>
            );
          })}
        </div>
      ))}

      {tab === 'licences' && ((licences ?? []).length === 0 ? <EmptyState title="Nothing is licensed on this campaign yet. Select your winners in the Review room." action={deliveries[0] ? <LinkButton href={`${base}/review/${deliveries[0].id}`}>Open the Review room</LinkButton> : undefined} /> : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-table">
            <thead><tr><th>Variant</th><th>Licence</th><th>Ends</th><th /></tr></thead>
            <tbody>
              {(licences ?? []).map((l) => { const v = l.variants as unknown as { format: FormatId; assignment_id: string } | null; return (
                <tr key={l.id}>
                  <td className="font-medium">{v ? FORMATS[v.format]?.name ?? v.format : 'Variant'}</td>
                  <td><Badge tone="outline">{LICENSE_LABELS[l.type as LicenseType]}</Badge></td>
                  <td className="tabular text-secondary">{l.ends_at ? `${fmtDate(l.ends_at)} · ${daysLeftLabel(l.ends_at)}` : 'Perpetual'}</td>
                  <td className="text-right">{v && <LinkButton size="sm" variant="ghost" href={`${base}/review/${v.assignment_id}?v=${l.variant_id}`}>Open</LinkButton>}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'payments' && ((payments ?? []).length === 0 ? <EmptyState title="No payments yet. Fund escrow to open the campaign to creators." action={<LinkButton href={`${base}?tab=overview`}>Go to payment</LinkButton>} /> : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-table">
            <thead><tr><th>Date</th><th>Description</th><th>Status</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {(payments ?? []).map((p) => { const type = (p.metadata as { type?: LicenseType } | null)?.type; return (
                <tr key={p.id}>
                  <td className="tabular text-secondary">{fmtDate(p.created_at)}</td>
                  <td>{p.kind === 'license' ? (type ? LICENSE_LABELS[type] : 'Licence') : 'Campaign'}</td>
                  <td><StatusBadge kind="payment" status={p.status} /></td>
                  <td className="num font-medium"><Money minor={p.amount_minor} currency={p.currency} /></td>
                  <td className="text-right"><InvoiceLink paymentId={p.id} label="Invoice" /></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'messages' && (ids.length === 0 ? <EmptyState title="You can message creators once they apply or are invited." /> : (async () => {
        const active = withCreator && ids.includes(withCreator) ? withCreator : (as[0]?.creator_id ?? ids[0]!);
        const { data: msgs } = await sb.from('messages').select('id, sender_id, body_masked, had_masking, created_at').eq('campaign_id', id).eq('creator_id', active).order('created_at');
        return (
          <div className="grid gap-4 lg:grid-cols-aside-main">
            <div className="card max-h-panel divide-y divide-border overflow-y-auto">
              {ids.map((cid) => (
                <Link key={cid} href={`${base}?tab=messages&with=${cid}`} aria-current={cid === active ? 'page' : undefined} className={cn('flex items-center gap-3 p-3 text-small transition-colors duration-fast', cid === active ? 'bg-surface-3' : 'hover:bg-surface-3')}>
                  <Avatar name={creators.get(cid)?.display_name ?? 'Creator'} size="sm" /><span className="truncate">{creators.get(cid)?.display_name}</span>
                </Link>
              ))}
            </div>
            <Chat key={active} campaignId={id} creatorId={active} me={s.userId} initial={msgs ?? []} otherName={creators.get(active)?.display_name ?? 'Creator'} />
          </div>
        );
      })())}
    </>
  );
}
