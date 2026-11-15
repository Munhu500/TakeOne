import { StubPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

export default async function Page() {
  await publicOnly();
  return <StubPage title="About TakeOne" body="TakeOne turns one honest take from a creator into the ad formats brands license. We are opening in India and the UAE first. A fuller story will be published here before public launch." />;
}
