import { StubPage, WaitlistForm } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

export default async function Demo() {
  await publicOnly();
  return (
    <StubPage title="Book a demo" body="Leave your work email and we will arrange a walkthrough of a campaign from brief to licensed ads. Online booking will be added here before public launch.">
      <WaitlistForm fixedRole="brand" cta="Request a demo" />
    </StubPage>
  );
}
