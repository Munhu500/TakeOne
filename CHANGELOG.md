# Changelog

## Fixes from screenshot review (3.1)
- Landing: creator chips sit inside the phone (stacked under it on phones); brand hero rebuilt with the take at the top
  left and ten cards lighting up in score order; how-it-works picture pinned to the middle of the viewport and switched
  at each step's midpoint; full-bleed formats reel with arrows and edge fade; TakeOne Live centred on a vignette until
  `live/event.jpg` exists; stat numbers and the Pro price in primary text.
- Creator Pro is a fixed price per market: India ₹699, UAE AED 69, elsewhere USD 19 (`pro_prices` setting).
- Placeholders adapt to their own width: under 200px they show the format name, not "Footage coming soon".
- Product tiles use a short name ("SPF", "VC") from `campaigns.product_short_name`, or one derived from the name.
- Earnings bands per market (₹25K+ … ₹20L+, AED 1K+ … 60K+); demo ratings and earnings follow results.
- Distinct applicant pitches and renewal reminders; display names for categories and countries; dates always "30 Sep 2026".
- Agency: per-currency billing totals with a labelled combined row, clearer invoice links, cards that fill the row,
  tooltips and a client indicator in the collapsed sidebar, logo or initials tile in the white-label preview.
- `<Logo>` reads `public/brand/logo-mark.svg` (and `.png` for invoices) when present.

## Web premium overhaul 3 of 4 — brand and agency dashboards
- Shell: 248px sidebar (icons only at 1024px and below), agency workspace switcher with search, user menu with theme
  and sign-out, breadcrumb bar with notifications (unread count, marks read on open).
- Brand overview: results row, "Review your new ads" strip, campaigns with progress, activity grouped by day, first-run checklist.
- Review room: full-screen dark player; up/down, J/K, wheel or swipe between variants, left/right between creators;
  select up to three included, extras and partnership ads priced in a sticky bar with one "Confirm selection".
- Campaign detail (Overview, Creators, Deliveries, Licences, Payments) and a four-step wizard with autosave.
- Usage & licences: summary, bulk renew, calm renewal dialog with the new end date, toast on success.
- Leaderboard: podium, compact filters, earnings bands in local style (₹4.2L+, AED 18.3K+).
- Billing with filters; agency clients (stats, markup popover, add-client drawer), white-label with logo upload,
  colour feedback, DNS check and live preview; agency billing with cost and client PDFs and a totals row.
- Ranking: main board needs 3 completed campaigns; order is (wins + 2) / (submissions + 4), then rating, then completed.
- Each campaign carries its own licence term, 35–45 days (migration `20260101000011`).
- Demo data: creator names match their countries; transcripts and hooks match each product; realistic win rates.

## Web premium overhaul 2 of 4 — landing page
- New landing at `/` with a creators/brands toggle (remembered per tab; `/creators` and `/brands` preselect it) that
  swaps the hero, problem, how-it-works and final call to action. Sections: proof, earnings, brand results, live
  formats reel, example leaderboard, trust, TakeOne Live waitlist, pricing, FAQ, footer with country selector.
- Hero visuals: a phone with three sequenced status chips (creators); one take fanning into ten scored variants on a
  six-second loop (brands). Both are static with reduced motion.
- `waitlist` table (migration `20260101000010`): anonymous insert only, no read/update/delete through the API.
- New public pages: `/agencies`, `/demo`, `/about`, `/contact`, `/privacy`, `/terms`. `/signup?role=creator|brand|agency`.
- SEO: title, description, Open Graph image (`pnpm --filter @takeone/web og`), favicon; `noindex` while in demo mode.
- Analytics hook points behind a no-op wrapper (`lib/analytics.ts`).
- The dashboard sign-in guard now matches whole path segments, so `/brands` is public while `/brand/…` stays gated.

