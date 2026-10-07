# Changelog

What changed in each version of OODS Foundry, in the terms you use it in.

## 0.9.0

- The default roster remains 20 tools. Its compact `tools/list` is 82,520 UTF-8 bytes (0.8.0: 82,191), measured from the JSON tool array.

- Import Postgres DDL and ordered Prisma, Drizzle, Flyway or golang-migrate migrations, including keys, constraints, comments and read-only views.
- Import Prisma models and multi-file schemas with relations, native types, source mappings and declared defaults.
- Import dbt manifests and properties folders, including column tests, static semantic declarations and snapshot history. No SQL or Jinja is evaluated.
- Import OData v2/v4 CSDL XML or JSON with declared titles, list columns, detail sections, display text, currency, value lists and read-only capabilities.
- Import GraphQL SDL or introspection with enums, input objects, relationships and declared scalar formats. Resolvers are never run.
- Every format uses the same draft/show/explicit-acceptance flow. Trait suggestions now use structural and declared evidence across the trait library; counts include each proposed trait. Accepted-trait fields are distinguished from source removals on re-import.
- Imported screens use record titles or identifiers, varied valid samples, source help, date-only formatting and relationship pickers. Lifecycle/history traits add timelines; read-only sources omit forms. Hand-written objects can declare list columns too.
- Unreachable references are reported and skipped without fetching them. Folder escapes still refuse the import. Streamed, hashed staging supports the Oracle Financials corpus without one giant JSON string.

## 0.8.0

- npm package repository and issue links now point to the public Apache-2.0 source. The first-change quickstart uses `object_registry` throughout.
- The eight pre-0.7 tool-name aliases are removed; use the names listed by your client.
- Generated application library dependencies remain pinned to 0.6.2, their retained tested implementation. Those pins move only with a separately measured library update; the tool release version does not change them.
- The 200 retained runtime cells are a projection of the 0.4.1 sweep onto the current public objects. They are not a new 0.8.0 runtime sweep.
- Adds a Docker stdio image and the importer contract, hub schema and export recipes.
- Updates the bundled MCP SDK to 1.31.0 for GHSA-6qxp-vccf-f47h.

- Adds `object_import` with draft/show/apply. The default roster grows from 19 to 20 tools; its compact `tools/list` is 82,191 UTF-8 bytes (previously 79,716), measured from the JSON tool array.

- Object validation now checks trait parameter values against their parameter schemas, including defaults and cross-parameter enum membership. Invalid values are errors; shipped objects remain valid.

## 0.7.0

- Tools have consistent names, short titles, complete behavior hints and descriptions that explain when to choose a related tool. Full input schemas remain available on demand; server validation is unchanged.
- The initial tool list is smaller. The detailed parameter and return reference ships in TOOL-REFERENCE.md.
- The runtime ships 16 objects: 11 public reference objects and 5 internal capture objects. The 12 research, delivery and intelligence objects remain available from the repository checkout.
- The Claude Code plugin includes installation instructions and a README. OODS Foundry remains free under Apache-2.0.

### Tool renames

| Previous name | Current name |
| --- | --- |
| `structuredData_fetch` | `structured_data_fetch` |
| `brand_intake` | `brand_create` |
| `pipeline` | `pipeline_run` |
| `health` | `health_check` |
| `map` | `component_map` |
| `schema` | `schema_store` |
| `object` | `object_registry` |
| `repl` | `schema_render` |

Old names answered with a warning through 0.7.x; those eight aliases are removed in 0.8.0. Existing objects, traits, brands and mappings remain compatible.

## 0.6.2

- The ECharts adapter honors declared number formats and currency on axes and tooltips, and caps categorical bars at 48 pixels with the existing exclusions. The bar cap survives MCP JSON; money formatting still requires consumer-provided formatters because JSON does not carry callbacks.
- A standalone Subscription component chart uses the same authored sample as its preview and application: eleven EUR payments, including the refund, matching the header and payments panel.
- OODS-V218 now explains both unmet component contracts and React-only shadcn mappings that keep the OODS Foundry component in Vue or HTML output; the components guide names that behavior.
- Source verification keeps explicit measured time limits, gives nested claims checks enough time under load, and reports an ignored stale package instead of checking its license against a newer source tree.
- Release tool evidence can read all nineteen outcomes from the npm package proof. The source health ledger can be refreshed after that proof without rebuilding the frozen package.

## 0.6.1

- Destructive shadcn Button, StatusBadge and Banner text uses solid backgrounds and foregrounds from the team's tokens. The Radix and Base UI fixtures measure 4.77:1 in light and 6.85:1 in dark. This fixes the reported light-theme Delete (3.98:1) and Past Due (3.66:1) cases.
- Native trait-form placeholders keep the input placeholder token at full opacity when a host stylesheet supplies translucent placeholder text.
- The root TypeScript check goes from 159 errors to zero, and runs beside the final release verification. Copied shadcn sources compile in their consuming projects; closed-sprint proof producers retain explicit compilation dispositions.
- A first shadcn preview accepts the composition's returned version before a package snapshot exists. Already frozen previews keep their stored bytes.
- COMPONENTS.md installs the local OODS Foundry package before its adapter files are used, and gives the tested Vite/Radix and Next.js/Base UI routes through derive, map, compose, preview, generate and run.
- OBJECTS-AND-TRAITS.md explains why Plan's equivalent period date fields can select DatePicker and native date Input during form composition.
- Narrow payment charts keep date labels horizontal and omit overlapping labels, leaving room for the plot while preserving every payment and its full accessible date.
- Governed line and area samples group the existing A/B categories into separate series, removing vertical joins between unrelated observations.

## 0.6.0

OODS Foundry is an object-oriented design system that extends the one you already have.

