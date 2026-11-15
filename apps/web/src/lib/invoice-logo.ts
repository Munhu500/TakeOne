import { brandFile } from '@/components/ui/media';
import type { InvoicePayment } from './invoice-pdf';

type Logo = { bytes: Uint8Array; type: 'png' | 'jpg' } | null;
const kind = (url: string): 'png' | 'jpg' | null => (/\.png(\?|$)/i.test(url) ? 'png' : /\.jpe?g(\?|$)/i.test(url) ? 'jpg' : null);

/**
 * The mark printed on an invoice. Client invoices from an agency carry the agency's logo; everything else carries
 * TakeOne's /brand/logo-mark.png when that file exists. PDFs cannot embed SVG, so other formats are skipped.
 * `origin` is the site's own address (the server passes its request origin; the browser passes '').
 */
export async function invoiceLogo(p: InvoicePayment, view: 'client' | 'cost', origin: string): Promise<Logo> {
  const agencyLogo = view === 'client' ? p.brands.agencies?.logo : null;
  // TakeOne's mark is only requested when the file has actually been supplied
  const own = brandFile('logo-mark', ['png']);
  const url = p.brands.agencies && view === 'client' ? agencyLogo : own ? `${origin}${own}` : null;
  const type = url ? kind(url) : null;
  if (!url || !type) return null;
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length > 0 && bytes.length < 2_000_000 ? { bytes, type } : null;
  } catch { return null; }
}
