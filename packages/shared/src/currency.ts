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

const BANDS_USD_MINOR = [0, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000];
/** Earnings are shown as a band ("$5k+ this month") unless the creator opts in to exact figures. */
export function earningsBand(amountMinor: number, currency: string, viewer: string, rates?: FxRates, suffix = ''): string {
  const usd = convertMinor(amountMinor, isCurrency(currency) ? currency : 'USD', 'USD', rates);
  let floor = 0;
  for (const b of BANDS_USD_MINOR) if (usd >= b) floor = b;
  const tail = suffix ? ` ${suffix}` : '';
  if (floor === 0) {
    return `Under ${displayMoney(BANDS_USD_MINOR[1]!, 'USD', viewer, rates, { compact: true })}${tail}`;
  }
  return `${displayMoney(floor, 'USD', viewer, rates, { compact: true })}+${tail}`;
}
