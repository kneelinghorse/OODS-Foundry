# object_import

> Draft objects from local OpenAPI, JSON Schema, Postgres DDL/migrations, Prisma, dbt, OData or GraphQL files. Use it when importing a schema you already have; use object_registry for hand-written object/trait YAML. Returns an importId, staged drafts/report, counts and a re-import diff. action=draft uses source.path or source.content without registering; show uses importId and object for YAML, graded proposals and unmapped elements; apply uses importId and explicit objects with accepted proposal ids. The batch validates and composes with rollback. overwrite replaces team objects; confirmShipped names each approved shipped replacement. Unreachable references are reported and skipped; no network fetch or code execution. Reference: TOOL-REFERENCE.md#object_import; full schema: oods://schemas/object_import.input.json.

Use `draft` with local OpenAPI 2.0–3.2, JSON Schema draft-07/2020-12, Postgres DDL or migrations, Prisma, dbt, OData CSDL XML/JSON, or GraphQL SDL/introspection. Give a file, folder, or bounded inline `source.content`; `source.format` can select the reader. The response names the `importId`, counts, review folder and re-import diff; it writes no team definitions. `show` takes that ID and one `object` name and returns YAML, graded trait proposals, unmapped elements and changed fields/screens. `apply` takes explicit `objects: [{name, proposals?: [id]}]`; no proposal is selected implicitly. Dependencies must already exist or be selected in the same batch. `overwrite: true` permits replacing team objects; each shipped replacement needs its exact name in `confirmShipped`. Apply validates the whole selection, writes in dependency order and composes every supported context, including lifecycle/history timelines; read-only sources omit forms. A failure restores prior files. Review bundles live under `OODS_FOUNDRY_HOME/imports` (default `~/.oods-foundry/imports`). Unreachable references are reported and skipped; folder escapes refuse the import. No network fetch, SQL execution, code execution or template evaluation occurs. The format limits, export recipes and hub contract ship in `IMPORTING-OBJECTS.md` and `object-hub.schema.json`. Use `object_registry` to inspect or author an individual definition.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | `draft` \| `show` \| `apply` | Yes |  | Draft files without registration; show one draft; apply explicitly accepted objects and proposals. |
| `source` | object | No |  | Local file/folder or inline schema. Used only by draft. |
| `source.path` | string | No |  | Local file or folder. References must stay inside the source folder. Aggregate limit 128 MiB. |
| `source.content` | string | No |  | Inline schema text, at most 1 MiB. Set format for SQL, Prisma, OData XML or GraphQL SDL. |
| `source.name` | string | No |  | File name for inline provenance; no directories. |
| `source.format` | `openapi` \| `json-schema` \| `sql` \| `prisma` \| `dbt` \| `odata` \| `graphql` | No |  | Explicit source format; inferred from file extension or document when omitted. |
| `importId` | string | No |  | Content-addressed import id from draft. Required by show and apply. |
| `object` | string | No |  | Exact draft object name for show. |
| `objects` | object[] | No |  | Explicit accepted object names and optional proposal ids for apply. |
| `overwrite` | boolean | No | `false` | Allow replacing existing team objects. |
| `confirmShipped` | string[] | No |  | Each shipped object name whose replacement is explicitly confirmed. |

## Output Shape

_See tool response._

## Error Codes

Codes this tool can return, derived from the shipped module graph in `@oods/foundry/errors.json`; that file also gives each cause and fix.

