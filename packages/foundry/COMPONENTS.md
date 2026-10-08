# Your own components

OODS Foundry supports your own components by **substitution** in React and Vue. A mapping says which implementation replaces
one shipped OODS Foundry component. Composition keeps using OODS Foundry's component ids and traits; generation imports your implementation,
and the preview bundles it. New components beyond the shipped catalog are not supported.

## Map an implementation

Install or unpack your component package outside the runtime. Give `component_map` a shipped component id (from `catalog_list`),
its exact package version and export, and translations for any props whose names or values differ. For example:

```json
{
  "action": "create",
  "apply": true,
  "externalSystem": "my-team",
  "externalComponent": "TeamButton",
  "oodsTraits": ["Stateful"],
  "substitution": {
    "component": "Button",
    "react": {
      "package": "@my-team/components/react",
      "version": "1.0.0",
      "export": "TeamButton",
      "localPath": "/absolute/path/to/my-team-components",
      "props": {
        "content": { "name": "caption" },
        "intent": { "name": "appearance", "values": { "neutral": "quiet", "primary": "prominent", "danger": "danger" } }
      }
    }
  }
}
```

Add a `vue` entry with the same shape for Vue. Untranslated props, children/slots and event handlers pass through.
Set `passthrough: false` to drop unlisted optional props; every required OODS Foundry prop then needs a translation. An unknown
OODS Foundry component or prop, or an uncovered required OODS Foundry prop, is reported before a mapping is saved. The team's component still has to implement the
expected semantics; translating a name does not establish compatibility.

The launcher defaults mappings to `~/.oods-foundry/mappings/component-mappings.json`. `OODS_MAPPINGS_DIR` selects another
folder; the existing `MCP_MAPPINGS_PATH` selects a file and takes precedence. Team traits resolve from your trait folder.
Mappings and local packages belong outside the unpacked runtime so upgrades and readiness checks leave them intact.
`localPath` must be absolute and point at the package root. Without it the preview looks for an installed package. The
package manifest's name/version must match, and its export must resolve. Local paths are not emitted into consumers.

### Map several at once

A checked mapping file contains a `mappings` array. Each entry has the same fields as the single call above, without
`action` or `apply`:

```json
{
  "mappings": [
    {
      "externalSystem": "my-team",
      "externalComponent": "TeamButton",
      "oodsTraits": ["Stateful"],
      "substitution": {
        "component": "Button",
        "react": {
          "package": "@my-team/components/react",
          "version": "1.0.0",
          "export": "TeamButton",
          "localPath": "/absolute/path/to/my-team-components",
          "props": { "content": { "name": "caption" } }
        }
      }
    }
  ]
}
```

Call `component_map` once for the file:

```json
{"action":"create","mappingsPath":"/absolute/path/to/mappings.json","apply":true}
```

You can instead pass the array as `mappings` in that call. Omit `apply` to check every entry without saving it.
The response lists each entry's zero-based `index`, generated `id`, validation `status` and whether it was `applied`.
All entries must pass before anything is written: mapping ids must be distinct; each shipped component can be
substituted only once across the list and the existing store; all component and prop checks still apply. With
`localPath`, the package manifest must match the package name and exact version, and its entry file must statically
export the named identifier. OODS Foundry reads these files without running package scripts. An invalid entry is
named with `OODS-V219`; no entry is saved. A valid list is saved in one atomic write.

The package ships `quickstart/team-components/mappings.json`, the Harbor walkthrough's Button mapping in this
file shape. Copy the example set to your workspace and replace both `<team-components>` values with that folder's
absolute path before calling `component_map`. The placeholder is documentation, not a path that the tool expands. Your own
file uses your package names, exact versions, exports and prop translations.

## Compose, preview and generate

Use `design_compose` or `design_preview` with your object as usual. Only components present in the screen are replaced.
A preview records package content hashes and freezes compiled output per version; reopening an explicit version retains
its original bytes. Opening the latest version after package bytes change creates a new version. Missing or unbundleable
packages produce `OODS-V217`. Package CSS can be inlined, but external CSS assets, unsafe paths and symlinks are refused.

`code_generate` imports the mapped package and declares its exact dependency version. Set `options.output` to
`"application"` for a single screen with a package manifest, entry, HTML and Vite configuration. The default remains a
component. Follow the response's install block: the `@oods` libraries install from npm at exact versions, and a team
package from your registry, or from its own tarball or folder when it is not on one. Then run `npm run build` and
`npm run dev`.
No package is published by generation. Sample data is labelled, and actions needing your application show an integration
notice; wire your data, navigation and persistence handlers before shipping.

