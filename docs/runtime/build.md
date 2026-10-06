# Build the source snapshot

Use Node.js 22 or later and pnpm 9.12.2. Each release snapshot includes its original lockfile and all workspace manifests. Start in a fresh clone of the public repository.

```sh
pnpm install --frozen-lockfile
pnpm run build:tokens
pnpm --filter '@oods/*' run build
```

The server build reads the committed proof ledgers. Their recorded measurements identify historical executions; rebuilding does not create new evidence or certify the build.

The public test selection covers library and server specs whose inputs ship in this repository. Tests of retained private receipts and historical Git commits are excluded explicitly by the release exporter. The test runner requires every selected spec to execute, with no failures or skipped assertions. Browser integration tests also need Playwright Chromium and Firefox:

```sh
pnpm exec playwright install chromium firefox
node scripts/runtime/public-tests.mjs
```

To assemble the standalone runtime and the installable `@oods/foundry` package, use new, empty output directories. Assembly installs the production dependency closure and validates the runtime contents.

```sh
node scripts/runtime/assemble.mjs --out-dir .tmp/public-proof/archive --work-dir .tmp/public-proof/assembly
node scripts/runtime/npm-package.mjs --archive-dir .tmp/public-proof/archive --out-dir .tmp/public-proof/npm --work-dir .tmp/public-proof/npm-work
```

The runtime archive is `.tmp/public-proof/archive/oods-foundry-runtime.tar.gz`. The package tarball is written under `.tmp/public-proof/npm/`. These commands build local artifacts; they do not publish packages.