| Code | Severity | Description |
|------|----------|-------------|
| `OODS-A11Y-R-01` | error-or-warning | Color encodings must have redundant channels per RDV.4 Section 4.1. |
| `OODS-A11Y-R-02` | error-or-warning | Size channels must remain perceptible (Δarea ≥ 1.5×) to satisfy RDV.4 glyph guidance. |
| `OODS-A11Y-R-03` | error-or-warning | Accessible table fallback must be available for every spec. |
| `OODS-A11Y-R-04` | error-or-warning | Category comparisons (bar/stacked) require narrative summaries of extrema. |
| `OODS-A11Y-R-05` | error-or-warning | Positional encodings must expose axis titles for assistive tech. |
| `OODS-A11Y-R-06` | error-or-warning | Area charts must describe baselines/ranges (requires valid extrema + table fallback). |
| `OODS-A11Y-R-07` | warning | Accessible tables require captions tied to the chart title. |
| `OODS-A11Y-R-08` | error-or-warning | Long-form description must exceed 25 characters to convey context. |
| `OODS-A11Y-R-09` | error-or-warning | Charts must expose an aria-label or visible name. |
| `OODS-A11Y-R-10` | error-or-warning | Trend-based charts (line/area) need generated narratives. |
| `OODS-A11Y-R-11` | warning | Datasets with ≥3 rows must surface at least two key findings. |
| `OODS-A11Y-R-12` | error-or-warning | Every encoding field must appear in each data row. |
| `OODS-A11Y-R-13` | warning | Dense datasets (>12 rows) require narrative aggregation. |
| `OODS-A11Y-R-14` | warning | Deterministic column ordering must be declared when >2 columns exist. |
| `OODS-A11Y-R-15` | error-or-warning | Narrative generator must produce a ready status (three-pronged equivalence requirement). |
| `OODS-A11Y-R-16` | warning | Filter/zoom interactions must describe their announce workflow. |
| `OODS-C004` | error | A definition of this name is already registered; pass overwrite: true to replace it |
| `OODS-C006` | error | Imported object would replace a shipped definition |
| `OODS-N001` | error | Unknown tool |
| `OODS-N003` | error | SchemaRef not found |
| `OODS-N004` | error | SchemaRef expired |
| `OODS-N005` | error | Object not found |
| `OODS-N006` | error | Patch node not found |
| `OODS-N007` | error | Artifact not found |
| `OODS-N009` | warning | Registry manifest missing |
| `OODS-N010` | warning | Registry unavailable |
| `OODS-N011` | error | Token data missing |
| `OODS-N015` | error-or-warning | Component target unavailable |
| `OODS-N022` | error | Composition or version not found in the store |
| `OODS-N023` | error | No folder is set for your objects or traits (OODS_OBJECTS_DIR, OODS_TRAITS_DIR) |
| `OODS-R001` | error | Rate limit exceeded |
| `OODS-R002` | error | Concurrency limit exceeded |
| `OODS-S001` | error | Policy denied |
| `OODS-S002` | error | Execution timeout |
| `OODS-S003` | error | Bad request |
| `OODS-S005` | error | Catalog load failed |
| `OODS-S007` | error | Fragment render failed |
| `OODS-S012` | error | Render step exception |
| `OODS-S015` | error | Path not allowed |
| `OODS-S016` | error | Artifact filename empty |
| `OODS-S017` | error | Artifact filename unsafe |
| `OODS-S020` | error | Payload directory is not writable; the response carries no payload |
| `OODS-S021` | error | Your objects or traits folder is not writable; nothing was registered |
| `OODS-V001` | error | Input validation failed |
| `OODS-V002` | error | Output validation failed |
| `OODS-V003` | error | Missing required field |
| `OODS-V006` | error-or-warning | Unknown component |
| `OODS-V007` | error-or-warning | DSL schema validation failed |
| `OODS-V008` | error | Duplicate node ID |
| `OODS-V009` | error | Missing schema |
| `OODS-V010` | error | Missing base tree |
| `OODS-V011` | error | Missing patch |
| `OODS-V100` | error | Invalid JSON pointer |
| `OODS-V101` | error | Unsafe path segment |
| `OODS-V102` | error | Invalid patch operation |
| `OODS-V103` | error | Cannot patch document root |
| `OODS-V104` | error | Patch path not found |
| `OODS-V105` | error | Invalid array index |
| `OODS-V106` | error | Patch apply failed |
| `OODS-V107` | error | Invalid patch entry |
| `OODS-V108` | error | Node patch missing nodeId |
| `OODS-V109` | error | Empty patch array |
| `OODS-V110` | error | Invalid patch type |
| `OODS-V113` | error | Unsafe key |
| `OODS-V114` | error | Mixed patch formats |
| `OODS-V115` | error | JSON Patch array required |
| `OODS-V116` | warning | Low layout confidence |
| `OODS-V117` | warning | Object composition warning |
| `OODS-V118` | warning | Resolution warning |
| `OODS-V119` | error-or-warning | Component registry or object view-extension issue |
| `OODS-V120` | warning | Object view extension could not fill a slot |
| `OODS-V121` | warning | Object maturity is not stable |
| `OODS-V122` | warning | Detail tab labels are unavailable or need only one group |
| `OODS-V123` | error-or-warning | Missing or invalid viz data source |
| `OODS-V124` | error-or-warning | Dataset reference expired |
| `OODS-V125` | error-or-warning | Dataset reference resolved to empty or non-array rows |
| `OODS-V126` | error-or-warning | Invalid viz spec input |
| `OODS-V127` | error-or-warning | Vega-Lite spec compilation failed |
| `OODS-V128` | error-or-warning | ECharts option compilation failed |
| `OODS-V129` | error-or-warning | Viz render failed |
| `OODS-V130` | error-or-warning | Unresolved governed measure |
| `OODS-V131` | error-or-warning | Referenced field absent from dataset |
| `OODS-V132` | error-or-warning | Malformed measure registry |
| `OODS-V134` | warning | Geo join: corridor has no matching map feature |
| `OODS-V136` | error | Unsafe token-overlay value |
| `OODS-V137` | error-or-warning | KPI panel has no resolvable field (measureRef unresolved) |
| `OODS-V140` | error | Unmapped style-library logical key |
| `OODS-V143` | warning | Color range is shorter than the number of series (colors will recycle) |
| `OODS-V144` | warning | Color range contains a non-hex color |
| `OODS-V145` | error-or-warning | Color range is not supported on this chart type (cartesian color channel only) |
| `OODS-V146` | warning | Categorical palette recycles: more distinct color groups than the 6-slot OODS palette |
| `OODS-V147` | error-or-warning | Link references a non-existent node |
| `OODS-V148` | warning | Duplicate link |
| `OODS-V150` | error | A bar's value axis is not a linear zero-anchored scale |
| `OODS-V151` | error | Layered marks resolve a positional scale independently (dual axis) |
| `OODS-V152` | error | An area's value axis is not a linear zero-anchored scale |
| `OODS-V153` | error | A row-collapsing aggregation is not disclosed on any declared text surface |
| `OODS-V154` | error | A treemap/sunburst node value cannot be encoded as area or angle |
| `OODS-V155` | error | An explicit treemap/sunburst parent value is not the sum of its children |
| `OODS-V156` | error | A sankey/chord link value is negative or non-finite |
| `OODS-V157` | error | A sankey node's height does not match the flow its links carry |
| `OODS-V158` | error | A sankey directed flow appears more than once |
| `OODS-V159` | error | A choropleth region matched rows with conflicting joined values |
| `OODS-V160` | error-or-warning | KPI numeric aggregate over a field with no numeric cells |
| `OODS-V161` | warning | Baked categorical palette recycles: more distinct series than palette slots |
| `OODS-V164` | error-or-warning | Unknown UI workflow state |
| `OODS-V165` | error-or-warning | SVG rendering failed |
| `OODS-V166` | error | viz.render pattern conflicts with explicit data or source identity/presentation overrides |
| `OODS-V167` | error | viz.render pattern is authoring-only because its source structure is not supported by the public renderer |
| `OODS-V168` | error | artifact.certify: bubble-map size is negative or non-finite |
| `OODS-V169` | error | artifact.certify: bubble-map magnitudes use radius rather than area scaling |
| `OODS-V170` | error | artifact.certify: overlapping bubble-map rows have conflicting encoded values |
| `OODS-V171` | error | artifact.certify: flow-map strength is negative or non-finite |
| `OODS-V172` | error | artifact.certify: a directed geographic flow appears more than once |
| `OODS-V173` | error | artifact.certify: a force-graph directed edge appears more than once |
| `OODS-V174` | error | viz.render: pattern retired; use the named supported alternative |
| `OODS-V175` | warning | viz.render: static SVG shows the default selection state |
| `OODS-V203` | error | Composition id or version is not well-formed |
| `OODS-V204` | error | Composition edit not applicable to this version |
| `OODS-V211` | error | Result state bound to a component that cannot be held to the result family |
| `OODS-V215` | error | Definition not registered: it does not validate or compose |
| `OODS-V218` | warning | Team component mapping has advisory limits |
| `OODS-V219` | error | Mapping creation refused |
| `OODS-V220` | error | Object import refused or rolled back |
| `OODS-W001` | warning | Fragment output ignores document scope options |
| `OODS-W002` | warning | Non-strict fragments reclassify unknown-component errors per node |
| `OODS-W003` | warning | A dry-run render returns no HTML |

## Example Request

```json
{
  "action": "draft"
}
```
