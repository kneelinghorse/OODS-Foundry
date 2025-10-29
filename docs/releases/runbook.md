# Release Dry Run Runbook

This runbook executes the end-to-end release dry run for the OODS packages, capturing reproducible tarballs, provenance, and verification evidence without publishing to a registry.

## Prerequisites
- Node.js 20.11+ with Corepack (pnpm 9.12.2 auto-provisioned).
- Clean working tree with Storybook baselines available (`storybook-static/`, `artifacts/vrt/`).
- Local access to `dist/pkg/provenance.json` (regenerated during the run).

## Dry Run Command
1. From the workspace root run:
   ```bash
   pnpm run release:dry-run
   ```
   The script performs `pkg:compat`, `pack:verify`, and `npm pack` for `@oods/trait-engine`, `@oods/tokens`, `@oods/tw-variants`, and `@oods/a11y-tools`.
2. On success the CLI prints the release folder (e.g. `dist/releases/2025-10-28T23-52-36-530Z`) and an artifact bundle (`artifacts/release-dry-run/<ts>/summary.json`).

### Generated Evidence
- `dist/releases/<ts>/*.tgz` — reproducible tarballs ready for promotion.
- `artifacts/release-dry-run/<ts>/summary.json` — command timeline, tarball sizes, SHA-256 hashes, provenance snapshot, diagnostics summary.
- `artifacts/release-dry-run/<ts>/sbom.json` — dependency SBOM keyed by tarball SHA-256.
- `artifacts/release-dry-run/<ts>/commands.log` — full console transcript.
- `artifacts/release-dry-run/<ts>/bundle_index.json` — hashed index for artifact integrity.

## Verification Checklist
- Confirm `summary.json.tarballs[*].sha256` matches local hashes:
  ```bash
  shasum -a 256 dist/releases/<ts>/*.tgz
  ```
- Spot check `sbom.json` for expected dependency ranges.
- Ensure `diagnostics.json.helpers.pkgCompat.lastRun.status === "passed"` (script updates this automatically).

## Packaging Health Follow-Up
Run the packaging assessment to capture the GREEN status alongside provenance:
```bash
node scripts/state-assessment.mjs --packaging
```
Outputs land in `artifacts/state/packaging.json` with the latest `sb_build_hash`, VR baseline id, and pkgCompat history.

## Rollback / Promotion Notes
- To discard a dry run, remove the generated `dist/releases/<ts>` folder.
- Promotion steps (tagging/publish) inherit the tarballs and SBOM from `dist/releases/<ts>`; pass the bundle to the release approval workflow (mission B20.1) when ready.
