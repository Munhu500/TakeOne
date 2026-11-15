// Landing-page sections that are plain markup (rendered on the server in the normal build).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { IMAGE_EXTS, mediaFile } from '@/components/ui/media';
import { BadgeCheck, Lock, Scale, UserCheck } from 'lucide-react';
import { Avatar, btn, ICON, ImageSlot } from '@/components/ui';
import { MarketingProvider, type Audience } from '@/lib/marketing';
import { assetUrl } from '@/lib/utils';
import foundingCreators from '@/data/founding-creators.json';
import brandLogos from '@/data/brand-logos.json';
import { DEMO_HREF, FAQ, LIVE, RESULTS, SIGNUP, TRUST } from './copy';
import {
  CountrySelect, Earnings, MotionProvider, Em, FinalCta, FormatsReel, Hero, HowItWorks, LeaderboardPreview, MarketingNav, Pricing, Problem, StatCard, StickyCta, WaitlistForm,
} from './interactive';

interface FoundingCreator { name: string; handle?: string; avatar?: string; permission?: boolean }
interface BrandLogo { name: string; logo: string }

const Section = ({ id, tone, children }: { id?: string; tone?: 'raised'; children: ReactNode }) => (
  <section id={id} className={`scroll-mt-16 border-t border-border ${tone === 'raised' ? 'bg-surface-1' : ''}`}><div className="container-page py-16 lg:py-24">{children}</div></section>
);