- Dark previews, standalone documents and generated application shells set the `dark` class beside `data-theme="dark"`. Component output names that ancestor requirement; shadcn parts keep their light palette in high contrast.
- React component output declares only the bindings it reads, so generated screens pass the shadcn Vite template's strict unused-code checks. Rich Tabs panels keep state and dismiss guards as valid TSX and JSX.
- Brand derivation finds light theme declarations inside nested `@layer` and `@media` blocks and selector lists. Metadata-only mapping updates work after the source project moves. Unquoted CSS imports and local fonts are hashed and copied into generated apps; binary files declare base64 encoding in inline artifacts and decode in file payloads.
- Vue and HTML generation warn when dropping React-only shadcn mappings. Payment-list numbering survives Tailwind preflight. Built Tailwind CSS filenames can depend on the surrounding git checkout; the generated artifact's content hash stays stable.
- shadcn/ui supports the Radix and Base UI bases. React Aria and unknown styles are refused at map creation with OODS-V219. The preview handles CommonJS dependencies that use its React runtime; Select, Tabs and Pagination preserve labels, selection and link semantics on both supported bases.
- Dependencies resolve from their importing files, including pnpm's isolated layout and hoisted npm workspaces. Tailwind 4 works through Vite or PostCSS. Mapped component output begins with `'use client'` for Next.js App Router; application output remains a Vite app. Yarn PnP, Bun and Turbopack-only development servers are not proven.
- Sixteen shadcn adapters ship in one mapping file: the original eight plus Input, Textarea, Checkbox, DatePicker, TagInput, StatusSelector, CardHeader and PriceBadge. COMPONENTS.md names each adapter's limits, the layout and text components that stay OODS, and why trait-panel internals are not substituted. Contract reports remain advisory. Vue shadcn sources, React Aria, shadcn workflows and a hosted shadcn registry remain outside this release.
- Form headings use the screen title instead of an arbitrary numeric field. Generated app native date controls follow the chosen theme. DatePicker and Checkbox keep native uncontrolled values and form-reset behavior.
- The README links the website, trait-change and Harbor demos, chart playground and the website's read-only MCP endpoint with its allow-list. The MCP Registry entry includes the website URL and Streamable HTTP remote.

## 0.5.0

- React mappings accept a shadcn project and module on the Radix base with Tailwind 4. Creation and update check the export and its imports. Preview uses the project's theme; generated applications carry the source files, aliases, CSS and exact dependencies they need, and component output imports the project's module.
- Eight shadcn registry adapters ship for Button, Card, StatusBadge, Tabs, Select, SearchInput, PaginationBar and Banner, with a mapping file and explicit compatibility limits. Contract reports name met, unmet and unchecked obligations.
- `brand_create` derive reads a shadcn CSS theme as text or an absolute file path and returns a recipe with custom-property provenance and gaps. The DTCG path remains supported.
- A mapping may rename a catalog event such as Button's `onActivate` to `onClick`; event value maps are refused.
- Explicit colour alpha 1 is opaque during brand derivation. Neutral hue medians wrap around the colour circle.
- Mapping lists refuse case-variant duplicates; saving through a symlink preserves the link and writes its target, while a dangling link is refused.
- Compare reports a tab rename once without reporting its unchanged fields as moved.

## 0.4.6

- Compare matches fields by their identity and place on screen. Inserting a field no longer reports unchanged fields as removed and added because their node counters shifted.
- Killing the launcher closes its native children and the consumer connection; finished tool calls clear their timers, and the adapter relays child stderr through its own pipe.
- Dashboard panels and each chart render in generated screens scope their SVG identifiers and style selectors independently.
- `component_map` create accepts `mappings` or a checked JSON `mappingsPath`, validates every entry before one write, and reports each entry's outcome. Duplicate component mappings and invalid local package exports fail at creation.
- `brand_create` derive accepts a team's DTCG tokens, resolves aliases, and returns a recipe with each value's source and any gaps. It writes nothing; review the recipe before creating the brand. Team token names are not carried into generated apps.

## 0.4.5

- `design_preview` compare now reports changed props on and inside slots and changed object-definition fields in a
  new `definition` category. Different schema hashes can no longer receive an “identical” answer; a screen may
  stay visually the same while its definition changes.
- Temperature fields ending in `_temperature_c`, `_temperature_f`, `_temp_c` or `_temp_f` now read “(°C)” or “(°F)”.
  Other fields ending in `_c` or `_f`, such as `option_c`, keep ordinary wording. Other unit labels are unchanged.
- The security note names this release, and all package guides use the OODS Foundry name.
- The QUICKSTART opens with 23 calls that change one trait, compare four screens, and restore the original.
  ColdRoom ships beside Warehouse with authored example values. Compare prepares both screens so its links open
  even when the versions have only been composed.
- GENERATED-APPS.md explains which generated files to replace, where application wiring belongs, and how to
  compare file hashes and action contracts. Generation produces complete output; it merges nothing and detects
  no edits. Generated applications and workflows include a README pointing to the guide.

## 0.4.4

- Chart-accessibility results now emit `OODS-A11Y-R-NN`. Agents matching `OODS-A11Y-A11Y-R-NN` must use
  the new spelling; each of the 16 entries in `errors.json` lists its historical spelling in `aliases`.
- Definition validation and registration refuse declared conflicts between unbound traits and non-semantic
  header versions. These change an agent's result from valid to invalid. Bound chart marks stay exempt,
  and previously stored definitions continue to load. Unknown top-level keys warn with the nearest spelling.
- Run records add `capture_note`; the screen says "Capture note" over its recorded capture settings.
  `auth_provenance_note` remains in records for existing readers but is unavailable to views.
