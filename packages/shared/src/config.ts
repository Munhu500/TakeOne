/** Platform-wide constants. Anything an admin can change lives in the `settings` table with these as defaults. */
export const BPS = 10_000;
export const CREATOR_SHARE_BPS = 7_500;
export const PLATFORM_FEE_BPS = 2_500;

export const QA_REQUIRED_FIRST_N_CAMPAIGNS = 100;
export const AUTO_APPROVE_DAYS = 5;
export const TERMS_VERSION = '2026-01';
export const LIKENESS_CONSENT_VERSION = '2026-01';

export const TIERS = {
  free: { applicationsPerWeek: 3, payoutDelayDays: 14, earlyAccess: false },
  pro: { applicationsPerWeek: null, payoutDelayDays: 3, earlyAccess: true },
} as const;
export type Tier = keyof typeof TIERS;

export const EARLY_ACCESS_HOURS = 48;
export const PRO_PRICE_USD_MINOR = 1_900;

export const LICENSE_DEFAULTS = {
  baseIncludedVariants: 3,
  termDays: 90,
  /** price of one extra variant for 90 days, as a share of the per-creator fee */
  extraVariantBps: 2_000,
  renewalBps: 5_000,
  buyoutBps: 20_000,
  whitelistBps: 3_000,
  renewalReminderDays: 7,
} as const;

export const BRAND_CREDIT = { bps: 2_500, validDays: 60 } as const;

export const GUARANTEE = {
  windowDays: 60,
  minSocialAccounts: 2,
  minMatchingApplications: 15,
  minRating: 4.0,
  inviteResponseHours: 48,
} as const;

export const MASKING_FLAG_THRESHOLD = 3;
export const RISING_STAR_DAYS = 90;

export const COUNTRIES = {
  IN: { name: 'India', currency: 'INR', locale: 'en-IN', flag: '🇮🇳' },
  AE: { name: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', flag: '🇦🇪' },
  US: { name: 'Other / International', currency: 'USD', locale: 'en-US', flag: '🌍' },
} as const;
export type CountryCode = keyof typeof COUNTRIES;
export const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];

export const CATEGORIES = ['beauty', 'fashion', 'fitness', 'food', 'tech', 'lifestyle', 'travel', 'home', 'gaming', 'parenting'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat'] as const;
export type SocialPlatform = (typeof PLATFORMS)[number];

export const DUB_LANGUAGES = [
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
] as const;

export const WITHDRAWAL_METHODS = {
  upi: { label: 'UPI', countries: ['IN'], fields: ['upi_id'] },
  bank_in: { label: 'Bank transfer (IFSC)', countries: ['IN'], fields: ['account_name', 'account_number', 'ifsc'] },
  bank_iban: { label: 'Bank transfer (IBAN)', countries: ['AE'], fields: ['account_name', 'iban'] },
  paypal: { label: 'PayPal', countries: null, fields: ['email'] },
  wise: { label: 'Wise', countries: null, fields: ['email'] },
  payoneer: { label: 'Payoneer', countries: null, fields: ['email'] },
} as const;
export type WithdrawalMethod = keyof typeof WITHDRAWAL_METHODS;

export function withdrawalMethodsFor(country: string): WithdrawalMethod[] {
  return (Object.keys(WITHDRAWAL_METHODS) as WithdrawalMethod[]).filter((m) => {
    const c = WITHDRAWAL_METHODS[m].countries as readonly string[] | null;
    return c === null || c.includes(country);
  });
}

/** Countries where a tax id is collected at first withdrawal. */
export const TAX_ID_REQUIRED: Record<string, { label: string; pattern: RegExp }> = {
  IN: { label: 'PAN', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
};
