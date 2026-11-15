import { RISING_STAR_DAYS } from './config';

export interface CreatorStats {
  creatorId: string;
  /** variants/submissions the brand selected */
  wins: number;
  submissions: number;
  campaignsCompleted: number;
  /** all-time completed campaigns, when `campaignsCompleted` is for a shorter period; decides main-board eligibility */
  careerCompleted?: number;
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

/** Creators need this many completed campaigns (all-time) to appear on the main board; until then they are Rising Stars. */
export const MAIN_BOARD_MIN_COMPLETED = 3;
const PRIOR_WINS = 2;
const PRIOR_SUBMISSIONS = 4;

/**
 * Weighted score = (wins + 2) / (submissions + 4): the win rate pulled towards 50% while the sample is small, so a
 * 1-for-1 newcomer cannot outrank a 40-for-50 veteran. Follower count is never an input. The raw win rate is what
 * people are shown; this is only for ordering.
 */
export function creatorScore(s: Pick<CreatorStats, 'wins' | 'submissions'>): number {
  return (s.wins + PRIOR_WINS) / (s.submissions + PRIOR_SUBMISSIONS);
}

export function rawWinRate(s: Pick<CreatorStats, 'wins' | 'submissions'>): number {
  return s.submissions === 0 ? 0 : s.wins / s.submissions;
}

export interface BoardFilter {
  country?: string;
  category?: string;
  /** Shorthand for board: 'rising'. */
  risingStars?: boolean;
  /** 'main' (default): at least 3 completed campaigns. 'rising': everyone else, plus anyone who joined in the last 90 days. 'all': no eligibility filter. */
  board?: 'main' | 'rising' | 'all';
  now?: Date;
}

export function isRisingStar(joinedAt: string | Date, now = new Date()): boolean {
  return now.getTime() - new Date(joinedAt).getTime() <= RISING_STAR_DAYS * 86_400_000;
}
const career = (r: CreatorStats) => r.careerCompleted ?? r.campaignsCompleted;
export const onMainBoard = (r: CreatorStats) => career(r) >= MAIN_BOARD_MIN_COMPLETED;

/** Order: weighted score, then rating, then completed campaigns. */
export function rankCreators(rows: CreatorStats[], f: BoardFilter = {}): RankedCreator[] {
  const now = f.now ?? new Date();
  const board = f.board ?? (f.risingStars ? 'rising' : 'main');
  return rows
    .filter((r) => !f.country || r.country === f.country)
    .filter((r) => !f.category || (r.categories ?? []).includes(f.category))
    .filter((r) => board === 'all' || (board === 'main' ? onMainBoard(r) : !onMainBoard(r) || isRisingStar(r.joinedAt, now)))
    .map((r) => ({ ...r, winRate: rawWinRate(r), score: creatorScore(r), rank: 0 }))
    .sort((a, b) => b.score - a.score || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || b.campaignsCompleted - a.campaignsCompleted || a.creatorId.localeCompare(b.creatorId))
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
