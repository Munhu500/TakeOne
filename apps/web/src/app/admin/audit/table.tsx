'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, ICON, RowChevron } from '@/components/ui';
import { Drawer } from '@/components/ui/overlays';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/admin/bits';
import { fmtDate, sentenceCase } from '@/lib/utils';

export interface AuditRow { id: number; actor_id: string | null; admin: string; action: string; entity: string | null; entity_id: string | null; before: unknown; after: unknown; reason: string | null; created_at: string }
const ALL = 'all';
const ENTITIES = ['variant', 'social_account', 'profile', 'creator', 'campaign', 'dispute', 'withdrawal', 'setting', 'fx_rate', 'job', 'message'];
const ACTIONS = ['qa', 'verification', 'user', 'campaign', 'dispute', 'withdrawal', 'masking', 'settings', 'fx', 'job', 'admin'];
const label = (s: string) => sentenceCase(s.replace(/[._]/g, ' '));
const when = (d: string) => `${fmtDate(d)}, ${new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

export function AuditFilters({ q, admin, entity, action, admins }: { q: string; admin: string; entity: string; action: string; admins: { value: string; label: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(text ? { q: text } : {}), ...(admin ? { admin } : {}), ...(entity ? { entity } : {}), ...(action ? { action } : {}), ...patch });
    for (const k of [...p.keys()]) if (!p.get(k) || p.get(k) === ALL) p.delete(k);
    router.push(`/admin/audit?${p}`);
  };
  return (
    <form className="mb-4 flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); go({ q: text }); }}>
      <div className="relative w-72"><Search size={16} {...ICON} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" aria-hidden /><input aria-label="Search the audit log" placeholder="Search reason, action or ID" className="input h-control-md pl-12 text-small" value={text} onChange={(e) => setText(e.target.value)} /></div>
      <Select id="au-admin" compact className="w-48" label="Admin" value={admin || ALL} onValueChange={(v) => go({ admin: v })} options={[{ value: ALL, label: 'All admins' }, ...admins]} />
      <Select id="au-entity" compact className="w-48" label="Entity type" value={entity || ALL} onValueChange={(v) => go({ entity: v })} options={[{ value: ALL, label: 'All entities' }, ...ENTITIES.map((e) => ({ value: e, label: label(e) }))]} />
      <Select id="au-action" compact className="w-48" label="Action" value={action || ALL} onValueChange={(v) => go({ action: v })} options={[{ value: ALL, label: 'All actions' }, ...ACTIONS.map((a) => ({ value: a, label: label(a) }))]} />
    </form>
  );
}

const Json = ({ v }: { v: unknown }) => <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 p-4 font-mono text-caption text-secondary">{v === null || v === undefined ? '—' : JSON.stringify(v, null, 2)}</pre>;

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<AuditRow | null>(null);
  return (
    <>
      <div className="card overflow-x-auto">
        <table className="data-table min-w-table-wide">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Reason</th><th aria-label="Open" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} tabIndex={0} role="button" aria-label={`Open ${label(r.action)} by ${r.admin}`} className="cursor-pointer" onClick={() => setOpen(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(r); } }}>
                <td className="tabular whitespace-nowrap text-secondary">{when(r.created_at)}</td>
                <td className="font-medium">{r.admin}</td>
                <td><Badge>{label(r.action)}</Badge></td>
                <td className="text-secondary">{r.entity ? label(r.entity) : '—'}</td>
                <td className="max-w-md truncate text-secondary">{r.reason}</td>
                <td className="text-right"><RowChevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open ? label(open.action) : 'Audit entry'}>
        {open && (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-5">
              <Field label="Admin">{open.admin}</Field>
              <Field label="When">{when(open.created_at)}</Field>
              <Field label="Entity">{open.entity ? label(open.entity) : '—'}</Field>
              <Field label="ID"><span className="break-all font-mono text-caption">{open.entity_id ?? '—'}</span></Field>
            </dl>
            <div><div className="caption-label">Reason</div><p className="mt-2 text-body">{open.reason}</p></div>
            <div><div className="caption-label">Before</div><div className="mt-2"><Json v={open.before} /></div></div>
            <div><div className="caption-label">After</div><div className="mt-2"><Json v={open.after} /></div></div>
          </div>
        )}
      </Drawer>
    </>
  );
}
