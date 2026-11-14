import { describe, expect, it } from 'vitest';
import { agencyInvoiceLine, campaignCharge, clampTermDays, convertMinor, CREDITS_ENABLED, firstCampaignCredit, formatMoney, LICENSE_DEFAULTS, LICENSE_LABELS, LICENSE_TERM, licenseEndsAt, licensePrice, renewalWindow, splitPayment } from '../src';

describe('split 75/25', () => {
  it('splits a round amount', () => {
    expect(splitPayment(100_00)).toEqual({ grossMinor: 100_00, creatorMinor: 75_00, platformMinor: 25_00 });
  });
  it('always sums to gross and gives the remainder to the creator', () => {
    for (const g of [0, 1, 2, 3, 7, 99, 101, 333, 1_999, 123_457, 99_999_999]) {
      const s = splitPayment(g);
      expect(s.creatorMinor + s.platformMinor).toBe(g);
      expect(s.platformMinor).toBe(Math.floor(g / 4));
      expect(Number.isInteger(s.creatorMinor)).toBe(true);
    }
    expect(splitPayment(3)).toMatchObject({ creatorMinor: 3, platformMinor: 0 });
  });
  it('rejects floats and negatives', () => {
    expect(() => splitPayment(10.5)).toThrow();
    expect(() => splitPayment(-1)).toThrow();
  });
  it('applies to every license type', () => {
    const fee = 40_000_00;
    for (const t of ['extra', 'renewal', 'buyout', 'whitelist'] as const) {
      const s = splitPayment(licensePrice(t, fee));
      expect(s.creatorMinor * 4).toBe(s.grossMinor * 3);
    }
  });
});

