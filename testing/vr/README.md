# Visual Regression Baselines

This directory keeps the source of truth for Chromatic coverage.

- `baseline/manifest.json` enumerates the curated story IDs we publish on every PR. Each entry captures the Storybook file, story ID, expected theme modes, and why that slice matters.
- Update the manifest whenever the allowlist in `chromatic.config.json` changes or new `vrt-critical` stories graduate into CI.
- Keep supplementary notes lightweight; the actionable details should stay inside the story itself (annotations, tokens, a11y contracts).

When running Chromatic locally:

1. Ensure `CHROMATIC_PROJECT_TOKEN` is exported (or defined in `.env.local`).
2. Build Storybook (`pnpm run build-storybook`).
3. Execute `pnpm run chromatic:publish` to mirror the CI job.

The CI workflow (`pr-validate.yml` → `vr-test`) fails if Chromatic finds diffs that have not been approved in the Chromatic UI. Accept changes there (with CODEOWNER review) before merging.
