'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { FORMATS, type FormatId } from '@takeone/shared';
import { signedUrl } from '@/lib/actions';
import { buyLicense } from '@/lib/checkout';
import { Badge, Button, ICON, VideoFrame } from '@/components/ui';
import { DropdownMenu, Modal, Tooltip } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { cn, daysLeft, daysLeftLabel, fmtDate, money, pluralise } from '@/lib/utils';

export interface LicenceRow {
  variantId: string; format: FormatId; synthetic: boolean; assignmentId: string; renditions: Record<string, string>; campaignId: string; campaign: string; product: string; currency: string;
  partnership: boolean; perpetual: boolean; ends: string | null; termDays: number; renewPrice: number; buyoutPrice: number;
}
const DAY = 86_400_000;
/** A renewal adds one term to the current end date (or starts today if the licence has already lapsed). */
const newEnd = (r: LicenceRow) => new Date(Math.max(Date.now(), r.ends ? new Date(r.ends).getTime() : 0) + r.termDays * DAY);

export function LicenceTable({ rows }: { rows: LicenceRow[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<{ rows: LicenceRow[]; kind: 'renewal' | 'buyout' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renewable = rows.filter((r) => !r.perpetual);
  // the accent fill goes to one row only: the licence that runs out first within a week
  const urgent = useMemo(() => renewable.find((r) => r.ends && daysLeft(r.ends) <= 7)?.variantId, [renewable]);
  const chosen = rows.filter((r) => picked.includes(r.variantId));
  const sum = (list: LicenceRow[], kind: 'renewal' | 'buyout') => list.reduce((a, r) => a + (kind === 'renewal' ? r.renewPrice : r.buyoutPrice), 0);

  async function run() {
    if (!confirming) return;
    setBusy(true); setError(null);
    for (const r of confirming.rows) {
      const res = await buyLicense(r.variantId, confirming.kind, r.campaignId, '/brand/licenses');
      if (!res.ok) { setBusy(false); return setError(res.error ?? 'That did not go through.'); }
      if (res.data?.url) { window.location.href = res.data.url; return; }
    }
    const first = confirming.rows[0]!;
    toast(confirming.kind === 'buyout' ? 'Bought out. Paid usage is now perpetual.' : confirming.rows.length === 1 ? `Renewed until ${fmtDate(newEnd(first))}` : `${pluralise(confirming.rows.length, 'licence')} renewed`);
    setBusy(false); setConfirming(null); setPicked([]);
    router.refresh();
  }
  async function download(r: LicenceRow) {
    const key = r.renditions['9:16'] ?? Object.values(r.renditions)[0];
    if (!key) return toast('The file for this ad is not available yet.', 'danger');
    const res = await signedUrl('variants', key, `${r.product}-${r.format}.mp4`.replace(/\s+/g, '-'));
    if (!res.ok || !res.data) return toast(res.error ?? 'Download failed', 'danger');
    window.location.href = res.data;
  }
  const c = confirming;
  const cur = c?.rows[0]?.currency ?? 'USD';
  return (
    <>
      {picked.length > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-strong bg-surface-2 px-4 py-3">
          <span className="tabular text-small">{pluralise(chosen.length, 'licence')} selected · {money(sum(chosen, 'renewal'), chosen[0]!.currency)}</span>
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button><Button size="sm" onClick={() => setConfirming({ rows: chosen, kind: 'renewal' })}>Renew selected</Button></div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="data-table min-w-table-wide">
          <thead>
            <tr>
              <th className="w-12"><input type="checkbox" aria-label="Select all renewable licences" className="size-4 accent-accent" checked={renewable.length > 0 && picked.length === renewable.length} onChange={(e) => setPicked(e.target.checked ? renewable.map((r) => r.variantId) : [])} /></th>
              <th>Variant</th><th>Licence</th><th>Ends</th><th className="num">Renew</th><th aria-label="More" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const left = r.ends ? daysLeft(r.ends) : Infinity;
              return (
                <tr key={r.variantId} className="h-row-media">
                  <td>{!r.perpetual && <input type="checkbox" aria-label={`Select ${FORMATS[r.format]?.name ?? r.format}, ${r.campaign}`} className="size-4 accent-accent" checked={picked.includes(r.variantId)} onChange={() => setPicked((p) => (p.includes(r.variantId) ? p.filter((x) => x !== r.variantId) : [...p, r.variantId]))} />}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <VideoFrame media={`variants/${r.format}`} label={FORMATS[r.format]?.name ?? r.format} controls={false} radius="sm" compact className="w-8 shrink-0" />
                      <div className="min-w-0"><div className="flex items-center gap-2 font-medium">{FORMATS[r.format]?.name ?? r.format}{r.synthetic && <Tooltip label="Turn on the platform’s AI-info label when publishing."><span tabIndex={0}><Badge>AI-edited</Badge></span></Tooltip>}</div><div className="truncate text-caption text-secondary">{r.campaign}</div></div>
                    </div>
                  </td>
                  <td><div className="flex flex-wrap gap-1"><Badge tone="outline">Base</Badge>{r.partnership && <Badge tone="outline">Partnership ad</Badge>}</div></td>
                  <td className="tabular">{r.perpetual ? 'Perpetual' : r.ends ? <><div>{fmtDate(r.ends)}</div><div className={cn('text-caption', left <= 7 ? 'text-warning-text' : 'text-tertiary')}>{daysLeftLabel(r.ends)}</div></> : '—'}</td>
                  <td className="num">{!r.perpetual && <Button size="sm" variant={r.variantId === urgent ? 'accent' : 'secondary'} onClick={() => setConfirming({ rows: [r], kind: 'renewal' })}>Renew · {money(r.renewPrice, r.currency)}</Button>}</td>
                  <td className="text-right">
                    <DropdownMenu trigger={<button type="button" aria-label={`More for ${FORMATS[r.format]?.name ?? r.format}`} className="grid size-9 place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary"><MoreHorizontal size={20} {...ICON} /></button>}
                      items={[
                        { label: 'Open', onSelect: () => router.push(`/brand/campaigns/${r.campaignId}/review/${r.assignmentId}?v=${r.variantId}`) },
                        { label: 'Download', onSelect: () => void download(r) },
                        { label: `Buy out · ${money(r.buyoutPrice, r.currency)}`, onSelect: () => setConfirming({ rows: [r], kind: 'buyout' }), disabled: r.perpetual },
                      ]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!c} onOpenChange={(o) => { if (!o && !busy) { setConfirming(null); setError(null); } }}
        title={c?.kind === 'buyout' ? 'Buy out this ad' : c && c.rows.length > 1 ? `Renew ${pluralise(c.rows.length, 'licence')}` : 'Renew this licence'}
        description={c?.kind === 'buyout' ? 'Paid usage becomes perpetual. The creator receives 75%.' : 'Each ad keeps running without a gap. The creator receives 75% of every renewal.'}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>Not now</Button><Button loading={busy} onClick={run}>{c?.kind === 'buyout' ? 'Buy out' : 'Renew'}{c ? ` · ${money(sum(c.rows, c.kind), cur)}` : ''}</Button></>}>
        {c && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {c.rows.map((r) => (
              <li key={r.variantId} className="flex items-center justify-between gap-4 px-4 py-3 text-small">
                <div className="min-w-0"><div className="truncate font-medium">{FORMATS[r.format]?.name ?? r.format}</div><div className="truncate text-caption text-secondary">{r.campaign}</div></div>
                <div className="tabular shrink-0 text-right"><div>{c.kind === 'buyout' ? 'Perpetual' : `Until ${fmtDate(newEnd(r))}`}</div><div className="text-caption text-tertiary">{money(c.kind === 'buyout' ? r.buyoutPrice : r.renewPrice, r.currency)}{c.kind === 'renewal' ? ` · +${pluralise(r.termDays, 'day')}` : ''}</div></div>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="mt-3 text-small text-danger-text">{error}</p>}
      </Modal>
    </>
  );
}
