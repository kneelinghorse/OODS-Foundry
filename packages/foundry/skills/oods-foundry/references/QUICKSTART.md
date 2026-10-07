# Make your first change, then bring your design system

Change one trait and predict which screens follow it. The first run uses the shipped Warehouse and ColdRoom examples; the Harbor walkthrough that follows adds your colour tokens and component, generates an app, and renders and certifies a separate chart. Chart certification does not certify the surrounding application.

Use Node.js 22.0.0 or newer on macOS or Linux and connect your MCP client as the package README describes. The calls below use the underscore names your client lists. Start with a fresh user-data folder if you already registered any of these example names; creation does not silently overwrite existing work. Keep each walkthrough in one server session because schema references expire.

## Get the editable inputs

In your project, install this version of OODS Foundry and copy its examples outside the installed runtime:

```sh
npm install @oods/foundry@0.8.0
cp -R node_modules/@oods/foundry/quickstart ./harbor-design-system
```

For a release candidate, install its supplied OODS Foundry tarball in the first command. The remaining steps are identical.

The input folder contains `harbor.tokens.json`, `Stockable.trait.yaml`, `Warehouse.object.yaml`, `ColdRoom.object.yaml` and `team-components/`. Replace their example values with your design system's values as you go. The brand document maps colour values into OODS Foundry's named roles; it is not an automatic importer for every design-token format. Keep the base, dark and high-contrast documents and their role names.

Ask your assistant to make each named call. Replace file placeholders with the files' complete text and composition placeholders with the returned ids; placeholders are values to substitute, not literal tool arguments.

## The first change

This run makes **23 tool calls**, including **six `design_preview` calls**. Leave at least seven seconds between preview calls to stay below their rate limit. Save an untouched copy of `Stockable.trait.yaml` before editing it.

### Register the examples

Register Stockable, Warehouse and then ColdRoom. ColdRoom belongs to a Warehouse, so that object must exist first.

<!-- first-change: trait-register object_registry -->
```json
{"action":"register","yaml":"<Stockable.trait.yaml>"}
```

<!-- first-change: warehouse-register object_registry -->
```json
{"action":"register","yaml":"<Warehouse.object.yaml>"}
```

<!-- first-change: coldroom-register object_registry -->
```json
{"action":"register","yaml":"<ColdRoom.object.yaml>"}
```

### Compose four screens

Retain the `compositionId` for each screen. These calls create version 1.

<!-- first-change: warehouse-detail-v1 design_compose -->
```json
{"object":"Warehouse","context":"detail"}
```

<!-- first-change: coldroom-detail-v1 design_compose -->
```json
{"object":"ColdRoom","context":"detail"}
```

<!-- first-change: warehouse-list-v1 design_compose -->
```json
{"object":"Warehouse","context":"list"}
```

<!-- first-change: subscription-detail-v1 design_compose -->
```json
{"object":"Subscription","context":"detail"}
```

Open Warehouse detail with `design_preview`; keep the returned browser link.

<!-- first-change: warehouse-before design_preview -->
```json
{"compositionId":"<warehouse-detail>","version":1}
```

### Make a prediction, then edit

Before looking, say which of Warehouse detail, ColdRoom detail, Warehouse list and Subscription detail you expect to change.

A trait places a field on a screen through `view_extensions`, and this edit names `detail`.

In your copied `Stockable.trait.yaml`, change the version under `trait` from `1.0.0` to:

<!-- first-change-edit: version -->
```yaml
version: 1.1.0
```

Add this field inside `schema`, beside the existing fields:

<!-- first-change-edit: schema -->
```yaml
last_counted_at:
  type: datetime
  required: false
  description: When the stock in this location was last counted.
  examples:
    - '2026-09-20T07:30:00Z'
```

Append this placement to the existing list under `view_extensions.detail`:

<!-- first-change-edit: detail -->
```yaml
- component: Text
  position: main
  priority: 67
  props:
    field: last_counted_at
```

Register your complete edited file with `overwrite: true`:

<!-- first-change: trait-edit object_registry -->
```json
{"action":"register","yaml":"<Stockable.edited.trait.yaml>","overwrite":true}
```

Compose the same screens again, passing each saved id. These calls create version 2.

<!-- first-change: warehouse-detail-v2 design_compose -->
```json
{"object":"Warehouse","context":"detail","compositionId":"<warehouse-detail>"}
```

<!-- first-change: coldroom-detail-v2 design_compose -->
```json
{"object":"ColdRoom","context":"detail","compositionId":"<coldroom-detail>"}
```

<!-- first-change: warehouse-list-v2 design_compose -->
```json
{"object":"Warehouse","context":"list","compositionId":"<warehouse-list>"}
```

<!-- first-change: subscription-detail-v2 design_compose -->
```json
{"object":"Subscription","context":"detail","compositionId":"<subscription-detail>"}
```

### Compare your prediction

Compare version 1 with version 2 for each screen, then open the returned compare links.

<!-- first-change: warehouse-detail-compare design_preview -->
```json
{"action":"compare","compositionId":"<warehouse-detail>","version":1,"against":{"version":2}}
```

