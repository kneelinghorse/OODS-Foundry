# Storybook Configuration Audit — Sprint 30 (B30.6)

**Date:** 2025-11-24  
**Objective:** Audit Storybook configuration to ensure it does not cause display or accessibility issues.

## Scope & Checks
- CSS loading order (tokens before component styles)
- Theme switching (light/dark/brand globals)
- Decorator chain (style pollution)
- Preview head (injected scripts/fonts/resets)
- Viewport/responsive defaults

## Findings
- **CSS loading order:** PASS. `.storybook/preview.ts` imports `apps/explorer/src/styles/tokens.css` first, then overlays/index styles, then `src/styles/globals.css`, keeping tokens at the top of the cascade. Component/story styles load after globals via story-level imports.
- **Theme switching:** PASS. `GlobalsWrapper` applies `data-theme` and `data-brand` to `documentElement`/`body`, seeded from localStorage/env with defaults `light` + `brand-a`. Toolbar controls are intentionally hidden, but switching via globals (e.g., Chromatic modes) remains functional and applies all token layers.
- **Decorators:** PASS. Only `GlobalsWrapper` (globals) and `withPage` (layout wrapper) are active. `withPage` scopes styles to its wrapper, adds no global classes, and uses tokenized colors to avoid pollution.
- **Preview head:** PASS. Only the provenance script is injected (no extra fonts or resets). CSS assets are loaded via imports, not injected tags, so ordering remains predictable.
- **Viewport/responsive:** PASS. Default layout is `centered`; `withPage` supports full-width stories. No conflicting viewport overrides detected; Chromatic modes remain compatible.

## Validation Steps
- Verified import order in `.storybook/preview.ts`.
- Confirmed global attributes set by `GlobalsWrapper` and brand/theme resolution logic.
- Reviewed decorators (`.storybook/decorators/withPage.tsx`) and manager setup (`.storybook/manager.ts`) for unintended styles.
- Checked head injection in `storybook.config.ts` (provenance script only).

## Recommendations (kept non-breaking)
- Leave toolbar theme/brand controls hidden for hosted display consistency; when local toggling is needed, set `hidden: false` in `globalTypes` and clear `localStorage['oods:storybook:brand']` to expose switches.
- If drift recurs, add a quick e2e probe that asserts `documentElement.dataset.theme/brand` change on `setGlobals`.
- Keep token build-once behavior in `storybook.config.ts` (`pnpm --filter @oods/tokens run build`) to avoid cache misses; re-run if tokens change.

## Status
All audited criteria pass with no configuration changes required. Documentation added for future contributors.
