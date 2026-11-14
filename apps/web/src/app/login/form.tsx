'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, btn } from '@/components/ui';

const DEMO_LOGINS = [
  { label: 'Brand · Kaya Glow (India)', email: 'brand@takeone.demo' },
  { label: 'Brand · Dune Athletics (UAE)', email: 'brand.ae@takeone.demo' },
  { label: 'Agency · Mirage Media', email: 'agency@takeone.demo' },
  { label: 'Admin', email: 'admin@takeone.demo' },
];
export const DEMO_PASSWORD = 'TakeOne-demo-2026';

export function LoginForm({ next, demo, whiteLabelled }: { next?: string; demo: boolean; whiteLabelled: boolean }) {
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = () => { window.location.href = next && next.startsWith('/') ? next : '/dashboard'; };

  async function run(fn: () => Promise<{ error: { message: string } | null }>, after?: () => void) {
    setBusy(true); setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message); else (after ?? done)();
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'password') return run(() => sb.auth.signInWithPassword({ email, password }));
    if (!sent) return run(() => sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }), () => setSent(true));
    return run(() => sb.auth.verifyOtp({ email, token: code, type: 'email' }));
  };
  const oauth = (provider: 'google' | 'apple') => run(() => sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } }), () => {});

  return (
    <div className="mt-8 space-y-5">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === 'password' ? (
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        ) : sent ? (
          <div>
            <label className="label" htmlFor="code">6-digit code from your email</label>
            <input id="code" className="input tabular tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        ) : null}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{mode === 'password' ? 'Sign in' : sent ? 'Verify code' : 'Email me a code'}</Button>
      </form>
      <button className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => { setMode(mode === 'password' ? 'otp' : 'password'); setSent(false); setError(null); }}>
        {mode === 'password' ? 'Use a one-time email code instead' : 'Use a password instead'}
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button className={btn('secondary')} onClick={() => oauth('google')}>Google</button>
        <button className={btn('secondary')} onClick={() => oauth('apple')}>Apple</button>
      </div>
      <p className="text-sm text-muted">New here? <Link className="text-accent hover:underline" href="/signup">Create a {whiteLabelled ? 'client' : 'brand or agency'} account</Link></p>
      {demo && !whiteLabelled && (
        <div className="card p-4">
          <div className="text-xs font-medium text-muted">Demo logins</div>
          <div className="mt-3 grid gap-2">
            {DEMO_LOGINS.map((d) => (
              <button key={d.email} disabled={busy} className={btn('secondary', 'sm') + ' justify-between'} onClick={() => run(() => sb.auth.signInWithPassword({ email: d.email, password: DEMO_PASSWORD }))}>
                <span>{d.label}</span><span className="text-faint">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
