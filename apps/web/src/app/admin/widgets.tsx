'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { rpc, signedUrl, updateRow } from '@/lib/actions';
import { ActionButton } from '@/components/client';
import { Badge, Button, ICON, VideoFrame } from '@/components/ui';
import { Select } from '@/components/ui/select';

export function QaCard({ id, title, video, poster, media, hook, score, reason, synthetic, meta, mustNot }: { id: string; title: string; video?: string; poster?: string; media?: string; hook: string | null; score: number | null; reason: string | null; synthetic: boolean; meta: string; mustNot: string[] }) {
  const [note, setNote] = useState('');
  return (
    <div className="card flex flex-col gap-3 p-3">
      <VideoFrame src={video ?? null} poster={poster ?? null} media={media} label={`${title} preview`} />
      <div><div className="flex items-center justify-between gap-2"><span className="text-small font-medium">{title}</span><span className="tabular text-caption text-secondary">Score {score ?? '—'}</span></div><div className="mt-1 text-caption text-tertiary">{meta}</div></div>
      {hook && <p className="text-caption text-secondary">Hook: “{hook}”</p>}
      {reason && <p className="text-caption leading-normal text-tertiary">{reason}</p>}
      {synthetic && <Badge tone="warning"><Sparkles size={16} {...ICON} />AI-assisted · label required</Badge>}
      {mustNot.length > 0 && <p className="text-caption text-tertiary">Check against “must not say”: {mustNot.join('; ')}</p>}
      <input className="input py-2 text-caption" placeholder="Note for the creator (if rejecting)" aria-label="QA note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-auto grid grid-cols-2 gap-2">
        <ActionButton size="sm" variant="destructive" className="w-full" action={() => rpc('qa_review', { p_variant_id: id, p_approve: false, p_note: note || 'Does not meet the brief or format rules' }, '/admin')}>Reject</ActionButton>
        <ActionButton size="sm" className="w-full" action={() => rpc('qa_review', { p_variant_id: id, p_approve: true, p_note: note || null }, '/admin')}>Approve</ActionButton>
      </div>
    </div>
  );
}

export function ScreenRecordingLink({ path, code }: { path: string; code: string | null }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-1">
      <button className="text-accent-text hover:underline" onClick={async () => { const r = await signedUrl('verification', path); if (r.ok && r.data) window.open(r.data, '_blank'); else setErr('Recording file is not available in the demo data'); }}>Insights screen recording</button>
      {code && <div className="text-tertiary">on-screen code <code className="rounded-sm bg-surface-2 px-2 py-1">{code}</code></div>}
      {err && <div className="text-warning-text">{err}</div>}
    </div>
  );
}

export function DisputeActions({ id }: { id: string }) {
  const [note, setNote] = useState('');
  const act = (status: string) => () => rpc('admin_resolve_dispute', { p_dispute_id: id, p_status: status, p_resolution: note || titleFor(status) }, '/admin');
  return (
    <div className="w-full max-w-sm space-y-2">
      <input className="input py-2 text-caption" placeholder="Resolution note" aria-label="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <ActionButton size="sm" action={act('resolved_creator')} confirm="Approve the submission and release the creator's payment?">Release to creator</ActionButton>
        <ActionButton size="sm" variant="secondary" action={act('resolved_brand')}>Side with brand</ActionButton>
        <ActionButton size="sm" variant="destructive" action={act('refunded')} confirm="Refund this creator slot to the brand? The creator's pending earning is removed.">Refund brand</ActionButton>
      </div>
    </div>
  );
}
const titleFor = (s: string) => ({ resolved_creator: 'Submission approved by support', resolved_brand: 'Resolved in favour of the brand', refunded: 'Slot refunded to the brand' }[s] ?? s);

