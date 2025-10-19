# Multi-Brand Scaffolding Overview

Sprint 15 introduces a full multi-brand scaffolding layer. Brand selection now flows from Storybook globals down to tokens, CSS scopes, and guardrails without touching component code. This document captures the operational pieces you need to work across Brand A and Brand B safely.

## Brand Switcher & Persistence

- Storybook exposes a `Brand` toolbar toggle (`A` / `B`) alongside `Theme` plus a **Story Default** option that removes the global `data-brand` attribute. The selection persists in `localStorage` (`oods:storybook:brand`) so refreshes and Chromatic runs reopen with the last brand.
- The preview decorator writes `data-brand` on both `<html>` and `<body>` so tokens and container overrides resolve automatically.
- Environment override: set `STORYBOOK_BRAND=A|B` when running `storybook dev`/`build`/`chromatic` to pin a default without touching local storage.

## Token Paths & CSS Scopes

- Brand sources live under `packages/tokens/src/tokens/brands/{A,B}/(base|dark|hc).json`.
- High level aliases expose brand primitives via `packages/tokens/src/tokens/aliases/brand-{A,B}.json`.
- UI-level mapping happens in `apps/explorer/src/styles/brand.css`. Each brand block remaps theme/system layers for light, dark, and forced-colors modes with no component changes.
- Regenerate outputs with:
  ```bash
  pnpm --filter @oods/tokens run build
  pnpm tokens:transform --mission B15.1
  ```

## Storybook Usage

- The Showcase story (`Brand/Showcase`) adapts to the active brand and theme, demonstrating the multi-brand surface contract.
- Existing Brand A specimen stories now read the global brand attribute at runtime (`BrandACommon.tsx` resolves the brand from `document.documentElement`), so switching to Brand B in the toolbar exercises the same components with Brand B tokens.

## Chromatic Baselines by Brand

- `scripts/chromatic-run.sh` now runs Chromatic once per brand (override with `--no-brand-split` or `OODS_CHROMATIC_SPLIT_BRANDS=0`).
- Per-brand diagnostics/logs land in `chromatic-baselines/brand-a/` and `chromatic-baselines/brand-b/`; each entry contains the Chromatic diagnostics, CLI log, and Storybook build log for traceability.
- The preview config defines Chromatic modes (`brand-a-light`, `brand-a-dark`, `brand-b-light`, `brand-b-dark`) so remote baselines remain isolated by brand + theme.

## Brand-Bleed Guardrail

- Canary: `apps/explorer/src/stories/__canary__/BrandBleed.canary.tsx` intentionally mixes `data-brand="A"` with Brand B tokens.
- Lint: `pnpm lint:brand-bleed` must detect the canary. The command fails if the canary stops triggering _or_ if real stories import cross-brand tokens.
- CI hook: add `pnpm lint:brand-bleed` alongside existing lint/token guardrails to keep the protection active.

## Quick Checklist

1. Toggle `Brand` in Storybook to validate stories under both Brand A and Brand B.
2. Run `pnpm --filter @oods/tokens run build && pnpm tokens:transform --mission B15.1` after touching token sources.
3. Use `scripts/chromatic-run.sh` (without `--no-brand-split`) so Chromatic uploads both brand baselines.
4. Run `pnpm lint:brand-bleed` before committing to ensure cross-brand imports are blocked and the canary still fires.
