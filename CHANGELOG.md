# Changelog

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
