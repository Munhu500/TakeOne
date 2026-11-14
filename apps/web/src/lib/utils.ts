import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const DEMO = (process.env.NEXT_PUBLIC_DEMO_MODE ?? 'true') !== 'false';
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
/** Product images, logos and avatars are stored as paths in the public-assets bucket (or absolute URLs). */
export function assetUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  return /^https?:\/\//.test(p) ? p : `${SUPABASE_URL}/storage/v1/object/public/public-assets/${p}`;
}
export function timeAgo(d: string | Date): string {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const f = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'} ago`;
  if (s < 60) return 'just now';
  if (s < 3600) return f(Math.floor(s / 60), 'min');
  if (s < 86400) return f(Math.floor(s / 3600), 'hour');
  return f(Math.floor(s / 86400), 'day');
}
export function daysLeft(d: string | Date): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
