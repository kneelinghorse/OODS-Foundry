# Contrast Validation Report (B30.5)

## Scope
- Themes: default (light) + dark
- Components: buttons (primary/neutral, solid), inputs/textareas (TextField), select, checkbox/radio (via input tokens), cards/panels, badges, alerts, focus outlines
- States measured: default, hover, pressed/active, disabled, focus-ring, placeholder (inputs), selected (badges)
- Sources: `apps/explorer/src/styles/tokens.css`, `apps/explorer/src/styles/layers.css`
- Tooling: `node scripts/quality/contrast-audit.mjs` → `artifacts/quality/contrast-matrix.json`

## Current Status
- Audit scope now **passes** for light + dark across all targeted components/states (see `artifacts/quality/contrast-matrix.json`).

## Root Causes (resolved)
1. Disabled and placeholder tokens were too low contrast (light). Fixed by darkening text tokens to `--cmp-text-secondary`.
2. Dark primary button text was too dark. Fixed by lifting `--theme-dark-text-on_interactive` and darkening hover/pressed surfaces.
3. Badge defaults (light) and dark selected badges were low contrast. Fixed by using panel surface + secondary text (light) and lighter text (dark).
4. Light primary button focus ring was under-threshold. Fixed by brightening the button-specific focus ring and keeping panel outlines darker.

## Findings (highlights)
- Light theme failures:
  - Button/input disabled states (1.6:1), input placeholder (2.61:1), button focus ring (2.71:1), badge default (3.57:1).
- Dark theme failures:
  - Button default (3.31:1), badge selected (3.31:1), button/input disabled (2.64:1).
- Token usage audit: no `--ref-*`/`--theme-*` usage in base component TSX files (Button/TextField/Select/Checkbox). Direct `--ref/--theme` usage is limited to token layers (`apps/explorer/src/styles/tokens.css`, `apps/explorer/src/styles/layers.css`). See `artifacts/quality/token-audit-results.json`.

## Changes Applied
- Raised disabled and placeholder text to `--cmp-text-secondary` for light/dark.
- Brightened button focus ring and darkened dark-theme hover/pressed surfaces.
- Rebased badge backgrounds/text for both themes to meet ≥4.5:1.
- Lifted dark interactive text to `--ref-color-neutral-50` for safer defaults.

## Follow-ups
- Add a11y fixtures/stories for: disabled controls, placeholders, badge default/selected, dark primary button default/hover/pressed, and button focus-visible.
- Keep `node scripts/quality/contrast-audit.mjs` in CI/PR validation once hooked up.

## How to Re-run
```bash
node scripts/quality/contrast-audit.mjs
# Outputs: artifacts/quality/contrast-matrix.json
```

## Next Fix Steps (proposed)
- Patch token slots per recommendations, then regenerate matrix and rerun `pnpm a11y:check` + Storybook a11y panel on the scoped stories.
- Update fixtures/stories to include failing states so automated checks cover them.
