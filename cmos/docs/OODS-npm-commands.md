To force 4466, export MCP_BRIDGE_PORT=4466 before pnpm --filter @oods/mcp-bridge run dev.

systemsystems@El-Caballo OODS-Foundry % pnpm --filter @oods/agents-smoke run
Commands available via "pnpm run":
  run
    tsx src/index.ts
  smoke
    tsx src/index.ts

Commands of the root workspace project (to run them, use "pnpm -w run"):
  build
    tsc
  test
    vitest
  test:unit
    vitest run --exclude "tests/integration/**"
  test:integration
    vitest run tests/integration
  test:validation
    vitest run tests/validation
  test:coverage
    vitest --coverage
  test:axe
    vitest run tests/a11y/components.a11y.test.tsx tests/a11y/dark.components.a11y.test.tsx
  build:stories
    tsc --project tsconfig.stories.json
  lint
    eslint "src/**/*.{ts,tsx}"
  format
    prettier --write "src/**/*.ts"
  generate:types
    tsx src/generators/index.ts
  generate:objects
    tsx src/cli/generate-objects.ts
  validate
    tsx src/cli/validate.ts
  validate:dependencies
    tsx src/cli/validate-dependencies.ts
  validate:pipeline
    tsx src/cli/validate.ts --path traits --format text
  validate:tokens
    node tools/token-coverage/index.mjs
  prepare
    node tools/token-lint/setup-precommit.mjs
  ci:local
    npm run lint && npm run test:unit && npm run test:integration && npm run test:validation && npm run validate:pipeline && npm run test:coverage
  lint:tokens
    node tools/token-lint/index.mjs packages/tokens/src/tokens
  build:tokens
    node packages/tokens/scripts/build.mjs
  check:tokens
    node packages/tokens/scripts/build.mjs --check
  build:packages
    pnpm --filter @oods/* run build
  a11y:check
    node tools/a11y/index.mjs check
  a11y:diff
    node tools/a11y/index.mjs diff
  a11y:baseline
    node tools/a11y/index.mjs baseline
  vrt:fallback
    playwright test --config testkits/vrt/playwright.config.ts
  vrt:fallback:update
    playwright test --config testkits/vrt/playwright.config.ts --update-snapshots
  vrt:lightdark
    node testkits/vrt/storycap.lightdark.mjs --out artifacts/vrt/lightdark/local
  vrt:hc
    node testkits/vrt/storycap.hc.mjs --out artifacts/vrt/hc/local
  registry:list
    tsx src/cli/registry-list.ts
  object:list
    tsx src/cli/object-commands.ts list
  object:resolve
    tsx src/cli/object-commands.ts resolve
  object:compose
    tsx src/cli/object-commands.ts compose
  object:validate
    tsx src/cli/object-commands.ts validate
  object:create
    tsx src/cli/object-commands.ts create
  object:generate
    tsx src/cli/object-commands.ts generate
  storybook
    storybook dev -p 6006
  build-storybook
    storybook build
  chromatic:dry-run
    scripts/chromatic-run.sh --dry-run --storybook-build-dir storybook-static --exit-zero-on-changes --auto-accept-changes main
  chromatic:publish
    scripts/chromatic-run.sh --storybook-build-dir storybook-static --exit-zero-on-changes --auto-accept-changes main
  current-state:sprint06
    node ../scripts/diagnostics/sprint06-current-state.mjs
  current-state:sprint07
    node ../scripts/diagnostics/sprint07-current-state.mjs
  current-state:sprint08
    node ../scripts/diagnostics/sprint08-current-state.mjs
  chromatic
    scripts/chromatic-run.sh --storybook-build-dir storybook-static --exit-zero-on-changes --auto-accept-changes main
  normalize:contexts
    node scripts/normalize-contexts.cjs
  validate:contexts
    node scripts/validate-contexts.cjs
  pipeline:push
    pnpm run build:tokens && pnpm run build-storybook && (pnpm run chromatic || echo chromatic skipped) && pnpm run vrt:hc && pnpm run current-state:sprint08 && pnpm run validate:contexts && pnpm run purity:audit
  pack:verify
    bash scripts/release/local-release.sh
  purity:audit
    node scripts/purity/audit.js