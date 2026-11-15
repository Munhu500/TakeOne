'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { ICON } from '@/components/ui';
import { buildInvoicePdf, INVOICE_SELECT, type InvoicePayment } from '@/lib/invoice-pdf';
import { invoiceLogo } from '@/lib/invoice-logo';
import { supabaseBrowser } from '@/lib/supabase-browser';

/** Static preview: the same invoice is built in the browser (RLS still decides who can read the payment). */
export function InvoiceLink({ paymentId, label, view, icon }: { paymentId: string; label: string; view?: 'cost'; icon?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  return (
    <button aria-label={icon ? label : undefined} title={icon ? label : undefined} className={icon ? 'inline-grid size-9 place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary disabled:opacity-50' : 'inline-flex items-center gap-1 whitespace-nowrap text-caption text-accent-text underline-offset-4 hover:underline disabled:opacity-50'} disabled={state === 'busy'} onClick={async () => {
      setState('busy');
      const { data } = await supabaseBrowser().from('payments').select(INVOICE_SELECT).eq('id', paymentId).maybeSingle();
      if (!data) return setState('error');
      const pdf = await buildInvoicePdf(data as unknown as InvoicePayment, { view: view ?? 'client', logo: await invoiceLogo(data as unknown as InvoicePayment, view ?? 'client', '') });
      // a download link works where pop-ups opened after an async step would be blocked
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
      a.download = `invoice-${paymentId.slice(0, 8)}${view ? '-cost' : ''}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setState('idle');
    }}>{icon ? <Download size={20} {...ICON} /> : <><Download size={12} {...ICON} aria-hidden />{state === 'busy' ? 'Preparing…' : state === 'error' ? 'Invoice not available' : label}</>}</button>
  );
}
