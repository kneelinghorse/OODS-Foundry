# Storybook Configuration Guide

Applies to the OODS Foundry Storybook (React Vite).

## Quick Start
- `pnpm storybook` — run locally at http://localhost:6006.
- Chromatic uses `storybook-static/` from `pnpm build-storybook`; modes cover brand/theme combinations.

## Key Files
- `.storybook/main.ts` — remaps base config paths; sets chunk size warning limit.
- `storybook.config.ts` — source-of-truth Storybook config; builds tokens once, adds tsconfig path aliases, and widens Vite fs allowlist.
- `.storybook/preview.ts` — imports CSS (tokens → overlays/index → globals), applies theme/brand globals, sets centered layout, defines Chromatic modes, and registers decorators.
- `.storybook/manager.ts` — minimal manager setup (right-hand panel, React globals).
- `.storybook/decorators/withPage.tsx` — layout wrapper (full-width/centered options) without global style pollution.
- `apps/explorer/.storybook/Intro.mdx` — landing splash; keeps sidebar order aligned with taxonomy.

## CSS & Tokens
- Load order is intentional: `tokens.css` → overlay/index styles → `globals.css` → story/component styles. Keep token imports first in `preview.ts` to preserve the cascade.
- If tokens change, rerun Storybook to trigger the single `pnpm --filter @oods/tokens run build` invoked by `storybook.config.ts`.

## Theme & Brand
- Globals set `data-theme` and `data-brand` on `<html>/<body>` via `GlobalsWrapper`.
- Defaults: `theme=light`, `brand=brand-a`. Brand persists in `localStorage` (`oods:storybook:brand`) and can be overridden via `STORYBOOK_BRAND`.
- Toolbar controls are hidden for hosted display consistency; to expose them locally, set `hidden: false` in `preview.ts` `globalTypes` and clear the stored brand key.
- Chromatic exercises all combinations via `parameters.chromatic.modes` (brand A/B, light/dark).

## Addons in Use
- `@storybook/addon-docs`
- `@storybook/addon-a11y`
- `@storybook/addon-onboarding`
- `@storybook/addon-vitest`
- `@chromatic-com/storybook`
- `./apps/explorer/addons/storybook-addon-agent/register.tsx`

## Validation Tips
- Verify globals: check `documentElement.dataset.theme/brand` changes when toggling (or when Chromatic modes run).
- Check CSS cascade: devtools → Elements → Styles; ensure `tokens.css` appears before component/story styles.
- For cache issues, clear `node_modules/.cache/storybook` and rerun `pnpm storybook`.

## Troubleshooting
- Missing tokens: ensure `pnpm --filter @oods/tokens run build` completed; restart Storybook.
- Inconsistent theme: clear `localStorage['oods:storybook:brand']` and reload.
- Layout drift: confirm stories wrap with `withPage` when a constrained width is needed; set `fullWidth` for full-bleed scenarios.
