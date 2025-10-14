# Visual Regression Strategy

This document captures how we operate visual regression testing across the design system. Chromatic delivers the primary PR guardrail while a Playwright + Storycap harness remains on standby for contingency.

## Chromatic (Primary)

- **Workflow**: `.github/workflows/chromatic.yml` runs on every PR and push to `main`. It installs dependencies inside `app`, builds Storybook via Chromatic, and posts review links.
- **Configuration**: `chromatic.config.json` enables TurboSnap (`onlyChanged: true`), auto-accepts merges to `main`, and keeps builds scoped to the `app` workspace (`storybookBaseDir: "app"`).
- **Secrets**: Add `CHROMATIC_PROJECT_TOKEN` in GitHub repository secrets before enabling the workflow. Locally, export the same variable when running `npx chromatic`.
- **Story Selection**: Only stories tagged with `vrt-critical` run snapshots. Remaining stories inherit `chromatic.disableSnapshot = true` at the meta level.
- **Tagged Stories**:
  - `Base/Button` — `Default`, `Intents`
  - `Base/Badge` — `Intents`
  - `Components/PageHeader` — `Default`
  - `Explorer/StatusChip` — `SubscriptionStates`, `InvoiceStates`
  - `Subscription/RenderObject` — `ActiveDetail`, `PastDueDetail`
  - `User/RenderObject` — `ActiveDetail`, `DisabledDetail`
- **Commands**: From `app/`, use `npx chromatic --config ../chromatic.config.json` (ensure the token is exported) to reproduce PR builds locally.

## Playwright + Storycap (Fallback)

> The fallback is checked in but **disabled by default**. Use it if Chromatic is unavailable or policy requires running snapshots in-house.

- **Config Files**: `app/testkits/vrt/playwright.config.ts` and `app/testkits/vrt/storycap.config.mjs`.
  - `playwright.config.ts` launches Storybook, runs Chromium + Firefox, disables animations, and captures screenshots at 1280×720.
  - `storycap.config.mjs` centralises tagging rules (`vrt-critical`), sanitises file names, and standardises retry behaviour.
- **Scripts**: `npm run vrt:fallback` executes Playwright against the config. Use `npm run vrt:fallback:update` to refresh baselines.
- **Activating Storycap Capture**:
  1. Install optional deps when needed: `npm install --save-dev axe-playwright @storybook/test-runner @storycap-testrun/node`.
  2. Run Storybook locally and export `VRT_STORYCAP=true` before invoking `npm run vrt:fallback`.
  3. Review screenshots under `artifacts/vrt/storycap/`.
- **Snapshot Policy**: Keep fallback snapshots out of CI until we consciously flip the job on. They serve as an emergency baseline or for offline audits.

## Operational Notes

- Ensure Storybook builds cleanly before triggering either workflow (`npm run build-storybook`).
- When tagging new critical stories, add `vrt: { tags: ['vrt-critical'] }` and `chromatic.disableSnapshot = false` to the story or component meta.
- Chromatic publishes diffs even when `exitZeroOnChanges` allows PRs to succeed. Treat any unexpected diff as a must-review item.
- Keep the fallback configuration in sync with Chromatic selections—update `storycap.config.mjs` if the tag names change.
