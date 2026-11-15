import { COUNTRIES, type CountryCode } from './config';
import type { CurrencyCode } from './currency';

/** "beauty" → "Beauty". Stored values stay lower-case; people always see the display name. */
export const categoryLabel = (c: string): string => (c ? c[0]!.toUpperCase() + c.slice(1) : c);
/** "IN" → "India". */
export const countryName = (code: string): string => (code === 'US' ? 'International' : COUNTRIES[code as CountryCode]?.name ?? code);

/**
 * Two or three characters for a product tile when there is no photo. A short name set on the campaign wins;
 * otherwise an upper-case code already in the name ("SPF"), otherwise the initials of the first two words.
 */
export function productShortName(name: string, shortName?: string | null): string {
  const set = shortName?.trim();
  if (set) return set.slice(0, 3).toUpperCase();
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((w) => /\p{L}/u.test(w));
  const code = words.find((w) => w.length >= 2 && w.length <= 3 && w === w.toUpperCase());
  if (code) return code;
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

export interface ProPrice { currency: CurrencyCode; minor: number }
export type ProPrices = { default: ProPrice } & Record<string, ProPrice>;
/** Creator Pro is a fixed price per market, never an FX conversion. Mirrors the `pro_prices` setting. */
export const PRO_PRICES: ProPrices = {
  IN: { currency: 'INR', minor: 69_900 },
  AE: { currency: 'AED', minor: 6_900 },
  default: { currency: 'USD', minor: 1_900 },
};
export function proPriceFor(country: string | null | undefined, prices: ProPrices | null | undefined = PRO_PRICES): ProPrice {
  const p = prices && typeof prices === 'object' && prices.default ? prices : PRO_PRICES;
  const hit = country ? p[country] : undefined;
  return hit && Number.isInteger(hit.minor) && hit.minor > 0 ? hit : p.default;
}

/** Starter copy for the demo's product draft (no page is read in demo mode). Never mentions how the real service works. */
export function demoProductDraft(name: string): { description: string; key_benefits: string[] } {
  const n = name.toLowerCase();
  if (/rosehip|face oil/.test(n)) return { description: `${name} is a cold-pressed facial oil for dry and sensitive skin, used as the last step of an evening routine.`, key_benefits: ['Lightweight, absorbs in seconds', 'Cold-pressed rosehip oil', 'Suits dry and sensitive skin'] };
  if (/serum|cream|moistur|sunscreen|spf|cleanser|oil|mist|balm/.test(n)) return { description: `${name} is an everyday skincare step made for dry and sensitive skin.`, key_benefits: ['Lightweight, absorbs in seconds', 'Suits dry and sensitive skin', 'Fragrance-free'] };
  return { description: `${name}. Add a sentence or two about what it is and who it is for.`, key_benefits: ['Solves an everyday problem', 'Easy to use from day one', 'Looks good on camera'] };
}