## shadcn/ui

A React project using shadcn/ui's **Radix or Base UI base and Tailwind 4** can map its own copied components. Keep `components.json`, the TypeScript path aliases, the CSS entry, and the installed dependencies in the project. The base is read from `components.json`: supported bases are Radix (`radix-*`, legacy `new-york` and `default`) and Base UI (`base-*`). React Aria (`aria-*`) and unknown styles are refused at map creation with OODS-V219 naming the style found and these supported bases. Vue projects on shadcn-vue / Reka UI use the Vue adapters below.

Start in an existing shadcn project. For a fresh trial, create the project first, in an empty working folder. This selects Vite with Radix:

```bash
npx shadcn@4.21.1 init --template vite --base radix --preset nova --name team-app --no-monorepo --no-rtl -y
cd team-app
```

Or use the CLI's defaults, Next.js with Base UI:

```bash
npx shadcn@4.21.1 init --defaults --name team-app --no-monorepo -y
cd team-app
```

From the shadcn project, install OODS Foundry locally. Connecting the MCP server with `npx` does not install a package into that project, and the next command needs its registry files:

```bash
npm install @oods/foundry@0.10.2
```

Install the sixteen adapters from that package in one call:

```bash
npx shadcn@4.21.1 add ./node_modules/@oods/foundry/shadcn/oods-button.json ./node_modules/@oods/foundry/shadcn/oods-card.json ./node_modules/@oods/foundry/shadcn/oods-status-badge.json ./node_modules/@oods/foundry/shadcn/oods-tabs.json ./node_modules/@oods/foundry/shadcn/oods-select.json ./node_modules/@oods/foundry/shadcn/oods-search-input.json ./node_modules/@oods/foundry/shadcn/oods-pagination-bar.json ./node_modules/@oods/foundry/shadcn/oods-banner.json ./node_modules/@oods/foundry/shadcn/oods-input.json ./node_modules/@oods/foundry/shadcn/oods-textarea.json ./node_modules/@oods/foundry/shadcn/oods-checkbox.json ./node_modules/@oods/foundry/shadcn/oods-date-picker.json ./node_modules/@oods/foundry/shadcn/oods-tag-input.json ./node_modules/@oods/foundry/shadcn/oods-status-selector.json ./node_modules/@oods/foundry/shadcn/oods-card-header.json ./node_modules/@oods/foundry/shadcn/oods-price-badge.json -y
```

Copy `shadcn/mappings.json` from that package into your workspace:

```bash
cp node_modules/@oods/foundry/shadcn/mappings.json ./oods-mappings.json
```

Replace every `<shadcn-project>` in the copied file with your project's absolute path. If the project's component alias differs from `@/components`, edit the sixteen `module` values to match the paths the CLI wrote. Apply the file in one call, substituting the copied file's absolute path:

```json
{"action":"create","mappingsPath":"/absolute/path/to/team-app/oods-mappings.json","apply":true}
```

Each React implementation uses this source form instead of `package`, `version` and `localPath`:

```json
{"shadcn":{"project":"/absolute/path/to/team-app","module":"@/components/oods/button"},"export":"OodsButton"}
```

Create and substitution-changing updates check the named export, local imports, aliases, CSS entry, Tailwind version and installed bare dependencies without executing the component. Dependencies resolve from the importing file, through the project’s installed package layout. Tailwind 4 accepts either @tailwindcss/vite or @tailwindcss/postcss. Updating only notes, confidence or oodsTraits does not need the source project. Use `design_compose`, `design_preview` and `code_generate` as above. Preview compiles the project's Tailwind and theme; changes to mapped source files, their imports, configuration or CSS create a new latest version. Unrelated project files do not. Explicit old versions retain their compiled output.

