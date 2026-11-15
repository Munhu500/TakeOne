'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { rpc, setActiveBrand, updateRow } from '@/lib/actions';
import { Button, Flag, ICON, Input } from '@/components/ui';
import { Drawer, Popover } from '@/components/ui/overlays';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

export function OpenWorkspace({ brandId }: { brandId: string }) {
  return <Button size="sm" variant="secondary" onClick={() => setActiveBrand(brandId)}>Open workspace</Button>;
}

/** "Markup 25%" with an Edit popover. */
export function MarkupEdit({ brandId, name, bps, isDefault }: { brandId: string; name: string; bps: number; isDefault: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(String(bps / 100));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Math.round(Number(pct) * 100);
    if (!Number.isInteger(v) || v < 0 || v > 20000) return setError('Enter a percentage from 0 to 200.');
    setBusy(true);
    const r = await updateRow('brands', { id: brandId }, { markup_bps: v }, '/agency');
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'The markup could not be saved.');
    setOpen(false); toast(`Markup for ${name} set to ${v / 100}%`); router.refresh();
  };
  return (
    <div className="tabular flex items-center gap-2 text-small">
      <span className="text-secondary">Markup {bps / 100}%{isDefault ? ' (default)' : ''}</span>
      <Popover open={open} onOpenChange={setOpen} className="w-72"
        trigger={<button type="button" className="text-accent-text underline-offset-4 hover:underline" aria-label={`Edit markup for ${name}`}>Edit</button>}>
        <form onSubmit={save} className="space-y-3">
          <Input id={`m-${brandId}`} label={`Markup on ${name}’s invoices (%)`} className="tabular" inputMode="decimal" value={pct} onChange={(e) => { setPct(e.target.value); setError(null); }} error={error} helper="Added on top of the standard price. Creators’ 75% is unaffected." />
          <Button type="submit" size="sm" loading={busy} className="w-full">Save markup</Button>
        </form>
      </Popover>
    </div>
  );
}

export function AddClient({ agencyId, defaultBps, countries, openInitially, label = 'Add client' }: { agencyId: string; defaultBps: number; countries: { code: string; name: string }[]; openInitially?: boolean; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!openInitially);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('AE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await rpc('create_client_brand', { p_agency_id: agencyId, p_name: name, p_country: country, p_markup_bps: null }, '/agency');
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'The client could not be added.');
    setOpen(false); toast(`${name} added`); setName(''); router.refresh();
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={16} {...ICON} />{label}</Button>
      <Drawer open={open} onOpenChange={setOpen} title="Add a client">
        <form id="add-client" onSubmit={submit} className="space-y-5">
          <Input id="cn" label="Client brand name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} error={error} />
          <Select id="cc" label="Country" value={country} onValueChange={setCountry} options={countries.map((c) => ({ value: c.code, label: c.name, icon: <Flag code={c.code} /> }))} helper="Sets the currency the client is billed in." />
          <p className="text-small text-secondary">The workspace starts at your default markup of {(defaultBps / 100).toFixed(0)}%. You can change it per client at any time.</p>
          <Button type="submit" loading={busy}>Create workspace</Button>
        </form>
      </Drawer>
    </>
  );
}
