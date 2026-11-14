'use client';
import { useMemo, useState } from 'react';
import { Check, Columns2, Download, Lock, Sparkles, Star, Trophy } from 'lucide-react';
import { ASPECTS, FORMATS, formatMoney, type Aspect, type FormatId, type License } from '@takeone/shared';
import { rpc, signedUrl } from '@/lib/actions';
import { buyLicense } from '@/lib/checkout';
import { ActionButton } from '@/components/client';
import { Badge, Button, Card } from '@/components/ui';
import { cn, daysLeft, fmtDate } from '@/lib/utils';

interface V { id: string; format: FormatId; status: string; hook_text: string | null; score: number | null; score_reason: string | null; is_synthetic: boolean; ai_disclosure: string | null; language: string | null; thumbnail: string | null; preview_renditions: Partial<Record<Aspect, string>>; renditions: Partial<Record<Aspect, string>> }
interface Props {
  campaignId: string; assignment: { id: string; status: string; winning_variant_id: string | null; post_url: string | null; delivered_at: string | null; approved_at: string | null };
  variants: V[]; notDelivered: { id: string; name: string; tagline: string; v1: boolean }[]; licenses: License[]; urls: Record<string, string>; currency: string;
  prices: Record<'extra' | 'renewal' | 'buyout' | 'whitelist', number>; included: number; termDays: number; productName: string;
}
const RATIO: Record<Aspect, string> = { '9:16': 'aspect-[9/16]', '4:5': 'aspect-[4/5]', '1:1': 'aspect-square' };

function Player({ v, aspect, urls, locked, large }: { v: V; aspect: Aspect; urls: Record<string, string>; locked: boolean; large?: boolean }) {
  const src = urls[v.preview_renditions[aspect] ?? ''];
  const poster = urls[v.thumbnail ?? ''];
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-black', RATIO[aspect], large ? 'max-h-[70vh]' : '')}>
      {locked ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {poster && <img src={poster} alt="" className="h-full w-full scale-110 object-cover blur-xl" />}
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-center text-white"><div><Lock className="mx-auto" size={22} /><div className="mt-2 text-xs font-medium">Locked until licensed</div></div></div>
        </>
      ) : (
        <video key={src} className="h-full w-full object-cover" src={src} poster={aspect === '9:16' ? poster : undefined} controls playsInline preload="none" aria-label={`${FORMATS[v.format].name} preview, ${aspect}`} />
      )}
    </div>
  );
}

