# Contexts Quickstart

Get contexts wired fast while keeping components pure and token-driven.

## Prerequisites
- Tailwind variants configured (see `app/src/tailwind.config.semantic.js`)
- Context docs: `app/docs/contexts/defaults.md`, `app/docs/contexts/form-timeline-defaults.md`
- Tokens built: `npm run build:tokens`

## Apply a Context
- Use region-scoped utilities from the variants package (no runtime branching):
  - Example Form shell: `class="form:body:gap-4 form:pageHeader:mb-2"`
  - Example Timeline shell: `class="timeline:timeline:gap-2 timeline:main:px-4"`
- Keep components consuming `--cmp-*` slots only; do not inject literals.

## Verify States
- Button/Badge/Banner/Input should switch states via data attributes and token slots.
- Dark and HC work automatically via variable remaps; no component changes required.

## Validate
- Contrast: `npm run a11y:check` and inspect `app/tools/a11y/reports/a11y-report.json`.
- VRT: ensure stories are tagged `vrt`/`vrt-critical` with Dark/HC variants enabled in Chromatic.

## References
- Context defaults: `app/docs/contexts/defaults.md`
- Form & Timeline guidance: `app/docs/contexts/form-timeline-defaults.md`
- Theme freeze tag: `v-theme0-freeze`

## Next Steps
- Propose token adjustments using `.github/PULL_REQUEST_TEMPLATE/token-change.md` with Figma link, assignment diff, contrast proofs, and Chromatic build URL.
