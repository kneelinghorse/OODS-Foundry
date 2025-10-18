# Integration Testing Strategy

This document outlines how we exercise the trait engine end-to-end across parsing, validation, composition, and type generation for the Universal Quintet fixture set.

## Goals

- Prove that real trait definitions compose successfully through the full pipeline.
- Detect regressions across parser, validator, and compositor boundaries.
- Surface failure modes for malformed traits, invalid parameters, and dependency cycles.
- Record repeatable commands that CI and contributors can run locally in under two minutes.

## Fixture Design

The fixtures live under `tests/integration/fixtures/universal-quintet.ts` and are sourced directly from production trait definitions:

- **User** — combines lifecycle, tagging, archival, and semantic colorization.
- **Organization** — multi-tenant account emphasising taxonomy alignment.
- **Product** — cancellation workflows layered on lifecycle state machines.
- **Transaction** — archival plus cancellation with financial semantics.
- **Relationship** — graph focus with provenance tagging.

Each stack includes:

- A base object schema mirroring production objects.
- Parameter payloads that exercise AJV validation (enums, ranges, arrays).
- Normalized token foundations so semantic token checks pass without mocks.

## Test Suites

| Suite | Command | Purpose |
| --- | --- | --- |
| `tests/integration/universal-quintet.integration.test.ts` | `npm run test:integration` | Golden path traversal: parse → validate parameters → compose → validate composition → generate types. |
| `tests/integration/failure-scenarios.integration.test.ts` | `npm run test:integration` | Error assertions covering parser failure, parameter rejection, collision warnings, and dependency loops. |
| `tests/validation/*.test.ts` | `npm run test:validation` | Focused validation module coverage (AJV, Zod, pipeline orchestration). |
| Accessibility contract | `pnpm run build-storybook && pnpm run a11y:diff` | Builds Storybook and runs axe against curated stories; fails on new serious/critical violations defined in `testing/a11y/aria-contract.json`. |

> **Note:** When running locally, prefer `npm run test:integration` to re-execute only the end-to-end suites. The command completes in ~0.5s on modern hardware.

## Determinism Guidelines

- Tests rely exclusively on in-repo fixtures; no network or filesystem writes outside `tmp` occur.
- Composition and validation clocks are read for metrics but do not gate assertions.
- Any new fixtures should reuse canonical trait definitions—avoid mocks to keep parity with production behaviour.

## Extending Coverage

1. Add new trait stacks to `tests/integration/fixtures/universal-quintet.ts`.
2. Ensure associated parameter schemas exist under `schemas/traits`.
3. Update the integration suite to assert provenance, dependency order, and validator output for the new fixtures.
4. Record additional scenarios and expected runtime impacts in `docs/validation/benchmarks/`.

Maintaining this strategy keeps CI within the two-minute budget while providing confidence across the entire validation pipeline.

## Coverage & Contract Gates

- Run `pnpm run test:coverage` to exercise the vitest V8 instrumentation with thresholds of 70% statements/lines, 80% functions, and 70% branches. The run emits `coverage/coverage-summary.json` for hand-off diagnostics.
- Schema-driven contract tests live under `tests/contracts` to ensure generated declarations stay `any`-free and in sync with source JSON Schemas.
- Rebuild schema-derived types with `pnpm run generate:schema-types` (use `--check` in CI to prevent drift) before validating coverage, so the contract suite has the latest outputs.
- Accessibility contract tooling lives in `testing/a11y/aria-contract.json` and `tools/a11y/index.mjs`. The PR `a11y-contract` workflow builds Storybook and runs `pnpm run a11y:diff`, blocking merges on new serious/critical axe violations against the curated story list.
- GitHub’s required `coverage` job (Sprint 14) executes the same V8 suite; expect the PR to stay red until thresholds are met.
