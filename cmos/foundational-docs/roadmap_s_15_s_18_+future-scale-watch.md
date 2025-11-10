# OODS Foundry — Roadmap S15–S18 & Scale Watch

> Purpose: capture the next waves of work, likely scope creep, and technical guardrails as we scale the system (View Engine, cascading traits, multi‑brand governance, token counts → 1,000+). This complements `PROJECT_CONTEXT.json` and the Sprint 15 mission set.

---

## 0) Snapshot & North Star
- **Now:** Sprint 15 (multi‑brand + component scale‑out + brand governance + onboarding).
- **North Star:** A production‑ready design system + agent harness that scales to multiple brands/domains, ships internal packages, and keeps visual quality & a11y stable under continuous change.

**Success signals**
- VR green ≥ 98% per brand; AA + HC pass on curated stories; zero literal colors/px; transform time and CSS var count within budgets; incident‑linked PRs resolved in < 1 session.

---

## 1) Roadmap Overview (S15 → S18)

### Sprint 15 — Ecosystem Readiness & Multi‑Brand (Current)
- **S15.1** Multi‑brand scaffolding (brand‑b, brand switcher, brand‑bleed lint, per‑brand baselines)
- **S15.2** Component scale‑out I — Statusables (Badge, Banner/Alert, Toast) using enum→token
- **S15.3** Component scale‑out II — Inputs & Tables (density, validation, HC focus)
- **S15.4** Token governance for brands (no orphans, overlay policy, PR token‑diff)
- **S15.5** Onboarding docs (design/dev quickstarts; PR template links; Agent Recipes index)

**Exit criteria**: Two brands pass VR/a11y/HC; statusables & inputs/tables proven across both; governance job blocks risky token deltas; onboarding tested from clean clone.

---

### Sprint 16 — Internal Packaging + Component Set III
- **Packaging (internal)**
  - Private dist per package (`@org/…`), semver, provenance artifacts, conventional commits → changelog.
  - SB add‑on compatibility check; attach SB build hash to package metadata.
- **Component Set III (layout & overlays)**
  - Dialog/Sheet, Tooltip, Menu, Popover, Dropdown primitives; Z‑index tokens and focus traps honoring HC.
  - Grid/List layout primitives, Card groups, Toolbar and Page header regions.
- **Agent Recipes++**
  - `stories.curate` matrix generator; `docs.onboarding` updater links versioned commands.

**Exit criteria**: Packages install cleanly in a sandbox app; overlay/focus patterns pass HC; preview hash ↔ package version traceable.

---

### Sprint 17 — Second Domain & Integration Polish
- **Second domain slice** (e.g., Subscriptions or Users): proves traits/regions with different enums & flows.
- **Integration polish**
  - Region snapshot tests for page‑level coverage; composition proof tables (final props after cascade) rendered in stories.
  - Agent recipe for **enum→token drift** across the new domain.

**Exit criteria**: Two domains render across list/detail/timeline with shared patterns; composition proofs visible; drift repair recipe green.

---

### Sprint 18 — Component Set IV & Final QA Wave
- **Component Set IV**
  - Progress/Stepper, Tabs, Pagination, Breadcrumbs, Empty‑states kit, Banner variants (sticky, inline), Toast queue.
- **Final QA wave**
  - Multi‑brand, multi‑domain drill; perf harness snapshots; VR/a11y debt burn‑down; docs roll‑up.
- *(Optional)* **Public readiness** (OSS packaging, docs site, contributor flow) if desired.

**Exit criteria**: Coverage target of 20+ components proven across brands; perf budgets respected; docs consolidated for internal or public consumption.

---

## 2) Scope Creep Radar & Guardrails
- **Creep vector: bespoke component variants** → enforce **Pure Modifier**; no brand/theme awareness inside components. Lint & CI block literals and cross‑brand imports.
- **Creep vector: tokens exploding without ownership** → token governance job: orphans, overlay violations, PR token‑diff with risk hints (contrast, focus, radius). High‑risk deltas require `token-change:breaking` + CODEOWNER review.
- **Creep vector: ad‑hoc context hacks** → region contracts + snapshot tests; contextual defaults live in region model, not components.
- **Creep vector: agent scope drift** → policy allowlist + dry‑run default; approvals carry IncidentId links; deny with friendly, documented errors.

**Decision gates**
- Block merge if: a11y/HC fails, VR diffs without rationale, token governance high‑risk change unlabeled, or literal tokens appear in components.

---

## 3) View Engine Plan — Contract & Tests
**Goals**: deterministic render from (Object × Region × Context) with pure modifiers; no side‑effects.

**Contract**
- **Inputs**: object (data + traits), region (slot map), context (brand/theme/HC), modifiers (size, density, emphasis).
- **Outputs**: component graph + resolved props tree (post‑cascade), ARIA map, token slots.

