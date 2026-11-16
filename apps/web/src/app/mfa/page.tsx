import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Logo } from '@/components/logo';
import { MfaForm } from './form';

/** Second sign-in step for admins. Admin pages send people here until their session has a verified authenticator code. */
export default async function MfaPage() {
  const s = await requireRole('admin');
  const sb = await supabaseServer();
  const { data: role } = await sb.rpc('my_admin_role');
  if (role) redirect('/admin');
  const hasRole = !!(s.profile as { admin_role?: string | null }).admin_role;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Logo />
      <h1 className="mt-8 text-h2">Two-step sign-in</h1>
      {hasRole
        ? <><p className="mt-2 text-small text-secondary">The admin console needs a code from an authenticator app every time you sign in.</p><MfaForm /></>
        : <p className="mt-4 text-body text-secondary">Your account has not been given an admin role yet, or it is suspended. Ask a super admin.</p>}
    </div>
  );
}
