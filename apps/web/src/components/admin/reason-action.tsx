'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { rpc } from '@/lib/actions';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { Modal } from '@/components/ui/overlays';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

export interface ExtraField { key: string; label: string; type: 'select' | 'text' | 'number' | 'date'; options?: { value: string; label: string }[]; required?: boolean; helper?: string; /** multiply a typed number by this before sending (e.g. 100 for minor units) */ scale?: number }
const MIN_REASON = 10;

/**
 * Every admin action goes through this: a dialog that restates the effect, takes a reason of at least 10 characters
 * (the database enforces the same) and then calls the audited function. Money and destructive actions pass `destructive`.
 */
export function ReasonAction({ label, title, effect, fn, args, reasonKey = 'p_reason', confirmLabel, variant = 'secondary', size = 'sm', destructive, fields = [], reasonLabel = 'Reason (kept in the audit log)',
  reasonPlaceholder, defaultReason = '', done, path = '/admin', disabled, className, onDone, trigger }: {
  label: ReactNode; title: string; effect: ReactNode; fn: string; args: Record<string, unknown>; reasonKey?: string; confirmLabel?: string; variant?: ButtonVariant; size?: ButtonSize; destructive?: boolean;
  fields?: ExtraField[]; reasonLabel?: string; reasonPlaceholder?: string; defaultReason?: string; done?: string; path?: string; disabled?: boolean; className?: string; onDone?: (data: unknown) => void;
  /** render your own trigger (e.g. a menu item); it receives the function that opens the dialog */ trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = fields.some((f) => f.required && !values[f.key]);
  const ok = reason.trim().length >= MIN_REASON && !missing;
  async function run() {
    setBusy(true); setError(null);
    const extra = Object.fromEntries(fields.filter((f) => values[f.key]).map((f) => [f.key, f.type === 'number' ? Math.round(Number(values[f.key]) * (f.scale ?? 1)) : f.type === 'date' ? new Date(values[f.key]!).toISOString() : values[f.key]]));
    const r = await rpc(fn, { ...args, ...extra, [reasonKey]: reason.trim() }, path);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'That did not go through.');
    setOpen(false); setReason(defaultReason); setValues({});
    toast(done ?? 'Done. Recorded in the audit log.');
    onDone?.(r.data);
    router.refresh();
  }
  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : <Button variant={destructive && variant === 'secondary' ? 'destructive' : variant} size={size} disabled={disabled} className={className} onClick={() => setOpen(true)}>{label}</Button>}
      <Modal open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); setError(null); } }} title={title} description={effect}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button variant={destructive ? 'destructive' : 'primary'} loading={busy} disabled={!ok} onClick={run}>{confirmLabel ?? label}</Button></>}>
        <div className="space-y-4">
          {fields.map((f) => f.type === 'select'
            ? <Select key={f.key} id={`ra-${f.key}`} label={f.label} value={values[f.key] ?? ''} onValueChange={(v) => setValues({ ...values, [f.key]: v })} options={f.options ?? []} helper={f.helper} />
            : <div key={f.key}><label className="label" htmlFor={`ra-${f.key}`}>{f.label}</label><input id={`ra-${f.key}`} className="input tabular" type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: f.type === 'number' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value })} />{f.helper && <p className="helper">{f.helper}</p>}</div>)}
          <div>
            <label className="label" htmlFor="ra-reason">{reasonLabel}</label>
            <textarea id="ra-reason" className="input" autoFocus placeholder={reasonPlaceholder ?? 'What happened, and why this is the right action'} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="ra-reason-help" />
            <p id="ra-reason-help" className="helper">{reason.trim().length < MIN_REASON ? `At least ${MIN_REASON} characters. ${Math.max(0, MIN_REASON - reason.trim().length)} to go.` : 'Saved with your name, the time, and the before and after values.'}</p>
          </div>
          {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
