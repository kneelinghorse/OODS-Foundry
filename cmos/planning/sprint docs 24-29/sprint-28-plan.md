# Sprint 28 Plan – Authorization Extension Pack

**Date:** 2025-11-19  
**Source Inputs:** `cmos/planning/sprint-28-30-overview.md`, `cmos/planning/sprint-27-retrospective.md`, MASTER_CONTEXT next-session reminders  
**Status:** Planning

---

## Objectives

1. Introduce the Authable trait and canonical RBAC schemas that reuse the registry/migration scaffolding built for Preferenceable.
2. Ship a complete authorization service surface (trait spec, schemas, runtime APIs, UI, CLI, documentation, diagnostics).
3. Maintain Preferenceable-quality guardrails: cache metrics, Chromatic tagging, Playwright/Storycap fallback posture, and ≥90 % coverage for new packages.

## Entry Criteria

- Preferenceable missions and diagnostics complete (`cmos/planning/sprint-27-retrospective.md`).
- MASTER_CONTEXT points to Authorization focus and references reuse of Preferenceable scaffolding.
- Research artifacts ready: `cmos/research/R21.2_*`.

## Mission Breakdown

| Mission | Scope | Success Signals |
| --- | --- | --- |
| **B28.1** – Authable trait & schema registry | Trait TS/YAML specs, JSON Schemas, DTOs, registry + validator modules w/ Vitest | Registry publishes versioned schemas, tests green |
| **B28.2** – RBAC database foundations | SQL migrations for roles, assignments, policies, sessions, audit log, seed CLI, docs | Migrations run cleanly under integration tests |
| **B28.3** – Role graph & entitlement runtime | Inheritance resolver, permission evaluator, diagnostics | Entitlement checks <5 ms with benchmark coverage |
| **B28.4** – SoD policy builder & validator | Policy schema, validation engine, policy builder APIs, SoD evaluator tests | Policies evaluate correctly via unit + integration tests |
| **B28.5** – Permission cache & guardrails | Redis cache, warmers, metrics/telemetry, benchmark harness | Cache hit rate + p95 metrics logged and within budgets |
| **B28.6** – Role matrix UI & policy editor | React components, Storybook, CLI flows, a11y/VRT | UI meets a11y targets, Chromatic tagging in place |
| **B28.7** – Trait integration & entitlement export | Wire Authable into User/Org, entitlement export CLI/docs, Storybook + integration tests | Composition tests pass, CLI exports validated |
| **B28.8** – Sprint close-out | Retrospective, changelog, diagnostics, context sync, Sprint 29 hooks | Context snapshots + backlog ready for Sprint 29 |

## Dependencies & Interfaces

- Reuse Preferenceable registry/migration/diagnostics scaffolding (`src/traits/preferenceable/*`, cache + CLI patterns) per overview guidance.
- Permission cache (B28.5) depends on runtime contracts from B28.3 and storage from B28.2.
- UI/CLI work (B28.6–B28.7) depends on schema + runtime outputs from B28.1–B28.4.
- Next sprint (29) requires clean entitlement export + RBAC hooks for messaging permissions.

## Risks / Mitigations

- **Scope creep:** Keep mission acceptance tied to the deliverables captured in backlog metadata; defer Communication pack prep to Sprint 29.
- **Performance regressions:** Benchmarks + telemetry from B28.5 must mirror Preferenceable cache metrics; add diagnostics entries before completion.
- **Testing debt:** Maintain ≥90 % coverage per PROJECT_CONTEXT; integrate Chromatic TurboSnap & Storycap fallback steps into UI missions.

## Quality Prep

Track all pre-flight guardrails in `cmos/planning/sprint-28-quality-prep.md` (Chromatic tagging, Storycap posture, coverage thresholds, diagnostic placeholders). Complete this checklist before starting B28.1 so every subsequent mission inherits the configuration and mission notes can reference the prep artifacts.

## Immediate Next Steps

1. Align stakeholders on mission order and orchestration pattern (default linear unless blockers arise).
2. Prepare research excerpts (R21.2) as reference snippets for missions B28.1–B28.4.
3. Kick off B28.1 once ready, ensuring mission runtime loads updated backlog and logging start/completion events via helpers.
