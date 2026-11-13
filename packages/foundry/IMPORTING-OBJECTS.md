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

### Agent records and work states

An agent is an actor, not a user: in OODS it is an object of its own that composes `Actor` (kind agent). Where a schema carries the evidence, the importer proposes the agent traits, graded on structure:

| Evidence in the schema | Proposal | Grade |
|---|---|---|
| `owners` or `sponsors` referencing a user, group, organization, team or directory record | `Ownerable` (sponsors as a user or team) | medium |
| A run-as, on-behalf-of, acting-for or identity-parent field referencing a user or other principal | `Actor` (kind agent); model the grant as a `Relationship` of type `delegation` | medium |
| An `is_bot`, `app` or `is_agent` flag beside a reference to an app or installation record, or a type field declared `"agent"` | `Actor` (kind agent) | medium |
| An `active` or `enabled` flag | `Stateful` with two states; the flag binds no status until you map it to one | weak |
| Any of these field names with no reference or declaration behind it | the same trait | weak |

A per-record bot or app flag says some records are agents; OODS keeps agents in an object of their own, so separate people from agents before accepting `Actor` as an agent. A boolean named `owner` is a role flag, not an owner reference.

Work states arrive through `Stateful`. A proto3 JSON enum (its string values beside an `*_UNSPECIFIED` sentinel pattern and the int32 wire form, as in A2A's `TaskStatus.state`) is read as its string values, without the sentinel. A `status` or `state` field that references a record holding one state enum is flattened to those states, so A2A's `Task`, in the file A2A publishes at `/latest/`, is proposed `Stateful` with its eight task states, and `TaskStatus` stays its own object. The file A2A publishes for v1.0.1 points those references at other files by name (`lf.a2a.v1.TaskStatus.jsonschema.json`); imported alone, the references are reported and skipped, so its `Task` drafts its two ids and `TaskStatus` keeps the eight states.

A person or other principal is a record whose name is user, account, organization, team, group, directory object, person, member or principal. The name is read with one technical suffix off (DTO, VO, Model, Entity, Bean, Resource, Response, Schema, Representation) and with a plural s, so Jira's `UserDTO` and a `users` table count; a name with another word beside it, such as `UserLinkDTO` or `CommitUser`, does not. The same match feeds every rule on this page.

### Approval records

An approval is a decision, not a status: one person's answer about one thing, kept as a record of its own (see [Approvals as decisions](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.14.0/docs/concepts/approvals-as-decisions.md)). Where another system keeps a table of approvals, one answer per row, the importer proposes `Decision` for it, graded on structure:

| Evidence in the schema | Proposal | Grade |
|---|---|---|
| A single reference to a person or other principal, beside an answer enum: an approve value, a reject, decline or request-changes value, and every other value the wait for an answer or how an ask ends (pending, requested, comment, dismissed, withdrawn, expired and the like) | `Decision`, with the person as the one asked (`asked_of_id`), and `Stateful` on the answer | medium |
| The same, with a reference to one other record, dates, a comment or a commit | the same, with those bound too | medium |
| An answer enum with no person beside it, a person with no answer enum, a person named as the asker, author or owner, or a lifecycle with states beyond an answer (draft, published) | nothing | |

The two structural facts decide; names only say where the rest goes. Beside them, the importer binds what the record has where its name says what it is: a reference named for the asker (`requested_by`, `requester`, `author`) as `requested_by_id`; the one other record it references as the thing (`subject_id`); a date-time named for when it was answered (`submitted_at`, `decided_at`), asked (`requested_at`) or due (`due_date`) as `answered_at`, `asked_at` or `due_at`; free text named `body`, `comment` or `notes` as the comment; and a `commit_id`, `sha` or `revision` as what was shown. Every other `Decision` field stays unbound: a fact the source lacks is not on the record, and nothing is invented for it. An id bound without its name is shown as the id.

The record's lifecycle is its answer, even where another enum sorts first (Bitbucket's `participant` has `role`, then `state`); the other enum is reported as an alternative. A record does not start in an answer: where an enum's first value is one (Jira's `approved`, `declined`, `pending` is alphabetical), the first pending value in the source's order is the proposed initial state. The pending values are pending, waiting, awaiting, requested, not requested, request review, review requested, awaiting approval, pending approval and not yet asked. A default the schema names still wins, and a lifecycle that starts before it waits (new, open, pending) keeps its first value.

