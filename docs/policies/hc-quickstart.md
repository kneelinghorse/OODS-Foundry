# High-Contrast (HC) Quickstart

Ensure UI remains legible under `forced-colors: active` with outline-first focus.

## Enable & Verify
- Use system color mappings for HC in CSS to override `--theme-*` hooks.
- Confirm focus visibility via outlines; avoid color-only affordances.

## Validate
- Guardrails: `pnpm run tokens:guardrails` enforces OKLCH Δ ranges for hover/pressed states.
- Contrast rules: `pnpm run test:contrast` executes `testing/a11y/contrast.spec.ts` to verify semantic token ratios.
- Accessibility sweep: `npm run a11y:check` and visually inspect HC screenshots if available.
- VRT: Include HC variants in Chromatic where applicable; ensure deterministic rendering.
- PR gate: `tokens-validate` (GitHub) re-runs the transform in `--check` mode plus the guardrail suite—fix local drift before requesting review.

## References
- Policy: `app/docs/policies/high-contrast.md`
- Theme freeze tag: `v-theme0-freeze`

## Next Steps
- Propose token changes via `.github/PULL_REQUEST_TEMPLATE/token-change.md` with proofs (contrast + Chromatic) and the Figma handshake checklist.
