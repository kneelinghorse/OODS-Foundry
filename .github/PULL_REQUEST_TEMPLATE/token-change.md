# Token Change Proposal

Use this template for any design token changes (Theme 0, Dark, HC). Keep components pure; propose token updates that satisfy contracts and guardrails.

## Summary
- Scope: what tokens change and why
- Impacted layers: `--theme-*`, `--sys-*`, `--cmp-*`
- Contexts affected: e.g., Form, Timeline, List
- Regression risk: low/medium/high

## Figma → Repo Handshake
- [ ] Figma source link (file + page + frame):
- [ ] Names follow DTCG naming and our four-layer schema
- [ ] Assignment diff included (before/after) – attach image or JSON snippet
- [ ] Mapping validated: `--theme-*` → `--sys-*` → `--cmp-*` (no direct component literals)
- [ ] No hard-coded color literals introduced in components

## Contrast Proofs (WCAG 2.2 AA)
Attach or link proof from the a11y tooling.

- Evidence: `app/tools/a11y/reports/a11y-report.json` (or screenshot/extract)
- [ ] All changed pairs pass AA in Light and Dark
- [ ] High-Contrast remains legible and focus-visible
- [ ] ΔL/ΔC guardrails respected (see `app/tools/a11y/guardrails/relative-color.csv`)

## Visual Regression (VRT)
- Chromatic build link: 
- [ ] Affected stories tagged `vrt` and `vrt-critical`
- [ ] Dark and HC variants covered (Storybook modes or parameters)
- [ ] Animations disabled during Chromatic run (deterministic)

## Implementation Notes
- Files touched (tokens, maps, outputs):
- Commands run: `npm run build:tokens`, `npm run validate:tokens`, `npm run a11y:check`
- Rollback plan:

## Release & Docs
- Reference tag: `v-theme0-freeze` (Theme 0 freeze)
- [ ] Docs updated where relevant
- [ ] Quickstarts referenced when applicable:
  - `app/docs/contexts/quickstart.md`
  - `app/docs/themes/dark-quickstart.md`
  - `app/docs/policies/hc-quickstart.md`

---

Guidance
- Figma checklist: clarify naming, assignment tables, and status ramps.
- A11y/VRT requirements: contrast proofs + Chromatic link are required for approval.
