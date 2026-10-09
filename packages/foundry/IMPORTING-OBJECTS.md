# Bring your own objects

`object_import` reads a schema your team already has and drafts OODS Foundry objects. Review the drafts and accept the objects and trait proposals you want. `object_registry` validates hand-written object or trait YAML; `object_register` saves it.

## Files in

Supported inputs are OpenAPI/Swagger 2.0, OpenAPI 3.0–3.2, JSON Schema draft-07 or 2020-12, Postgres DDL and migrations, Prisma schemas, dbt manifests/projects, OData CSDL XML/JSON, GraphQL SDL/introspection, or the [OODS hub](object-hub.schema.json). Pass one local file, a schema folder, or inline content up to 1 MiB. `source.format` can select `openapi`, `json-schema`, `sql`, `prisma`, `dbt`, `odata` or `graphql`; otherwise the document and extension select the reader. Files have a combined limit of 128 MiB, checked before reading. Folder entries are processed in deterministic order.

OODS Foundry does not fetch a URL, connect to an API/database, import a module, or run your code. Local JSON Pointer `$ref`s and relative file references are supported within the source folder. References that escape it, including through symlinks, are refused with the source file and pointer. Unreachable network and absolute references, missing local files and named anchors are reported at their file/pointer and skipped; nothing is fetched. Download remote specs yourself before importing them.

```json
{"action":"draft","source":{"path":"/path/to/openapi.json"}}
```

The response gives an `importId`, counts, object names in dependency order, shipped-name clashes, proposal grades, and a diff-file path. Large listings are explicitly truncated in the response; `order.json` has the complete order and cycles. Nothing is registered at this step.

The complete bundle is in `~/.oods-foundry/imports/<importId>/`, beside your objects and traits, outside the package install. A portable installation may set `OODS_FOUNDRY_HOME` before starting the server. `objects/` holds the draft YAML, `hub.json` the normalized schemas, `report.json` every outcome, and `diff.json` the comparison with currently registered definitions. `import.json` is content-addressed and binds the hashes of its separately streamed hub and report; editing any of them invalidates the import. To hand-edit a draft, use `object_registry` to validate and `object_register` to save that YAML.

## Review and accept

Call `object_import_read`:

```json
{"action":"show","importId":"<from draft>","object":"YourObject"}
```

`show` returns one draft's YAML, proposals with evidence and grades, unmapped elements, and the re-import comparison. A re-import reports added, removed and changed fields, trait and relationship changes, and potentially affected list/detail/form/timeline screens. It compares the unaccepted base draft with your effective registered definition, with previously accepted trait contributions listed separately as `traitFields`, rather than false removals; review those differences before overwriting.

A name alone is weak evidence and never raises a proposal's grade. Types, enums, formats and read-only declarations provide structural evidence. Trait parameter schemas validate every proposal; an invalid proposal is shown with errors and cannot be accepted. Proposals add a trait's canonical fields and views, so check that its fields express your model. Nothing is silently applied.

```json
{"action":"apply","importId":"<from draft>","objects":[{"name":"YourObject","proposals":["<accepted proposal id>"]}]}
```

Omit `proposals` to accept an object with no traits. Accept dependencies in the same call unless they are already registered. The batch validates all definitions, writes them in dependency order, and composes each supported context transiently, including timeline where declared or contributed by an accepted lifecycle/history trait. Read-only sources omit form. Cyclic relationships are retained: all files exist before composition. A write or composition failure restores previous files byte for byte and removes newly created files. A filesystem lock excludes concurrent registration/import writes; this is rollback on operation failure, not a crash-recovery database transaction.

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

Broken local JSON Pointers are preserved as `x-oods-unresolved-ref` with an unmapped link and source location; they never become invented relationships. Network and named-anchor references are reported and skipped. Outside-folder and escaping-symlink references refuse the whole import before an outside read. Traversal is bounded to 160 nesting levels and ten million values, including YAML alias expansion.

Imported records use declared titles or natural keys, then identifiers. Samples are deterministic and checked against enum, pattern, format and bounds; unsatisfiable sample constraints are reported. Field help comes only from source descriptions. Date-only values display without a time. Declared relationships use related sample records in form pickers; applications supply their live choices.

## Postgres DDL and migrations

Pass a `.sql` file or migration folder, or `source.format: "sql"` with inline SQL. The reader parses schema declarations and replays them in memory; it never connects to a database or executes SQL. It reads columns/types, NOT NULL, literal defaults, enum types, primary/unique keys, scalar foreign keys, comments, literal CHECK comparisons/IN lists, and direct-column view projections. `now()` supplies timestamp evidence without evaluation. Views are read-only. Composite foreign keys, complex view expressions, procedural SQL and unsupported syntax are individually reported.

