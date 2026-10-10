# Your own objects and traits

OODS Foundry composes screens from **objects** (the things your product is about: a warehouse, an invoice, a user) and
**traits** (capabilities an object composes: a lifecycle, prices, stock levels). It ships objects such as `Subscription`
and `User` and traits such as `lifecycle/Stateful`; `object_registry` `list` names them, leaving out the five internal
capture objects (Run, Finding, CapturedArtifact, Comparison and ComparisonSignal) unless you ask with
`"includeInternal": true`. This guide is for adding your own, so
`design_compose`, `code_generate` and `design_preview` work with them as they do with the shipped ones.

## Where they live

| Folder | Holds | Setting |
| --- | --- | --- |
| `~/.oods-foundry/objects` | `*.object.yaml` files | `OODS_OBJECTS_DIR` |
| `~/.oods-foundry/traits` | `*.trait.yaml` files | `OODS_TRAITS_DIR` |

Your folders are read after the shipped ones, including subfolders. They are outside the unpacked runtime, so they
survive upgrades. Set either variable in your client's `env` block to keep your definitions somewhere else, such as your
product's repository. From the runtime archive the variables have no default: set them to register anything.

## An object

```yaml
object:
  name: Warehouse            # letters and digits; it names files, types and components in generated code
  version: 1.0.0
  domain: acme.logistics
  description: A storage site the team ships orders from.

traits:                      # shipped traits by name (lifecycle/Stateful) or yours (Stockable)
  - name: lifecycle/Stateful
    parameters:
      states: [planned, active, closed]
      initialState: planned
  - name: Stockable
    parameters:
      capacityUnit: pallets

schema:                      # the object's own fields, beside the ones its traits add
  warehouse_id: { type: uuid, required: true, description: Unique identifier. }
  name:
    type: string
    required: true
    description: The warehouse's name.
    examples: [Lakeside Distribution, North Yard]   # sample records cycle through these
  monthly_rent: { type: number, required: true, description: Monthly cost in major units. }
  currency:
    type: string
    required: true
    description: Currency the rent is paid in.
    validation: { enum: [USD, EUR, GBP] }

semantics:
  monthly_rent:
    semantic_type: logistics.warehouse.rent
    token_mapping: tokenMap(commerce.price.primary)
    ui_hints:
      component: CurrencyAmount    # this field is money...
      currencyField: currency      # ...in the currency this field holds

samples:                     # optional: whole sample records, by field name, shown in this order
  - { name: Lakeside Distribution, monthly_rent: 12500.5, currency: USD, status: active }
  - { name: North Yard, monthly_rent: 9800, currency: EUR, status: planned }

metadata:
  maturity: beta
  # supportedContexts: [list, detail, card]   # optional; without it the object composes every context
```

Field types are `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `uuid`, `email`, `url`, arrays such as
`string[]`, and structured types.

The sample records the preview and generated apps show are the object's `samples:`, in order, as the shipped business
objects show their eight. A sample names values for any of the object's fields, its traits' included (`status` above
comes from `lifecycle/Stateful`). A field a sample leaves out shows that field's own example at the same position, or
else an empty value of its type (empty text, 0 or false): never another sample's value or a default, which would state
a fact the sample did not record. `validate` refuses a sample that names a field the object does not have or an enum
value the field does not allow. An object with no `samples:` cycles through each field's `examples`, so give one per
distinct row you want to see: a preview list shows ten.

### Money

A field is money only when its semantics say so, as above: `ui_hints.component: CurrencyAmount` and the `currencyField`
that holds its currency. Without anything more the amount is in **major units**: `12500.5` is 12,500.50. If the amount is
stored in minor units, say how many make one major unit:

```yaml
    ui_hints:
      component: CurrencyAmount
      currencyField: currency
      minorUnits: 100              # 1999 is 19.99
```

A field's name never decides this: a field called `amount` or `total_minor` is not money unless its semantics declare
it. `PriceSummary` and the billing badges read amounts stored in minor units; a field in major units shows through
`PriceBadge`. `validate` refuses a trait view that would show a major-unit amount 100 times too small.

### Numbers and form controls

A number field's semantics can say how its value reads with `ui_hints.format`:

```yaml
    ui_hints:
      format: percent              # 12.5 reads 12.5%; with quantity, 86420 reads 86,420
```

React, Vue and HTML print the same text. A number that declares nothing keeps the digits it was stored with, so a year
or a score is not grouped. `format: integer` is accepted and changes nothing; any other value is an error when the object
is composed.

A generated form edits a boolean with a Checkbox and an enum with a Select. A field's semantics can ask for another
control with `ui_hints.component`: `Switch` for a boolean, `SegmentedControl` for an enum of two to five options, or
`Combobox` for an enum picked from a list you filter by typing. A control that cannot edit the field, such as a Switch on
a text field or a SegmentedControl over six options, leaves the default in place.

Date fields can use either a DatePicker or a native date Input. The composer budgets ten suggested form slots, then
adds any missing required scalar fields with plain editors. In the shipped Plan form, `period_start` gets a DatePicker
in the suggested slots; `period_end` is added as a required date Input. Both come from `SaaSBillingMetered`, are required
`date` fields, and declare no different control hint or trait placement. The different controls reflect this slot
selection limit, not different date semantics. Substitution preserves each selected identity, so mapping DatePicker
does not turn the other Input into a calendar picker.

## A trait

```yaml
trait:
  name: Stockable            # must not be a shipped trait's name
  version: 1.0.0
  description: How full a storage location is.
  category: inventory

parameters:
  - name: capacityUnit
    type: string
    required: false
    description: The unit stock is counted in.
    default: pallets