- Media labels its dimensions "Width (px)" and "Height (px)". Only the closed list of trailing unit tokens
  receives parentheses; other shipped field labels retain their wording.
- The guides consistently say OODS Foundry and explain that a new process draws its first chart more slowly.
  The adapter's startup line identifies the runtime version and digest without naming its host directory.

## 0.4.3

- A trait's status badge on a detail page says what it describes, including when the object has no Stateful trait.
  A ColdRoom made with Stockable now shows "Stock level" beside "Full", with its record fields in order. Header
  status and grouped detail fields keep their existing presentation. This changes the composed schema and generated
  code for previously unlabelled trait badges; Warehouse's existing label is unchanged.
- `viz_render` accepts `output.includeVegaSpec: true` and returns `vegaSpec`, the exact Vega specification used to
  draw its SVG, including high-contrast symbol legends and requested sizing. `spec` remains the Vega-Lite source
  before those renderer adjustments. The default output, SVG and chart content hash are unchanged.
- The package ships `errors.json` beside `facts.json`. Each runtime code has its severity, canonical message, cause,
  fix, retryability and the tools whose shipped module graphs can return it. Reserved codes are identified separately.
  The API reference's error tables come from this data.
- A handler timeout now returns retryable `OODS-S002`; an unexpected exception returns `OODS-S003`. An agent matching
  the former literal `BAD_REQUEST` must use the OODS code instead. The optional HTTP bridge keeps its transport codes.
- Stage1 0.4.0 captures open in the run view: `run_manifest` 1.7.0, `a11y_report` 2.5.0 and accessibility evidence 1.4.0
  are admitted by Stage1's committed contract at release source `08c73e0d37b06da71f10329d4619c17c25541f04`,
  confirmed against its final capture and analysis. The capture label states the recorded stage, sampling depth, Stage1 build and browser;
  fields absent from older captures remain unknown. Unreviewed versions remain refused.

- Stage1 0.4.0 comparisons also open: analysis 1.1.0, drift report through 1.4.0 and design tokens 1.5.0.
  The view distinguishes exact matches from separately explained values, labels the 1.4 measurement, follows
  recomputed fingerprint provenance and shows spacing and shadow signals.

## 0.4.2

Every finding the website and the 0.4.1 review reported, fixed, and the sentences that describe OODS Foundry made exact.
Nothing was removed.

**Upgrading**

- A brand made at 0.4.1 loads and renders as before. One made from the dark-minimal preset now fails `brand_create`'s
  chart grading: its light theme's series 3 and 5, inherited from brand A, measure 2.15:1 and 1.74:1 on its dark canvas.
  `brand_apply` refuses a change to it until the change sets those two colours, and says so. Making the brand again
  from the 0.4.2 preset sets them.

**Screens**

- The Tabs "More" button and the items in its menu look like tabs: no grey browser-button fill or bevel, the tab's
  secondary text that hover raises to primary, and the tab's focus ring, in light, dark and high contrast. The open menu
  floats under the button instead of pushing the tab row down. React and Vue write the same markup for it
  (`data-tabs-overflow-trigger`, `aria-current="true"` and both class families).
- A detail page no longer shows an Archive Summary that only says "Archived: No", or a Cancellation Summary that only
  says "Cancel at period end: No". The card appears once a record is archived, or has a cancellation scheduled or
  recorded. ArchiveSummary and CancellationSummary take a new prop, `hideWhenDefault`, which Archivable's and
  Cancellable's detail recipes set, in React, Vue and HTML.

**Charts**

- Line and area charts keep their rows' order on a category axis, so rows for Jan and Feb no longer draw as "Feb, Jan"
  and a rising line no longer reads as falling. Bar charts, a declared sort and a time axis keep their order, and a
  declared `sort: "none"` now compiles to the rows' order.
- An exported dashboard (`dashboard_render` with HTML) draws each Vega chart a second time at 332×180 and shows it
  below 600px, so on a phone its axis text draws at its authored size: 10px, where it drew at 5.5px. Desktop pages are
  unchanged. ECharts panels, such as the maps, still scale down with their panel.

**Brands** (`@oods/tokens`, `@oods/foundry`)

- The three presets carry chart colours made from their own recipe, 27 slots per theme beside their 69 colour roles.
  dark-minimal's charts now read at 3.87:1 to 14.95:1 on its dark canvas in its light theme too, where they started
  from brand A's light palette.
- `brand_create` grades each theme's one-series chart colour and six categorical series at 3:1 against the theme's
  canvas, beside the 84 pairs it already grades. `validate` and `create` report them under `charts`; a failing colour
  says whether the brand authored it or inherited it from brand A; and `create` refuses a brand whose chart marks would
  not read (OODS-V216).

**Guides, notices and tool descriptions** (`@oods/foundry`)

- The licence sentences say exactly what applies. OODS Foundry's code is under the Apache License 2.0. The fonts it
  bundles (Geist, Geist Mono and DM Sans) are under the SIL Open Font License 1.1, and its colour scales adapt Radix
  Colors (MIT); NOTICE carries both. What OODS Foundry generates is still yours under any terms you choose, and the
  bundled fonts stay under the SIL OFL 1.1 wherever they go.
- Generated HTML that embeds the fonts carries their copyright lines and the SIL OFL 1.1 text in its stylesheet. It
  said "see NOTICE", and a standalone page has no NOTICE beside it. A page grows by about 4 KB.
- `viz_render`'s description says the input schema refuses the retired linked-brush-scatter pattern with OODS-V001.
  OODS-V174 is what a caller that skips the schema gets.
- `code_generate`'s description says a generated application pins the @oods packages its code imports; `@oods/tokens`
  arrives through `@oods/component-styles`.
