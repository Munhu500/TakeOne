import { LandingPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

export default async function Home() {
  await publicOnly();
  return <LandingPage />;
}
