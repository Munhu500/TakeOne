import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_FX, displayMoney, effectiveTier, type Creator, type FxRates, type Profile } from '@takeone/shared';
import { supabase } from './supabase';

const AuthCtx = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => { setSession(s); if (event === 'SIGNED_OUT') qc.clear(); });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return <AuthCtx.Provider value={{ session, loading }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export const useUid = () => useAuth().session?.user.id ?? '';

export interface Me { profile: Profile; creator: Creator | null; isPro: boolean }
export function useMe() {
  const uid = useUid();
  return useQuery({
    queryKey: ['me', uid], enabled: !!uid,
    queryFn: async (): Promise<Me> => {
      const [{ data: profile, error }, { data: creator }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('creators').select('*').eq('profile_id', uid).maybeSingle(),
      ]);
      if (error || !profile) throw new Error(error?.message ?? 'Profile not found');
      const c = creator as Creator | null;
      const freeMonth = !!c?.pro_free_until && new Date(c.pro_free_until) > new Date();
      return { profile: profile as Profile, creator: c, isPro: !!c && (effectiveTier(c) === 'pro' || freeMonth) };
    },
  });
}
export function useFx() {
  return useQuery({
    queryKey: ['fx'], staleTime: 3_600_000,
    queryFn: async (): Promise<FxRates> => {
      const { data } = await supabase.from('fx_rates').select('currency, rate_to_usd');
      const fx: FxRates = { ...DEFAULT_FX };
      for (const r of data ?? []) (fx as Record<string, number>)[r.currency as string] = Number(r.rate_to_usd);
      return fx;
    },
  });
}
/** Formats any stored amount in the creator's own currency. */
export function useMoney() {
  const { data: me } = useMe();
  const { data: fx } = useFx();
  const viewer = me?.profile.currency ?? 'USD';
  return (minor: number, currency: string, opts?: { compact?: boolean }) => displayMoney(Number(minor), currency, viewer, fx, opts);
}
export function timeAgo(d: string | Date): string {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const daysLeft = (d: string | Date) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
