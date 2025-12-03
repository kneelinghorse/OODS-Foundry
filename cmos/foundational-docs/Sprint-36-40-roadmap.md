# OODS Navigation Restructure Roadmap

**Sprints 36-40 | December 2025**

**Source:** [oods-navigation-implementation-plan.md](../reports/oods-navigation-implementation-plan.md)

---

## Executive Summary

This roadmap transforms OODS Foundry's Storybook navigation from a component-centric structure into an **object-centric, trait-based** architecture that teaches the OODS philosophy.

### Timeline Overview

| Sprint | Sessions | Focus | Key Deliverables |
|--------|----------|-------|------------------|
| **36** | 5 | Foundation | Nav config, 4 MDX docs, story renames |
| **37** | 4 | Hero Demos | Object Explorer, Context Comparison, Statusable |
| **38** | 4 | Catalog | Trait stories, object stories, viz consolidation |
| **39** | 4 | Patterns & Cleanup | Domain patterns, duplicate removal, fixes |
| **40** | 4 | Polish & Release | A11y docs, token docs, final verification |

**Total: 5 sprints, 21 sessions**

---

## Sprint 36: Foundation

**Goal:** Navigation skeleton + philosophy layer in place

### Sessions

| ID | Session | Focus | Mission File |
|----|---------|-------|--------------|
| 36.1 | Storybook Config | Nav sort config, exclude Explorer | [B36.1-storybook-nav-config.yaml](../missions/B36.1-storybook-nav-config.yaml) |
| 36.2 | Philosophy MDX | 1-philosophy.mdx, 2-core-concepts.mdx | [B36.2-philosophy-mdx.yaml](../missions/B36.2-philosophy-mdx.yaml) |
| 36.3 | Trait Engine MDX | 3-trait-engine.mdx, 4-getting-started.mdx | [B36.3-trait-engine-mdx.yaml](../missions/B36.3-trait-engine-mdx.yaml) |
| 36.4 | Story Renames Batch 1 | Objects, Traits, Contexts sections | [B36.4-story-renames-batch1.yaml](../missions/B36.4-story-renames-batch1.yaml) |
| 36.5 | Story Renames Batch 2 | Viz, Primitives, Proofs sections | [B36.5-story-renames-batch2.yaml](../missions/B36.5-story-renames-batch2.yaml) |

### Dependencies

```
B36.1 ──┬──> B36.2 ──> B36.3
        └──> B36.4 ──> B36.5
```

### Success Criteria

- [ ] Storybook builds with new nav structure
- [ ] Explorer stories excluded from main nav
- [ ] 4 MDX philosophy docs in "Understanding OODS" section
- [ ] All existing stories relocated to correct sections

---

## Sprint 37: Hero Demos

**Goal:** Object Explorer, Context Comparison, Statusable demo functional

### Sessions

| ID | Session | Focus | Deliverables |
|----|---------|-------|--------------|
| 37.1 | Tooltip + Statusable | Create Tooltip.stories.tsx, port StatusChip to Statusable.stories.tsx | See below |
| 37.2 | Object Explorer Scaffold | UI shell, object selector, trait toggles | See below |
| 37.3 | Object Explorer Wiring | Registry integration, RenderObject, context switcher | See below |
| 37.4 | Context Comparison | 8-context User comparison demo | See below |

### Key Deliverables

#### B37.1 - Tooltip + Statusable Demo

**Tooltip Story:**
- Path: `stories/primitives/feedback/Tooltip.stories.tsx`
- Component: `src/components/Tooltip/`
- Title: `Primitives/Feedback/Tooltip`