- OBJECTS-AND-TRAITS.md documents `ui_hints.format` (percent and quantity) and `ui_hints.component` (Switch,
  SegmentedControl and Combobox in generated forms). The README and QUICKSTART name `facts.json` and
  `quickstart/expected.json`.
- npm shows the package's whole description. At 284 characters, npm stored it cut at 255; it is now 249.

**Release data** (`@oods/foundry`)

- `health_check` reports 0.4.1's runtime measurement, 356 of 356 cells, stamped as measured on 0.4.1, and says it was not
  made on this build (`thisBuild: false`). 0.4.1 reported the measurement made on 0.3.0.
- A measurement's `measuredOn.sourceHead` is the commit it was measured at. The chart census is stamped in the
  release's last commit, and a commit cannot record its own hash, so the census names that commit's parent, which
  differs from it only by the stamp and `facts.json`.

## 0.4.1

0.4.0's screens and charts, polished; two new components; and the numbers people quote about OODS Foundry, shipped in the
package as data. Nothing was removed.

**Screens**

- A card's price, owner and tags sit in its body under the title and status, on the title's left edge. They were in the
  footer, which is end-aligned for actions, so they sat indented or flush right. The body no longer adds a second 24px
  inset, and a footer left empty is removed, so a card ends where its content ends.
- Ownership on a card is one phrase: "Owned by Pricing and packaging · team". With no name to show, it reads by type
  ("User-owned"). OwnershipMeta takes the owner's name in a new `ownerLabel` prop; it read "Ownership  Owner Type: team".
- A card shows its tags as pills, at most three and then "+N", as its list row does. It showed a "Tags" heading over a
  "Tag Count" row.
- An event card with no events renders nothing in React, Vue and HTML, so the "No events recorded" cards are gone.
  ArchivePill and CancellationBadge take a new prop, `hideWhenFalse`. Archivable's and Cancellable's card recipes set it,
  so a card no longer shows "Not archived" or "No cancellation scheduled"; an archived or cancelling record still says so.
- A field can declare how its number reads with `ui_hints.format`: `percent` (12.5 reads 12.5%) or `quantity` (86420
  reads 86,420). React, Vue and HTML print the same text. A number that declares nothing keeps the digits it was stored
  with. Usage's quantities read grouped and its trend with its % sign.
- Usage has a `currency` field, and each of its samples is billed in its subscription's currency, so its money reads
  €97.00, where it read a bare 0.
- HTML writes Text as a `span.oods-text`, as React and Vue do (it was a `p`), so a text row on an HTML detail page sits
  like a money row.
- An address panel on a single screen shows the record's addresses through its summary, and says "None recorded" when
  there are none.

**Charts**

- Money in a chart is money. A chart binding can carry an axis number format (`format`, a d3-format string) and a
  currency (`currency`, an ISO code), and the axis prints the currency's symbol: $, € and £. Invoice's line items and
  Subscription's payments are drawn in major units on an axis in the record's currency. They were drawn against
  0–1,000,000 "Amount (minor units)". A missing or invalid currency code fails generation; it printed "in UNDEFINED".
- A bar on a category axis is at most 48px thick and centred in its band. One line item used to draw one bar across the
  whole plot.
- No chart in the shipped objects is titled or captioned "Example" or "Synthetic". Usage's chart is "Usage readings",
  with each record's unit ("API calls") as its y axis title, through a new `titleField` on a declared binding.
- An exported dashboard's charts shrink to their panel, so at 390px the page no longer scrolls sideways.
- High-contrast bubble maps use the grey steps 05, 07 and 09. The smallest bubbles were about 1.2:1 on white.

**Components** (`@oods/components-react`, `@oods/components-vue`, `@oods/component-styles`, `@oods/component-contracts`)

- **SegmentedControl:** one choice from two to five options, drawn as joined segments, in React, Vue and HTML, at the
  button's four heights. It is native radios in a named radio group, so the arrow keys move the choice, Tab leaves the
  group, and HTML needs no script. Labels are never cut: five options at the large size need about 381px, so on a phone
  use md or smaller for five.
- **Combobox:** one value picked from a list you filter by typing, in React, Vue and HTML (HTML's behaviour is an inline
  script scoped to its element). Down opens the list and moves, Enter picks, Escape closes, and a second Escape clears; a
  disabled option is skipped. Its `name` submits the chosen value, never the typed text. It has no multiple selection,
  async loading or creatable values.
- 114 governed components (0.4.0 had 112), each with a contract, a shared scenario, a docs page and gallery rows.
- A generated form edits a field with a Switch, a SegmentedControl (an enum of two to five options) or a Combobox when
  the field's semantics ask for one (`ui_hints.component`), and a generated workflow saves the value. Booleans still
  default to Checkbox and enums to Select.
- An HTML Switch toggles on a click, a click on its label, Space and Enter.
- While a modal Dialog is open the page does not scroll, and on close its own overflow and padding come back exactly. A
  backdrop click closes it, and in HTML its close button does.

**Guides and notices** (`@oods/foundry`)

- BRANDS.md and the theming guide describe the 0.4 brand template: 103 slots in light and 96 in dark and in high
  contrast (they said 49 and 75), how to make a brand from a recipe, and the 84 pairs grading checks in each theme.
  `brand_create`'s own rules now name the control borders and the focus ring among the pairs it grades at 3:1.
- OBJECTS-AND-TRAITS.md documents `samples:`, says `object list` leaves the internal objects out unless asked with
  `includeInternal`, and names Node 24.6.0 and 22.0.0 for the team journey it reports.
- The README explains `dashboard_render`, and its brands paragraph names the recipe flow.
- The NOTICE in `@oods/foundry` carries the SIL Open Font License text and the copyright lines of DM Sans, Geist and
  Geist Mono, which the runtime it carries includes. They were only in `@oods/tokens`' NOTICE.

