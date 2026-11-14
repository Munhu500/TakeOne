import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, Languages, Layers, ShieldCheck, Wallet, Lock } from 'lucide-react';
import { FORMAT_LIST, LICENSE_DEFAULTS } from '@takeone/shared';
import { hostAgency } from '@/lib/session';
import { Badge, Card, DemoPill, ICON, LinkButton, VideoFrame } from '@/components/ui';
import { Wordmark } from '@/components/shell';
import { DEMO } from '@/lib/utils';

export default async function Landing() {
  if (await hostAgency()) redirect('/login'); // white-label hosts go straight to the client workspace
  const steps = [
    ['Brands post a brief', 'Paste a product link. The brief and a creator shot list are drafted for you to edit, and the budget goes into escrow.'],
    ['Creators shoot one take', 'A guided capture with the real product in hand. One honest take, no script changes.'],
    ['The Variant Engine cuts ten ads', 'Hook-first, tight testimonial, silent montage, new scenes and languages, ranked against your brief.'],
    ['License the winners', `Pick up to three in the base fee for ${LICENSE_DEFAULTS.termDays} days of paid usage, add more as you scale, and pay one invoice.`],
  ];
  const points = [
    [Layers, 'Ten formats from one take', 'Five in the first release, five to follow. Every variant exports in 9:16, 4:5 and 1:1.'],
    [ShieldCheck, 'Real product, real opinion', 'Edits never alter the product or the creator’s verdict. AI scenes and dubs carry a disclosure label.'],
    [Wallet, 'Creators keep 75%', 'On the campaign fee and on every licence, renewal and buyout after it.'],
    [BadgeCheck, 'Verified, never follower-ranked', 'Creators rank by win rate, completed campaigns and brand rating.'],
    [Languages, 'India and UAE first', 'Prices in INR and AED. Hindi, Tamil, Telugu and Arabic voice versions.'],
    [Lock, 'Escrow on every campaign', 'Funds release when you approve, or automatically after five days.'],
  ] as const;
  return (
    <div>
      <header className="glass sticky top-0 z-nav">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-3"><Wordmark name="TakeOne" />{DEMO && <DemoPill />}</div>
          <div className="flex items-center gap-2"><LinkButton href="/login" variant="ghost" size="sm">Sign in</LinkButton><LinkButton href="/signup" size="sm">Post a campaign</LinkButton></div>
        </div>
      </header>
      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="caption-label">Launching in India and the UAE</p>
          <h1 className="mt-4 text-display">One take. <span className="font-serif font-normal italic">Ten ads.</span></h1>
          <p className="mt-6 max-w-prose text-body-lg text-secondary">Creators film themselves using your product once. TakeOne turns that take into up to ten ad variants in proven formats. You license the ones that win.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="lg">Post a campaign <ArrowRight size={20} {...ICON} /></LinkButton>
            <LinkButton href="/creators" variant="secondary" size="lg">I’m a creator</LinkButton>
          </div>
          <p className="mt-6 text-small text-tertiary">Platform fee 25%. Creators keep 75% of every payment.</p>
        </div>
        <div className="mx-auto w-full max-w-phone">
          <VideoFrame media="hero/take" ratio="reel" radius="xl" label="A creator’s take" autoPlay controls={false} />
        </div>
      </section>
      <section className="border-y border-border bg-surface-1">
        <div className="container-page grid gap-8 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <div key={t}><div className="tabular caption-label">0{i + 1}</div><h3 className="mt-3 text-h3">{t}</h3><p className="mt-2 text-small text-secondary">{d}</p></div>
          ))}
        </div>
      </section>
      <section className="container-page py-16 lg:py-24">
        <h2 className="text-h2">The ten formats</h2>
        <p className="mt-2 text-body text-secondary">Each built from the same take, scored against your brief.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FORMAT_LIST.map((f) => (
            <Card key={f.id}>
              <div className="flex items-center justify-between"><span className="tabular caption-label">{String(f.order).padStart(2, '0')}</span><Badge tone={f.v1 ? 'neutral' : 'outline'}>{f.v1 ? 'First release' : 'Planned'}</Badge></div>
              <div className="mt-4 text-body font-medium">{f.name}</div><div className="mt-1 text-small text-secondary">{f.tagline}</div>
              {f.synthetic && <div className="mt-3 text-caption text-tertiary">AI-labelled{f.proOnly ? ' · Creator Pro' : ''}</div>}
            </Card>
          ))}
        </div>
      </section>
      <section className="container-page grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {points.map(([Icon, t, d]) => (<Card key={t}><Icon size={24} {...ICON} className="text-secondary" /><h3 className="mt-4 text-body font-medium">{t}</h3><p className="mt-2 text-small text-secondary">{d}</p></Card>))}
      </section>
      <footer className="border-t border-border py-8 text-center text-caption text-tertiary">© {new Date().getFullYear()} TakeOne</footer>
    </div>
  );
}
