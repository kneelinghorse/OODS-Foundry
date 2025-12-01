# Sprint 28 Quality Prep Checklist

**Purpose:** Front-load the guardrails called out in PROJECT_CONTEXT (Chromatic TurboSnap tagging, Storycap fallback posture, ≥90 % coverage) so every authorization mission inherits them automatically.

## Visual Regression / Chromatic
- [ ] Tag the upcoming Role Matrix + Policy Editor stories as part of the TurboSnap critical list (`chromatic.config.json`) before B28.6 starts.
- [ ] Update `chromatic-baselines/README.md` with RBAC story IDs and instructions for reviewing multi-tenant permutations.
- [ ] Confirm Storycap fallback configs remain disabled by default by diffing `scripts/storycap.config.ts` against the Preferenceable baseline; document how to enable in mission logs only if needed.

## Playwright / Storycap
- [ ] Re-run `pnpm vrt:hc` and capture any RBAC UI placeholders to ensure future snapshots render deterministically.
- [ ] Validate forced-colors emulation stays off unless explicitly toggled in docs; add note in `docs/runbooks/vrt.md`.

## Coverage & Testing
- [ ] Set up `vitest.config.ts` project config entries for `tests/traits/authorization/**` with thresholds ≥90 % lines/functions/branches.
- [ ] Prepare `pnpm vitest run tests/traits/authorization/*.test.ts tests/integration/authorization/*.test.ts` command alias for CI.
- [ ] Extend `docs/testing/coverage.md` with RBAC-specific expectations (schema + runtime + UI) plus reference to Preferenceable coverage numbers.

## Diagnostics & Telemetry
- [ ] Create placeholder sections in `diagnostics.json` for `authorization.cache`, `authorization.registry`, `authorization.ui` so B28 missions can append metrics without reworking structure.
- [ ] Update `docs/changelog/README.md` template with authorization-specific bullets (R21.2 citation, Chromatic status, cache metrics).

## Context / Backlog Hygiene
- [ ] Snapshot contexts via `./cmos/cli.py db export contexts` after prepping guardrails to capture baseline state for RBAC.
- [ ] Attach this checklist to `cmos/planning/sprint-28-plan.md` so every mission references it before start/complete events.
