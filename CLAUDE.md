# TakeOne — Build Spec (Demo / v1)

Save this file as CLAUDE.md at the repo root and follow it throughout the project.

## What we're building

TakeOne is a two-sided marketplace app.
- Creators (influencers) find paid brand campaigns, shoot ONE take of themselves using the real product, and the app's AI "Variant Engine" turns that take into up to 10 ad variants in proven formats.
- Brands (and agencies on their behalf) post campaigns, review the variants, select winners, license them as UGC ads, and pay one invoice.
- Creators never post the 10 variants. Brands use selected variants as paid ads from their own accounts. The creator posts only the winning ad on their own feed.
- The platform takes 25%. The creator gets 75%, applied to every payment including usage-rights licenses, renewals and buyouts.
- Launch markets: India and UAE. Users pick their country, and all figures display in local currency (INR, AED, USD fallback).

Build a working, demo-ready v1 that runs end to end. Build in phases (below). After each phase: run it, fix errors, summarize what was built, list what's mocked, then continue.

## Tech stack

- Monorepo: Turborepo + pnpm.
- apps/mobile: Expo (React Native, TypeScript, Expo Router). Creator app for iOS and Android.
- apps/web: Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui). Contains the brand dashboard, agency white-label dashboard, admin console, and a marketing landing page. Deploy to Vercel.
- packages/shared: shared TypeScript types, zod schemas, format definitions, currency utilities, pricing/split logic.
- services/video-worker: Node.js + FFmpeg worker that processes video jobs from a jobs table. Deployable to Fly.io or Render (Docker).
- Backend: Supabase (Postgres, Auth, Storage, Row Level Security, Edge Functions, Realtime).
- AI:
  - Anthropic Claude API: brief extraction from product URL, creator shot lists, hook writing, variant ranking, product-in-frame checks (vision on sampled frames).
  - Speech-to-text: Whisper via API (for captions and transcripts).
  - Voice dubbing: ElevenLabs (voice clone + dubbing) behind an interface.
  - Background/scene replacement: video matting/segmentation model via Replicate or fal.ai behind an interface.
- Payments: Stripe (test mode) behind a PaymentProvider interface. Add a stub RazorpayProvider for India with the same interface.
- Every external AI/payment service sits behind a provider interface with a MOCK implementation. If DEMO_MODE=true or an API key is missing, use the mock (pre-rendered sample outputs) so the full demo always runs.

## Design standard (premium, Instagram-level)

