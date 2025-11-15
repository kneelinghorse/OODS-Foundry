# Viz Token Guide

Mission **B21.6 – Viz Token Integration** introduces a dedicated `--viz-*` namespace for
visualization scales, sizes and layout primitives. These tokens bridge the trait
engine and renderer work completed in B21.1-B21.5 without duplicating palette or
spacing logic already governed by the system layers.

## Namespaces

| Token | Purpose | Source |
| ----- | ------- | ------ |
| `--viz-scale-sequential-01…09` | Monochromatic OKLCH ramp (light → dark) with ≥0.10 ΔL steps. | `packages/tokens/src/viz-scales.json` |
| `--viz-scale-diverging-neg-05…pos-05` | Symmetric diverging hues that climb toward a neutral midpoint. | `packages/tokens/src/viz-scales.json` |
| `--viz-scale-categorical-01…06` | Qualitative palette aliased to `--sys-status-*` tones for AA contrast. | `packages/tokens/src/viz-scales.json` |
| `--viz-size-point-*` | Canonical marker radii for scatter/line overlays. | `packages/tokens/src/viz-sizing.json` |
| `--viz-size-stroke-*` | Stroke widths for axes, lines and outlines. | `packages/tokens/src/viz-sizing.json` |
| `--viz-size-bar-*` | Nominal column widths so layout engines can stay token-driven. | `packages/tokens/src/viz-sizing.json` |
| `--viz-margin-*` | Chart padding presets mapped to `--sys.space.*` aliases. | `packages/tokens/src/viz-sizing.json` |

## Guardrails

Color guardrails piggyback on the existing OKLCH contracts: sequential scaffolds
must drop at least 0.10 lightness per stop, diverging palettes must climb toward
neutral and stay symmetric, and categorical slots have to reference vetted
`sys.status.*` aliases to preserve WCAG AA contrast.

Run the validation script locally (CI calls it via `pnpm tokens-validate`):

```bash
pnpm tokens:validate-viz
```

The script ( `scripts/tokens/validate-viz-scales.ts` ) uses the shared DTCG
loader to evaluate the raw JSON. Failures call out the offending step so you can
adjust the OKLCH coordinates quickly.

## Runtime Helpers

`src/viz/tokens/scale-token-mapper.ts` exports ergonomic helpers for trait
compositors and renderer adapters. Example:

```ts
import { getVizScaleTokens, getVizSizeTokens, getVizMarginToken } from '@/viz/tokens/scale-token-mapper.js';

const colorRamp = getVizScaleTokens('sequential', { count: 5 });
const divergingCore = getVizScaleTokens('diverging', { extent: 3 });
const categoricalPalette = getVizScaleTokens('categorical');
const pointSizes = getVizSizeTokens('point');
const strokeWidths = getVizSizeTokens('stroke', { reverse: true });
const layoutPadding = getVizMarginToken('roomy');
```

Helpers return CSS custom-property names so runtimes can emit `var(--viz-…)`
expressions or rewrite them into Vega-Lite `config.tokens`. Future missions will
map these `--viz-*` hooks into `--cmp-viz-*` component slots once the view engine
starts binding chart contexts.

## Usage Guidelines

1. **Stay in the viz namespace** – visualization code should read `--viz-*`
tokens directly or via the mapper helpers. Composer code should never reach down
into `--ref-*` palettes.
2. **Use categorical aliases for discrete data** – the inherited status hues
already satisfy equivalence rules from RDV.4. Supplemental axes/legends should
point at `--viz-scale-categorical-*` to stay inside the governed range.
3. **Respect size envelopes** – `EncodingSize` trait defaults map to
`--viz-size-point-*` and `--viz-size-stroke-*`. Keep overrides within the token
ladder so glyphs remain perceivable.
4. **Margins are semantic** – chart containers should prefer `--viz-margin-*`
values instead of bespoke padding. This keeps responsive layouts consistent
across contexts (list/detail/form/timeline).

## References

- `cmos/planning/sprint-21-decision-framework.md` (token strategy summary)
- `cmos/research/data-viz-oods/RDV.4_…` (a11y equivalence rules)
- `docs/authoring-traits-viz.md` (how traits consume `--cmp-viz-*` slots)
