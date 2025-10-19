# Chromatic Baselines

These directories store per-brand diagnostics from `scripts/chromatic-run.sh`.

- `brand-a/` — Chromatic diagnostics/logs for Brand A runs
- `brand-b/` — Chromatic diagnostics/logs for Brand B runs

The script creates or updates:

- `chromatic-diagnostics.json`
- `chromatic.log`
- `storybook-build.log`

Remove or rotate these files as needed; the directories simply ensure the baseline split is visible in the repository.
