import { describe, expect, it } from 'vitest';
import { agencyInvoiceLine, campaignCharge, convertMinor, firstCampaignCredit, formatMoney, licenseEndsAt, licensePrice, splitPayment } from '../src';

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
  it('90-day term, perpetual buyout', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    expect(licenseEndsAt('base', start)?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(licenseEndsAt('buyout', start)).toBeNull();
  });
});

describe('brand credit (Option B)', () => {
  it('issues 25% of the first campaign value', () => {
    expect(firstCampaignCredit(4_000_00)).toBe(1_000_00);
  });
  it('applies credit only against the platform fee', () => {
    const c = campaignCharge(1_000_00, 4, 600_00);
    expect(c.grossMinor).toBe(4_000_00);
    expect(c.platformFeeMinor).toBe(1_000_00);
    expect(c.creditAppliedMinor).toBe(600_00);
    expect(c.payableMinor).toBe(3_400_00);
    expect(c.platformNetMinor).toBe(400_00);
    expect(c.creatorPoolMinor).toBe(3_000_00);
  });
  it('never reduces creator payouts, even with more credit than fee', () => {
    const c = campaignCharge(1_000_00, 4, 9_999_00);
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
  it('formats in local currency', () => {
    expect(formatMoney(2_500_000, 'INR')).toBe('₹25,000');
    expect(formatMoney(19_99, 'USD')).toBe('$19.99');
    expect(formatMoney(1_500_00, 'AED')).toContain('1,500');
  });
});
