# Your schema, your components, four screens

A real Cal.com Prisma schema becomes a small Membership workspace: a filterable list, a record detail, an editable form and a timeline. The same workflow generates React and Vue applications using accepted components from two public shadcn projects.

These are **generated sample records**, not Cal.com customer data. This five-minute walkthrough shows what to ask, what to review, and the result. Reproducing it also takes time to download and install the example projects.

![React Membership detail in dark mode](images/react-detail-1440-dark.png)

[See every screen in React and Vue, light and dark](screenshots.md) · [Watch the short screen recording](images/membership-workflow.gif)

## 1. Connect the local tool

With Node.js 22 or newer and Claude Code installed:

```sh
claude mcp add oods-foundry -- npx -y @oods/foundry@0.11.0
```

Restart Claude Code in a scratch workspace. Download the [pinned Prisma schema](https://raw.githubusercontent.com/calcom/cal.com/54343aa685ae8f33159d2f485ec4a57bad5c574a/packages/prisma/schema.prisma) into it. The importer reads that local file; it never connects to a database.

Use your own shadcn project, or scratch copies of the [React](https://github.com/satnaing/shadcn-admin/tree/e16c87f213a5ba5e45964e9b67c792105ec74d26) and [Vue](https://github.com/Whbbit1999/shadcn-vue-admin/tree/303cf63f6c8ecdd43408ae991c904daa2aad2dd8) examples used here. Keep their manifests, aliases, CSS and installed dependencies. Before asking OODS Foundry to apply adapters, install its libraries **in the component project**:

```sh
npm install @oods/components-react@0.11.0 @oods/component-contracts@0.11.0 @oods/component-styles@0.11.0 @oods/tokens@0.11.0
```

For Vue, replace `@oods/components-react` with `@oods/components-vue` at the same version. The MCP connection does not install these project dependencies. See [the component guide](../../packages/foundry/COMPONENTS.md) for supported project layouts.

## 2. Ask for a draft, then inspect it

> Read this Prisma schema with OODS Foundry. Show me the objects, the traits you propose and why, and what you could not read. Inspect Membership in detail. Do not apply it yet.

The assistant calls `object_import` with `action: "draft"` and `source: {path: "<schema.prisma>", format: "prisma"}`. Drafting saves a reviewable import. It calls `object_import_read` with `action: "show"`, the returned `importId`, and `object: "Membership"` to inspect that record's definition, samples and proposals.

Our draft contained **102 objects** and **183 valid trait proposals**: 69 strong and 114 medium. It also reported unsupported source elements and relationship cycles. Review the report; an import does not reproduce every Prisma constraint.

Membership has no name field. Its integer identifier becomes “Membership 1”; Team and User references show names such as Design and Elena Novak. Timestampable binds the declared dates. Stateful proposes treating `role` as the displayed state/filter; that is a demo choice, **not authorization logic**. Ownerable has no field bindings here and contributes no record view.

For money, a decimal called `total` is not enough. At acceptance, explicitly declare a currency sibling with `currencies: {total: {field: "currency"}}`; add `minorUnits: 100` only if the amount uses minor units. See [importing objects](../../packages/foundry/IMPORTING-OBJECTS.md).

## 3. Accept reviewed objects and component mappings

> For this scratch demo, accept the valid strong and medium proposals we reviewed and confirm the shipped User-name overlap. Leave weak or invalid proposals unaccepted. Then draft mappings from my local shadcn project and show what is supported before applying them.

`object_import` applies an explicit `objects: [{name, proposals: ["<proposal-id>"]}]` selection. Confirming a shipped-name overlap permits that team definition; review it deliberately.

`component_map` drafts with `source: {project: "<absolute project folder>", format: "shadcn"}`. Inspect the result through `component_map_read`, then approve the chosen proposal IDs with `component_map` `action: "apply"`, `draftId` and `accept`. Those actions do not take an extra `apply: true` flag.

We accepted 14 React adapters and 16 Vue adapters. These are proposals based on structural evidence, not behavioral certification. The source-record counts in the draft are different from the number of adapters. Unmapped components keep their OODS implementations; React's pagination is one example in this run.

## 4. Compose, preview and generate

> Compose Membership as list, detail, form and timeline. Create a workflow from those screens, preview it, then generate complete React and Vue applications with the accepted components. Save the returned files unchanged.

| Purpose | Tool call |
|---|---|
| Compose each screen | `design_compose {object: "Membership", context: "list"}`; repeat with `detail`, `form`, `timeline`, then `workflow` |
| Open the running preview | `design_preview {compositionId: "<returned id>", action: "render"}` |
| Inspect saved versions | `design_versions {compositionId: "<returned id>"}` |
| Generate an application | `code_generate {schemaRef: "<workflow ref>", framework: "react", profile: "build", options: {output: "application", payloadMode: "file"}}`; repeat for `vue` |

Copy the returned payload files to separate app folders and follow each generated README:

```sh
npm install
npm run build
npm run dev
```

The generated manifests intentionally pin the published compatible OODS libraries at 0.6.2. We built the unchanged files against those versions; the MCP tool that generated them was the 0.11.0 candidate. Your application still owns the database, authorization, navigation integration and production persistence.

![Vue Membership form on a phone](images/vue-form-390-light.png)

## What happened in the recorded run

One Claude Code conversation used a fresh profile and an empty npm cache, with the unpublished 0.11.0 tarball standing in for npm. `brand_read template` fit inline with all three themes. No imported objects, samples or composed schemas were hand-edited. The public images and recording replay those composition and generation calls against the final 0.11.0 freeze, using the same accepted inputs.

The first adapter applies refused missing OODS dependencies without writing adapters. After installing those libraries, we re-drafted and applied. An extra `apply: true` argument was also refused and removed. Those corrections are included in the steps above.

Both apps passed their TypeScript checks and production builds. We exercised all four routes in both frameworks at 1440 and 390 pixels, in light and dark: 32 screenshots inspected, no page errors or overflow, and no axe WCAG 2.2 A/AA violations. Role filtering reduced five rows to two and reset to five; changing a role, related record and checkbox survived saving and reopening the form. The timeline uses the record's created/updated dates and has no false missing-extension warning.

The component contract reports still describe adapter limitations. Passing these example interactions is not certification of a whole application. The detail view's state-history panel has no supplied state-change events; the separate timeline shows the declared timestamp events. [Run identities and image hashes](run.json) identify the candidate and the final capture.

## Sources and licenses

- [Cal.com Prisma schema](https://github.com/calcom/cal.com/blob/54343aa685ae8f33159d2f485ec4a57bad5c574a/packages/prisma/schema.prisma), commit `54343aa685ae8f33159d2f485ec4a57bad5c574a`; the pinned repository [license](https://github.com/calcom/cal.com/blob/54343aa685ae8f33159d2f485ec4a57bad5c574a/LICENSE) is MIT.
- [shadcn-admin](https://github.com/satnaing/shadcn-admin/tree/e16c87f213a5ba5e45964e9b67c792105ec74d26), React, MIT.
- [shadcn-vue-admin](https://github.com/Whbbit1999/shadcn-vue-admin/tree/303cf63f6c8ecdd43408ae991c904daa2aad2dd8), Vue, MIT.

Third-party source stays in the scratch projects. This walkthrough distributes OODS Foundry's text, generated sample-screen images and run metadata. The schema and component authors do not endorse this demo.
