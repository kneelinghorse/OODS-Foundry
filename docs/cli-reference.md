# Object Registry CLI Reference

The object CLI wraps the registry, trait resolver, and type generator so that developers can inspect, validate, and scaffold composed objects without wiring scripts by hand. All commands live in `src/cli/object-commands.ts` and are exposed through npm scripts:

```bash
# usage examples
npm run object:list
npm run object:resolve -- User --json
npm run object:compose -- Transaction --limit 10
npm run object:validate -- --compose
npm run object:create -- AuditLog --dir objects/drafts
npm run object:generate
```

> **Tip:** To pass flags, append them after `--` when using npm (`npm run object:resolve -- User --json`). Yarn users can omit the extra separator (`yarn object:resolve User --json`).

## Command Summary

| Script | Purpose | Defaults |
| --- | --- | --- |
| `object:list` | List objects with domains, tags, traits, and source paths. | Roots: `objects/core`. |
| `object:resolve` | Resolve an object and show trait metadata plus performance metrics. | Roots: `objects/core`; trait roots: `traits`, `examples/traits`; parameter validation on. |
| `object:compose` | Inspect composed schema fields with provenance. | Same defaults as `object:resolve`; shows 20 fields. |
| `object:validate` | Parse definitions and optionally run full composition checks. | Validates every object under `objects/core`. |
| `object:create` | Scaffold a draft object definition with starter fields. | Writes to `objects/drafts` unless overridden. |
| `object:generate` | Emit `.d.ts` files and a barrel export for every resolved object. | Output directory: `generated/objects`. |

Use `object:<command> --help` to print detailed usage for any subcommand.

## PR Checks

Sprint 14 introduced mandatory PR validation; merges to protected branches require the checks below (see `.github/workflows/pr-validate.yml`). Run the paired commands locally before pushing to keep the queue green.

| Check | Workflow job | Local command | Notes |
| --- | --- | --- | --- |
| Build | `build` | `pnpm run build:tokens && pnpm run build:packages && pnpm run build` | Mirrors the three-step workspace build (tokens → packages → app). |
| Lint | `lint` | `pnpm run lint` | ESLint gate for `src/**/*.{ts,tsx}`. |
| Typecheck | `typecheck` | `pnpm exec tsc --noEmit` | Uses the workspace TS config with `skipLibCheck=false`. |
| Tokens | `tokens-validate` | `pnpm run tokens-validate` | Runs the DTCG transform in `--check` mode, semantic lint, and OKLCH guardrails. |
| Accessibility | `a11y-contract` | `pnpm run build-storybook && pnpm run a11y:diff` | Requires Playwright Chromium; blocks on new serious/critical axe findings. |
| Visual regression | `vr-test` | `pnpm run build-storybook && pnpm run chromatic:publish` | Publish with `CHROMATIC_PROJECT_TOKEN` to preview diffs before CI. |
| Coverage | `coverage` | `pnpm run build:tokens && pnpm run test:coverage` | V8 coverage thresholds: statements/lines 70%, functions 80%, branches 70%. |

## Commands

### `object:list`

Lists every object currently registered, sorted by name. Only the canonical objects under `objects/core` are included by default to avoid duplicate names from example fixtures.

```
npm run object:list
```

**Flags**

| Flag | Description |
| --- | --- |
| `--root <path>` / `-r` | Add an additional object root. Repeat to merge multiple directories (e.g. `--root ./examples/objects`). |
| `--json` | Emit JSON instead of a formatted table. |

### `object:resolve`

Resolves an object through the registry → trait resolver → compositor pipeline and prints a summary. JSON output includes the resolved trait list, schema field names, and timing data.

```
npm run object:resolve -- User --json
```

**Flags**

| Flag | Description |
| --- | --- |
| `--root <path>` / `-r` | Add object roots (defaults to `objects/core`). |
| `--traits <path>` / `-t` | Add trait roots (defaults to `traits` and `examples/traits`). |
| `--json` | Print structured JSON. |
| `--no-validate` | Skip AJV parameter validation. |

### `object:compose`

Displays the composed schema with provenance, useful when auditing which trait contributes a field. The command shares the same options as `object:resolve` plus limits for readability.

```
npm run object:compose -- Transaction --limit 10
```

**Additional Flags**

| Flag | Description |
| --- | --- |
| `--limit <n>` | Limit displayed fields (default: 20). |
| `--no-provenance` | Replace provenance column with field descriptions. |

### `object:validate`

Validates definitions. Without arguments the command parses every object under `objects/core`. Provide paths to validate specific files, and add `--compose` to ensure trait resolution succeeds.

```
# Validate a single file
npm run object:validate -- objects/core/User.object.yaml

# Validate everything and run composition checks
npm run object:validate -- --compose
```

**Flags**

| Flag | Description |
| --- | --- |
| `--compose` | Resolve and compose each object after parsing. |
| `--root <path>` / `-r` | Object roots when running on all files. |
| `--traits <path>` / `-t` | Trait resolution roots. |
| `--json` | Emit machine-readable results. |

### `object:create`

Generates a scaffolded `.object.yaml` file with a starter schema, metadata placeholders, and a default trait. Files are named using a kebab-case version of the object name.

```
npm run object:create -- AuditLog --domain platform.audit --trait lifecycle/Stateful
```

**Flags**

| Flag | Description |
| --- | --- |
| `--dir <path>` / `-d` | Target directory (default: `objects/drafts`). |
| `--trait <name>` / `-t` | Initial trait reference (default: `content/Labelled`). |
| `--domain <domain>` | Domain metadata string. |
| `--description <text>` | Initial description to embed in the scaffold. |
| `--force` | Overwrite an existing file. |

### `object:generate`

Runs the object type generator end-to-end: resolve every registry record, emit `.d.ts` files, and refresh the barrel export (`index.ts`). A dry run lets you preview work without touching disk.

```
npm run object:generate
npm run object:generate -- --dry-run --quiet
```

**Flags**

| Flag | Description |
| --- | --- |
| `--out <dir>` / `--output <dir>` | Output directory (default: `generated/objects`). |
| `--dry-run` | Skip file writes while still reporting actions. |
| `--no-clean` | Leave orphaned files in the output directory. |
| `--quiet` | Suppress log output. |
| `--root <path>` / `-r`, `--traits <path>` / `-t` | Override object and trait roots. |

## Including Example Objects

Example fixtures under `examples/objects` share some names with the core Universal Quintet. To inspect them, explicitly add the directory:

```
npm run object:list -- --root ./examples/objects
npm run object:resolve -- User --root ./examples/objects --json
```

Because the registry enforces unique names, specifying example roots alongside the canonical ones will mark the duplicates with diagnostics, but the CLI commands continue to finish successfully.
