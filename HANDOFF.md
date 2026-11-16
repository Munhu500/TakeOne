# Handoff — premium web overhaul, prompt 4 of 4 (admin console)

Written 16 Nov 2026. Branch `premium-web`, pushed to `origin` (`https://github.com/Munhu500/TakeOne.git`).
Prompts 1, 2, 3 and 3.1 are finished and committed. Prompt 4 is part-way: the database is done, the web pages are mostly not.

Last commits:

- `86bfb65` WIP: prompt 4 — admin shell, role-aware nav, two-factor page, Overview and Audit log
- `d1eea94` Admin console 4/4, part 1: roles, two-factor, audited actions (database)
- `be94c31` Fixes from screenshot review (3.1)

## Prompt 4 status

"Database" means migration `20260101000014_admin_roles_audit.sql` (plus 015 and 016). It is applied to the hosted
Supabase project (`strscyapzulhxsrrhndg`) and passes `supabase/tests/admin_roles.test.sql`.

| | Section | Status | What exists |
|---|---|---|---|
| A | Remove Credits, fix seed | **Done** | Credits page and nav removed (tables kept, `admin_issue_credit` revoked). Seed uses proper names; hosted "lunga" ×2 renamed "Lunga", not deleted. |
| B | Roles, 2FA, audit | **In progress** | Database done and tested per role. Web: `lib/admin.ts` (`requireAdmin`), `components/admin/reason-action.tsx` (reason dialog), `/mfa` enrol/verify page, Audit log page. 2FA flow not tested end to end. |
| C | Overview | **Done** (no screenshot yet) | `app/admin/page.tsx`: four month-on-month cards, four health cards, "Needs attention", sidebar count badges. |
| D | QA review room | **Not started** (web) | Database done: `qa_review` with reason codes, `admin_qa_approve_passing`, `variants.auto_checks`; seed has a failing check ("Glowing skin in 30 days, guaranteed"). No page. |
| E | Verification | **Not started** (web) | Database done: `admin_verify_social`, `admin_reject_claim` (strike), `admin_request_recording`. No page. |
| F | Users | **Not started** (web) | Database done: `admin_list_users()`, suspend/reinstate, change tier, reset verification. No page. "Resend invite" has no backend. |
| G | Campaigns | **Not started** (web) | Database done: `admin_campaign_action` (pause, resume, extend, cancel_refund), `paused` status. No list or detail page. |
| H | Disputes | **Not started** (web) | Database done: typed disputes, `admin_resolve_dispute`, `refunds`, `request_extension` / `respond_extension`, escalation job. Seed has a deadline-extension dispute. No admin page; no brand-side approve/decline UI. |
| I | Payouts | **Not started** (web) | Database done: `on_hold`, `admin_withdrawal_action`, auto-hold trigger, `payout_hold_rules`. Seed has one held and one failed withdrawal. No page. |
| J | Masking flags | **Not started** (web) | Database done: `masked_originals`, `admin_reveal_original` (Trust & Safety only), `admin_masking_action`. No page. |
| K | Settings | **Not started** (web) | Database done: `admin_update_settings`, `admin_set_fx`, `admin_run_job`, `job_runs`, `fee_ranges`, `pro_prices`. No page; brand wizard still uses a hard-coded fee range. |
| L | Quality bar | **Not started** | `admin/loading.tsx` and `error.tsx` exist. `QueueClear` and `Pager` helpers exist. No screenshots taken. |

## Where it stopped

About to write the QA review room. `apps/web/src/app/admin/qa/` does not exist yet.

**The sidebar links to QA review, Verification, Users, Campaigns, Disputes, Payouts, Masking flags and Settings all 404**
until those pages are written. Only `/admin`, `/admin/audit` and `/mfa` work.

Next three steps:

1. Write `app/admin/qa/page.tsx` + `room.tsx`. Query `variants` where `status = 'qa_pending'` joined to
   `takes → assignments → campaigns → brands`, group by take (oldest first), sign URLs from the `variants` bucket
   (see the old page: `git show d1eea94:"apps/web/src/app/admin/[section]/page.tsx"`). Client room: take list,
   9:16 `VideoFrame`, variant rail with scores, details panel with `auto_checks`, shortcuts J/K, A, R, Shift+A.
   Approve calls `qa_review` with a standard reason (it must be at least 10 characters); reject passes `p_code` and `p_note`.
2. Write the remaining pages in this order: Verification, Users, Campaigns (+ `[id]`), Disputes, Payouts, Masking flags,
   Settings. Use `requireAdmin(area)`, `ReasonAction`, `QueueClear`, `Pager`, `paginate`. The RPC names and arguments are
   in migration 014. Every function name the UI calls must be in `ALLOWED` in `lib/actions.ts` and `lib/actions.preview.ts`
   (the admin ones are already there).
3. For each new page add a line to `ROUTES` in `apps/web/src/preview/host.tsx` and to `ADMIN` in
   `apps/web/src/app/[[...slug]]/page.preview.tsx`, then update `e2e/preview-check.cjs` (its admin steps still expect the
   old QA queue, "FX rates" and "Licence prices" text and will fail).

After that: brand-side extension requests on the campaign Creators tab (`respond_extension`), brand wizard reading
`fee_ranges` labelled "Suggested", README (admin roles, demo admin logins, the 2FA bypass), CHANGELOG, TODO_MOBILE, the ten
screenshots, final commit.

