'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export function SignupForm({ allowAgency }: { allowAgency: boolean }) {
  const [role, setRole] = useState<'brand_member' | 'agency_member'>('brand_member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { data, error } = await supabaseBrowser().auth.signUp({ email, password, options: { data: { role, display_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (error) return setMsg({ tone: 'bad', text: error.message });
    if (data.session) window.location.href = '/onboarding';
    else setMsg({ tone: 'ok', text: 'Check your email to confirm your address, then sign in.' });
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {allowAgency && (
        <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-2">
          {([['brand_member', 'Brand', 'Run campaigns for your own products'], ['agency_member', 'Agency', 'White-label workspaces for clients']] as const).map(([v, t, d]) => (
            <button type="button" key={v} role="radio" aria-checked={role === v} onClick={() => setRole(v)} className={cn('rounded-xl border p-3 text-left', role === v ? 'border-accent bg-accent/10' : 'border-line bg-raised')}>
              <div className="text-sm font-medium">{t}</div><div className="mt-0.5 text-xs text-muted">{d}</div>
            </button>
          ))}
        </div>
      )}
      <div><label className="label" htmlFor="name">Your name</label><input id="name" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label className="label" htmlFor="email">Work email</label><input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {msg && <p role="alert" className={msg.tone === 'bad' ? 'text-sm text-bad' : 'text-sm text-ok'}>{msg.text}</p>}
      <Button type="submit" disabled={busy} className="w-full">Create account</Button>
      <p className="text-sm text-muted">Already have an account? <Link className="text-accent hover:underline" href="/login">Sign in</Link></p>
    </form>
  );
}
