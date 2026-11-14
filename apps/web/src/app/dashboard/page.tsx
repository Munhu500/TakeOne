import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/session';

export default async function Dashboard() {
  const s = await getSession();
  if (!s) redirect('/login');
  if ((s.profile.role === 'brand_member' && !s.brand) || (s.profile.role === 'agency_member' && !s.agency)) redirect('/onboarding');
  redirect(homeFor(s.profile.role));
}
