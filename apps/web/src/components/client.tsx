'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { Moon, Sun, Loader2 } from 'lucide-react';
import { rpc, type ActionResult } from '@/lib/actions';
import { btn } from '@/components/ui';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => setTheme((document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark'), []);
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('t1-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };
  return (
    <button onClick={flip} className={btn('ghost', 'sm')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

/** Button that runs a server action, shows progress and surfaces the error inline. */
export function ActionButton({ action, children, variant = 'primary', size = 'md', confirm: confirmText, className, onDone, disabled }: {
  action: () => Promise<ActionResult>; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; confirm?: string; className?: string; onDone?: (r: ActionResult) => void; disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={pending || disabled}
        className={cn(btn(variant, size), className)}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (!r.ok) setError(r.error ?? 'Something went wrong');
            else { onDone?.(r); router.refresh(); }
          });
        }}
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
      {error && <span role="alert" className="max-w-xs text-xs text-bad">{error}</span>}
    </span>
  );
}

export function RpcButton({ fn, args, path, ...rest }: { fn: string; args: Record<string, unknown>; path?: string } & Omit<Parameters<typeof ActionButton>[0], 'action'>) {
  return <ActionButton {...rest} action={() => rpc(fn, args, path)} />;
}
