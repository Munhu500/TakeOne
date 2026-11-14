import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, Languages, Layers, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { FORMAT_LIST } from '@takeone/shared';
import { hostAgency } from '@/lib/session';
import { Badge, Card, LinkButton } from '@/components/ui';
import { Wordmark } from '@/components/shell';
import { ThemeToggle } from '@/components/client';
import { SUPABASE_URL } from '@/lib/utils';

export default async function Landing() {
  if (await hostAgency()) redirect('/login'); // white-label hosts go straight to the client workspace
  const steps = [
    ['Brands post a brief', 'Paste a product link. The brief and a creator shot list are drafted for you to edit, and the budget goes into escrow.'],
    ['Creators shoot one take', 'A guided capture with the real product in hand. One honest take, no script changes.'],
    ['The Variant Engine cuts ten ads', 'Hook-first, tight testimonial, silent montage, new scenes and languages — ranked against your brief.'],
    ['License the winners', 'Pick up to three in the base fee, add more as you scale, and pay one invoice.'],
  ];
  const points = [
    [Layers, 'Ten formats from one take', 'Five ship today, five more on the way. Every variant exports in 9:16, 4:5 and 1:1.'],
    [ShieldCheck, 'Real product, real opinion', 'Edits never alter the product or the creator’s verdict. AI scenes and dubs carry a disclosure label.'],
    [Wallet, 'Creators keep 75%', 'On the campaign fee and on every license, renewal and buyout after it.'],
    [BadgeCheck, 'Verified, never follower-ranked', 'Creators rank by win rate, completed campaigns and brand rating.'],
    [Languages, 'India and UAE first', 'Prices in INR and AED, Hindi, Tamil, Telugu and Arabic voice versions.'],
    [Sparkles, 'Escrow on every campaign', 'Funds release when you approve, or automatically after five days.'],
  ] as const;
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark name="TakeOne" />
        <div className="flex items-center gap-2"><ThemeToggle /><LinkButton href="/login" variant="ghost">Sign in</LinkButton><LinkButton href="/signup">Post a campaign</LinkButton></div>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Badge tone="accent">Now in India and the UAE</Badge>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] sm:text-7xl">One take.<br /><span className="text-accent">Ten ads.</span></h1>
          <p className="mt-6 max-w-xl text-lg text-muted">Creators film themselves using your product once. TakeOne turns that take into up to ten ad variants in proven formats. You license the ones that win.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup">Post a campaign <ArrowRight size={16} /></LinkButton>
            <LinkButton href="/creators" variant="secondary">I’m a creator</LinkButton>
          </div>
          <p className="mt-5 text-sm text-faint">Platform fee 25%. Creators keep 75% of every payment.</p>
        </div>
        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="absolute -inset-10 -z-10 rounded-full bg-accent/20 blur-3xl" aria-hidden />
          <video className="aspect-[9/16] w-full rounded-[28px] border border-line object-cover shadow-2xl" src={`${SUPABASE_URL}/storage/v1/object/public/public-assets/seed/sample-take.mp4`} poster={`${SUPABASE_URL}/storage/v1/object/public/public-assets/seed/sample-take.jpg`} muted loop playsInline autoPlay aria-label="Sample creator take" />
          <div className="absolute -left-10 bottom-16 hidden rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl sm:block"><div className="text-faint">Hook First</div><div className="tabular font-semibold">Score 91</div></div>
          <div className="absolute -right-8 top-14 hidden rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl sm:block"><div className="text-faint">Licensed</div><div className="font-semibold">3 of 5 variants</div></div>
        </div>
      </section>
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <div key={t}><div className="tabular font-display text-sm text-accent">0{i + 1}</div><h3 className="mt-2 font-display text-lg font-semibold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold">The ten formats</h2>
        <p className="mt-2 text-muted">Each built from the same take, scored against your brief.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FORMAT_LIST.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-center justify-between"><span className="tabular text-xs text-faint">{String(f.order).padStart(2, '0')}</span>{f.v1 ? <Badge tone="ok">Live</Badge> : <Badge>Coming soon</Badge>}</div>
              <div className="mt-3 font-medium">{f.name}</div><div className="mt-1 text-xs text-muted">{f.tagline}</div>
              {f.synthetic && <div className="mt-2 text-[11px] text-faint">AI-labelled{f.proOnly ? ' · Creator Pro' : ''}</div>}
            </Card>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {points.map(([Icon, t, d]) => (<Card key={t}><Icon size={20} className="text-accent" /><h3 className="mt-4 font-medium">{t}</h3><p className="mt-1.5 text-sm text-muted">{d}</p></Card>))}
      </section>
      <footer className="border-t border-line px-6 py-8 text-center text-xs text-faint">© {new Date().getFullYear()} TakeOne. Demo build.</footer>
    </div>
  );
}