Accepting `Decision` never fails for a fact the source lacks. The screen where an answer is given needs five facts beside the answer: the thing, exactly what was shown, the level, the meaning and who is asking, with who it is asked for when the record keeps it. A bound asker is read on the form as a fact, by its id when its name is not bound, and is not edited there. Where the record keeps none of some of them, the accepted object's form composes, and `design_compose`'s reply warns `OODS-V222`, naming them; the warning is not shown at acceptance, so compose the form to see it. If you bind a fact and a screen leaves it out, or puts it in another tab or on the other side of a dialog from the answer, `design_compose` refuses that screen (`OODS-V221`).

Measured on three published schemas: Jira Service Management's `ApproverDTO` is proposed `Decision` with its approver and answer, keeping neither the thing, what was shown, the level, the meaning nor who asked; Gitea's `PullReview` with its reviewer, answer, submission time, body and commit; Bitbucket Cloud's `participant` with its user, answer and time of taking part. Jira's `ApprovalDTO`, the ask that holds its approvers and their final decision, has no person beside its outcome, so it gets no `Decision`; its two dates are links to `DateDTO`, a record of three text renderings and a number, not date fields.

The importer does not propose `Approvable`: an approval outcome kept as a field on the thing, such as GitHub's `reviewDecision`, is not read. A person referenced through a numeric key, such as an integer foreign key, is not bound, because `Decision` keeps ids as text, so that table gets no proposal.

### Records of work

A task is an ask, not a ticket: one ask to one person or agent to do one piece of work, and what became of it (see [Tasks as asks](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.14.0/docs/concepts/tasks-as-asks.md)). Where another system keeps a record of work, the importer proposes `Assignment` for it, graded on structure:

| Evidence in the schema | Proposal | Grade |
|---|---|---|
| A state enum holding a working value, a finished value and a value that means a person is needed, beside a single reference to the one doing the work: a reference to an agent's or an app's own record, or a reference to a person or other principal named for the one doing it | `Assignment`, with the one doing it as `asked_of_id`, and `Stateful` on those states | medium |
| The same, with who asked, the thing, a reference to its own kind, a due date, what was asked, the result or a count of tries | the same, with those bound too | medium |
| Those states with no reference to the one doing the work, such a reference with no such states, a field named like the one doing it that references nothing, or states that never say a person is needed | nothing | |

**The states.** The working values are working, in progress, running, active, processing, started, executing and ongoing. The finished values are finished, completed, complete, done, succeeded, success and successful. A person is needed where a value reads input required, needs input, awaiting input, waiting for input, input needed, requires input, user input required, requires user input, awaiting user input, waiting for user input, waiting for user, awaiting user, waiting on user, needs user, needs human, awaiting human, waiting for human or human input required. Values are read in any case, with their words joined by capitals, underscores, hyphens or spaces (`awaitingInput`, `INPUT_REQUIRED`, `in-progress`), and with a prefix every value shares taken off, so A2A's `TASK_STATE_INPUT_REQUIRED` reads input required. A value written as one run of letters, such as `inprogress`, is not read. Blocked, waiting and pending do not say a person is needed, because they wait on anything: a tracker's blocked issue is the ticket, not a task.

**The one doing the work.** A reference to an agent's or an app's own record (one named agent, assistant, bot, app, application, integration, installation or service principal) is the one doing the work, unless it is named for who asked. Otherwise it is a reference to a person or other principal whose name says so: assignee, assigned to, asked of, agent, app user, app, bot, worker, performer, executor, doer, delegate, delegated to, runner or handler. A reference to a person named for nothing else, such as `user`, is not read as the one doing the work: in an agent's product it is often the person who asked.

**What else is bound.** Who asked: a reference to a person or agent named requested by, requester, creator, created by, submitter, initiator, started by, asked by, triggered by, reporter or author (`requested_by_id`). The thing: the one other record it references or, where it references several, the one named subject, issue, ticket, case, item, work item, target, pull request, merge request, document or record (`subject_id`). The task it came from: a reference to its own kind (`parent_id`). A date-time named due or deadline (`due_at`), free text named prompt, instruction or ask (`instruction`), free text named result or outcome (`result`), and a whole number named tries, attempts, run count or session count (`tries`). Each is bound only where its type matches the trait's field: a same-named field of another type, such as a boolean named `result`, is left unbound, and the proposal stays valid. Every other `Assignment` field stays unbound: who the work is for, what it waits on, the first ask, the kept names and the kinds.

