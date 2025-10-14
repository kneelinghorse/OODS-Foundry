# @oods/tokens

`@oods/tokens` is the source of truth for the OODS design system’s Design Tokens using the DTCG core format. Tokens are authored as JSON grouped under `src/tokens` with primitive "base" values separated from theme-level semantic aliases.

## Runtime Usage

The published package exposes dual ESM/CJS entry points generated from the Style Dictionary pipeline:

```ts
import tokens from '@oods/tokens';

tokens.prefix; // -> 'oods'
tokens.tokens; // nested token tree
tokens.flatTokens.sysTextPrimary.value; // normalised colour value
```

Sub-path exports provide additional artifacts:

- `@oods/tokens/css` → precompiled CSS custom properties
- `@oods/tokens/tailwind` → Tailwind-friendly JSON payload used by `@oods/tw-variants`

- Base primitives live under `src/tokens/base/**`. These files carry concrete `$value` entries and provide the canonical palette for surfaces, text, spacing, focus, and status feedback.
- Theme layers live under `src/tokens/themes/**`. Each theme maps semantic tokens to the underlying base primitives using the safe `{path.to.token}` alias syntax.
- Authoring is linted by `tools/token-lint` which enforces the guardrails defined in `tools/token-lint/dtcg-guardrails.config.yaml`. Run `npm run lint:tokens` (or `yarn lint:tokens`) from the repository root to validate any changes.

## Authoring Rules

The guardrails (summarised from mission R4.1 research) are enforced automatically:

1. Keys at every level must use lowercase kebab-case with no illegal characters (`. { }`).
2. Every token object requires both `$type` and `$value`; `$description` is optional but encouraged.
3. `$type` is restricted to official DTCG types plus a limited compatibility list (`color`, `dimension`, `typography`, etc.).
4. Aliases must be full value references (`"{namespace.token}"`) with no interpolation, fallbacks, or arrays.
5. Alias graphs must remain acyclic.

When introducing new token namespaces, prefer extending the base primitives first and aliasing them from themes. This keeps semantic tokens meaningful while ensuring the primitive palette remains reusable across future themes.

## Linting & Tooling

- `npm run lint:tokens` — Runs the repository-wide token lint, validating every JSON file under `src/tokens`.
- `npm run lint:tokens -- --fix` — Some future rules may support autofix behaviour; the current rule set is read-only.

All commits run the token lint automatically via the repository pre-commit hook, so expect violations to block commits until resolved.

## Build Pipeline

`npm run build:tokens` wraps our Style Dictionary v4 pipeline. It consumes the DTCG tokens under `src/tokens/**`, applies the `@tokens-studio/sd-transforms` preprocessor/expand pass, and emits a trio of runtime artifacts:

- `dist/css/tokens.css` – prefixed CSS custom properties ready to import into Tailwind v4 and global stylesheets.
- `dist/ts/tokens.ts` – a typed token map plus helper utilities for authoring-time lookups.
- `dist/tailwind/tokens.json` – normalized JSON feed for the upcoming context-variant Tailwind plugin.

Run `npm run check:tokens` to regenerate the outputs in-memory and assert that the committed artifacts are up to date. This command also verifies that no duplicate token names or CSS variable collisions slipped into the graph.

The pipeline honours token aliases (`outputReferences: true`), so theme-level tokens resolve to `var(--oods-*)` automatically. When adding new namespaces, drop raw values in `src/tokens/base/**` and wire theme aliases in `src/tokens/themes/**`; the build will surface any missing references during the check phase.

## Enum Mapping

Lifecycle-heavy domains (e.g., `saas/Subscription.status`) map their canonical enum values to semantic tokens through JSON manifests stored in `/app/examples/mapping`. Each manifest is validated against `/app/schemas/token-mapping.schema.json`, which enforces a consistent contract for the default token set and any context overrides (badges, banners, etc.).

Domain reference files in `/app/examples/domain/*.status.json` declare the authoritative enum values that must be covered. Run `yarn validate:tokens` from `/app` to execute the coverage validator: it validates every manifest against the schema, checks that 100% of the declared enum values are present, and reports the coverage percentage. Missing mappings fail the command, while extra tokens are surfaced as warnings so teams can prune stale states.

To introduce a new status enum:
- Add the enum values to the appropriate domain reference file (or extend the real object schema once available).
- Update the corresponding mapping manifest with tokens for the new values.
- Re-run `yarn validate:tokens` to confirm coverage stays at 100%.
