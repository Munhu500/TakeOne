'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { rpc, type ActionResult } from '@/lib/actions';
import { Button, ICON, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { ConfirmDialog, IconButton } from '@/components/ui/overlays';

/** Brand dashboard only. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => setTheme((document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark'), []);
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('t1-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };
  return <IconButton label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={flip}>{theme === 'dark' ? <Sun size={16} {...ICON} /> : <Moon size={16} {...ICON} />}</IconButton>;
}
export function SignOutButton() {
  return <IconButton label="Sign out" type="submit"><LogOut size={16} {...ICON} /></IconButton>;
}

/**
 * Button that runs a server action, shows progress at a fixed width and surfaces the error inline.
 * `confirm` opens a dialog that restates the effect of the action before it runs.
 */
export function ActionButton({ action, children, variant = 'primary', size = 'md', confirm, className, onDone, disabled }: {
  action: () => Promise<ActionResult>; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; confirm?: string | { title: string; effect: string; confirmLabel?: string };
  className?: string; onDone?: (r: ActionResult) => void; disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const run = () => {
    setError(null);
    start(async () => {
      const r = await action();
      setAsking(false);
      if (!r.ok) setError(r.error ?? 'Something went wrong');
      else { onDone?.(r); router.refresh(); }
    });
  };
  const c = typeof confirm === 'string' ? { title: 'Please confirm', effect: confirm, confirmLabel: 'Confirm' } : confirm;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} size={size} className={className} loading={pending && !asking} disabled={disabled} onClick={() => (c ? setAsking(true) : run())}>{children}</Button>
      {error && <span role="alert" className="max-w-xs text-caption text-danger-text">{error}</span>}
      {c && <ConfirmDialog open={asking} onOpenChange={setAsking} title={c.title} effect={c.effect} confirmLabel={c.confirmLabel ?? 'Confirm'} destructive={variant === 'destructive'} busy={pending} onConfirm={run} />}
    </span>
  );
}

export function RpcButton({ fn, args, path, ...rest }: { fn: string; args: Record<string, unknown>; path?: string } & Omit<Parameters<typeof ActionButton>[0], 'action'>) {
  return <ActionButton {...rest} action={() => rpc(fn, args, path)} />;
}
