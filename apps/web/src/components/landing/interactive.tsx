'use client';
// Landing-page pieces that need the browser: the audience toggle and everything that follows it, the nav, the
// hero visuals, the formats reel, the waitlist form and the country selector.
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Menu, X } from 'lucide-react';
import { convertMinor, earningsBand, PRO_PRICE_USD_MINOR, V1_FORMATS, waitlistSchema } from '@takeone/shared';
import { motion as motionTokens } from '@takeone/design-tokens';
import { Avatar, Badge, btn, Button, DemoPill, Flag, ICON, ProductImage, VideoFrame, type ButtonVariant, type ButtonSize } from '@/components/ui';
import { mediaFile } from '@/components/ui/media';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { track } from '@/lib/analytics';
import { useMarketing, type Audience, type Market } from '@/lib/marketing';
import { cn, DEMO, money } from '@/lib/utils';
import { DEMO_HREF, EARN, EXAMPLE_LEADERBOARD, EXAMPLE_SCORES, EXAMPLE_WALLET, FINAL, HERO, HERO_CHIPS, PRICING, PRIMARY_CTA, PROBLEM, SIGNUP, STEPS } from './copy';

const EASE = motionTokens.easing;
const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: motionTokens.duration.base / 1000, ease: EASE } };

export const Em = ({ children }: { children: ReactNode }) => <em className="inline-block font-serif font-normal italic">{children}</em>;

/** Crossfades its content (250ms) when the audience changes. Server-rendered visible, so it never delays first paint. */
export function Swap({ children, className }: { children: (a: Audience) => ReactNode; className?: string }) {
  const { audience } = useMarketing();
  // Only the very first render skips the fade-in. (AnimatePresence's own `initial={false}` would also switch off the
  // entrance animations of everything nested inside, such as the hero visuals.)
  const first = useRef(true);
  useEffect(() => { first.current = false; }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.div key={audience} className={className} initial={first.current ? false : FADE.initial} animate={FADE.animate} exit={FADE.exit} transition={FADE.transition}>{children(audience)}</motion.div>
    </AnimatePresence>
  );
}

/** A link styled as a button that reports the click. `follow` picks label and target from the current audience. */
export function Cta({ href, label, where, variant = 'primary', size = 'lg', arrow, className }: { href?: string; label?: string; where: string; variant?: ButtonVariant; size?: ButtonSize; arrow?: boolean; className?: string }) {
  const { audience } = useMarketing();
  const to = href ?? SIGNUP[audience], text = label ?? PRIMARY_CTA[audience];
  const cls = cn(btn(variant, size), className);
  const onClick = () => track('cta_click', { where, label: text, audience });
  const inner = <>{text}{arrow && <ArrowRight size={20} {...ICON} aria-hidden />}</>;
  return to.startsWith('#') ? <a href={to} className={cls} onClick={onClick}>{inner}</a> : <Link href={to} className={cls} onClick={onClick}>{inner}</Link>;
}

