'use client';
import { useMemo, useState } from 'react';
import { Check, Columns2, Download, Lock, Sparkles, Star, Trophy } from 'lucide-react';
import { ASPECTS, FORMATS, LICENSE_LABELS, type Aspect, type FormatId, type License } from '@takeone/shared';
import { rpc, signedUrl } from '@/lib/actions';
import { buyLicense } from '@/lib/checkout';
import { ActionButton } from '@/components/client';
import { Badge, Button, Card, ICON, VideoFrame } from '@/components/ui';
import { SegmentedControl } from '@/components/ui/select';
import { cn, daysLeftLabel, fmtDate, money as fmtMoney, pluralise } from '@/lib/utils';

interface V { id: string; format: FormatId; status: string; hook_text: string | null; score: number | null; score_reason: string | null; is_synthetic: boolean; ai_disclosure: string | null; language: string | null; thumbnail: string | null; preview_renditions: Partial<Record<Aspect, string>>; renditions: Partial<Record<Aspect, string>> }
interface Props {
  campaignId: string; assignment: { id: string; status: string; winning_variant_id: string | null; post_url: string | null; delivered_at: string | null; approved_at: string | null };
  variants: V[]; notDelivered: { id: string; name: string; tagline: string; v1: boolean }[]; licenses: License[]; urls: Record<string, string>; currency: string;
  prices: Record<'extra' | 'renewal' | 'buyout' | 'whitelist', number>; included: number; termDays: number; productName: string;
}
const RATIO: Record<Aspect, 'reel' | 'portrait' | 'square'> = { '9:16': 'reel', '4:5': 'portrait', '1:1': 'square' };
const RATIO_CLASS: Record<Aspect, string> = { '9:16': 'aspect-reel', '4:5': 'aspect-portrait', '1:1': 'aspect-square' };

/** Plays the watermarked preview when there is footage; a neutral frame until then. Locked variants never load a file. */
function Player({ v, aspect, urls, locked }: { v: V; aspect: Aspect; urls: Record<string, string>; locked: boolean }) {
  if (locked) {
    return (
      <div className={cn('grid place-items-center rounded-md border border-border bg-surface-2 text-center text-secondary', RATIO_CLASS[aspect])}>
        <div><Lock className="mx-auto" size={20} {...ICON} aria-hidden /><div className="mt-2 text-caption">Locked until licensed</div></div>
      </div>
    );
  }
  return <VideoFrame src={urls[v.preview_renditions[aspect] ?? ''] ?? null} poster={aspect === '9:16' ? urls[v.thumbnail ?? ''] ?? null : null} media={`variants/${v.format}`} ratio={RATIO[aspect]} label={`${FORMATS[v.format].name}, ${aspect}`} />;
}