Component output imports the project's module. React output begins with `'use client'`, so Next.js App Router can mount it. Place its files in the project, supply its declared props and action callbacks, and set the surrounding container's `data-brand` and `data-theme` for the chosen OODS brand and theme. For dark, that ancestor needs both `data-theme="dark"` and `class="dark"`. In hc the team's parts keep their light palette because shadcn has no hc theme. Application output remains a Vite application, including when the source project uses Next.js. It copies the needed source files, local assets and CSS, configures aliases and Tailwind, and pins dependencies to their installed versions. The emitted metadata records the base and style, project-relative paths and closure hashes, with no absolute project path. React and Vue mappings apply to their own framework. Single-screen and routed workflow applications both copy the checked source closure. HTML keeps OODS components; a mapping missing the requested framework reports `OODS-V218`. See [BRANDS.md](./BRANDS.md) to derive an OODS brand from the same CSS theme.

The proven project layouts are npm + Vite, pnpm's isolated linker + Vite, a hoisted npm workspace, and npm + Next.js App Router, measured on 0.6.0. The two committed fixtures use shadcn CLI 4.21.1: Vite with Radix and Next.js with Base UI. Their generated screens pass each project's own production build, measured on 0.7.0. Yarn PnP, Bun and a Turbopack-only development server are not proven. <!-- history -->

CSS derivation reports font gaps when Next.js supplies the font variables through `next/font`. Fill those recipe fields from your project's declared font families before creating the brand. Generated Vite apps copy CSS-referenced local assets; they do not copy font assets generated by the Next.js build.

### From the mapped project to a running screen

Keep these calls in the same MCP session. The CSS entry is `tailwind.css` in your project's `components.json` (the Vite example uses `src/index.css`; the Next.js example uses `app/globals.css`). Call `brand_create` with its absolute path:

```json
{"action":"derive","cssPath":"/absolute/path/to/team-app/src/index.css"}
```

Read `gaps` and complete the returned `recipe` with your team's choices before `validate` and `create`, as [BRANDS.md](./BRANDS.md) describes. A neutral shadcn theme has no accent hue to derive: choose one explicitly. For a trial, `accentHue: 262` is an example choice, not a colour inferred from that theme. A default Next.js project declares Geist and Geist Mono in `app/layout.tsx`; those family names can fill its font gaps. Replace `<completed recipe>` below with the complete JSON object, not a string, and choose an unused brand id:

```json
{"action":"validate","brand_id":"Teambrand","recipe":"<completed recipe>"}
```

After `valid: true`, create it:

```json
{"action":"create","brand_id":"Teambrand","recipe":"<completed recipe>"}
```

Call `design_compose` for a shipped object, for example the Plan form, and retain its `compositionId`, `version` and `schemaRef`:

```json
{"object":"Plan","context":"form","preferences":{"brand":"Teambrand","theme":"light"}}
```

Call `design_preview`, substituting that id and version, then open its React `appUrl`:

```json
{"compositionId":"<compositionId>","version":1,"framework":"react"}
```

Call `code_generate` with the returned schema reference:

```json
{"schemaRef":"<schemaRef>","framework":"react","profile":"build","options":{"output":"application","brand":"Teambrand","theme":"light","payloadMode":"file"}}
```

Copy the files from `payload.directory` into a fresh app folder. They include the mapped source, CSS, assets and exact dependency versions. From that folder, run:

```bash
npm install
npm run build
npm run dev
```

Open the local URL Vite prints and compare it with the preview. This is a Vite app even when the mapped source project is Next.js. To integrate a component into the original project instead, use component output and the props and action contract described above.

The adapters preserve the data-driven OODS props. They use `data-oods-adapter` markers so OODS component CSS does not override the team's shadcn styles. The contract report still lists each obligation as met, unmet or not checked, with a reason; the adapter is not a claim of complete component equivalence. These differences are also named in each registry item's description:

