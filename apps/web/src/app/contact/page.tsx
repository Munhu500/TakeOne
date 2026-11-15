import { StubPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

export default async function Page() {
  await publicOnly();
  return <StubPage title="Contact" body="A contact address and form will be published here before public launch. Until then, join the waitlist on the home page and we will be in touch." />;
}
