'use client';
import { useState } from 'react';
import { buildInvoicePdf, INVOICE_SELECT, type InvoicePayment } from '@/lib/invoice-pdf';
import { supabaseBrowser } from '@/lib/supabase-browser';

/** Static preview: the same invoice is built in the browser (RLS still decides who can read the payment). */
export function InvoiceLink({ paymentId, label }: { paymentId: string; label: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  return (
    <button className="text-caption text-accent-text hover:underline disabled:opacity-50" disabled={state === 'busy'} onClick={async () => {
      setState('busy');
      const { data } = await supabaseBrowser().from('payments').select(INVOICE_SELECT).eq('id', paymentId).maybeSingle();
      if (!data) return setState('error');
      const pdf = await buildInvoicePdf(data as unknown as InvoicePayment);
      // a download link works where pop-ups opened after an async step would be blocked
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
      a.download = `invoice-${paymentId.slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setState('idle');
    }}>{state === 'busy' ? 'Preparing…' : state === 'error' ? 'Invoice not available' : label}</button>
  );
}
