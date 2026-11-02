---
name: oods-foundry
description: Look up the OODS Foundry design system's components, objects, traits and design tokens, draw and certify charts from rows the user provides, and find its recorded React and Vue screens with the plugin's read-only tools.
---

Use this skill when the user asks about the OODS Foundry design system (its components, objects, traits, contexts, brands, themes or design tokens), asks for a chart drawn from numbers they give, or asks for one of OODS Foundry's recorded screens. The user's own instructions take priority over this guidance.

Every tool reads OODS Foundry's published release. None of them changes, saves or deletes anything, and each reply names the version it reads.

## Pick the tool

| The user wants | Call |
|---|---|
| Components, filtered by trait, context, category or status | `catalog_list`. With a filter it returns full detail, at most 10 a page; follow `nextPage` for more. |
| An object's traits, fields and view extensions | `object_registry` with `action` `show` and the object's `name`. Use `action` `list` to find names. |
| An overview of the registry | `registry_snapshot` |
| Design tokens, or the list of datasets | `structured_data_fetch` with `dataset` `tokens` or `manifest`. Ask for `detail` `summary` first, then read pages. |
| A chart from the user's numbers | `viz_render` with `chartType`, `encodings` and the rows inline |
| A certification for a chart input on its own | `artifact_certify` with that input under `chart` |
| A recorded screen | `design_preview` with `object`, `context` and `framework` (`react` or `vue`) |
| A tool's input or output schema | `tool_schema` with `name` and `kind` |
| The service's version, brands and themes | `health_check` |

## Charts

1. Put the user's rows in `rows` (at most 500) and set `encodings.x` and `encodings.y` to their field names.
2. Set `theme` (`light`, `dark` or `hc` for high contrast) and `brand` (`A` or `B`) only when the user names one.
3. Set `output.svg` to true only when the user wants to see the drawing, and `output.includeA11y` to true for the accessible table and narrative.
4. Report the certification as the reply gives it: whether the chart is conformant, then each check (accessibility equivalence, determinism, contrast and accuracy) with its result. If a check fails, say which one and why, using the reply's own words.

The tools never fetch data from an address. If the user gives a link instead of rows, ask them to paste the rows.

## Limits to keep

- Do not say that anything was saved, deleted, downloaded or generated for the user's project. These tools cannot do that; say so when asked.
- Do not add components, fields, values or check results that the replies do not contain.
- If a reply is refused as too large, make the narrower call it suggests.