**Tests & tooling**
- **Region snapshot stories**: page‑level coverage with slot assertions.
- **Composition proof tables**: MDX view that prints resolved props per component after trait cascade.
- **Purity gates**: static check that components don’t import brand/theme/token files directly; only read semantic tokens from the injected theme layer.
- **Slot contract tests**: verify required slots present; flags if unknown slots are passed.

---

## 4) Cascading Traits — Determinism & Conflict Policy
**Merge order** (example; make explicit in types):
1. **Object defaults**
2. **Traits (deterministic order)**
3. **Contextual defaults (region)**
4. **Explicit modifiers/props**

**Conflict rules**
- **Last‑writer wins** only within the same precedence tier; otherwise higher tier prevails.
- **Enum union** for status/intent; if conflict → escalate to warning & require explicit override.
- **Side‑effect ban**: traits cannot directly mutate unrelated props; they compose via a shared resolver.

**Diagnostics**
- Emit a **cascade trace** (list of setters with source: trait/object/region/modifier) in debug mode; surface in Storybook for review.

---

## 5) Token Scale — 1,000+ tokens without pain
**Authoring**
- DTCG only (no experimental interpolation in production); composites as consumption layer; aliasing controlled.
- Namespace policy: `base/`, `alias/`, `semantic/`, `theme/brand‑*` with documented overlay permissions.

**Build**
- Log **transform time** and **emitted var count** to `diagnostics.json` each PR; alert on >15% weekly growth.
- Generate **per‑brand CSS** chunks; consider code‑splitting for app consumption if needed.

**Runtime**
- Keep token → CSS var → component lookup O(1). Prefer fewer reflows: group token changes into a single stylesheet swap for brand/theme switches.

**Governance**
- Orphan detection; cross‑brand leak checks; PR token‑diff summary (added/removed/aliased) with risk hints.

---

## 6) Performance Budgets & Early Warnings
- **Compositor**: ≤ 7 ms for 10 traits (median story); warn at 10 ms.
- **List/Table demo**: 100 rows render ≤ 150 ms; warn at 200 ms.
- **Token transform**: ≤ 3 s for 1,000 tokens + 2 brands; warn at 5 s.
- **CSS var count**: soft cap 4,000 total across brands; warn above 5,000.
- **VR green rate**: ≥ 98%; alert under 96%.

Add a tiny perf harness that writes these to `diagnostics.json` and prints a summary in PR comments.

---

## 7) Packaging & Versioning (Internal First)
- **Semver discipline** with `feat`/`fix`/`chore`; pre‑releases for risky visual changes.
- **Provenance**: attach SB build hash and VR baseline snapshot ID to package metadata.
- **Compat**: SB add‑on compatibility check in CI.

---

## 8) Agent Extensions (Nice‑to‑Have as We Scale)
- **Batch PRs**: allow recipes to open N small PRs (label‑grouped) when diffs are logically separate.
- **Token impact sim**: dry‑run shows affected stories/components before approval.
- **Perf probe**: recipe that runs the perf harness and posts trend charts to PRs.

---

## 9) Risks & Mitigations (Cheat Sheet)
- **View engine drift** → region snapshots, slot tests, purity lint.
- **Trait conflicts** → explicit precedence + cascade traces, contract tests.
- **Token bloat** → governance job + PR diff summary + budgets.
- **Brand bleed** → brand‑bleed lint + per‑brand baselines.
- **A11y regressions** → a11y contract (axe/HC) mandatory; baselines with links to failing stories.
- **Agent overreach** → policy allowlist; dry‑run default; IncidentId on every execution.

---

## 10) Open Questions (to revisit in planning)
- Do we need **per‑domain theme accents** (e.g., Finance vs Admin) or keep brand strictly visual?
- Should **Dialog/Sheet** adopt a single trap/focus manager shared across overlays?
- Is public OSS on the table for S18, or do we hold until S19 with docs site polish?

---

## 11) Decision Gates (per sprint close)
- **S15**: Two brands pass all gates; statusables & inputs/tables proven; governance blocking risky token diffs.
- **S16**: Internal packages install cleanly; overlay/focus patterns pass HC; provenance & compat checks green.
- **S17**: Second domain renders with shared patterns; composition proofs visible; drift repair green.
- **S18**: 20+ components across brands; perf budgets respected; docs consolidated.

---

## 12) Links & Pointers
- Project context: `PROJECT_CONTEXT.json`
- Backlog: `cmos/missions/backlog.yaml`
- Agent recipes: `docs/mcp/Agent-Recipes.md`
- Onboarding: `docs/onboarding/design-quickstart.md`, `docs/onboarding/dev-quickstart.md`
- Tokens overview: `docs/tokens/4-layer-overview.md`
- HC & color: `docs/policies/high-contrast.md`, `docs/policies/hc-quickstart.md`
- Modifier purity: `docs/patterns/modifier-purity.md`
- Regions/specs: `docs/specs/regions.md`

