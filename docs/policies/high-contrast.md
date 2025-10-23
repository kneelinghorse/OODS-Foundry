# High-Contrast (Forced Colors) Policy

## Overview
- Forced-colors is an accessibility override that replaces author colors with a small system-controlled palette.
- Our semantic tokens chain now terminates in CSS system colors when `@media (forced-colors: active)` is true.
- Resilient focus indicators and transparent borders prevent regressions when box shadows are suppressed.

## System Color Mapping
- Canonical map: `app/packages/tokens/src/tokens/themes/high-contrast/map.json`
- Key assignments (all other semantics derive from these):
  - Surfaces → `Canvas`
  - Foreground text/icons → `CanvasText`
  - Muted/disabled text → `GrayText`
  - Interactive accents → `Highlight` / `HighlightText`
  - Link text → `LinkText`
- Runtime overrides are authored in `app/apps/explorer/src/styles/hc.css`, which applies the map to the system (`--sys-*`) layer so every component inherits the correct system color.

## CSS Authoring Guidance

### Transparent Border Baseline
- Always reserve a `1px` border (`border: 1px solid transparent;`) on cards, panels, menus, dialogs, and other shells that usually rely on `box-shadow`.
- Use `box-shadow` (or inset shadows) for aesthetic borders so forced-colors can safely paint the reserved border without layout shifts.
- Ensure shells do not reset `border-width` on focus/hover; only the color should vary.

### Outline-First Focus
- Prefer `outline` + `outline-offset` for every focusable control (`:focus-visible`), using `--sys-focus-ring-outer` and `--sys-focus-width`.
- Optional inner glows may be created with shadows, but the outline alone must meet ≥3:1 contrast.
- Do not remove outlines globally; if a bespoke treatment is required, reapply an outline that honors the token values.

### Forced-Color Adjustments
- Leave `forced-color-adjust` at its default (`auto`). Only opt out (`none`) when a native system color cannot convey the state.
- When targeting forced-colors directly, override the system layer (`--sys-*`) instead of component variables to keep the cascade deterministic.

## Automation & Guardrails
- Run `pnpm run tokens:guardrails` (see `scripts/tokens/color-guardrails.ts`) to verify ΔL/ΔC/ΔH ranges for every interactive token pair. The script fails CI when a state drifts outside the guardrail window or loses the required contrast ratio.
- Add `pnpm run test:contrast` to pull-request checks. The Vitest suite in `testing/a11y/contrast.spec.ts` evaluates the semantic token map via `@oods/a11y-tools` and blocks merges when ratios fall below 4.5:1 (text) or 3:1 (icons).
- Storybook surfaces the proof set under **Brand/High Contrast/Proof Gallery (HC)**. The stories exercise primary, semantic, and focus tokens so forced-colors regressions surface in Chromatic or the fallback Storycap run.
- GitHub’s `tokens-validate` check (Sprint 14) runs the transform in `--check` mode, semantic lint, and this guardrail suite—expect PRs to stay red until all three pass.

## HC Snapshot Workflow (Required)
- Chromatic is configured to fail PRs on visual diffs (baseline is auto-accepted on `main`).
  1. Tag the 10 critical stories listed in `missions/research/r5.7_High-Contrast-Mode-Regression-Prevention.md` with a `forcedColors` Storybook parameter.
  2. Ensure Storybook disables animations during CI and that `@media (forced-colors: active)` rules apply to components via `app/apps/explorer/src/styles/hc.css`. The **Brand/High Contrast/Proof Gallery (HC)** proof stories should stay green before publishing Chromatic snapshots.
  3. CI publishes snapshots to Chromatic; PRs fail when HC diffs exceed the configured threshold. Merge to `main` establishes or updates the baseline automatically.
  4. For local reproduction, use DevTools emulation (`Rendering > Emulate CSS media feature forced-colors`) and validate the checklist below.

## Manual Verification Checklist
- [ ] Enable `forced-colors` and confirm all surfaces preserve separation (reserved borders repaint).
- [ ] Tab through interactive controls and confirm the outline focus ring is visible against both Canvas and Highlight backgrounds.
- [ ] Inspect status chips across tones; each should swap to the correct system color pairing.
- [ ] Validate documentation matches reality by spot-checking tokens from `map.json` against computed styles in DevTools.

## HC Baseline Workflow
- Local (serve + capture):
  - From `app/`, run `npm run build-storybook` and serve it on port 6006 (e.g., `npx http-server -p 6006 ./storybook-static`).
  - In repo root, run `node app/testkits/vrt/storycap.hc.mjs --out artifacts/vrt/hc/local`.
  - Review PNGs under `artifacts/vrt/hc/local/` for obvious issues.
- CI (non-blocking artifact):
  - Workflow `.github/workflows/vrt-hc.yml` builds Storybook, serves it, and runs `storycap.hc.mjs` with forced-colors emulation.
  - Download the `vrt-hc-<run_id>` artifact to inspect diffs when regressions are suspected.
- Accept/update baseline:
  - The HC source of truth lives in CI artifacts, not Chromatic.
  - To accept a new baseline, trigger the workflow on `main` and download the artifact as the current baseline bundle. Store it in your team’s artifact store or attach to the release notes.
  - For offline comparisons, keep a local folder (e.g., `artifacts/vrt/hc/baseline/`) with the latest accepted bundle; compare current captures against it using an image diff tool when necessary.
