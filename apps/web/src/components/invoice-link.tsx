import { Download } from 'lucide-react';
import { ICON } from '@/components/ui';

/** Opens the invoice PDF. `view="cost"` is an agency's own invoice at the standard price; the default is the client's. */
export function InvoiceLink({ paymentId, label, view, icon }: { paymentId: string; label: string; view?: 'cost'; icon?: boolean }) {
  const href = `/api/invoices/${paymentId}${view ? `?view=${view}` : ''}`;
  if (icon) return <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="inline-grid size-9 place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary"><Download size={20} {...ICON} /></a>;
  return <a className="inline-flex items-center gap-1 whitespace-nowrap text-caption text-accent-text underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer"><Download size={12} {...ICON} aria-hidden />{label}</a>;
}
