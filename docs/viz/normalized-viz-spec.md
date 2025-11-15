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

## Examples

Reference specs live under `examples/viz/`:

1. `bar-chart.spec.json` – MRR by region (MarkBar + color)
2. `line-chart.spec.json` – Active subscribers over time (MarkLine)
3. `scatter-chart.spec.json` – Conversion vs response time (MarkPoint + size)

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
across renderers.
