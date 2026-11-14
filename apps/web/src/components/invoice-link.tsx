export function InvoiceLink({ paymentId, label }: { paymentId: string; label: string }) {
  return <a className="text-caption text-accent-text underline-offset-4 hover:underline" href={`/api/invoices/${paymentId}`} target="_blank" rel="noreferrer">{label}</a>;
}
