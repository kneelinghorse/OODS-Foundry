# Dark Theme A11y Coverage & Baselines

This policy documents how we exercise and maintain Dark theme coverage for our VRT-critical stories and how to accept/update Chromatic baselines. It also captures the a11y smoke checks we run locally with axe and the CI contract that now gates PRs on curated Storybook stories.

Starting with mission B14.11, the `a11y-contract` workflow builds Storybook, runs `pnpm run a11y:diff`, and blocks merges on new serious/critical axe violations across the curated scenarios in `testing/a11y/aria-contract.json`.

## Scope
- VRT target: all stories tagged `vrt-critical` (plus select `vrt`) run in Light and Dark.
- HC (forced-colors) is excluded from Chromatic and covered by the Playwright+storycap job (B7.3).
- Local a11y smoke: Button, Badge, Banner, Input, PageHeader in Dark via jsdom + axe.
- Accessibility contract: curated Storybook stories (light + dark) must remain free of serious/critical axe/ARIA violations; contract ownership lives in `testing/a11y/aria-contract.json`.

## How It Works
- Storybook global toolbar exposes a `theme` toggle. Chromatic runs Light and Dark via `parameters.chromatic.modes`.
- `.storybook/preview.tsx` includes a VRT stabilizer (fixed `Date`/`Math.random`, animations disabled) to keep diffs deterministic.
- `chromatic.config.json` filters to `tag: ["vrt", "vrt-critical"]` so our CI only snapshots the curated set.
- HC mode is not part of Chromatic `modes` and is validated in the Playwright fallback job.
- The accessibility contract job builds `storybook-static/`, serves it locally, and runs axe against the curated stories. Run options target WCAG 2.1 AA tags and disable `color-contrast` (covered by token guardrails).

## Run & Validate
- Chromatic (PR): `npx chromatic --config chromatic.config.json`
  - Expect Dark variants in the PR build; no HC.
  - Accept baselines on `main` only (auto-accept enabled for `main`).
- Axe (local): `npm run test:axe`
  - Runs Dark theme smoke across Button/Badge/Banner/Input/PageHeader.
  - Required: 0 critical violations.
- Accessibility contract (PR/local): `pnpm run build-storybook && pnpm run a11y:diff`
  - Uses Playwright + axe against curated stories defined in `testing/a11y/aria-contract.json`.
  - Fails on new serious/critical violations and uploads `tools/a11y/reports/a11y-report.json` as an artifact.
  - GitHub’s required `a11y-contract` check (Sprint 14) executes this command; PRs stay blocked until the curated stories are clean.

## Baseline Acceptance
- Approve Dark diffs when:
  - Token changes intended (palette/contrast adjustments) AND component snapshots are consistent across the set.
  - Motion/states show deterministic updates (no random/clock-driven changes).
- Do not approve when:
  - Broken images/links or missing fonts cause layout shifts.
  - Spurious diffs isolated to a single run (re-run CI or rebase).

## Triage Workflow
- Contrast issues: verify relevant tokens and Δ guardrails; fix tokens or bindings before accepting.
- Focus/outline regressions: ensure outline-first focus styles apply in Dark; validate `:focus-visible` paths.
- Broken links/assets: correct import paths or public assets; re-run CI.
- Flaky rendering: confirm VRT stabilizer present; check seeded randomness and clock patching.

## Notes
- Keep Chromatic fast: rely on TurboSnap and the tagged set; grow to ≥25 stories.
- Keep HC separate: use the Playwright fallback job for forced-colors snapshots and PNG artifacts.
- Keep the accessibility contract lean: rotate stories via PR to `testing/a11y/aria-contract.json`, ensure each has both light and dark variants, and update the baseline (`pnpm run a11y:baseline`) only when intentional violations are resolved.
