'use client';
import { useState } from 'react';
import { DEFAULT_ACCENT } from '@takeone/design-tokens';
import { rpc } from '@/lib/actions';
import { Button, Checkbox, Flag, Input } from '@/components/ui';
import { Select } from '@/components/ui/select';

export function OnboardingForm({ kind, countries, platform, termsVersion }: { kind: 'brand' | 'agency'; countries: { code: string; name: string; currency: string }[]; platform: string; termsVersion: string }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('IN');
  const [subdomain, setSubdomain] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_ACCENT);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = kind === 'brand'
      ? await rpc('create_brand', { p_name: name, p_country: country, p_accept_terms: accept })
      : await rpc('create_agency', { p_name: name, p_subdomain: subdomain.toLowerCase(), p_color: color, p_country: country, p_accept_terms: accept });
    if (!r.ok) { setBusy(false); setError(r.error ?? 'Could not save'); } else window.location.href = '/dashboard';
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Input id="n" label={kind === 'brand' ? 'Brand name' : 'Agency display name'} required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
      <Select id="c" label="Country" value={country} onValueChange={setCountry} options={countries.map((c) => ({ value: c.code, label: `${c.name} · ${c.currency}`, icon: <Flag code={c.code} /> }))} />
      {kind === 'agency' && (
        <div className="grid grid-cols-fill-auto gap-3">
          <Input id="s" label="Custom domain for your clients" required placeholder="creators.youragency.com" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
          <div><label className="label" htmlFor="col">Brand colour</label><input id="col" type="color" className="h-input w-16 rounded-sm border border-border bg-surface-2" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
      )}
      <Checkbox id="terms" checked={accept} onChange={setAccept} required>
        <span className="font-medium text-primary">Non-circumvention.</span> I agree not to contact, contract or pay creators introduced through {platform} outside the platform for 12 months, and that creator contact details are never shared. <span className="text-tertiary">Terms v{termsVersion}; your acceptance is recorded with a timestamp.</span>
      </Checkbox>
      {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
      <Button type="submit" size="lg" loading={busy} disabled={!accept} className="w-full">Continue</Button>
    </form>
  );
}
