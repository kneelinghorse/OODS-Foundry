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

## RC Freeze Rollback Plan

### When to trigger a rollback
- Automated guardrails fail (tests/a11y/VRT/packaging) after the freeze.
- SBOM validation or provenance signatures in `artifacts/release-dry-run/<ts>/bundle_index.json` diverge from the commit under review.
- A critical bug is reported in the RC tag or reviewers detect an accessibility/regression escape that cannot be hot-fixed safely.

### Immediate containment
1. Quarantine the frozen artifacts:
   ```bash
   mv dist/releases/<ts> dist/releases/<ts>-rollback
   mv artifacts/release-dry-run/<ts> artifacts/release-dry-run/<ts>-rollback
   ```
   Keep the renamed folder for auditability.
2. Remove the RC tag locally (and remotely if it was pushed):
   ```bash
   git tag -d v1.0.0-rc
   git push origin :refs/tags/v1.0.0-rc   # optional if tag was pushed
   ```
3. Log the incident in CMOS (mission notes + telemetry) so the reviewer queue knows the RC is invalid.

### Baseline restoration
1. Rebuild Storybook to ensure the frozen snapshot is reproducible: `pnpm run build-storybook`.
2. Rerun the baseline checks that gate the freeze:
   ```bash
   node scripts/state-assessment.mjs --coverage --a11y --vr
   ```
   This refreshes `artifacts/state/tests.json`, `artifacts/state/a11y.json`, and `artifacts/state/vr.json`.
3. If accessibility deltas require a new baseline, run `pnpm run a11y:baseline`. For visual regression drift without Chromatic access, fall back to `pnpm run vrt:lightdark -- --ci` and attach the diff artifacts when filing the blocker.

### Rebuild & verification
1. Execute `pnpm run release:dry-run` once fixes land. The script emits a new timestamped directory under both `dist/releases/` and `artifacts/release-dry-run/`.
2. Verify the tarballs:
   ```bash
   shasum -a 256 dist/releases/<new-ts>/*.tgz
   ```
   Ensure the hashes match the entries in `summary.json.tarballs[*].sha256`.
3. Validate the SBOM (`artifacts/release-dry-run/<new-ts>/sbom.json`) against the dependency expectations for the RC scope.
4. Capture provenance metadata by archiving `summary.json`, `bundle_index.json`, and `commands.log` alongside the incident record.

### Documentation & communication
1. Update `docs/releases/v1.0-release-notes.md` (or sprint notes) with a short rollback summary: trigger, fix, new timestamp.
2. Append the blocker details and remediation timeline to the active CMOS mission notes before re-promoting the RC.
3. Only recreate the `v1.0.0-rc` tag after the new bundle passes all guardrails and reviewers sign off on the regenerated artifacts.
