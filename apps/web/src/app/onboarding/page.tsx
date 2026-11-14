import { redirect } from 'next/navigation';
import { COUNTRIES, TERMS_VERSION } from '@takeone/shared';
import { getSession, homeFor } from '@/lib/session';
import { whiteLabel, Wordmark } from '@/components/shell';
import { OnboardingForm } from './form';

export default async function Onboarding() {
  const s = await getSession();
  if (!s) redirect('/login');
  const isAgency = s.profile.role === 'agency_member';
  if (!['brand_member', 'agency_member'].includes(s.profile.role) || (isAgency ? s.agency : s.brand)) redirect(homeFor(s.profile.role));
  const wl = await whiteLabel(s);
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <Wordmark name={wl.name} logo={wl.logo} />
      <h1 className="mt-8 text-h2">{isAgency ? 'Set up your agency' : 'Set up your brand'}</h1>
      <p className="mt-2 text-small text-secondary">Your country sets the currency you are charged in.</p>
      <OnboardingForm kind={isAgency ? 'agency' : 'brand'} platform={wl.name} termsVersion={TERMS_VERSION} countries={Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name, currency: c.currency }))} />
    </div>
  );
}