**Release data** (`@oods/foundry`)

- `facts.json` holds the facts people quote, each with its source: the supported platforms and clients, the install
  command, the plugin's marketplace and install commands, the MCP registry name, `artifact_certify`'s 16 accuracy rule
  codes and 16 equivalence rules, and its certified chart scopes with the census they come from. A check fails the
  build when the README or the tool's description says otherwise.
- `quickstart/expected.json` holds the hashes the documented quickstart produces: the React and Vue apps' and the
  chart's. They come from two release-candidate runs on Node 24.6.0 and 22.0.0, and the release proofs run the packed
  quickstart against them and fail on any difference.
- The runtime manifest records each library tarball's SHA-256 beside its version (`packageTarballs`).
- `health_check` says what each measurement was made on: every product-reality block carries `measuredOn` (the version,
  source head and archive it ran on), and the viz block reports its certified chart types and scopes. A measurement
  older than 0.4.1 says so.

## 0.4.0 — published 2026-09-30

The design reset: OODS Foundry's own output now looks like a product next to shadcn/ui, Radix and Geist.

**Upgrading**

- A brand made from the 0.3 brand template must be made again. The template has 103 slots for the base theme and 96
  each for dark and high contrast (0.3.3 had 49, 75 and 75), and a brand's roles now come from a recipe. Ask `brand_create` for a `template` with `from.recipe` (six
  values: neutral hue and chroma, accent hue, which hue is primary, radius and font) and it returns the complete brand,
  graded, with every adjustment it made.
- Custom properties were removed or renamed; the lists are under **CSS custom properties** below.

**Colour, type and shape** (`@oods/tokens`)

- Every hue is a 12-step scale with a job per step, in light and dark, calibrated on Radix Colors (MIT; see NOTICE).
  Brand A is neutral-first: a near-black primary, a white canvas, grey structure, an indigo accent, Geist, and 6px
  controls with 12px cards. Brand B is the same neutral with a violet primary, DM Sans, and 8px and 16px corners.
- A type scale: display 80, 64 and 48; headings 30, 24, 18 and 16; body 16/24 and 14/20; label 14/20 at 500; caption
  12/16 at 500, no longer uppercase; mono 13/20. Geist and Geist Mono ship in the package, beside DM Sans.
- Controls are 24, 28, 32 and 40px tall with 8, 10, 12 and 16px of side padding; cards have 24px padding and a border
  (no shadow); overlays have a soft shadow under their border; dark surfaces lift with rings.
- High contrast: only the primary action is Highlight on HighlightText. Every other intent is Canvas and CanvasText
  with a 1px CanvasText border, and destructive actions keep their ⚠ mark.
- Grading checks 84 pairs per theme (it checked 65): control borders at rest and hovered, the focus ring on the canvas,
  a raised panel and the primary, and text on the secondary, destructive and solid status fills.

**Components** (`@oods/components-react`, `@oods/components-vue`, `@oods/component-styles`, `@oods/component-contracts`)

- Buttons at the control heights, in six intents; neutral is the outline look.
- Badges are borderless 20px pills in the tone's tint; solid badges are the tone's solid with its own text colour.
  Status marks are OODS's own SVG icons in React, Vue and HTML.
- Status tones come from one table shared by React, Vue and HTML, now with a lifecycle table for the states objects
  use: a settled payment is green, a failed one red, a pending one blue. They were grey outside the subscription and
  invoice tables.
- Tables sit in a bordered container with a caption, muted headers and 44px rows (36 compact); fields, tabs, headings
  and panels are on the type roles.
- Switch and Dialog are new, in contracts, React, Vue and HTML: 112 components.
- The HTML renderer writes React's markup for Button, Badge, StatusBadge, Banner, Table and lists, so HTML looks the same.

**Charts**

- Each brand's charts use its own palette, from its recipe: brand A leads with indigo and brand B with violet. Marks
  keep 3:1 against their background in every theme, and dark ladders are brightest at the high end.
- A generated app's charts carry light, dark and high-contrast renders and show the one for the page's theme.
- A chart given no size fits 300px tall for up to 12 categories, with date labels level when they fit.

**Screens**

- Lists are one bordered list with hairline dividers. Each row shows the record's title over a muted secondary line,
  with its status, its amount and its time on the right.
- A detail page opens with the record's title, its status and key amount, and the actions on the right. Each section
  sits on the page or on one card, never a card inside a card.
- Cards are titled by the record, with its status and its amount.
- A timeline lists the record's own events on a rail: its history, payments, creation, archive and cancellation
  request. The "State transitions", "Archive events" and "Cancellation event" sections are gone from timelines.
- Every row button is named by the record's title for screen readers.
- An empty time reads "Unknown time" in React, Vue and HTML.

**Objects and traits**

- The 11 business objects (User, Organization, Product, Subscription, Transaction, Relationship, Article, Media,
  Invoice, Plan and Usage) carry 8 realistic sample records each, in a `samples:` list your own objects can use
  too. Generated apps and previews show them; nothing is invented.
- The 17 objects that model OODS's own research and delivery work are marked internal and left out of `object list`,
  `catalog_list`, `structured_data_fetch` and `registry_snapshot` unless you ask with `includeInternal`.
- Stateful, Archivable and Cancellable no longer declare timeline recipes, nor do Timestampable, Addressable,
  Preferenceable, Authable and Communicable. The billing traits declare their amounts for rows, headers and cards.

**Tools**

- `code_generate` says how a generated app installs its packages: from npm, at the exact versions its install block
  names. A generated workflow's `package.json` lists every package the app imports.
- The package README's Limits section states each tool's rate limit, read from the server's policy.

**CSS custom properties**

