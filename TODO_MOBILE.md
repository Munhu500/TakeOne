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

## Design system (when mobile is restyled)
- Adopt `@takeone/design-tokens` (colours, type scale, 4pt spacing, radii, motion presets) in `src/theme`. The presets are
  plain objects so they can drive Reanimated/Moti.
- Fonts: Geist, Geist Mono, Instrument Serif via `expo-font` (files are in `apps/web/src/fonts`).
- Colour changes to carry over: tertiary text and accent-as-text were lightened to meet WCAG AA; labels on the filled
  accent are near-black, not white.
- Status vocabulary: reuse the labels in `apps/web/src/components/ui/status.tsx` (move the table to `packages/shared`).
- Remove emoji flags and the star glyph; use drawn flags and "rating 4.8".
- Method labels: "UPI", not "Upi".
- Dates as "15 Nov 2026"; money summaries without decimals; shared `pluralise`.
- Static preview: the creator app shell gets a neutral "Demo" pill injected by `scripts/build-preview.sh`.
