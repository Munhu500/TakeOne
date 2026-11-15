import { StubPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

export default async function Page() {
  await publicOnly();
  return <StubPage title="Privacy" body="The privacy notice is being finalised and will be published here before public launch. It will cover what we collect, why, how long we keep it, and your rights, including control over your likeness." />;
}
