import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEFAULT_FX, type Agency, type Brand, type FxRates, type Profile } from '@takeone/shared';
import { supabaseServer } from './supabase-server';

/** Agency resolved from the request host (custom subdomain), if any. Used to white-label public and client pages. */
export const hostAgency = cache(async (): Promise<Agency | null> => {
  const host = (await headers()).get('x-takeone-host');
  if (!host) return null;
  const sb = await supabaseServer();
  const { data } = await sb.from('agencies').select('*').eq('subdomain', host).maybeSingle();
  return (data as Agency | null) ?? null;
});

export const getFx = cache(async (): Promise<FxRates> => {
  const sb = await supabaseServer();
  const { data } = await sb.from('fx_rates').select('currency, rate_to_usd');
  const fx: FxRates = { ...DEFAULT_FX };
  for (const r of data ?? []) (fx as Record<string, number>)[r.currency] = Number(r.rate_to_usd);
  return fx;
});

export interface Session { userId: string; email: string; profile: Profile; brands: Brand[]; agency: Agency | null; brand: Brand | null }

export const getSession = cache(async (): Promise<Session | null> => {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: mems }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', auth.user.id).single(),
    sb.from('memberships').select('brand_id, agency_id').eq('profile_id', auth.user.id),
  ]);
  if (!profile) return null;
  const agencyId = mems?.find((m) => m.agency_id)?.agency_id as string | undefined;
  const brandIds = (mems ?? []).map((m) => m.brand_id).filter(Boolean) as string[];
  const [{ data: agency }, { data: brands }] = await Promise.all([
    agencyId ? sb.from('agencies').select('*').eq('id', agencyId).single() : Promise.resolve({ data: null }),
    agencyId ? sb.from('brands').select('*').eq('agency_id', agencyId).order('created_at') : brandIds.length ? sb.from('brands').select('*').in('id', brandIds).order('created_at') : Promise.resolve({ data: [] }),
  ]);
  const list = (brands ?? []) as Brand[];
  const active = (await cookies()).get('t1_brand')?.value;
  return { userId: auth.user.id, email: auth.user.email ?? '', profile: profile as Profile, brands: list, agency: (agency as Agency | null) ?? null, brand: list.find((b) => b.id === active) ?? list[0] ?? null };
});

export function homeFor(role: string): string {
  return role === 'admin' ? '/admin' : role === 'agency_member' ? '/agency' : role === 'brand_member' ? '/brand' : '/creators';
}

export async function requireRole(...roles: string[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (!roles.includes(s.profile.role)) redirect(homeFor(s.profile.role));
  return s;
}

/** Brand workspace the user is acting in (brand member's own brand, or the agency client picked in the switcher). */
export async function requireBrand(): Promise<Session & { brand: Brand }> {
  const s = await requireRole('brand_member', 'agency_member');
  if (!s.brand) redirect(s.profile.role === 'agency_member' ? (s.agency ? '/agency' : '/onboarding') : '/onboarding');
  return s as Session & { brand: Brand };
}
