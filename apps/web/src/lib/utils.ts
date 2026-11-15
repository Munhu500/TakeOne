import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { formatMoney } from '@takeone/shared';

// tailwind-merge needs to know the token names, or it would treat `text-small` and `text-secondary` as the same kind of class
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body-lg', 'body', 'small', 'caption', 'stat', 'stat-sm'] }],
      rounded: [{ rounded: ['none', 'sm', 'md', 'lg', 'xl', 'full'] }],
      z: [{ z: ['base', 'sticky', 'nav', 'dropdown', 'drawer', 'modal', 'toast'] }],
    },
  },
});
export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const DEMO = (process.env.NEXT_PUBLIC_DEMO_MODE ?? 'true') !== 'false';
export const STATIC_PREVIEW = process.env.NEXT_PUBLIC_STATIC_PREVIEW === 'true';
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Logos and avatars are stored as paths in the public-assets bucket (or absolute URLs). */
export function assetUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  return /^https?:\/\//.test(p) ? p : `${SUPABASE_URL}/storage/v1/object/public/public-assets/${p}`;
}
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "1 day", "2 days", "1 creator". Pass `plural` for irregular words. */
export function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString('en')} ${Math.abs(n) === 1 ? singular : plural}`;
}
export function timeAgo(d: string | Date): string {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${pluralise(Math.floor(s / 60), 'minute')} ago`;
  if (s < 86400) return `${pluralise(Math.floor(s / 3600), 'hour')} ago`;
  return `${pluralise(Math.floor(s / 86400), 'day')} ago`;
}
export function daysLeft(d: string | Date): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}
/** "4 days left", "1 day left", "Ends today", "Ended". */
export function daysLeftLabel(d: string | Date): string {
  const n = daysLeft(d);
  return n > 0 ? `${pluralise(n, 'day')} left` : n === 0 ? 'Ends today' : 'Ended';
}
/** Dates read "15 Nov 2026" everywhere. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** One date format everywhere, with three-letter months: "30 Sep 2026" (the browser's own en-GB short form says "Sept"). */
export function fmtDate(d: string | Date): string {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}

/** Sentence case for labels and statuses: "in_progress" → "In progress". Known acronyms stay upper-case. */
const ACRONYMS = /\b(upi|ifsc|iban|kyc|pan|qa|ai|api|id|uae|usd|inr|aed|fx|pdf|url)\b/gi;
export function sentenceCase(s: string): string {
  const t = s.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return (t.charAt(0).toUpperCase() + t.slice(1)).replace(ACRONYMS, (m) => m.toUpperCase());
}
/** @deprecated use sentenceCase — UI labels are sentence case */
export const titleCase = sentenceCase;

/**
 * Avatar initials: first letters of the first and last word of the name, ignoring anything in brackets or after a separator.
 * "Neha (Kaya Glow)" → "N"; "TakeOne Admin" → "TA"; "Chai & Co" → "CC". Max 2 letters.
 */
export function initials(name: string): string {
  const core = name.replace(/\(.*?\)|\[.*?\]/g, ' ').split(/\s[-–—|·:/]\s|,/)[0]!.trim();
  const words = core.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return '?';
  const first = [...words[0]!].find((c) => /[\p{L}\p{N}]/u.test(c)) ?? '';
  const last = words.length > 1 ? [...words[words.length - 1]!].find((c) => /[\p{L}\p{N}]/u.test(c)) ?? '' : '';
  return (first + last).toUpperCase();
}

/** Money in the given currency with local grouping. Summaries show no decimals; pass `precise` for invoices. */
export function money(minor: number | string | null | undefined, currency: string, opts: { precise?: boolean; compact?: boolean } = {}): string {
  return formatMoney(Number(minor ?? 0), currency, { compact: opts.compact, decimals: opts.precise ? 'always' : 'never' });
}