Removed from `@oods/tokens` (90):
- `--ref-color-{accent,archive,critical,info,success,warning}-{50,100,200,300,400,500,600,700,800,900,950}`: each
  family is now the 12-step `--ref-color-<family>-1` to `-12`, with `--ref-color-<family>-dark-1` to `-12`.
- `--ref-color-neutral-{0,50,100,200,300,400,500,600,700,800,900,950}`: now `--ref-color-neutral-1` to `-12` and
  `--ref-color-neutral-dark-1` to `-12`.
- `--ref-color-primary-{50,100,200,300,400,500,600,700,800,900,950}`: a brand's primary is one of its scales
  (brand A's neutral, brand B's accent); use the `--sys-*` roles, not a primary ramp.
- `--ref-typography-families-display`: display text uses `--ref-typography-families-sans`.

No longer set by `@oods/component-styles` (3):
- `--oods-button-min-block-size`: a button's height comes from its size.
- `--oods-table-cell-padding-block`: a row's height comes from its density.
- `--oods-button-padding-block`: still read (default 0), so a value you set still applies.

## 0.3.3 — published 2026-09-30

**Screens**

- Action bars follow the record's state. Cancel appears only while the record can still be cancelled, and never on an
  archived record. A workflow's archiving action says Archive (it said Delete) and is gone once the record is archived.
- A detail screen lists the object's own fields first, in the order they are written, then the fields its traits add,
  then the record's times. At 48rem and wider, a panel of read-only fields takes two columns. The quickstart's Warehouse
  opens with Code. The composer no longer wraps those fields in stacks of their own, so some detail screens fill fewer
  slots.
- A stack set to space-between spreads its children in React and Vue, as it does in HTML; they wrote the invalid
  `align-items: space-between`.
- In Vue, an action that needs input from your application is disabled, with the title "This action needs input from
  your application.", as it is in React.
- Text is set in DM Sans, which now ships in `@oods/tokens`. SortIndicator's button and a Table's row action take the
  page's font; they were the browser's own buttons, in Arial.
- High-contrast themes: secondary and muted text, status text and icons, accent text, the focus ring and focus text are
  CanvasText. They were GrayText, HighlightText or Highlight, which lose contrast when forced colours are off. Disabled
  text stays GrayText, and text on the interactive surface stays HighlightText on Highlight.
- A brand and theme set together on any element (`data-brand` and `data-theme`) theme everything inside it. A panel
  themed differently from its page kept up to 61 of the page's colour roles, so its buttons, badges and cards painted in
  the page's colours.
- HTML documents embed DM Sans. They no longer write an empty `data-intent` or `data-max-columns` attribute, so a Grid
  with no column count lays out its columns as React and Vue do; it fell back to one column. A Grid in an HTML fragment
  carries the shipped Grid rules and lays out in columns too.

**Charts**

- Facet headings (the facet title and each panel's label) take the chart's text colours. They were black, which a dark
  theme could not show.
- Points are filled, at size 60 and opacity 0.85, and lines are 2.5px wide. They were hollow rings at 0.7 opacity and
  1.5px lines. A spec's own `fill`, `size`, `opacity` or `strokeWidth` still wins.
- A chart that encodes size draws its size legend's symbols in the neutral text colour.
- The grouped-bar pattern draws each quarter's segments side by side, one panel per quarter; it drew them stacked.

**Components** (`@oods/components-react`, `@oods/components-vue`, `@oods/component-styles`, `@oods/component-contracts`)

React and Vue now render the same root element and `oods-*` classes for every component. What moved:

- Badge, and every badge built on it: Vue wraps the label in `span.oods-badge__label` and names the icon
  `oods-badge__icon` (it was `oods-badge-icon`). React no longer carries the `statusable-badge*` classes or the
  `--statusable-badge-*` variables. StatusBadge carries `oods-status-badge` in React too, and ColorizedBadge carries
  `oods-colorized-badge` in Vue too.
- Banner: Vue's root is a `div` (it was a `section`), with `oods-banner__content`, `__title`, `__detail`, `__body`,
  `__actions` and `__dismiss` (they were `oods-banner-content`, `-title`, `-detail`, `-body` and `-actions`). React no
  longer carries the `statusable-banner*` classes. The dismiss button keeps `oods-banner-dismiss`. A status icon takes
  its own column, and the title, detail, body and actions stack without paragraph margins, so React's banner no longer
  squeezes its content beside the dismiss button.
- StatusTimeline and AuditTimeline: Vue gains React's classes (`oods-timeline`, `oods-status-timeline` or
  `oods-audit-timeline`, and `__title`, `__current`, `__events`, `__event`, `__label`, `__detail`, `__actor` and
  `__reason`), and React gains Vue's `data-timeline-*` attributes.
- Table: Vue wraps the table in `div.oods-table__container`, with the part classes `oods-table__caption`, `__header`,
  `__body`, `__row`, `__header-cell` and `__cell`, and puts your attributes on the table, as React does. A caption
  renders only when it has content. React's header row carries `oods-table__row`.
- SearchInput: Vue's root is a `div` with `role="search"`; it was a `form`, which cannot sit inside yours. Enter still
  searches at once and never submits an enclosing form. The input carries `oods-search-input__control` and the clear
  button `oods-search-input__clear` in both frameworks. Vue's Input gains `inputClass`.
- DatePicker: React frames the field in `div.oods-date-picker` with `data-oods-component="DatePicker"`, as Vue does, and
  `className` and `style` apply to that frame.
- The Vue chart previews (Graph, Heatmap, Line, Mark, Point and Scatter) declare the `svgNarrow` and `svgWide` props
  their contract lists.
