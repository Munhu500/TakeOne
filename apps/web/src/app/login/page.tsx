import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/session';
import { whiteLabel, Wordmark } from '@/components/shell';
import { DEMO } from '@/lib/utils';
import { LoginForm } from './form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getSession();
  if (s) redirect(homeFor(s.profile.role));
  const wl = await whiteLabel();
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Wordmark name={wl.name} logo={wl.logo} />
      <h1 className="mt-8 font-display text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">{wl.agency ? `Your ${wl.name} campaign workspace.` : 'For brands, agencies and the TakeOne team. Creators use the mobile app.'}</p>
      <LoginForm next={next} demo={DEMO} whiteLabelled={!!wl.agency} />
    </div>
  );
}