export function CreditForm({ brands }: { brands: { id: string; name: string; currency: string }[] }) {
  const [brand, setBrand] = useState(brands[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('60');
  const cur = brands.find((b) => b.id === brand)?.currency ?? '';
  return (
    <div className="mt-4 space-y-3">
      <Select id="cb" label="Brand" value={brand} onValueChange={setBrand} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="ca">Amount ({cur})</label><input id="ca" className="input tabular" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div>
        <div><label className="label" htmlFor="cd">Valid for (days)</label><input id="cd" className="input tabular" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} /></div>
      </div>
      <ActionButton disabled={!brand || !Number(amount)} action={() => rpc('admin_issue_credit', { p_brand_id: brand, p_amount_minor: Math.round(Number(amount) * 100), p_days: Number(days) || 60 }, '/admin')} onDone={() => setAmount('')}>Issue credit</ActionButton>
    </div>
  );
}

export function SettingForm({ k, kind, value, label }: { k: string; kind: 'number' | 'json'; value: unknown; label: string }) {
  const router = useRouter();
  const [text, setText] = useState(kind === 'json' ? JSON.stringify(value ?? {}, null, 2) : String(value ?? ''));
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    let parsed: unknown;
    try { parsed = kind === 'number' ? Number(text) : JSON.parse(text); } catch { return setState({ ok: false, text: 'Not valid JSON' }); }
    if (kind === 'number' && (!Number.isInteger(parsed) || (parsed as number) < 0)) return setState({ ok: false, text: 'Enter a whole number' });
    const r = await updateRow('settings', { key: k }, { value: parsed }, '/admin');
    setState({ ok: r.ok, text: r.ok ? 'Saved' : r.error ?? 'Not saved' });
    if (r.ok) router.refresh();
  };
  return (
    <div className="mt-4">
      <label className="label" htmlFor={`s-${k}`}>{label}</label>
      {kind === 'json' ? <textarea id={`s-${k}`} className="input min-h-24 font-mono text-caption" value={text} onChange={(e) => setText(e.target.value)} /> : <input id={`s-${k}`} className="input tabular w-40" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} />}
      <div className="mt-2 flex items-center gap-3"><Button size="sm" variant="secondary" onClick={save}>Save</Button>{state && <span role="status" className={state.ok ? 'text-caption text-success-text' : 'text-caption text-danger-text'}>{state.text}</span>}</div>
    </div>
  );
}

export function FxForm({ rates }: { rates: { currency: string; rate: string; updated: string }[] }) {
  const router = useRouter();
  const [vals, setVals] = useState(Object.fromEntries(rates.map((r) => [r.currency, r.rate])));
  const [state, setState] = useState<string | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-end gap-4">
      {rates.map((r) => (
        <div key={r.currency}><label className="label" htmlFor={`fx-${r.currency}`}>1 {r.currency} in USD <span className="text-tertiary">· {r.updated}</span></label><input id={`fx-${r.currency}`} className="input tabular w-36" inputMode="decimal" disabled={r.currency === 'USD'} value={vals[r.currency]} onChange={(e) => setVals({ ...vals, [r.currency]: e.target.value })} /></div>
      ))}
      <Button variant="secondary" onClick={async () => {
        for (const r of rates) {
          const n = Number(vals[r.currency]);
          if (r.currency === 'USD' || vals[r.currency] === r.rate) continue;
          if (!(n > 0)) return setState(`Invalid rate for ${r.currency}`);
          const res = await updateRow('fx_rates', { currency: r.currency }, { rate_to_usd: n }, '/admin');
          if (!res.ok) return setState(res.error ?? 'Not saved');
        }
        setState('Saved'); router.refresh();
      }}>Save rates</Button>
      {state && <span role="status" className="pb-2 text-caption text-secondary">{state}</span>}
    </div>
  );
}

export function RunJobs() {
  const [out, setOut] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {out && <span className="text-caption text-secondary" role="status">{out}</span>}
      <ActionButton variant="secondary" action={() => rpc('run_scheduled_jobs', {}, '/admin')} onDone={(r) => { const d = r.data as Record<string, number>; setOut(`Auto-approved ${d.auto_approved} · made available ${d.made_available} · reminders ${d.renewal_reminders}`); }}>Run scheduled jobs now</ActionButton>
    </div>
  );
}
