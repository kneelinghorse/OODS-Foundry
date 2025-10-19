# Brand B Tokens & Implementation

Brand B delivers a cool, indigo-forward palette that mirrors the Brand A scaffolding pattern. Components remain brand-agnostic: swapping `data-brand` on the root (or any container) is enough to retheme experiences.

## Design Notes

- **Palette** – Base surfaces pull from cooler OKLCH neutrals, with saturated cyan/indigo accents for calls to action.
- **Guardrails** – Hover/pressed states preserve the ΔL/ΔC guardrails introduced in Sprint 14. Dark mode deltas mirror the light theme.
- **Forced Colors** – High contrast mode resolves to system colors (`Canvas`, `CanvasText`, `Highlight`, `HighlightText`) so OS overrides remain predictable.

## Token Sources

- Primitives: `packages/tokens/src/tokens/brands/B/(base|dark|hc).json`
- Aliases: `packages/tokens/src/tokens/aliases/brand-B.json`
- CSS Bridge: `apps/explorer/src/styles/brand.css` (`[data-brand='B']` scope)

Regenerate compiled assets after editing brand tokens:

```bash
pnpm --filter @oods/tokens run build
pnpm tokens:transform --mission B15.1
```

## Storybook & Testing

- Use the `Brand` toolbar toggle (A/B) to switch between brands; selection persists via `localStorage`.
- The chromatic runner splits uploads per brand. Inspect `chromatic-baselines/brand-b/` for diagnostics/logs.
- Guardrail canary: `pnpm lint:brand-bleed` ensures cross-brand token imports are blocked (the canary intentionally mixes Brand A context with Brand B tokens).

## Usage Snippet

```html
<body data-brand="B" data-theme="dark">
  <!-- Components automatically resolve to Brand B tokens -->
  <div class="list-card">…</div>
</body>
```
