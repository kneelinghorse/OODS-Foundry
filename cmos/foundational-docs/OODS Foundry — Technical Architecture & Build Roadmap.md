OODS Foundry — Technical Architecture & Build Roadmap

A living guide for building a human-centered, trait-based design system that keeps Figma and code in lockstep. Agents assist validation and governance; humans design and compose.

0) System Overview
Purpose

Deliver an enterprise-grade design system where traits (small, single-responsibility capabilities) compose into reusable objects (User, Subscription, Product, etc.). Figma is a client of the source-of-truth (Git), kept in sync via a plugin and CI. Agents assist with validation, audits, and docs generation — they do not design.

Guiding Principles

Composition over inheritance – small, granular traits; deterministic merge rules.

Code as source of truth – definitions in YAML/TS under version control.

Design parity – traits surface as variant properties, tokens, and nested components in Figma.

Validation first – schema, tokens, a11y, and dependency checks block merges.

Theme-agnostic – traits define namespaces; themes supply token values.

1) Subsystem Architecture

Each subsection lists Purpose, Responsibilities, Key Design Notes (implementation guidance), Dependencies, Success Criteria.

1.1 Trait Engine (finalized)

Purpose
Provide modular capability units (traits) that extend objects with schema, semantics, and optional view extensions.

Responsibilities

Authoring: trait files (.trait.yaml / .trait.ts) with trait/schema/semantics/views/dependencies/metadata.

Parameterization: JSON-Schema-validated parameters (e.g., Statusable.states).

Deterministic composition: topological sort, merge rules, collision policy.

Generated types: TS interfaces per composed object (preserving literal unions).

Key Design Notes

Merge order: Foundation → Base Object → Traits (topo) → Object overrides → Context overrides.

Collision policy: same type = prefer stricter; enums = union; optional vs required = required wins; incompatible = error; manual resolutions supported.

View extensions target canonical region IDs (e.g., pageHeader, viewToolbar, main, contextPanel).

Validation: deps acyclic, one state machine owner, token coverage, a11y tokens for interactive traits.

Dependencies
None (base of stack).

Success Criteria

30+ core traits pass unit validation and composition tests.

Composed objects generate stable types and renderable view pipelines.

CI enforces trait rules and fails fast on schema/token/a11y errors.

1.2 Object Registry

Purpose
Canonical, versioned object definitions that compose traits and add object-specific fields.

Responsibilities

Store *.object.yaml with: extends, traits[], schema, resolutions, views, metadata.

Generate typed contracts for devs and mapping manifests for Figma/plugin.

Provide discoverability (searchable registry) and ownership metadata.

Key Design Notes

Objects never duplicate trait logic; they compose traits and add only object-specific fields.

resolutions.fields/semantics enable explicit conflict choices & aliasing.

Namespacing for domain packs (ecommerce/Product, saas/Subscription) with promotion paths for shared traits.

Dependencies
Trait Engine.

Success Criteria

Universal Quintet (User, Organization, Product, Transaction, Relationship) + initial domain objects defined and validated.

Registry indexes support search by trait, token, owner, domain.

1.3 View Engine

Purpose
Context-aware rendering (list, detail, form, timeline, card, inline) that consumes composed objects and trait view extensions.

Responsibilities

<RenderObject> component: reads object spec → resolves trait views → builds pipeline → renders.

View extension compositor (priority, type, region targeting, idempotency keys).

Prop mapping from semantics to component props; runtime conditions honored.

Key Design Notes

Regions are the API between traits and components — no DOM selectors.

Keep modifiers pure (referentially transparent) for predictable composition.

Expose a small set of stable base components/regions to avoid brittle coupling.

Dependencies
Trait Engine, Object Registry, Token System.

Success Criteria

All contexts render for two or more representative objects.

Trait additions modify views without manual wiring (e.g., adding Taggable auto-adds tag chips in list/detail).

1.4 Token System

Purpose
Provide semantic, domain, component, and context-variant token layers with a theme-agnostic core.

Responsibilities

Define token namespaces per trait (e.g., status.*, tag.*, cancel.*).

Implement context variants (e.g., Tailwind plugin list: detail: form: timeline:).

A11y enforcement (focus/hover/disabled), contrast checks, and token coverage CI rules.

Key Design Notes

Traits only reference semantic tokens; themes supply values.

Provide a token browser and mapping tables for traceability (field → token).

No duplication for multi-brand — load different token value sets.

Dependencies
Trait Engine (namespaces), Validation/Governance.

Success Criteria

100% enum/status fields map to tokens; AA contrast passes for status/focus/error.

Context variants demonstrably change density/spacing without code changes.

1.5 Figma Integration Layer (Plugin + Library)

