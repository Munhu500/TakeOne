import { StubPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

export default async function Page() {
  await publicOnly();
  return <StubPage title="Terms" body="The terms of use for creators, brands and agencies are being finalised and will be published here before public launch." />;
}
