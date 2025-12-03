# Sprint 37 Plan: Navigation Phase 2 - Hero Demos

**Created:** 2025-12-03
**Status:** Planned
**Focus:** Hero demos proving OODS value proposition
**Estimated Effort:** 8-11 hours

---

## Sprint Overview

Sprint 37 executes **Phase 2** of the [Navigation Implementation Plan](../reports/oods-navigation-implementation-plan.md). The goal is to build showcase demos that prove OODS's unique value—moving beyond the Phase 1 foundation work completed in Sprint 36.

### Sprint 36 Recap (Completed)
- B36.1: Storybook nav hierarchy configured, Explorer stories excluded
- B36.2: Philosophy MDX documentation created
- B36.3: Trait Engine and Getting Started MDX created
- B36.4-B36.5: ~75 story titles renamed to new hierarchy

### Sprint 37 Missions

| ID | Mission | Est. Hours | Depends On |
|----|---------|------------|------------|
| B37.1 | Verification & Stabilization | 1-2 | - |
| B37.2 | Object Matrix MVP | 1-2 | B37.1 |
| B37.3 | Statusable Demo | 2-3 | B37.1 |
| B37.4 | Same Object Different Contexts | 2 | B37.1, B37.2 |
| B37.5 | Quick Wins | 1-2 | B37.1 |

---

## Key Decisions from Planning Session

### 1. Object Explorer: Static MVP First

**Decision:** Build a static 3×3 matrix instead of full interactive demo.

**Rationale:**
- The insight we're selling is simpler than the implementation implies
- "Same object → different contexts → different renderings" can be proven statically
- Full interactivity can come in Sprint 38 if the MVP proves the concept

**Effort Impact:** Reduced from 8 hours to 1-2 hours

**Audit Finding:** `RenderObject` and `context-gallery.stories.tsx` already exist—this is relocation + enhancement, not build-from-scratch.

### 2. Statusable: Visual Gallery First, API Docs Second

**Decision:** Lead with what designers need ("what does 'delinquent' look like?"), then explain mechanics for developers.

**Structure:**
```
Statusable.stories.tsx:
  - SubscriptionStates (visual grid)
  - InvoiceStates (visual grid)
  - PaymentIntentStates (visual grid)
  - TicketStates (visual grid)
  - UserStates (visual grid)
  - HowItWorks (API/mechanics demo)
```

**Key Constraint:** Use main `Badge` component from `src/components/base/Badge.tsx`, NOT Explorer's `StatusChip`. The port is about content and presentation, not the component itself.

### 3. Verification Before Building

**Decision:** Sprint 37 starts with a "Sprint 0" verification task.

**Rationale:** After renaming 75 stories in Sprint 36, we need confidence the foundation is solid before building on top.

**Checklist:**
- Build check: `pnpm build-storybook`
- Dev check: `pnpm storybook`
- Visual spot-check: 5-10 random stories
- Nav structure check: Sections in correct order

### 4. Sprint Scope: Phase 2 + Quick Wins

**Decision:** Option C—mix Phase 2 hero demos with polish items.

**Included:**
- Object Matrix MVP (hero demo)
- Statusable Demo (hero demo)
- Same Object Different Contexts (hero demo)
- Tooltip story (quick win)
- Explorer nav verification (quick win)

**Deferred to Sprint 38:**
- Trait catalog expansion (Phase 3)
- Additional object stories (Plan, Transaction)
- Full interactive Object Explorer
- MDX docs beyond Phase 1

---

## Infrastructure Audit Summary

### RenderObject (src/components/RenderObject.tsx)
- **Status:** ✅ Exists and is sophisticated
- **Capabilities:** Takes object, context, data props; supports 6 contexts; auto-resolves trait extensions
- **Implication:** Object Matrix is a layout task, not a feature task

### Context Gallery (stories/proofs/context-gallery.stories.tsx)
- **Status:** ✅ Already built
- **Current Location:** "Proofs & Internals/Contexts/Domain Context Gallery"
- **Action:** Relocate to "Objects/Object Explorer/Full Context Gallery"

### StatusChip (apps/explorer/src/components/StatusChip.tsx)
- **Status:** ✅ Well-structured
- **Domains:** subscription, invoice, payment_intent, ticket, user
- **Action:** Port content to use main Badge component

---

## Success Criteria for Sprint 37

1. **Verification passes** - Storybook builds, nav loads correctly
2. **Object Matrix visible** - Users can see objects × contexts in a clear grid
3. **Statusable surfaced** - All 5 domain galleries render with correct status visuals
4. **Context comparison works** - User in all 8 contexts with annotations
5. **Quick wins completed** - Tooltip story exists, Explorer nav verified

---

## What Gets Deferred

### Sprint 38 Candidates
- Phase 3: Trait catalog expansion (Authable, Stateful, etc.)
- Additional object stories (Plan, Transaction, Article, Media)
- Full interactive Object Explorer (if MVP proves concept)
- SaaS Billing Flow pattern story

### Blocked Items (SUPERSEDED)
- B34.5-7: Replaced by ECharts-first approach
- B35.7-8: Replaced by comprehensive navigation plan

---

## References

- [Navigation Implementation Plan](../reports/oods-navigation-implementation-plan.md)
- [Sprint 36 Branch](sprint36/storybook-nav-renames) - merged
- Mission YAMLs: `cmos/missions/B37.*.yaml`

---

*Planning session conducted 2025-12-03 with infrastructure audit and scope refinement.*
