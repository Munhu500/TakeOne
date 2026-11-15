import { COUNTRIES, type CountryCode } from './config';

export const CURRENCIES = {
  USD: { symbol: '$', decimals: 2, locale: 'en-US' },
  INR: { symbol: '₹', decimals: 2, locale: 'en-IN' },
  AED: { symbol: 'AED', decimals: 2, locale: 'en-AE' },
} as const;
export type CurrencyCode = keyof typeof CURRENCIES;
export const BASE_CURRENCY: CurrencyCode = 'USD';

export function isCurrency(c: string): c is CurrencyCode {
  return c in CURRENCIES;
}
export function currencyForCountry(country: string): CurrencyCode {
  return (COUNTRIES[country as CountryCode]?.currency ?? 'USD') as CurrencyCode;
}

/** USD value of 1 unit of each currency, as stored in fx_rates.rate_to_usd. */
export type FxRates = Partial<Record<CurrencyCode, number>>;
export const DEFAULT_FX: Required<FxRates> = { USD: 1, INR: 0.0119, AED: 0.2723 };

const PPM = 1_000_000n;
function ppm(rate: number): bigint {
  return BigInt(Math.round(rate * 1_000_000));
}
function divRound(n: bigint, d: bigint): bigint {
  return (n + d / 2n) / d;
}

/** Convert minor units between currencies using integer (ppm) arithmetic. All supported currencies have 2 decimals. */
export function convertMinor(amountMinor: number, from: CurrencyCode, to: CurrencyCode, rates: FxRates = DEFAULT_FX): number {
  assertMinor(amountMinor);
  if (from === to) return amountMinor;
  const rf = ppm(rates[from] ?? DEFAULT_FX[from]);
  const rt = ppm(rates[to] ?? DEFAULT_FX[to]);
  if (rt === 0n) throw new Error(`No FX rate for ${to}`);
  return Number(divRound(BigInt(amountMinor) * rf, rt));
}
export const toUsdMinor = (a: number, from: CurrencyCode, r?: FxRates) => convertMinor(a, from, 'USD', r);
void PPM;

export function assertMinor(n: number): void {
  if (!Number.isSafeInteger(n)) throw new Error(`Money must be an integer in minor units, got ${n}`);
}

export interface MoneyFormat {
  compact?: boolean;
  locale?: string;
  /** 'auto' (default): decimals only when the amount has them · 'never': summaries · 'always': invoices */
  decimals?: 'auto' | 'never' | 'always';
}
export function formatMoney(amountMinor: number, currency: string, opts: MoneyFormat = {}): string {
  const cur = isCurrency(currency) ? currency : 'USD';
  const { decimals, locale } = CURRENCIES[cur];
  const major = amountMinor / 10 ** decimals; // display only
  const whole = amountMinor % 10 ** decimals === 0;
  const mode = opts.decimals ?? 'auto';
  const show = mode === 'always' || (mode === 'auto' && !whole);
  try {
    return new Intl.NumberFormat(opts.locale ?? locale, {
      style: 'currency',
      currency: cur,
      notation: opts.compact ? 'compact' : 'standard',
      minimumFractionDigits: opts.compact || !show ? 0 : decimals,
      maximumFractionDigits: opts.compact ? 1 : show ? decimals : 0,
    }).format(major);
  } catch {
    return `${CURRENCIES[cur].symbol}${major.toFixed(show ? decimals : 0)}`;
  }
}

/** Show an amount stored in one currency in the viewer's currency. */
export function displayMoney(amountMinor: number, from: string, viewer: string, rates?: FxRates, opts?: { compact?: boolean }): string {
  const f = isCurrency(from) ? from : 'USD';
  const v = isCurrency(viewer) ? viewer : 'USD';
  return formatMoney(convertMinor(amountMinor, f, v, rates), v, opts);
}

/**
 * Short local-style amount with no minor units: ₹4.2L, ₹1.3Cr, AED 15K, $5K. Indian amounts use lakh and crore.
 * Rounds down so a band floor is never overstated.
 */
export function compactLocal(amountMinor: number, currency: string): string {
  const cur = isCurrency(currency) ? currency : 'USD';
  const major = Math.floor(amountMinor / 10 ** CURRENCIES[cur].decimals);
  const steps: [number, string][] = cur === 'INR' ? [[1e7, 'Cr'], [1e5, 'L'], [1e3, 'K']] : [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  const prefix = cur === 'INR' ? '₹' : cur === 'AED' ? 'AED ' : '$';
  for (const [size, unit] of steps) {
    if (major >= size) {
      const n = Math.floor((major / size) * 10) / 10;
      return `${prefix}${n >= 100 || Number.isInteger(n) ? Math.floor(n) : n.toFixed(1)}${unit}`;
    }
  }
  return `${prefix}${major}`;
}

/** Band floors in whole units of each currency. Bands are set per market, not converted from one another. */
const EARNINGS_BANDS: Record<CurrencyCode, number[]> = {
  INR: [25_000, 50_000, 100_000, 200_000, 300_000, 500_000, 800_000, 1_200_000, 2_000_000],
  AED: [1_000, 2_500, 5_000, 10_000, 15_000, 25_000, 40_000, 60_000],
  USD: [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000],
};
/** Earnings are shown as a band ("₹3L+ this month", "AED 15K+") unless the creator opts in to exact figures. */
export function earningsBand(amountMinor: number, currency: string, viewer: string, rates?: FxRates, suffix = ''): string {
  const v = isCurrency(viewer) ? viewer : 'USD';
  const unit = 10 ** CURRENCIES[v].decimals;
  const amount = convertMinor(amountMinor, isCurrency(currency) ? currency : 'USD', v, rates) / unit;
  const bands = EARNINGS_BANDS[v];
  const floor = bands.filter((b) => amount >= b).pop();
  const tail = suffix ? ` ${suffix}` : '';
  return floor === undefined ? `Under ${compactLocal(bands[0]! * unit, v)}${tail}` : `${compactLocal(floor * unit, v)}+${tail}`;
}
/** Exact earnings for creators who opted in: whole units only, never paise or fils. */
export function exactEarnings(amountMinor: number, currency: string, viewer: string, rates?: FxRates): string {
  const v = isCurrency(viewer) ? viewer : 'USD';
  return formatMoney(convertMinor(amountMinor, isCurrency(currency) ? currency : 'USD', v, rates), v, { decimals: 'never' });
}
