'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { campaignCharge, CATEGORIES, categoryLabel, COUNTRIES, countryName, CURRENCIES, LICENSE_TERM, type Brief, type CurrencyCode, type ShotList } from '@takeone/shared';
import { saveCampaign } from '@/lib/actions';
import { payCampaign } from '@/lib/checkout';
import { draftProduct, draftShotList } from '@/lib/ai';
import { Button, Card, Flag, ICON, Input, ProductImage, Textarea } from '@/components/ui';
import { cn, fmtDate, money as fmtMoney, pluralise } from '@/lib/utils';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const EMPTY_SHOTS: ShotList = { shots: [], talking_points: [], framing_tips: [] };
const STEPS = ['Product link', 'Brief', 'Creators & budget', 'Review & fund'];
/** Typical per-creator fees on the platform, shown as guidance only. */
const RANGE: Record<string, [number, number]> = { INR: [12_000, 25_000], AED: [1_200, 2_500], USD: [300, 600] };

function ListField({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const id = `f-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return <Textarea id={id} label={`${label} · one per line`} helper={hint} value={value.join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} onBlur={(e) => onChange(lines(e.target.value))} />;
}

interface Draft {
  step: number; url: string; title: string; product: string; images: string[]; brief: Brief; shots: ShotList; categories: string[]; countries: string[];
  creators: number; fee: string; term: number; deadline: string;
}

export function CampaignWizard({ brand, includedVariants }: { brand: { id: string; country: string; currency: string }; includedVariants: number }) {
  const key = `t1-campaign-draft-${brand.id}`;
  const range = RANGE[brand.currency] ?? RANGE.USD!;
  const [d, setD] = useState<Draft>({
    step: 0, url: '', title: '', product: '', images: [],
    brief: { description: '', key_benefits: [], goals: '', key_messages: [], must_say: [], must_not_say: [], target_audience: '', uses_ai_likeness: true },
    shots: EMPTY_SHOTS, categories: [], countries: [brand.country], creators: 3, fee: String(range[0]), term: LICENSE_TERM.defaultDays,
    deadline: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10),
  });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setBrief = (patch: Partial<Brief>) => setD((x) => ({ ...x, brief: { ...x.brief, ...patch } }));
  const [busy, setBusy] = useState<null | 'extract' | 'shots' | 'draft' | 'fund'>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const restored = useRef(false);

  // autosave: restore once, then write a moment after each change
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) { setD((x) => ({ ...x, ...(JSON.parse(raw) as Partial<Draft>) })); setSavedAt('earlier'); } } catch { /* nothing saved */ }
    restored.current = true;
  }, [key]);
  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify(d)); setSavedAt('just now'); } catch { /* storage unavailable */ } }, 600);
    return () => clearTimeout(t);
  }, [d, key]);

  const decimals = CURRENCIES[brand.currency as CurrencyCode]?.decimals ?? 2;
  const feeMinor = Math.round(Number(d.fee || 0) * 10 ** decimals); // typed in major units → integer minor units, once, at the edge
  const charge = useMemo(() => (feeMinor >= 100 && d.creators >= 1 ? campaignCharge(feeMinor, d.creators, 0) : null), [feeMinor, d.creators]);
  const money = (m: number) => fmtMoney(m, brand.currency);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function extract() {
    setBusy('extract'); setNote(null); setError(null);
    const r = await draftProduct(d.url);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    const p = r.data;
    setD((x) => ({ ...x, product: p.product_name, title: x.title || `${p.product_name} launch`, images: p.images,
      brief: { ...x.brief, description: p.description, key_benefits: p.key_benefits, key_messages: x.brief.key_messages.length ? x.brief.key_messages : p.key_benefits.slice(0, 3), must_say: x.brief.must_say.length ? x.brief.must_say : [p.product_name] } }));
    setNote(r.provider === 'mock' ? 'Demo: we’ve filled in a starter draft. In the live product, details are read from your product page automatically.' : r.fetched ? 'Drafted from your product page. Check every line.' : 'We could not read that page, so this is a starter draft for you to edit.');
  }
  async function genShots() {
    setBusy('shots'); setError(null);
    const r = await draftShotList(d.product, { ...d.brief, key_benefits: lines(d.brief.key_benefits.join('\n')) });
    setBusy(null);
    if (!r.ok) { setError(r.error); return false; }
    set({ shots: r.data });
    return true;
  }
  async function next() {
    setError(null);
    if (d.step === 1 && d.shots.shots.length === 0 && !(await genShots())) return; // the shot list is drafted from the brief
    set({ step: d.step + 1 });
  }
  async function save(fund: boolean) {
    setBusy(fund ? 'fund' : 'draft'); setError(null);
    const clean = (a: string[]) => lines(a.join('\n'));
    const r = await saveCampaign({
      brand_id: brand.id, title: d.title, product_name: d.product, product_url: d.url, product_images: d.images,
      brief: { ...d.brief, key_benefits: clean(d.brief.key_benefits), key_messages: clean(d.brief.key_messages), must_say: clean(d.brief.must_say), must_not_say: clean(d.brief.must_not_say) },
      shot_list: { ...d.shots, talking_points: clean(d.shots.talking_points), framing_tips: clean(d.shots.framing_tips) },
      categories: d.categories, countries: d.countries, creators_needed: d.creators, fee_per_creator_minor: feeMinor, deadline: d.deadline, license_term_days: d.term,
    });
    if (!r.ok || !r.data) { setBusy(null); return setError(r.error ?? 'The campaign could not be saved.'); }
    try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
    const id = r.data.id;
    if (!fund) { window.location.href = `/brand/campaigns/${id}`; return; }
    const pay = await payCampaign(id);
    if (!pay.ok) { window.location.href = `/brand/campaigns/${id}`; return; } // saved as a draft; payment can be retried there
    window.location.href = pay.data?.url ?? `/brand/campaigns/${id}?paid=1`;
  }

  const ok = [
    !!d.product && !!d.title,
    !!d.brief.goals && d.categories.length > 0 && d.countries.length > 0,
    !!charge && d.creators >= 1 && d.term >= LICENSE_TERM.minDays && d.term <= LICENSE_TERM.maxDays && !Number.isNaN(Date.parse(d.deadline)),
    !!charge && d.shots.shots.length > 0,
  ];
  return (
    <div className="max-w-3xl">
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" disabled={i > d.step && !ok.slice(0, i).every(Boolean)} onClick={() => set({ step: i })} aria-current={i === d.step ? 'step' : undefined} className="group block w-full text-left disabled:cursor-not-allowed">
              <span className={cn('block h-1 rounded-full transition-colors duration-base', i <= d.step ? 'bg-inverse' : 'bg-surface-3')} />
              <span className={cn('tabular mt-3 block text-caption', i === d.step ? 'text-primary' : 'text-tertiary')}>Step {i + 1}</span>
              <span className={cn('hidden truncate text-small sm:block', i === d.step ? 'font-medium text-primary' : 'text-secondary')}>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="p-6 md:p-8">
        {d.step === 0 && (
          <div className="space-y-5">
            <h2 className="text-h3">Paste your product link</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1"><Input id="url" label="Product page" type="url" placeholder="https://yourstore.com/products/…" value={d.url} onChange={(e) => set({ url: e.target.value })} /></div>
              <Button variant="secondary" onClick={extract} disabled={!d.url} loading={busy === 'extract'} className="h-input"><Sparkles size={16} {...ICON} />Draft from link</Button>
            </div>
            {note && <p className="text-small text-secondary">{note}</p>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Input id="product" label="Product name" value={d.product} onChange={(e) => set({ product: e.target.value })} />
              <Input id="title" label="Campaign title" value={d.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <Textarea id="desc" label="Description" value={d.brief.description} onChange={(e) => setBrief({ description: e.target.value })} />
            <ListField label="Key benefits" value={d.brief.key_benefits} onChange={(v) => setBrief({ key_benefits: v })} />
            {d.images.length > 0 && (
              <ul className="flex gap-3 overflow-x-auto" aria-label="Product images">
                {d.images.map((src) => (
                  <li key={src} className="relative shrink-0">
                    <ProductImage name={d.product || 'Product'} src={src} radius="sm" className="w-20" />
                    <button type="button" aria-label="Remove image" className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-scrim text-on-media" onClick={() => set({ images: d.images.filter((i) => i !== src) })}><Trash2 size={12} {...ICON} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {d.step === 1 && (
          <div className="space-y-5">
            <h2 className="text-h3">Write the brief</h2>
            <Textarea id="goals" label="Goals" placeholder="What should these ads achieve?" value={d.brief.goals} onChange={(e) => setBrief({ goals: e.target.value })} />
            <div className="grid gap-5 sm:grid-cols-2">
              <ListField label="Must say" value={d.brief.must_say} onChange={(v) => setBrief({ must_say: v })} />
              <ListField label="Must not say" value={d.brief.must_not_say} onChange={(v) => setBrief({ must_not_say: v })} hint="Hooks and edits never add product claims of their own." />
            </div>
            <Input id="aud" label="Audience" placeholder="Who is this for?" value={d.brief.target_audience} onChange={(e) => setBrief({ target_audience: e.target.value })} />
            <div><span className="label">Categories</span><div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={d.categories.includes(c)} disabled={!d.categories.includes(c) && d.categories.length >= 4} className="chip disabled:opacity-40" onClick={() => set({ categories: toggle(d.categories, c) })}>{categoryLabel(c)}</button>)}</div></div>
            <div><span className="label">Creator countries</span><div className="flex flex-wrap gap-2">{Object.keys(COUNTRIES).map((code) => <button key={code} type="button" aria-pressed={d.countries.includes(code)} className="chip" onClick={() => set({ countries: toggle(d.countries, code) })}><Flag code={code} />{countryName(code)}</button>)}</div></div>
            <label className="flex items-start gap-3 text-small">
              <input type="checkbox" className="mt-1 size-4 accent-accent" checked={d.brief.uses_ai_likeness} onChange={(e) => setBrief({ uses_ai_likeness: e.target.checked })} />
              <span className="text-secondary"><span className="text-primary">Allow AI scene and language versions.</span> Uses the creator’s likeness and voice only with their consent for this campaign. Those variants are marked AI-edited.</span>
            </label>
            <div className="border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="text-body font-medium">Creator shot list</div><p className="mt-1 text-small text-secondary">What the creator sees while filming their one take. Drafted from your brief; edit anything.</p></div>
                <Button variant="secondary" size="sm" onClick={genShots} disabled={!d.product} loading={busy === 'shots'}><Sparkles size={16} {...ICON} />{d.shots.shots.length ? 'Draft again' : 'Draft now'}</Button>
              </div>
              <div className="mt-4 space-y-3">
                {d.shots.shots.map((s, i) => {
                  const upd = (patch: Partial<typeof s>) => set({ shots: { ...d.shots, shots: d.shots.shots.map((x, k) => (k === i ? { ...x, ...patch } : x)) } });
                  return (
                    <div key={i} className="grid gap-2 rounded-md border border-border bg-surface-2 p-3 sm:grid-cols-shot-row">
                      <input aria-label={`Shot ${i + 1} title`} className="input" value={s.title} onChange={(e) => upd({ title: e.target.value })} />
                      <input aria-label={`Shot ${i + 1} direction`} className="input" value={s.direction} onChange={(e) => upd({ direction: e.target.value })} />
                      <input aria-label={`Shot ${i + 1} seconds`} className="input tabular" type="number" min={1} value={s.seconds} onChange={(e) => upd({ seconds: Number(e.target.value) || 1 })} />
                      <button type="button" aria-label={`Remove shot ${i + 1}`} className="grid size-input place-items-center rounded-sm text-secondary transition-colors duration-fast hover:text-danger-text" onClick={() => set({ shots: { ...d.shots, shots: d.shots.shots.filter((_, k) => k !== i) } })}><Trash2 size={16} {...ICON} /></button>
                    </div>
                  );
                })}
                {d.shots.shots.length > 0 && <Button variant="ghost" size="sm" onClick={() => set({ shots: { ...d.shots, shots: [...d.shots.shots, { title: 'New shot', direction: '', seconds: 8 }] } })}><Plus size={16} {...ICON} />Add shot</Button>}
              </div>
            </div>
          </div>
        )}

        {d.step === 2 && (
          <div className="space-y-5">
            <h2 className="text-h3">Creators and budget</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input id="creators" label="Number of creators" className="tabular" type="number" min={1} max={100} value={d.creators} onChange={(e) => set({ creators: Math.min(100, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} helper={`Each delivers up to ten variants; ${includedVariants} are included per creator.`} />
              <Input id="fee" label={`Fee per creator (${brand.currency})`} className="tabular" inputMode="decimal" value={d.fee} onChange={(e) => set({ fee: e.target.value.replace(/[^\d.]/g, '') })} helper={`Typical range: ${money(range[0] * 10 ** decimals)} to ${money(range[1] * 10 ** decimals)}.`} />
              <div>
                <label className="label" htmlFor="term">Licence term · {pluralise(d.term, 'day')}</label>
                <input id="term" type="range" min={LICENSE_TERM.minDays} max={LICENSE_TERM.maxDays} step={1} value={d.term} onChange={(e) => set({ term: Number(e.target.value) })} className="h-input w-full accent-accent" aria-valuetext={pluralise(d.term, 'day')} />
                <p className="helper">Paid-ad usage for each selected variant, {LICENSE_TERM.minDays} to {LICENSE_TERM.maxDays} days. Renewals add the same again.</p>
              </div>
              <Input id="deadline" label="Deadline" type="date" value={d.deadline} onChange={(e) => set({ deadline: e.target.value })} helper="When creators must submit by." />
            </div>
          </div>
        )}

        {d.step === 3 && charge && (
          <div className="space-y-6">
            <h2 className="text-h3">Review and fund escrow</h2>
            <dl className="grid gap-5 text-small sm:grid-cols-2">
              {([['Campaign', d.title], ['Product', d.product], ['Creators', `${pluralise(d.creators, 'creator')} · ${d.countries.map(countryName).join(', ')}`], ['Categories', d.categories.map(categoryLabel).join(', ')], ['Licence term', pluralise(d.term, 'day')], ['Deadline', fmtDate(d.deadline)], ['Shot list', pluralise(d.shots.shots.length, 'shot')], ['Included', `Up to ${includedVariants} variants per creator`]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-caption text-tertiary">{k}</dt><dd className="mt-1">{v}</dd></div>
              ))}
            </dl>
            <div className="rounded-md border border-border bg-surface-2 p-5">
              <dl className="tabular space-y-2 text-small">
                <div className="flex justify-between"><dt className="text-secondary">{d.creators} × {money(feeMinor)}</dt><dd>{money(charge.grossMinor)}</dd></div>
                <div className="flex items-baseline justify-between border-t border-border pt-3"><dt className="text-body font-medium">Total into escrow</dt><dd className="text-stat-sm">{money(charge.payableMinor)}</dd></div>
              </dl>
              <p className="mt-3 text-small text-secondary">Creators keep 75% ({money(charge.creatorPoolMinor)}); TakeOne’s fee is 25% ({money(charge.platformFeeMinor)}). Held until you approve each creator’s work.</p>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-5 text-small text-danger-text">{error}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {d.step > 0 && <Button variant="ghost" onClick={() => set({ step: d.step - 1 })}><ArrowLeft size={16} {...ICON} />Back</Button>}
          <span className="text-caption text-tertiary" role="status">{savedAt && <><Check size={12} {...ICON} className="mr-1 inline" aria-hidden />Draft saved {savedAt}</>}</span>
          <span className="flex-1" />
          {d.step < 3 ? <Button onClick={next} disabled={!ok[d.step]} loading={d.step === 1 && busy === 'shots'}>Continue<ArrowRight size={16} {...ICON} /></Button> : (
            <>
              <Button variant="secondary" onClick={() => save(false)} loading={busy === 'draft'} disabled={!ok.every(Boolean) || busy === 'fund'}>Save as draft</Button>
              <Button onClick={() => save(true)} loading={busy === 'fund'} disabled={!ok.every(Boolean) || busy === 'draft'}>Fund escrow{charge ? ` · ${money(charge.payableMinor)}` : ''}</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