describe('license pricing', () => {
  const fee = 1_000_00;
  it('prices add-ons from the per-creator fee', () => {
    expect(licensePrice('base', fee)).toBe(0);
    expect(licensePrice('extra', fee)).toBe(200_00);
    expect(licensePrice('renewal', fee)).toBe(500_00);
    expect(licensePrice('buyout', fee)).toBe(2_000_00);
    expect(licensePrice('whitelist', fee)).toBe(300_00);
  });
  it('honours admin overrides', () => {
    expect(licensePrice('extra', fee, { extraVariantBps: 1_000 })).toBe(100_00);
  });
  it('45-day default term, perpetual buyout', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    expect(LICENSE_DEFAULTS.termDays).toBe(45);
    expect(licenseEndsAt('base', start)?.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    expect(licenseEndsAt('extra', start, 35)?.toISOString()).toBe('2026-02-05T00:00:00.000Z');
    expect(licenseEndsAt('buyout', start)).toBeNull();
  });
  it('term is always 35–45 days', () => {
    expect(LICENSE_TERM).toEqual({ minDays: 35, maxDays: 45, defaultDays: 45 });
    expect([10, 35, 40, 45, 90, NaN].map(clampTermDays)).toEqual([35, 35, 40, 45, 45, 45]);
    expect(clampTermDays(undefined)).toBe(45);
    const start = new Date('2026-01-01T00:00:00Z');
    expect(licenseEndsAt('base', start, 90)?.toISOString()).toBe('2026-02-15T00:00:00.000Z'); // the old 90-day term can no longer be issued
    expect(licenseEndsAt('base', start, 7)?.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });
  it('renewals extend by the same term from the current end date', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    const active = renewalWindow(new Date('2026-03-06T00:00:00Z'), now);
    expect(active.startsAt.toISOString()).toBe('2026-03-06T00:00:00.000Z');
    expect(active.endsAt.toISOString()).toBe('2026-04-20T00:00:00.000Z');
    const lapsed = renewalWindow(new Date('2026-02-01T00:00:00Z'), now, 35);
    expect(lapsed.startsAt).toEqual(now);
    expect(lapsed.endsAt.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });
});

describe('partnership ad (stored as licence type "whitelist")', () => {
  const fee = 18_000_00;
  it('is named "Partnership ad" for display', () => {
    expect(LICENSE_LABELS.whitelist).toBe('Partnership ad');
    expect(Object.values(LICENSE_LABELS).join(' ')).not.toMatch(/whitelist/i);
  });
  it('costs 30% of the per-creator fee and splits 75/25 like every payment', () => {
    const price = licensePrice('whitelist', fee);
    expect(price).toBe(5_400_00);
    expect(splitPayment(price)).toEqual({ grossMinor: 5_400_00, creatorMinor: 4_050_00, platformMinor: 1_350_00 });
    expect(licensePrice('whitelist', fee, { whitelistBps: 2_500 })).toBe(4_500_00);
  });
  it('runs for one licence term', () => {
    expect(licenseEndsAt('whitelist', new Date('2026-01-01T00:00:00Z'))?.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });
});

describe('campaign credit is switched off', () => {
  it('flag is off by default', () => {
    expect(CREDITS_ENABLED).toBe(false);
  });
  it('no credit is issued and none is applied, whatever balance exists', () => {
    expect(firstCampaignCredit(4_000_00)).toBe(0);
    const c = campaignCharge(1_000_00, 4, 600_00);
    expect(c.creditAppliedMinor).toBe(0);
    expect(c.payableMinor).toBe(c.grossMinor);
    expect(c.platformNetMinor).toBe(c.platformFeeMinor);
    expect(c.creatorPoolMinor).toBe(3_000_00);
  });
});

describe('brand credit (Option B) — legacy path behind the flag', () => {
  const on = { creditsEnabled: true };
  it('issues 25% of the first campaign value', () => {
    expect(firstCampaignCredit(4_000_00, on)).toBe(1_000_00);
  });
  it('applies credit only against the platform fee', () => {
    const c = campaignCharge(1_000_00, 4, 600_00, on);
    expect(c.grossMinor).toBe(4_000_00);
    expect(c.platformFeeMinor).toBe(1_000_00);
    expect(c.creditAppliedMinor).toBe(600_00);
    expect(c.payableMinor).toBe(3_400_00);
    expect(c.platformNetMinor).toBe(400_00);
    expect(c.creatorPoolMinor).toBe(3_000_00);
  });
  it('never reduces creator payouts, even with more credit than fee', () => {
    const c = campaignCharge(1_000_00, 4, 9_999_00, on);
    expect(c.creditAppliedMinor).toBe(1_000_00);
    expect(c.creatorPoolMinor).toBe(3_000_00);
    expect(c.payableMinor).toBe(c.creatorPoolMinor);
    expect(c.platformNetMinor).toBe(0);
  });
  it('no credit → brand pays gross', () => {
    expect(campaignCharge(333, 3).payableMinor).toBe(999);
    expect(campaignCharge(333, 3).creatorPoolMinor).toBe(splitPayment(333).creatorMinor * 3);
  });
});

describe('agency markup', () => {
  it('splits on the standard price, not the markup', () => {
    const l = agencyInvoiceLine(1_000_00, 2_000);
    expect(l.clientTotalMinor).toBe(1_200_00);
    expect(l.split).toEqual(splitPayment(1_000_00));
  });
});

describe('currency', () => {
  it('converts with integer results and round-trips closely', () => {
    const inr = convertMinor(19_00, 'USD', 'INR');
    expect(Number.isInteger(inr)).toBe(true);
    expect(inr).toBe(1_596_64);
    expect(Math.abs(convertMinor(inr, 'INR', 'USD') - 19_00)).toBeLessThanOrEqual(1);
    expect(convertMinor(500, 'AED', 'AED')).toBe(500);
  });
  it('summaries have no decimals; invoices always do', () => {
    expect(formatMoney(57_731_149, 'INR', { decimals: 'never' })).toBe('₹5,77,311');
    expect(formatMoney(1_540_000, 'AED', { decimals: 'never' })).toMatch(/^AED\s15,400$/);
    expect(formatMoney(2_500_000, 'INR', { decimals: 'always' })).toBe('₹25,000.00');
  });
  it('formats in local currency', () => {
    expect(formatMoney(2_500_000, 'INR')).toBe('₹25,000');
    expect(formatMoney(19_99, 'USD')).toBe('$19.99');
    expect(formatMoney(1_500_00, 'AED')).toContain('1,500');
  });
});
