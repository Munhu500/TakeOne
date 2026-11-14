'use client';
import { useState } from 'react';
import { rpc } from '@/lib/actions';
import { Button } from '@/components/ui';

export function OnboardingForm({ kind, countries, platform, termsVersion }: { kind: 'brand' | 'agency'; countries: { code: string; name: string; currency: string }[]; platform: string; termsVersion: string }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('IN');
  const [subdomain, setSubdomain] = useState('');
  const [color, setColor] = useState('#7C5CFF');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = kind === 'brand'
      ? await rpc('create_brand', { p_name: name, p_country: country, p_accept_terms: accept })
      : await rpc('create_agency', { p_name: name, p_subdomain: subdomain.toLowerCase(), p_color: color, p_country: country, p_accept_terms: accept });
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not save'); else window.location.href = '/dashboard';
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div><label className="label" htmlFor="n">{kind === 'brand' ? 'Brand name' : 'Agency display name'}</label><input id="n" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div>
        <label className="label" htmlFor="c">Country</label>
        <select id="c" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.currency}</option>)}</select>
      </div>
      {kind === 'agency' && (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div><label className="label" htmlFor="s">Custom domain for your clients</label><input id="s" className="input" required placeholder="creators.youragency.com" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} /></div>
          <div><label className="label" htmlFor="col">Brand colour</label><input id="col" type="color" className="h-[42px] w-16 rounded-xl border border-line bg-raised" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
      )}
      <label className="flex items-start gap-3 rounded-xl border border-line bg-raised p-3.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
        <span className="text-muted"><span className="font-medium text-fg">Non-circumvention.</span> I agree not to contact, contract or pay creators introduced through {platform} outside the platform for 12 months, and that creator contact details are never shared. <span className="text-faint">Terms v{termsVersion}; your acceptance is recorded with a timestamp.</span></span>
      </label>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button type="submit" disabled={busy || !accept} className="w-full">Continue</Button>
    </form>
  );
}
