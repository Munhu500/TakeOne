'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, Card, Input } from '@/components/ui';

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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = () => { window.location.href = next && next.startsWith('/') ? next : '/dashboard'; };

  async function run(key: string, fn: () => Promise<{ error: { message: string } | null }>, after?: () => void) {
    setBusy(key); setError(null);
    const { error } = await fn();
    if (error) { setBusy(null); setError(error.message); } else if (after) { setBusy(null); after(); } else done();
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'password') return run('form', () => sb.auth.signInWithPassword({ email, password }));
    if (!sent) return run('form', () => sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }), () => setSent(true));
    return run('form', () => sb.auth.verifyOtp({ email, token: code, type: 'email' }));
  };
  const oauth = (provider: 'google' | 'apple') => run(provider, () => sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } }), () => {});

  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input id="email" label="Work email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === 'password' && <Input id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        {mode === 'otp' && sent && <Input id="code" label="6-digit code from your email" inputMode="numeric" autoComplete="one-time-code" required className="tabular font-mono tracking-code" value={code} onChange={(e) => setCode(e.target.value)} />}
        {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
        <Button type="submit" size="lg" loading={busy === 'form'} disabled={!!busy} className="w-full">{mode === 'password' ? 'Sign in' : sent ? 'Verify code' : 'Email me a code'}</Button>
      </form>
      <Button variant="ghost" size="sm" onClick={() => { setMode(mode === 'password' ? 'otp' : 'password'); setSent(false); setError(null); }}>
        {mode === 'password' ? 'Use a one-time email code instead' : 'Use a password instead'}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" loading={busy === 'google'} disabled={!!busy} onClick={() => oauth('google')}>Google</Button>
        <Button variant="secondary" loading={busy === 'apple'} disabled={!!busy} onClick={() => oauth('apple')}>Apple</Button>
      </div>
      <p className="text-small text-secondary">New here? <Link className="text-accent-text underline-offset-4 hover:underline" href="/signup">Create a {whiteLabelled ? 'client' : 'brand or agency'} account</Link></p>
      {demo && !whiteLabelled && (
        <Card>
          <div className="caption-label">Demo logins</div>
          <div className="mt-4 grid gap-2">
            {DEMO_LOGINS.map((d) => (
              <Button key={d.email} variant="secondary" size="sm" disabled={!!busy} loading={busy === d.email} className="w-full" onClick={() => run(d.email, () => sb.auth.signInWithPassword({ email: d.email, password: DEMO_PASSWORD }))}>
                {d.label}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
