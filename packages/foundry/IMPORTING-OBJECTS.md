# Bring your own objects

`object_import` reads a schema your team already has and drafts OODS Foundry objects. Review the drafts and accept the objects and trait proposals you want. `object_registry` remains the tool for hand-written object or trait YAML.

## Files in

Supported inputs are JSON or YAML files containing OpenAPI/Swagger 2.0, OpenAPI 3.0–3.2, JSON Schema draft-07 or 2020-12, or the [OODS hub](object-hub.schema.json). Pass one local file, a folder of JSON/YAML files, or inline content up to 1 MiB. Files have a combined limit of 128 MiB, checked before reading. Folder entries are processed in deterministic order.

OODS Foundry does not fetch a URL, connect to an API/database, import a module, or run your code. Local JSON Pointer `$ref`s and relative file references are supported within the source folder. References that escape it, including through symlinks, are refused with the source file and pointer. Named anchors are refused explicitly. Download remote specs yourself before importing them.

```json
{"action":"draft","source":{"path":"/path/to/openapi.json"}}
```

The response gives an `importId`, counts, object names in dependency order, shipped-name clashes, proposal grades, and a diff-file path. Large listings are explicitly truncated in the response; `order.json` has the complete order and cycles. Nothing is registered at this step.

The complete bundle is in `~/.oods-foundry/imports/<importId>/`, beside your objects and traits, outside the package install. A portable installation may set `OODS_FOUNDRY_HOME` before starting the server. `objects/` holds the draft YAML, `hub.json` the normalized schemas, `report.json` every outcome, and `diff.json` the comparison with currently registered definitions. `import.json` is content-addressed; editing it invalidates the import. To hand-edit a draft, use `object_registry` to validate and register that YAML.

## Review and accept

```json
{"action":"show","importId":"<from draft>","object":"YourObject"}
```

`show` returns one draft's YAML, proposals with evidence and grades, unmapped elements, and the re-import comparison. A re-import reports added, removed and changed fields, trait and relationship changes, and potentially affected list/detail/form screens. It compares the unaccepted base draft with your effective registered definition, including previously accepted traits; review those differences before overwriting.

A name alone is weak evidence and never raises a proposal's grade. Types, enums, formats and read-only declarations provide structural evidence. Trait parameter schemas validate every proposal; an invalid proposal is shown with errors and cannot be accepted. Proposals add a trait's canonical fields and views, so check that its fields express your model. Nothing is silently applied.

```json
{"action":"apply","importId":"<from draft>","objects":[{"name":"YourObject","proposals":["<accepted proposal id>"]}]}
```

Omit `proposals` to accept an object with no traits. Accept dependencies in the same call unless they are already registered. The batch validates all definitions, writes them in dependency order, and composes list, detail and form transiently. Cyclic relationships are retained: all files exist before composition. A write or composition failure restores previous files byte for byte and removes newly created files. A filesystem lock excludes concurrent registration/import writes; this is rollback on operation failure, not a crash-recovery database transaction.

`overwrite: true` permits replacing your existing objects. A shipped-name replacement additionally requires that exact name in `confirmShipped`, for example `"confirmShipped":["User"]`. Reviewing one shipped replacement does not authorize another.

## What is preserved

Primitive fields, supported formats, nullability, examples, defaults and constraints become object fields. Compatible `allOf` declarations merge; conflicting intersections are reported. `oneOf`/`anyOf` alternatives remain distinct, including discriminators; a null-plus-one-type union can become a nullable field. Named object references become relationship identifier fields. Source names and every normalized value retain file/pointer provenance.

Read-only fields are omitted from editable forms. Write-only fields and their samples are omitted from read screens. Maps, nested documents, unconstrained values, unsupported unions and unsupported metadata remain in the hub with explicit unmapped outcomes. API operations do not become executable actions. Samples without supplied examples are illustrative, not customer records. The report's mapped, proposed and unmapped counts sum to its total.

## The hub vocabulary

The hub is JSON Schema 2020-12 plus `x-oods` annotations, with its own Ajv vocabulary instance. Its [schema](object-hub.schema.json) ships beside this guide. `$defs` contains named schemas. `x-oods.version` is `1`; `sources`, `sourceNames` and `provenance` record the input identity. A provenance key is a hub JSON Pointer, and its value is `{ "file": "source.json", "pointer": "/components/schemas/Widget" }`.

Schema annotations can carry `relationships` (target, via, cardinality, label), `enumLabels`, `localeLabels`, `currency` (field, optional positive minorUnits divisor), `unit` (field or symbol), `lifecycle` (field, states, initialState), `history` (field, timestampField), and `traitProposals` (name, parameters, grade, evidence). These annotations are preserved even when the current object projection cannot use them. Explicit currency annotations become money semantics; field names never imply money. Each proposal's evidence has file, pointer, reason, and kind (`name`, `structure`, `declaration`). Name-only evidence stays weak even if a producer labels it strong.

## Export from your own tools

Run the export in your own trusted project, save the resulting JSON, then give only that file to OODS Foundry. These are export expressions/commands, not programs OODS Foundry runs:

| Source | One-line export |
| --- | --- |
| [Zod 4](https://zod.dev/json-schema) | `console.log(JSON.stringify(z.toJSONSchema(YourSchema)))` |
| [Valibot](https://valibot.dev/guides/json-schema/) | `console.log(JSON.stringify(toJsonSchema(YourSchema)))` using `toJsonSchema` from `@valibot/to-json-schema` |
| [TypeBox](https://github.com/sinclairzx81/typebox) | `console.log(JSON.stringify(YourTypeBoxSchema))` |
| [Effect 3](https://effect.website/docs/v3/schema/json-schema) | `console.log(JSON.stringify(JSONSchema.make(YourSchema)))` using `JSONSchema` from `effect` |
| [Pydantic](https://docs.pydantic.dev/latest/concepts/json_schema/) | `print(json.dumps(YourModel.model_json_schema()))` with Python's `json` module |
| [TypeScript types](https://github.com/vega/ts-json-schema-generator) | `npx ts-json-schema-generator --path 'src/model.ts' --type 'YourType' > schema.json` |

Converters cannot represent every transformation, refinement or runtime behavior as JSON Schema. Review their export diagnostics and the import report. OODS Foundry's accepted YAML stays the canonical object definition; another discovery tool can produce the documented hub without access to OODS Foundry internals.

Broken local JSON Pointers are preserved as `x-oods-unresolved-ref` with an unmapped link and source location; they never become invented relationships. Network, outside-folder, and named-anchor references are refused. Traversal is bounded to 160 nesting levels and ten million values, including YAML alias expansion.