| Adapter | Explicit limits |
| --- | --- |
| Button | Danger/destructive uses solid `bg-destructive text-background`, including hover and dark, from the team's own tokens. Primary preserves the team's `primary`/`primary-foreground` token pair. Success and warning intents use the secondary variant; there are no separate success/warning palettes. |
| Card | A semantic `as` element wraps the shadcn Card. |
| StatusBadge | OODS supplies status labels and icons. Critical/danger uses destructive with solid `bg-destructive text-background` in light and dark; other tones use default or secondary, without separate status colours. `compact` and `readOnly` retain OODS's no-op behavior. |
| Tabs | The list scrolls horizontally; `overflowLabel` and the OODS overflow menu are not implemented. |
| Select | The visible control is a shadcn combobox. A hidden native select keeps form values and native change events. Use `options`; native option children, `multiple`, native `size` and native-select keyboard behavior are unsupported. |
| SearchInput | Value, debounce, minimum query length and clear events retain their meanings. |
| PaginationBar | Page links are anchors; disabled links prevent navigation and leave the tab order. |
| Banner | Critical/danger uses solid `bg-destructive text-background`; its description inherits the foreground. Other tones use the team's default Alert palette; separate success/warning/info colours and solid emphasis are unsupported. |
| Input | Native input props, datetime-local normalization, label, help, validation and value callbacks keep their meanings; density uses team spacing rather than OODS pixel dimensions. |
| Textarea | Native textarea props, the four-row default, label, help, validation and value callbacks keep their meanings; density uses team spacing rather than OODS pixel dimensions. |
| Checkbox | The team checkbox is visible. A visually hidden native checkbox preserves the input ref, native onChange and form values. Other native input event handlers apply to that hidden input; density is metadata only. |
| DatePicker | A native date input plus the team's Calendar, Popover and Button keeps min, max, step, disabled and readOnly. pickerClassName and pickerStyle apply to the native input; density is metadata only. |
| TagInput | Keeps text-value callbacks and the displayed tag list, including record labels and authored children. The OODS contract does not create or remove tags, so the adapter adds no tag mutation API. |
| StatusSelector | Keeps status/value, normalized options/states, authored children, help and native change callbacks. Keyboard interaction follows the team's combobox instead of a native select. |
| CardHeader | Keeps the semantic header, heading level/as, title aliases, scalar/authored children and supporting copy without duplication. The team CardTitle and CardDescription supply the visual parts. |
| PriceBadge | Keeps amount/currency precedence, currency minor units, label/children/value fallback and emphasis. Binding metadata props field, amountField, currencyField, intervalField and minorUnitsParameter retain OODS's no-op behavior. |

The sixteen adapters cover every generated-screen primitive with a direct shadcn counterpart in the 0.5.0 census of 60 screens: the 11 shipped business objects and the Warehouse example object, each in detail, list, form, timeline and card. Stack, Text, DetailHeader, RelativeTimestamp, StatusTimeline, LabelCell and TimelineEntryLabel stay OODS because they have no direct shadcn counterpart. Trait panels and editors also stay OODS: substitution replaces a component imported by the generated screen, not the components used inside an OODS panel. <!-- history -->

## What the report means

Mapped components carry `component-contracts.json` in the generated artifact and reports in the preview's Measurements.
OODS Foundry runs its shared scenarios through the actual generated prop adapter when a browser is available to the preview
host. It uses an installed Chromium browser, `OODS_CONTRACT_BROWSER_EXECUTABLE`, or `OODS_PLAYWRIGHT_WS_ENDPOINT`; it does
not download a browser. Every declared obligation is **met**, **unmet** or **not checked**, with a reason. Unsupported
probes and unavailable browsers remain not checked. Warnings (`OODS-V218`) are advisory and do not refuse generation.
A passing subset is not full compatibility, accessibility certification or a claim about every state of a component.

A run of the npm package, measured on 0.10.0, covers the bundled test team's Button and StatusBadge in Warehouse screens in both frameworks and three themes. Separate browser checks, measured on 0.2.1, cover its Input and deliberately broken Button. Material UI, Ant Design and Chakra UI are not proven by these fixtures; a library needs its own adapter and its own proof. <!-- history -->


## Draft mappings from local files

`component_map` can inventory a shadcn project or a built Storybook without running its code, resolving installed dependencies, or fetching anything. Supply an absolute project folder; every source path must stay inside it. JSONC TypeScript paths and project-relative config inheritance are read statically. A Nuxt layout needs its generated paths present inside the supplied folder. Symbolic links in source files are refused.

```json
{"action":"draft","source":{"format":"shadcn","project":"/absolute/team-app"},"externalSystem":"team"}
```

The reply gives a `draftId`, source content hash, mapping proposals, counts and warnings. Call `show` with that id to review every component, prop and story, each either proposed or unmatched with a reason. Matching uses typed props, native elements, primitive imports and variant sets. A name alone never selects a contract. Imported/generic prop types that cannot be expanded from the defining file are retained as unmatched prop groups; individual members are not invented. Shadcn proposals stage the shipped adapter needed to translate the team's primitive into the OODS contract; `show` includes its exact contents and limitations. No team file or active mapping changes during drafting.

Call `show`:

```json
{"action":"show","draftId":"components-<sha256>"}
```

Then call `apply` with the proposal ids you accept:

