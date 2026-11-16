import { redirect } from 'next/navigation';
import { requireRole, type Session } from './session';
import { supabaseServer } from './supabase-server';

export type AdminRole = 'super_admin' | 'operations' | 'finance' | 'trust_safety';
export type AdminArea = 'review' | 'money' | 'settings' | 'reveal';
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = { super_admin: 'Super admin', operations: 'Operations', finance: 'Finance', trust_safety: 'Trust & Safety' };
/** Mirrors admin_can() in the database, which is what actually decides. This only chooses what to show. */
const AREAS: Record<AdminArea, AdminRole[]> = { review: ['super_admin', 'operations', 'trust_safety'], money: ['super_admin', 'finance'], settings: ['super_admin'], reveal: ['trust_safety'] };
export const roleCan = (role: AdminRole, area: AdminArea) => AREAS[area].includes(role);

export interface AdminCounts { qa: number; verification: number; disputes: number; oldest_dispute_hours: number | null; masking: number; payouts_on_hold: number | null; payouts_failed: number | null; past_deadline: number }
export interface AdminContext { session: Session; role: AdminRole; can: (area: AdminArea) => boolean; counts: AdminCounts }

/**
 * Admin pages start here. The database only treats the caller as an admin once the session has a second factor
 * (or, in demo mode, the account is exempt), so a null role means "sign in with your authenticator first".
 */
export async function requireAdmin(area?: AdminArea): Promise<AdminContext> {
  const session = await requireRole('admin');
  const sb = await supabaseServer();
  const { data: role } = await sb.rpc('my_admin_role');
  if (!role) redirect('/mfa');
  const r = role as AdminRole;
  if (area && !roleCan(r, area)) redirect('/admin');
  const { data: counts } = await sb.rpc('admin_counts');
  return { session, role: r, can: (a) => roleCan(r, a), counts: (counts ?? { qa: 0, verification: 0, disputes: 0, oldest_dispute_hours: null, masking: 0, payouts_on_hold: null, payouts_failed: null, past_deadline: 0 }) as AdminCounts };
}

export const PAGE_SIZE = 50;
/** Slice for the tables' 50-row pages. */
export function paginate<T>(rows: T[], page: string | undefined): { rows: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(pages, Math.max(1, Number(page) || 1));
  return { rows: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), page: p, pages, total: rows.length };
}
