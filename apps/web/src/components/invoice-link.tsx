export function InvoiceLink({ paymentId, label }: { paymentId: string; label: string }) {
  return <a className="text-xs text-accent hover:underline" href={`/api/invoices/${paymentId}`} target="_blank" rel="noreferrer">{label}</a>;
}