- `@oods/component-styles` no longer styles `.oods-banner-title` or `.oods-badge-icon`, which no component renders. It
  styles `oods-banner__icon`, `__content`, `__detail`, `__body` and `__actions`, and `oods-badge__icon` and `__label`.
  Its high-contrast rules stop at a nested panel that sets another theme.
- `@oods/component-contracts` lists a contract's composition directives (field bindings and a pattern's parts) in
  `directives`, apart from `props`: Stack's `patternComponent` and `fields`, and the `*Field` and `*Parameter` directives
  of AuditTimeline, CancellationSummary, PaginationBar, PriceBadge, RelativeTimestamp, SearchInput, StatusBadge and
  StatusTimeline. `contract-props.v1.json` records the props React or Vue declares beyond a contract.

If your stylesheet targets `.statusable-badge`, `.statusable-banner`, `.oods-badge-icon` or `.oods-banner-title`, move
it to the classes above.

**Install and dependencies**

- The runtime's `brace-expansion` moves from 5.0.9 to 5.0.12, which fixes two high-severity advisories
  (GHSA-6j4f-fj2g-mc7p, GHSA-qhr7-859c-m2p7) and a moderate one (GHSA-q2hr-2g5m-vwhr), published after 0.3.2's release
  check; 0.3.2's runtime carries 5.0.9. See SECURITY.md.

**Tokens**

- DM Sans ships in `@oods/tokens` under the SIL Open Font License 1.1, loaded by an `@font-face` rule in `tokens.css`
  from beside the stylesheet, never from the network. A bundler must emit `.woff2` files: Vite does, esbuild needs
  `--loader:.woff2=file` and webpack an asset rule.
- The high-contrast colours, and the restated custom properties that let any element carry a theme, are described in
  the `@oods/tokens` changelog.

**Tools**

- `brand_create` grades high-contrast pairs of system colours as Chromium resolves them without forced colours (macOS
  and Linux, light and dark); a pair passes only if it passes in all four. It no longer reports them exempt:
  `contrast.hc` names `systemColoursResolvedIn`, and a failing issue names its resolutions. A brand of yours whose
  high-contrast theme puts GrayText or HighlightText text on Canvas is now refused; move those slots to CanvasText, as
  the quickstart's Harbor brand did (15 slots).
- `catalog_list` labels its `propSchema` as the HTML renderer's (`propSchemaTarget: "html"`) and adds `propTypes`: each
  component's React and Vue props, read from the published type declarations.
- `design_preview`'s `measured.notMeasured` names every scope the page can be measured in: each brand the server
  renders and the preview's own brand, in light, dark and hc. It named brands A and B only, so a brand of yours never
  appeared. The preview's measurement panel shows a brand of yours as well.
- `a11y_scan`'s description says what it checks: every text and icon pair the component stylesheet declares, at 4.5:1
  for text and 3:1 for icons, in every built brand and theme, and, given a UiSchema, the rendered screen's document
  rules. It described an older check of 18 fixed token pairs.
- `structured_data_fetch` reads capture runs whose manifest is schema version 1.0.0 through 1.6.0 (it read 1.0.0 only)
  and refuses later ones. A suite's root manifest, which records its target runs, is refused with the path of those
  runs, instead of being read as its first target.
- A comparison of a capture counts every live font size with no design match: "16 of 18 live font sizes have no design
  match: 14 match no size the design declares for their typeface, and the 2 set in Merriweather Web had no design size to
  compare with." It said 14 of 18. One such size reads "1 font size needs review".
- An MCP app view cannot fetch font files, so its text falls back from DM Sans; the `tokens.json` it loads names the
  hash of the CSS it carries.

**Generated apps**

- Code generated around a component of yours declares `__Mapped<Name>`, `__Contract<Name>`, `__mappedProps`,
  `__vueDefineComponent` and `__vueH`. It named them after the product (`__ForgeTeam<Name>`, `__ForgeContract<Name>`,
  `__forgeTeamProps`, `__forgeDefineComponent`, `__forgeH`).
- The quickstart's example team buttons take the page's font.

**Objects**

- The capture objects (Run, Finding, CapturedArtifact, Comparison and ComparisonSignal) describe themselves without
  naming internal tools. Four of Run's sample runs use neutral stand-ins (`app.example.com`), sample ids read
  `capture-…`, and sample provenance reads "Capture tool". Their fields are unchanged.

**Documents and package metadata**

- The package description, the Claude Code plugin, its marketplace, the MCP registry entry and the skill open with
  "OODS Foundry is the object-oriented design system that builds your screens from your objects." The keyword
  `agentic-design-system` is dropped.
- The component reference pages list a contract's directives on their own row.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.3.

## 0.3.2 — published 2026-09-29

**Screens**

- A Subscription's payment chart draws one bar per recorded payment on an axis of payment dates, instead of one solid
  block.
- New billing terms on an active Subscription start a new billing period at the change, with its payment due and
  pending, so the price, the billing cycle, the payment dates and the chart agree. A cancellation at period end
  records the request and drops the renewal.
- A timeline given no events lists the record's own events, instead of "No events yet" above them.
- The archive badge reads Archived or Not archived instead of a raw `false`. Pricing terms on cards read in words
  ("One Time").
- One Subscription definition ships, `objects/core`; `health_check` no longer reports a duplicate.

**Install and dependencies**

- Node.js 22.0.0 or newer is required; it was 20.11.1. Style Dictionary 5, which the token build now uses, needs it.
  On an older Node, the launcher says so in one sentence before it unpacks anything.
- The token build uses Style Dictionary 5.5.5 and `@tokens-studio/sd-transforms` 2.0.3 (they were 4.4.0 and 1.3.0).
  The runtime no longer ships the three packages with high-severity advisories that 0.3.1 carried; see SECURITY.md.
