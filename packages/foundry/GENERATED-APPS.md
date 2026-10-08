# Maintaining generated apps with OODS Foundry

A new generation returns a complete set of files. For application and workflow output, that set is a complete new app; component output is a screen to import into your app. Generation merges nothing into your app, detects none of your edits, and does not update a folder you previously copied into your project.

With `options.payloadMode: "file"`, `code_generate` writes beside the saved-schema store, under `payloads/code.generate-<12 hex>/`, and returns that directory. Different emitted content gets a different folder. Identical output reuses the same folder and overwrites its generated files without an edit warning. A definition change that does not affect emitted content can therefore reuse the folder. Treat these payload folders as outputs to copy from, not places to develop your app. The default inline mode returns the artifact and its files in the tool response instead.

Use one version of the OODS packages together. Apps that `@oods/foundry` generates pin the tested 0.6.2 set of OODS libraries; keep those pins unless you upgrade all of them together. A newer `@oods/foundry` release does not move them by itself; they move only after the libraries are tested again. <!-- history -->

## File ownership

These are working rules for your copy; the generator does not enforce them, record ownership in `artifact.json`, or add “do not edit” headers.

- **Replaced** means never edit the file in your app: replace it whole when accepting a new generation.
- **Starting point** means copy it once and make it yours. Review later generated versions for needed changes; do not blindly copy them over your version.

The tables cover TypeScript React and Vue output for the [QUICKSTART](QUICKSTART.md) Warehouse, with default styling, the shipped brand, and no team component substitutions. `Both` means the same path exists for React and Vue. Each table includes `artifact.json`, the sidecar written in file mode; inline mode returns that object rather than a separate file.

### Component

Compose a single context such as `detail`, then call `code_generate` with `framework: "react"` or `"vue"`; `options.output: "component"` is the default.

| Framework | File | Role | Purpose |
| --- | --- | --- | --- |
| React | `src/GeneratedUI.tsx` | Replaced | Screen, props and action contract. |
| Vue | `src/GeneratedUI.vue` | Replaced | Screen, props and action contract. |
| Both | `artifact.json` | Replaced | Original generation's files, hashes, dependencies and actions. |

### Application

For a single screen, set `options.output: "application"`. The app supplies sample data and placeholder action handlers; these handlers show a notice and do not save or delete records.

| Framework | File | Role | Purpose |
| --- | --- | --- | --- |
| React | `src/GeneratedUI.tsx` | Replaced | Screen, props and action contract. |
| Vue | `src/GeneratedUI.vue` | Replaced | Screen, props and action contract. |
| React | `src/App.tsx` | Starting point | Sample props and action handlers. |
| Vue | `src/App.vue` | Starting point | Sample props and action handlers. |
| React | `src/main.tsx` | Starting point | Browser entry. |
| Vue | `src/main.ts` | Starting point | Browser entry. |
| Both | `src/app.css` | Starting point | App layout and sample notice styles. |
| Both | `index.html` | Starting point | Document and default brand/theme. |
| Both | `package.json` | Starting point | Exact package versions and build commands. |
| Both | `tsconfig.json` | Starting point | TypeScript configuration. |
| Both | `vite.config.mjs` | Starting point | Build configuration. |
| Both | `README.md` | Replaced | Instructions for the generated sample. |
| Both | `artifact.json` | Replaced | Original generation's files, hashes, dependencies and actions. |

### Workflow

Compose `context: "workflow"`, then call `code_generate` for React or Vue. There is no `output: "workflow"` option: a workflow schema always emits an app with list, detail, form and timeline screens. Its sample store and actions implement a local workflow; they are starting points for your application services.

| Framework | File | Role | Purpose |
| --- | --- | --- | --- |
| React | `src/screens/List.tsx` | Replaced | List screen and props. |
| Vue | `src/screens/List.vue` | Replaced | List screen and props. |
| React | `src/screens/Detail.tsx` | Replaced | Detail screen and props. |
| Vue | `src/screens/Detail.vue` | Replaced | Detail screen and props. |
| React | `src/screens/Form.tsx` | Replaced | Form screen and props. |
| Vue | `src/screens/Form.vue` | Replaced | Form screen and props. |
| React | `src/screens/Timeline.tsx` | Replaced | Timeline screen and props. |
| Vue | `src/screens/Timeline.vue` | Replaced | Timeline screen and props. |
| Both | `src/actions.ts` | Replaced | Shared action interface and contract digests. |
| React | `src/App.tsx` | Starting point | Screen selection, props and actions. |
| Vue | `src/App.vue` | Starting point | Screen selection, props and actions. |
| Both | `src/application.ts` | Starting point | Navigation, workflow state and action implementations. |
| Both | `src/store.ts` | Starting point | Record types, data projection and local sample store. |
| Both | `src/sample-data.ts` | Starting point | Authored examples used by the local store. |
| React | `src/main.tsx` | Starting point | Browser entry and hydration. |
| Vue | `src/main.ts` | Starting point | Browser entry and hydration. |
| React | `src/ssr.tsx` | Starting point | Server rendering entry. |
| Vue | `src/ssr.ts` | Starting point | Server rendering entry. |
| Both | `src/app.css` | Starting point | App shell styles. |
| Both | `index.html` | Starting point | Document and default brand/theme. |
| Both | `package.json` | Starting point | Exact package versions and build commands. |
| Both | `tsconfig.json` | Starting point | TypeScript configuration. |
| Vue | `vite.config.mjs` | Starting point | Vue build plugin; React workflow emits no Vite config. |
| Both | `README.md` | Replaced | Instructions for the generated sample. |
| Both | `artifact.json` | Replaced | Original generation's files, hashes, dependencies and actions. |