export function Review(p: Props) {
  const path = `/brand/campaigns/${p.campaignId}/review/${p.assignment.id}`;
  const money = (m: number) => fmtMoney(m, p.currency);
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
        <SegmentedControl label="Aspect ratio" value={aspect} onChange={setAspect} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
        <Button variant="secondary" size="sm" onClick={() => setShowAll(!showAll)} aria-pressed={showAll}>{showAll ? 'Show top 5' : 'Show all 10'}</Button>
        <span className="text-small text-secondary">{baseLeft > 0 ? `${baseLeft} of ${p.included} included selections left` : 'Included selections used. Add more as extra licences.'}</span>
        <span className="flex-1" />
        {picked.length > 0 && (
          <ActionButton action={() => rpc('select_variants', { p_assignment_id: p.assignment.id, p_variant_ids: picked }, path)} onDone={() => setPicked([])}>
            <Check size={16} {...ICON} />Select {picked.length} variant{picked.length > 1 ? 's' : ''} · included
          </ActionButton>
        )}
      </div>
      {dlError && <p role="alert" className="text-small text-danger-text">{dlError}</p>}

      {cmp.length === 2 && (
        <Card>
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-small font-medium"><Columns2 size={16} {...ICON} />Side by side</div><Button size="sm" variant="ghost" onClick={() => setCompare([])}>Close</Button></div>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4">{cmp.map((v) => (<div key={v.id}><Player v={v} aspect={aspect} urls={p.urls} locked={false} /><div className="mt-2 flex items-center justify-between text-small"><span className="font-medium">{FORMATS[v.format].name}</span><span className="tabular text-secondary">Score {v.score}</span></div></div>))}</div>
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
            <div key={v.id} className={cn('card flex flex-col gap-3 p-3', picked.includes(v.id) && 'border-accent-brand', isWinner && 'border-border-strong')}>
              <div className="relative">
                <Player v={v} aspect={aspect} urls={p.urls} locked={locked} />
                <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1"><Badge className="border-transparent bg-scrim text-on-media">#{i + 1} · {v.score}</Badge>{isWinner && <Badge className="bg-scrim text-on-media"><Trophy size={16} {...ICON} />Winner</Badge>}</div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2"><span className="text-small font-medium">{f.name}</span>{licensed ? <Badge tone="success">Licensed</Badge> : locked ? <Badge>Locked</Badge> : <Badge tone="accent">Preview</Badge>}</div>
                {v.hook_text && <p className="mt-1 text-caption text-secondary">“{v.hook_text}”</p>}
                <p className="mt-1 text-caption leading-normal text-tertiary">{v.score_reason}</p>
              </div>
              {v.is_synthetic && <div className="flex items-start gap-2 rounded-sm bg-warning-soft p-3 text-caption text-warning-text"><Sparkles size={16} {...ICON} className="mt-1 shrink-0" /><span><b>AI-assisted{v.language ? ` · ${v.language.toUpperCase()} voice` : ' scene'}.</b> {v.ai_disclosure}.</span></div>}
              <div className="mt-auto space-y-2">
                {licensed ? (
                  <>
                    <div className="text-caption text-secondary">{u.perpetual ? 'Perpetual paid usage (buyout)' : u.ends ? `Paid usage until ${fmtDate(u.ends)} · ${daysLeftLabel(u.ends)}` : ''}{u.whitelist ? ` · ${LICENSE_LABELS.whitelist}` : ''}</div>
                    <div className="flex flex-wrap gap-2">{ASPECTS.map((a) => <Button key={a} size="sm" variant="secondary" onClick={() => download(v, a)} aria-label={`Download ${f.name} ${a} without watermark`}><Download size={16} {...ICON} />{a}</Button>)}</div>
                    <div className="flex flex-wrap gap-2">
                      {!u.perpetual && <ActionButton size="sm" variant="ghost" action={buy(v, 'renewal')} confirm={{ title: 'Renew this licence', effect: `Adds ${pluralise(p.termDays, 'day')} of paid usage after the current end date for ${money(p.prices.renewal)}. The creator receives 75%.`, confirmLabel: 'Renew' }}>Renew · {money(p.prices.renewal)}</ActionButton>}
                      {!u.perpetual && <ActionButton size="sm" variant="ghost" action={buy(v, 'buyout')} confirm={{ title: 'Buy out this variant', effect: `Perpetual paid usage for ${money(p.prices.buyout)}. The creator receives 75%.`, confirmLabel: 'Buy out' }}>Buyout · {money(p.prices.buyout)}</ActionButton>}
                      {!u.whitelist && <ActionButton size="sm" variant="ghost" action={buy(v, 'whitelist')} confirm={{ title: LICENSE_LABELS.whitelist, effect: `Run this ad from the creator’s handle for ${pluralise(p.termDays, 'day')} for ${money(p.prices.whitelist)}. The creator receives 75%.`, confirmLabel: 'Add partnership ad' }}>{LICENSE_LABELS.whitelist} · {money(p.prices.whitelist)}</ActionButton>}
                    </div>
                    {!isWinner && <ActionButton size="sm" variant="secondary" className="w-full" action={() => rpc('choose_winner', { p_assignment_id: p.assignment.id, p_variant_id: v.id }, path)}><Trophy size={16} {...ICON} />Set as winning post</ActionButton>}
                  </>
                ) : (
                  <>
                    {baseLeft > 0 ? (
                      <Button size="sm" variant={picked.includes(v.id) ? 'primary' : 'secondary'} className="w-full" aria-pressed={picked.includes(v.id)} disabled={!picked.includes(v.id) && picked.length >= baseLeft}
                        onClick={() => setPicked(picked.includes(v.id) ? picked.filter((x) => x !== v.id) : [...picked, v.id])}>{picked.includes(v.id) ? <><Check size={16} {...ICON} />Picked</> : 'Pick (included)'}</Button>
                    ) : (
                      <ActionButton size="sm" className="w-full" action={buy(v, 'extra')} confirm={{ title: 'License this variant', effect: `${pluralise(p.termDays, 'day')} of paid usage for ${money(p.prices.extra)}. The creator receives 75%.`, confirmLabel: 'License' }}>License · {money(p.prices.extra)} / {p.termDays} days</ActionButton>
                    )}
                    {!locked && <Button size="sm" variant="ghost" className="w-full" aria-pressed={compare.includes(v.id)} onClick={() => setCompare(compare.includes(v.id) ? compare.filter((x) => x !== v.id) : [...compare.slice(-1), v.id])}><Columns2 size={16} {...ICON} />{compare.includes(v.id) ? 'Comparing' : 'Compare'}</Button>}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {showAll && p.notDelivered.map((f) => (
          <div key={f.id} className="card flex flex-col justify-between gap-3 border-dashed p-3 opacity-70">
            <div className={cn('grid place-items-center rounded-sm bg-surface-2 text-caption text-tertiary', RATIO_CLASS[aspect])}>{f.v1 ? 'Not submitted' : 'Planned'}</div>
            <div><div className="text-small font-medium">{f.name}</div><div className="text-caption text-secondary">{f.tagline}</div></div>
          </div>
        ))}
      </div>
      {p.variants.length === 0 && <Card className="text-center text-small text-secondary">No variants have been delivered for this creator yet.</Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-small font-medium">Approve submission</div>
          {p.assignment.status === 'delivered' ? (
            <>
              <p className="mt-1 text-caption text-secondary">Approving releases the creator’s payment from escrow. Auto-approves 5 days after delivery{p.assignment.delivered_at ? ` (on ${fmtDate(new Date(new Date(p.assignment.delivered_at).getTime() + 5 * 86_400_000))})` : ''}.</p>
              <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}><Star size={16} {...ICON} className={n <= rating ? 'fill-warning text-warning-text' : 'text-tertiary'} /></button>)}</div>
              <textarea className="input mt-3" placeholder="Optional feedback for the creator" aria-label="Feedback" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton action={() => rpc('approve_assignment', { p_assignment_id: p.assignment.id, p_rating: rating, p_comment: comment || null }, path)}>Approve and release payment</ActionButton>
                <ActionButton variant="ghost" confirm={{ title: 'Raise a dispute', effect: 'Our team reviews the submission and the payment stays in escrow until it is resolved.', confirmLabel: 'Raise dispute' }} action={() => rpc('open_dispute', { p_assignment_id: p.assignment.id, p_reason: comment || 'Submission does not meet the brief' }, path)}>Raise a dispute</ActionButton>
              </div>
            </>
          ) : <p className="mt-2 text-small text-secondary">{p.assignment.approved_at ? `Approved on ${fmtDate(p.assignment.approved_at)}. Payment released to the creator.` : p.assignment.status === 'disputed' ? 'In dispute. Our team is reviewing; escrow stays held.' : 'Nothing to approve yet.'}</p>}
        </Card>
        <Card>
          <div className="text-small font-medium">Winning post</div>
          <p className="mt-1 text-caption text-secondary">Choose one licensed variant for the creator to post on their own feed. Creators never post the other variants.</p>
          <p className="mt-3 text-small">{p.assignment.post_url ? <>Posted: <a className="text-accent-text hover:underline" href={p.assignment.post_url} target="_blank" rel="noreferrer">{p.assignment.post_url}</a></> : p.assignment.winning_variant_id ? 'Creator notified. Waiting for their post link.' : 'No winner chosen yet.'}</p>
        </Card>
      </div>
    </div>
  );
}
