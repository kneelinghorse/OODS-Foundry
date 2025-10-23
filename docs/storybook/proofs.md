# Storybook Proof Galleries

Curated proof galleries keep the brand and high-contrast contracts obvious inside Storybook. Each story
pre-sets the theme/brand globals so reproducible screenshots and guardrail checks stay deterministic.

## Brand Showcase (`Brand/Showcase`)

- `Showcase` renders the Light, Dark, and High Contrast cards together for quick visual parity checks.
- Individual `Light`, `Dark`, and `High Contrast` stories pin the globals to brand A so toolbar overrides no
  longer create duplicate entries. Use the brand toolbar only when you intentionally need to audit brand B.
- Chromatic tags (`brand-light`, `brand-dark`, `brand-hc`) remain attached for PR review parity.

## High Contrast Proof Gallery (`Brand/High Contrast/Proof Gallery`)

- Stories are limited to the contract essentials:
  - `Interactive Surfaces` &mdash; tab through button states and confirm Highlight/HighlightText mapping.
  - `Status Chips` &mdash; matrix view of the semantic ramp rendered using system colors.
  - `Focus Indicators` &mdash; grid demonstrating the dual-ring focus reserve.
- Each story mounts with `data-brand="A"` and the light theme so forced-colors emulators see the canonical
  context. Use Windows High Contrast or dev tools forced-colors mode to validate tokens.

## How to Validate

1. `pnpm storybook` from the repo root.
2. Open **Brand/Showcase** or **Brand/High Contrast/Proof Gallery**.
3. Toggle the `Brand` toolbar if you need to inspect brand B; snapshots default to brand A.
4. For high-contrast checks, enable forced colors (Windows High Contrast or Chromium dev tools → Rendering →
   Emulate CSS media feature `prefers-contrast` + `forced-colors`).
5. Log results in `artifacts/storybook/hc-proof-results.json` (see template in repo) when closing the audit.
