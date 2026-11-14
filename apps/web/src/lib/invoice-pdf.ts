import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { agencyInvoiceLine, CURRENCIES, type CurrencyCode } from '@takeone/shared';

/** Columns the invoice needs; the same select is used by the API route and the static-preview button. */
export const INVOICE_SELECT = '*, campaigns(title), brands(name, country, markup_bps, agency_id, agencies(name, primary_color, markup_default_bps))';
export interface InvoicePayment {
  id: string; kind: string; status: string; created_at: string; currency: string; gross_minor: number | string; amount_minor: number | string; credit_applied_minor: number | string; metadata: unknown;
  campaigns: { title: string } | null;
  brands: { name: string; country: string; markup_bps: number | null; agencies: { name: string; primary_color: string; markup_default_bps: number } | null };
}

// The built-in PDF fonts are Latin-only, so amounts print with the currency code instead of ₹.
function amount(minor: number, currency: string): string {
  const d = CURRENCIES[currency as CurrencyCode]?.decimals ?? 2;
  const s = String(Math.abs(minor)).padStart(d + 1, '0');
  return `${minor < 0 ? '-' : ''}${currency} ${s.slice(0, -d).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${s.slice(-d)}`;
}
function hex(h: string) {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Agency clients get an agency-branded invoice at the agency's marked-up price; TakeOne is never mentioned on it.
 * The 75/25 split is always calculated on the standard price, not on the markup.
 */
export async function buildInvoicePdf(p: InvoicePayment): Promise<Uint8Array> {
  const brand = p.brands;
  const agency = brand.agencies;
  const markupBps = agency ? brand.markup_bps ?? agency.markup_default_bps : 0;
  const line = agencyInvoiceLine(Number(p.gross_minor), markupBps);
  const credit = agency ? 0 : Number(p.credit_applied_minor);
  const total = agency ? line.clientTotalMinor : Number(p.amount_minor);
  const issuer = agency?.name ?? 'TakeOne';
  const accent = hex(agency?.primary_color ?? '#7C5CFF');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.07, 0.09), grey = rgb(0.45, 0.45, 0.5);
  const text = (t: string, x: number, y: number, size = 10, f = font, color = ink) => page.drawText(t.replace(/[^\x20-\x7E]/g, '-'), { x, y, size, font: f, color });
  const right = (t: string, y: number, size = 10, f = font, color = ink) => text(t, 545 - f.widthOfTextAtSize(t, size), y, size, f, color);

  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: accent });
  text(issuer, 50, 805, 20, bold, rgb(1, 1, 1));
  right('INVOICE', 808, 12, bold, rgb(1, 1, 1));
  text('Billed to', 50, 740, 9, font, grey); text(brand.name, 50, 724, 13, bold);
  right(`Invoice ${String(p.id).slice(0, 8).toUpperCase()}`, 740, 10, bold);
  right(new Date(p.created_at).toISOString().slice(0, 10), 724, 10, font, grey);
  right(p.status === 'refunded' ? 'REFUNDED' : 'PAID', 708, 10, bold, accent);

  let y = 660;
  text('Description', 50, y, 9, bold, grey); right('Amount', y, 9, bold, grey);
  page.drawLine({ start: { x: 50, y: y - 8 }, end: { x: 545, y: y - 8 }, thickness: 0.7, color: rgb(0.85, 0.85, 0.88) });
  y -= 30;
  const title = p.campaigns?.title ?? 'Campaign';
  const what = p.kind === 'license' ? `Usage license (${(p.metadata as { type?: string })?.type ?? 'add-on'}): ${title}` : `Creator campaign: ${title}`;
  text(what.slice(0, 78), 50, y, 11); right(amount(agency ? line.clientTotalMinor : line.standardMinor, p.currency), y, 11);
  text(p.kind === 'license' ? 'Paid-ad usage rights for one ad variant' : 'Creator fees, ad variants and 90-day paid-ad usage for selected variants', 50, y - 15, 9, font, grey);
  y -= 50;
  if (credit > 0) { text('Campaign credit (applied to platform fee)', 50, y, 11); right(`-${amount(credit, p.currency).replace('-', '')}`, y, 11); y -= 30; }
  page.drawLine({ start: { x: 320, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 0.7, color: rgb(0.85, 0.85, 0.88) });
  text('Total', 320, y - 12, 12, bold); right(amount(total, p.currency), y - 12, 14, bold);
  text(p.kind === 'campaign' ? 'Campaign funds are held in escrow and released when each submission is approved.' : 'License payments are final once the files are unlocked.', 50, 90, 9, font, grey);
  text(`Issued by ${issuer}.`, 50, 74, 9, font, grey);
  return pdf.save();
}