### Conditional files

Other inputs add files. Use the actual returned file list for your generation. These are also **Replaced**, in either framework; carry them with the screens that use them.

| When | File | Role | Purpose |
| --- | --- | --- | --- |
| Placed charts (empty payment history emits only the three size files) | `src/charts/<record>.svg`, plus `.narrow.svg`, `.wide.svg`, `.dark.svg`, `.dark.narrow.svg`, `.dark.wide.svg`, `.hc.svg`, `.hc.narrow.svg`, `.hc.wide.svg` | Replaced | Chart renders for each record, size and theme; a standalone payment chart uses the same authored sample record as its preview and sample app. |
| Workflow declares a chart | `src/chart-assets.ts` | Replaced | Chart render lookup used by the store. |
| Team brand needs a stylesheet | `src/oods-brand-<lowercase-brand>.css` | Replaced | The selected brand's generated styles. |
| Team component substitutions, file mode | `component-contracts.json` | Replaced | Component contract report, outside the artifact's source-file list. |

JavaScript component output (`typescript: false`) uses `src/GeneratedUI.jsx` for React and still `src/GeneratedUI.vue` for Vue. Applications and workflows require TypeScript. HTML output is a static document, outside this React/Vue app guide.

## Accepting a new generation

Keep your data fetching, navigation and handlers in your own files. Import the generated screen and pass its data props and `actions` object in. For a workflow, the generated `src/App` shows how each screen receives those inputs; move your production wiring into files you own. Keep any needed changes to types and data projection in your own store aligned with the new screen contract.

After editing and registering a definition, compose again, then generate again. Keep the old and new artifacts for comparison. Copy the **Replaced** files as a set, including any chart and brand files they need. Review changed **Starting point** files and deliberately apply relevant changes to your own code, especially new props, record fields and package versions. Run your app's typecheck, build and interaction tests before accepting the update. OODS Foundry does not do that integration for you.

## Seeing what changed

Compare the two `artifact.json` objects' `files` arrays by `path` and `contentHash` to find added, removed and changed source files. Each entry includes its original `contents`; `dependencies` lists exact runtime and peer versions, and `actions` names each required action, its parameters and its source sites. The artifact's `contentHash` binds those contents and contracts together. The app's `package.json` also lists its build dependencies.

`artifact.json` is the envelope, so it does not list or hash itself. The optional `component-contracts.json` is a separate report. The file-mode response's `payload.files` lists every file written, including those sidecars, with SHA-256 hashes. Neither list is a live measurement of your edited app.

Action declarations carry comments like `@oods-domain-action handleEdit sha256:…`: in `src/GeneratedUI` for a single screen and `src/actions.ts` for a workflow. Compare those digests as well as the `actions` arrays. A changed digest means its contract or source sites changed: review the corresponding handler, even if its name is unchanged. It does not mean the tool updated that handler for you.

In the first run's `last_counted_at` edit, both frameworks change the detail component and an application's sample props. Workflow generation also changes its store, sample data, application adapter and all four screen files because the shared data contract changes. That source change does not mean every screen gains a visible row: the trait places the new row only in detail. The action digests stay the same for this edit.

There is no tool that checks an app folder against its artifact file list, no detection or merge of your edits, and no automatic repair of an app after a definition changes.

### Mapped shadcn CSS and assets

Tailwind 4 discovers class names from the surrounding project. A mapped application's built CSS asset name can therefore differ inside and outside a Git repository; the generated artifact contentHash is stable. Build in a consistent project layout when comparing compiled assets.

Binary local assets in `artifact.files` have `encoding: "base64"`. Decode their `contents` when writing them; omitted encoding means UTF-8. The file's contentHash covers the serialized contents, and the artifact hash also binds the encoding. With `payloadMode: "file"`, OODS Foundry writes decoded files and the payload receipt hashes those bytes.