function Proof() {
  const creators = (foundingCreators as FoundingCreator[]).filter((c) => c.permission === true);
  const logos = brandLogos as BrandLogo[];
  return (
    <section className="border-t border-border">
      <div className="container-page flex flex-col items-center gap-6 py-12 text-center">
        <p className="text-body-lg text-secondary">Backed by founding creators with a combined 100M+ followers.</p>
        {creators.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-4">
            {creators.map((c) => <li key={c.name} className="flex items-center gap-2 text-small text-secondary"><Avatar name={c.name} src={c.avatar} />{c.handle ?? c.name}</li>)}
          </ul>
        )}
        {logos.length > 0 && (
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logos.map((l) => <li key={l.name}><img src={assetUrl(l.logo) ?? l.logo} alt={l.name} loading="lazy" className="h-6 w-auto opacity-50 brightness-0 invert" /></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

function BrandResults() {
  return (
    <Section id="results" tone="raised">
      <h2 className="max-w-3xl text-h1">{RESULTS.headline[0]} <Em>{RESULTS.headline[1]}</Em></h2>
      <div className="mt-12 grid gap-6 md:grid-cols-3">{RESULTS.stats.map(([v, t, s]) => <StatCard key={v} value={v} text={t} source={s} />)}</div>
      <p className="mt-12 max-w-prose text-body-lg">{RESULTS.line}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={SIGNUP.brands} className={btn('primary', 'lg')}>Post your first campaign</Link>
        <Link href={DEMO_HREF} className={btn('secondary', 'lg')}>Book a demo</Link>
      </div>
      <p className="mt-8 text-small text-secondary"><Link href="/agencies" className="underline-offset-4 transition-colors duration-fast hover:text-primary hover:underline">{RESULTS.agency}</Link></p>
    </Section>
  );
}

const TRUST_ICONS = [Lock, BadgeCheck, UserCheck, Scale];
function Trust() {
  return (
    <Section>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map(([t, d], i) => { const Icon = TRUST_ICONS[i]!; return <div key={t}><Icon size={24} {...ICON} className="text-secondary" aria-hidden /><h3 className="mt-4 text-body font-medium">{t}</h3><p className="mt-2 text-small text-secondary">{d}</p></div>; })}
      </div>
    </Section>
  );
}

function Live() {
  return (
    <section id="live" className="relative scroll-mt-16 overflow-hidden border-t border-border bg-bg">
      <ImageSlot media="live/event" alt="TakeOne Live" />
      <div aria-hidden className="absolute inset-0 bg-scrim" />
      <div className="container-page relative py-24 lg:py-32">
        <p className="caption-label">{LIVE.caption}</p>
        <h2 className="mt-4 max-w-3xl text-h1 lg:text-display">{LIVE.headline[0]} <Em>{LIVE.headline[1]}</Em></h2>
        <p className="mt-6 max-w-prose text-body-lg text-secondary">{LIVE.sub}</p>
        <div className="mt-8"><WaitlistForm /></div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-8 lg:grid-cols-aside-main lg:gap-16">
        <h2 className="text-h1">FAQ</h2>
        <div className="border-t border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} name="faq" className="group border-b border-border">
              <summary className="flex min-h-row cursor-pointer list-none items-center justify-between gap-4 py-4 text-body-lg font-medium transition-colors duration-fast hover:text-secondary [&::-webkit-details-marker]:hidden">
                {q}<span aria-hidden className="relative size-4 shrink-0 text-tertiary before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-current after:transition-transform after:duration-base group-open:after:rotate-90" />
              </summary>
              <p className="max-w-prose pb-6 text-body text-secondary">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

const FOOTER: [string, [string, string][]][] = [
  ['Product', [['How it works', '/#how'], ['Formats', '/#formats'], ['Pricing', '/#pricing']]],
  ['Creators', [['Join', SIGNUP.creators], ['Earn', '/#earn'], ['Leaderboard', '/#leaderboard']]],
  ['Brands', [['Post a campaign', SIGNUP.brands], ['Book a demo', DEMO_HREF], ['Agencies', '/agencies']]],
  ['Company', [['About', '/about'], ['TakeOne Live', '/#live'], ['Contact', '/contact'], ['Privacy', '/privacy'], ['Terms', '/terms']]],
];
const footerLink = 'text-small text-secondary transition-colors duration-fast hover:text-primary';
export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="container-page py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {FOOTER.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <div className="caption-label">{title}</div>
              <ul className="mt-4 space-y-3">{links.map(([label, href]) => <li key={label}>{href.includes('#') ? <a href={href} className={footerLink}>{label}</a> : <Link href={href} className={footerLink}>{label}</Link>}</li>)}</ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <p className="text-small text-tertiary">© 2026 TakeOne</p>
          <CountrySelect />
        </div>
      </div>
    </footer>
  );
}

/** Nav, page content and footer for every public page. */
export function MarketingFrame({ preselect, children }: { preselect?: Audience; children: ReactNode }) {
  return (
    <MarketingProvider preselect={preselect}><MotionProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-small focus:text-on-inverse">Skip to content</a>
      <MarketingNav />
      <main id="main" className="pt-16">{children}</main>
      <MarketingFooter />
    </MotionProvider></MarketingProvider>
  );
}

export function LandingPage({ preselect }: { preselect?: Audience }) {
  // the hero poster is the largest image above the fold: ask for it before anything else
  const poster = mediaFile('hero/take', IMAGE_EXTS);
  if (poster) preload(poster, { as: 'image', fetchPriority: 'high' });
  return (
    <MarketingFrame preselect={preselect}>
      <Hero />
      <div id="hero-end" aria-hidden />
      <Proof />
      <Problem />
      <HowItWorks />
      <Earnings />
      <BrandResults />
      <section id="formats" className="scroll-mt-16 border-t border-border py-16 lg:py-24">
        <div className="container-page"><h2 className="max-w-3xl text-h1">One take. Every format that wins.</h2></div>
        <div className="mt-12"><FormatsReel /></div>
        <div className="container-page"><p className="mt-6 text-body text-secondary">New formats added every month.</p></div>
      </section>
      <Section id="leaderboard" tone="raised">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <h2 className="text-h1">Ranked by results, <Em>not followers.</Em></h2>
            <p className="mt-6 max-w-prose text-body-lg text-secondary">Creators climb by win rate, completed campaigns and brand ratings. Top creators get first access to the biggest campaigns — and invitations to TakeOne Live.</p>
          </div>
          <LeaderboardPreview />
        </div>
      </Section>
      <Trust />
      <Live />
      <Section id="pricing"><h2 className="text-h1">Pricing</h2><Pricing /></Section>
      <Faq />
      <FinalCta />
      <StickyCta sentinel="hero-end" />
    </MarketingFrame>
  );
}

/** Simple public page: title, a paragraph, optional extra content, and a way back. */
export function StubPage({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <MarketingFrame>
      <div className="container-page py-24">
        <h1 className="max-w-3xl text-h1">{title}</h1>
        <p className="mt-6 max-w-prose text-body-lg text-secondary">{body}</p>
        {children && <div className="mt-8">{children}</div>}
        <p className="mt-12"><Link href="/" className="text-small text-secondary underline-offset-4 transition-colors duration-fast hover:text-primary hover:underline">Back to home</Link></p>
      </div>
    </MarketingFrame>
  );
}
export { WaitlistForm };
