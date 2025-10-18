# Visual Regression Strategy

Chromatic is the primary guardrail for visual diffs. Every pull request and push to `main` runs the `vr-test` job out of `.github/workflows/pr-validate.yml`. The job builds Storybook, publishes to Chromatic, and fails the workflow if snapshots change without approval.

## Chromatic (primary path)

- **Secrets**: Set `CHROMATIC_PROJECT_TOKEN` in repository secrets (and locally in `.env.local`). `scripts/chromatic-run.sh` loads the token before calling the Chromatic CLI.
- **Story selection**: `chromatic.config.json` restricts runs to the curated allowlist tracked in `testing/vr/baseline/manifest.json`. The manifest documents why each story matters and must be kept in sync with the config.
- **Theme coverage**: `.storybook/preview.ts` defines Chromatic modes for light and dark themes. Stories can override modes when they only make sense in a single context (e.g., the Brand A timeline).
- **Merge gate**: `exitZeroOnChanges` is disabled; Chromatic will block the pull request until reviewers approve diffs in the Chromatic UI. Acceptance on `main` still auto-updates the baseline via `autoAcceptChanges: "main"`.
- **PR signal**: The Chromatic GitHub check posts a summary comment containing the preview URLs and diff status for each story in the allowlist.
- **GitHub check**: Sprint 14 added the required `vr-test` workflow; keep this job green to satisfy branch protections.

### Updating baselines

1. `pnpm run build-storybook`
2. `pnpm run chromatic:publish`
3. Review the Chromatic build:
   - Investigate any unexpected diffs; adjust code or tokens as needed.
   - For intentional changes, accept the snapshots in Chromatic and capture the rationale in the PR description.
4. If new coverage is required, update both `chromatic.config.json` and `testing/vr/baseline/manifest.json` in the same change set.

## Playwright + Storycap (fallback)

The Storycap harness lives under `testkits/vrt/` and remains opt-in.

- `testkits/vrt/playwright.config.ts` launches Storybook and captures Chromium + Firefox screenshots.
- `testkits/vrt/storycap.lightdark.mjs` and `testkits/vrt/storycap.hc.mjs` provide targeted capture scripts.
- Commands:
  - `pnpm run vrt:fallback` — execute the fallback suite against the existing baselines.
  - `pnpm run vrt:fallback:update` — refresh baseline images.
- Outputs land in `artifacts/vrt/**`. Do not commit fallback baselines unless leadership explicitly toggles the job on.

Use the fallback when Chromatic is unavailable or policy demands in-repo evidence. Keep the fallback configuration aligned with the Chromatic allowlist to avoid coverage drift.

## Quick reference

- `pnpm run chromatic:dry-run` — publish without failing on diffs (diagnostics only).
- `pnpm run chromatic:publish` — mirror the CI job locally.
- `scripts/chromatic-run.sh -- --storybook-build-dir storybook-static` — pass additional flags straight to the Chromatic CLI.
