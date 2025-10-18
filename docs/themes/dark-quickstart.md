# Dark Theme Quickstart

Enable Dark without changing component code by remapping theme variables.

## Enable Dark
- Toggle Dark globally: `document.documentElement.setAttribute('data-theme', 'dark')`
- Storybook → toolbar theme switch flips `[data-theme]` so stories prove both light/dark chains.
- Ensure your CSS maps `--theme-*` hooks to `--theme-dark-*` when `[data-theme='dark']` is present.

## Verify
- States remain token-driven (`--cmp-*`), no branching in components.
- Contrast proofs (AA) hold against dark surfaces.

## Validate
- Build tokens: `npm run build:tokens`
- Semantic lint: `pnpm run tokens:lint-semantic` (guards against literal colour usage).
- Contrast: `npm run a11y:check` (see `app/tools/a11y/reports/a11y-report.json`)
- VRT: Include Dark variants in Chromatic; tag stories `vrt`/`vrt-critical`.

## References
- Guidelines: `app/docs/themes/dark-guidelines.md`
- Theme freeze tag: `v-theme0-freeze`

## Next Steps
- If tokens need adjustment, open a PR using `.github/PULL_REQUEST_TEMPLATE/token-change.md` with Figma link, assignment diff, contrast proofs, and Chromatic URL.
