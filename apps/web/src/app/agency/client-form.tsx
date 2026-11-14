'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rpc, setActiveBrand, updateRow } from '@/lib/actions';
import { Button } from '@/components/ui';

export function OpenWorkspace({ brandId }: { brandId: string }) {
  return <Button variant="secondary" onClick={() => setActiveBrand(brandId)}>Open workspace</Button>;
}

export function MarkupField({ brandId, bps, isDefault }: { brandId: string; bps: number; isDefault: boolean }) {
  const router = useRouter();
  const [pct, setPct] = useState(String(bps / 100));
  const [state, setState] = useState<string | null>(null);
  const save = async () => {
    const v = Math.round(Number(pct) * 100);
    if (!Number.isInteger(v) || v < 0 || v > 20000) return setState('Enter 0–200');
    const r = await updateRow('brands', { id: brandId }, { markup_bps: v }, '/agency');
    setState(r.ok ? 'Saved' : r.error ?? 'Not saved');
    if (r.ok) router.refresh();
  };
  return (
    <div>
      <label className="label" htmlFor={`m-${brandId}`}>Your markup on client invoices{isDefault ? ' (agency default)' : ''}</label>
      <div className="flex items-center gap-2"><input id={`m-${brandId}`} className="input tabular w-24" inputMode="decimal" value={pct} onChange={(e) => { setPct(e.target.value); setState(null); }} /><span className="text-sm text-muted">%</span><Button size="sm" variant="ghost" onClick={save}>Save</Button>{state && <span className="text-xs text-muted" role="status">{state}</span>}</div>
    </div>
  );
}

export function ClientForm({ agencyId, defaultBps, countries }: { agencyId: string; defaultBps: number; countries: { code: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('AE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-4 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      const r = await rpc('create_client_brand', { p_agency_id: agencyId, p_name: name, p_country: country, p_markup_bps: null }, '/agency');
      setBusy(false);
      if (!r.ok) return setError(r.error ?? 'Could not add client');
      setName(''); router.refresh();
    }}>
      <div><label className="label" htmlFor="cn">Client brand name</label><input id="cn" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label className="label" htmlFor="cc">Country</label><select id="cc" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
      <p className="text-xs text-faint">Starts at your default markup of {(defaultBps / 100).toFixed(0)}%.</p>
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
      <Button type="submit" disabled={busy}>Create workspace</Button>
    </form>
  );
}