- A token transform that fails now fails the build, so no brand is built with a value its transform never produced.
- Built tokens, your brands' included: the sans and display font stacks name "Helvetica Neue" and "Times New Roman"
  correctly (0.3.1 quoted them twice, so those fallbacks never matched). Transition timing functions hold their values
  instead of referencing the easing tokens, so a stylesheet that overrides `--oods-motion-easing-*` no longer changes
  them. The `@oods/tokens` JavaScript and Tailwind exports carry a `key` on each token and drop five entries that held
  no token; see the `@oods/tokens` changelog.

**Generated apps**

- `code_generate`'s install block installs the `@oods` libraries from npm at exact versions. The steps that packed them
  from the runtime are gone, with the `directory` and `tarball` fields of each package entry. An application's
  package.json pins every package, so `npm install` fetches them.

**Documents and package metadata**

- The documents call the product OODS Foundry, and their license, notice and version links work from npm and follow
  the release.
- The README documents the published Claude Code plugin and MCP registry entry, installs the package before copying the
  skill, and says where mappings are kept: `~/.oods-foundry/mappings`, `OODS_MAPPINGS_DIR` and `MCP_MAPPINGS_PATH`.
- Every package has a homepage, a support email, a description and keywords.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.2.

## 0.3.1 — published 2026-09-27

- The quickstart's Warehouse example shows its authored opening history, dates, manager email and organization.
- Generated apps use the brand's typeface, as the preview does.
- Subscription and Transaction samples are coherent, references show readable labels, the DatePicker keeps its required
  behaviour, and Subscription's meter, history, empty chart and currency help are fixed.
- The `oods-foundry` agent skill ships in the package at `skills/oods-foundry/`, alongside a Claude Code plugin and an
  entry in the official MCP registry, `com.oods-foundry/foundry`.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.1.

## 0.3.0 — published 2026-09-26

- Transaction screens say “Cancel record”; subscription cancellation keeps its subscription-specific meaning.
- Generated prices use currency minor units and useful deterministic samples. Explicit zero values remain zero.
- References use declared display labels when available. Missing labels stay unavailable; technical details retain
  the original IDs, and edits and actions keep those IDs intact.
- Dashboard tabs use meaningful labels, chips agree across React and Vue, narrow lineage timestamps fit, and billing
  meters show the consumed portion consistently across light, dark and forced-colors modes.
- Single-series charts use a governed muted blue in light and dark themes. Caller colors and multi-series palettes
  remain intact; forced-colors uses system paint.
- The package adds the public homepage, support contact and discovery keywords. Certification documentation reflects
  the measured 13 chart types and 78 brand/theme scopes, with high-contrast contrast grading explicitly exempt.
- Bring your own tokens, objects, traits and React/Vue component implementations using the shipped quickstart.
- Generate data-bound HTML screens, object relationship diagrams and screen wireframes as well as React/Vue apps.
- The default MCP surface has 19 tools. Four former tools are removed: `billing.reviewKit`, `billing.switchFixtures`,
  `release.tag` and `diag.snapshot`. Update clients that called those tools before upgrading.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.0.
- Preview was observed in the MCP Apps SDK basic-host with an explicit UI override. Claude Desktop and Cursor remain
  untested. See the README for the measured preview, chart, HTML and accessibility limits.

## 0.2.0 — published 2026-09-23

The first version installed from npm, and the first under the name OODS Foundry.

**Install**

- Every client starts it with `npx -y @oods/foundry` and registers it as `oods-foundry`. The first start unpacks the
  runtime once into `~/.oods-foundry/runtime/`.
- Your saved schemas, composed versions and file-mode output are kept in `~/.oods-foundry`, so they survive upgrades.
- The runtime archive, `oods-foundry-runtime.tar.gz`, is still available for installing without a package manager.

**See the work**

- `design_preview` opens the generated React or Vue app running, under brand, theme and width controls, with the
  lineage, versions and measurements one toggle below it. Claude Desktop (with Developer Mode on) and Cursor 2.6 and
  later show it inside the conversation.
- Every composition keeps its versions. You can edit one (reorder regions or fields, swap a component, reseed the
  sample data), compare two versions side by side, and accept one.
- The generation receipt, chart certification and accessibility results sit beside the running app, and anything not
  measured says so.

**Screens**

- Screens share one left edge. Subscription detail leads with its status and price, then its actions as design-system
  buttons, and its chart is drawn from the record on the page.
- A small bar chart is landscape, with horizontal labels when they fit.
- Tabs keep each label whole on a phone.
- New objects for delivery work (Decision, Sprint, Session), a followed cohort (Person, Cluster) and captured runs
  (Run, Finding, CapturedArtifact, Comparison, ComparisonSignal). Records OODS Foundry only reads get read-only screens.

**Answers**

- The tool list shows each action's own arguments for `schema_render`, `schema_store`, `object_registry` and `component_map`.
- `health_check` reports the release version.
- A `schema_render` render without `apply: true` says it was a dry run and how to get the HTML.
- A dotted tool name such as `design_compose` gets a hint to use `design_compose`.
- `catalog_list` answers with a brief list by default: name, categories and one readiness label per component.
- A generated app's result says where its `@oods` packages come from and how to install them.

**Security**

- The local servers refuse requests that name a foreign host.
- Apache ECharts 6.1.0 fixes a moderate cross-site scripting issue (see SECURITY.md).
- Chart specification addresses (`$schema`, `$id`) moved to `https://oods-foundry.com/`. They are identifiers; nothing
  is fetched from them.

## 0.1.0 — 2026-09-15

The first release, as a runtime archive downloaded and extracted by hand. It composed screens from an object and a
context, generated React, Vue and HTML, rendered charts and dashboards from your data, and certified charts against
accuracy, accessibility, contrast and determinism rules.