Prisma migration timestamp folders, Flyway numeric versions, golang-migrate `.up.sql` files and Rails `structure.sql` work as files. Drizzle follows `meta/_journal.json`; unlisted SQL and down/undo migrations are reported and skipped. ALTER, DROP and RENAME update the replayed schema. Postgres is the supported dialect; MySQL and SQL Server dialect support remains later work, with unsupported statements reported rather than guessed.

## Prisma and dbt

Pass `format: "prisma"` with a `.prisma` file or a schema folder. Models, enums, native types, keys, literal defaults and documentation are projected. Relation navigation uses its declared foreign key when available. Generated defaults and `@updatedAt` are read-only; source table/column mappings remain in the hub. Generators and datasource declarations are never executed.

Pass `format: "dbt"` with a manifest or a project properties folder. A compiled manifest is authoritative when supplied. YAML models, sources, snapshots, column tests, constraints and semantic declarations provide fields and relationships; both standalone semantic models and embedded column entities/dimensions with simple metrics are supported. All dbt objects are read-only. Snapshots include history and offer Supersedable. Jinja, SQL expressions, custom tests and dynamic descriptions are reported without execution. Missing types stay unmapped; a familiar column name does not supply a type.

## OData and GraphQL

OData accepts CSDL JSON or XML/EDMX (`format: "odata"`). Entity/complex types, enums, keys, inheritance and navigation references become hub schemas. Draft names use local type names with deterministic collision suffixes; full service names stay in provenance. Scalar navigation uses its declared foreign key in one editor, including v2 association constraints. HeaderInfo names records, LineItem supplies `metadata.listColumns`, FieldGroup/Facets group details, Common labels/text/value lists shape fields and pickers, ISO currency pairs supply money semantics, literal units label values, and capability restrictions remove forms when inserts and updates are prohibited. Nullable display text is supported. Dynamic units, unresolved translation tokens and unsupported vocabulary expressions stay preserved and reported. XML refuses DTD/entity declarations; vocabulary URLs are never fetched. XML and JSON retain their respective nullability defaults.

GraphQL accepts SDL (`.graphql`/`.gql`) or introspection JSON (`format: "graphql"`). Object types draft as records; mutation input types remain explicitly reported and are not drafted as records. Enums, nullability, lists, descriptions and deprecation metadata are retained; interfaces and unions remain alternatives, not merged records. Object fields become relationships. Operation roots and resolvers are not run. Custom scalar names do not supply types: only explicitly supported `@specifiedBy` URLs provide format evidence. Duplicate field declarations are reported and the first stays in effect.

Hand-written objects can use `metadata.listColumns: [{field: name, label: Name}, {field: total}]` to select and order fields in list rows. Every column must name a composed field. Source annotation support uses the same object contract.

## Accepted trait field bindings

A proposal carries one configuration per trait and all of its evidence. Accepting a Timestampable or Stateful proposal records `fieldBindings` on the trait reference, so screens and generated React and Vue apps use the original source fields. An alternative configuration stays in the report with its reason; review the selected binding before accepting.

Hand-written object definitions can use the same declaration:

```yaml
traits:
  - name: Stateful
    parameters:
      states: [open, closed]
      initialState: open
    fieldBindings:
      status: state
  - name: Timestampable
    fieldBindings:
      created_at: placedAt
      updated_at: updatedAt
      last_event: null
      last_event_at: null
```

Binding targets must be fields declared in the object's schema with a matching type. `null` explicitly omits a canonical field the source does not provide, including its view bindings. Without `fieldBindings`, a trait keeps its existing fields and behavior. Imported proposals explicitly omit every canonical record field the source does not supply. A proposal with no supported field bindings says that it contributes no record views. A single supplied creation time also serves the list timestamp. Timestamped objects can show that fact on their timeline without invented lifecycle events.

Detail screens resolve related records from the same sample lookup used by form pickers. OData `Common.Text` supports a local label field or one navigation hop through a declared foreign-key constraint, such as `Agency/Name`. Generated lookup labels contain imported samples only: connect your application's relationship data for real records. Declared list-column labels take precedence over field semantics labels, then the human-readable field name.

## Declare money when accepting

A numeric field remains a number until its currency is declared in the source or explicitly accepted. Use `object_import_read` with `action: "show"` to review a draft, then add `currencies` to its accepted object:

```json
{"action":"apply","importId":"<reviewed importId>","objects":[{"name":"Order","proposals":["<reviewed proposal id>"],"currencies":{"total":{"field":"currency"}}}]}
```

The currency field must be a declared string field. Add `minorUnits: 100` for amounts stored as cents; omit it for major units. The whole batch is validated before any definition changes.
