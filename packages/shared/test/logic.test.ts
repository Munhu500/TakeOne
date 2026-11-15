import { describe, expect, it } from 'vitest';
import {
  availableAt, campaignInputSchema, canTransition, compactLocal, creatorScore, earningsBand, exactEarnings, MAIN_BOARD_MIN_COMPLETED, effectiveTier, evaluateGuarantee, FORMAT_LIST, formatsForTier, isRisingStar, maskContactInfo,
  mockPublicMetrics, nextLedgerState, onboardingSchema, rankBrands, rankCreators, scoreMetricPlausibility, shouldFlagUser, sumBalances, V1_FORMATS, validateWithdrawal,
  withdrawalMethodsFor, withdrawalSchema,
} from '../src';

describe('ledger state transitions', () => {
  it('only moves forward one step', () => {
    expect(canTransition('pending', 'cleared')).toBe(true);
    expect(canTransition('cleared', 'available')).toBe(true);
    expect(canTransition('available', 'withdrawn')).toBe(true);
    expect(canTransition('pending', 'available')).toBe(false);
    expect(canTransition('cleared', 'pending')).toBe(false);
    expect(canTransition('withdrawn', 'available')).toBe(false);
  });
  const now = new Date('2026-06-10T00:00:00Z');
  it('clears only when payment settled AND submission approved', () => {
    const f = { availableAt: null, now };
    expect(nextLedgerState('pending', { ...f, paymentSettled: true, submissionApproved: false })).toBe('pending');
    expect(nextLedgerState('pending', { ...f, paymentSettled: false, submissionApproved: true })).toBe('pending');
    expect(nextLedgerState('pending', { ...f, paymentSettled: true, submissionApproved: true })).toBe('cleared');
  });
  it('becomes available after the tier delay', () => {
    const cleared = new Date('2026-06-01T00:00:00Z');
    const pro = availableAt(cleared, 'pro');
    const free = availableAt(cleared, 'free');
    expect(pro.toISOString()).toBe('2026-06-04T00:00:00.000Z');
    expect(free.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    const f = { paymentSettled: true, submissionApproved: true, now };
    expect(nextLedgerState('cleared', { ...f, availableAt: pro })).toBe('available');
    expect(nextLedgerState('cleared', { ...f, availableAt: free })).toBe('cleared');
    expect(nextLedgerState('available', { ...f, availableAt: pro })).toBe('available');
  });
  it('founding creators get Pro timing', () => {
    expect(effectiveTier({ tier: 'free', is_founding: true })).toBe('pro');
    expect(effectiveTier({ tier: 'free' })).toBe('free');
  });
  it('sums balances by state and validates withdrawals', () => {
    const b = sumBalances([
      { state: 'pending', amount_minor: 100 }, { state: 'available', amount_minor: 250 }, { state: 'available', amount_minor: 50 }, { state: 'withdrawn', amount_minor: 10 },
    ]);
    expect(b).toEqual({ pending: 100, cleared: 0, available: 300, withdrawn: 10 });
    expect(validateWithdrawal(301, b.available)).toMatch(/exceeds/);
    expect(validateWithdrawal(0, b.available)).not.toBeNull();
    expect(validateWithdrawal(1.5, b.available)).not.toBeNull();
    expect(validateWithdrawal(300, b.available)).toBeNull();
  });
});

describe('contact masking', () => {
  const cases: [string, string][] = [
    ['email me at priya.k@gmail.com please', 'email'],
    ['reach me: priya (at) gmail (dot) com', 'email'],
    ['my whatsapp is +91 98765 43210', 'phone'],
    ['call 050-123-4567 tomorrow', 'phone'],
    ['here https://wa.me/919876543210', 'link'],
    ['join t.me/priyacreates', 'link'],
    ['just DM me on insta', 'phrase'],
    ['text me when it ships', 'phrase'],
    ['I can share my number', 'phrase'],
    ['ig: priya.creates', 'handle'],
    ['find me @priya_creates', 'handle'],
    ['lets take this off-platform', 'phrase'],
  ];
  it.each(cases)('masks %s', (text, kind) => {
    const r = maskContactInfo(text);
    expect(r.hadMasking).toBe(true);
    expect(r.matches.map((m) => m.kind)).toContain(kind);
    expect(r.masked).toContain('•••');
  });
  it('removes the sensitive text itself', () => {
    const r = maskContactInfo('Mail priya.k@gmail.com or call +971 50 123 4567');
    expect(r.masked).not.toMatch(/gmail|4567|priya\.k/);
    expect(r.matches).toHaveLength(2);
  });
  it.each([
    'Loved the product, shooting tomorrow at 5pm!',
    'Can you ship 2 units? The 30ml one, order 4521.',
    'The brief says 3 key messages and a 45 second take.',
    'Budget is 25,000 for this one',
  ])('leaves normal messages alone: %s', (text) => {
    const r = maskContactInfo(text);
    expect(r.hadMasking).toBe(false);
    expect(r.masked).toBe(text);
  });
  it('flags a user after 3 attempts', () => {
    expect(shouldFlagUser(2)).toBe(false);
    expect(shouldFlagUser(3)).toBe(true);
  });
});

describe('metric plausibility', () => {
  const claimed = { followers: 100_000, avgViews: 40_000, engagementRate: 4.5 };
  it('passes consistent metrics', () => {
    const r = scoreMetricPlausibility(claimed, { followers: 98_000, avgLikes: 2_600, avgComments: 120 });
    expect(r.flags).toEqual([]);
    expect(r.verdict).toBe('plausible');
  });
  it('flags claimed views far above public likes', () => {
    const r = scoreMetricPlausibility({ ...claimed, avgViews: 2_000_000 }, { followers: 98_000, avgLikes: 900, avgComments: 30 });
    expect(r.flags).toContain('views_vs_likes');
    expect(r.verdict).not.toBe('plausible');
  });
  it('flags inflated followers and engagement', () => {
    const r = scoreMetricPlausibility({ followers: 500_000, avgViews: 40_000, engagementRate: 32 }, { followers: 90_000, avgLikes: 2_400, avgComments: 100 });
    expect(r.flags).toEqual(expect.arrayContaining(['followers_mismatch', 'engagement_too_high', 'engagement_mismatch']));
    expect(r.verdict).toBe('implausible');
  });
  it('asks for review without public data, and the mock is deterministic', () => {
    expect(scoreMetricPlausibility(claimed, null).verdict).toBe('review');
    expect(mockPublicMetrics('priya', claimed)).toEqual(mockPublicMetrics('priya', claimed));
  });
});

describe('leaderboard ranking', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const mk = (id: string, wins: number, submissions: number, done: number, rating: number | null, extra = {}) => ({
    creatorId: id, wins, submissions, campaignsCompleted: done, ratingAvg: rating, ratingCount: rating ? done : 0, joinedAt: '2025-01-01T00:00:00Z', country: 'IN', categories: ['beauty'], ...extra,
  });
  it('orders by weighted score (wins + 2) / (submissions + 4) and shows the raw win rate', () => {
    const r = rankCreators([mk('low', 2, 20, 10, 4.2), mk('top', 16, 20, 18, 4.9), mk('mid', 9, 20, 12, 4.5)], { now });
    expect(r.map((x) => x.creatorId)).toEqual(['top', 'mid', 'low']);
    expect(r[0]).toMatchObject({ rank: 1, winRate: 0.8 });
    expect(r[0]!.score).toBeCloseTo(18 / 24);
    expect(creatorScore({ wins: 0, submissions: 0 })).toBe(0.5);
  });
  it('breaks ties by rating, then completed campaigns', () => {
    const r = rankCreators([mk('fewer', 5, 10, 5, 4.5), mk('rated', 5, 10, 4, 4.9), mk('more', 5, 10, 9, 4.5)], { now });
    expect(r.map((x) => x.creatorId)).toEqual(['rated', 'more', 'fewer']);
  });
  it('never uses follower count', () => {
    const a = rankCreators([mk('a', 5, 10, 5, 4.5, { followers: 10 }), mk('b', 5, 10, 5, 4.5, { followers: 9_000_000 })], { now });
    expect(a[0]!.score).toBe(a[1]!.score);
    expect(a[0]!.creatorId).toBe('a');
  });
  it('a small sample cannot beat a proven record', () => {
    const r = rankCreators([mk('lucky', 3, 3, 3, 5), mk('proven', 40, 50, 30, 4.8)], { now });
    expect(r[0]!.creatorId).toBe('proven'); // 5/7 = 0.71 < 42/54 = 0.78
  });
  it('main board needs 3 completed campaigns; everyone else is a Rising Star', () => {
    const rows = [mk('veteran', 8, 10, 12, 4.8), mk('two', 2, 2, 2, 5), mk('none', 0, 0, 0, null), mk('newpro', 4, 5, 4, 4.7, { joinedAt: '2026-04-15T00:00:00Z' })];
    expect(rankCreators(rows, { now }).map((r) => r.creatorId)).toEqual(['veteran', 'newpro']);
    expect(rankCreators(rows, { board: 'rising', now }).map((r) => r.creatorId).sort()).toEqual(['newpro', 'none', 'two']);
    expect(rankCreators(rows, { board: 'all', now })).toHaveLength(4);
    expect(MAIN_BOARD_MIN_COMPLETED).toBe(3);
  });
  it('monthly boards judge eligibility on career totals', () => {
    const quietMonth = mk('quiet', 1, 1, 0, 4.8, { careerCompleted: 9 });
    expect(rankCreators([quietMonth], { now }).map((r) => r.creatorId)).toEqual(['quiet']);
  });
  it('filters by country, category and rising stars', () => {
    const rows = [mk('in', 5, 10, 5, 4.5), mk('ae', 5, 10, 5, 4.5, { country: 'AE', categories: ['tech'] }), mk('new', 3, 5, 2, 4.7, { joinedAt: '2026-04-15T00:00:00Z' })];
    expect(rankCreators(rows, { country: 'AE', now }).map((r) => r.creatorId)).toEqual(['ae']);
    expect(rankCreators(rows, { category: 'tech', now }).map((r) => r.creatorId)).toEqual(['ae']);
    expect(rankCreators(rows, { risingStars: true, now }).map((r) => r.creatorId)).toEqual(['new']);
    expect(isRisingStar('2026-01-01T00:00:00Z', now)).toBe(false);
  });
  it('ranks brands by volume, approval speed and payment speed', () => {
    const r = rankBrands([
      { brandId: 'slow', campaignsRun: 8, avgApprovalHours: 110, avgPaymentHours: 60 },
      { brandId: 'fast', campaignsRun: 8, avgApprovalHours: 6, avgPaymentHours: 1 },
    ]);
    expect(r[0]!.brandId).toBe('fast');
  });
  it('shows earnings as bands', () => {
    expect(earningsBand(6_200_00, 'USD', 'USD', undefined, 'this month')).toBe('$5K+ this month');
    expect(earningsBand(50_00, 'USD', 'USD')).toBe('Under $100');
    // local style, no minor units: lakh for India, K for the UAE
    expect(earningsBand(6_200_00, 'USD', 'INR')).toBe('₹4.2L+');
    expect(earningsBand(6_200_00, 'USD', 'AED')).toBe('AED 18.3K+');
    expect(compactLocal(420_000_00, 'INR')).toBe('₹4.2L');
    expect(compactLocal(1_500_000_00, 'AED')).toBe('AED 1.5M');
    expect(compactLocal(15_000_00, 'AED')).toBe('AED 15K');
    expect(compactLocal(13_000_000_00, 'INR')).toBe('₹1.3Cr');
    expect(exactEarnings(123_456_78, 'INR', 'INR')).not.toMatch(/\.\d/);
  });
});

