# Sprint 09 Diagnostics — Brand Coverage

## Summary
- Chromatic now tracks eight Brand A dark stories alongside the existing Theme 0 curated set.
- High-contrast Playwright coverage mirrors the Chromatic targets via `app/testkits/vrt/stories/hc/brand-a.spec.ts`.
- Diagnostics surface brand-aware counts so the pipeline can confirm parity before the Sprint 09 summary lock.

## Visual Regression Coverage
| Channel | Brand | Variant | Stories | Notes |
| --- | --- | --- | ---: | --- |
| Chromatic curated set | Theme 0 | Light/Dark | 14 | Baseline list unchanged from Sprint 08. |
| Chromatic curated set | Brand A | Dark | 8 | `BrandA/*` CSF modules gated behind `vrt-critical` tags and allowlisted IDs. |
| Playwright HC (forced colors) | Brand A | HC | 8 | Uses Storybook index lookups to drive deterministic IDs in `brand-a.spec.ts`. |

**Allowlist** — `app/apps/explorer/.chromatic-allowlist.json` is the single source for Brand A dark coverage. The file is read by the pipeline to guard against accidental story churn.

## Pipeline Touchpoints
- `app/chromatic.config.json` — includes new Brand A story modules so Chromatic’s `--only-story-files` sweep loads brand assets.
- `app/testkits/vrt/playwright.config.ts` — broadened matcher to pick up the new `hc/brand-a.spec.ts` suite.
- `app/apps/explorer/src/stories/BrandA*.stories.tsx` — dedicated CSF entries (`Button`, `Badge`, `Banner`, `Input`, `Select`, `Tabs`, `Form`, `Timeline`) tagged with `brand-a-dark`.

## Open Items
- Run `pnpm chromatic` + `pnpm vrt:hc` to capture the first brand-aware baselines; confirm runtime delta vs Sprint 08 (target: &lt;= 70s Chromatic, HC unchanged).
- Wire the diagnostics table into the sprint summary once metrics land in `artifacts/vrt/*`.
