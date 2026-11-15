'use client';
// The Review room: a cinema-dark, full-screen player. Up/down (or J/K, or a swipe) moves between a creator's
// variants like reels; left/right moves between creators.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Lock, MoreHorizontal, PanelRight, Star, Trophy, X } from 'lucide-react';
import { ASPECTS, FORMATS, LICENSE_LABELS, type Aspect, type FormatId, type License } from '@takeone/shared';
import { motion as motionTokens } from '@takeone/design-tokens';
import { rpc, signedUrl } from '@/lib/actions';
import { buyLicense } from '@/lib/checkout';
import { ActionButton } from '@/components/client';
import { Avatar, Badge, Button, ICON, VideoFrame } from '@/components/ui';
import { DropdownMenu, Modal, Tooltip } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { cn, daysLeftLabel, fmtDate, money as fmtMoney, pluralise } from '@/lib/utils';

interface V { id: string; format: FormatId; status: string; hook_text: string | null; score: number | null; score_reason: string | null; is_synthetic: boolean; language: string | null; thumbnail: string | null; preview_renditions: Partial<Record<Aspect, string>>; renditions: Partial<Record<Aspect, string>> }
interface Props {
  campaign: { id: string; title: string; productName: string; currency: string };
  creator: { name: string; avatar: string | null };
  prev: { href: string; name: string } | null; next: { href: string; name: string } | null;
  assignment: { id: string; status: string; winning_variant_id: string | null; post_url: string | null; delivered_at: string | null; approved_at: string | null };
  variants: V[]; licenses: License[]; urls: Record<string, string>; startAt: string | null;
  prices: Record<'extra' | 'renewal' | 'buyout' | 'whitelist', number>; included: number; termDays: number;
}
const RATIO = { '9:16': 'reel', '4:5': 'portrait', '1:1': 'square' } as const;
const RATIO_CLASS: Record<Aspect, string> = { '9:16': 'aspect-reel', '4:5': 'aspect-portrait', '1:1': 'aspect-square' };
const AI_NOTE = 'Turn on the platform’s AI-info label when publishing.';
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function ReviewRoom(p: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const path = `/brand/campaigns/${p.campaign.id}/review/${p.assignment.id}`;
  const back = `/brand/campaigns/${p.campaign.id}?tab=deliveries`;
  const money = (m: number) => fmtMoney(m, p.campaign.currency);
  const variants = useMemo(() => [...p.variants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [p.variants]);
  const [at, setAt] = useState(() => Math.max(0, variants.findIndex((v) => v.id === p.startAt)));
  const [dir, setDir] = useState(1);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [rail, setRail] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [partner, setPartner] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const wheelAt = useRef(0);

  const licences = useMemo(() => { const m = new Map<string, License[]>(); for (const l of p.licenses) m.set(l.variant_id, [...(m.get(l.variant_id) ?? []), l]); return m; }, [p.licenses]);
  const baseLeft = Math.max(0, p.included - p.licenses.filter((l) => l.type === 'base').length);
  const anyLicensed = variants.some((v) => v.status === 'licensed');
  const included = selected.slice(0, baseLeft), extra = selected.slice(baseLeft);
  const total = extra.length * p.prices.extra + partner.length * p.prices.whitelist;
  const v = variants[at];
  const usage = (x: V) => {
    const ls = licences.get(x.id) ?? [];
    const perpetual = ls.some((l) => l.type === 'buyout');
    return { perpetual, ends: perpetual ? null : ls.filter((l) => l.type !== 'whitelist' && l.ends_at).map((l) => l.ends_at!).sort().pop() ?? null, partner: ls.some((l) => l.type === 'whitelist') };
  };
  const go = useCallback((delta: number) => { setDir(delta); setAt((i) => Math.min(variants.length - 1, Math.max(0, i + delta))); }, [variants.length]);
  const select = useCallback((id: string) => { setError(null); setSelected((s) => toggle(s, id)); setPartner((s) => s.filter((x) => x !== id || !selected.includes(id))); }, [selected]);

  useEffect(() => { root.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (approving || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, [role="menu"], [role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === 'j') { e.preventDefault(); go(1); }
      else if (k === 'arrowup' || k === 'k') { e.preventDefault(); go(-1); }
      else if (k === 'arrowleft' && p.prev) router.push(p.prev.href);
      else if (k === 'arrowright' && p.next) router.push(p.next.href);
      else if (k === 's' && v && v.status !== 'licensed') select(v.id);
      else if (k === 'escape') router.push(back);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approving, go, select, v, p.prev, p.next, router, back]);

  async function confirm() {
    setBusy(true); setError(null);
    const fail = (m?: string) => { setBusy(false); setError(m ?? 'That did not go through.'); };
    if (included.length) { const r = await rpc('select_variants', { p_assignment_id: p.assignment.id, p_variant_ids: included }, path); if (!r.ok) return fail(r.error); }
    for (const [ids, type] of [[extra, 'extra'], [partner, 'whitelist']] as const) {
      for (const id of ids) {
        const r = await buyLicense(id, type, p.campaign.id, path);
        if (!r.ok) return fail(r.error);
        if (r.data?.url) { window.location.href = r.data.url; return; } // card payment: continue after returning
      }
    }
    setBusy(false); setSelected([]); setPartner([]);
    toast(`${pluralise(selected.length + partner.length, 'licence')} confirmed`);
    router.refresh();
  }
  async function download(x: V, a: Aspect) {
    const key = x.renditions[a];
    if (!key) return toast('The file for this variant is not available yet.', 'danger');
    const r = await signedUrl('variants', key, `${p.campaign.productName}-${x.format}-${a.replace(':', 'x')}.mp4`.replace(/\s+/g, '-'));
    if (!r.ok || !r.data) return toast(r.error ?? 'Download failed', 'danger');
    window.location.href = r.data;
  }
  const buy = (x: V, type: 'renewal' | 'buyout') => async () => {
    const r = await buyLicense(x.id, type, p.campaign.id, path);
    if (r.ok && r.data?.url) window.location.href = r.data.url;
    else if (r.ok) { toast(type === 'renewal' ? 'Licence renewed' : 'Variant bought out'); router.refresh(); }
    else toast(r.error ?? 'That did not go through.', 'danger');
  };

  const chrome = 'grid size-10 place-items-center rounded-full text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary disabled:pointer-events-none disabled:opacity-40';
  if (!v) {
    return (
      <div className="fixed inset-0 z-nav grid place-items-center bg-bg p-6 text-center">
        <div><p className="text-body text-secondary">No variants have been delivered for this creator yet.</p><div className="mt-6"><Link href={back} className="text-small text-accent-text underline-offset-4 hover:underline">Back to the campaign</Link></div></div>
      </div>
    );
  }
  const licensed = v.status === 'licensed';
  const locked = anyLicensed && !licensed;
  const isSelected = selected.includes(v.id);
  const asExtra = isSelected ? extra.includes(v.id) : selected.length >= baseLeft;
  const u = usage(v);
  const isWinner = p.assignment.winning_variant_id === v.id;
  const canPartner = (licensed && !u.partner) || isSelected;
  const f = FORMATS[v.format];
  const slide = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: dir * 48 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: dir * -48 } };

  return (
    <div ref={root} tabIndex={-1} data-theme="dark" role="region" aria-label={`Review room: variants from ${p.creator.name}`} className="fixed inset-0 z-nav flex flex-col bg-bg text-primary outline-none">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5">
        <Tooltip label="Close (Esc)"><Link href={back} aria-label="Close the Review room" className={chrome}><X size={20} {...ICON} /></Link></Tooltip>
        <Avatar name={p.creator.name} src={p.creator.avatar} size="sm" />
        <div className="min-w-0 flex-1"><div className="truncate text-small font-medium">{p.creator.name}</div><div className="truncate text-caption text-tertiary">{p.campaign.title}</div></div>
        <div className="flex items-center gap-1">
          {p.prev ? <Tooltip label={`Previous creator: ${p.prev.name}`}><Link href={p.prev.href} aria-label={`Previous creator: ${p.prev.name}`} className={chrome}><ChevronLeft size={20} {...ICON} /></Link></Tooltip> : <span className={cn(chrome, 'opacity-40')} aria-hidden><ChevronLeft size={20} {...ICON} /></span>}
          {p.next ? <Tooltip label={`Next creator: ${p.next.name}`}><Link href={p.next.href} aria-label={`Next creator: ${p.next.name}`} className={chrome}><ChevronRight size={20} {...ICON} /></Link></Tooltip> : <span className={cn(chrome, 'opacity-40')} aria-hidden><ChevronRight size={20} {...ICON} /></span>}
        </div>
        {p.assignment.status === 'delivered' ? <Button size="sm" variant="secondary" onClick={() => setApproving(true)}>Approve work</Button> : p.assignment.approved_at ? <Badge tone="success">Approved {fmtDate(p.assignment.approved_at)}</Badge> : p.assignment.status === 'disputed' ? <Badge tone="warning">In dispute</Badge> : null}
        <Tooltip label={rail ? 'Hide variants' : 'Show variants'}><button type="button" aria-pressed={rail} aria-label="Toggle the variants rail" onClick={() => setRail(!rail)} className={cn(chrome, 'hidden md:grid')}><PanelRight size={20} {...ICON} /></button></Tooltip>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* stage */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center gap-4 px-4 pb-4"
          onTouchStart={(e) => { touch.current = e.touches[0]!.clientY; }}
          onTouchEnd={(e) => { if (touch.current === null) return; const d = e.changedTouches[0]!.clientY - touch.current; touch.current = null; if (Math.abs(d) > 48) go(d < 0 ? 1 : -1); }}
          onWheel={(e) => { if (Math.abs(e.deltaY) < 24 || Date.now() - wheelAt.current < 500) return; wheelAt.current = Date.now(); go(e.deltaY > 0 ? 1 : -1); }}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div key={`${v.id}-${aspect}`} {...slide} transition={{ duration: motionTokens.duration.base / 1000, ease: motionTokens.easing }} className={cn('relative h-full max-h-full max-w-full overflow-hidden rounded-lg', RATIO_CLASS[aspect])}>
              {locked ? (
                <div className="relative grid size-full place-items-center overflow-hidden rounded-lg border border-border bg-surface-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.urls[v.thumbnail ?? ''] && <img src={p.urls[v.thumbnail ?? '']} alt="" className="absolute inset-0 size-full object-cover blur-locked" />}
                  <div className="relative flex flex-col items-center gap-4 p-6 text-center">
                    <Lock size={24} {...ICON} className="text-secondary" aria-hidden />
                    <p className="max-w-xs text-small text-secondary">Not part of your selection. License it to unlock the file.</p>
                    <Button variant={isSelected ? 'primary' : 'secondary'} aria-pressed={isSelected} onClick={() => select(v.id)}>{isSelected ? <><Check size={16} {...ICON} />Added</> : `Licence for ${money(p.prices.extra)}`}</Button>
                  </div>
                </div>
              ) : (
                <VideoFrame src={p.urls[v.preview_renditions[aspect] ?? ''] ?? null} poster={aspect === '9:16' ? p.urls[v.thumbnail ?? ''] ?? null : null} media={`variants/${v.format}`} ratio={RATIO[aspect]} radius="lg" label={`${f.name}, ${aspect}`} className="size-full" />
              )}
              {/* variant info, kept quiet at the bottom */}
              <div className="scrim-bottom pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 pt-16 text-on-media">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-medium">{f.name}</span>
                  <span className="tabular rounded-full bg-scrim px-2 text-caption">Score {v.score ?? '—'}</span>
                  {v.is_synthetic && <Tooltip label={AI_NOTE}><span tabIndex={0} className="pointer-events-auto rounded-full bg-scrim px-2 text-caption">AI-edited</span></Tooltip>}
                  {licensed && <span className="rounded-full bg-scrim px-2 text-caption">Licensed</span>}
                  {isWinner && <span className="flex items-center gap-1 rounded-full bg-scrim px-2 text-caption"><Trophy size={12} {...ICON} aria-hidden />Winning post</span>}
                </div>
                {v.hook_text && !locked && <p className="text-small">“{v.hook_text}”</p>}
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <Tooltip label="Previous variant (K)"><button type="button" aria-label="Previous variant" disabled={at === 0} onClick={() => go(-1)} className={chrome}><ChevronUp size={20} {...ICON} /></button></Tooltip>
            <span className="tabular text-caption text-tertiary" aria-live="polite">{at + 1} / {variants.length}</span>
            <Tooltip label="Next variant (J)"><button type="button" aria-label="Next variant" disabled={at === variants.length - 1} onClick={() => go(1)} className={chrome}><ChevronDown size={20} {...ICON} /></button></Tooltip>
            <div role="radiogroup" aria-label="Aspect ratio" className="mt-4 flex flex-col gap-1 rounded-full bg-surface-2 p-1">
              {ASPECTS.map((a) => <button key={a} type="button" role="radio" aria-checked={aspect === a} onClick={() => setAspect(a)} className={cn('tabular h-8 rounded-full px-2 text-caption transition-colors duration-fast', aspect === a ? 'bg-inverse text-on-inverse' : 'text-secondary hover:text-primary')}>{a}</button>)}
            </div>
          </div>
        </div>

        {/* right rail */}
        {rail && (
          <aside aria-label="All variants from this creator" className="hidden w-64 shrink-0 flex-col border-l border-border md:flex">
            <ul className="flex-1 space-y-1 overflow-y-auto p-3">
              {variants.map((x, i) => {
                const sel = selected.includes(x.id), lic = x.status === 'licensed';
                return (
                  <li key={x.id}>
                    <button type="button" aria-current={i === at} onClick={() => { setDir(i > at ? 1 : -1); setAt(i); }} className={cn('flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors duration-fast hover:bg-surface-3', i === at && 'bg-surface-3')}>
                      <span className={cn('relative grid aspect-reel w-10 shrink-0 place-items-center overflow-hidden rounded-sm border bg-surface-2 text-caption text-tertiary', sel || lic ? 'border-2 border-accent-brand' : 'border-border')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.urls[x.thumbnail ?? ''] ? <img src={p.urls[x.thumbnail ?? '']} alt="" className={cn('absolute inset-0 size-full object-cover', anyLicensed && !lic && 'blur-locked')} /> : anyLicensed && !lic ? <Lock size={12} {...ICON} aria-hidden /> : null}
                      </span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-small font-medium">{FORMATS[x.format].name}</span><span className="tabular block text-caption text-tertiary">Score {x.score ?? '—'}{lic ? ' · Licensed' : sel ? ' · Selected' : anyLicensed ? ' · Locked' : ''}</span></span>
                      {p.assignment.winning_variant_id === x.id && <Trophy size={16} {...ICON} className="text-secondary" aria-label="Winning post" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {v.score_reason && <div className="border-t border-border p-4"><div className="caption-label">Why this score</div><p className="mt-2 text-small text-secondary">{v.score_reason}</p></div>}
          </aside>
        )}
      </div>

      {/* actions */}
      <footer className="shrink-0 border-t border-border px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          {licensed ? (
            <>
              <span className="text-small text-secondary">{u.perpetual ? 'Perpetual paid usage' : u.ends ? `Paid usage until ${fmtDate(u.ends)} · ${daysLeftLabel(u.ends)}` : 'Licensed'}{u.partner ? ` · ${LICENSE_LABELS.whitelist}` : ''}</span>
              {isWinner ? null : <ActionButton size="sm" variant="secondary" confirm={{ title: 'Choose the winning post', effect: `${p.creator.name} is asked to post this one ad on their own feed. Creators never post the other variants; you run those from your own accounts.`, confirmLabel: 'Choose this ad' }} action={() => rpc('choose_winner', { p_assignment_id: p.assignment.id, p_variant_id: v.id }, path)}><Trophy size={16} {...ICON} />Creator posts this one</ActionButton>}
              <DropdownMenu trigger={<Button size="sm" variant="secondary"><Download size={16} {...ICON} />Download</Button>} items={ASPECTS.map((a) => ({ label: `${a} without watermark`, onSelect: () => void download(v, a) }))} />
              {!u.perpetual && <DropdownMenu trigger={<button type="button" aria-label="More licence options" className={chrome}><MoreHorizontal size={20} {...ICON} /></button>} items={[{ label: `Renew for ${pluralise(p.termDays, 'day')} · ${money(p.prices.renewal)}`, onSelect: () => void buy(v, 'renewal')() }, { label: `Buy out · ${money(p.prices.buyout)}`, onSelect: () => void buy(v, 'buyout')() }]} />}
            </>
          ) : (
            <Button variant={isSelected ? 'primary' : 'secondary'} aria-pressed={isSelected} onClick={() => select(v.id)}>
              {isSelected ? <><Check size={16} {...ICON} />Selected</> : asExtra ? `Licence extra · ${money(p.prices.extra)}` : 'Select'}
            </Button>
          )}
          {canPartner && (
            <Tooltip label={`Run this ad from ${p.creator.name}’s handle. Adds 30% of the creator fee.`}>
              <button type="button" role="switch" aria-checked={partner.includes(v.id)} onClick={() => setPartner((s) => toggle(s, v.id))} className={cn('chip normal-case', partner.includes(v.id) && 'is-on')}>{LICENSE_LABELS.whitelist} · +{money(p.prices.whitelist)}</button>
            </Tooltip>
          )}
          <span className="tabular text-small text-secondary">{baseLeft > 0 ? `${Math.min(included.length, baseLeft)} of ${baseLeft} included` : 'Included selections used'}</span>
          <span className="flex-1" />
          {(selected.length > 0 || partner.length > 0) && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="tabular text-right text-small">
                <div>{[included.length && `${included.length} included`, extra.length && `${extra.length} extra`, partner.length && pluralise(partner.length, 'partnership ad')].filter(Boolean).join(' · ')}</div>
                <div className="text-caption text-tertiary">{total > 0 ? `Total ${money(total)} · creators receive 75%` : 'Included in your campaign fee'}</div>
              </div>
              <Button variant="accent" loading={busy} onClick={confirm}>Confirm selection</Button>
            </div>
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-small text-danger-text">{error}</p>}
        <p className="mt-3 hidden text-caption text-tertiary lg:block" aria-hidden>↑ ↓ or J K: variants · ← →: creators · S: select · Esc: close</p>
      </footer>

      <Modal open={approving} onOpenChange={setApproving} title="Approve this creator’s work" description={`Approving releases ${p.creator.name}’s payment from escrow.${p.assignment.delivered_at ? ` It is approved automatically on ${fmtDate(new Date(new Date(p.assignment.delivered_at).getTime() + 5 * 86_400_000))} if you do nothing.` : ''}`}
        footer={<>
          <ActionButton variant="ghost" confirm={{ title: 'Raise a dispute', effect: 'Our team reviews the submission and the payment stays in escrow until it is resolved.', confirmLabel: 'Raise dispute' }} action={() => rpc('open_dispute', { p_assignment_id: p.assignment.id, p_reason: comment || 'Submission does not meet the brief' }, path)} onDone={() => setApproving(false)}>Raise a dispute</ActionButton>
          <ActionButton action={() => rpc('approve_assignment', { p_assignment_id: p.assignment.id, p_rating: rating, p_comment: comment || null }, path)} onDone={() => { setApproving(false); toast('Approved. Payment released to the creator.'); }}>Approve and release payment</ActionButton>
        </>}>
        <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={pluralise(n, 'star')} onClick={() => setRating(n)} className="grid size-9 place-items-center rounded-sm"><Star size={20} {...ICON} className={n <= rating ? 'fill-current text-primary' : 'text-tertiary'} /></button>)}
        </div>
        <label className="label mt-4" htmlFor="review-comment">Feedback for the creator (optional)</label>
        <textarea id="review-comment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </div>
  );
}
