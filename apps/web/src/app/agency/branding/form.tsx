'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateAgencyBranding } from '@/lib/actions';
import { Button, Card } from '@/components/ui';
import { deriveAccent } from '@takeone/design-tokens';

export function BrandingForm({ agency }: { agency: { id: string; name: string; logo: string | null; primary_color: string; subdomain: string; markup_default_bps: number } }) {
  const router = useRouter();
  const [f, setF] = useState({ ...agency, markup: String(agency.markup_default_bps / 100) });
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // the generated variants the live theme uses, so the preview label is always legible on the chosen accent
  const accent = deriveAccent(/^#[0-9a-fA-F]{6}$/.test(f.primary_color) ? f.primary_color : agency.primary_color, 'dark');
  return (
    <div className="grid gap-6 lg:grid-cols-main-aside">
      <Card>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const r = await updateAgencyBranding(agency.id, { name: f.name, logo: f.logo || null, primary_color: f.primary_color, subdomain: f.subdomain.toLowerCase(), markup_default_bps: Math.round(Number(f.markup) * 100) });
          setBusy(false); setState({ ok: r.ok, text: r.ok ? 'Saved. Clients see the change on their next page load.' : r.error ?? 'Not saved' });
          if (r.ok) router.refresh();
        }}>
          <div><label className="label" htmlFor="bn">Display name</label><input id="bn" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="bl">Logo URL</label><input id="bl" className="input" placeholder="https://…/logo.png" value={f.logo ?? ''} onChange={(e) => setF({ ...f, logo: e.target.value })} /></div>
          <div className="grid grid-cols-auto-fill items-end gap-3">
            <div><label className="label" htmlFor="bc">Primary colour</label><input id="bc" type="color" className="h-input w-16 rounded-sm border border-border bg-surface-2" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /></div>
            <div><label className="label" htmlFor="bd">Custom domain</label><input id="bd" className="input" value={f.subdomain} onChange={(e) => setF({ ...f, subdomain: e.target.value })} /></div>
          </div>
          <p className="text-caption text-tertiary">Point this domain at the app (CNAME). Requests arriving on it are themed for your agency before sign-in.</p>
          <div><label className="label" htmlFor="bm">Default markup on client invoices (%)</label><input id="bm" className="input tabular w-32" inputMode="decimal" value={f.markup} onChange={(e) => setF({ ...f, markup: e.target.value })} /></div>
          {state && <p role="status" className={state.ok ? 'text-small text-success-text' : 'text-small text-danger-text'}>{state.text}</p>}
          <Button type="submit" loading={busy}>Save branding</Button>
        </form>
      </Card>
      <Card>
        <div className="caption-label">Preview</div>
        <div className="mt-3 rounded-sm border border-border bg-bg p-5">
          <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-sm text-small font-semibold" style={{ background: accent.accent, color: accent['on-accent'] }}>{f.name[0]}</span>{f.name}</div>
          <div className="mt-5 text-small text-secondary">Sign in to your campaign workspace</div>
          <div className="mt-3 rounded-sm px-4 py-3 text-center text-small font-medium" style={{ background: accent.accent, color: accent['on-accent'] }}>Sign in</div>
          <div className="mt-4 text-center text-caption text-tertiary">https://{f.subdomain}</div>
        </div>
      </Card>
    </div>
  );
}
