// Landing-page copy. Statistics carry their source and must not be changed without one.
import type { Audience } from '@/lib/marketing';

export const SIGNUP: Record<Audience, string> = { creators: '/signup?role=creator', brands: '/signup?role=brand' };
export const DEMO_HREF = '/demo';
export const PRIMARY_CTA: Record<Audience, string> = { creators: 'Join free as a creator', brands: 'Post your first campaign' };

/** [plain text, emphasised words set in the serif italic] */
type Headline = readonly [string, string];

export const HERO: Record<Audience, { badge: string; headline: Headline; sub: string; secondary: { label: string; href: string }; trust: string[] }> = {
  creators: {
    badge: 'Now open in India and the UAE',
    headline: ['Get paid by brands.', 'Every month.'],
    sub: 'Find paid campaigns, film one honest take with the product, and TakeOne turns it into ten ads brands compete to license. You keep 75% of every payment — and earn again every time a brand renews your ad.',
    secondary: { label: 'See how creators earn', href: '#earn' },
    trust: ['Free to join', 'Withdraw to UPI, bank or PayPal', 'Your likeness is never used without your consent'],
  },
  brands: {
    badge: 'Now open in India and the UAE',
    headline: ['Ten creator ads. One brief.', 'Seven days.'],
    sub: 'Real creators use your real product. Our AI turns every take into ten ranked ad formats, ready for Meta, TikTok and YouTube. You only license the winners.',
    secondary: { label: 'Book a demo', href: DEMO_HREF },
    trust: ['Budget held in escrow', 'Pay only for what you approve', 'AI-labelled where the law requires'],
  },
};
export const HERO_CHIPS = ['Campaign accepted', '10 ads generated', 'Licence renewed — paid again'];

export const PROBLEM = {
  creators: {
    headline: 'One shoot. One fee. Then nothing.',
    items: [
      ['Inconsistent work', 'Brand deals arrive when they arrive. Most months, they don’t.'],
      ['Paid once', 'Your video can run as an ad for months. You were paid for it once.'],
      ['Ranked by followers', 'Talent with a smaller audience gets ignored, however good the content.'],
    ],
  },
  brands: {
    headline: 'Your best ad stops working in about 36 days.',
    stats: [
      ['47%', 'of an ad’s sales impact comes from the creative.', 'Nielsen'],
      ['36 days', 'average life of a winning creator ad before fatigue.', 'Agentio, 2026'],
      ['1 in 5', 'tested creator ads becomes a winner. You need volume to find them.', 'Agentio, 2026'],
    ],
  },
} as const;

export const STEPS: Record<Audience, readonly (readonly [string, string])[]> = {
  creators: [
    ['Pick a campaign', 'Browse paid campaigns from brands in your country and category. Apply in one tap.'],
    ['Film one take', 'The product arrives. Follow the guided shot list and give your honest opinion.'],
    ['Get ten ads', 'TakeOne creates up to ten versions — new scenes, hooks and languages — without changing what you said.'],
    ['Get paid, again and again', 'Paid when the brand approves. Paid again when they renew or run your ad from your account.'],
  ],
  brands: [
    ['Paste a product link', 'We draft the brief and shot list. You edit, set the budget, and fund escrow.'],
    ['Creators shoot', 'Verified creators film one take each with your real product.'],
    ['Review ten ranked ads per creator', 'Every variant is scored against your brief and arrives in 9:16, 4:5 and 1:1.'],
    ['License the winners', 'Pick up to three in the base fee, renew what keeps working, add more as you scale.'],
  ],
};

export const EARN = {
  headline: ['Your phone is now a studio that', 'keeps paying.'] as Headline,
  cards: [
    ['Campaign fee', 'Paid for every approved campaign. You keep 75%.'],
    ['Renewals', 'When a brand keeps running your ad past its licence, you’re paid again.'],
    ['Partnership ads', 'Brands pay extra to run your ad from your own account.'],
    ['More languages', 'Your real review, in your own voice, in Hindi, Tamil, Telugu or Arabic — opening campaigns in new markets. (Pro)'],
  ],
} as const;

