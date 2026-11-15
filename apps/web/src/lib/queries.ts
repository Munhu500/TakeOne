// Server-side queries (this module imports supabase-server, which reads request cookies).
import { rankCreators, type CreatorPublic, type SocialAccountPublic } from '@takeone/shared';
import { supabaseServer } from './supabase-server';

export interface BoardRow {
  creator_id: string; display_name: string; avatar: string | null; country: string; categories: string[]; joined_at: string; is_pro: boolean; wins: number; submissions: number;
  campaigns_completed: number; rating_avg: number | null; rating_count: number; month_wins: number; month_submissions: number; month_completed: number; earnings_exact: boolean;
  month_earnings_usd_minor: number; total_earnings_usd_minor: number;
}
export async function leaderboardRows(): Promise<BoardRow[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from('leaderboard_creators').select('*');
  return (data ?? []) as BoardRow[];
}
export function toStats(r: BoardRow, period: 'month' | 'all') {
  return {
    creatorId: r.creator_id, wins: period === 'month' ? r.month_wins : r.wins, submissions: period === 'month' ? r.month_submissions : r.submissions,
    campaignsCompleted: period === 'month' ? r.month_completed : r.campaigns_completed, ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg), ratingCount: r.rating_count,
    careerCompleted: r.campaigns_completed, joinedAt: r.joined_at, country: r.country, categories: r.categories,
  };
}
/** creator id → all-time leaderboard rank */
export async function rankMap(): Promise<Map<string, number>> {
  return new Map(rankCreators((await leaderboardRows()).map((r) => toStats(r, 'all')), { board: 'all' }).map((r) => [r.creatorId, r.rank]));
}
export async function creatorsByIds(ids: string[]): Promise<{ creators: Map<string, CreatorPublic>; socials: Map<string, SocialAccountPublic[]> }> {
  const creators = new Map<string, CreatorPublic>();
  const socials = new Map<string, SocialAccountPublic[]>();
  if (!ids.length) return { creators, socials };
  const sb = await supabaseServer();
  const [{ data: cs }, { data: ss }] = await Promise.all([
    sb.from('creator_public').select('*').in('profile_id', ids),
    sb.from('social_accounts_public').select('*').in('creator_id', ids),
  ]);
  for (const c of (cs ?? []) as CreatorPublic[]) creators.set(c.profile_id, c);
  for (const s of (ss ?? []) as SocialAccountPublic[]) socials.set(s.creator_id, [...(socials.get(s.creator_id) ?? []), s]);
  return { creators, socials };
}
