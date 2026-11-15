'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Bell, Copy, ImageUp, Megaphone, Trophy } from 'lucide-react';
import { contrast, DEFAULT_ACCENT, deriveAccent } from '@takeone/design-tokens';
import { updateAgencyBranding } from '@/lib/actions';
import { checkDomain, type DomainStatus } from '@/lib/domain';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Avatar, Badge, Button, Card, ICON, Input } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { assetUrl, cn } from '@/lib/utils';

const HEX = /^#[0-9a-fA-F]{6}$/;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_BYTES = 1_000_000;

interface Props { agency: { id: string; name: string; logo: string | null; primary_color: string; subdomain: string; markup_default_bps: number }; userId: string; cnameTarget: string }

export function BrandingForm({ agency, userId, cnameTarget }: Props) {
  const router = useRouter();
  const [f, setF] = useState({ ...agency, markup: String(agency.markup_default_bps / 100) });
  const [hex, setHex] = useState(agency.primary_color.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dns, setDns] = useState<DomainStatus | 'checking' | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const colour = HEX.test(hex) ? hex : f.primary_color;
  // the same generated variants the live theme uses: only the accent changes, and labels stay legible
  const a = deriveAccent(colour, 'dark');
  const adjusted = a.accent.toUpperCase() !== colour.toUpperCase();
  const ratio = contrast(a['on-accent'], a.accent);

  async function upload(picked: File | undefined) {
    if (!picked) return;
    setError(null);
    if (!LOGO_TYPES.includes(picked.type)) return setError('Use a PNG, JPG, WebP or SVG file.');
    if (picked.size > MAX_LOGO_BYTES) return setError('Use a logo under 1 MB.');
    setUploading(true);
    // public-assets accepts uploads only under the signed-in user's own folder
    const path = `${userId}/agency-logo-${Date.now()}.${picked.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'}`;
    const { error: upErr } = await supabaseBrowser().storage.from('public-assets').upload(path, picked, { contentType: picked.type, upsert: false });
    setUploading(false);
    if (upErr) return setError(`The logo could not be uploaded: ${upErr.message}`);
    setF((x) => ({ ...x, logo: supabaseBrowser().storage.from('public-assets').getPublicUrl(path).data.publicUrl }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!HEX.test(hex)) return setError(`Enter the colour as a six-digit hex value, for example ${DEFAULT_ACCENT}.`);
    setBusy(true);
    const r = await updateAgencyBranding(agency.id, { name: f.name, logo: f.logo || null, primary_color: hex, subdomain: f.subdomain.toLowerCase().trim(), markup_default_bps: Math.round(Number(f.markup) * 100) });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Your branding could not be saved.');
    toast('Branding saved. Clients see it on their next page load.'); router.refresh();
  }
  async function verify() {
    setDns('checking');
    setDns(await checkDomain(f.subdomain.toLowerCase().trim(), cnameTarget));
  }
  const cname = `${f.subdomain.toLowerCase().trim() || 'your-domain'}  CNAME  ${cnameTarget}`;
  const logo = assetUrl(f.logo);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <form className="space-y-6" onSubmit={save}>
          <Input id="bn" label="Display name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />

          <div>
            <span className="label" id="logo-label">Logo</span>
            <div role="button" tabIndex={0} aria-labelledby="logo-label" aria-describedby="logo-help"
              onClick={() => file.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }}
              className={cn('flex cursor-pointer items-center gap-4 rounded-md border border-dashed p-4 transition-colors duration-fast', over ? 'border-accent-brand bg-accent-soft' : 'border-border-strong hover:bg-surface-2')}>
              {logo ? <Avatar name={f.name} src={f.logo} size="lg" square /> : <span className="grid size-12 place-items-center rounded-md bg-surface-2 text-secondary"><ImageUp size={24} {...ICON} aria-hidden /></span>}
              <div className="min-w-0 flex-1"><div className="text-small font-medium">{uploading ? 'Uploading…' : logo ? 'Replace logo' : 'Drop your logo here, or choose a file'}</div><div id="logo-help" className="text-caption text-tertiary">PNG, JPG, WebP or SVG, under 1 MB. Square works best.</div></div>
              {logo && <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setF({ ...f, logo: null }); }}>Remove</Button>}
            </div>
            <input ref={file} type="file" accept={LOGO_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          <div>
            <label className="label" htmlFor="bhex">Brand colour</label>
            <div className="flex items-center gap-3">
              <input type="color" aria-label="Pick a colour" className="size-input shrink-0 cursor-pointer rounded-sm border border-border bg-surface-2 p-1" value={colour} onChange={(e) => setHex(e.target.value.toUpperCase())} />
              <input id="bhex" className="input tabular w-40 font-mono uppercase" value={hex} maxLength={7} spellCheck={false} aria-invalid={!HEX.test(hex)} aria-describedby="colour-help" onChange={(e) => setHex(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} />
            </div>
            <p id="colour-help" role="status" className="helper">
              {!HEX.test(hex) ? `Enter a six-digit hex value, for example ${DEFAULT_ACCENT}.` : adjusted
                ? <>Buttons use a darker shade, <span className="font-mono text-secondary">{a.accent.toUpperCase()}</span>, so white labels stay readable ({ratio.toFixed(1)}:1). Your exact colour is kept for highlights.</>
                : <>White labels are readable on this colour ({ratio.toFixed(1)}:1). It is used as it is.</>}
            </p>
          </div>

          <div>
            <Input id="bd" label="Custom domain" placeholder="creators.youragency.com" value={f.subdomain} onChange={(e) => { setF({ ...f, subdomain: e.target.value }); setDns(null); }} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {dns === null ? <Badge>Not checked</Badge> : dns === 'checking' ? <Badge>Checking…</Badge> : dns === 'verified' ? <Badge tone="success">Verified</Badge> : dns === 'unavailable' ? <Badge>Cannot be checked in the preview</Badge> : <Badge tone="warning">DNS not detected</Badge>}
              <Button type="button" size="sm" variant="secondary" onClick={verify} disabled={!f.subdomain.trim() || dns === 'checking'}>Check DNS</Button>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
              <code className="min-w-0 flex-1 truncate text-caption text-secondary">{cname}</code>
              <button type="button" aria-label="Copy the CNAME record" className="grid size-8 shrink-0 place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary" onClick={() => { void navigator.clipboard.writeText(cname.replace(/\s+/g, ' ')).then(() => toast('CNAME record copied')); }}><Copy size={16} {...ICON} /></button>
            </div>
            <p className="helper">Add this CNAME record with your DNS provider. Changes can take up to 48 hours to spread.</p>
          </div>

          <Input id="bm" label="Default markup on client invoices (%)" className="tabular w-32" inputMode="decimal" value={f.markup} onChange={(e) => setF({ ...f, markup: e.target.value })} />
          {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
          <Button type="submit" loading={busy} disabled={uploading}>Save branding</Button>
        </form>
      </Card>

      {/* live preview: what a client sees. Only the accent tokens change. */}
      <div className="space-y-4" aria-label="Live preview">
        <div className="caption-label">Live preview</div>
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <div className="border-b border-border px-4 py-2 text-caption text-tertiary">https://{f.subdomain || 'your-domain'}/login</div>
          <div className="mx-auto max-w-xs px-6 py-8">
            <div className="flex items-center gap-3 text-body-lg font-semibold">{logo && <Avatar name={f.name} src={f.logo} size="sm" square />}{f.name || 'Your agency'}</div>
            <div className="mt-6 text-h3">Sign in</div>
            <div className="mt-1 text-small text-secondary">Your campaign workspace</div>
            <div className="mt-5 h-input rounded-sm border border-border bg-surface-2" /><div className="mt-3 h-input rounded-sm border border-border bg-surface-2" />
            <div className="mt-4 grid h-control-lg place-items-center rounded-full text-body font-medium" style={{ background: a.accent, color: a['on-accent'] }}>Sign in</div>
            <div className="mt-4 text-center text-small" style={{ color: a['accent-text'] }}>Forgot your password?</div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3 text-small font-semibold">{logo ? <Avatar name={f.name} src={f.logo} size="sm" square /> : null}{f.name || 'Your agency'}<span className="font-normal text-tertiary">› Client › Campaigns</span></div>
            <Bell size={20} {...ICON} className="text-secondary" aria-hidden />
          </div>
          <div className="flex gap-4 p-4">
            <div className="w-32 shrink-0 space-y-1 text-caption">
              <div className="flex h-8 items-center gap-2 rounded-sm bg-surface-3 px-2"><Megaphone size={16} {...ICON} aria-hidden />Campaigns</div>
              <div className="flex h-8 items-center gap-2 px-2 text-secondary"><Trophy size={16} {...ICON} aria-hidden />Leaderboard</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex gap-4 border-b border-border text-caption"><span className="border-b-2 pb-2 font-medium" style={{ borderColor: a['accent-brand'] }}>Overview</span><span className="pb-2 text-secondary">Creators</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2 py-1 text-caption" style={{ background: a['accent-soft'], color: a['accent-text'] }}>In progress</span>
                <span className="grid h-8 place-items-center rounded-full px-3 text-caption font-medium" style={{ background: a.accent, color: a['on-accent'] }}>Confirm selection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
