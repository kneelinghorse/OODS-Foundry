# MCP Contracts

Strong schemas back every MCP tool so agents and operators can trust payloads at compile time and at runtime. This guide captures the new schema→type pipeline, validation hooks, and how to keep the contracts tight.

## Schema-Driven Types
- JSON Schemas live under `packages/mcp-server/src/schemas/`.
- Run `pnpm --filter @oods/mcp-server run generate:types` to regenerate TypeScript definitions in `src/schemas/generated.ts`.
- `pnpm --filter @oods/mcp-server run build` now performs `generate:types --check` to fail fast when schemas and generated types diverge.
- Use the generator before committing any schema edits; never edit `generated.ts` by hand.

## Runtime Validation
- `packages/mcp-server/src/index.ts` registers every tool with explicit input/output schema pairs.
- Handlers are invoked only after Ajv validates the payloads. Any schema drift is surfaced as a structured MCP error before handlers run.
- The Fastify health endpoint lists registered tools so clients can introspect available contracts.

## Contract Tests
- Contract specs live at `packages/mcp-server/test/contracts/schema.contract.spec.ts`.
- Tests compile schemas with Ajv, assert that canonical payloads satisfy the schema and TypeScript types, and include deliberate negative controls.
- Execute `pnpm --filter @oods/mcp-server exec vitest run test/contracts/schema.contract.spec.ts` (or `pnpm --filter @oods/mcp-server run test:contracts` if already configured) to exercise the suite.

Keeping schemas authoritative means every public surface is strongly typed, drift is caught at build, and regressions fail fast in CI.
