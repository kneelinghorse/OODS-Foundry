# High-Contrast (HC) Quickstart

Ensure UI remains legible under `forced-colors: active` with outline-first focus.

## Enable & Verify
- Use system color mappings for HC in CSS to override `--theme-*` hooks.
- Confirm focus visibility via outlines; avoid color-only affordances.

## Validate
- Contrast: `npm run a11y:check` and visually inspect HC screenshots if available.
- VRT: Include HC variants in Chromatic where applicable; ensure deterministic rendering.

## References
- Policy: `app/docs/policies/high-contrast.md`
- Theme freeze tag: `v-theme0-freeze`

## Next Steps
- Propose token changes via `.github/PULL_REQUEST_TEMPLATE/token-change.md` with proofs (contrast + Chromatic) and the Figma handshake checklist.