```json
{"action":"apply","draftId":"components-<sha256>","accept":["mapping-<proposal-id>"]}
```

Accept exact proposal ids after review. Apply checks the source hashes again, writes only reviewed new adapter files, and runs the existing mapping validator against the installed project. Missing dependencies or any invalid mapping roll back the adapter files and leave the mapping store unchanged. Existing adapters with different contents are reported for manual review and never overwritten. A component keeps one mapping owner: a complementary React or Vue implementation can join that owner; an existing implementation requires an intentional `update` to replace it.

For a built Storybook, use `{"format":"storybook","project":"/absolute/library","storybook":"storybook-static"}`. The reader inventories `index.json` and, when present, `manifests/components.json`, including React docgen source paths and props. Defining source files must be within the supplied project; absolute paths from another build machine, missing definitions and unsupported manifest shapes are reported. Names and docgen declarations without defining source remain inventory evidence. A structural match drafts a package substitution using the project's package name and version; apply verifies its built export. Storybook's manifest format is still in preview, so unmatched entries remain visible rather than being guessed.

A draft is evidence for review, not behavioral conformance. Generate and preview the accepted mappings and read their existing contract reports. Component substitutions need no trait annotation; an empty `oodsTraits` list is accepted only when the mapping supplies a substitution.

### shadcn-vue / Reka UI

Use `component_map` draft/show/apply on the installed project as described above. The reader recognizes `https://shadcn-vue.com/schema.json` and the `typescript` flag, including `reka-*`, legacy `new-york` and `default` styles. Vue proposals use `.vue` modules with `export: "default"`; an accepted Vue proposal joins the same mapping that owns the React implementation. Review the full draft before accepting its proposal ids.

The package ships the same sixteen adapters under `shadcn/vue/`. To install an item manually from your project:

```bash
npx shadcn-vue@2.8.2 add ./node_modules/@oods/foundry/shadcn/vue/oods-button.json -y
```

Other item names match the React list. The Vue mapping template is `shadcn/vue/mappings.json`; replace `<shadcn-vue-project>` and adjust aliases if needed. Do not create a second mapping for an OODS component already owned by a React mapping: the reviewed intake flow merges the complementary framework for you.

Vue adapters preserve the shipped Vue model updates and emitted events. Their item descriptions state limits: Tabs scrolls instead of showing an overflow menu; Select/StatusSelector use Reka combobox interaction and preserve empty reset options, including their labels and empty submitted values; DatePicker uses the team's native date Input, matching the Vue contract; Checkbox uses Reka's checkbox button and boolean model events; TagInput does not create or remove tags. Vue text fields update their model on input and emit native change on commit/blur. Shared probes that require a native select/checkbox target or React's per-keystroke change semantics can report unmet obligations; inspect the report rather than treating mounting as full contract conformance. The team palette supplies noncritical status colours. Danger uses solid destructive/background tokens in both themes.

The Vue layout proof covers npm + Vite, installed TypeScript, project-relative TypeScript aliases, and inline SFC scripts/templates with styles in `tailwind.css`. SFC `<style>` blocks and external script/template blocks are explicitly refused by the source inspector. Nuxt-generated aliases, Yarn PnP and Bun are not covered by this Vue proof. CSS imports must resolve locally for preview; replace remote font imports with local font assets. The draft reader never fetches or runs project code. After acceptance, preview compiles the checked SFCs and the installed Tailwind theme; portable Vue apps keep both Vite's Vue plugin and Tailwind. Vue and its server renderer are pinned together from the team installation. The app retains `skipLibCheck: true` only when all mapped projects explicitly enable it; generated source remains strict.

### Versioned registry URLs

The release's public snapshot serves these files directly; no website deployment is required. The two catalogs are `packages/foundry/shadcn/registry.json` and `packages/foundry/shadcn/vue/registry.json`. After v0.10.0 is published, a version-pinned item can be installed by URL:

```bash
npx shadcn-vue@2.8.2 add https://raw.githubusercontent.com/kneelinghorse/OODS-Foundry/v0.10.0/packages/foundry/shadcn/vue/oods-button.json -y
```

For React, use `shadcn@4.21.1` and omit `/vue` from the URL. The same items remain available locally in the npm package. React Aria remains unsupported: its onPress/isDisabled and render-prop APIs require separate adapters and proof; the Radix/Base adapters are not compatible with it.
