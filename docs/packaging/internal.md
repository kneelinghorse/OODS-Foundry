# Internal Packaging Scaffold

The OODS Trait Engine ships as an internal-only package that surfaces React
components, composition utilities, validation helpers, and build provenance
metadata. The packaging workflow is intentionally scriptable so CI can verify
compatibility without publishing to a public registry.

## Package Outputs

- `dist/pkg/index.js` ESM bundle (with matching CommonJS + type declarations)
- `dist/pkg/provenance.json` containing `{ sb_build_hash, vr_baseline_id }`
- `dist/pkg/package.json` marked `private: true` to prevent accidental publish
- Copied docs: `README.md`, `CHANGELOG.md`, `LICENSE` when available

Run the build with:

```bash
pnpm run pkg:build
```

The script computes provenance hashes from the Storybook static output and the
local visual-regression baselines. Missing inputs result in `"unavailable"` so
teams can spot when provenance is stale.

## Versioning and Changelog

Conventional commits drive version bumps:

```bash
pnpm run pkg:version        # parses git log, updates package.json + CHANGELOG.md
```

- `feat` → minor bump, `fix` → patch, breaking changes (`!` or `BREAKING CHANGE`)
  → major.
- CHANGELOG entries are grouped under Features, Fixes, Docs, Chores, Other.

## Compatibility Checks

`pkg:compat` ensures the bundle integrates end-to-end:

```bash
pnpm run pkg:compat
```

Steps performed:

1. `pkg:build` to regenerate the bundle and provenance metadata.
2. `build-storybook` with `OODS_USE_DIST_PACKAGE=1` to exercise Storybook against
   the built outputs.
3. Installs `examples/sample-app` in a temp directory, pointing
   `@oods/trait-engine` to the freshly built tarball, and runs the smoke test.

The GitHub workflow `.github/workflows/pkg-compat.yml` executes the same check
on pull requests touching packaging inputs.

## Storybook About Panel

The agent panel now reads `@oods/provenance` to display the Storybook build hash
and visual-regression baseline identifier. When provenance is missing, the panel
reminds engineers to run `pnpm run pkg:build`, keeping Storybook and VR assets
in sync with the distributed bundle.
