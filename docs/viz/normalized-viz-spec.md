# Normalized Viz Spec v0.1

Mission **B21.2 – Normalized Viz Spec Implementation** introduces the first
canonical visualization specification for OODS. This document explains how the
spec is structured, how to validate it, and where to find curated examples.

## Schema & Types

- JSON Schema: `schemas/viz/normalized-viz-spec.schema.json`
- Generated types: `generated/types/viz/normalized-viz-spec.ts`
- Runtime validator: `src/viz/spec/normalized-viz-spec.ts`

Regenerate the types with `pnpm run generate:schema-types`. The validator uses
Ajv + ajv-formats to provide helpful error output and an assertion helper for
callers that need a typed object.

```ts
import { assertNormalizedVizSpec } from '@/viz/spec/normalized-viz-spec';

const spec = assertNormalizedVizSpec(payload);
renderViz(spec);
```

## Structure

| Section | Purpose | Notes |
| --- | --- | --- |
| `$schema`, `id`, `name` | Preamble metadata | `$schema` fixed to `https://oods.dev/viz-spec/v1` |
| `data` | Inline values or dataset references | Supports `values[]`, `url`, and `format` |
| `transforms` | Declarative pipeline (filter, aggregate, bin, etc.) | Each entry is typed with `type` + open `params` |
| `marks[]` | Trait-linked mark definitions | Each mark references `trait` (e.g., `MarkBar`) and optional per-layer encodings |
| `encoding` | Top-level encoding map | x/y/color/size/shape/detail all reference trait bindings |
| `layout` | View composition traits | Facet/layer/concat metadata, shared scales, projection hints |
| `interactions[]` | Declarative interaction traits | Each entry defines `select` + `rule` so adapters can add highlight, tooltip, or filter behaviors |
| `config` | Theme + layout overrides | Includes layout sizing and token overrides |
| `a11y` | Mandatory RDV.4 contract | Requires `description`, optional narrative + table fallback |
| `portability` | RDV.5 hints | Preferred fallback type, table order, renderer hint |

### TraitBinding

Every encoding entry contains:

- `field` – data key
- `trait` – `Encoding*` trait identifier
- Optional `channel`, `aggregate`, `bin`, `timeUnit`, `scale`, `sort`, `legend`,
  `title`

The schema enforces enumerations so adapters can perform static analysis before
rendering.

## Layout Traits

The new `layout` node captures view-composition traits so adapters can render
facet grids, layered marks, and concatenated dashboards without bespoke schema
extensions.

```jsonc
{
  "layout": {
    "trait": "LayoutFacet",
    "rows": { "field": "region", "limit": 4, "sort": "ascending" },
    "columns": { "field": "segment", "limit": 3 },
    "sharedScales": { "x": "shared", "y": "shared", "color": "shared" },
    "projection": { "type": "cartesian", "preserveAspectRatio": true },
    "gap": 12
  }
}
```

- **LayoutFacet** – repeats the normalized spec across row/column fields with
  governed wrapping, shared scales (`shared` vs `independent` per channel), and
  projection hints for deterministic fallbacks.
- **LayoutLayer** – captures blend mode, interaction syncing, explicit layer
  ordering, and projection metadata so adapters can combine multiple mark
  definitions without duplicating config.
- **LayoutConcat** – declares dashboard-style sections (horizontal, vertical, or
  grid) with optional filters per section plus shared scale configuration.

Each layout trait is optional and composes with transforms, interactions, and
tokens already present in the spec. Renderers can inspect `sharedScales` to keep
domains aligned or duplicate axes per panel, while `projection` metadata keeps
future map/radial compositions deterministic.

## Examples

Reference specs live under `examples/viz/`:

1. `bar-chart.spec.json` – MRR by region (MarkBar + color)
2. `line-chart.spec.json` – Active subscribers over time (MarkLine)
3. `scatter-chart.spec.json` – Conversion vs response time (MarkPoint + size)
4. `facet-layout.spec.json` – MRR vs pipeline small multiples using `LayoutFacet`

These fixtures double as unit-test inputs (`tests/viz/normalized-viz-spec.test.ts`).
Use them as templates when composing new specs from trait compositions.

## Validation Workflow

1. Compose traits to produce schema chunks (B21.1 output).
2. Materialize a normalized spec object following the schema above.
3. Call `validateNormalizedVizSpec` or `assertNormalizedVizSpec`.
4. Pass the typed spec to downstream adapters (B21.3+) for Vega-Lite or other
   renderers.

Validation errors include a JSON pointer path (`/encoding/x/field`) and ajv
keyword so we can surface actionable diagnostics in the CLI or Storybook.

## Interactions

Mission B22.2 introduces declarative interaction traits to the spec. Each
entry contains:

- `id` – predicate name consumed across renderers.
- `select` – the selection primitive (e.g., `{ type: 'point', on: 'hover', fields: ['region'] }`).
- `rule` – how the predicate is applied (`visual`, `tooltip`, or `filter`).

Adapters read these entries to add Vega-Lite `params` bindings, tooltip
channels, and the ECharts interaction mapper (event handlers + formatter
functions). Keep the rules simple (one concern per trait) so they compose
across renderers. Hooks in `src/viz/hooks` emit typed interaction traits so
stories/components can remain declarative:

```ts
import { useFilter, useBrush, useZoom } from '@oods/viz';

const filter = useFilter();                // Interval filter (x-axis slider)
const brush = useBrush({ encodings: ['x', 'y'] }); // 2D brush / linked views
const zoom = useZoom({ encodings: ['x'] }); // Scale-binding zoom gesture
```

Each helper ensures the schema stays deterministic (tuple encodings, sensible
defaults, and no implicit mutation), allowing adapters to map them to
Vega-Lite `params + transform` and ECharts `dataZoom` + `brush` components.

### Accessibility expectations for filters/brush/zoom

When a spec declares `filter`, `brush`, or `zoom` interactions:

- Update `spec.a11y.description` to explain **what changes when the control is
  used** (“Drag to filter the timeline; screen readers hear the new range
  immediately.”).
- Populate `spec.a11y.narrative.summary` with the *default view* so non-visual
  users understand the baseline before applying filters.
- Keep `tableFallback` enabled so every filtered state still has an accessible
  equivalent.

This mirrors the RDV.4 guidance on “dynamic focus.” The adapters automatically
bind keyboard focus and announce filter results, but the spec must describe the
workflow up front so the narration remains deterministic.
