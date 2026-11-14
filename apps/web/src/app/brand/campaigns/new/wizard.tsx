'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { campaignCharge, CATEGORIES, COUNTRIES, CREDITS_ENABLED, CURRENCIES, LICENSE_DEFAULTS, type Brief, type CurrencyCode, type ShotList } from '@takeone/shared';
import { saveCampaign } from '@/lib/actions';
import { draftProduct, draftShotList } from '@/lib/ai';
import { Badge, Button, Card, Flag, ICON } from '@/components/ui';
import { cn, money as fmtMoney } from '@/lib/utils';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const EMPTY_SHOTS: ShotList = { shots: [], talking_points: [], framing_tips: [] };

function ListField({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const id = label.toLowerCase().replace(/\W+/g, '-');
  return (
    <div>
      <label className="label" htmlFor={id}>{label} <span className="text-tertiary">· one per line</span></label>
      <textarea id={id} className="input min-h-24" value={value.join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} onBlur={(e) => onChange(lines(e.target.value))} />
      {hint && <p className="mt-1 text-caption text-tertiary">{hint}</p>}
    </div>
  );
}

export function CampaignWizard({ brand, creditMinor, includedVariants }: { brand: { id: string; country: string; currency: string }; creditMinor: number; includedVariants: number }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [product, setProduct] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [brief, setBrief] = useState<Brief>({ description: '', key_benefits: [], goals: '', key_messages: [], must_say: [], must_not_say: [], target_audience: '', uses_ai_likeness: true });
  const [shots, setShots] = useState<ShotList>(EMPTY_SHOTS);
  const [shotBusy, setShotBusy] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([brand.country]);
  const [creators, setCreators] = useState(3);
  const [fee, setFee] = useState(brand.currency === 'INR' ? '15000' : brand.currency === 'AED' ? '1500' : '400');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decimals = CURRENCIES[brand.currency as CurrencyCode]?.decimals ?? 2;
  const feeMinor = Math.round(Number(fee || 0) * 10 ** decimals); // major units typed by a person → integer minor units, once, at the edge
  const charge = useMemo(() => (feeMinor >= 100 && creators >= 1 ? campaignCharge(feeMinor, creators, creditMinor) : null), [feeMinor, creators, creditMinor]);
  const money = (m: number) => fmtMoney(m, brand.currency);

  async function extract() {
    setExtracting(true); setNote(null); setError(null);
    const r = await draftProduct(url);
    setExtracting(false);
    if (!r.ok) return setError(r.error);
    const p = r.data;
    setProduct(p.product_name); setTitle((t) => t || `${p.product_name} launch`); setImages(p.images);
    setBrief((b) => ({ ...b, description: p.description, key_benefits: p.key_benefits, key_messages: b.key_messages.length ? b.key_messages : p.key_benefits.slice(0, 3), must_say: b.must_say.length ? b.must_say : [p.product_name] }));
    setNote(r.provider === 'mock' ? 'Demo mode filled in a starter draft. With an Anthropic API key the page content is read for you.' : r.fetched ? 'Drafted from the page. Check every line before you publish.' : 'The page could not be fetched, so this is a starter draft.');
  }
  async function genShots() {
    setShotBusy(true); setError(null);
    const r = await draftShotList(product, { ...brief, key_benefits: lines(brief.key_benefits.join('\n')) });
    setShotBusy(false);
    if (!r.ok) return setError(r.error);
    setShots(r.data);
  }
  async function save() {
    setSaving(true); setError(null);
    const clean = (a: string[]) => lines(a.join('\n'));
    const r = await saveCampaign({
      brand_id: brand.id, title, product_name: product, product_url: url, product_images: images,
      brief: { ...brief, key_benefits: clean(brief.key_benefits), key_messages: clean(brief.key_messages), must_say: clean(brief.must_say), must_not_say: clean(brief.must_not_say) },
      shot_list: { ...shots, talking_points: clean(shots.talking_points), framing_tips: clean(shots.framing_tips) },
      categories, countries, creators_needed: creators, fee_per_creator_minor: feeMinor, deadline,
    });
    setSaving(false);
    if (!r.ok || !r.data) return setError(r.error ?? 'Could not save');
    router.push(`/brand/campaigns/${r.data.id}`);
  }
  const toggle = (list: string[], v: string, set: (l: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (on: boolean) => cn('chip', on && 'is-on');

  return (
    <div className="grid gap-6 lg:grid-cols-main-aside">
      <div className="space-y-6">
        <Card>
          <h2 className="text-h3">1 · Product</h2>
          <label className="label mt-4" htmlFor="url">Product page URL</label>
          <div className="flex gap-2">
            <input id="url" className="input" type="url" placeholder="https://yourstore.com/products/…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button onClick={extract} disabled={!url || extracting} className="shrink-0">{extracting ? <Loader2 size={16} {...ICON} className="animate-spin" /> : <Sparkles size={16} {...ICON} />}Draft from link</Button>
          </div>
          {note && <p className="mt-2 text-caption text-secondary">{note}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="product">Product name</label><input id="product" className="input" value={product} onChange={(e) => setProduct(e.target.value)} /></div>
            <div><label className="label" htmlFor="title">Campaign title</label><input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          </div>
          <div className="mt-4"><label className="label" htmlFor="desc">Description</label><textarea id="desc" className="input min-h-24" value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })} /></div>
          {images.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {images.map((src) => (
                <div key={src} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="Product" className="h-24 w-20 rounded-sm object-cover" />
                  <button aria-label="Remove image" className="absolute right-1 top-1 rounded-full bg-scrim p-1 text-on-media" onClick={() => setImages(images.filter((i) => i !== src))}><Trash2 size={16} {...ICON} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-h3">2 · Brief</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label" htmlFor="goals">Goals</label><textarea id="goals" className="input" value={brief.goals} onChange={(e) => setBrief({ ...brief, goals: e.target.value })} /></div>
            <ListField label="Key benefits" value={brief.key_benefits} onChange={(v) => setBrief({ ...brief, key_benefits: v })} />
            <ListField label="Key messages" value={brief.key_messages} onChange={(v) => setBrief({ ...brief, key_messages: v })} />
            <ListField label="Must say" value={brief.must_say} onChange={(v) => setBrief({ ...brief, must_say: v })} />
            <ListField label="Must not say" value={brief.must_not_say} onChange={(v) => setBrief({ ...brief, must_not_say: v })} hint="Hooks and edits never add product claims of their own." />
            <div className="sm:col-span-2"><label className="label" htmlFor="aud">Target audience</label><input id="aud" className="input" value={brief.target_audience} onChange={(e) => setBrief({ ...brief, target_audience: e.target.value })} /></div>
          </div>
          <label className="mt-4 flex items-start gap-3 text-small">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={brief.uses_ai_likeness} onChange={(e) => setBrief({ ...brief, uses_ai_likeness: e.target.checked })} />
            <span className="text-secondary"><span className="text-primary">Allow AI scene and language versions.</span> Uses the creator’s likeness and voice only with their consent for this campaign. Those variants carry an AI label.</span>
          </label>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h3">3 · Creator shot list</h2>
            <Button variant="secondary" size="sm" onClick={genShots} disabled={!product || shotBusy}>{shotBusy ? <Loader2 size={16} {...ICON} className="animate-spin" /> : <Sparkles size={16} {...ICON} />}{shots.shots.length ? 'Regenerate' : 'Generate from brief'}</Button>
          </div>
          <p className="mt-1 text-caption text-secondary">What the creator sees while shooting their one take. Edit anything.</p>
          <div className="mt-4 space-y-3">
            {shots.shots.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-sm border border-border bg-surface-2 p-3 sm:grid-cols-shot-row">
                <input aria-label="Shot title" className="input" value={s.title} onChange={(e) => setShots({ ...shots, shots: shots.shots.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
                <input aria-label="Direction" className="input" value={s.direction} onChange={(e) => setShots({ ...shots, shots: shots.shots.map((x, k) => (k === i ? { ...x, direction: e.target.value } : x)) })} />
                <input aria-label="Seconds" className="input tabular" type="number" min={1} value={s.seconds} onChange={(e) => setShots({ ...shots, shots: shots.shots.map((x, k) => (k === i ? { ...x, seconds: Number(e.target.value) || 1 } : x)) })} />
                <button aria-label="Remove shot" className="px-2 text-secondary hover:text-danger-text" onClick={() => setShots({ ...shots, shots: shots.shots.filter((_, k) => k !== i) })}><Trash2 size={16} {...ICON} /></button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setShots({ ...shots, shots: [...shots.shots, { title: 'New shot', direction: '', seconds: 8 }] })}><Plus size={16} {...ICON} />Add shot</Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ListField label="Talking points" value={shots.talking_points} onChange={(v) => setShots({ ...shots, talking_points: v })} />
            <ListField label="Framing tips" value={shots.framing_tips} onChange={(v) => setShots({ ...shots, framing_tips: v })} />
          </div>
        </Card>
        <Card>
          <h2 className="text-h3">4 · Creators and budget</h2>
          <div className="mt-4"><span className="label">Categories</span><div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} aria-pressed={categories.includes(c)} className={chip(categories.includes(c))} onClick={() => toggle(categories, c, setCategories)}>{c}</button>)}</div></div>
          <div className="mt-4"><span className="label">Creator countries</span><div className="flex flex-wrap gap-2">{Object.entries(COUNTRIES).map(([code, c]) => <button key={code} aria-pressed={countries.includes(code)} className={chip(countries.includes(code))} onClick={() => toggle(countries, code, setCountries)}><Flag code={code} />{c.name}</button>)}</div></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><label className="label" htmlFor="creators">Number of creators</label><input id="creators" className="input tabular" type="number" min={1} max={100} value={creators} onChange={(e) => setCreators(Math.max(1, Math.round(Number(e.target.value)) || 1))} /></div>
            <div><label className="label" htmlFor="fee">Budget per creator ({brand.currency})</label><input id="fee" className="input tabular" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))} /></div>
            <div><label className="label" htmlFor="deadline">Deadline</label><input id="deadline" className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          </div>
        </Card>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <div className="text-small font-medium">Escrow summary</div>
          {charge ? (
            <dl className="tabular mt-4 space-y-2 text-small">
              <div className="flex justify-between"><dt className="text-secondary">{creators} × {money(feeMinor)}</dt><dd>{money(charge.grossMinor)}</dd></div>
              <div className="flex justify-between text-caption"><dt className="text-tertiary">Creators receive (75%)</dt><dd className="text-tertiary">{money(charge.creatorPoolMinor)}</dd></div>
              <div className="flex justify-between text-caption"><dt className="text-tertiary">Platform fee (25%)</dt><dd className="text-tertiary">{money(charge.platformFeeMinor)}</dd></div>
              {CREDITS_ENABLED && charge.creditAppliedMinor > 0 && <div className="flex justify-between text-success-text"><dt>Campaign credit</dt><dd>−{money(charge.creditAppliedMinor)}</dd></div>}
              <div className="flex justify-between border-t border-border pt-3 text-body font-semibold"><dt>You pay into escrow</dt><dd>{money(charge.payableMinor)}</dd></div>
            </dl>
          ) : <p className="mt-3 text-small text-secondary">Enter a budget to see the total.</p>}
          {CREDITS_ENABLED && charge && charge.creditAppliedMinor > 0 && <p className="mt-3 text-caption text-secondary">Credit only reduces the platform fee. Creator payouts stay the same.</p>}
          <ul className="mt-4 space-y-2 text-caption text-secondary">
            <li>Includes up to {includedVariants} selected variants per creator</li>
            <li>{LICENSE_DEFAULTS.termDays} days of paid-ad usage on Meta, TikTok and YouTube, renewable</li>
            <li>Perpetual organic use on your own channels</li>
            <li>Held in escrow until you approve, or 5 days after delivery</li>
          </ul>
          {error && <p role="alert" className="mt-4 text-small text-danger-text">{error}</p>}
          <Button className="mt-5 w-full" onClick={save} disabled={saving || !charge || !title || !product || !categories.length || !shots.shots.length}>{saving && <Loader2 size={16} {...ICON} className="animate-spin" />}Save and continue to payment</Button>
          {!shots.shots.length && <p className="mt-2 text-center text-caption text-tertiary">Generate the shot list to continue.</p>}
          <div className="mt-3 text-center"><Badge>Saved as a draft until paid</Badge></div>
        </Card>
      </aside>
    </div>
  );
}