export const RESULTS = {
  headline: ['Creator ads are now a', 'must-buy.'] as Headline,
  stats: [
    ['$37B', 'US creator ad spend in 2025, up 26% in a year.', 'IAB'],
    ['−19% CPA', 'average when partnership ads are added to campaigns.', 'Meta, Dec 2025'],
    ['+19% CTR', 'when the same ad runs from the creator’s handle instead of the brand’s.', 'Agentio, 2026'],
  ],
  line: 'TakeOne gives you that volume without managing a single creator.',
  agency: 'Agency? Run TakeOne under your own brand for every client.',
} as const;

export const TRUST = [
  ['Escrow on every campaign', 'Brand funds are held until the work is approved.'],
  ['Verified creators', 'Ownership checks, recorded insights and platform data.'],
  ['Your likeness, your consent', 'Approved per campaign. Revocable any time.'],
  ['Compliant by design', 'Paid-partnership and AI labels where required in India and the UAE.'],
] as const;

export const LIVE = {
  caption: 'Invite only',
  headline: ['TakeOne Live.', 'Dubai and Mumbai.'] as Headline,
  sub: 'An evening for the top creators on TakeOne and the brands who book them. You can’t buy a ticket. You earn your invite on the leaderboard.',
};

export const PRICING = {
  free: ['Free', 'Join, apply to campaigns, get paid. Free forever.'],
  pro: ['Pro', 'About USD 19 a month, priced in your currency. Early access to campaigns, faster payouts, Multilingual Voice and Win Predictor.'],
  /** India and the UAE see their own price, so the "about USD 19" line is dropped there. */
  proFeatures: 'Early access to campaigns, faster payouts, Multilingual Voice and Win Predictor.',
  // "License" here is the verb, per the British English standard in the README.
  brands: ['No subscription. Pay per campaign.', 'Your budget goes into escrow. Creators keep 75%; TakeOne’s fee is 25%. License extra formats, renewals and partnership ads as you need them.'],
} as const;

export const FAQ = [
  ['Is it free for creators?', 'Yes. Joining and getting paid is free. Pro is optional.'],
  ['How do I get paid?', 'When a brand approves your work, payment clears to your wallet. Withdraw to UPI, bank, PayPal, Wise or Payoneer.'],
  ['Will AI change what I said?', 'Never. AI can change the scene, format or language. Your words, your opinion and the product stay as they are.'],
  ['Who controls my likeness?', 'You. You approve it per campaign and can withdraw consent for future use at any time.'],
  ['Do I need a big following?', 'No. Creators are ranked by results, so great content can climb fast.'],
  // TODO: confirm the seven-day delivery claim before public launch.
  ['How fast do brands get ads?', 'Most campaigns deliver ranked variants within seven days of the creator receiving the product.'],
  ['Where can I run the ads?', 'Meta, TikTok and YouTube, from your own ad accounts or from the creator’s handle.'],
  ['Which countries?', 'India and the UAE now, with more markets opening one by one.'],
] as const;

export const FINAL: Record<Audience, { headline: Headline; other: { label: string; href: string } }> = {
  creators: { headline: ['One take could be your', 'next payday.'], other: { label: 'I’m a brand', href: '/brands' } },
  brands: { headline: ['Your next winning ad is', 'one take away.'], other: { label: 'I’m a creator', href: '/creators' } },
};

/** Illustrative only; always shown with an "Example" caption. */
export const EXAMPLE_SCORES = [91, 84, 78, 73, 69, 66, 62, 58, 55, 51];
export const EXAMPLE_LEADERBOARD = [
  { name: 'Priya Sharma', country: 'IN', category: 'Beauty', winRate: 68, campaigns: 14, rating: '4.9', monthUsdMinor: 620_000 },
  { name: 'Layla Al Farsi', country: 'AE', category: 'Fashion', winRate: 61, campaigns: 11, rating: '4.8', monthUsdMinor: 540_000 },
  { name: 'Arjun Mehta', country: 'IN', category: 'Tech', winRate: 57, campaigns: 12, rating: '4.8', monthUsdMinor: 310_000 },
  { name: 'Noura Haddad', country: 'AE', category: 'Beauty', winRate: 52, campaigns: 9, rating: '4.7', monthUsdMinor: 260_000 },
  { name: 'Kabir Rao', country: 'IN', category: 'Fitness', winRate: 49, campaigns: 10, rating: '4.7', monthUsdMinor: 180_000 },
] as const;
export const EXAMPLE_WALLET = { IN: [1_800_000, 1_350_000, 2_700_000], AE: [80_000, 60_000, 120_000], OTHER: [22_000, 16_500, 33_000] } as const;
