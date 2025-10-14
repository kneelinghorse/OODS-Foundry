# Brand A Tokens & Implementation

Brand A introduces a warm, OKLCH-driven palette that rides on the existing four-layer token stack (Reference → Theme → System → Component). The goal is a tokens-only brand switch: components continue to read `--cmp-*` variables while the DOM attributes `[data-brand="A"][data-theme="light|dark|hc"]` remap the theme layer.

## Design Principles

- **Tokens-first overrides** – Brand A values live in `app/packages/tokens/src/tokens/brands/A/*.json`, keeping the source of truth DTCG-compliant. CSS overrides are emitted via `app/apps/explorer/src/styles/brand.css` without touching component code.
- **Guardrail-aligned deltas** – Interactive states observe the existing ΔL/ΔC thresholds (±0.06 / ±0.01 in light, +0.05 / +0.02 in dark) so hover and pressed transitions stay within the established motion/accessibility guardrails.
- **System mapping** – High-contrast (`data-theme="hc"`) maps directly to CSS system colors (`Canvas`, `CanvasText`, `Highlight`, `HighlightText`) to respect OS/user overrides.
- **Scoped overrides** – Adding `data-brand="A"` to either `<html>` or any container element re-maps `--sys-*` and `--cmp-*` tokens underneath, so partial previews (e.g. Storybook docs) render light/dark/HC variants independently.

## Build & Validation

1. `npm run build:tokens` to refresh Style Dictionary outputs (baseline Theme 0 + Brand A metadata).
2. `npm run a11y:check -- --brand=A` *(optional flag; see `app/docs/themes/brand-a/coverage.md` for the manual matrix)* to confirm AA + Δ ranges.
3. Storybook: `npm run storybook` and open **Brand/Brand A** to verify light/dark/HC parity across the specimen set.

## Files

- Tokens: `app/packages/tokens/src/tokens/brands/A/base.json`, `app/packages/tokens/src/tokens/brands/A/dark.json`, `app/packages/tokens/src/tokens/brands/A/hc.json`
- Aliases: `app/packages/tokens/src/tokens/aliases/brand-A.json`
- CSS Bridge: `app/apps/explorer/src/styles/brand.css`
- Stories/DX: `app/apps/explorer/src/stories/BrandA.mdx`
- Coverage notes: `app/docs/themes/brand-a/coverage.md`

## Usage Snippet

```html
<body data-brand="A" data-theme="dark">
  <!-- Components automatically resolve to Brand A tokens -->
  <div class="list-card">…</div>
</body>
```

No component refactors are required; swapping `data-brand` and `data-theme` is sufficient to change the visual system.
