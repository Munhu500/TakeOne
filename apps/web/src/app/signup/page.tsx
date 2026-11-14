import { whiteLabel, Wordmark } from '@/components/shell';
import { SignupForm } from './form';

export default async function SignupPage() {
  const wl = await whiteLabel();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Wordmark name={wl.name} logo={wl.logo} />
      <h1 className="mt-8 font-display text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-muted">Post a campaign, review variants, license the winners.</p>
      <SignupForm allowAgency={!wl.agency} />
    </div>
  );
}