export function Review(p: Props) {
  const path = `/brand/campaigns/${p.campaignId}/review/${p.assignment.id}`;
  const money = (m: number) => formatMoney(m, p.currency);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [dlError, setDlError] = useState<string | null>(null);

  const byVariant = useMemo(() => {
    const m = new Map<string, License[]>();
    for (const l of p.licenses) m.set(l.variant_id, [...(m.get(l.variant_id) ?? []), l]);
    return m;
  }, [p.licenses]);
  const baseUsed = p.licenses.filter((l) => l.type === 'base').length;
  const baseLeft = Math.max(0, p.included - baseUsed);
  const anyLicensed = p.variants.some((v) => v.status === 'licensed');
  const ordered = [...p.variants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const shown = showAll ? ordered : ordered.slice(0, 5);
  const usage = (v: V) => {
    const ls = byVariant.get(v.id) ?? [];
    if (ls.some((l) => l.type === 'buyout')) return { perpetual: true, ends: null as string | null, whitelist: ls.some((l) => l.type === 'whitelist') };
    const ends = ls.filter((l) => l.type !== 'whitelist' && l.ends_at).map((l) => l.ends_at!).sort().pop() ?? null;
    return { perpetual: false, ends, whitelist: ls.some((l) => l.type === 'whitelist') };
  };
  async function download(v: V, a: Aspect) {
    setDlError(null);
    const key = v.renditions[a];
    if (!key) return;
    const r = await signedUrl('variants', key, `${p.productName}-${v.format}-${a.replace(':', 'x')}.mp4`.replace(/\s+/g, '-'));
    if (!r.ok || !r.data) return setDlError(r.error ?? 'Download failed');
    window.location.href = r.data;
  }
  const buy = (v: V, type: 'extra' | 'renewal' | 'buyout' | 'whitelist') => async () => {
    const r = await buyLicense(v.id, type, p.campaignId, path);
    if (r.ok && r.data?.url) window.location.href = r.data.url;
    return r;
  };
  const cmp = compare.map((id) => p.variants.find((v) => v.id === id)).filter((v): v is V => !!v);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Aspect ratio" className="inline-flex rounded-xl border border-line bg-raised p-1">
          {ASPECTS.map((a) => <button key={a} role="radio" aria-checked={aspect === a} onClick={() => setAspect(a)} className={cn('tabular rounded-lg px-3 py-1.5 text-xs', aspect === a ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}>{a}</button>)}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowAll(!showAll)} aria-pressed={showAll}>{showAll ? 'Show top 5' : 'Show all 10'}</Button>
        <span className="text-sm text-muted">{baseLeft > 0 ? `${baseLeft} of ${p.included} included selections left` : 'Included selections used — add more as extra licenses'}</span>
        <span className="flex-1" />
        {picked.length > 0 && (
          <ActionButton action={() => rpc('select_variants', { p_assignment_id: p.assignment.id, p_variant_ids: picked }, path)} onDone={() => setPicked([])}>
            <Check size={15} />Select {picked.length} variant{picked.length > 1 ? 's' : ''} · included
          </ActionButton>
        )}
      </div>
      {dlError && <p role="alert" className="text-sm text-bad">{dlError}</p>}

      {cmp.length === 2 && (
        <Card>
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium"><Columns2 size={16} />Side by side</div><Button size="sm" variant="ghost" onClick={() => setCompare([])}>Close</Button></div>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4">{cmp.map((v) => (<div key={v.id}><Player v={v} aspect={aspect} urls={p.urls} locked={false} large /><div className="mt-2 flex items-center justify-between text-sm"><span className="font-medium">{FORMATS[v.format].name}</span><span className="tabular text-muted">Score {v.score}</span></div></div>))}</div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {shown.map((v, i) => {
          const f = FORMATS[v.format];
          const licensed = v.status === 'licensed';
          const locked = anyLicensed && !licensed; // unselected variants stay locked and blurred until licensed
          const u = usage(v);
          const isWinner = p.assignment.winning_variant_id === v.id;
          return (
            <div key={v.id} className={cn('card flex flex-col gap-3 p-3', picked.includes(v.id) && 'border-accent', isWinner && 'border-warn')}>
              <div className="relative">
                <Player v={v} aspect={aspect} urls={p.urls} locked={locked} />
                <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1"><Badge className="border-transparent bg-black/70 text-white">#{i + 1} · {v.score}</Badge>{isWinner && <Badge tone="warn" className="bg-black/70"><Trophy size={11} />Winner</Badge>}</div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{f.name}</span>{licensed ? <Badge tone="ok">Licensed</Badge> : locked ? <Badge>Locked</Badge> : <Badge tone="accent">Preview</Badge>}</div>
                {v.hook_text && <p className="mt-1 text-xs text-muted">“{v.hook_text}”</p>}
                <p className="mt-1 text-[11px] leading-snug text-faint">{v.score_reason}</p>
              </div>
              {v.is_synthetic && <div className="flex items-start gap-1.5 rounded-lg border border-warn/25 bg-warn/10 p-2 text-[11px] text-warn"><Sparkles size={12} className="mt-0.5 shrink-0" /><span><b>AI-assisted{v.language ? ` · ${v.language.toUpperCase()} voice` : ' scene'}.</b> {v.ai_disclosure}.</span></div>}
              <div className="mt-auto space-y-2">
                {licensed ? (
                  <>
                    <div className="text-[11px] text-muted">{u.perpetual ? 'Perpetual paid usage (buyout)' : u.ends ? `Paid usage until ${fmtDate(u.ends)} · ${Math.max(0, daysLeft(u.ends))} days left` : ''}{u.whitelist ? ' · whitelisted' : ''}</div>
                    <div className="flex flex-wrap gap-1.5">{ASPECTS.map((a) => <Button key={a} size="sm" variant="secondary" onClick={() => download(v, a)} aria-label={`Download ${f.name} ${a} without watermark`}><Download size={12} />{a}</Button>)}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {!u.perpetual && <ActionButton size="sm" variant="ghost" action={buy(v, 'renewal')} confirm={`Renew for ${p.termDays} more days for ${money(p.prices.renewal)}?`}>Renew · {money(p.prices.renewal)}</ActionButton>}
                      {!u.perpetual && <ActionButton size="sm" variant="ghost" action={buy(v, 'buyout')} confirm={`Buy out perpetual usage for ${money(p.prices.buyout)}?`}>Buyout · {money(p.prices.buyout)}</ActionButton>}
                      {!u.whitelist && <ActionButton size="sm" variant="ghost" action={buy(v, 'whitelist')} confirm={`Add whitelisting (run from the creator's handle) for ${money(p.prices.whitelist)}?`}>Whitelist · {money(p.prices.whitelist)}</ActionButton>}
                    </div>
                    {!isWinner && <ActionButton size="sm" variant="secondary" className="w-full" action={() => rpc('choose_winner', { p_assignment_id: p.assignment.id, p_variant_id: v.id }, path)}><Trophy size={12} />Creator posts this one</ActionButton>}
                  </>
                ) : (
                  <>
                    {baseLeft > 0 ? (
                      <Button size="sm" variant={picked.includes(v.id) ? 'primary' : 'secondary'} className="w-full" aria-pressed={picked.includes(v.id)} disabled={!picked.includes(v.id) && picked.length >= baseLeft}
                        onClick={() => setPicked(picked.includes(v.id) ? picked.filter((x) => x !== v.id) : [...picked, v.id])}>{picked.includes(v.id) ? <><Check size={12} />Picked</> : 'Pick (included)'}</Button>
                    ) : (
                      <ActionButton size="sm" className="w-full" action={buy(v, 'extra')} confirm={`License this variant for ${p.termDays} days for ${money(p.prices.extra)}?`}>License · {money(p.prices.extra)} / {p.termDays} days</ActionButton>
                    )}
                    {!locked && <Button size="sm" variant="ghost" className="w-full" aria-pressed={compare.includes(v.id)} onClick={() => setCompare(compare.includes(v.id) ? compare.filter((x) => x !== v.id) : [...compare.slice(-1), v.id])}><Columns2 size={12} />{compare.includes(v.id) ? 'Comparing' : 'Compare'}</Button>}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {showAll && p.notDelivered.map((f) => (
          <div key={f.id} className="card flex flex-col justify-between gap-3 border-dashed p-3 opacity-70">
            <div className={cn('grid place-items-center rounded-xl bg-raised text-xs text-faint', RATIO[aspect])}>{f.v1 ? 'Not submitted' : 'Coming soon'}</div>
            <div><div className="text-sm font-medium">{f.name}</div><div className="text-xs text-muted">{f.tagline}</div></div>
          </div>
        ))}
      </div>
      {p.variants.length === 0 && <Card className="text-center text-sm text-muted">No variants have been delivered for this creator yet.</Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-medium">Approve submission</div>
          {p.assignment.status === 'delivered' ? (
            <>
              <p className="mt-1 text-xs text-muted">Approving releases the creator’s payment from escrow. Auto-approves 5 days after delivery{p.assignment.delivered_at ? ` (on ${fmtDate(new Date(new Date(p.assignment.delivered_at).getTime() + 5 * 86_400_000))})` : ''}.</p>
              <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}><Star size={22} className={n <= rating ? 'fill-warn text-warn' : 'text-faint'} /></button>)}</div>
              <textarea className="input mt-3" placeholder="Optional feedback for the creator" aria-label="Feedback" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton action={() => rpc('approve_assignment', { p_assignment_id: p.assignment.id, p_rating: rating, p_comment: comment || null }, path)}>Approve and release payment</ActionButton>
                <ActionButton variant="ghost" confirm="Open a dispute? Our team will review it and escrow stays held." action={() => rpc('open_dispute', { p_assignment_id: p.assignment.id, p_reason: comment || 'Submission does not meet the brief' }, path)}>Raise a dispute</ActionButton>
              </div>
            </>
          ) : <p className="mt-2 text-sm text-muted">{p.assignment.approved_at ? `Approved on ${fmtDate(p.assignment.approved_at)}. Payment released to the creator.` : p.assignment.status === 'disputed' ? 'In dispute. Our team is reviewing; escrow stays held.' : 'Nothing to approve yet.'}</p>}
        </Card>
        <Card>
          <div className="text-sm font-medium">Winning post</div>
          <p className="mt-1 text-xs text-muted">Choose one licensed variant for the creator to post on their own feed. Creators never post the other variants.</p>
          <p className="mt-3 text-sm">{p.assignment.post_url ? <>Posted: <a className="text-accent hover:underline" href={p.assignment.post_url} target="_blank" rel="noreferrer">{p.assignment.post_url}</a></> : p.assignment.winning_variant_id ? 'Creator notified. Waiting for their post link.' : 'No winner chosen yet.'}</p>
        </Card>
      </div>
    </div>
  );
}