## Web premium overhaul 1 of 4 — Studio Noir design system
- `packages/design-tokens`: colours (dark and light), type scale, 4pt spacing, radii, sizes, motion presets, generated
  `tokens.css`, Tailwind preset, and an automated WCAG AA contrast test for every text/surface pair and agency accents.
- `pnpm check:tokens` fails on any colour, size, radius, spacing, shadow, gradient, emoji or external font outside the tokens.
- Self-hosted Geist, Geist Mono and Instrument Serif (`next/font/local`); no external font requests.
- Component library in `apps/web/src/components/ui`; every web screen moved onto it. Gallery at `/_design`.
- Business decisions: campaign credit disabled (`CREDITS_ENABLED=false`, UI hidden), licence term 45 days (35–45,
  renewals add one term to the current end date), "Whitelist" renamed "Partnership ad" in UI, ledger and invoices.
  Migration `20260101000008_business_decisions.sql`; new pricing tests.
- Demo data: illustrated product images and cartoon variant footage removed; neutral frames until real media is added
  under `apps/web/public/media`.
- Mobile is untouched apart from one line of copy; follow-ups are in `TODO_MOBILE.md`.
- Follow-up decisions: accent fill `#6A4BF0` with white labels (hover `#5B3DE0`, pressed darker), `accent-brand`
  `#7C5CFF` for marks, indicators, focus rings and underlines; agency fills auto-darken to AA with white labels.
  British English standard (README), migration `20260101000009_british_english.sql`.

## Static preview build
- `pnpm build:preview`: Next.js static export + Expo web export under `/app`, `.htaccess`, secret scan, `takeone-preview.zip` for plain Apache hosting.
- Preview mode is behind `NEXT_PUBLIC_STATIC_PREVIEW` / `EXPO_PUBLIC_STATIC_PREVIEW`; the normal builds are unchanged.
- Shared refactors: wizard AI calls moved to `lib/ai.ts`, invoice PDF builder to `lib/invoice-pdf.ts`.

## Phase 7 — polish and delivery
- Loading skeletons, empty and error states on web and mobile; labelled controls, focus rings, reduced-motion support.
- End-to-end DEMO_MODE run: sample take → worker → Studio → submit → brand select / add-on / winner / approve (`e2e/`).
- `apps/web/vercel.json`, worker `Dockerfile` + `fly.toml`, `apps/mobile/eas.json`.

## Phase 6 — agency, messaging, leaderboard, admin
- Agency white-label: host-based theming in middleware, client workspaces, per-client markup, agency-branded invoice PDFs.
- Campaign chat with contact masking enforced in the database (`send_message`), attempts logged, users flagged after 3.
- Leaderboards as materialized views (creators, Rising Stars, brands); earnings leave the database as bands unless opted in.
- Admin console: QA queue, verification, users, campaigns, disputes and refunds, payouts, masking flags, credits, settings.

## Phase 5 — money
- Escrow payment → `held`; approval or 5-day auto-approve; ledger `pending → cleared → available → withdrawn`.
- Pro subscription, withdrawals by country, first-withdrawal KYC, Stripe webhook route, Option B credit.

## Phase 4 — Studio and brand dashboard
- Studio: ranked variants, hook choice with re-render, Win Predictor (Pro), submission, winning-post link.
- Brand: URL → brief, shot list, escrow checkout, applicants, variant review (top 5 / all 10, compare, aspect switcher), licensing add-ons, downloads, usage tracker.

## Phase 3 — video worker
- Job polling, transcription, 5 v1 formats × 3 aspect ratios, hooks, scene replacement and dubbing via providers, ranking, AI disclosure metadata, QA gate.

## Phase 2 — creator app
- Sign-in, onboarding (country, categories, UAE permit), social linking and verification, Likeness Vault and consent, feed, campaign detail, apply, guided shoot, resumable upload.

## Phase 1 — scaffold
- Turborepo + pnpm, shared package with unit tests, Supabase migrations with RLS on every table, seed data, env templates.
