# Sprint 26 Plan: Classifiable Trait (Taxonomy + Tags)

**Status:** Draft ready for backlog load  
**Sprint Window:** Targeting late November 2025  
**Owner:** Core Trait Expansion (Data Model)

Sprint 25 proved the pattern for deep trait expansions (Addressable). Sprint 26 applies the same rigor to the Classifiable trait defined in R21.4: hierarchical categories (taxonomy), folksonomy tags, and a hybrid mode using the WordPress three-table pattern. The outcome enables every canonical object to organize content, products, and relationships with <3 ms ltree queries and governance for user-generated tags.

---

## 🎯 Objectives

1. **Foundational schema + runtime** — Ship trait definitions, metadata, and runtime helpers for taxonomy, tag, and hybrid classification modes with explicit configuration options.
2. **Hierarchy storage excellence** — Provide PostgreSQL ltree DDL, query helpers, and migration tooling plus fallbacks for adjacency/closure needs.
3. **Governance + tooling** — Deliver CLI + services for synonym mapping, tag moderation, category reparenting, and audit trails.
4. **Product surfaces** — Build React components (CategoryPicker, TagInput, BulkClassifier) with a11y + Storybook coverage and integrate with canonical objects.
5. **Diagnostics + readiness** — Extend docs/diagnostics with classification metrics, mission guidance for Sprint 27 (Preferenceable), and update master context accordingly.

**Success Criteria**
- Classifiable trait schema + metadata published with TS + JSON schema outputs.
- PostgreSQL ltree-based storage, Node adapters, and migration scripts validated with <3 ms subtree queries on 10k nodes.
- Folksonomy services enforce synonym + spam rules; CLI supports merges + audits.
- Hybrid mode (WordPress terms/taxonomy/relationships) operational with type-safe adapters + docs.
- React components + Storybook stories cover taxonomy navigation, tag entry w/ chips, and search facets (light/dark/high-contrast).
- User + Organization + Product objects adopt Classifiable; search/index helpers updated; diagnostics track classification coverage.

---

## 🗂️ Mission Breakdown

### **B26.1: Classifiable Trait Foundation & Schema**
**Dependencies:** Sprint 25 research + trait engine
- Define `Classifiable` trait YAML/TS specs covering configuration: `classification_mode`, `hierarchy_storage_model`, `tag_policy`.
- Add canonical value objects (`CategoryNode`, `Tag`, `ClassificationMetadata`) with Ajv/Zod parity.
- Generate TS types + validators; document decision tables (taxonomy vs. tag vs. hybrid) with cross-links to R21.4.

### **B26.2: Hierarchy Storage & ltree Infrastructure**
**Dependencies:** B26.1
- Author PostgreSQL DDL + migration helpers for ltree-backed taxonomy tables (categories, adjacency fallback, closure table guidance).
- Provide Node query utilities (ltree path builders, subtree/ancestor fetchers) and deterministic tests hitting dockerized PostgreSQL or sqlite mocks.
- Capture performance metrics (target <3 ms subtree query, <10 ms reparent) in diagnostics.

### **B26.3: Category Governance & CLI**
**Dependencies:** B26.1, B26.2
- Build `CategoryRegistry` service for create/reparent/retire operations with audit events.
- Extend CLI (`pnpm classify:categories`) with commands: `add`, `reparent`, `bulk-import`, `diff` (YAML ↔ DB synchronization).
- Author docs for governance workflows + context_update hooks.

### **B26.4: Folksonomy Tag Services**
**Dependencies:** B26.1
- Implement tag storage schema + `TagLedger` service (synonyms, merges, spam heuristics).
- Build moderation queue + heuristics (frequency, stop-words, suspicious combos) and tests.
- Provide CLI for merges + synonym mapping and docs for content strategists.

### **B26.5: Hybrid Mode & Relationship Layer**
**Dependencies:** B26.2, B26.4
- Implement WordPress-style bridging tables (`terms`, `term_taxonomy`, `term_relationships`) with type-safe adapters.
- Ensure taxonomy + tag operations share canonical `terms` table; tests cover dual roles for identical words.
- Document hybrid guidance, including caching + invalidation strategies.

### **B26.6: Classifiable UI Components & Stories**
**Dependencies:** B26.3, B26.4, B26.5
- Build `<CategoryPicker>` (tree, breadcrumbs, search) and `<TagInput>` (chips, autocomplete, moderation hints) plus `<ClassificationSummary>` for detail views.
- Provide high-contrast + reduced-motion stories, axe coverage, and Chromatic baselines.
- Ship docs for component usage + token guidance.

### **B26.7: Object Integration & Search Surfaces**
**Dependencies:** B26.5, B26.6
- Integrate Classifiable trait into User, Organization, Product objects with canonical category/tag sets.
- Update search/faceting helpers and diagnostics to reflect classification metadata.
- Provide migration scripts + examples showing taxonomy + tags in canonical objects.

### **B26.8: Sprint Close & Sprint 27 Prep**
**Dependencies:** B26.1–B26.7
- Produce retrospective + changelog + diagnostics for Classifiable rollout.
- Update master/project contexts with Sprint 26 completion and Preferenceable trait readiness.
- Seed Sprint 27 missions (Preferenceable trait) into database.

---

## 🔗 Dependencies

```
B26.1 (Foundation)
  ↓
B26.2 (Hierarchy) → B26.3 (Category Governance)
  ↓                 ↘
B26.4 (Folksonomy) → B26.5 (Hybrid)
          ↘             ↓
           → B26.6 (UI Components)
                         ↓
                     B26.7 (Integration)
                         ↓
                     B26.8 (Close)
```

Critical path: **B26.1 → B26.2 → B26.5 → B26.6 → B26.7 → B26.8**  
Supporting paths: **B26.1 → B26.3**, **B26.1 → B26.4 → B26.6**.

---

## 📦 Deliverables Checklist

- [ ] Trait definitions + schemas (`traits/classifiable/*.ts`, `schemas/classification/*.ts`)
- [ ] PostgreSQL ltree DDL + Node adapters + perf benchmarks (`scripts/db/classifiable/*.sql`, `tools/perf/classifiable.json`)
- [ ] CLI tooling (`scripts/classify/*.ts` or `pnpm classify:*`) for governance + merges
- [ ] React components + Storybook stories (`src/components/classifiable/*`)
- [ ] Docs + diagnostics updates (trait guide, governance playbook, changelog, diagnostics.json)
- [ ] Object registry + migration examples (User/Product/Organization) and integration tests

---

## ✅ Ready to Queue

- Research R21.4 + taxonomy benchmarks complete; we have reference DDL, query strategies, and governance heuristics.
- Addressable trait validated the trait-expansion workflow (trait → service → UI → context) and produced diagnostics scaffolding reused here.
- Dependencies (trait engine, CLI infrastructure, docs pipeline) already in place.
- Sprint 26 backlog entries prepared (B26.1–B26.8) with success criteria + deliverables for database load.

**Next steps:** Load missions into CMOS via SQLite/CLI, update backlog export, and kick off B26.1 once Sprint 25 completion is recorded in master context.
