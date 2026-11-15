'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

export function SignupForm({ allowAgency, initialRole = 'brand_member' }: { allowAgency: boolean; initialRole?: 'brand_member' | 'agency_member' }) {
  const [role, setRole] = useState<'brand_member' | 'agency_member'>(allowAgency ? initialRole : 'brand_member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { data, error } = await supabaseBrowser().auth.signUp({ email, password, options: { data: { role, display_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (data.session) window.location.href = '/onboarding';
    else setMsg({ ok: true, text: 'Check your email to confirm your address, then sign in.' });
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {allowAgency && (
        <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-3">
          {([['brand_member', 'Brand', 'Run campaigns for your own products'], ['agency_member', 'Agency', 'White-label workspaces for clients']] as const).map(([v, t, d]) => (
            <button type="button" key={v} role="radio" aria-checked={role === v} onClick={() => setRole(v)} className={cn('rounded-md border p-4 text-left transition duration-fast ease-standard active:scale-press', role === v ? 'border-accent-brand bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong')}>
              <div className="text-small font-medium">{t}</div><div className="mt-1 text-caption text-secondary">{d}</div>
            </button>
          ))}
        </div>
      )}
      <Input id="name" label="Your name" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input id="email" label="Work email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input id="password" label="Password" type="password" required minLength={8} autoComplete="new-password" helper="At least 8 characters." value={password} onChange={(e) => setPassword(e.target.value)} />
      {msg && <p role="alert" className={msg.ok ? 'text-small text-success-text' : 'text-small text-danger-text'}>{msg.text}</p>}
      <Button type="submit" size="lg" loading={busy} className="w-full">Create account</Button>
      <p className="text-small text-secondary">Already have an account? <Link className="text-accent-text underline-offset-4 hover:underline" href="/login">Sign in</Link></p>
    </form>
  );
}
