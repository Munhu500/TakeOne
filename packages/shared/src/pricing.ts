import { BPS, BRAND_CREDIT, clampTermDays, CREATOR_SHARE_BPS, CREDITS_ENABLED, LICENSE_DEFAULTS, PLATFORM_FEE_BPS } from './config';
import { assertMinor } from './currency';

function bps(amountMinor: number, rate: number): number {
  // floor: fractions of a minor unit never go to the smaller side of a split twice
  return Number((BigInt(amountMinor) * BigInt(rate)) / BigInt(BPS));
}

export interface Split {
  grossMinor: number;
  creatorMinor: number;
  platformMinor: number;
}

/**
 * Creator 75% / platform 25% on every payment (campaign fees, licenses, renewals, buyouts).
 * Any rounding remainder goes to the creator, so creator + platform === gross always.
 */
export function splitPayment(grossMinor: number): Split {
  assertMinor(grossMinor);
  if (grossMinor < 0) throw new Error('Amount cannot be negative');
  const platformMinor = bps(grossMinor, PLATFORM_FEE_BPS);
  return { grossMinor, creatorMinor: grossMinor - platformMinor, platformMinor };
}
void CREATOR_SHARE_BPS;

export interface CampaignCharge {
  /** fee per creator × creators */
  grossMinor: number;
  creatorPoolMinor: number;
  platformFeeMinor: number;
  creditAppliedMinor: number;
  /** what the brand actually pays into escrow */
  payableMinor: number;
  /** platform fee after credit */
  platformNetMinor: number;
}

/**
 * Brand credit (Option B) is applied only against the platform's 25% fee.
 * Creator payouts are never reduced by credits or discounts.
 */
export function campaignCharge(feePerCreatorMinor: number, creators: number, creditAvailableMinor = 0, opts: { creditsEnabled?: boolean } = {}): CampaignCharge {
  if (!(opts.creditsEnabled ?? CREDITS_ENABLED)) creditAvailableMinor = 0; // credits are switched off: never applied
  assertMinor(feePerCreatorMinor);
  assertMinor(creditAvailableMinor);
  if (!Number.isInteger(creators) || creators < 1) throw new Error('creators must be a positive integer');
  if (creditAvailableMinor < 0) throw new Error('credit cannot be negative');
  const per = splitPayment(feePerCreatorMinor);
  const grossMinor = feePerCreatorMinor * creators;
  const creatorPoolMinor = per.creatorMinor * creators;
  const platformFeeMinor = grossMinor - creatorPoolMinor;
  const creditAppliedMinor = Math.min(creditAvailableMinor, platformFeeMinor);
  return {
    grossMinor,
    creatorPoolMinor,
    platformFeeMinor,
    creditAppliedMinor,
    payableMinor: grossMinor - creditAppliedMinor,
    platformNetMinor: platformFeeMinor - creditAppliedMinor,
  };
}

/** Credit issued when a brand's first campaign completes: 25% of that campaign's value. */
export function firstCampaignCredit(campaignValueMinor: number, opts: { creditsEnabled?: boolean } = {}): number {
  assertMinor(campaignValueMinor);
  if (!(opts.creditsEnabled ?? CREDITS_ENABLED)) return 0;
  return bps(campaignValueMinor, BRAND_CREDIT.bps);
}

export type LicenseType = 'base' | 'extra' | 'renewal' | 'buyout' | 'whitelist';
export interface LicensePricing {
  extraVariantBps: number;
  renewalBps: number;
  buyoutBps: number;
  whitelistBps: number;
  termDays: number;
}

/** Price of a license add-on, derived from the per-creator campaign fee. `base` is included in the campaign. */
export function licensePrice(type: LicenseType, feePerCreatorMinor: number, p: Partial<LicensePricing> = {}): number {
  assertMinor(feePerCreatorMinor);
  const cfg = { ...LICENSE_DEFAULTS, ...p };
  switch (type) {
    case 'base':
      return 0;
    case 'extra':
      return bps(feePerCreatorMinor, cfg.extraVariantBps);
    case 'renewal':
      return bps(feePerCreatorMinor, cfg.renewalBps);
    case 'buyout':
      return bps(feePerCreatorMinor, cfg.buyoutBps);
    case 'whitelist':
      return bps(feePerCreatorMinor, cfg.whitelistBps);
  }
}

/** Licence end date. The term is clamped to 35–45 days; buyouts are perpetual (null). */
export function licenseEndsAt(type: LicenseType, startsAt: Date, termDays: number = LICENSE_DEFAULTS.termDays): Date | null {
  if (type === 'buyout') return null;
  return new Date(startsAt.getTime() + clampTermDays(termDays) * 86_400_000);
}
/** A renewal starts when the current licence ends (or now, if it already lapsed) and adds the same term again. */
export function renewalWindow(currentEndsAt: Date | null, now: Date, termDays: number = LICENSE_DEFAULTS.termDays): { startsAt: Date; endsAt: Date } {
  const startsAt = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + clampTermDays(termDays) * 86_400_000) };
}

export interface AgencyInvoiceLine {
  standardMinor: number;
  markupMinor: number;
  clientTotalMinor: number;
  /** split is always computed on the standard price, never the markup */
  split: Split;
}
export function agencyInvoiceLine(standardMinor: number, markupBps: number): AgencyInvoiceLine {
  if (!Number.isInteger(markupBps) || markupBps < 0) throw new Error('markup must be non-negative bps');
  const markupMinor = bps(standardMinor, markupBps);
  return { standardMinor, markupMinor, clientTotalMinor: standardMinor + markupMinor, split: splitPayment(standardMinor) };
}
