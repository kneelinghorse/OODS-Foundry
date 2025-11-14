# Authoring Visualization Traits

Sprint 21 establishes the first ten visualization traits in the OODS trait engine.
This guide documents how to apply the new Mark, Encoding, and Scale traits that
ship with mission **B21.1 – Viz Trait Foundation**. The content is sourced from
RDS.7 (Trait Taxonomy v0.1) and RDV.4 (accessibility equivalence rules).

## Trait Catalog

| Trait | Category | Purpose | Key Parameters | Dependencies |
| --- | --- | --- | --- | --- |
| `MarkBar` | Mark | Rectangular marks for categorical comparisons | `orientation`, `bandPadding`, `stacking` | `EncodingPositionX`, `EncodingPositionY` |
| `MarkLine` | Mark | Connected segments for trend analysis | `curve`, `strokeWidth`, `join`, `enableMarkers` | `EncodingPositionX`, `EncodingPositionY` |
| `MarkPoint` | Mark | Discrete glyphs for scatterplots + overlays | `shape`, `size`, `fill`, `opacity` | `EncodingPositionX`, `EncodingPositionY` |
| `MarkArea` | Mark | Filled bands for ranges + cumulative totals | `curve`, `opacity`, `baseline` | `EncodingPositionX`, `EncodingPositionY` |
| `EncodingPositionX` | Encoding | Horizontal axis binding + heuristics | `fieldKinds`, `defaultScale`, `axisTitle`, `sorting` | `ScaleLinear`, `ScaleTemporal` (opt) |
| `EncodingPositionY` | Encoding | Vertical axis binding + aggregation | `fieldKinds`, `defaultScale`, `aggregate` | `ScaleLinear`, `ScaleTemporal` (opt) |
| `EncodingColor` | Encoding | Chromatic encodings w/ redundancy guardrails | `supportedSchemes`, `defaultScheme`, `redundancyMechanism`, `minContrast`, `channel` | `ScaleLinear` (opt) |
| `EncodingSize` | Encoding | Governed glyph sizing with perceptual ranges | `rangeMin`, `rangeMax`, `strategy` | `ScaleLinear` |
| `ScaleLinear` | Scale | Base continuous/band scale for quantitative data | `domainMin`, `domainMax`, `rangeMin`, `rangeMax`, `mode` | – |
| `ScaleTemporal` | Scale | Time-aware scale w/ timezone + “nice” intervals | `domainStart`, `domainEnd`, `nice`, `timezone`, `outputFormat` | – |

Each YAML definition includes:
- Canonical schema fields (prefixed `viz_*`) consumed by the trait compositor.
- Semantic metadata that maps into the renderer/runtime heuristics.
- View extensions for `detail`, `form`, and `list` contexts so Storybook can
  visualize the trait state independently of downstream missions.
- Token references that defer to future `--cmp-viz-*` variables. No literal
  colors are introduced; everything maps to the forthcoming viz token pack.

## Composition Rules

- **Single mark per layer** – All mark traits declare `metadata.conflicts_with`
  and the dependency graph enforces that only one of `MarkBar`, `MarkLine`,
  `MarkPoint`, or `MarkArea` can be active at a time.
- **Mark↔Encoding contracts** – Mark traits depend on both positional encoding
  traits. Encoding traits optionally depend on scale traits which guarantees the
  compositor will load scale metadata when a mark is selected.
- **A11y equivalence** – `EncodingColor` encodes RDV.4 rule A11Y-R-01 by
  requiring a redundancy mechanism plus minimum contrast, while `EncodingSize`
  enforces R-02’s perceivable glyph area bounds. `MarkBar` and `MarkArea` embed
  A11Y-R-04/R-06 metadata so fallback generators know which descriptive text to
  emit.
- **Scale hints** – `EncodingPositionX/Y` express `defaultScale` and `includeZero`
  which are read by the Normalized Viz Spec pipeline (B21.2) when building Vega
  Lite payloads. `ScaleLinear` and `ScaleTemporal` provide deterministic defaults
  for domain/range, timezone, and interval rounding.

## Authoring Workflow

1. **Select the mark** – Start from `MarkBar`, `MarkLine`, `MarkPoint`, or
   `MarkArea` depending on the visual grammar you need. Only one mark trait may
   be composed per layer.
2. **Bind positional fields** – Apply `EncodingPositionX` and
   `EncodingPositionY`. Set `fieldKinds` to the schema types produced by the data
   inference engine and choose `defaultScale` (`linear` or `temporal`).
3. **Add secondary channels** – Add `EncodingColor` for categorical segments or
   `EncodingSize` for magnitude overlays. The schemas enforce contrast ratios,
   redundancy, and perceptual size envelopes.
4. **Choose scale metadata** – Include `ScaleLinear` for quantitative axes, and
   add `ScaleTemporal` whenever the payload relies on chronological fields.
5. **Validate parameters** – Use `ParameterValidator` (shown in the new tests)
   or run `pnpm test tests/traits/viz/<trait>.test.ts` to ensure the JSON-schema
   contracts are satisfied.

```ts
import { composeTraits } from '@/core/compositor';
import MarkBar from '@/traits/viz/mark-bar.trait.ts';
import EncodingPositionX from '@/traits/viz/encoding-position-x.trait.ts';
import EncodingPositionY from '@/traits/viz/encoding-position-y.trait.ts';
import ScaleLinear from '@/traits/viz/scale-linear.trait.ts';

const { schema, semantics } = composeTraits([
  MarkBar,
  EncodingPositionX,
  EncodingPositionY,
  ScaleLinear,
]);
```

The resulting schema chunk provides `viz_mark_type`, `viz_encoding_x_field`,
`viz_scale_linear_domain_min`, etc., which flow directly into the normalized viz
spec object introduced in mission B21.2.

## Testing Guidance

- Run `pnpm test tests/traits/viz` to execute the ten new Vitest suites. Each
  suite exercises YAML parsing, TypeScript parity, and parameter validation.
- Parameter schemas live under `schemas/traits/*` to satisfy `ParameterValidator`.
  Re-run `pnpm test` or `pnpm local:pr-check` after modifying schema defaults.
- The encoding/scale tests ensure field conflicts are detected early. If you add
  new traits, replicate the structure (YAML + TS + schema + test) to preserve the
  guardrails shipped in Sprint 21.

## References

- `cmos/research/data-viz-oods/RDS.7_synthesis_Mission Completion Report- Trait-Driven Visualization System Specification (v0.1).md`
- `cmos/research/data-viz-oods/RDV.4_Validation of Accessibility Equivalence in Trait-Driven Visualization Systems.md`
- `docs/authoring-traits.md` – core trait authoring best practices