<!-- first-change: coldroom-detail-compare design_preview -->
```json
{"action":"compare","compositionId":"<coldroom-detail>","version":1,"against":{"version":2}}
```

<!-- first-change: warehouse-list-compare design_preview -->
```json
{"action":"compare","compositionId":"<warehouse-list>","version":1,"against":{"version":2}}
```

<!-- first-change: subscription-detail-compare design_preview -->
```json
{"action":"compare","compositionId":"<subscription-detail>","version":1,"against":{"version":2}}
```

| Screen | What happens |
| --- | --- |
| Warehouse detail | Changes. “Last counted at” appears. |
| ColdRoom detail | Changes the same way: a different object with the same trait. |
| Warehouse list | The screen is the same. Its definition gained a field placed on detail only, so compare names `objectSchema.last_counted_at` under Definition. |
| Subscription detail | Untouched, with the same hash. Subscription does not have Stockable. |

Compare also lists the generated files whose hashes changed: the Warehouse list's generated type includes the new field even though its screen stays the same.

### Put the trait back

Replace the edited file with your saved, untouched Stockable file and register it again:

<!-- first-change: trait-restore object_registry -->
```json
{"action":"register","yaml":"<Stockable.trait.yaml>","overwrite":true}
```

Compose each screen once more, using its same id, to create version 3. All four return to their version 1 schema hash.

<!-- first-change: warehouse-detail-v3 design_compose -->
```json
{"object":"Warehouse","context":"detail","compositionId":"<warehouse-detail>"}
```

<!-- first-change: coldroom-detail-v3 design_compose -->
```json
{"object":"ColdRoom","context":"detail","compositionId":"<coldroom-detail>"}
```

<!-- first-change: warehouse-list-v3 design_compose -->
```json
{"object":"Warehouse","context":"list","compositionId":"<warehouse-list>"}
```

<!-- first-change: subscription-detail-v3 design_compose -->
```json
{"object":"Subscription","context":"detail","compositionId":"<subscription-detail>"}
```

Compare Warehouse detail version 1 against version 3: it is identical.

<!-- first-change: warehouse-restored design_preview -->
```json
{"action":"compare","compositionId":"<warehouse-detail>","version":1,"against":{"version":3}}
```

## The Harbor walkthrough

If you did the first run and put the trait back, Stockable and Warehouse are already registered: skip only the two `register` calls for those definitions below.

The remaining walkthrough uses the same input folder. Prepare its editable example component package:

```sh
cd harbor-design-system/team-components
npm install --ignore-scripts
npm pack --ignore-scripts
```

The last command creates `harbor-example-components-1.0.0.tgz`, used when installing the generated apps. The team package is an editable example, not a published library. A new OODS Foundry process draws its first chart more slowly than the next.

Replace `<harbor.tokens.json>` with the parsed JSON document, `<Stockable.trait.yaml>` and `<Warehouse.object.yaml>` with those files' complete text, and `<team-components>` with the copied package's absolute directory. Replace `<schemaRef>`, `<compositionId>` and `<normalizedSpec>` with values returned earlier in this walkthrough.

### Register your brand

Ask your assistant to make each named call. Start with `health_check`:

<!-- quickstart: health health_check -->
```json
{}
```

Then `brand_create` with `template` to inspect the roles and descriptions:

<!-- quickstart: template brand_create -->
```json
{"action":"template"}
```

The supplied Harbor document has a complete set of values. Change values, then call `brand_create` with `validate`. Fix each reported issue before creating the brand; a failed contrast check includes the pair, measured ratio and required floor.

<!-- quickstart: brand-validate brand_create -->
```json
{"action":"validate","brand_id":"Harbor","documents":"<harbor.tokens.json>"}
```

When `valid` is true, create it:

<!-- quickstart: brand-create brand_create -->
```json
{"action":"create","brand_id":"Harbor","documents":"<harbor.tokens.json>"}
```

The result names the written files and token build. Your brand lives outside the unpacked runtime and generated apps carry its stylesheet. Reusing an existing brand id is refused; use `brand_apply` for an intentional change.

### Register your trait and object

`Stockable` supplies stock fields and views; `Warehouse` combines it with shipped lifecycle traits and authors ten sample warehouses. Their authored values keep each site's operating status, status history, stock, last restock, manager and operating organization coherent, so the detail screen shows no placeholders. Start with `object_registry` to validate the trait:

<!-- quickstart: trait-validate object_registry -->
```json
{"action":"validate","yaml":"<Stockable.trait.yaml>"}
```

Register it only after `valid: true`:

<!-- quickstart: trait-register object_registry -->
```json
{"action":"register","yaml":"<Stockable.trait.yaml>"}
```

Validate and register the object after its trait exists:

<!-- quickstart: object-validate object_registry -->
```json
{"action":"validate","yaml":"<Warehouse.object.yaml>"}
```

<!-- quickstart: object-register object_registry -->
```json
{"action":"register","yaml":"<Warehouse.object.yaml>"}
```

Read the returned context checks. A missing trait or invalid definition is reported with its cause and registration is refused. See `OBJECTS-AND-TRAITS.md` for field types, money semantics, number formats, form controls and name-collision rules.

