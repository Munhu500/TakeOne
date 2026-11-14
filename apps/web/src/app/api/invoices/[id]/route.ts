import { NextResponse, type NextRequest } from 'next/server';
import { buildInvoicePdf, INVOICE_SELECT, type InvoicePayment } from '@/lib/invoice-pdf';
import { supabaseServer } from '@/lib/supabase-server';

/** Invoice PDF for one payment (RLS: only the paying brand, its agency, or an admin can read it). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: p } = await sb.from('payments').select(INVOICE_SELECT).eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  const pdf = await buildInvoicePdf(p as unknown as InvoicePayment);
  return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="invoice-${String(p.id).slice(0, 8)}.pdf"` } });
}
