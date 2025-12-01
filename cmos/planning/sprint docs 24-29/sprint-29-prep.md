# Sprint 29 Prep – Communication Extension Pack

**Date:** 2025-11-20  
**Status:** Ready for execution  
**References:** `cmos/planning/sprint-24-30-roadmap.md`, `cmos/planning/sprint-28-retrospective.md`, `docs/changelog/sprint-28.md`  
**Research Inputs:** `cmos/research/R20.1_Canonical-Notification-Model.md`, `cmos/research/R20.6_Modern-Messaging-Systems.md`

---

## Objectives
1. Deliver the **Communication Extension Pack** (Messaging/Notification stack) building on Authable permissions + Preferenceable routing.
2. Ship canonical schemas for channels, templates, delivery policies, and message audit logs mapped to R20.1/R20.6 research findings.
3. Provide runtime + UI surfaces for composing channel strategies, permission-gated delivery, and communication timelines.
4. Keep guardrails parity with Sprint 28: SoD-aware permission checks (<5 ms p99), cache metrics, a11y + Chromatic coverage, diagnostics/context updates.

---

## Context Snapshot
- Sprint 28 close-out synced diagnostics + MASTER_CONTEXT; contexts highlight Authorization decisions and Communication focus.
- Authable trait + CLI + UI kit are production-ready and must be reused, not forked.
- Preferenceable registry + notification matrix remain the template for templating + UI logic; integrate rather than reimplement.

---

## Integration Points
- **Authable ↔ Communication**: message templates + delivery policies must reference Authable roles/permissions to gate senders + recipients. Use EntitlementService/PermissionCache for gating.
- **Preferenceable ↔ Communication**: reuse preference document schemas + registry for opt-in/out, channel defaults, and notification matrices.
- **Classifiable ↔ Communication**: optional tagging of communication events to route to dashboards + audit feeds.

---

## Draft Mission Outline
| Mission | Focus | Key Deliverables |
| --- | --- | --- |
| C29.1 | Messaging trait foundation | Trait spec, schemas (channel, template, delivery policy), registry + validator, docs w/ citations to R20.1/20.6 |
| C29.2 | Notification/Messaging datastore | Postgres migrations (messages, delivery_attempts, timeline view, audit log) + CLI seeding + docs |
| C29.3 | Delivery runtime + permission bridge | Queue adapters, channel resolvers, Authable-permission gating, Preferenceable hook to derive recipients |
| C29.4 | Policy builder + SLA guardrails | Policy DSL, throttling + quiet-hour enforcement, SLO metrics, diagnostics entries |
| C29.5 | Communication UI kit | Timeline, ChannelPlan Editor, DeliveryHealth widget, Storybook + a11y coverage |
| C29.6 | Integrations + exports | Hook trait into User/Org, sample objects, CLI exporters (message transcript, audit bundles) |
| C29.7 | Sprint close-out | Retrospective, changelog, diagnostics, contexts, Sprint 30 preview |

(Mission IDs will be formalised via backlog update; placeholder `C29.*` indicates Sprint 29 track.)

---

## Quality & Guardrails Checklist
- **Performance:** Permission checks + delivery routing must stay <5 ms p99 by reusing PermissionCache or layering on new queue metrics.
- **Testing:** Maintain ≥90 % coverage for new packages; include `tests/performance/communication-cache.test.ts` equivalent for new caches.
- **Visuals/A11y:** Extend Storybook + Chromatic coverage for new communication components; run `pnpm a11y:diff` before close-out mission.
- **Diagnostics:** Add Communication pack entry mirroring Sprint 28 structure (trait/docs/migrations/tests) with updated helper stats.
- **Contexts:** Update MASTER_CONTEXT decisions + constraints as soon as Communication governance choices are made; capture snapshot at start + end.

---

## Dependencies & Prep Work
- Ensure Sprint 28 assets merged (Authable trait, CLI, docs) – confirmed via `diagnostics.json` + MASTER_CONTEXT.
- Keep cache instrumentation scripts handy (`tests/performance/permission-cache-benchmarks.test.ts`) to prove budgets when hooking communication flows.
- Pull excerpts from R20.1 (Notification taxonomy, SLA tables) and R20.6 (Message bus patterns) into mission YAMLs for citations.

---

## Next Steps
1. Promote the first Sprint 29 mission via mission runtime (`next_mission()` will surface once backlog entries exist).
2. Duplicate Sprint 28 mission template structure when authoring C29.* YAMLs (research, deliverables, guardrails, validation plan).
3. Set up Chromatic branch baselines + communication-specific Storycap fallback ahead of component work.
4. Reconfirm DB health + context snapshots before starting (run `./cmos/cli.py validate health` & `./cmos/cli.py db export contexts`).
