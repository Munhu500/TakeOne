import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TIERS, type Application, type Assignment, type Campaign } from '@takeone/shared';
import { useMe, useUid } from './data';
import { supabase } from './supabase';

export type FeedCampaign = Campaign & { brands: { name: string; logo: string | null } };

export function useFeed() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ['feed', me?.profile.country, me?.creator?.categories], enabled: !!me,
    queryFn: async (): Promise<FeedCampaign[]> => {
      // RLS already hides campaigns still in Pro early access from Free creators
      let q = supabase.from('campaigns').select('*, brands(name, logo)').eq('status', 'live').contains('countries', [me!.profile.country]).order('published_at', { ascending: false }).limit(50);
      const cats = me!.creator?.categories ?? [];
      if (cats.length) q = q.overlaps('categories', cats);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as FeedCampaign[];
    },
  });
}
export function useMyApplications() {
  const uid = useUid();
  return useQuery({
    queryKey: ['applications', uid], enabled: !!uid,
    queryFn: async () => ((await supabase.from('applications').select('*').eq('creator_id', uid).order('created_at', { ascending: false })).data ?? []) as Application[],
  });
}
export function useMyAssignments() {
  const uid = useUid();
  return useQuery({
    queryKey: ['assignments', uid], enabled: !!uid,
    queryFn: async () => ((await supabase.from('assignments').select('*, campaigns(*, brands(name, logo))').eq('creator_id', uid).order('created_at', { ascending: false })).data ?? []) as unknown as (Assignment & { campaigns: FeedCampaign })[],
  });
}
/** Monday 00:00 UTC, same boundary the database uses for the Free weekly limit. */
export function weekStart(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}
export function useWeeklyQuota() {
  const { data: me } = useMe();
  const { data: apps } = useMyApplications();
  const limit = TIERS.free.applicationsPerWeek;
  const used = (apps ?? []).filter((a) => !a.invited && new Date(a.created_at) >= weekStart()).length;
  return { isPro: !!me?.isPro, used, limit, left: Math.max(0, limit - used) };
}
/** One-tap apply with an optimistic update; rolled back if the server refuses (e.g. weekly limit). */
export function useApply() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, pitch }: { campaignId: string; pitch?: string }) => {
      const { error } = await supabase.from('applications').insert({ campaign_id: campaignId, creator_id: uid, pitch: pitch?.trim() || null });
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ campaignId, pitch }) => {
      await qc.cancelQueries({ queryKey: ['applications', uid] });
      const prev = qc.getQueryData<Application[]>(['applications', uid]);
      const optimistic = { id: `tmp-${campaignId}`, campaign_id: campaignId, creator_id: uid, pitch: pitch ?? null, status: 'applied', invited: false, invited_at: null, responded_at: null, created_at: new Date().toISOString() } as Application;
      qc.setQueryData<Application[]>(['applications', uid], [optimistic, ...(prev ?? [])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['applications', uid], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['applications', uid] }),
  });
}
