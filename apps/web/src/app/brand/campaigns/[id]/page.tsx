import Link from 'next/link';
import { notFound } from 'next/navigation';
import { campaignCharge, CREDITS_ENABLED, LICENSE_DEFAULTS, type Brief, type ShotList } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { creatorsByIds, rankMap } from '@/lib/queries';
import { Avatar, Badge, Card, Empty, LinkButton, PageHeader, ProductImage, StatusBadge, statusLabel, Tabs } from '@/components/ui';
import { RpcButton } from '@/components/client';
import { Chat } from '@/components/chat';
import { CreatorCard } from '@/components/creator-card';
import { cn, fmtDate, money as fmtMoney, pluralise, timeAgo } from '@/lib/utils';
import { PayButton } from './pay';

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; with?: string; paid?: string }> }) {
  const { id } = await params;
  const { tab = 'overview', with: withCreator, paid } = await searchParams;
  const s = await requireBrand();
  const sb = await supabaseServer();
  const { data: c } = await sb.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const [{ data: apps }, { data: assignments }, { data: credits }, { data: payment }] = await Promise.all([
    sb.from('applications').select('*').eq('campaign_id', id).order('created_at'),
    sb.from('assignments').select('*').eq('campaign_id', id).order('created_at'),
    CREDITS_ENABLED ? sb.from('credits').select('amount_minor, used_minor').eq('brand_id', c.brand_id).eq('currency', c.currency).gt('expires_at', new Date().toISOString()) : Promise.resolve({ data: [] as { amount_minor: number; used_minor: number }[] }),
    sb.from('payments').select('*').eq('campaign_id', id).eq('kind', 'campaign').order('created_at').limit(1).maybeSingle(),
  ]);
  const ids = [...new Set([...(apps ?? []).map((a) => a.creator_id), ...(assignments ?? []).map((a) => a.creator_id)])] as string[];
  const [{ creators, socials }, ranks] = await Promise.all([creatorsByIds(ids), rankMap()]);
  const brief = c.brief as Brief;
  const shots = c.shot_list as ShotList;
  const base = `/brand/campaigns/${id}`;
  const money = (m: number) => fmtMoney(m, c.currency);
  const credit = (credits ?? []).reduce((a, r) => a + Number(r.amount_minor) - Number(r.used_minor), 0);
  const charge = campaignCharge(Number(c.fee_per_creator_minor), c.creators_needed, c.status === 'draft' ? credit : Number(payment?.credit_applied_minor ?? 0));
  const open = (apps ?? []).filter((a) => !['accepted', 'declined', 'withdrawn'].includes(a.status));
  const slotsLeft = c.creators_needed - (assignments ?? []).length;

  return (
    <>
      <PageHeader
        title={c.title}
        sub={<span className="flex flex-wrap items-center gap-2"><StatusBadge kind="campaign" status={c.status} /><span>{money(Number(c.fee_per_creator_minor))} per creator · {pluralise(c.creators_needed, 'creator')} · due {fmtDate(c.deadline)}</span>{c.qa_required && c.status !== 'draft' && <Badge tone="outline">Reviewed before delivery</Badge>}</span>}
      />
      {paid && c.status !== 'draft' && <div role="status" className="mb-6 rounded-md bg-success-soft px-4 py-3 text-small text-success-text">Payment received and held in escrow. Your campaign is live. Pro creators see it first for 48 hours.</div>}
      <Tabs active={`${base}?tab=${tab}`} tabs={[
        { href: `${base}?tab=overview`, label: 'Brief' },
        { href: `${base}?tab=applicants`, label: 'Applicants', count: open.length },
        { href: `${base}?tab=creators`, label: 'Creators & variants', count: (assignments ?? []).length },
        { href: `${base}?tab=messages`, label: 'Messages' },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-main-aside">
          <div className="space-y-6">
            <Card className="flex gap-5">
              <ProductImage name={c.product_name} src={c.product_images?.[0]} className="w-32" />
              <div><div className="text-caption text-tertiary">Product</div><h2 className="text-h3">{c.product_name}</h2><p className="mt-2 text-small text-secondary">{brief.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">{(c.categories as string[]).map((x) => <Badge key={x} className="capitalize">{x}</Badge>)}{(c.countries as string[]).map((x) => <Badge key={x}>{x}</Badge>)}</div></div>
            </Card>
            <Card>
              <h3 className="font-medium">Brief</h3>
              <dl className="mt-4 grid gap-5 text-small sm:grid-cols-2">
                {([['Goals', [brief.goals]], ['Target audience', [brief.target_audience]], ['Key benefits', brief.key_benefits], ['Key messages', brief.key_messages], ['Must say', brief.must_say], ['Must not say', brief.must_not_say]] as [string, string[]][]).map(([k, v]) => (
                  <div key={k}><dt className="text-caption text-tertiary">{k}</dt><dd className="mt-1 text-secondary">{(v ?? []).filter(Boolean).length > 1 ? <ul className="list-disc space-y-1 pl-4">{v.map((x) => <li key={x}>{x}</li>)}</ul> : (v?.[0] || '—')}</dd></div>
                ))}
              </dl>
            </Card>
            <Card>
              <h3 className="font-medium">Creator shot list</h3>
              <ol className="mt-4 space-y-3">{(shots.shots ?? []).map((sh, i) => (
                <li key={i} className="flex gap-3 text-small"><span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-caption text-secondary">{i + 1}</span><div><span className="font-medium">{sh.title}</span> <span className="tabular text-caption text-tertiary">{sh.seconds}s</span><div className="text-secondary">{sh.direction}</div></div></li>
              ))}</ol>
              {shots.talking_points?.length > 0 && <div className="mt-4 text-small"><div className="text-caption text-tertiary">Talking points</div><ul className="mt-1 list-disc space-y-1 pl-4 text-secondary">{shots.talking_points.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            </Card>
          </div>
          <aside>
            <Card>
              <div className="text-small font-medium">{c.status === 'draft' ? 'Pay into escrow' : 'Escrow'}</div>
              <dl className="tabular mt-4 space-y-2 text-small">
                <div className="flex justify-between"><dt className="text-secondary">{c.creators_needed} × {money(Number(c.fee_per_creator_minor))}</dt><dd>{money(charge.grossMinor)}</dd></div>
                <div className="flex justify-between text-caption text-tertiary"><dt>Creators receive (75%)</dt><dd>{money(charge.creatorPoolMinor)}</dd></div>
                <div className="flex justify-between text-caption text-tertiary"><dt>Platform fee (25%)</dt><dd>{money(charge.platformFeeMinor)}</dd></div>
                {CREDITS_ENABLED && charge.creditAppliedMinor > 0 && <div className="flex justify-between text-success-text"><dt>Campaign credit</dt><dd>−{money(charge.creditAppliedMinor)}</dd></div>}
                <div className="flex justify-between border-t border-border pt-3 font-semibold"><dt>{c.status === 'draft' ? 'Due now' : 'Paid'}</dt><dd>{money(charge.payableMinor)}</dd></div>
              </dl>
              {c.status === 'draft' ? <PayButton campaignId={c.id} label={`Pay ${money(charge.payableMinor)}`} /> : payment && <div className="mt-4 flex items-center justify-between text-caption text-secondary"><span>Paid {fmtDate(payment.created_at)}</span><StatusBadge kind="payment" status={payment.status} /></div>}
              <ul className="mt-4 space-y-2 text-caption text-secondary">
                <li>Up to {LICENSE_DEFAULTS.baseIncludedVariants} selected variants per creator included</li><li>{LICENSE_DEFAULTS.termDays} days paid-ad usage · perpetual organic use on your channels</li><li>Released on approval, or automatically 5 days after delivery</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'applicants' && (c.status === 'draft' ? <Empty title="Fund the campaign to receive applications" body="Creators can apply as soon as the escrow payment is in." action={<LinkButton href={`${base}?tab=overview`}>Go to payment</LinkButton>} /> : open.length === 0 ? <Empty title="No open applications" body={slotsLeft > 0 ? 'Invite creators directly from the leaderboard.' : 'All creator slots are filled.'} action={<LinkButton href="/brand/leaderboard" variant="secondary">Open leaderboard</LinkButton>} /> : (
        <>
          <p className="mb-4 text-small text-secondary">{slotsLeft} of {c.creators_needed} creator slots open. Ranked by leaderboard position, never by follower count.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...open].sort((a, b) => (ranks.get(a.creator_id) ?? 999) - (ranks.get(b.creator_id) ?? 999)).map((a) => {
              const cr = creators.get(a.creator_id);
              if (!cr) return null;
              return (
                <CreatorCard key={a.id} c={cr} socials={socials.get(a.creator_id) ?? []} rank={ranks.get(a.creator_id)}>
                  {a.pitch && <p className="w-full text-caption italic text-secondary">“{a.pitch}”</p>}
                  <StatusBadge kind="application" status={a.status} />
                  <span className="flex-1" />
                  {a.status !== 'invited' && <>
                    {a.status !== 'shortlisted' && <RpcButton size="sm" variant="ghost" fn="set_application_status" args={{ p_application_id: a.id, p_status: 'shortlisted' }} path={base}>Shortlist</RpcButton>}
                    <RpcButton size="sm" variant="ghost" fn="set_application_status" args={{ p_application_id: a.id, p_status: 'rejected' }} path={base}>Decline</RpcButton>
                    <RpcButton size="sm" fn="set_application_status" args={{ p_application_id: a.id, p_status: 'accepted' }} path={base} disabled={slotsLeft <= 0}>Accept</RpcButton>
                  </>}
                </CreatorCard>
              );
            })}
          </div>
        </>
      ))}

      {tab === 'creators' && ((assignments ?? []).length === 0 ? <Empty title="No creators accepted yet" body="Accept applicants to start the shoot." /> : (
        <div className="card divide-y divide-border">
          {(assignments ?? []).map((a) => {
            const cr = creators.get(a.creator_id);
            const ready = ['delivered', 'approved', 'completed', 'disputed'].includes(a.status);
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                <Avatar name={cr?.display_name ?? 'Creator'} src={cr?.avatar} size="md" />
                <div className="min-w-0 flex-1"><div className="font-medium">{cr?.display_name}</div>
                  <div className="text-caption text-secondary">{a.status === 'accepted' ? `Shooting · due ${fmtDate(a.due_at)}` : a.status === 'processing' ? 'Variant Engine is building the variants' : a.status === 'variants_ready' ? 'Creator is reviewing variants in Studio' : a.status === 'qa_review' ? 'In quality review before delivery' : a.delivered_at ? `Delivered ${timeAgo(a.delivered_at)}` : statusLabel('assignment', a.status)}{a.post_url ? ' · winning ad posted' : ''}</div></div>
                <StatusBadge kind="assignment" status={a.status} />
                <LinkButton size="sm" variant="ghost" href={`${base}?tab=messages&with=${a.creator_id}`}>Message</LinkButton>
                {ready ? <LinkButton size="sm" href={`${base}/review/${a.id}`}>{a.status === 'delivered' ? 'Review variants' : 'Open variants'}</LinkButton> : <span className={cn('text-caption text-tertiary')}>Variants appear here when delivered</span>}
              </div>
            );
          })}
        </div>
      ))}

      {tab === 'messages' && (ids.length === 0 ? <Empty title="No conversations yet" body="You can message creators once they apply or are invited." /> : (async () => {
        const active = withCreator && ids.includes(withCreator) ? withCreator : ((assignments ?? [])[0]?.creator_id ?? ids[0]!);
        const { data: msgs } = await sb.from('messages').select('id, sender_id, body_masked, had_masking, created_at').eq('campaign_id', id).eq('creator_id', active).order('created_at');
        return (
          <div className="grid gap-4 lg:grid-cols-aside-main">
            <div className="card max-h-panel divide-y divide-border overflow-y-auto">
              {ids.map((cid) => (
                <Link key={cid} href={`${base}?tab=messages&with=${cid}`} aria-current={cid === active ? 'page' : undefined} className={cn('flex items-center gap-3 p-3 text-small', cid === active ? 'bg-surface-2' : 'hover:bg-surface-3')}>
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
