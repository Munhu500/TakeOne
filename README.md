# TakeOne

Two-sided marketplace: creators shoot **one take** with a real product, the **Variant Engine** turns it into up to ten ad variants, and brands (or agencies on their behalf) license the winners. Platform keeps 25%; creators keep 75% of every payment. Launch markets: India and UAE (INR, AED, USD fallback).

This is the demo / v1 build. With `DEMO_MODE=true` every external AI and payment service is mocked, so the whole flow runs with no API keys.

## What's in the repo

| Path | What |
| --- | --- |
| `apps/mobile` | Creator app. Expo SDK 58, Expo Router, TypeScript. iOS, Android and a web export. |
| `apps/web` | Next.js 15 App Router. Landing page, brand dashboard, agency white-label dashboard, admin console. |
| `packages/shared` | Types, zod schemas, the 10 format definitions, currency utilities, pricing/split, ledger, masking, plausibility, leaderboard logic + unit tests. |
| `packages/providers` | Provider interfaces with real and mock implementations: Claude, Whisper, ElevenLabs, Replicate, Stripe, Razorpay (stub), payouts, KYC. |
| `services/video-worker` | Node + FFmpeg worker. Polls the `jobs` table, builds variants, runs scheduled jobs. Dockerfile + `fly.toml`. |
| `supabase` | Migrations (schema, RLS, business functions), `seed.sql`, SQL tests, one scheduled Edge Function. |
| `e2e` | Playwright scripts for the full DEMO_MODE flow. |

### How the backend is put together

- **Reads** go straight from the apps to Supabase with the signed-in user's session. Row Level Security decides what comes back.
- **Every privileged operation** (pay into escrow, accept a creator, submit variants, QA, select/license, approve, withdraw, send a message…) is a Postgres function in `supabase/migrations/…_ops.sql` that checks who is calling. Neither app needs a service-role key in demo mode.
- **Private files** are gated in Storage by the same rules: a brand can stream a watermarked preview once a variant is delivered, and the clean file only while it holds an active license.
- **The worker** signs in with its own least-privilege login (`worker` role) and can only call the `worker_*` functions and write to its storage paths. A service-role key also works.
- **Real payments** (`DEMO_MODE=false`): Stripe Checkout → `/api/webhooks/stripe` → the same Postgres functions, called with the service role.

## Run it

Requirements: Node 20+, pnpm 10, FFmpeg (with libass), Python 3 + Pillow (only for regenerating sample media), and a Supabase project (hosted, or `supabase start` with Docker).

```bash
pnpm install
cp .env.example .env            # fill SUPABASE_URL + SUPABASE_ANON_KEY (+ worker login)
cp apps/mobile/.env.example apps/mobile/.env
```

### 1. Database

Hosted project:

```bash
supabase link --project-ref YOUR_REF
supabase db push                         # applies supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # demo data (or paste into the SQL editor)
```

Local stack: `supabase start` then `supabase db reset` (runs migrations + `seed.sql`).

Then create the worker login: edit the password in `scripts/create-worker.sql`, run it in the SQL editor, and put the same password in `WORKER_PASSWORD`.

No Docker? `pnpm db:verify` applies the migrations, the seed and the SQL tests to a throwaway local Postgres (it only needs the Postgres binaries).

### 2. Sample media

```bash
pnpm samples -- --upload     # builds the sample take + 5 variants × 3 aspect ratios with FFmpeg and uploads what the seed points at
```

### 3. Apps

```bash
pnpm --filter @takeone/video-worker start     # the Variant Engine
pnpm --filter @takeone/web dev                # http://localhost:3000
pnpm --filter @takeone/mobile dev             # Expo: press i / a, or w for web
```

Agency white-label: the seeded agency uses the host `mirage.localhost`, so open `http://mirage.localhost:3000` to see the agency-branded sign-in.

### Demo logins

Password for all of them: `TakeOne-demo-2026`

| Role | Email | Where |
| --- | --- | --- |
| Creator (Pro, India) — has the complete campaign and a wallet in every state | `creator@takeone.demo` | mobile |
| Creator (Free, India) | `creator.free@takeone.demo` | mobile |
| Creator (UAE) | `creator.ae@takeone.demo` | mobile |
| Brand — Kaya Glow (India) | `brand@takeone.demo` | web |
| Brand — Dune Athletics (UAE) | `brand.ae@takeone.demo` | web |
| Brand — Chai & Co / Souk Tech | `brand.chai@takeone.demo`, `brand.tech@takeone.demo` | web |
| Agency — Mirage Media (clients Noor Beauty, Veda Wear) | `agency@takeone.demo` | web |
| Admin | `admin@takeone.demo` | web `/admin` |

Change or delete these accounts before pointing a public URL at the project.

### A 5-minute demo path

1. **Mobile** as `creator@takeone.demo`: Feed → My work → *SPF 50 Invisible Sunscreen launch* → **Start shoot** → *Demo: use the sample take* → **Upload take**. Studio shows the worker's progress, then the ranked variants. Change a hook (it re-renders), then **Submit**.
2. **Web** as `brand@takeone.demo`: open the campaign → *Creators & variants* → **Review variants**. Pick up to 3, buy an add-on, choose the winner, approve with a rating.
3. Back on **mobile**: Wallet shows the earning cleared; Studio asks for the post link.
4. **Web** as `admin@takeone.demo`: QA queue, verification queue, disputes, settings.
5. **Web** as `brand@takeone.demo`: open the draft *Night Repair Retinol Cream* → pay. The first-campaign credit is applied against the platform fee only.

## Tests

