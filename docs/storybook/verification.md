# Storybook Verification Guide

The `sb-verify` helper wraps the curated accessibility smoke check and Chromatic
dry run used to guard Storybook changes. Run it whenever stories, tokens, or
Storybook wiring change so we keep the curated baselines green.

## Prerequisites

- Storybook buildable (`pnpm run build-storybook`), which the script will do for you.
- Chromatic credentials available through `CHROMATIC_PROJECT_TOKEN` in `.env.local`
  (or `apps/explorer/.env.local`). Without the token the script skips the
  Chromatic pass and reports the skip.

## Running the sweep

```bash
pnpm run sb:verify
```

The script performs the following:

1. Builds the production Storybook bundle.
2. Runs the curated axe contract (`pnpm run a11y:check`).
3. Executes the Chromatic dry run via `scripts/chromatic-run.sh` (per-brand).
4. Writes summarized diagnostics to `artifacts/storybook/verify`.

The command exits non-zero if any serious/critical axe violations remain or if
Chromatic reports visual diffs.

## Outputs

- `artifacts/storybook/verify/axe.json` — counts per section and any violations
  that axed flagged. Empty `violations` means the curated stories are clean.
- `artifacts/storybook/verify/vr-summary.json` — per-brand status for the
  Chromatic dry run. Each entry links back to the full CLI log and diagnostics
  file under `chromatic-baselines/brand-<slug>/`.

Refer to `chromatic.log` inside each brand directory for the original CLI
output when chasing down diffs or confirming a skip. When intentional visual
changes are expected, capture a short note in the PR explaining the diffs, then
re-run `pnpm run sb:verify` after approving the Chromatic snapshots.