**Statusable Demo:**
- Path: `stories/traits/Statusable.stories.tsx`
- Source content: Port from `apps/explorer/src/stories/StatusChip.stories.tsx`
- Show all domains: Subscription, Invoice, PaymentIntent, Ticket, User states
- Interactive statusRegistry explorer: status → tone → token → visual mapping
- Use main Badge component (not Explorer's StatusChip)

#### B37.2-3 - Object Explorer

- Path: `stories/objects/ObjectExplorer.stories.tsx`
- Title: `Objects/Object Explorer`
- Features:
  - Object selector (dropdown of all 12 objects)
  - Trait toggles (show which traits are attached)
  - Context switcher (Detail, List, Form, Card, Timeline, etc.)
  - Live preview using RenderObject component
- Reference: Object definitions in `objects/` directory

#### B37.4 - Same Object Different Contexts

- Path: `stories/contexts/SameObjectDifferentContexts.stories.tsx`
- Title: `Contexts/Same Object Different Contexts`
- Show User object in all 8 contexts side-by-side:
  - Detail, List, Form, Card, Timeline, Inline, Chart, Dashboard
- Add annotations explaining what changes between contexts

### Success Criteria

- [ ] Tooltip story exists and renders correctly
- [ ] Statusable demo shows all 5 domain state mappings
- [ ] Object Explorer allows switching objects, traits, and contexts
- [ ] Context comparison demo shows 8 renderings of same User

---

## Sprint 38: Catalog Expansion

**Goal:** Traits visible, objects complete, viz consolidated

### Sessions

| ID | Session | Focus | Deliverables |
|----|---------|-------|--------------|
| 38.1 | Core Trait Stories | Authable, Stateful, Classifiable | See below |
| 38.2 | Lifecycle + Domain Traits | Timestampable, Archivable, Billable, Payable, Metered | See below |
| 38.3 | Missing Object Stories | Plan, Transaction, Article, Media, Relationship | See below |
| 38.4 | Viz Consolidation + TEP | Merge stories, create 5-tep-system.mdx | See below |

### Key Deliverables

#### B38.1 - Core Trait Stories

| Path | Title | Content |
|------|-------|---------|
| `stories/traits/Authable.stories.tsx` | `Traits/Core/Authable` | Role/permission system, membership patterns |
| `stories/traits/Stateful.stories.tsx` | `Traits/Core/Stateful` | State machine, transitions, statusRegistry integration |
| `stories/traits/Classifiable.stories.tsx` | `Traits/Core/Classifiable` | Consolidate classification/* stories |

#### B38.2 - Lifecycle + Domain Trait Stories

| Path | Title | Content |
|------|-------|---------|
| `stories/traits/Timestampable.stories.tsx` | `Traits/Lifecycle/Timestampable` | Temporal fields, formatting |
| `stories/traits/Archivable.stories.tsx` | `Traits/Lifecycle/Archivable` | Archive/restore lifecycle |
| `stories/traits/Cancellable.stories.tsx` | `Traits/Lifecycle/Cancellable` | Cancel flow, confirmation |
| `stories/traits/Billable.stories.tsx` | `Traits/Domain/Billable` | Billing integration |
| `stories/traits/Payable.stories.tsx` | `Traits/Domain/Payable` | Payment processing |
| `stories/traits/Metered.stories.tsx` | `Traits/Domain/Metered` | Usage metering |

#### B38.3 - Missing Object Stories

| Path | Title | Traits to Demonstrate |
|------|-------|----------------------|
| `stories/objects/domain/Plan.stories.tsx` | `Objects/Domain Objects/Plan` | Labelled, Stateful, Timestampable |
| `stories/objects/domain/Transaction.stories.tsx` | `Objects/Domain Objects/Transaction` | Timestampable, Payable, Refundable |
| `stories/objects/domain/Article.stories.tsx` | `Objects/Domain Objects/Article` | Labelled, Stateful, Ownerable |
| `stories/objects/domain/Media.stories.tsx` | `Objects/Domain Objects/Media` | Labelled, Ownerable, Timestampable |
| `stories/objects/domain/Relationship.stories.tsx` | `Objects/Domain Objects/Relationship` | Labelled, Timestampable, Stateful |

#### B38.4 - Viz Consolidation + TEP MDX

**Story Consolidation:**
- Keep component-level stories (Treemap, Sunburst, Sankey, ForceGraph)
- Archive or redirect echarts-level duplicates (`stories/viz/echarts/*`)
- Update component stories to reference internal echarts adapters

**TEP Documentation:**
- Path: `stories/docs/5-tep-system.mdx`
- Title: `Visualization/How TEP Works`
- Content: Token-Expression Pipeline explained
  - How viz tokens flow through adapters
  - Categorical color palette resolution
  - Integration with OODS token system

### Success Criteria

- [ ] 10+ trait stories visible in Traits section
- [ ] All 12 objects have stories
- [ ] No duplicate viz stories
- [ ] TEP system explained in MDX doc

---

## Sprint 39: Domain Patterns & Cleanup

**Goal:** Domain patterns visible, duplicates removed, issues fixed

### Sessions

| ID | Session | Focus | Deliverables |
|----|---------|-------|--------------|
| 39.1 | SaaS Billing Flow | End-to-end billing demo | See below |
| 39.2 | Authz/Comm Relocation | Move to Domain Patterns section | Story title updates |
| 39.3 | Duplicate Removal | Archive redundant stories | See below |
| 39.4 | Issue Fixes | PatternGallery, viz colors | Bug fixes |

### Key Deliverables

#### B39.1 - SaaS Billing Flow Pattern

- Path: `stories/patterns/SaaSBillingFlow.stories.tsx`
- Title: `Domain Patterns/SaaS Billing Flow`
- Content: End-to-end journey showing:
  - Subscription creation
  - Invoice generation
  - Payment processing
  - State transitions through lifecycle
- Use existing Billing components (Invoice, Subscription, Usage)

#### B39.2 - Authz/Communication Relocation

Already handled in B36.5, but verify:
- MembershipManager → `Domain Patterns/Authorization/Membership Manager`
- RolePermissionMatrix → `Domain Patterns/Authorization/Role Permission Matrix`
- MessageTimeline → `Domain Patterns/Communication/Message Timeline`
- ConversationThread → `Domain Patterns/Communication/Conversation Thread`

#### B39.3 - Duplicate Removal

| Keep (Canonical) | Remove/Archive | Reason |
|------------------|----------------|--------|
| `src/stories/statusables/Toast.stories.tsx` | `stories/components/Toast.stories.tsx` | Statusables is canonical |
| `src/stories/statusables/Banner.stories.tsx` | Any duplicates | Statusables is canonical |
| `src/stories/base-stories/Badge.stories.tsx` | Any duplicates | Base is canonical |
| `stories/components/Treemap.stories.tsx` | `stories/viz/echarts/Treemap.stories.tsx` | Component is user-facing |
| `stories/components/Sankey.stories.tsx` | `stories/viz/echarts/Sankey.stories.tsx` | Component is user-facing |
| `stories/components/Sunburst.stories.tsx` | `stories/viz/echarts/Sunburst.stories.tsx` | Component is user-facing |

#### B39.4 - Issue Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| PatternGalleryV2 responsive | `stories/patterns/PatternGalleryV2.stories.tsx` | CSS grid adjustments |
| Patterns edge clipping | VizContainer CSS | Container overflow settings |
| TEP color palette not passing to ECharts | Already fixed in B35.4 | Verify still working |

### Success Criteria

- [ ] SaaS Billing Flow demo functional
- [ ] No duplicate stories in navigation
- [ ] All known issues fixed
- [ ] Navigation clean and organized

---

## Sprint 40: Polish & Release

**Goal:** Complete docs, final verification, release-ready

### Sessions

| ID | Session | Focus | Deliverables |
|----|---------|-------|--------------|
| 40.1 | A11y + Token Docs | 6-accessibility-approach.mdx, 7-token-architecture.mdx | See below |
| 40.2 | Context Consolidation | Finalize canonical/compound stories | Story cleanup |
| 40.3 | End-to-End Verification | Navigate full structure | Testing |
| 40.4 | Release Prep | Context snapshot, diagnostics, changelog | Documentation |

### Key Deliverables

#### B40.1 - Documentation

**Accessibility Approach:**
- Path: `stories/docs/6-accessibility-approach.mdx`
- Title: `Accessibility/Approach & Philosophy`
- Content:
  - OODS accessibility philosophy
  - Token-based contrast guarantees
  - High contrast / ForcedColors support
  - Screen reader considerations
  - Keyboard navigation patterns

**Token Architecture:**
- Path: `stories/docs/7-token-architecture.mdx`
- Title: `Tokens & Theming/Token Architecture`
- Content:
  - Three-layer model: Reference → Semantic → Component
  - How tokens flow through the system
  - Brand theming mechanism
  - Viz token integration

#### B40.2 - Context Story Consolidation

Ensure all context stories are in correct location:
- Canonical: Detail, List, Form, Timeline
- Compound: Card, Inline, Dashboard
- Remove any orphans

#### B40.3 - End-to-End Verification

Manual walkthrough checklist:
- [ ] Understanding OODS section has 4 docs in order
- [ ] Objects section has Object Explorer + all objects
- [ ] Traits section has all trait stories
- [ ] Contexts section has all context demos
- [ ] Visualization section organized correctly
- [ ] Primitives section organized by function
- [ ] Accessibility section has docs and demos
- [ ] Tokens section has design and viz tokens
- [ ] Domain Patterns has billing, authz, communication
- [ ] Proofs section has compliance and performance

#### B40.4 - Release Prep

- Update project_context with session history
- Take context snapshot
- Update diagnostics.json
- Write changelog entry for navigation restructure
- Tag release if appropriate

### Success Criteria

- [ ] All 7 MDX docs complete
- [ ] Navigation passes end-to-end verification
- [ ] No orphan stories
- [ ] Context snapshot taken
- [ ] Changelog updated

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| [oods-navigation-implementation-plan.md](../reports/oods-navigation-implementation-plan.md) | Complete implementation details |
| [storybook-inventory.md](../reports/storybook-inventory.md) | Current story audit |
| [storybook-cleanup-decisions.md](../reports/storybook-cleanup-decisions.md) | Consolidation decisions |
| [oods-navigation-philosophy_inventory.md](../reports/oods-navigation-philosophy_inventory.md) | Philosophy research |

## Mission Files

All mission YAML files are in `cmos/missions/`:

### Sprint 36
- [B36.1-storybook-nav-config.yaml](../missions/B36.1-storybook-nav-config.yaml)
- [B36.2-philosophy-mdx.yaml](../missions/B36.2-philosophy-mdx.yaml)
- [B36.3-trait-engine-mdx.yaml](../missions/B36.3-trait-engine-mdx.yaml)
- [B36.4-story-renames-batch1.yaml](../missions/B36.4-story-renames-batch1.yaml)
- [B36.5-story-renames-batch2.yaml](../missions/B36.5-story-renames-batch2.yaml)

### Sprint 37-40
Mission files will be created at sprint start, following this roadmap.

---

## Execution Notes for Agents

1. **Read the mission YAML file** before starting any work
2. **Mission files are source of truth** for detailed requirements
3. **Update mission status** via CLI when starting/completing:
   ```bash
   ./cmos/cli.py mission update B36.1 --status "In Progress"
   ./cmos/cli.py mission update B36.1 --status Completed --notes "..."
   ```
4. **Story title format**: `Section/Subsection/Story Name`
5. **MDX title format**: Use frontmatter or Canvas meta
6. **Don't interpret** - execute as specified in mission files
7. **Document deviations** in completion notes if paths don't match

---

*Generated: 2025-12-03*