Purpose
Make traits tangible in Figma as variant properties, style bindings, and nested components — always aligned to Git.

Responsibilities

Plugin: Traits Panel (apply traits, enforce deps), write component metadata, run token/a11y checks, propose PRs.

CI: Git → Figma sync (update variants and mappings), no direct Figma→Git writes.

Library hygiene: Trait component sets, tokens library, object component pages.

Key Design Notes

Variant naming: TraitName:Field with kebab values.

Store trait manifest in plugin data (component description hidden JSON).

Prevent detaching trait instances; warn on detached color styles.

Dependencies
Object Registry, Token System, Validation.

Success Criteria

Designers can apply/remove traits via plugin; dependencies enforced.

Library publishes only after plugin validation (tokens & a11y).

1.6 Validation & Governance Pipeline

Purpose
Keep the system coherent: block invalid traits/objects/views/tokens; provide actionable feedback.

Responsibilities

Validators: schema, parameters, deps, tokens, a11y, view regions.

Severity: error (block), warn, info; standard ValidationIssue payloads.

Deprecation lifecycle: @deprecated → grace → removal; unified semver release.

Key Design Notes

Fast, headless checks for most rules; render only for visual/a11y snapshots.

PR templates enforce discovery and documentation.

Ownership recorded per trait/object.

Dependencies
All subsystems.

Success Criteria

CI prevents protocol violations; PR reports are human-readable with fix hints.

Deprecations tracked and surfaced in docs/plugin.

1.7 Docs & Developer Tools

Purpose
Make the system explorable, teachable, and operational.

Responsibilities

Object Explorer (Storybook): trait docs, dependency graphs, token previews, context live demos.

CLI utilities: validate, gen:docs, sync:figma, lint:a11y, compose:types.

Key Design Notes

Docs auto-generated from definitions; no hand-written API pages that can drift.

Keep CLI outputs deterministic and copy-paste-ready.

Dependencies
All subsystems.

Success Criteria

New contributors can author a trait in <60 minutes with docs + CLI alone.

Explorer shows end-to-end composition for at least 5 objects.

2) Architecture Dependencies (textual)

Trait Engine → foundation for everything.

Object Registry → composes traits; feeds View Engine & Figma.

Token System → consumed by views and Figma.

View Engine → renders composed objects using tokens.

Figma Integration → consumes registry/tokens; plugin enforces rules.

Validation/Governance → gates all merges; feeds CI and plugin.

Docs/Tools → consume registry & traits; support the whole loop.

3) Build Roadmap — Sprints 01…N

Each sprint targets 5–10 AI sessions. Research threads are optional and scoped only when needed to inform the build.

Sprint 01 — Trait Engine Foundations

Objectives

Implement authoring format, parameterization, dependency graph, and deterministic composition.

Ship initial validators and first 8–12 core traits (granular).

Core Deliverables

Composer with topo sort + collision policy + region IDs.

Validators (schema/params/deps/state-machine owner).

Traits: Stateful, Colorized, Labelled, Taggable, Cancellable, Archivable, Ownerable, Timestampable.

Research (if needed)

Compare enum/tuple typing patterns for best TS literal inference.

Outcomes

Traits compose into a prototype object; generated types compile; unit tests pass.

Sprint 02 — Object Registry & Type Generation

Objectives

Formalize object definition format and generation pipeline for TS types and manifests.

Core Deliverables

*.object.yaml format + registry index + resolvers.

Universal Quintet objects fully defined from traits.

Type generator preserving readonly tuples (as const).

Research

None unless TS generics need edge-case decisions.

Outcomes

Devs can import User, Subscription, etc. types with full trait schema.

Sprint 03 — View Engine (Contexts & Compositor)

Objectives

Build <RenderObject> and view extension compositor with canonical regions and priority pipeline.

Core Deliverables

Base context templates (list, detail, form, timeline, card, inline).

Extension compositor (wrapper/section/modifier/action; idempotency keys).

Two objects fully rendering across all contexts.

Research

Minimal; settle on base component API and region shape.

Outcomes

Adding/removing a trait changes UI through composition without manual stitching.

Sprint 04 — Token System & Context Variants

Objectives

Implement semantic/domain/component layers and context variant plugin.

Core Deliverables

Token namespaces per trait; AA contrast checks; coverage enforcement.

Tailwind (or equivalent) plugin for list: detail: form: timeline:.

Token browser + mapping tables.

Research

Brief survey of token naming in Carbon/Fluent for reference confidence.

Outcomes

All enum/status fields map to tokens; context variants alter density visually.

Sprint 05 — Figma Plugin (Apply/Validate/Sync)

Objectives

Deliver plugin that applies traits, validates deps/tokens/a11y, writes metadata, and scaffolds PRs.

