import { RISING_STAR_DAYS } from './config';

export interface CreatorStats {
  creatorId: string;
  /** variants/submissions the brand selected */
  wins: number;
  submissions: number;
  campaignsCompleted: number;
  ratingAvg: number | null;
  ratingCount: number;
  joinedAt: string | Date;
  country?: string;
  categories?: string[];
  /** never used for ranking; present only to prove it */
  followers?: number;
}
export interface RankedCreator extends CreatorStats {
  rank: number;
  winRate: number;
  score: number;
}

const PRIOR_SUBMISSIONS = 5;
const PRIOR_WIN_RATE = 0.3;
const PRIOR_RATINGS = 3;
const PRIOR_RATING = 4.0;

/**
 * Score = 55% smoothed win rate + 25% completed campaigns (log-scaled) + 20% smoothed rating.
 * Bayesian smoothing stops a 1-for-1 newcomer outranking a 40-for-50 veteran. Follower count is never an input.
 */
export function creatorScore(s: CreatorStats): number {
  const winRate = (s.wins + PRIOR_WIN_RATE * PRIOR_SUBMISSIONS) / (s.submissions + PRIOR_SUBMISSIONS);
  const completed = Math.min(1, Math.log1p(s.campaignsCompleted) / Math.log1p(50));
  const rating = ((s.ratingAvg ?? PRIOR_RATING) * s.ratingCount + PRIOR_RATING * PRIOR_RATINGS) / (s.ratingCount + PRIOR_RATINGS) / 5;
  return Math.round((0.55 * winRate + 0.25 * completed + 0.2 * rating) * 10_000) / 100;
}

export function rawWinRate(s: Pick<CreatorStats, 'wins' | 'submissions'>): number {
  return s.submissions === 0 ? 0 : s.wins / s.submissions;
}

export interface BoardFilter {
  country?: string;
  category?: string;
  risingStars?: boolean;
  now?: Date;
}

export function isRisingStar(joinedAt: string | Date, now = new Date()): boolean {
  return now.getTime() - new Date(joinedAt).getTime() <= RISING_STAR_DAYS * 86_400_000;
}

export function rankCreators(rows: CreatorStats[], f: BoardFilter = {}): RankedCreator[] {
  const now = f.now ?? new Date();
  return rows
    .filter((r) => !f.country || r.country === f.country)
    .filter((r) => !f.category || (r.categories ?? []).includes(f.category))
    .filter((r) => !f.risingStars || isRisingStar(r.joinedAt, now))
    .map((r) => ({ ...r, winRate: rawWinRate(r), score: creatorScore(r), rank: 0 }))
    .sort((a, b) => b.score - a.score || b.campaignsCompleted - a.campaignsCompleted || a.creatorId.localeCompare(b.creatorId))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export interface BrandStats {
  brandId: string;
  campaignsRun: number;
  /** average hours from delivery to approval */
  avgApprovalHours: number | null;
  /** average hours from campaign creation to escrow payment */
  avgPaymentHours: number | null;
}
export interface RankedBrand extends BrandStats {
  rank: number;
  score: number;
}
const speed = (hours: number | null, worst: number) => (hours === null ? 0.5 : Math.max(0, 1 - hours / worst));

export function brandScore(b: BrandStats): number {
  const volume = Math.min(1, Math.log1p(b.campaignsRun) / Math.log1p(30));
  return Math.round((0.4 * volume + 0.35 * speed(b.avgApprovalHours, 120) + 0.25 * speed(b.avgPaymentHours, 72)) * 10_000) / 100;
}
export function rankBrands(rows: BrandStats[]): RankedBrand[] {
  return rows
    .map((b) => ({ ...b, score: brandScore(b), rank: 0 }))
    .sort((a, b) => b.score - a.score || a.brandId.localeCompare(b.brandId))
    .map((b, i) => ({ ...b, rank: i + 1 }));
}
