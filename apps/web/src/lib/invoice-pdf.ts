import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { fmtDate } from './utils';
import { color, DEFAULT_ACCENT, deriveAccent, INK, PAPER, parseHex } from '@takeone/design-tokens';
import { agencyInvoiceLine, CURRENCIES, LICENSE_DEFAULTS, LICENSE_LABELS, type CurrencyCode, type LicenseType } from '@takeone/shared';

/** Columns the invoice needs; the same select is used by the API route and the static-preview button. */
export const INVOICE_SELECT = '*, campaigns(title), brands(name, country, markup_bps, agency_id, agencies(name, logo, primary_color, markup_default_bps))';
export interface InvoicePayment {
  id: string; kind: string; status: string; created_at: string; currency: string; gross_minor: number | string; amount_minor: number | string; credit_applied_minor: number | string; metadata: unknown;
  campaigns: { title: string } | null;
  brands: { name: string; country: string; markup_bps: number | null; agencies: { name: string; logo?: string | null; primary_color: string; markup_default_bps: number } | null };
}

// The built-in PDF fonts are Latin-only, so amounts print with the currency code instead of ₹.
function amount(minor: number, currency: string): string {
  const d = CURRENCIES[currency as CurrencyCode]?.decimals ?? 2;
  const s = String(Math.abs(minor)).padStart(d + 1, '0');
  return `${minor < 0 ? '-' : ''}${currency} ${s.slice(0, -d).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${s.slice(-d)}`;
}
/** Design-token colour → pdf-lib colour. Invoices print on white, so they use the light theme's text colours. */
function pdfColor(hexColor: string) {
  const [r, g, b] = parseHex(hexColor);
  return rgb(r / 255, g / 255, b / 255);
}

/**
 * Agency clients get an agency-branded invoice at the agency's marked-up price; TakeOne is never mentioned on it.
 * The 75/25 split is always calculated on the standard price, not on the markup.
 */
export async function buildInvoicePdf(p: InvoicePayment, opts: { view?: 'client' | 'cost'; /** the issuer's mark: TakeOne's public/brand/logo-mark.png, or the agency's own logo (PNG or JPG) */ logo?: { bytes: Uint8Array; type: 'png' | 'jpg' } | null } = {}): Promise<Uint8Array> {
  const brand = p.brands;
  // 'cost' is the agency's own invoice from TakeOne at the standard price; 'client' (default) is what the client is billed
  const agency = opts.view === 'cost' ? null : brand.agencies;
  const billedTo = opts.view === 'cost' && brand.agencies ? `${brand.agencies.name} (for ${brand.name})` : brand.name;
  const markupBps = agency ? brand.markup_bps ?? agency.markup_default_bps : 0;
  const line = agencyInvoiceLine(Number(p.gross_minor), markupBps);
  const credit = agency ? 0 : Number(p.credit_applied_minor);
  const total = agency ? line.clientTotalMinor : Number(p.amount_minor);
  const issuer = agency?.name ?? 'TakeOne';
  // header band carries a white label, so it uses the generated fill; the status word uses the accent text colour for paper
  const a = deriveAccent(agency?.primary_color ?? DEFAULT_ACCENT, 'light');
  const accent = pdfColor(a.accent), accentText = pdfColor(a['accent-text']);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = pdfColor(INK), grey = pdfColor(color.light['text-tertiary']), paper = pdfColor(PAPER), rule = pdfColor(color.light['surface-3']);
  const text = (t: string, x: number, y: number, size = 10, f = font, color = ink) => page.drawText(t.replace(/[^\x20-\x7E]/g, '-'), { x, y, size, font: f, color });
  const right = (t: string, y: number, size = 10, f = font, color = ink) => text(t, 545 - f.widthOfTextAtSize(t, size), y, size, f, color);

  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: accent });
  let nameX = 50;
  if (opts.logo) {
    try {
      const img = opts.logo.type === 'png' ? await pdf.embedPng(opts.logo.bytes) : await pdf.embedJpg(opts.logo.bytes);
      const h = 32, w = Math.min(120, (img.width / img.height) * h);
      page.drawImage(img, { x: 50, y: 796, width: w, height: h });
      nameX = 50 + w + 12;
    } catch { /* an unreadable logo never blocks an invoice: fall back to the name alone */ }
  }
  text(issuer, nameX, 805, 20, bold, paper);
  right('INVOICE', 808, 12, bold, paper);
  text('Billed to', 50, 740, 9, font, grey); text(billedTo, 50, 724, 13, bold);
  right(`Invoice ${String(p.id).slice(0, 8).toUpperCase()}`, 740, 10, bold);
  right(fmtDate(p.created_at), 724, 10, font, grey);
  right(p.status === 'refunded' ? 'REFUNDED' : 'PAID', 708, 10, bold, accentText);

  let y = 660;
  text('Description', 50, y, 9, bold, grey); right('Amount', y, 9, bold, grey);
  page.drawLine({ start: { x: 50, y: y - 8 }, end: { x: 545, y: y - 8 }, thickness: 0.7, color: rule });
  y -= 30;
  const title = p.campaigns?.title ?? 'Campaign';
  const licenceType = (p.metadata as { type?: LicenseType } | null)?.type;
  // "whitelist" is always printed as "Partnership ad"
  const what = p.kind === 'license' ? `${licenceType ? LICENSE_LABELS[licenceType] : 'Licence add-on'}: ${title}` : `Creator campaign: ${title}`;
  text(what.slice(0, 78), 50, y, 11); right(amount(agency ? line.clientTotalMinor : line.standardMinor, p.currency), y, 11);
  text(p.kind === 'license' ? 'Paid-ad usage rights for one ad variant' : `Creator fees, ad variants and ${LICENSE_DEFAULTS.termDays}-day paid-ad usage for selected variants`, 50, y - 15, 9, font, grey);
  y -= 50;
  if (credit > 0) { text('Campaign credit (applied to platform fee)', 50, y, 11); right(`-${amount(credit, p.currency).replace('-', '')}`, y, 11); y -= 30; }
  page.drawLine({ start: { x: 320, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 0.7, color: rule });
  text('Total', 320, y - 12, 12, bold); right(amount(total, p.currency), y - 12, 14, bold);
  text(p.kind === 'campaign' ? 'Campaign funds are held in escrow and released when each submission is approved.' : 'Licence payments are final once the files are unlocked.', 50, 90, 9, font, grey);
  text(`Issued by ${issuer}.`, 50, 74, 9, font, grey);
  return pdf.save();
}