Core Deliverables

Traits Panel; variant/style/nested-component generators.

Plugin metadata manifest; detached style warnings; dep prompts.

CI Git→Figma sync script (no Figma→Git writes).

Research

Figma API best practices for safe updates & metadata storage.

Outcomes

Designers compose traits in Figma; plugin prevents invalid combos; library publishes only after validation.

Sprint 06 — Validation & Governance Pipeline (CI)

Objectives

Centralize validators; standardize ValidationIssue payload; wire PR reporting.

Core Deliverables

Commands: validate:traits, validate:objects, validate:views, lint:a11y, validate:tokens.

PR report formatter with fix-hints.

Deprecation lifecycle enforcement; unified semver release scripts.

Research

None; codify rules you’ve already decided.

Outcomes

CI reliably blocks invalid changes; messages are actionable.

Sprint 07 — Docs & Object Explorer

Objectives

Make the system explorable: auto-docs + Storybook Object Explorer.

Core Deliverables

Doc generator (MDX) from registry; trait front-matter spec.

Explorer: trait pages, dependency graphs, token previews, live contexts.

Quickstart “author a trait in 60 minutes”.

Research

Minimal; choose graph lib for dependency viz.

Outcomes

New team members can learn traits/objects end-to-end with just the Explorer.

Sprint 08 — Domain Packs & Namespacing

Objectives

Introduce first domain pack (@oods/saas-pack) and namespacing conventions.

Core Deliverables

Domain traits (e.g., Billable, Payable, Refundable, Metered).

Objects: Subscription, Invoice, Plan, Usage.

Promotion rules for domain→core traits.

Research

Light scan of SaaS patterns to confirm minimal viable pack.

Outcomes

Domain pack composes seamlessly; registry handles namespacing; promotion path documented.

Sprint 09 — A11y & Interaction Hardening

Objectives

Lock down interactive trait requirements and cross-context behavior.

Core Deliverables

Interaction traits (Clickable, Focusable) with keyboard docs + focus tokens.

Playwright/axe regression per trait/context.

CI a11y budgets and thresholds.

Research

WCAG nuances for variants & focus outlines; pick opinionated defaults.

Outcomes

Interactive traits meet a11y baselines; failures are caught pre-merge and pre-publish (Figma plugin too).

Sprint 10 — Brownfield Integration & Adopters’ Guide

Objectives

Help teams adopt without rewrite; document migration patterns.

Core Deliverables

“Brownfield adapter” patterns (map existing components to objects/traits; opt-in regions).

Migration recipes (tokens, enums→traits, variants→traits).

Performance notes (tree-shaking, dynamic import, SSR considerations).

Research

None; this is consolidation + docs.

Outcomes

Teams can integrate gradually; confidence in real-world adoption.

Add more sprints as needed (e.g., multi-brand theming, cross-platform targets, extended domain packs). The count flexes with scope; this sequence preserves dependencies.

4) Ongoing Workflows

CI cadence: every PR runs validations, renders a11y snapshots, and posts a human-readable report.

Figma cadence: nightly Git→Figma sync; manual “Sync now” in plugin for branch validation.

Versioning: unified semver; changelog automation; deprecations announced in plugin & docs.

Documentation freshness: docs generated in CI on every merge; Explorer deploys with same version tag.

5) Definition of Done (DoD)

Trait Engine

All core traits validated; composition merges deterministic; conflict policy enforced; TS types emitted.

Object Registry

Quintet + initial domain objects pass validation; resolutions are explicit where needed.

View Engine

Each object renders in all contexts; trait view extensions appear in canonical regions; modifiers are pure.

Token System

100% enum/status fields mapped; AA contrast met; context variants working; token browser live.

Figma Integration

Plugin applies/validates traits, writes metadata, enforces deps; CI syncs library; publish blocked on a11y/token errors.

Validation/Governance

Standard ValidationIssue schema; PR reports with fix hints; deprecation lifecycle in effect.

Docs/Tools

Auto-docs + Explorer live; CLI tools stable; onboarding “author a trait in 60 minutes” verified.

6) How to Use This Document in Sprints

Start of sprint: pick the next architecture target(s) from the list above (usually the next subsystem or cross-cutting slice), confirm dependencies, and draft the week’s Research/Build sessions (5–10 items, sized to a single AI session each).

During sprint: keep the Trait Engine & Validation rules as the source of truth; update specs inline if design decisions change (don’t drift).

End of sprint: demo to yourselves (not a “marketing demo”): show validations passing, Figma parity, and docs/Explorer updates. If gaps remain, carry them forward; don’t cut corners.

Appendix: Canonical Region IDs (R3.1)

globalNavigation, pageHeader, breadcrumbs, viewToolbar, main, contextPanel
