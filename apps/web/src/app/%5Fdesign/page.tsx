import { requireRole } from '@/lib/session';
import { DEMO } from '@/lib/utils';
import { Gallery } from './gallery';

/** Internal reference for every token and component. Not linked from any navigation; admin-only outside the demo. */
export default async function DesignPage() {
  if (!DEMO) await requireRole('admin');
  return <Gallery />;
}
