---
name: oods-foundry
description: Use OODS Foundry when a team wants its screens built from its own objects and design system. Register its objects, traits and brand roles, substitute its components, preview and generate React or Vue, and inspect chart certification and unchecked work.
---

# Work with OODS Foundry

Use the connected OODS Foundry MCP server. Clients expose lowercase tool names joined by underscores, sometimes prefixed by the
server name. Start with `health_check`; if the server is unavailable, explain what connection is missing. Do not substitute
an invented response. Node.js 22.0.0 or newer and macOS or Linux are the recorded environments; Windows is untested.

For a team's design system, read [the quickstart](references/QUICKSTART.md) for complete arguments and editable npm
inputs. Keep calls that share a `schemaRef` in one server session: references expire after 30 minutes. Use the team's
actual values; keep unknown values explicit. The Harbor inputs are labelled examples, not values to copy into a
team's production records. Adapt the steps to the requested output; an existing object does not need registering
again and a chart-only request needs only health, rendering and certification.

## Ordered quickstart calls

1. `health_check` — check `status`, version, registered objects and any rejected user definitions.
2. `brand_create`, `action: "template"` — inspect the colour roles.
3. `brand_create`, `action: "validate"` — validate the team's base/dark/high-contrast documents.
4. `brand_create`, `action: "create"` — after `valid: true`, create the requested brand in the user's data folder.
5. `object_registry`, `action: "validate"` — validate the team's trait YAML.
6. `object_registry`, `action: "register"` — register the validated trait.
7. `object_registry`, `action: "validate"` — validate its object YAML now that the trait exists.
8. `object_registry`, `action: "register"` — register the validated object; read all context checks.
9. `component_map`, `action: "create", apply: true` — substitute a shipped component identity using the team's exact package,
   version, export and prop translations; use an absolute `localPath` for preview bundling, or map several with
   a `mappings` list or an absolute `mappingsPath` to a checked mapping file; React teams on shadcn/ui's Radix or Base UI base and Vue teams on shadcn-vue / Reka UI can install the shipped adapters and map their project modules as [COMPONENTS.md](https://cdn.jsdelivr.net/npm/@oods/foundry@0.10.0/COMPONENTS.md) describes.
10. `design_compose` — name the object, context and brand/theme; retain `schemaRef`, `compositionId` and version.
11. `viz_render` — pass actual rows and matching encodings; request `includeNormalizedSpec` and `includeA11y`.
12. `artifact_certify` — pass that `normalizedSpec` and the same brand/theme. For ECharts-primary charts also pass
    the same data operand. The separate chart is not automatically inserted into the composed screen.
13. `design_preview` — use the saved composition and version; open its React or Vue `appUrl` and read the screen.
14. `code_generate`, `framework: "react", profile: "build"` — use the saved schema and
    `options: {output: "application", brand, theme, payloadMode: "file"}`.
15. `code_generate`, `framework: "vue", profile: "build"` — use the same options when Vue is requested or compared.

Creation, registration and mapping write user data; perform them for the user's requested integration. Reusing an
existing brand id is refused. Use `brand_apply` for an intentional change. Do not modify a client's settings merely
to make an unrelated design task work.

## Read the result before calling it done

Inspect `status`, typed errors, warnings and findings from every call. Validation may report `valid`; certification
reports `conformant`, pillar results and evaluated rules. A tool returning successfully is not evidence that every
check passed. Fix reported input issues before following dependent steps.
Beside `facts.json`, the package's `errors.json` lists each runtime error code, severity, cause, fix and tools.

For generated code retain `artifact.contentHash`, dependency versions, `validationReceipt` and file-mode paths.
Read `notChecked` and its reasons: build-profile source checks do not mean the app was compiled or mounted in a
browser. Follow the returned install block, install the matching dependencies, run the app's build, mount it, and
compare it with the preview at desktop and phone widths. Preserve the resulting logs and screenshots alongside the
receipt. A mapped component's met/unmet/not-checked obligations are advisory, not blanket compatibility.

For a chart, retain the render hash, normalized specification, data operand and certification findings. Certification
checks chart specifications only; it does not certify the surrounding screen or application. A rule whose
precondition is missing did not pass. High contrast's forced-colour exemption is not a numeric contrast pass.

## Boundaries

- Composition uses declared objects and keyword rules. Missing selection confidence is not inferred.
- Team traits place shipped catalog identities; component substitution replaces their implementations and does not
  add a new catalog identity. Colour intake maps named brand roles; it is not an importer for every token format.
- React and Vue applications use sample data and an integration notice for domain actions. A workflow's local
  sample store is not production persistence. Connect handlers and real data before shipping.
- HTML output is a static sample document. Rendering it is not proof of universal framework or theme parity.
- Preview links are local by default; presentation inside a conversation depends on the MCP host. Claude Code
  displays text results. Do not claim a client was tested without a receipt from that client.
- `health_check` exposes retained proof summaries. A test's directory or a coverage count is not independent acceptance.
  Report exactly which checks ran, which failed and which remain unchecked.
