# Local Release Checklist

Use this checklist to perform reproducible pre-publish validation for the OODS packages. Run all commands from the `/app` workspace root.

## Prerequisites
- Node.js 20.11 or newer (enable via Corepack)
- pnpm 9.12.2 (auto-provisioned via `packageManager`)
- Clean git status and freshly generated token artifacts

## Build & Verify
1. Install dependencies: `pnpm install`
2. Build every package: `pnpm run build:packages`
3. Validate deterministic tarballs: `pnpm run pack:verify`
4. Confirm each package `CHANGELOG.md` reflects the intended version bump
5. Optionally smoke-test imports:
   - `node -e "import('@oods/tokens').then((m)=>console.log(Object.keys(m)))"`
   - `node -e "import('@oods/tw-variants').then((m)=>console.log(typeof m.createContextVariantsPlugin))"`

`pack:verify` rebuilds and packs each package twice, diffing the tarballs to guarantee bit-for-bit reproducibility before publishing.
