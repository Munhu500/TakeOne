'use server';
import { resolveCname } from 'node:dns/promises';

export type DomainStatus = 'verified' | 'not_detected' | 'unavailable';
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Looks up the domain's CNAME and compares it with the address clients should point at. Read-only; nothing is stored. */
export async function checkDomain(domain: string, target: string): Promise<DomainStatus> {
  if (!DOMAIN.test(domain)) return 'not_detected';
  try {
    const records = await resolveCname(domain);
    return records.some((r) => r.replace(/\.$/, '').toLowerCase() === target.toLowerCase()) ? 'verified' : 'not_detected';
  } catch {
    return 'not_detected';
  }
}
