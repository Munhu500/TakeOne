# Mobile follow-ups from the web overhaul

The Expo creator app is out of scope for the web premium overhaul. Nothing below has been done on mobile;
the only mobile change so far is one line of copy ("whitelisting" → "partnership ads") forced by the rename.

## Forced by shared data and business rules
- **Product images are gone from demo data.** `campaigns.product_images` is now empty for seeded campaigns (the illustrated
  placeholders were removed). Feed cards (`(tabs)/index.tsx`) and campaign detail (`campaign/[id].tsx`) render an empty
  image. Add a neutral product tile like web's `ProductImage`, and read real photos once they are supplied.
- **Seeded variants have no footage.** `variants.storage_path`, `thumbnail` and `renditions` are empty for the seeded
  campaign. Studio (`studio/[id].tsx`) shows blank thumbnails; add a "Footage coming soon" frame like web's `VideoFrame`.
  Variants rendered by the worker from a real take are unaffected.
- **Licence term is 45 days (35–45), not 90.** Mobile already reads `LICENSE_DEFAULTS.termDays`, so the number is right;
  check any hard-coded "90 days" in store listings or onboarding copy.
- **Campaign credit is disabled** (`CREDITS_ENABLED=false`). Mobile never showed brand credit; no change needed.
- **"Whitelist" is now "Partnership ad"** everywhere users see it. Wallet ledger descriptions come from the database and
  are already renamed. Use `LICENSE_LABELS` from `@takeone/shared` for any new label.

- **Leaderboard rules changed in shared code.** `rankCreators` now shows the main board (3+ completed campaigns) by
  default and orders by `(wins + 2) / (submissions + 4)`, then rating, then completed. The mobile leaderboard picks
  this up automatically; pass `careerCompleted` for the monthly view and use `exactEarnings` (no minor units) for
  creators who show exact figures. Earnings bands now read "₹4.2L+".
- **Licence term is per campaign** (`campaigns.license_term_days`, 35–45). Campaign detail should read it from the
  campaign instead of `LICENSE_DEFAULTS.termDays`.
- **Demo creators were renamed** so names match countries. Nothing to change, but screenshots will differ.

- **Creator Pro price is fixed per market** (`pro_prices` setting; `proPriceFor(country)` in shared). The Pro screen's
  button was updated to use it (one line); check any other place the price is shown.
- **Earnings bands are per market** (`earningsBand` now returns ₹25K+ … ₹20L+ and AED 1K+ … 60K+).
- **Display names:** use `categoryLabel` and `countryName` from shared instead of raw values.

## Design system (when mobile is restyled)
- Adopt `@takeone/design-tokens` (colours, type scale, 4pt spacing, radii, motion presets) in `src/theme`. The presets are
  plain objects so they can drive Reanimated/Moti.
- Fonts: Geist, Geist Mono, Instrument Serif via `expo-font` (files are in `apps/web/src/fonts`).
- Colour changes to carry over: tertiary text `#898991` and accent text `#9980FF` (dark) meet WCAG AA; the filled accent
  is `#6A4BF0` with a white label, and `#7C5CFF` stays as `accent-brand` for marks, indicators and focus rings.
- British English in all copy: "licence" (noun), "license" (verb), "colour", "cancelled".
- Status vocabulary: reuse the labels in `apps/web/src/components/ui/status.tsx` (move the table to `packages/shared`).
- Remove emoji flags and the star glyph; use drawn flags and "rating 4.8".
- Method labels: "UPI", not "Upi".
- Dates as "15 Nov 2026"; money summaries without decimals; shared `pluralise`.
- Static preview: the creator app shell gets a neutral "Demo" pill injected by `scripts/build-preview.sh`.