**Two guesses stop where it fires.** A reference to the record's own kind is the task it came from, so it is not also proposed as a category tree (`Classifiable`). The one doing the work and who asked are bound to their seats, so they are not also proposed as an owner with nothing bound (`Ownerable`). A reference to an owner still proposes `Ownerable`: on a task, the owner is the one who answers for the work. Where the rule does not fire, the importer proposes exactly what it did before this rule existed. The record's lifecycle is its work's states, even where another enum sorts first; the other enum is reported as an alternative.

Measured on five published schemas:

- Linear's `AgentSession` is proposed `Assignment` with its app user as the one doing the work, its creator as who asked and its issue as the thing, and its status as its lifecycle. Linear says that when an automation hands an issue to an agent, the creator is the issue's assignee, on whose behalf the agent works: check who asked before accepting.
- A2A's `Task` and MCP's `Task` hold such states but name no one: no field references a person or an agent, so they gain nothing, and an agent's work keeps the states its protocol gives it.
- GitHub's agent task holds them too (`in_progress`, `completed`, `waiting_for_user`), but nothing in it references the one doing the work: its custom agent is an object written inside the task, not a reference to a record, and so is its creator, who would be who asked. It gains nothing.
- Devin's session references no person's or agent's record, and writes a person needed as `blocked`, which the importer does not read as one.
- A tracker's issue gets nothing new: Linear's `Issue` references its assignee and its parent, but its state is a record a team defines, not an enum.

A reference held as a number or in a UUID column is not read as the one doing the work, because `Assignment` keeps ids as text, so that table gets no proposal. Who answers for the work is never guessed from the one doing it: accept `Ownerable` where the record names an owner.

#### How other systems' states read against a task's

The importer keeps each system's own states and renames none. This is how they read against `Task`'s eleven, for a person mapping one to the other; "none" means the system has no such state.

| Task | A2A v1.0.1 | MCP 2025-11-25 | Linear agent session | GitHub agent task | Devin session |
|---|---|---|---|---|---|
| Not started | `TASK_STATE_SUBMITTED` | none | `pending` | `queued` | none |
| Working | `TASK_STATE_WORKING` | `working` | `active` | `in_progress` | `working`, `resumed` |
| Needs input | `TASK_STATE_INPUT_REQUIRED`, `TASK_STATE_AUTH_REQUIRED` | `input_required` | `awaitingInput` | `waiting_for_user` | `blocked`, which Devin describes as waiting for user input |
| Waiting | none | none | none | none | none |
| Paused | none | none | none | none | none |
| Outcome unknown | none arrives: `TASK_STATE_UNSPECIFIED`, which A2A describes as an unknown or indeterminate state, is read as a placeholder and not imported | none | none | none | none |
| Finished | `TASK_STATE_COMPLETED` | `completed` | `complete` | `completed` | `finished` |
| Failed | `TASK_STATE_FAILED` | `failed` | `error` | `failed` | none |
| Declined | `TASK_STATE_REJECTED` | none | none | none | none |
| Cancelled | `TASK_STATE_CANCELED` | `cancelled` | none | `cancelled` | none |
| Handed over | none | none | none | none | none |

Not placed, because their schemas say too little: Linear's `stale` and `stopping`; GitHub's `idle`, and its `timed_out`, which could be a failure or an outcome nobody knows yet; and Devin's `expired` and its requests to suspend and resume.

```json
{"action":"apply","importId":"<from draft>","objects":[{"name":"YourObject","proposals":["<accepted proposal id>"]}]}
```

Omit `proposals` to accept an object with no traits. Accept dependencies in the same call unless they are already registered. The batch validates all definitions, writes them in dependency order, and composes each supported context transiently, including timeline where declared or contributed by an accepted lifecycle/history trait. Read-only sources omit form. Cyclic relationships are retained: all files exist before composition. A write or composition failure restores previous files byte for byte and removes newly created files. A filesystem lock excludes concurrent registration/import writes; this is rollback on operation failure, not a crash-recovery database transaction.

`overwrite: true` permits replacing your existing objects. A shipped-name replacement additionally requires that exact name in `confirmShipped`, for example `"confirmShipped":["User"]`. Reviewing one shipped replacement does not authorize another.

## What is preserved

Primitive fields, supported formats, nullability, examples, defaults and constraints become object fields. Compatible `allOf` declarations merge; conflicting intersections are reported. `oneOf`/`anyOf` alternatives remain distinct, including discriminators; a null-plus-one-type union can become a nullable field. Named object references become relationship identifier fields, including a reference wrapped in `allOf` beside nothing but annotations, the way OpenAPI 3.0 writes a described reference. Swagger 2.0's `file` type is read as a binary string. Source names and every normalized value retain file/pointer provenance.

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