```bash
pnpm test          # unit tests: split + credit, ledger transitions, masking, plausibility, leaderboard, schemas
pnpm db:verify     # SQL: migrations, RLS smoke tests, and the whole money flow through the database functions
pnpm typecheck
```

End-to-end (apps + worker running, mobile served from `apps/mobile/dist` on :8081 via `node e2e/serve-spa.cjs apps/mobile/dist 8081`):

```bash
ASSIGNMENT_ID=<an 'accepted' assignment of creator@takeone.demo> node e2e/creator-flow.cjs
ASSIGNMENT_ID=<same id> node e2e/brand-flow.cjs
```

## What is mocked in DEMO_MODE

| Service | Real implementation | Demo behaviour |
| --- | --- | --- |
| Claude (brief extraction, shot list, hooks, ranking, product check, hook rewrites) | `ClaudeLlm` (`@anthropic-ai/sdk`) | Deterministic stand-in. Hooks are cut from the creator's own sentences; product check passes when frames can be sampled. |
| Whisper | `WhisperTranscriber` | The sample take uses its real timed transcript; other videos get a canned review stretched over the take. |
| ElevenLabs dubbing | `ElevenLabsDubbing` | Translated captions (Hindi/Arabic/Tamil for the sample), **placeholder audio** (music bed, labelled "demo audio"). |
| Scene replacement | `ReplicateScene` (video matting) | The sample take's flat wall is keyed out and a pre-drawn scene is composited. Other videos pass through unchanged. |
| Stripe | `StripeProvider` + webhook | Checkout "succeeds" instantly; escrow, licenses and Pro are confirmed in the database. |
| Razorpay | `RazorpayProvider` | Stub that throws; interface only. |
| Payouts | `PayoutProvider` | Marked paid instantly. |
| KYC | `KycProvider` | ID photo + selfie accepted and approved instantly. PAN format is validated for India. |
| Ownership verification | hook in `socials.tsx` / `admin_verify_social` | An admin approves from the console. |
| Public metrics cross-check | hook in the worker (`verifyMetrics`) | Deterministic mocked public numbers scored by `scoreMetricPlausibility`. |
| YouTube Data API | `/api/mobile/youtube` (real OAuth) | Needs a Google OAuth client; otherwise the button explains what is missing. |
| C2PA | `c2patool` if installed | Otherwise the AI disclosure is written as container metadata tags. |
| Sample creator | — | An illustrated creator with synthesised speech, so no real person's footage ships in the repo. |

Real mode: set `DEMO_MODE=false`, add the keys in `.env.example`, set the `demo_mode` setting to `false` in the admin console, and point a Stripe webhook at `/api/webhooks/stripe`.

## Deploy

- **Web → Vercel**: import the repo, root directory `apps/web` (`vercel.json` is there), add the env vars from `apps/web/.env.example`. For agency domains, add each domain to the Vercel project; the middleware themes by host.
- **Worker → Fly.io / Render**: `docker build -f services/video-worker/Dockerfile -t takeone-worker .` from the repo root, or `fly launch --copy-config` with `services/video-worker/fly.toml`.
- **Mobile → EAS**: `cd apps/mobile && eas build --profile preview`. To update dependencies later: `npx expo install --fix`.
- **Scheduled jobs**: the worker runs them every minute. Without a worker, schedule `supabase/functions/scheduled-jobs` or call `select run_scheduled_jobs()` from pg_cron.

## Known gaps in v1

- Formats 2, 3, 4, 7 and 8 are defined in `packages/shared/src/formats.ts` and shown as "coming soon".
- Product-mask lock for scene replacement is a TODO in `services/video-worker/src/pipeline.ts`; v1 keeps the whole foreground untouched.
- Unfilled creator slots are not refunded automatically when a campaign ends; refunds go through admin disputes.
- Screen recording uses the phone's own recorder with an app-generated code and timestamp shown on screen, then uploads the file.
- The money maths exists in TypeScript (`packages/shared`, unit-tested) and in SQL (`creator_share`, tested in `supabase/tests`). Change both together.

## Static preview (plain Apache hosting, e.g. Hostinger)

```bash
pnpm build:preview     # → preview-dist/ and takeone-preview.zip (extract the zip's contents into public_html)
pnpm serve:preview     # local test server that applies the same rules as the generated .htaccess, on :8090
node e2e/preview-check.cjs
```

No server is involved: the browser talks to Supabase with the public anon key and calls the same Postgres functions as the full app. The build fails if a secret, `.env` file, source map or source file ends up in `preview-dist/`.

How it stays separate from the normal build: preview routes are `*.preview.tsx` files that are only routes when `NEXT_PUBLIC_STATIC_PREVIEW=true` (via `pageExtensions`), and `next.config.mjs` swaps the server modules (`lib/session`, `lib/actions`, `lib/checkout`, `lib/supabase-server`, `lib/ai`, `components/invoice-link`, `next/link`, `next/navigation`) for browser versions only in that mode. `src/preview/host.tsx` runs the existing page functions in the browser.

- Dashboard URLs are unchanged. Pages with an id (`/brand/campaigns/<id>/`) share one exported placeholder page that `.htaccess` serves for any id, so campaigns created after the build work too.
- Agency white-label: add `?agency=<slug>` (seeded: `?agency=mirage`). It is remembered for the browser tab; `?agency=` clears it.
- Creator app is served from `/app/` (`EXPO_PUBLIC_STATIC_PREVIEW=true` sets `experiments.baseUrl`).
- Preview-only limits: payments are always simulated, the brief draft from a product URL is a starter template (no page fetch), new takes only become variants while a video worker is running somewhere, and the Stripe webhook / YouTube verification routes do not exist.
