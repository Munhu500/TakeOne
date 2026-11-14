import Link from 'next/link';
import { notFound } from 'next/navigation';
import { campaignCharge, formatMoney, LICENSE_DEFAULTS, type Brief, type ShotList } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { creatorsByIds, rankMap } from '@/lib/queries';
import { Avatar, Badge, Card, Empty, LinkButton, PageHeader, STATUS_TONE, Tabs } from '@/components/ui';
import { RpcButton } from '@/components/client';
import { Chat } from '@/components/chat';
import { CreatorCard } from '@/components/creator-card';
import { assetUrl, cn, fmtDate, timeAgo, titleCase } from '@/lib/utils';
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
    sb.from('credits').select('amount_minor, used_minor').eq('brand_id', c.brand_id).eq('currency', c.currency).gt('expires_at', new Date().toISOString()),
    sb.from('payments').select('*').eq('campaign_id', id).eq('kind', 'campaign').order('created_at').limit(1).maybeSingle(),
  ]);
  const ids = [...new Set([...(apps ?? []).map((a) => a.creator_id), ...(assignments ?? []).map((a) => a.creator_id)])] as string[];
  const [{ creators, socials }, ranks] = await Promise.all([creatorsByIds(ids), rankMap()]);
  const brief = c.brief as Brief;
  const shots = c.shot_list as ShotList;
  const base = `/brand/campaigns/${id}`;
  const money = (m: number) => formatMoney(m, c.currency);
  const credit = (credits ?? []).reduce((a, r) => a + Number(r.amount_minor) - Number(r.used_minor), 0);
  const charge = campaignCharge(Number(c.fee_per_creator_minor), c.creators_needed, c.status === 'draft' ? credit : Number(payment?.credit_applied_minor ?? 0));
  const open = (apps ?? []).filter((a) => !['accepted', 'declined', 'withdrawn'].includes(a.status));
  const slotsLeft = c.creators_needed - (assignments ?? []).length;
  const img = assetUrl(c.product_images?.[0]);

  return (
    <>
      <PageHeader
        title={c.title}
        sub={<span className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[c.status]}>{c.status === 'draft' ? 'Draft · unpaid' : titleCase(c.status)}</Badge><span>{money(Number(c.fee_per_creator_minor))} per creator · {c.creators_needed} creators · due {fmtDate(c.deadline)}</span>{c.qa_required && c.status !== 'draft' && <Badge>QA-reviewed before delivery</Badge>}</span>}
      />
      {paid && c.status !== 'draft' && <div role="status" className="mb-6 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">Payment received and held in escrow. Your campaign is live — Pro creators see it first for 48 hours.</div>}
      <Tabs active={`${base}?tab=${tab}`} tabs={[
        { href: `${base}?tab=overview`, label: 'Brief' },
        { href: `${base}?tab=applicants`, label: 'Applicants', count: open.length },
        { href: `${base}?tab=creators`, label: 'Creators & variants', count: (assignments ?? []).length },
        { href: `${base}?tab=messages`, label: 'Messages' },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card className="flex gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img && <img src={img} alt={c.product_name} className="h-40 w-32 shrink-0 rounded-xl object-cover" />}
              <div><div className="text-xs text-faint">Product</div><h2 className="font-display text-xl font-semibold">{c.product_name}</h2><p className="mt-2 text-sm text-muted">{brief.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{(c.categories as string[]).map((x) => <Badge key={x} className="capitalize">{x}</Badge>)}{(c.countries as string[]).map((x) => <Badge key={x}>{x}</Badge>)}</div></div>
            </Card>
            <Card>
              <h3 className="font-medium">Brief</h3>
              <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2">
                {([['Goals', [brief.goals]], ['Target audience', [brief.target_audience]], ['Key benefits', brief.key_benefits], ['Key messages', brief.key_messages], ['Must say', brief.must_say], ['Must not say', brief.must_not_say]] as [string, string[]][]).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-faint">{k}</dt><dd className="mt-1 text-muted">{(v ?? []).filter(Boolean).length > 1 ? <ul className="list-disc space-y-0.5 pl-4">{v.map((x) => <li key={x}>{x}</li>)}</ul> : (v?.[0] || '—')}</dd></div>
                ))}
              </dl>
            </Card>
            <Card>
              <h3 className="font-medium">Creator shot list</h3>
              <ol className="mt-4 space-y-3">{(shots.shots ?? []).map((sh, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-raised text-xs text-muted">{i + 1}</span><div><span className="font-medium">{sh.title}</span> <span className="tabular text-xs text-faint">{sh.seconds}s</span><div className="text-muted">{sh.direction}</div></div></li>
              ))}</ol>
              {shots.talking_points?.length > 0 && <div className="mt-4 text-sm"><div className="text-xs text-faint">Talking points</div><ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{shots.talking_points.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            </Card>
          </div>
          <aside>
            <Card>
              <div className="text-sm font-medium">{c.status === 'draft' ? 'Pay into escrow' : 'Escrow'}</div>
              <dl className="tabular mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">{c.creators_needed} × {money(Number(c.fee_per_creator_minor))}</dt><dd>{money(charge.grossMinor)}</dd></div>
                <div className="flex justify-between text-xs text-faint"><dt>Creators receive (75%)</dt><dd>{money(charge.creatorPoolMinor)}</dd></div>
                <div className="flex justify-between text-xs text-faint"><dt>Platform fee (25%)</dt><dd>{money(charge.platformFeeMinor)}</dd></div>
                {charge.creditAppliedMinor > 0 && <div className="flex justify-between text-ok"><dt>Campaign credit</dt><dd>−{money(charge.creditAppliedMinor)}</dd></div>}
                <div className="flex justify-between border-t border-line pt-3 font-semibold"><dt>{c.status === 'draft' ? 'Due now' : 'Paid'}</dt><dd>{money(charge.payableMinor)}</dd></div>
              </dl>
              {c.status === 'draft' ? <PayButton campaignId={c.id} label={`Pay ${money(charge.payableMinor)}`} /> : payment && <div className="mt-4 flex items-center justify-between text-xs text-muted"><span>{payment.status === 'held' ? 'Held in escrow' : titleCase(payment.status)} · {payment.provider}</span><Badge tone={STATUS_TONE[payment.status]}>{titleCase(payment.status)}</Badge></div>}
              <ul className="mt-4 space-y-1.5 text-xs text-muted">
                <li>Up to {LICENSE_DEFAULTS.baseIncludedVariants} selected variants per creator included</li><li>{LICENSE_DEFAULTS.termDays} days paid-ad usage · perpetual organic use on your channels</li><li>Released on approval, or automatically 5 days after delivery</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'applicants' && (c.status === 'draft' ? <Empty title="Fund the campaign to receive applications" body="Creators can apply as soon as the escrow payment is in." action={<LinkButton href={`${base}?tab=overview`}>Go to payment</LinkButton>} /> : open.length === 0 ? <Empty title="No open applications" body={slotsLeft > 0 ? 'Invite creators directly from the leaderboard.' : 'All creator slots are filled.'} action={<LinkButton href="/brand/leaderboard" variant="secondary">Open leaderboard</LinkButton>} /> : (
        <>
          <p className="mb-4 text-sm text-muted">{slotsLeft} of {c.creators_needed} creator slots open. Ranked by leaderboard position, never by follower count.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...open].sort((a, b) => (ranks.get(a.creator_id) ?? 999) - (ranks.get(b.creator_id) ?? 999)).map((a) => {
              const cr = creators.get(a.creator_id);
              if (!cr) return null;
              return (
                <CreatorCard key={a.id} c={cr} socials={socials.get(a.creator_id) ?? []} rank={ranks.get(a.creator_id)}>
                  {a.pitch && <p className="w-full text-xs italic text-muted">“{a.pitch}”</p>}
                  <Badge tone={STATUS_TONE[a.status]}>{a.status === 'invited' ? 'Invited · awaiting reply' : titleCase(a.status)}</Badge>
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
        <div className="card divide-y divide-line">
          {(assignments ?? []).map((a) => {
            const cr = creators.get(a.creator_id);
            const ready = ['delivered', 'approved', 'completed', 'disputed'].includes(a.status);
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                <Avatar name={cr?.display_name ?? 'Creator'} src={cr?.avatar} size={40} />
                <div className="min-w-0 flex-1"><div className="font-medium">{cr?.display_name}</div>
                  <div className="text-xs text-muted">{a.status === 'accepted' ? `Shooting · due ${fmtDate(a.due_at)}` : a.status === 'processing' ? 'Variant Engine is building the variants' : a.status === 'variants_ready' ? 'Creator is reviewing variants in Studio' : a.status === 'qa_review' ? 'In quality review before delivery' : a.delivered_at ? `Delivered ${timeAgo(a.delivered_at)}` : titleCase(a.status)}{a.post_url ? ' · winning ad posted' : ''}</div></div>
                <Badge tone={STATUS_TONE[a.status]}>{titleCase(a.status)}</Badge>
                <LinkButton size="sm" variant="ghost" href={`${base}?tab=messages&with=${a.creator_id}`}>Message</LinkButton>
                {ready ? <LinkButton size="sm" href={`${base}/review/${a.id}`}>{a.status === 'delivered' ? 'Review variants' : 'Open variants'}</LinkButton> : <span className={cn('text-xs text-faint')}>Variants appear here when delivered</span>}
              </div>
            );
          })}
        </div>
      ))}

      {tab === 'messages' && (ids.length === 0 ? <Empty title="No conversations yet" body="You can message creators once they apply or are invited." /> : (async () => {
        const active = withCreator && ids.includes(withCreator) ? withCreator : ((assignments ?? [])[0]?.creator_id ?? ids[0]!);
        const { data: msgs } = await sb.from('messages').select('id, sender_id, body_masked, had_masking, created_at').eq('campaign_id', id).eq('creator_id', active).order('created_at');
        return (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="card max-h-[520px] divide-y divide-line overflow-y-auto">
              {ids.map((cid) => (
                <Link key={cid} href={`${base}?tab=messages&with=${cid}`} aria-current={cid === active ? 'page' : undefined} className={cn('flex items-center gap-3 p-3 text-sm', cid === active ? 'bg-raised' : 'hover:bg-raised/50')}>
                  <Avatar name={creators.get(cid)?.display_name ?? 'Creator'} size={30} /><span className="truncate">{creators.get(cid)?.display_name}</span>
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