## Decisions that are not obvious from the code

**Money**
- Split is 75% creator / 25% platform on every payment, including licences, renewals and buyouts. Platform fee is read-only in Settings.
- Credits are off: `CREDITS_ENABLED=false`, feature flag `credits: false`. Tables stay; no UI.
- Licence term is 35–45 days, default 45 (`campaigns.license_term_days`, `LICENSE_TERM`). This replaces the 90 days in CLAUDE.md.
- Creator Pro prices per market: ₹699, AED 69, USD 19 (`pro_prices` setting, `PRO_PRICES`).
- Suggested creator fee ranges: ₹12,000–25,000, AED 1,200–2,500, USD 300–600 (`fee_ranges` setting). Shown as "Suggested", never enforced.
- Earnings bands on leaderboards are per market, not converted from USD.
- **Combined checkout is not built.** The review room has one confirm button, but it calls `buyLicense` once per licence in a
  loop. In demo mode that looks like one purchase. With real Stripe it redirects after the first licence and the rest are
  not bought. I have no record of a decision on this; see "Awaiting your input".

**Wording**
- British English everywhere (web, emails, PDFs, demo data): "licence" noun, "license" verb, "colour", "organise", "cancelled".
- "Partnership ad", never "whitelist", in anything a user reads (the database type is still `whitelist`).
- Public copy never says the product is "live". Creator sign-up goes to the waitlist while the app is unreleased.
- Never mention API keys in user-facing text.

**Design**
- Accent fill `#6A4BF0` with white labels (hover `#5B3DE0`). `#7C5CFF` is kept as `accent-brand` for the logo and marks only.
  Accent text `#9980FF`, tertiary text `#898991`.
- Agency colours go through `fillFor()`, which darkens them until white labels pass AA.
- `pnpm check:tokens` fails the build on raw hex, arbitrary Tailwind values, off-scale spacing, opacity modifiers and emoji.
- `NEXT_PUBLIC_SITE_URL` defaults to `https://lm-softwaresolutions.com`.

**Admin**
- Roles: QA, Verification and Masking are Operations + Trust & Safety; Payouts and money disputes are Finance; Settings, flags,
  FX and jobs are Super admin only. Super admin can do everything except read an original masked message.
- Original (unmasked) messages are stored in `masked_originals`. Nobody can select from it; only Trust & Safety can read one
  through `admin_reveal_original`, with a reason, audited. Not even Super admin.
- 2FA: `is_admin()` is false until the session is `aal2`. The bypass is `profiles.mfa_exempt`, honoured only when the
  database is in demo mode. All four demo admins have it.
- Every admin action needs a reason of at least 10 characters, enforced in the database by `admin_guard`.
- The console is never white-labelled (`Shell … internal`).
- There is no service-role key anywhere. Privileged work is SECURITY DEFINER functions called with the user's JWT.

## Known issues and TODOs

- Eight admin sidebar links 404 (above).
- `e2e/preview-check.cjs` will fail on its admin steps. `pnpm build:preview` itself has not been run since the admin changes.
- 2FA enrol and verify (`/mfa`) is untested against real Supabase MFA.
- `pnpm db:verify` last passed at `d1eea94`; the seed has changed slightly since and it has not been re-run.
- "Resend invite" needs the Supabase auth admin API, which needs a service-role key. Not possible as built.
- FX "Refresh now" has no live rate source; `fx_refresh` is a hook that only records a run.
- The demo-mode toggle's live-keys checklist must be checked on the server from env vars; not written.
- Creator-side "request an extension" is a mobile screen. The RPC exists; add it to `TODO_MOBILE.md` along with suspension messages.
- README, CHANGELOG and TODO_MOBILE do not mention prompt 4 yet.
- QA approvals will send a standard reason so keyboard review stays fast. Say so in the final report.

## Awaiting your input

1. Combined checkout: should several licences be one Stripe payment? It needs a new multi-line checkout and webhook path.
2. Retention of original masked messages: how long to keep `masked_originals`? Nothing deletes them today.
3. The two real "Lunga" accounts on the hosted project: keep both, or remove one? They are only tagged "Possible duplicate".
4. Demo accounts share a published password (`TakeOne-demo-2026`). Change it before the link leaves the team.
5. Whether Super admin should also be able to reveal original messages.

## Verify the build

Run from the repo root.

```bash
pnpm check:tokens
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm db:verify
```

```bash
pnpm --filter @takeone/web build
```

```bash
pnpm build:preview
```

```bash
node scripts/preview-server.cjs preview-dist 8090
```

```bash
node e2e/preview-check.cjs
```

At `86bfb65`: tokens, typecheck, tests (69 shared, 40 tokens) and the web build pass. `db:verify`, `build:preview` and the
preview check were not re-run.

Notes for this sandbox: `pnpm build:preview` overwrites `apps/web/.next`, so rebuild the web app before `next start`.
Node needs `NODE_USE_ENV_PROXY=1` to reach Supabase. If typecheck complains about a deleted route, remove `apps/web/.next/types`.

Demo logins (password above): `admin@takeone.demo` (Super admin), `admin.ops@`, `admin.finance@`, `admin.trust@`,
`brand@`, `agency@`, `creator@takeone.demo`.
