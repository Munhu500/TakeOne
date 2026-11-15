import { LandingPage } from '@/components/landing/sections';
import { publicOnly } from '@/lib/public-only';

/** The landing page with the brand view preselected. */
export default async function Brands() {
  await publicOnly();
  return <LandingPage preselect="brands" />;
}
