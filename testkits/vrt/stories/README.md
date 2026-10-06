# Playwright VRT specs

Chromatic remains the primary visual regression gate. What lives here is the behavioural
Playwright harness that runs against a built Storybook.

## What runs, and where

| project | specs | runner |
| --- | --- | --- |
| `chromium` (1280×720) | `forms/form.accessibility.spec.ts`, `statusables/toast.spec.ts` | `pnpm vrt:desktop`, and CI's a11y-contract job |
| `mobile-375`, `tablet-768` | `mobile/*.spec.ts` | `pnpm vrt:mobile`, and CI's a11y-contract job |

Both projects are **behavioural only** — focus order, `aria-describedby` wiring, Esc handling,
computed layout, axe with the drawer open. There are no committed screenshot baselines in this
directory and no spec here takes one.

## Resolve story ids through the index

Never hard-code a story id. Use `resolveStoryId` from `utils/storybook.ts` with the story's
title (a `string[]` if a former title is worth aliasing) and name. This does not make a spec
rot-proof — a deleted title still fails — but it fails LOUDLY and by name
(`Story not found for titles: ...`) instead of navigating to a 404 page and then failing on an
unrelated missing locator. Two specs here carried invalid ids: form.accessibility's id never
matched its original `Forms/TextField` title (`d6f2567`), while toast's id died in the
2025-10-21 taxonomy normalization (`488191c`). They stayed red because no CI job ran this
project; s174 m03 fixed both and added the runner.

## Retired in s174 m03, and the gap it leaves

`hc/brand-a.spec.ts` (eight `BrandA/*` titles, none of which exist in the story index) and
`viz/layout.visual.spec.ts` (a screenshot spec that never had a committed baseline, so every
run was nine missing-snapshot failures) were removed. Neither compared anything; both were
red by construction.

**Recorded gap, accepted deliberately:** with those two gone, NO running control compares any
pixel under `forced-colors`. The survivors are insufficient and it is worth knowing why —
`storycap.hc.mjs` (`pnpm vrt:hc`) writes images with no diff consumer and is not wired into
CI; `e2e/overlays.accessibility.spec.ts` matches no vitest or Playwright project, so it cannot
run at all; Chromatic carries two forced-colors stories behind a token-gated
`continue-on-error` job. A successor is deliberately not chartered — the committed
screenshot-corpus fork was declined in s173 and that decision stands. Revisit alongside the
next high-contrast work.