schema:
  stock_level:
    type: string
    required: true
    description: Whether the location has room, is nearly full, or is full.
    validation: { enum: [room_available, nearly_full, full] }
  units_on_hand: { type: integer, required: true, description: Units stored now. }

view_extensions:             # what the trait places on each screen: list, card, detail, form, timeline, inline, dashboard
  list:
    - component: StatusBadge
      position: after
      props: { statusField: stock_level }
  detail:
    - component: StatusBadge
      position: main
      priority: 70
      props: { statusField: stock_level }
    - component: Text        # a field placed explicitly is always shown
      position: main
      priority: 69
      props: { field: units_on_hand }
```

A trait of yours can place only the components OODS Foundry ships; `catalog_list` names them. Your own components can replace those ids through substitution; see [COMPONENTS.md](https://cdn.jsdelivr.net/npm/@oods/foundry@0.11.1/COMPONENTS.md).

## Checking and registering

Ask your assistant to use `object_registry` to validate or reload, and `object_register` to save, with the whole file as `yaml`:

1. `{"action": "validate", "yaml": "<the file>"}` parses it, checks the header and fields, resolves every trait, checks
   the contexts, and composes the object with its traits. It answers `valid`, the `errors` with where each is, the
   composer's `warnings`, and the contexts the object composes. Nothing is written.
2. `object_register` with `{"action": "register", "yaml": "<the file>"}` validates, writes `<Name>.object.yaml` (or `.trait.yaml`) into your
   folder, reads the folders again and composes the object in every context it declares. If anything fails, your folder
   is left exactly as it was and the answer says why (`OODS-V215`). A name you already registered is replaced only with
   `"overwrite": true` (`OODS-C004`).
3. `{"action": "reload"}` reads the folders again without a restart, after you edit a file by hand.

Register a trait before an object that uses it. `{"action": "list"}` shows each object's `source` (`shipped` or `user`),
and `health_check` reports your folders and counts under `registry.definitions`.

## Rules

- **Your object with a shipped object's name is used in its place**, everywhere, and `list`, `health_check` and `validate`
  say so. You can model your own `User`, `Product` or `Invoice`. Remove the file and `reload`, and the shipped one returns.
- **Your trait cannot reuse a shipped trait's name.** Shipped objects compose shipped traits by name, so yours would
  change screens you never touched. It is reported and not used; give it a name of its own.
- **Two of your files with one name are ambiguous**: neither is used until only one declares it.
- **Nothing is skipped silently.** A file that is not valid YAML, declares no name, or uses a trait that no folder
  defines is reported by `list`, `health_check` and `validate` with the file and the reason.

## What composition does with them

Your objects compose, generate, preview and run like the shipped ones: `design_compose` in each context,
`code_generate` for React and Vue, `design_preview` in the browser, and a generated workflow app whose form saves. Two
limits of the composer apply to every object, yours and shipped:

- the composer budgets ten suggested form slots, then adds any missing required scalar editors; trait editors retain ownership of their structured fields;
- a detail screen shows the fields a trait places explicitly (as `Text` above) and the object's own fields.

## HTML, relationships and wireframes

A run of the npm package, measured on 0.10.0, verified HTML, a relationship diagram and a composed wireframe from the same registered Warehouse on Node 24.6.0 and on Node 22.0.0, the floor. Its brand, objects, traits and mappings stay outside the unpacked runtime; generation leaves the shipped readiness attestation unchanged. These are builder measurements, not independent certification. <!-- history -->

For static sample HTML, compose your object, then call `code_generate`:

```json
{"schemaRef":"<from design_compose>","framework":"html","profile":"build","options":{"output":"application","brand":"Harbor","theme":"dark","payloadMode":"file"}}
```

Open the returned `index.html` from its payload directory. The document carries styles and sample record data. Tabs, local list controls and native edits work locally; domain actions explain where to connect your application and never persist a record. HTML renders OODS Foundry's controls; a React/Vue team-component mapping does not execute that package in HTML.

Static HTML has separate browser measurements; it is not covered by the React/Vue runtime sweep. Read the HTML measurement summary and its evidence identity from `health_check` before treating it as proof for your object and theme. Build validation is static; browser measurements are separate. There is no universal form-parity claim.

Declare an association in an object's YAML only when its target contract is known:

```yaml
relationships:
  - target: Organization
    via: organization_id
    cardinality: many-to-one
    label: Operated by
```

The via field must exist on the source object or one of its traits. The target must be registered first (self-links are allowed). Cardinality is source-relative: one-to-one, one-to-many, many-to-one or many-to-many. Validate/register return typed errors for an unknown target/field or malformed declaration. Identifiers alone never create an association.

```json
{"fidelityKind":"boxes-arrows","object":"Warehouse","options":{"depth":1,"brandOverlay":"Harbor","theme":"dark"}}
```

`fidelity_preview` returns HTML and an accessible standalone SVG. Arrows show declared type associations with label, cardinality and via field, plus each object's traits and key fields. They do not join live records or check referential integrity. Depth is 0–3; an `objects` array draws only the declared edges within that set. Large diagrams scroll inside the page.

```json
{"fidelityKind":"wireframe","object":"Warehouse","context":"detail"}
```

Alternatively pass `schemaRef` from composition or an inline `schema`, with exactly one source. Composed wireframes draw the component tree and regions using the selected brand and theme tokens, label field bindings, and stack at phone widths. Alternate states and tab panels appear together for inspection. `review` adds recorded node confidence; absent confidence says Not recorded. `branded-mockup` renders the static sample HTML. `boxes-arrows` with a composition draws a clearly labelled component-containment graph, not object associations. Legacy `manifest` input and the nine named registry fixtures remain available; legacy views retain their entity/slot projection and branded manifests use light tokens.
