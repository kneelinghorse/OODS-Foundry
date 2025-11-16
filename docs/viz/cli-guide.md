---
title: Viz Suggest CLI Guide
description: Reference for the viz:suggest helper used to recommend chart patterns, layouts, and scaffolds.
---

# `pnpm viz:suggest` Guide

The viz suggestion CLI inspects your schema descriptor (counts, goals, layout constraints) and returns curated chart patterns from the OODS library. Sprint 23 extends the CLI with layout scoring, interaction bundles, and scaffold generation that outputs ready-to-run specs + React shells.

## Quick Start

```bash
# Basic recommendation (descriptor shorthand)
pnpm viz:suggest "1Q+2N goal=trend stacking=required"

# Explicit schema flags
pnpm viz:suggest --measures 1 --dimensions 3 --goal comparison --grouping --layout

# Load schema from JSON and request interactions + scaffold
pnpm viz:suggest --file ./schema.json --interactions --scaffold --scaffold-format all
```

## Schema Inputs

You can describe intents via positional descriptors (e.g., `1Q+2N goal=trend`) or through explicit flags:

| Flag | Description |
|------|-------------|
| `--measures` | Number of quantitative fields. |
| `--dimensions` | Number of nominal/ordinal fields (temporal counts toward dimensions). |
| `--temporals` | Explicit temporal field count when you need finer control. |
| `--goal` | Analytical goal (`comparison`, `trend`, `composition`, `part-to-whole`, `relationship`, `intensity`, `distribution`). |
| `--stacking` | `required`, `preferred`, or `avoid`. |
| `--density` | `dense`, `sparse`, or `flex`. |
| `--matrix` / `--part` / `--multi` / `--grouping` / `--negative` | Boolean flags for layout + data traits. |
| `--schema` | Descriptor string parsed the same way as the positional shorthand. |
| `--file` | Path to JSON descriptor (merges with CLI flags). |

## Layout + Interaction Insights

Pass `--layout` to append layout recommendations per suggestion. Layout scoring compares schema density with pattern metadata and reports the preferred strategy (single, facet, layer, concat) plus alternates.

```
pnpm viz:suggest "1Q+2N goal=comparison grouping" --layout
```

For interaction-specific hints, add `--interactions`. Recommended bundles will include filter/zoom/brush/tooltip coverage with relative confidence (percent scores) so you can wire the right hooks.

```
pnpm viz:suggest --file ./schema.json --interactions
```

## Scaffold Generation

Enable `--scaffold` to produce production-ready artifacts for the top suggestion:

```bash
# Generate both JSON spec + React component shell
pnpm viz:suggest "2Q goal=trend temporals=1" --scaffold

# Spec only
pnpm viz:suggest --file schema.json --scaffold --scaffold-format spec

# Component only
pnpm viz:suggest --measures 1 --dimensions 2 --goal comparison --scaffold --scaffold-format component
```

The scaffold includes:

- Normalized viz spec with layout trait + interactions derived from the scoring engine.
- React component shell that imports the recommended chart wrapper (`BarChart`, `LineChart`, etc.) and wires hooks (`useTooltip`, `useBrush`, `useFilter`, `useZoom`) as suggested.
- Sample data placeholder values to help verify rendering before binding live data.

## Additional Flags

| Flag | Purpose |
|------|---------|
| `--list` | Dump every registered pattern with ID + summary. |
| `--limit` | Cap suggestion count (default 3). |
| `--layout` | Show layout scoring results. |
| `--interactions` | Show interaction scoring results. |
| `--scaffold` | Emit scaffold artifacts for the top-ranked pattern. |
| `--scaffold-format` | `spec`, `component`, or `all` (default). |

## Tips

1. **Start broad**: run `--list` once per session to stay familiar with active catalog entries.
2. **Descriptor + file**: positional descriptors (`1Q+2N goal=trend`) can be combined with `--file` to override single properties without editing JSON.
3. **Iterate with layout**: when layout hints report low confidence, tweak `--dimensions`, `--grouping`, or `--matrix` flags to capture the intended density.
4. **Use scaffolds for prototyping**: the generated component drops into Storybook quickly. Replace the placeholder data prop with real rows and keep iterating.

For more architectural context, review `docs/viz/pattern-library.md` and `docs/viz/chart-selection-guide.md`. When scaffolding complex dashboards, hand off the generated spec to the Viz engineering team for validation via `pnpm test:integration`.