describe('guarantee, formats, schemas', () => {
  const base = {
    profileComplete: true, socialAccounts: 2, matchingApplications: 15, acceptedCampaigns: 0, onTimeSubmissions: 0, ratingAvg: null, invitesReceived: 1,
    invitesAnsweredInTime: 1, duplicateAccountSuspected: false, country: 'IN', uaePermitNumber: null, paidCampaignsLanded: 0,
  };
  it('eligible when all criteria met and nothing landed', () => {
    expect(evaluateGuarantee(base).eligible).toBe(true);
    expect(evaluateGuarantee({ ...base, paidCampaignsLanded: 1 }).eligible).toBe(false);
    expect(evaluateGuarantee({ ...base, matchingApplications: 14 }).allMet).toBe(false);
    expect(evaluateGuarantee({ ...base, ratingAvg: 3.9 }).allMet).toBe(false);
  });
  it('requires the UAE permit only in AE', () => {
    expect(evaluateGuarantee({ ...base, country: 'AE' }).allMet).toBe(false);
    expect(evaluateGuarantee({ ...base, country: 'AE', uaePermitNumber: 'MC-1' }).allMet).toBe(true);
  });
  it('has 10 formats, 5 in v1, language version Pro-only and synthetic', () => {
    expect(FORMAT_LIST).toHaveLength(10);
    expect(V1_FORMATS.map((f) => f.id)).toEqual(['hook_first', 'testimonial_tight', 'day_in_life', 'silent_montage', 'language_version']);
    expect(formatsForTier(false).map((f) => f.id)).not.toContain('language_version');
    expect(FORMAT_LIST.filter((f) => f.synthetic).map((f) => f.id)).toEqual(['day_in_life', 'language_version']);
  });
  it('validates onboarding, withdrawals and campaigns', () => {
    const ob = { display_name: 'Aisha', categories: ['beauty'], accepted_terms: true };
    expect(onboardingSchema.safeParse({ ...ob, country: 'AE' }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ob, country: 'AE', uae_permit_number: 'MC-22' }).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...ob, country: 'IN' }).success).toBe(true);
    expect(withdrawalMethodsFor('IN')).toEqual(['upi', 'bank_in', 'paypal', 'wise', 'payoneer']);
    expect(withdrawalMethodsFor('AE')).toEqual(['bank_iban', 'paypal', 'wise', 'payoneer']);
    expect(withdrawalSchema.safeParse({ method: 'upi', amount_minor: 100, destination: {} }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ method: 'upi', amount_minor: 100.5, destination: { upi_id: 'a@upi' } }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ method: 'upi', amount_minor: 100, destination: { upi_id: 'a@upi' } }).success).toBe(true);
    expect(campaignInputSchema.safeParse({ title: 'x' }).success).toBe(false);
  });
});
