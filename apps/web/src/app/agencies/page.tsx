import Link from 'next/link';
import { MarketingFrame } from '@/components/landing/sections';
import { btn } from '@/components/ui';
import { publicOnly } from '@/lib/public-only';

const BENEFITS = [
  ['Your brand, not ours', 'Your logo, colour and domain on every screen your clients see.'],
  ['One workspace per client', 'Run each client’s campaigns separately, with the same brief-to-licence flow.'],
  ['Your pricing', 'Set your own markup per client. Invoices go out in your name.'],
] as const;

export default async function Agencies() {
  await publicOnly();
  return (
    <MarketingFrame preselect="brands">
      <div className="container-page py-24">
        <p className="caption-label">For agencies</p>
        <h1 className="mt-4 max-w-3xl text-h1">Run TakeOne under your own brand for every client.</h1>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {BENEFITS.map(([t, d], i) => <div key={t} className="border-t border-border-strong pt-6"><div className="tabular caption-label">0{i + 1}</div><h2 className="mt-4 text-h3">{t}</h2><p className="mt-3 text-body text-secondary">{d}</p></div>)}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/signup?role=agency" className={btn('primary', 'lg')}>Create an agency account</Link>
          <Link href="/demo" className={btn('secondary', 'lg')}>Book a demo</Link>
        </div>
      </div>
    </MarketingFrame>
  );
}
