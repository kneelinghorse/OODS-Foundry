# OODS Foundry — Roadmap to Release

> Updated after Sprint 17 direction check. Captures the remaining waves from Sprint 17 through general availability, with guardrails aligned to recent research.

---

## Snapshot & North Star
- **Now:** Sprint 17 (Converged Core & Billing Boundary).
- **Release Target:** Ship a production-ready design system + agent harness with converged compliance core, canonical billing boundary, multi-brand/domain coverage, and brownfield adoption tooling.

**Release signals**
- Compliance core (RBAC, Audit) enforced via CI/agents; tenancy toggles documented and operating.
- Billing ACL + canonical lifecycle powering at least two domains with usage-based metering proofs.
- 20+ components across brands/domains, perf budgets & HC/axe/VR gates green.
- Brownfield adoption guide validated by pilot teams; docs & CLI support release workflows.

---

## Sprint 17 — Converged Core & Billing Boundary *(In Flight)*
- **Focus:** Compliance core (Identity/RBAC/Audit), billing ACL & canonical states, tenancy scaffold, usage ingest v0, temporal hygiene, brownfield docs.
- **Exit criteria:**
  - RBAC + audit services gated via CI; Storybook/CLI proofs demonstrate deny/allow paths.
  - Tenancy bridge documented (shared vs isolated) with seeds/tests.
  - Provider adapters translate to canonical BillingAccount/Subscription/Invoice; no vendor leakage.
  - Subscription (7-state) & Invoice (5-state) machines drive tokens/stories; delinquency derived consistently.
  - Usage ingest aggregator populates invoices; docs show dual-time (business/system) adoption.
  - Brownfield adoption guide v1 published with CLI/Storybook aids.

---

## Sprint 18 — Component Set IV & Final QA Wave
- **Focus:** Component Set IV (Progress/Stepper, Tabs, Pagination, Breadcrumbs, Empty-states kit, Banner variants, Toast queue) + system-scale QA (perf harness, multi-brand/domain drills, docs roll-up).
- **Key threads:**
  1. **Component delivery:** Finish high-priority primitives with multi-brand, HC, and token alignment.
  2. **QA & perf harness:** Snapshot perf budgets, expand VR/a11y galleries, run cross-brand/domain drills.
  3. **Docs consolidation:** Release-ready documentation (API, adoption, guardrails) and Storybook Explorer narratives.
- **Exit criteria:**
  - 20+ components proven across both brands/domains with VR ≥98% per brand.
  - Perf harness outputs logged to diagnostics; budgets green (compositor ≤7ms, list demo ≤150ms, token transform ≤3s).
  - Docs roll-up complete; Storybook Explorer surfaces composition proofs and adoption playbooks.
  - Optional: public readiness assessment (OSS packaging checklist) scoped for Sprint 19.

---

## Sprint 19 — Design System Hardening & Packaging Readiness
- **Focus:** Polish Component Set IV deliverables, finalize guardrails, and dry-run the packaging pipeline without external pilots.
- **Candidate missions:**
  - Component polish & QA sweep: cross-brand design review, accessibility retest, documentation cleanup.
  - Packaging dry run: rerun build → test → package → provenance with release toggles disabled; capture gaps.
  - Guardrail automation expansion: extend lint/tests for metadata policy, tenancy misuse, token governance dashboards.
  - Diagnostics refresh: align perf/a11y dashboards, validate perf harness baselines, update runbooks.
- **Exit criteria:**
  - Components/APIs accepted across brands with updated docs and Storybook narratives.
  - Packaging dry run produces verified artifacts and playbooks (no publish).
  - Guardrail dashboards & alerts green across component/token/usage footprints; gaps documented.
- **Note:** Brownfield pilot is deferred until after the private review (post-Sprint 20).

---

## Sprint 20 — Private Review Preparation
- **Focus:** Assemble a private release candidate, enable trusted reviewers, and stage post-review follow-up (pause before public launch).
- **Candidate missions:**
  - Private RC build & freeze: lock baselines, generate review-ready packages, document rollback plan.
  - Reviewer kit & walkthroughs: curate Storybook journeys, API notes, and evaluation checklists for invited reviewers.
  - Feedback triage backlog: set up intake loop, prioritize fixes, capture go/no-go criteria.
  - Optional readiness audit: inventory remaining gaps for full release / OSS exposure and park in backlog.
- **Exit criteria:**
  - Private RC artifacts delivered to reviewers with supporting documentation.
  - Reviewer enablement materials complete; feedback channel operational.
  - Post-review backlog filed with explicit decision gate for public release.
  - Formal pause recorded pending reviewer sign-off and any follow-up work.

---

## Guardrails & Scale Watch (S17 → Release)
- **Compliance:** No vendor terms in core types; RBAC/audit enforced via CI + agent policies.
- **Tenancy:** TENANCY.md maintained; mode toggles tested in pipeline; seeds kept in sync.
- **Tokens & states:** DTCG-only JSON; status enums mapped → tokens → UI with Storybook proofs; governance job P0 on drift.
- **Temporal:** Dual-time convention applied to new fields; lint blocks naive Date usage.
- **Perf budgets:** Harness writes metrics to diagnostics; alerts triggered for regressions >15% week-over-week.

---

## Dependencies & Sequencing Notes
1. Sprint 17 outputs (RBAC, tenancy, billing ACL, canonical states) feed Sprint 18 components/QA.
2. Sprint 18 perf harness + docs roll-up inform Sprint 19 release hardening backlog.
3. Sprint 19 pilots determine final tweaks and feed Sprint 20 release candidate scope.

Keep revisiting research direction docs (e.g., Industry R1.1–R1.4, Sprint 17 direction check) when refining missions; update this roadmap after major discoveries.
