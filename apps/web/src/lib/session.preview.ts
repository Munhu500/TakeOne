// Static preview replacement for session.ts: same exports, resolved in the browser.
import { redirect } from 'next/navigation';
import { DEFAULT_FX, type Agency, type Brand, type FxRates, type Profile } from '@takeone/shared';
import { supabaseBrowser } from './supabase-browser';

export interface Session { userId: string; email: string; profile: Profile; brands: Brand[]; agency: Agency | null; brand: Brand | null }

// one lookup per page load; the host clears this before each (re)load
let memo: { session?: Promise<Session | null>; agency?: Promise<Agency | null>; fx?: Promise<FxRates> } = {};
export function resetPreviewCache() { memo = {}; }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** White-label without subdomains: `?agency=<slug>` picks the agency and is remembered for the browser tab. */
export function hostAgency(): Promise<Agency | null> {
  return (memo.agency ??= (async () => {
    const fromUrl = new URLSearchParams(window.location.search).get('agency');
    if (fromUrl !== null) { if (fromUrl) sessionStorage.setItem('t1_agency', fromUrl); else sessionStorage.removeItem('t1_agency'); }
    const slug = (fromUrl ?? sessionStorage.getItem('t1_agency') ?? '').toLowerCase();
    if (!slug) return null;
    const { data } = await supabaseBrowser().from('agencies').select('*');
    return ((data ?? []) as Agency[]).find((a) => a.subdomain === slug || a.subdomain.split('.')[0] === slug || slugify(a.name) === slug) ?? null;
  })());
}

export function getFx(): Promise<FxRates> {
  return (memo.fx ??= (async () => {
    const { data } = await supabaseBrowser().from('fx_rates').select('currency, rate_to_usd');
    const fx: FxRates = { ...DEFAULT_FX };
    for (const r of data ?? []) (fx as Record<string, number>)[r.currency] = Number(r.rate_to_usd);
    return fx;
  })());
}

export function getSession(): Promise<Session | null> {
  return (memo.session ??= (async () => {
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getSession();
    const user = auth.session?.user;
    if (!user) return null;
    const [{ data: profile }, { data: mems }] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('memberships').select('brand_id, agency_id').eq('profile_id', user.id),
    ]);
    if (!profile) return null;
    const agencyId = mems?.find((m: { agency_id: string | null }) => m.agency_id)?.agency_id as string | undefined;
    const brandIds = (mems ?? []).map((m: { brand_id: string | null }) => m.brand_id).filter(Boolean) as string[];
    const [{ data: agency }, { data: brands }] = await Promise.all([
      agencyId ? sb.from('agencies').select('*').eq('id', agencyId).single() : Promise.resolve({ data: null }),
      agencyId ? sb.from('brands').select('*').eq('agency_id', agencyId).order('created_at') : brandIds.length ? sb.from('brands').select('*').in('id', brandIds).order('created_at') : Promise.resolve({ data: [] }),
    ]);
    const list = (brands ?? []) as Brand[];
    const active = localStorage.getItem('t1_brand');
    return { userId: user.id, email: user.email ?? '', profile: profile as Profile, brands: list, agency: (agency as Agency | null) ?? null, brand: list.find((b) => b.id === active) ?? list[0] ?? null };
  })());
}

export function homeFor(role: string): string {
  return role === 'admin' ? '/admin' : role === 'agency_member' ? '/agency' : role === 'brand_member' ? '/brand' : '/creators';
}
export async function requireRole(...roles: string[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (!roles.includes(s.profile.role)) redirect(homeFor(s.profile.role));
  return s;
}
export async function requireBrand(): Promise<Session & { brand: Brand }> {
  const s = await requireRole('brand_member', 'agency_member');
  if (!s.brand) redirect(s.profile.role === 'agency_member' ? (s.agency ? '/agency' : '/onboarding') : '/onboarding');
  return s as Session & { brand: Brand };
}
