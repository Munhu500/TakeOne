import { LICENSE_LABELS, type LicenseType } from '@takeone/shared';

/** What a payment was for, in the words used on every billing screen: Campaign, Renewal, Partnership ad, Extra variant, Buyout. */
export function lineType(p: { kind: string; metadata: unknown }): string {
  const t = (p.metadata as { type?: LicenseType } | null)?.type;
  return p.kind === 'license' ? (t ? LICENSE_LABELS[t] : 'Licence') : 'Campaign';
}
