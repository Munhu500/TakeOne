# Changelog

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
