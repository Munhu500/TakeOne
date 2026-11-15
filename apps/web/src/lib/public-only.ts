import { redirect } from 'next/navigation';
import { hostAgency } from '@/lib/session';

/** TakeOne's own public pages are never shown on an agency's white-label host; those go straight to the client workspace. */
export async function publicOnly(): Promise<void> {
  if (await hostAgency()) redirect('/login');
}