export function AudienceToggle() {
  const { audience, setAudience } = useMarketing();
  return (
    <div role="radiogroup" aria-label="Who are you?" className="inline-flex rounded-full bg-surface-2 p-1">
      {([['creators', 'For creators'], ['brands', 'For brands']] as const).map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={audience === v} onClick={() => setAudience(v)}
          className={cn('h-control-md rounded-full px-5 text-small font-medium transition duration-base ease-standard active:scale-press', audience === v ? 'bg-accent text-on-accent' : 'text-secondary hover:text-primary')}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────────────────────────────────
const NAV_LINKS = [['How it works', '/#how'], ['For creators', '/creators'], ['For brands', '/brands'], ['TakeOne Live', '/#live'], ['FAQ', '/#faq']] as const;
const navLink = 'inline-flex h-control-sm items-center rounded-full px-3 text-small text-secondary transition-colors duration-fast hover:text-primary';
const NavItem = ({ href, children, className, onClick }: { href: string; children: ReactNode; className?: string; onClick?: () => void }) =>
  href.includes('#') ? <a href={href} className={className} onClick={onClick}>{children}</a> : <Link href={href} className={className} onClick={onClick}>{children}</Link>;

/** Glass, fixed. Slides away on scroll down and returns on scroll up; always shown at the top, on focus and while a menu is open. */
export function MarketingNav() {
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState<null | 'start' | 'mobile'>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let last = window.scrollY, frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) > 8) { setHidden(y > last && y > 96); last = y; }
        frame = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [menu]);
  const shown = !hidden || menu !== null;
  return (
    <header ref={ref} onFocus={() => setHidden(false)} className={cn('glass fixed inset-x-0 top-0 z-nav transition-transform duration-base ease-standard', !shown && '-translate-y-full')}>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3"><Link href="/" className="rounded-sm text-body-lg font-semibold">TakeOne</Link>{DEMO && <DemoPill />}</div>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(([label, href]) => <NavItem key={href} href={href} className={navLink}>{label}</NavItem>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cn(btn('ghost', 'sm'), 'hidden sm:inline-flex')}>Sign in</Link>
          <div className="relative">
            <button type="button" className={btn('primary', 'sm')} aria-haspopup="menu" aria-expanded={menu === 'start'} onClick={() => setMenu(menu === 'start' ? null : 'start')}>
              Get started<ChevronDown size={16} {...ICON} aria-hidden />
            </button>
            {menu === 'start' && (
              <div role="menu" aria-label="Get started" className="absolute right-0 top-full z-dropdown mt-2 w-48 rounded-md border border-border-strong bg-surface-2 p-1 shadow-float">
                {([['I’m a creator', SIGNUP.creators, 'creators'], ['I’m a brand', SIGNUP.brands, 'brands']] as const).map(([label, href, audience]) => (
                  <Link key={href} role="menuitem" href={href} onClick={() => track('cta_click', { where: 'nav', label, audience })} className="flex h-control-md items-center rounded-sm px-3 text-small transition-colors duration-fast hover:bg-surface-3">{label}</Link>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="grid size-9 place-items-center rounded-full text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary lg:hidden" aria-label={menu === 'mobile' ? 'Close menu' : 'Open menu'} aria-expanded={menu === 'mobile'} onClick={() => setMenu(menu === 'mobile' ? null : 'mobile')}>
            {menu === 'mobile' ? <X size={20} {...ICON} /> : <Menu size={20} {...ICON} />}
          </button>
        </div>
      </div>
      {menu === 'mobile' && (
        <nav aria-label="Main" className="container-page flex flex-col border-t border-border py-3 lg:hidden">
          {[...NAV_LINKS, ['Sign in', '/login'] as const].map(([label, href]) => <NavItem key={href} href={href} onClick={() => setMenu(null)} className="flex h-control-md items-center text-body text-secondary transition-colors duration-fast hover:text-primary">{label}</NavItem>)}
        </nav>
      )}
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────────────────────────────────
export function Hero() {
  return (
    <section className="container-page grid items-start gap-12 pb-16 pt-8 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-16">
      <div>
        <AudienceToggle />
        <Swap className="mt-8">
          {(a) => {
            const h = HERO[a];
            return (
              <>
                <Badge tone="outline">{h.badge}</Badge>
                <h1 className="mt-5 text-display">{h.headline[0]} <Em>{h.headline[1]}</Em></h1>
                <p className="mt-6 max-w-prose text-body-lg text-secondary">{h.sub}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Cta where="hero" arrow />
                  <Cta where="hero-secondary" variant="secondary" href={h.secondary.href} label={h.secondary.label} />
                </div>
                <p className="mt-6 max-w-prose text-caption text-tertiary">{h.trust.join(' · ')}</p>
              </>
            );
          }}
        </Swap>
      </div>
      {/* fixed 4:5 stage so switching audience never moves the page */}
      <div className="relative mx-auto aspect-portrait w-full max-w-lg">
        <Swap className="absolute inset-0">{(a) => (a === 'creators' ? <CreatorVisual /> : <BrandVisual />)}</Swap>
      </div>
    </section>
  );
}

const CHIP_POS = ['left-0 top-12', 'right-0 top-1/2', 'left-0 bottom-12'];
/** The take in a phone, with the three moments of a creator's month arriving one after another. */
function CreatorVisual() {
  const reduced = useReducedMotion();
  return (
    <div className="relative size-full">
      <div className="mx-auto aspect-reel h-full rounded-xl border border-border-strong bg-surface-1 p-2">
        <VideoFrame media="hero/take" radius="lg" label="A creator’s take" autoPlay controls={false} className="size-full" />
      </div>
      {HERO_CHIPS.map((text, i) => (
        <motion.div key={text} className={cn('absolute flex h-9 items-center gap-2 rounded-full border border-border-strong bg-surface-2 pl-2 pr-4 text-caption shadow-float', CHIP_POS[i])}
          initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.slow / 1000, ease: EASE, delay: 0.6 + i * 0.9 }}>
          <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success-text"><Check size={12} strokeWidth={2} aria-hidden /></span>{text}
        </motion.div>
      ))}
    </div>
  );
}

const LOOP = 6;
/** One take fans out into ten scored variants; three are picked. Loops every six seconds; static with reduced motion. */
function BrandVisual() {
  const reduced = useReducedMotion();
  const still = mediaFile('hero/take', ['jpg', 'jpeg', 'png', 'webp']);
  return (
    <div className="flex size-full flex-col items-center justify-between" role="img" aria-label="One take becomes ten scored ad variants; three are selected">
      <div className="aspect-reel w-20 rounded-md border border-border-strong bg-surface-1 p-1 sm:w-24">
        <VideoFrame media="hero/take" radius="sm" label="The take" autoPlay controls={false} className="size-full" />
      </div>
      <div className="grid w-full grid-cols-5 gap-2 sm:gap-3" aria-hidden>
        {EXAMPLE_SCORES.map((score, i) => {
          const start = 0.04 + i * 0.025;
          return (
            <motion.div key={score} className="relative aspect-reel overflow-hidden rounded-sm border border-border-strong bg-surface-2"
              initial={reduced ? false : { opacity: 0, scale: 0.6, y: -48 }}
              animate={reduced ? { opacity: 1, scale: 1, y: 0 } : { opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1, 1, 1], y: [-48, -48, 0, 0, 0] }}
              transition={reduced ? { duration: 0 } : { duration: LOOP, times: [0, start, start + 0.12, 0.94, 1], ease: EASE, repeat: Infinity }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {still && <img src={still} alt="" className="absolute inset-0 size-full object-cover" />}
              <span className="tabular absolute bottom-1 left-1 rounded-full bg-scrim px-2 text-caption text-on-media">{score}</span>
              {i < 3 && (
                <motion.span className="absolute inset-0 rounded-sm border-2 border-accent-brand"
                  initial={reduced ? false : { opacity: 0 }} animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }} transition={reduced ? { duration: 0 } : { duration: LOOP, times: [0, 0.5, 0.58, 0.94, 1], repeat: Infinity }}>
                  <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-on-accent"><Check size={12} strokeWidth={2} /></span>
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="flex w-full items-center justify-between text-caption text-tertiary"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent-brand" aria-hidden />Selected</span><span>Example</span></div>
    </div>
  );
}

// ── Problem ───────────────────────────────────────────────────────────────────────────────────────────────
export function StatCard({ value, text, source }: { value: string; text: string; source: string }) {
  return (
    <div className="card flex flex-col p-6">
      <div className="tabular text-stat text-accent-text">{value}</div>
      <p className="mt-4 text-body text-secondary">{text}</p>
      <p className="mt-auto pt-6 text-caption text-tertiary">Source: {source}</p>
    </div>
  );
}
export function Problem() {
  return (
    <section className="border-t border-border">
      <Swap className="container-page py-16 lg:py-24">
        {(a) => a === 'creators' ? (
          <>
            <h2 className="max-w-3xl text-h1">{PROBLEM.creators.headline}</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {PROBLEM.creators.items.map(([t, d], i) => <div key={t} className="border-t border-border-strong pt-6"><div className="tabular caption-label">0{i + 1}</div><h3 className="mt-4 text-h3">{t}</h3><p className="mt-3 text-body text-secondary">{d}</p></div>)}
            </div>
          </>
        ) : (
          <>
            <h2 className="max-w-3xl text-h1">{PROBLEM.brands.headline}</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">{PROBLEM.brands.stats.map(([v, t, s]) => <StatCard key={v} value={v} text={t} source={s} />)}</div>
          </>
        )}
      </Swap>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────────────────────────────────
const Row = ({ children }: { children: ReactNode }) => <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3">{children}</div>;
const Bar = ({ className }: { className: string }) => <span aria-hidden className={cn('block h-2 rounded-full bg-surface-3', className)} />;

/** Small product mock for each step. Built from the same components as the product; no screenshots. */
function StepVisual({ audience, step }: { audience: Audience; step: number }) {
  if (step === 0 && audience === 'creators') {
    return (
      <div className="space-y-3">
        {[['Glow Serum', 'Beauty'], ['Cold Brew Chai', 'Food'], ['Trail Runner', 'Fitness']].map(([name, cat], i) => (
          <Row key={name}><ProductImage name={name!} ratio="square" radius="sm" className="w-12" /><div className="min-w-0 flex-1"><div className="truncate text-small font-medium">{name}</div><div className="text-caption text-tertiary">{cat} · Paid campaign</div></div>{i === 0 ? <Badge tone="success">Applied</Badge> : <Badge tone="outline">Apply</Badge>}</Row>
        ))}
      </div>
    );
  }
  if (step === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-surface-2 p-3"><div className="text-caption text-tertiary">Product link</div><div className="mt-1 truncate font-mono text-small text-secondary">yourbrand.com/products/glow-serum</div></div>
        <div className="rounded-md border border-border bg-surface-2 p-4"><div className="text-small font-medium">Brief drafted</div><div className="mt-4 space-y-3"><Bar className="w-full" /><Bar className="w-4/5" /><Bar className="w-3/5" /></div></div>
        <Row><div className="flex-1 text-small font-medium">Budget</div><Badge tone="warning">In escrow</Badge></Row>
      </div>
    );
  }
  if (step === 1 && audience === 'creators') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <VideoFrame media="hero/take" radius="md" label="Guided capture" controls={false} />
        <ul className="space-y-3 self-center">
          {['Show the product in hand', 'Say what you noticed first', 'Give your honest verdict'].map((t, i) => (
            <li key={t} className="flex items-start gap-2 text-small text-secondary"><span className={cn('mt-1 grid size-5 shrink-0 place-items-center rounded-full', i < 2 ? 'bg-success-soft text-success-text' : 'border border-border-strong')}>{i < 2 && <Check size={12} strokeWidth={2} aria-hidden />}</span>{t}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="space-y-3">
        {[['Priya Sharma', 'Take uploaded', 'success'], ['Arjun Mehta', 'Filming', 'accent'], ['Layla Al Farsi', 'Product delivered', 'neutral']].map(([name, status, tone]) => (
          <Row key={name}><Avatar name={name!} /><div className="min-w-0 flex-1"><div className="truncate text-small font-medium">{name}</div><div className="text-caption text-tertiary">Verified</div></div><Badge tone={tone as 'success' | 'accent' | 'neutral'}>{status}</Badge></Row>
        ))}
      </div>
    );
  }
  if (step === 2) {
    return (
      <div>
        {audience === 'brands' && <div className="mb-4 flex gap-2">{['9:16', '4:5', '1:1'].map((r, i) => <span key={r} className={cn('chip tabular', i === 0 && 'is-on')}>{r}</span>)}</div>}
        <div className="grid grid-cols-5 gap-2">
          {EXAMPLE_SCORES.map((s) => <div key={s} className="relative aspect-reel rounded-sm border border-border bg-surface-2"><span className="tabular absolute bottom-1 left-1 rounded-full bg-scrim px-2 text-caption text-on-media">{s}</span></div>)}
        </div>
      </div>
    );
  }
  const rows = audience === 'creators'
    ? [['Campaign fee', 'Paid'], ['Licence renewal', 'Paid again'], ['Partnership ad', 'Paid again']]
    : [['Hook First', 'Licensed'], ['Tight Testimonial', 'Licensed'], ['Day in the Life', 'Renewed']];
  return <div className="space-y-3">{rows.map(([t, s]) => <Row key={t}><div className="flex-1 text-small font-medium">{t}</div><Badge tone="success">{s}</Badge></Row>)}</div>;
}

export function HowItWorks() {
  const { audience } = useMarketing();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    // the step crossing the middle band of the viewport is the active one
    const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step)); }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const steps = STEPS[audience];
  return (
    <section id="how" className="scroll-mt-16 border-t border-border bg-surface-1">
      <div className="container-page py-16 lg:py-24">
        <p className="caption-label">How it works</p>
        <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <ol>
            {steps.map((_, i) => (
              <li key={i} ref={(el) => { refs.current[i] = el; }} data-step={i} className="flex flex-col justify-center border-t border-border py-8 first:border-t-0 first:pt-0 lg:min-h-80 lg:border-t-0 lg:py-0">
                <div>
                  <div className="tabular caption-label">Step {i + 1}</div>
                  {/* steps away from the centre recede by colour, not opacity, so they stay readable */}
                  <Swap>{(a) => <><h3 className={cn('mt-3 text-h2 transition-colors duration-base', active !== i && 'lg:text-tertiary')}>{STEPS[a][i]![0]}</h3><p className={cn('mt-3 max-w-prose text-body-lg transition-colors duration-base', active === i ? 'text-secondary' : 'text-secondary lg:text-tertiary')}>{STEPS[a][i]![1]}</p></>}</Swap>
                </div>
                <div className="card mt-6 bg-bg p-5 lg:hidden"><StepVisual audience={audience} step={i} /></div>
              </li>
            ))}
          </ol>
          <div className="hidden lg:block">
            <div className="sticky top-24 flex min-h-80 flex-col justify-center">
              <div className="card bg-bg p-8">
                <AnimatePresence mode="wait">
                  <motion.div key={`${audience}-${active}`} {...FADE}><StepVisual audience={audience} step={active} /></motion.div>
                </AnimatePresence>
              </div>
              <p className="mt-3 text-right text-caption text-tertiary">Example</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Earnings ──────────────────────────────────────────────────────────────────────────────────────────────
export function Earnings() {
  const { country, currency } = useMarketing();
  const wallet = EXAMPLE_WALLET[country];
  return (
    <section id="earn" className="scroll-mt-16 border-t border-border">
      <div className="container-page py-16 lg:py-24">
        <h2 className="max-w-3xl text-h1">{EARN.headline[0]} <Em>{EARN.headline[1]}</Em></h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EARN.cards.map(([t, d], i) => <div key={t} className="card p-6"><div className="tabular caption-label">0{i + 1}</div><h3 className="mt-4 text-h3">{t}</h3><p className="mt-3 text-body text-secondary">{d}</p></div>)}
        </div>
        <div className="mt-6 grid items-center gap-8 rounded-lg border border-border bg-surface-1 p-6 lg:grid-cols-main-aside lg:p-8">
          <div>
            <dl className="grid gap-6 sm:grid-cols-3">
              {(['Pending', 'Cleared', 'Available'] as const).map((label, i) => (
                <div key={label}><dt className="caption-label">{label}</dt><dd className={cn('tabular mt-3 text-stat-sm', i === 2 ? 'text-accent-text' : 'text-primary')}>{money(wallet[i], currency)}</dd></div>
              ))}
            </dl>
            <p className="mt-6 text-caption text-tertiary">Example</p>
          </div>
          <div className="lg:text-right"><Cta where="earn" href={SIGNUP.creators} label={PRIMARY_CTA.creators} arrow /></div>
        </div>
      </div>
    </section>
  );
}

// ── Formats reel ──────────────────────────────────────────────────────────────────────────────────────────
/** Live formats only. Scrolls natively (touch, trackpad, keyboard) and can be dragged with a mouse. */
export function FormatsReel() {
  const ref = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  return (
    <ul ref={ref} tabIndex={0} aria-label="Ad formats" className="container-page flex cursor-grab snap-x gap-4 overflow-x-auto pb-4 active:cursor-grabbing sm:gap-6"
      onPointerDown={(e) => { if (e.pointerType === 'mouse' && ref.current) drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }; }}
      onPointerMove={(e) => { const d = drag.current; if (d && ref.current) { ref.current.scrollLeft = d.left - (e.clientX - d.x); d.moved ||= Math.abs(e.clientX - d.x) > 4; } }}
      onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
      {V1_FORMATS.map((f) => (
        <li key={f.id} className="w-56 shrink-0 snap-start select-none sm:w-64">
          <VideoFrame media={`variants/${f.id}`} label={f.name} />
          <div className="mt-4 text-body font-medium">{f.name}</div>
          <div className="mt-1 text-small text-secondary">{f.tagline}</div>
        </li>
      ))}
    </ul>
  );
}

// ── Leaderboard preview ───────────────────────────────────────────────────────────────────────────────────
export function LeaderboardPreview() {
  const { currency } = useMarketing();
  return (
    <div className="min-w-0">
      <ol className="card divide-y divide-border overflow-hidden">
        {EXAMPLE_LEADERBOARD.map((r, i) => (
          <li key={r.name} className="flex min-h-row-media items-center gap-4 px-4 py-3 sm:px-6">
            <span className={cn('tabular w-4 text-body font-semibold', i === 0 ? 'text-accent-text' : 'text-tertiary')}>{i + 1}</span>
            <Avatar name={r.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium">{r.name}</div>
              <div className="tabular flex items-center gap-2 truncate text-caption text-secondary"><Flag code={r.country} />{r.category} · {r.campaigns} campaigns · rating {r.rating}</div>
            </div>
            <div className="tabular hidden whitespace-nowrap text-right text-small text-secondary sm:block">{earningsBand(r.monthUsdMinor, 'USD', currency, undefined, 'this month')}</div>
            <div className="tabular w-16 text-right"><div className="text-body font-semibold">{r.winRate}%</div><div className="text-caption text-tertiary">win rate</div></div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-caption text-tertiary">Example leaderboard</p>
    </div>
  );
}

// ── Waitlist ──────────────────────────────────────────────────────────────────────────────────────────────
/** Writes straight to the insert-only `waitlist` table with the public key, so it works on a static host too. */
export function WaitlistForm({ fixedRole, cta = 'Join the waitlist' }: { fixedRole?: 'creator' | 'brand'; cta?: string }) {
  const m = useMarketing();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'creator' | 'brand' | null>(null);
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});
  const chosen = fixedRole ?? role ?? (m.audience === 'brands' ? 'brand' : 'creator');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = waitlistSchema.safeParse({ email, role: chosen, country: m.country });
    if (!parsed.success) return setState({ error: 'Enter a valid email address.' });
    setState({ busy: true });
    // a filled honeypot is a bot: accept silently and store nothing
    const { error } = trap ? { error: null } : await supabaseBrowser().from('waitlist').insert(parsed.data);
    if (error) return setState({ error: 'That did not go through. Please try again.' });
    track('waitlist_submit', { role: chosen, country: m.country });
    setState({ done: true });
  }
  if (state.done) return <p role="status" className="flex items-center gap-3 text-body-lg"><span className="grid size-6 place-items-center rounded-full bg-success-soft text-success-text"><Check size={16} {...ICON} aria-hidden /></span>You’re on the list. We’ll email you when invitations open.</p>;
  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`wl-email-${fixedRole ?? 'live'}`}>Email address</label>
        <input id={`wl-email-${fixedRole ?? 'live'}`} type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" className="input flex-1" value={email} onChange={(e) => { setEmail(e.target.value); if (state.error) setState({}); }} aria-invalid={!!state.error} aria-describedby={state.error ? 'wl-error' : undefined} />
        <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={trap} onChange={(e) => setTrap(e.target.value)} />
        <Button type="submit" size="lg" loading={state.busy}>{cta}</Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-small text-secondary">
        {!fixedRole && (
          <div role="radiogroup" aria-label="I am a" className="flex items-center gap-2">
            {(['creator', 'brand'] as const).map((r) => <button key={r} type="button" role="radio" aria-checked={chosen === r} onClick={() => setRole(r)} className="chip">{r}</button>)}
          </div>
        )}
        <CountrySelect label="Country" />
      </div>
      {state.error && <p id="wl-error" role="alert" className="mt-3 text-small text-danger-text">{state.error}</p>}
    </form>
  );
}

export function CountrySelect({ label = 'Country and currency' }: { label?: string }) {
  const { country, setCountry } = useMarketing();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface-2 p-1">
      {([['IN', 'India'], ['AE', 'UAE']] as [Market, string][]).map(([code, name]) => (
        <button key={code} type="button" role="radio" aria-checked={country === code} onClick={() => setCountry(code)}
          className={cn('inline-flex h-8 items-center gap-2 rounded-full px-3 text-small font-medium transition duration-fast ease-standard active:scale-press', country === code ? 'bg-surface-3 text-primary' : 'text-secondary hover:text-primary')}>
          <Flag code={code} />{name}
        </button>
      ))}
    </div>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────────────────────────────────
export function Pricing() {
  const { currency } = useMarketing();
  const pro = money(convertMinor(PRO_PRICE_USD_MINOR, 'USD', currency), currency);
  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      <div className="card flex flex-col p-6 lg:p-8">
        <div className="caption-label">Creators</div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div><h3 className="text-h3">{PRICING.free[0]}</h3><p className="mt-3 text-body text-secondary">{PRICING.free[1]}</p></div>
          <div className="border-t border-border pt-6 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <h3 className="text-h3">{PRICING.pro[0]}</h3>
            <p className="tabular mt-3 text-stat-sm text-accent-text">{pro}<span className="ml-2 text-small font-normal text-tertiary">a month</span></p>
            <p className="mt-3 text-body text-secondary">{PRICING.pro[1]}</p>
          </div>
        </div>
        <div className="mt-auto pt-8"><Cta where="pricing-creators" href={SIGNUP.creators} label={PRIMARY_CTA.creators} /></div>
      </div>
      <div className="card flex flex-col p-6 lg:p-8">
        <div className="caption-label">Brands</div>
        <h3 className="mt-6 text-h3">{PRICING.brands[0]}</h3>
        <p className="mt-3 max-w-prose text-body text-secondary">{PRICING.brands[1]}</p>
        <div className="mt-auto pt-8"><Cta where="pricing-brands" href={SIGNUP.brands} label={PRIMARY_CTA.brands} /></div>
      </div>
    </div>
  );
}

// ── Final CTA + sticky mobile bar ─────────────────────────────────────────────────────────────────────────
export function FinalCta() {
  return (
    <section className="border-t border-border">
      <Swap className="container-page flex flex-col items-center py-24 text-center lg:py-32">
        {(a) => (
          <>
            <h2 className="max-w-3xl text-h1 lg:text-display">{FINAL[a].headline[0]} <Em>{FINAL[a].headline[1]}</Em></h2>
            <div className="mt-8"><Cta where="final" variant="accent" arrow /></div>
            <Link href={FINAL[a].other.href} className="mt-6 text-small text-secondary underline-offset-4 transition-colors duration-fast hover:text-primary hover:underline">{FINAL[a].other.label}</Link>
          </>
        )}
      </Swap>
    </section>
  );
}

/** Mobile only: appears once the hero's own buttons have scrolled out of view. */
export function StickyCta({ sentinel }: { sentinel: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(sentinel);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting && e!.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [sentinel]);
  return (
    <div inert={!show} className={cn('glass fixed inset-x-0 bottom-0 z-sticky border-b-0 border-t p-3 transition-transform duration-base ease-standard md:hidden', !show && 'translate-y-full')}>
      <Cta where="sticky-mobile" size="md" className="w-full" />
    </div>
  );
}

export { DEMO_HREF };
