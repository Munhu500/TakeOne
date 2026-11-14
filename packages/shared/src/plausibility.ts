export interface Metrics {
  followers: number;
  avgViews: number;
  /** percentage, e.g. 4.2 */
  engagementRate: number;
}
export interface PublicMetrics {
  followers: number;
  avgLikes: number;
  avgComments: number;
}
export type PlausibilityFlag = 'followers_mismatch' | 'views_vs_likes' | 'views_vs_followers' | 'engagement_too_high' | 'engagement_mismatch' | 'no_public_data';
export interface PlausibilityResult {
  /** 0–100, higher is more plausible */
  score: number;
  flags: PlausibilityFlag[];
  verdict: 'plausible' | 'review' | 'implausible';
}

/**
 * Cross-check claimed metrics against publicly visible ones.
 * Heuristics: likes are usually 2–15% of views, so views far above public likes are suspect;
 * claimed followers should be close to public followers; engagement above ~25% is rare.
 */
export function scoreMetricPlausibility(claimed: Metrics, pub: PublicMetrics | null): PlausibilityResult {
  const flags: PlausibilityFlag[] = [];
  let score = 100;
  if (!pub) return { score: 50, flags: ['no_public_data'], verdict: 'review' };

  if (pub.followers > 0) {
    const ratio = claimed.followers / pub.followers;
    if (ratio > 1.15 || ratio < 0.7) {
      flags.push('followers_mismatch');
      score -= ratio > 2 ? 45 : 25;
    }
  } else if (claimed.followers > 1000) {
    flags.push('followers_mismatch');
    score -= 45;
  }

  if (claimed.avgViews > 0) {
    const likeRate = pub.avgLikes / claimed.avgViews;
    if (likeRate < 0.004) {
      flags.push('views_vs_likes');
      score -= likeRate < 0.001 ? 45 : 25;
    }
    if (claimed.followers > 0 && claimed.avgViews / claimed.followers > 20) {
      flags.push('views_vs_followers');
      score -= 15;
    }
  }

  if (claimed.engagementRate > 25) {
    flags.push('engagement_too_high');
    score -= 25;
  }
  if (pub.followers > 0) {
    const publicEr = ((pub.avgLikes + pub.avgComments) / pub.followers) * 100;
    if (claimed.engagementRate > Math.max(publicEr * 3, publicEr + 5)) {
      flags.push('engagement_mismatch');
      score -= 20;
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags, verdict: score >= 75 ? 'plausible' : score >= 45 ? 'review' : 'implausible' };
}

/** Deterministic mocked "public" data for demo mode: mostly near the claim, sometimes off. */
export function mockPublicMetrics(handle: string, claimed: Metrics): PublicMetrics {
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const suspicious = h % 7 === 0;
  const followers = Math.round(claimed.followers * (suspicious ? 0.4 : 0.97));
  const avgLikes = Math.round(claimed.avgViews * (suspicious ? 0.002 : 0.06));
  return { followers, avgLikes, avgComments: Math.round(avgLikes * 0.04) };
}
