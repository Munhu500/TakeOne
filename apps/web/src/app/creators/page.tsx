import { LandingPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

/** The landing page with the creator view preselected. */
export default async function Creators() {
  await publicOnly();
  return <LandingPage preselect="creators" />;
}