- Dark mode by default plus light mode. Near-black background, one signature accent colour (electric violet #7C5CFF), white/grey text scale.
- Typography: Inter (UI) and a bold display face for headings (e.g., Clash Display or Satoshi fallback Inter).
- Motion: subtle, purposeful (Reanimated on mobile, Framer Motion on web). No gratuitous animation.
- Mobile home is a full-screen vertical feed of campaign cards (like reels): brand logo, product image/video, pay in local currency, deadline, one-tap Apply.
- Targets: fast cold start, smooth 60fps lists (FlashList), skeleton loaders, optimistic UI.
- Four hero screens must be flawless first: Feed, Campaign detail, Studio (variants), Wallet.

## Users and roles

- creator: uses the mobile app.
- brand_member: belongs to a brand; uses the web dashboard.
- agency_member: belongs to an agency; manages multiple brand client workspaces under the agency's white-label branding.
- admin: internal team; admin console.

Auth: Supabase Auth with email OTP and Google/Apple sign-in. No KYC at signup. KYC happens only at first withdrawal (mocked provider flow in demo: ID photo + selfie).

## Creator tiers

- Free: up to 3 applications per week; Variant Engine standard formats; payout eligibility 14 days after clearing.
- Pro (Stripe subscription, ~USD 19/month shown in local currency):
  - 48-hour early access to new campaigns
  - unlimited applications
  - payout eligibility 3 days after clearing
  - Pro-only feature 1: Multilingual Voice (dub the creator's real review into Hindi, Tamil, Telugu, Arabic, etc. in their own cloned voice)
  - Pro-only feature 2: Win Predictor (pre-submission score per variant + AI rewrites of weak hooks)
  - 60-day guarantee tracker (see rules)
- Founding creators: flag `is_founding=true` gives Pro free for life.
- AI likeness (Likeness Vault) is available to ALL creators.

Pro guarantee rules (tracked automatically, shown as a progress card): within a rolling 60 days the creator must have a complete profile, at least 2 linked social accounts, applied to at least 15 matching campaigns (same country/category), on-time submission for every accepted campaign, rating at least 4.0, responded to brand invites within 48h, one account per person, and a UAE Advertiser Permit number if country = AE. If all met and no paid campaign landed, auto-issue free Pro months until one lands.

## Core flows

### Creator onboarding (mobile)
1. Sign up, choose country (sets currency and locale), choose categories (beauty, fashion, fitness, food, tech, lifestyle, etc.).
2. If country = AE: required field "UAE Media Council Advertiser Permit number".
3. Link social accounts and add handles: Instagram, TikTok, YouTube, Snapchat.
4. Metrics verification (layered trust):
   - Ownership: app generates a one-time code; creator places it in bio or story; creator taps "Verify". In demo, an admin approves from the console. Leave a hook for an automated check later.
   - Screen recording: creator records their screen inside the app while opening their insights page live. The recording is stamped with an app-generated code and timestamp shown on screen during recording. Uploaded for review.
   - Public cross-check: store claimed metrics vs public metrics. Flag if engagement ratios are implausible (e.g., claimed views far above public likes). Implement as a scoring function with mocked public data.
   - YouTube: real OAuth connection via the YouTube Data API for verified subscriber/view stats.
   - Badges shown to brands: "Verified via API", "Checked", "Self-reported".
5. Likeness Vault setup (optional at signup, prompted before first campaign): guided 3–5 minute capture (face angles + read a short script for voice). Explicit consent screens: per-campaign consent required, revocable for future uses, never used outside signed campaigns, delete on request. Store voice clone id and capture files privately.

### Campaign feed and application (mobile)
- Vertical feed filtered by the creator's country and categories. Pro users see new campaigns 48h before Free users.
- Campaign detail: brand, product, the brand's brief, pay (local currency), deliverable (one take → variants), deadline, usage terms, "AI likeness used" note.
- Apply with one tap (optional short pitch). Free users see the weekly application counter.
- Brands can also invite creators directly.

### Shoot (mobile)
- Guided capture screen: the shot list and talking points generated from the brand's brief, framing guides, timer.
- After recording: sample frames and run the product-in-frame check against the brand's product reference image (Claude vision). Prompt a retake if the product isn't clearly visible.
- Upload the take to Supabase Storage (resumable upload), create a video job.

### Variant Engine (video-worker)
Formats live in a config file in packages/shared. Implement all 10 definitions; fully implement the 5 marked v1, and leave the rest as "coming soon" in the UI.

1. hook_first (v1): strongest problem statement in the first 2s, tight cuts, on-screen hook text.
2. unboxing_first_use
3. before_after (real results only; never AI-generated results)
4. three_reasons
5. testimonial_tight (v1): talking-head testimonial, filler removed, captions.
6. day_in_life (v1): scene replacement — creator plus product kept in the foreground, background replaced with an AI scene.
7. reaction_first_impression
8. comparison
9. silent_montage (v1): fast captioned montage for sound-off viewing, music bed.
10. language_version (v1, Pro only): creator's real review dubbed into another language in their cloned voice.

Pipeline per take:
1. Transcribe (Whisper), detect filler/silence.
2. Claude generates 3 hook text options per format from the transcript and the brief. Hooks never add product claims.
3. Build each format with FFmpeg: cuts, ordering, captions (burned-in, styled), hook overlay, music, export in 9:16, 4:5 and 1:1.
4. Scene replacement and dubbing go through their provider interfaces (mock returns pre-rendered samples).
5. Product integrity rule: never alter the product's appearance. In v1, scene replacement keeps the foreground (creator + product) untouched. Add a TODO for a dedicated product-mask lock later.
6. Opinion integrity rule: never change the creator's words or verdict. Dubbing translates meaning only.
7. AI disclosure: any variant using scene replacement or voice dubbing gets `is_synthetic=true`, embedded metadata (use c2patool if available, else write metadata tags), and a disclosure flag passed to the brand ("Enable the platform's AI-info label when publishing"). Routine edits (cuts, captions, colour, crop) are not flagged.
8. Rank variants: Claude scores each against the format rules, hook strength and brief fit. Store score and short reasoning.
9. Creator reviews the variants in Studio, approves which ones the brand sees, then submits.

Admin QA gate: config flag `QA_REQUIRED_FIRST_N_CAMPAIGNS=100`. While under the threshold, submitted variants go to an admin QA queue before the brand sees them.

### Brand flow (web)
1. Sign up, choose country/currency, create the brand profile.
2. New campaign: paste a product URL. The server fetches the page and Claude extracts product name, description, key benefits and images into an editable form. The brand writes or edits the brief: goals, key messages, must-say, must-not-say, target audience, categories, countries, number of creators, budget per creator, deadline.
3. AI generates the creator-facing shot list from the brand's brief. The brand can edit it.
4. Payment into escrow via Stripe Checkout (test mode) for the full campaign amount. Apply any brand credit (see below).
5. Review applicants: profile cards with handle, stats, verification badge, leaderboard rank and past win rate. No contact details are ever displayed. Shortlist or invite.
6. Review variants per creator: top 5 by score shown by default, "Show all 10" toggle, side-by-side player, aspect-ratio switcher.
7. Select and license. The base campaign includes up to 3 selected variants with 90 days of paid-ad usage (Meta, TikTok, YouTube) plus perpetual organic use on the brand's own channels. Paid add-ons:
   - extra variant license (price per variant per 90 days)
   - renewal (~50% of original fee per extra 90 days)
   - buyout (perpetual, ~2x)
   - whitelisting (run from the creator's handle, ~+30%)
   Unselected variants stay locked and blurred until licensed.
8. Download licensed variants (watermark-free) with the AI-disclosure flag noted per file.
9. Choose the winning variant the creator will post on their feed. The creator is notified to post it and submits the post link.
10. Usage tracker: license expiry dates, renewal reminders (7 days before expiry) with one-click renewal.

Brand credit (Option B): when a brand's first campaign completes, auto-issue credit equal to 25% of that campaign's value, valid 60 days, applied only against the platform's 25% fee on the next campaign. Creator payouts are never reduced by credits or discounts.

### Money, wallet, withdrawals
- Store all amounts as integers in minor units with a currency code. Base currency USD. An fx_rates table (seeded, plus a refresh job hook). Display in the user's local currency; brands are charged in their currency.
- Split logic in packages/shared: creator 75%, platform 25%, applied to campaign fees and all license payments. Unit-test it.
- Escrow: brand payment held (ledger state `held`) until the brand approves the creator's submission or 5 days pass after delivery with no response (auto-approve job).
- Creator wallet ledger states: pending → cleared (brand payment settled AND submission approved) → available (after the tier delay: Pro 3 days, Free 14 days) → withdrawn.
- Withdrawals only from available balance. Methods by country: India — UPI, bank transfer; UAE — bank transfer (IBAN); anywhere — PayPal, Wise, Payoneer. In the demo, the payout provider is mocked behind a PayoutProvider interface.
- KYC at first withdrawal only (mock flow: ID photo + selfie, approved instantly in demo). Collect tax ID where required (India PAN) at that step.
- Wallet screen: balances by state, transaction history, monthly earnings statement.

### Messaging with contact masking
- Campaign-scoped chat between brand/agency and creator (Supabase Realtime).
- Before saving, scan messages for emails, phone numbers, WhatsApp/Telegram links and off-platform phrases ("DM me", "text me", "my number"). Mask the matched text and show a notice. Log attempts; flag a user after 3.

### Agency white-label (web)
- Agencies have branding settings: logo, primary colour, display name and custom subdomain (e.g., creators.agencyname.com).
- Next.js middleware resolves the request host to an agency and applies its theme. Clients of that agency see only the agency's branding, never TakeOne's.
- Agencies create client workspaces (brands) and run campaigns on their behalf with the same brand flow.
- Billing: TakeOne bills the agency at standard prices. Agencies set their own markup per client, shown on agency-branded client invoices (PDF). Platform 25% and creator 75% are calculated on the standard price, not the agency's markup.
- Agencies never see creator contact details (same masking rules).
- Non-circumvention acceptance is recorded at agency signup and brand signup (checkbox + stored timestamp + terms version). Creators accept the matching clause at signup.

### Leaderboard
- Visible to creators (mobile) and brands/agencies (web).
- Creator rankings by win rate (share of submissions selected), completed campaigns and average brand rating. Never by follower count.
- Filters: country, category. Periods: this month (resets monthly) and all-time. Separate "Rising Stars" board for creators who joined in the last 90 days.
- Earnings shown as bands (e.g., "$5k+ this month") unless the creator opts in to show exact figures.
- Brands can tap a creator on the board to invite them to a campaign.
- Brand board: brands ranked by campaigns run, approval speed and payment speed.
- Implement as SQL views or materialized views refreshed by a scheduled function.

### Admin console (web)
- QA queue (variants awaiting review before brands see them).
- Verification queue (ownership codes, screen recordings, flagged metrics).
- Users, campaigns, disputes, refunds, credits, payout overview, message-masking flags.
- Settings: QA threshold, pricing defaults, license prices, FX rates, feature flags.

## Data model (Supabase / Postgres)

Create migrations with RLS on every table. Main tables:
- profiles (id, role, display_name, country, currency, locale, avatar)
- creators (profile_id, bio, categories[], tier: free/pro, is_founding, uae_permit_number, rating_avg, win_rate, campaigns_completed, kyc_status, tax_id)
- social_accounts (creator_id, platform, handle, followers, avg_views, engagement_rate, verification: self_reported/checked/api_verified, ownership_code, ownership_verified_at, screen_recording_path, flags)
- likeness_profiles (creator_id, status, voice_provider_id, capture_paths, consent_version, created_at, revoked_at)
- likeness_consents (creator_id, campaign_id, granted_at, revoked_at)
- brands (id, name, logo, country, currency, agency_id nullable, credit_balance)
- agencies (id, name, logo, primary_color, subdomain, markup_default)
- memberships (profile_id, brand_id or agency_id, role)
- campaigns (id, brand_id, agency_id, title, product_name, product_url, product_images[], brief jsonb, shot_list jsonb, categories[], countries[], creators_needed, fee_per_creator_minor, currency, deadline, status, early_access_until, qa_required)
- applications (campaign_id, creator_id, pitch, status, invited)
- assignments (campaign_id, creator_id, status, product_shipped_at, due_at, approved_at)
- takes (assignment_id, storage_path, duration, product_check: passed/failed, transcript)
- jobs (id, type, payload jsonb, status, attempts, error, created_at) — the worker polls this
- variants (take_id, format, aspect, storage_path, thumbnail, hook_text, score, score_reason, is_synthetic, visible_to_brand, status)
- licenses (variant_id, brand_id, type: base/extra/renewal/buyout/whitelist, starts_at, ends_at, price_minor, currency)
- payments (brand_id, campaign_id, provider, provider_ref, amount_minor, currency, status, credit_applied_minor)
- ledger_entries (creator_id, source: campaign/license, amount_minor, currency, state: pending/cleared/available/withdrawn, available_at, related ids)
- withdrawals (creator_id, method, destination jsonb, amount_minor, currency, status)
- credits (brand_id, amount_minor, currency, expires_at, source_campaign_id, used_minor)
- subscriptions (creator_id, provider_ref, status, current_period_end)
- guarantee_tracking (creator_id, window_start, criteria jsonb, eligible, free_months_issued)
- messages (campaign_id, sender_id, body_masked, had_masking, created_at)
- reviews (assignment_id, rating, comment)
- fx_rates (currency, rate_to_usd, updated_at)
- terms_acceptances (profile_id, terms_type, version, accepted_at)
- audit_log

## Seed / demo data
Write a seed script that creates:
- 2 brands in India and 2 in UAE, plus 1 agency (white-labelled) with 2 client brands.
- 12 campaigns across beauty, fashion, fitness, food and tech.
- 30 creators across India and UAE with varied tiers, badges, ratings and leaderboard positions (including Rising Stars).
- One complete campaign end to end: take uploaded, 10 variants (5 real, 5 "coming soon"), 3 licensed, payment cleared, wallet balances in every state.
- Sample video files and pre-rendered variant outputs so DEMO_MODE works with no API keys.
- Demo logins for each role, printed in the README.

## Build phases (do them in order)

1. Scaffold: monorepo, shared package, Supabase migrations + RLS, seed script, env templates (.env.example for every app), README with run instructions.
2. Creator app: onboarding, country/currency, social linking + verification flows, Likeness Vault + consent, feed, campaign detail, apply, guided shoot, upload.
3. Video worker: jobs table polling, transcription, the 5 v1 formats in 3 aspect ratios, hooks, scene replacement + dubbing via providers (with mocks), ranking, metadata/AI flag, QA gate.
4. Creator Studio + submission, and the brand web dashboard: URL-to-brief, shot list, escrow payment, applicants, variant review, selection, licensing, downloads, winning post flow, usage tracker, Option B credit.
5. Money: Stripe test-mode escrow, Pro subscription, split logic + tests, ledger states, auto-approve job, wallet, withdrawals (mock payouts), first-withdrawal KYC (mock).
6. Agency white-label, messaging with masking, leaderboard, admin console.
7. Polish: design pass on the four hero screens, loading/empty/error states, accessibility basics, end-to-end test of the full flow in DEMO_MODE, Vercel deploy config for web, Dockerfile for the worker, EAS build config for mobile.

## Rules for the build
- TypeScript strict everywhere. Validate all inputs with zod.
- Money as integers in minor units only. Never floats.
- RLS on every table; creators never see other creators' private data; brands/agencies never see creator contact details or private files.
- Secrets only in env vars. Never commit keys.
- Every external service behind an interface with a mock. DEMO_MODE must run the entire flow end to end.
- Write unit tests for: split and credit logic, ledger state transitions, contact masking, metric plausibility scoring, leaderboard ranking.
- Keep a CHANGELOG.md updated after each phase.
