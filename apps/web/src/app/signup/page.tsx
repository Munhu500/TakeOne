import Link from 'next/link';
import { whiteLabel, Wordmark } from '@/components/shell';
import { WaitlistForm } from '@/components/landing/interactive';
import { MarketingProvider } from '@/lib/marketing';
import { STATIC_PREVIEW } from '@/lib/utils';
import { SignupForm } from './form';

/** `?role=creator|brand|agency` comes from the landing page. Creators join in the app, so they get that route instead of the brand form. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const [wl, { role }] = await Promise.all([whiteLabel(), searchParams]);
  if (role === 'creator' && !wl.agency) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <Wordmark name={wl.name} logo={wl.logo} />
        <h1 className="mt-8 text-h2">Join as a creator</h1>
        <p className="mt-2 text-small text-secondary">Creators join and work in the TakeOne app, which is being built for iOS and Android. Leave your email and we will tell you the moment you can sign up.</p>
        <div className="mt-8"><MarketingProvider preselect="creators"><WaitlistForm fixedRole="creator" cta="Notify me" /></MarketingProvider></div>
        {STATIC_PREVIEW && <p className="mt-8 text-small text-secondary"><a className="text-accent-text underline-offset-4 hover:underline" href="/app/">Open the app preview</a></p>}
        <p className="mt-8 text-small text-secondary">A brand or agency? <Link className="text-accent-text underline-offset-4 hover:underline" href="/signup?role=brand">Create a brand account</Link></p>
      </div>
    );
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Wordmark name={wl.name} logo={wl.logo} />
      <h1 className="mt-8 text-h2">Create your account</h1>
      <p className="mt-2 text-small text-secondary">Post a campaign, review variants, license the winners.</p>
      <SignupForm allowAgency={!wl.agency} initialRole={role === 'agency' ? 'agency_member' : 'brand_member'} />
      {!wl.agency && <p className="mt-6 text-small text-secondary">A creator? <Link className="text-accent-text underline-offset-4 hover:underline" href="/signup?role=creator">Join as a creator</Link></p>}
    </div>
  );
}
