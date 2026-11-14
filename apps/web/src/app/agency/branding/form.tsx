'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateAgencyBranding } from '@/lib/actions';
import { Button, Card } from '@/components/ui';

export function BrandingForm({ agency }: { agency: { id: string; name: string; logo: string | null; primary_color: string; subdomain: string; markup_default_bps: number } }) {
  const router = useRouter();
  const [f, setF] = useState({ ...agency, markup: String(agency.markup_default_bps / 100) });
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const r = await updateAgencyBranding(agency.id, { name: f.name, logo: f.logo || null, primary_color: f.primary_color, subdomain: f.subdomain.toLowerCase(), markup_default_bps: Math.round(Number(f.markup) * 100) });
          setBusy(false); setState({ ok: r.ok, text: r.ok ? 'Saved. Clients see the change on their next page load.' : r.error ?? 'Not saved' });
          if (r.ok) router.refresh();
        }}>
          <div><label className="label" htmlFor="bn">Display name</label><input id="bn" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="bl">Logo URL</label><input id="bl" className="input" placeholder="https://…/logo.png" value={f.logo ?? ''} onChange={(e) => setF({ ...f, logo: e.target.value })} /></div>
          <div className="grid grid-cols-[auto_1fr] items-end gap-3">
            <div><label className="label" htmlFor="bc">Primary colour</label><input id="bc" type="color" className="h-[42px] w-16 rounded-xl border border-line bg-raised" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /></div>
            <div><label className="label" htmlFor="bd">Custom domain</label><input id="bd" className="input" value={f.subdomain} onChange={(e) => setF({ ...f, subdomain: e.target.value })} /></div>
          </div>
          <p className="text-xs text-faint">Point this domain at the app (CNAME). Requests arriving on it are themed for your agency before sign-in.</p>
          <div><label className="label" htmlFor="bm">Default markup on client invoices (%)</label><input id="bm" className="input tabular w-32" inputMode="decimal" value={f.markup} onChange={(e) => setF({ ...f, markup: e.target.value })} /></div>
          {state && <p role="status" className={state.ok ? 'text-sm text-ok' : 'text-sm text-bad'}>{state.text}</p>}
          <Button type="submit" disabled={busy}>Save branding</Button>
        </form>
      </Card>
      <Card>
        <div className="text-xs text-faint">Preview</div>
        <div className="mt-3 rounded-xl border border-line bg-bg p-5">
          <div className="flex items-center gap-2 font-display font-semibold"><span className="grid h-7 w-7 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: f.primary_color }}>{f.name[0]}</span>{f.name}</div>
          <div className="mt-5 text-sm text-muted">Sign in to your campaign workspace</div>
          <div className="mt-3 rounded-xl px-4 py-2.5 text-center text-sm font-medium text-white" style={{ background: f.primary_color }}>Sign in</div>
          <div className="mt-4 text-center text-[11px] text-faint">https://{f.subdomain}</div>
        </div>
      </Card>
    </div>
  );
}
