import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/session';
import { whiteLabel, Wordmark } from '@/components/shell';
import { DemoPill } from '@/components/ui';
import { DEMO } from '@/lib/utils';
import { LoginForm } from './form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getSession();
  if (s) redirect(homeFor(s.profile.role));
  const wl = await whiteLabel();
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="flex items-center gap-3"><Wordmark name={wl.name} logo={wl.logo} />{DEMO && <DemoPill />}</div>
      <h1 className="mt-8 text-h2">Sign in</h1>
      <p className="mt-2 text-small text-secondary">{wl.agency ? `Your ${wl.name} campaign workspace.` : 'For brands, agencies and the TakeOne team. Creators use the mobile app.'}</p>
      <LoginForm next={next} demo={DEMO} whiteLabelled={!!wl.agency} />
    </div>
  );
}