### Substitute your component

The example Button expects `caption` and `appearance`, so this mapping translates OODS Foundry's `content` and `intent`. Call `component_map`:

<!-- quickstart: mapping component_map -->
```json
{
  "action":"create","apply":true,"externalSystem":"harbor",
  "externalComponent":"TeamButton","oodsTraits":["Stateful"],
  "substitution":{
    "component":"Button",
    "react":{
      "package":"@harbor/example-components/react","version":"1.0.0","export":"TeamButton","localPath":"<team-components>",
      "props":{"content":{"name":"caption"},"intent":{"name":"appearance","values":{"neutral":"quiet","primary":"prominent","danger":"danger"}}}
    },
    "vue":{
      "package":"@harbor/example-components/vue","version":"1.0.0","export":"TeamButton","localPath":"<team-components>",
      "props":{"content":{"name":"caption"},"intent":{"name":"appearance","values":{"neutral":"quiet","primary":"prominent","danger":"danger"}}}
    }
  }
}
```

This replaces a shipped identity; it does not add a new catalog identity. The package's name, version and exports must match. Local paths help the preview find the package and are not emitted as consumer dependencies. Component reports distinguish met, unmet and not-checked obligations; a mapped name is not proof of semantic compatibility.

### Compose the Warehouse screen

Call `design_compose` and retain its `schemaRef`, `compositionId` and version:

<!-- quickstart: compose design_compose -->
```json
{"object":"Warehouse","context":"detail","preferences":{"brand":"Harbor","theme":"light"}}
```

The result contains the composed schema, object and trait provenance, selections and validation findings. Check `status` and warnings. Composition uses declared objects and keyword rules; missing selection confidence is not inferred.

### Render and certify a chart

Call `viz_render` with explicit rows from the example stock records:

<!-- quickstart: chart viz_render -->
```json
{"chartType":"bar","brand":"Harbor","theme":"light","rows":[{"warehouse":"Lakeside Distribution","pallets":640},{"warehouse":"North Yard","pallets":760},{"warehouse":"Harbor Cold Store","pallets":2400}],"encodings":{"x":{"field":"warehouse","type":"nominal"},"y":{"field":"pallets","type":"quantitative"}},"output":{"includeNormalizedSpec":true,"includeA11y":true}}
```

Then call `artifact_certify` with that returned normalized specification and the same brand/theme:

<!-- quickstart: certify artifact_certify -->
```json
{"spec":"<normalizedSpec>","brand":"Harbor","theme":"light"}
```

Read `conformant`, each pillar, and its findings. For this Cartesian chart, certification reads the specification's data. ECharts-primary charts also need the same data operand used for rendering. High contrast has a forced-colour exemption, not a numeric contrast pass. This chart is a separate artifact; this walkthrough does not insert it into the Warehouse screen.

### Preview and generate

Call `design_preview` for the saved composition:

<!-- quickstart: preview design_preview -->
```json
{"compositionId":"<compositionId>","version":1}
```

Open the returned React or Vue `appUrl`. Inspect the Warehouse name, stock status and team Button. The app is served locally by default. Inline presentation depends on the MCP host; the browser link is the portable route. An absent contract browser leaves browser obligations not checked, with reasons.

Call `code_generate` to receive a complete single-screen app rather than only a component:

<!-- quickstart: react code_generate -->
```json
{"schemaRef":"<schemaRef>","framework":"react","profile":"build","options":{"output":"application","brand":"Harbor","theme":"light","payloadMode":"file"}}
```

<!-- quickstart: vue code_generate -->
```json
{"schemaRef":"<schemaRef>","framework":"vue","profile":"build","options":{"output":"application","brand":"Harbor","theme":"light","payloadMode":"file"}}
```

Each result names its payload directory, artifact content hash, dependencies and `validationReceipt`. The content hashes a clean run of this walkthrough produces are in the package's `quickstart/expected.json`. The build profile checks source statically; read `notChecked` for compilation and browser work that has not run. Copy each artifact's files into a separate app folder. Its package.json pins, at exact versions, the OODS packages its code imports, which install from npm, and the example team package. The example package is on no registry, so first install the local `harbor-example-components-1.0.0.tgz` by its path, then follow the install block (`npm install`, then `npm run build`) and run `npm run dev`. For an unpublished release candidate, install its supplied OODS tarballs the same way.

The screen labels its sample data. Connect actions to your application before shipping: the preview's integration notice means that no domain record was changed. Request `context: "workflow"` when you want multiple screens with a local sample store; that store does not supply production persistence.

OODS Foundry's code is under the Apache License 2.0. The fonts it bundles (Geist, Geist Mono and DM Sans) are under the SIL Open Font License 1.1, and its colour scales adapt Radix Colors (MIT); the NOTICE file in `@oods/foundry` carries both licenses. Generated output belongs to you; installed dependencies keep their licenses. Retain the returned hashes and receipts when reviewing what you built. See [GENERATED-APPS.md](GENERATED-APPS.md) for what to keep and replace when you generate again after a definition changes.
