# Sprint 28-30 Extension Pack Overview

**Date:** 2025-11-19  
**Status:** Ready for execution  
**Sources:** `cmos/research/R21.2_Canonical-Data-Models-for-Authorization-Systems.md`, `cmos/research/R20.1_Canonical-Data-Model-for-Modern-Notification-Systems.md`, `cmos/research/R20.6_Foundational-Analysis-of-Modern-Message-and-Communication-Systems.md`, `cmos/research/R20.2_Modern-Media-Management-A-Canonical-Data-Model.md`, `cmos/research/R20.3_Canonical-Data-Model-for-Comment-and-Review-Systems.md`, Sprint 27 diagnostics

---

## Phase Goals
- Transition from Core Trait Expansion → Extension Packs while keeping trait engine + registry pipelines stable.
- Deliver three packaged capabilities that layer on Addressable/Classifiable/Preferenceable foundations and reuse Preferenceable registry/migration scaffolding.
- Ensure each sprint ships: canonical schema + migrations, runtime services + React components, diagnostics + docs, and context updates.

---

## Sprint 28 – Authorization Extension Pack

### Scope Highlights
- Multi-tenant RBAC (canonical 5-table model from R21.2) with role hierarchies + inheritance.
- Separation-of-duty constraints + approval workflows (SoD, Quorum, Dual-Control) with policy builder UI.
- Resource/action catalog + query optimizer that hooks into object registry metadata.
- Audit + entitlement export surfaces for downstream services + CLI.

### Target Deliverables
- Trait + schema modules: `Authable` trait spec, role/permission JSON Schemas, TypeScript DTOs, registry + validator similar to Preferenceable pipeline.
- Database migrations: canonical tables (`auth.roles`, `auth.role_assignments`, `auth.policies`, `auth.sessions`, `auth.audit_log`) plus triggers + SoD constraints.
- Runtime services: role graph resolver, SoD evaluator, permission caching (reuse PreferenceCache pattern) with docs under `docs/traits/authorization-trait.md`.
- UI: Role Matrix + policy editor components, CLI for seeding + exporting entitlements, Storybook stories.
- Tests: schema/trait suites, policy engine unit tests, integration ensuring User/Organization objects compose Authable + existing traits.

### Dependencies & Notes
- Reuse Preferenceable migration logger + cache metrics for RBAC token caching.
- Use `cmos/planning/sprint-27-retrospective.md` + `diagnostics.json` as references for documentation format.

---

## Sprint 29 – Communication Extension Pack

### Scope Highlights
- Notification orchestration (fan-out, channel routing) per `R20.1` with Preferenceable integration (matrix + filters).
- Conversation/message primitives (threads, participants, read state) per `R20.6`.
- Delivery telemetry + retries, timeline view extensions, CLI to inspect queues and replay.

### Target Deliverables
- Schemas + migrations for `notification_events`, `delivery_attempts`, `conversations`, `messages`, `participants`.
- Runtime services: channel router leveraging Preferenceable matrix + PreferenceFilter, delivery pipeline with retry policies, conversation service.
- React components: Notification Center, Inbox/Threads, Delivery diagnostics panel, CLI commands.
- Docs: Notification routing guide, messaging data model, preference-routing integration, runbooks for queue drains.
- Tests: queue/service unit tests, Preferenceable integration tests, React a11y suites, timeline/inbox VRT.

### Dependencies & Notes
- Builds atop Preferenceable registry + NotificationMatrix code; share schema-driven forms for channel overrides.
- Requires Sprint 28 RBAC hooks for message permissions.

---

## Sprint 30 – Content Management Extension Pack

### Scope Highlights
- Media/asset management (upload pipeline, renditions, metadata) from `R20.2`.
- Comment/review system (moderation queues, threading, reactions) from `R20.3`.
- Content timeline view extensions + ActivityLog integration.

### Target Deliverables
- Schemas + migrations for `media_assets`, `renditions`, `comments`, `moderation_events`, `content_relations`.
- Runtime: asset processor interface, rendition registry, moderation service, comment notification hooks (ties into Sprint 29 pipeline).
- React components: MediaManager, CommentThread, ModerationQueue, reference Storybook docs.
- Docs: Content governance, CDN strategy, migration guide for legacy content.
- Tests: media processor mocks, moderation rules, React a11y + integration with Classifiable + Preferenceable traits.

### Dependencies & Notes
- Consumes Addressable/Classifiable tagging + Preferenceable notification settings for comment alerts.
- Reuses diagnostics + context update flow established this sprint.

---

## Cross-Sprint Threads
- **Schema Registry & Diagnostics** – replicate Preferenceable registry + diagnostics entry for each pack to keep contexts consistent.
- **Migration Logging** – continue using `preferences.migration_log` pattern for RBAC/Communication/Content schema changes (new schemas will need analogous tables).
- **Performance Guardrails** – include cache metrics + indexes per sprint to maintain <10 ms budgets.
- **Documentation** – produce retrospective + changelog per sprint plus update `docs/changelog/` + `cmos/context/MASTER_CONTEXT.json` after each close-out.

---

## Entry Criteria & Next Steps
1. Promote Sprint 28 missions (B28.1-B28.8) to `Current` via `next_mission()` once backlog entries exist; use this document as mission context reference.
2. Stand up RBAC registry + trait scaffolding using Preferenceable code as template (schema registry, validator, CLI, Storybook sections).
3. Keep diagnostics + master context synced to SQLite after each sprint (`SQLiteClient.set_context`), mirroring today’s close-out workflow.
