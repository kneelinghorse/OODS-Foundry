# OODS Structured Data Extraction — 2025-11-10

## Objectives
- Understand whether OODS components, traits, tokens, objects, and documented patterns can be served as structured data.
- Produce normalized exports plus a validating schema that other clients (CLI, API, MCP) can rely on.
- Validate that structured data can answer queries such as “show me form components.”

## Inputs Reviewed
- `cmos/foundational-docs/OODS Foundry — Technical Architecture & Build Roadmap.md`
- Core docs under `docs/` (tokens, contexts, patterns, components) with special attention to canonical regions + token architecture.
- Trait, object, and token source files under `traits/`, `domains/**/traits`, `objects/`, `domains/**/objects`, and `tokens/`.

## Deliverables
1. `oods-components.json` — consolidated catalogue of 33 components derived from trait view extensions, 14 traits (core + SaaS billing domain), 10 canonical objects, domain metadata, and surfaced documentation patterns. Includes a `sampleQueries.formComponents` slice for downstream clients.
2. `schemas/ui/component-definition.schema.json` — Draft-07 JSON Schema describing the catalogue payload (components, traits, objects, domains, patterns, and query projections). Validated with `ajv` locally.
3. `oods-tokens.json` — normalized export of 4-layer tokens (reference/theme/system/component/view), domain status maps, and 14 trait overlay token sets with per-layer token counts.

These live at the repo root (schema under `schemas/ui/`). They are generated via `/tmp/extract-oods-data.mjs` to avoid touching application code.

## Data Coverage Snapshot
- **Components**: 33 unique components across contexts (list/detail/form/timeline/card/inline). Each entry captures contributing trait(s), context placements, props, and source YAML.
- **Traits**: 14 definitions (10 core + 4 SaaS billing). Metadata includes dependencies, schema, tokens, semantic hints, and which objects rely on each trait.
- **Objects**: 10 canonical objects (6 universal quintet + 4 SaaS billing). Each retains trait composition, field list, and semantic/tokens metadata.
- **Domains**: Current extraction covers `saas-billing` (4 objects, 4 domain traits). Additional domains will inherit automatically once their YAML lives under `domains/**`.
- **Patterns**: Presently only “Pure Modifier Pattern” is documented; schema allows more to be appended as docs expand.
- **Tokens**: 255 counted tokens across reference/theme/system/component/view layers, plus 1 semantic status map and 14 trait overlay bundles.

## Query Test — “Show me form components”
Using `sampleQueries.formComponents` from `oods-components.json` yields five components that expose form-context contributions:

```json
[
  { "id": "CancellationForm", "traits": ["Cancellable"] },
  { "id": "ColorStatePicker", "traits": ["Colorized"] },
  { "id": "FormLabelGroup", "traits": ["Labelled"] },
  { "id": "StatusSelector", "traits": ["Stateful"] },
  { "id": "TagInput", "traits": ["Taggable"] }
]
```
This confirms the data can directly answer the target query without scanning raw source files or Storybook stories.

## Findings & Recommendations
- **Structured payload is feasible now.** Traits already declare view contributions + token overlays, so harvesting them into JSON is deterministic. The new schema gives us a contract that can back an API, MCP tool, or design-doc sync.
- **Tokens align with 4-layer contract.** `oods-tokens.json` mirrors `base.json`, `theme.json`, `semantic/system`, `semantic/components`, and `view.json`, preserving `$type`, `$value`, and descriptions. Trait overlays document which CSS vars each capability needs for styling.
- **Domain extensibility works.** Any domain placed under `domains/<domain>/traits|objects` is automatically captured; this proves the registry can be served as data without extra wiring.
- **Patterns catalog is sparse.** Only one pattern doc exists today. Consider adding overlays, density, and context layout patterns so consumers of the structured feed get governance guidance alongside raw components.
- **Region metadata could be richer.** Traits expose `regionsUsed` textually; future iterations could normalize canonical region IDs (header/badges/meta/etc.) to improve filtering beyond contexts.
- **Operational next steps**:
  1. Decide where the generation script should live (e.g., `scripts/reports/generate-structured-data.ts`) so it can run in CI and publish assets (S3, MCP bridge, etc.).
  2. Expose a thin API (REST, GraphQL, or MCP tool) that serves `oods-components.json` + `oods-tokens.json` with ETags so clients can sync incrementally.
  3. Add automated regression tests that diff the JSON outputs to catch missing traits/objects when new files are added.
  4. Expand `sampleQueries` (e.g., “status-bearing components”, “timeline extensions”, “token overlays for Taggable”) to validate more slices before externalizing.

With these exports + schema in place, we can now treat the design system as structured data, power queries like “show me form components,” and layer on delivery mechanisms without touching application code paths.
