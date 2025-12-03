# OODS Navigation Restructure: Implementation Plan

**Created:** 2025-12-03  
**Status:** Ready for Implementation  
**Source:** Synthesis of three research reports (Inventory, Gemini, ChatGPT) + Storybook Audit

---

## Executive Summary

This plan transforms OODS Foundry's Storybook navigation from a component-centric structure into an **object-centric, trait-based** architecture that teaches the OODS philosophy. The current navigation obscures OODS's unique value proposition by presenting it as a generic component library.

### Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Objects visible in nav | 3 | 12 |
| Traits visible in nav | 1 | 58 (grouped) |
| Philosophy/conceptual content | 0 docs | 4 docs |
| Context comparison demos | 0 | 2 (hero demos) |
| Trait engine visibility | Hidden | Prominent |

### Effort Estimate

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 1 week | Philosophy docs, nav restructure |
| Phase 2 | 2 weeks | Object Explorer, hero demos |
| Phase 3 | 1 week | Trait catalog, context demos |
| Phase 4 | 1 week | Cleanup, consolidation, polish |

---

## Part 1: Current State Analysis

### 1.1 Story File Distribution (104 total)

| Location | Count | Current Purpose |
|----------|-------|-----------------|
| `stories/` | 60 | Main public stories |
| `src/stories/` | 22 | Internal component stories |
| `apps/explorer/src/stories/` | 16 | Explorer-app demos |
| `src/components/viz/spatial/` | 6 | Co-located spatial viz |

### 1.2 Current Navigation Structure

```
Storybook (Current)
├── Components/                          ← OVEREMPHASIZED
│   ├── Feedback/ (Toast)
│   ├── Navigation/ (Tabs)
│   ├── Primitives/ (Button, Checkbox, Select, Tabs)
│   ├── Statusables/ (Badge, Banner, Toast)
│   └── Visualization/ (ForceGraph, Sankey, Sunburst, Treemap)
├── Contexts/
│   └── Domain Context Gallery           ← BURIED, MESSY
├── Explorer/
│   ├── Components/ (duplicate primitives)
│   └── Proofs/
├── Proofs/                              ← SCATTERED
│   ├── Dashboard Contexts
│   └── Temporal Hygiene
└── Visualization/
    └── ECharts/
```

### 1.3 What Exists but Is Hidden

| OODS Concept | Files Exist | In Navigation | Gap |
|--------------|-------------|---------------|-----|
| **Traits** | 58 YAML files | 1 (Addressable) | 57 traits invisible |
| **Objects** | 12 definitions | 3 partial | 9 objects missing |
| **Contexts** | 8 types | Scattered | No unified view |
| **Trait Engine** | statusRegistry, compositor | None | Core mechanism hidden |
| **Accessibility** | 20+ test files, 3 doc files | 1 proof | First-class concern buried |
| **TEP System** | Complete pipeline | Scattered charts | No system story |

### 1.4 Duplicate Stories (Consolidation Needed)

| Component | Locations | Action |
|-----------|-----------|--------|
| Toast | 3 locations | Consolidate to statusables, keep explorer simple |
| Badge | 2 locations | Consolidate to statusables |
| Banner | 2 locations | Consolidate to statusables |
| Button | 2 locations | Keep base-stories, simplify explorer |
| Select | 2 locations | Keep forms, simplify explorer |
| Checkbox | 2 locations | Keep forms, simplify explorer |
| Tabs | 2 locations | Keep components, simplify explorer |
| Treemap | 2 locations | Component = user-facing, ECharts = internal |
| Sankey | 2 locations | Component = user-facing, ECharts = internal |
| Sunburst | 2 locations | Component = user-facing, ECharts = internal |

### 1.5 Explorer App Audit

The `apps/explorer/src/stories/` contains 16 stories. After audit, here's the disposition:

#### Components ONLY in Explorer (No Main Story)

| Component | Explorer Location | Main Component Exists | Action |
|-----------|-------------------|----------------------|--------|
| **Tooltip** | `apps/explorer/.../Tooltip.stories.tsx` | ✓ `src/components/Tooltip/` | **Create main story** |
| **StatusChip** | `apps/explorer/.../StatusChip.stories.tsx` | ❌ (uses Badge) | **Port to Statusable demo** |
| Radio | `apps/explorer/.../Radio.stories.tsx` | ✓ In main components | Already covered |
| Toggle | `apps/explorer/.../Toggle.stories.tsx` | ✓ In main components | Already covered |
| TextArea | `apps/explorer/.../TextArea.stories.tsx` | ✓ In main components | Already covered |
| Input | `apps/explorer/.../Input.stories.tsx` | ✓ TextField in main | Already covered |
| BrandA | `apps/explorer/.../BrandA.stories.tsx` | Theming example | Move to Tokens section |
| Patterns.Form | `apps/explorer/.../Patterns.Form.stories.tsx` | Pattern example | Evaluate for Domain Patterns |

#### Key Finding: StatusChip is Valuable

The `StatusChip.stories.tsx` in Explorer is an excellent statusRegistry demo showing:
- Subscription states (future, trialing, active, paused, pending_cancellation, delinquent, terminated)
- Invoice states (draft, posted, paid, past_due, void)
- PaymentIntent states (requires_payment_method, processing, succeeded, canceled)
- Ticket states (new, open, pending, on_hold, solved, closed)
- User states (invited, active, suspended, locked, deactivated)

This content should be ported to `stories/traits/Statusable.stories.tsx` using the main Badge component.

#### Explorer App Disposition

**Decision:** Exclude Explorer stories from main navigation. They serve the Explorer app's internal needs and duplicate canonical stories.

**Implementation:** Update `.storybook/main.ts` to exclude `apps/explorer/src/stories/` from story globs, OR rename all Explorer story titles to a hidden/internal prefix.

---

## Part 2: Target Navigation Structure

### 2.1 Complete Target Hierarchy

```
OODS Foundry
│
├── 1. Understanding OODS                          ← NEW SECTION
│   ├── 1.1 Philosophy                             ← NEW (MDX)
│   │   └── Why Object-Oriented Design Systems?
│   ├── 1.2 Core Concepts                          ← NEW (MDX)
│   │   └── Objects, Traits, Contexts Explained
│   ├── 1.3 The Trait Engine                       ← NEW (MDX + Interactive)
│   │   ├── How Composition Works
│   │   └── statusRegistry Demo
│   └── 1.4 Getting Started                        ← NEW (MDX)
│       └── For Designers & Developers
│
├── 2. Objects                                     ← ELEVATED TO TOP
│   ├── 2.1 Object Explorer                        ← NEW (Hero Demo)
│   │   └── Interactive: Object × Traits × Context matrix
│   ├── 2.2 Core Objects
│   │   ├── User                                   ← ENHANCED (all traits, all contexts)
│   │   │   ├── With Addressable
│   │   │   ├── With Authable
│   │   │   ├── With Preferences
│   │   │   └── In All Contexts
│   │   ├── Organization                           ← ENHANCED
│   │   │   ├── Members (Authable)
│   │   │   └── Locations (Addressable)
│   │   └── Product                                ← ENHANCED
│   │       └── Category Browser (Classifiable)
│   └── 2.3 Domain Objects
│       ├── Invoice                                ← EXISTS, RELOCATE
│       │   └── Lifecycle (Stateful, Billable)
│       ├── Subscription                           ← EXISTS, RELOCATE
│       │   └── Lifecycle (Stateful, Billable)
│       ├── Plan                                   ← NEW STORY
│       ├── Transaction                            ← NEW STORY
│       ├── Usage                                  ← EXISTS, RELOCATE
│       ├── Article                                ← NEW STORY
│       ├── Media                                  ← NEW STORY
│       └── Relationship                           ← NEW STORY
│
├── 3. Traits                                      ← NEW SECTION
│   ├── 3.1 How Traits Work                        ← NEW (MDX)
│   ├── 3.2 Core Traits
│   │   ├── Addressable                            ← EXISTS
│   │   ├── Authable                               ← NEW STORY
│   │   ├── Classifiable                           ← NEW STORY
│   │   ├── Communicable                           ← EXISTS (scattered)
│   │   └── Preferenceable                         ← EXISTS (UserPreferences)
│   ├── 3.3 Lifecycle Traits
│   │   ├── Stateful                               ← NEW STORY
│   │   ├── Timestampable                          ← NEW STORY
│   │   ├── Archivable                             ← NEW STORY
│   │   └── Cancellable                            ← NEW STORY
│   ├── 3.4 Statusable System                      ← NEW (from statusRegistry)
│   │   └── Registry Demo (Badge, Banner, Toast unified)
│   └── 3.5 Domain Traits
│       ├── Billable                               ← NEW STORY
│       ├── Payable                                ← NEW STORY
│       ├── Refundable                             ← NEW STORY
│       └── Metered                                ← NEW STORY
│
├── 4. Contexts                                    ← RESTRUCTURED
│   ├── 4.1 Same Object, Different Contexts        ← NEW (Hero Demo)
│   │   └── User in Detail, List, Form, Card, Timeline
│   ├── 4.2 Canonical Contexts
│   │   ├── Detail                                 ← EXISTS (view-profiles)
│   │   ├── List                                   ← EXISTS (view-profiles)
│   │   ├── Form                                   ← EXISTS (view-profiles)
│   │   └── Timeline                               ← EXISTS (view-profiles)
│   └── 4.3 Compound Contexts
│       ├── Card                                   ← EXISTS (view-profiles)
│       ├── Inline                                 ← EXISTS (view-profiles)
│       ├── Chart                                  ← NEW STORY
│       └── Dashboard                              ← EXISTS (DashboardContexts)
│
├── 5. Visualization System                        ← RESTRUCTURED
│   ├── 5.1 How TEP Works                          ← NEW (MDX)
│   │   └── Token-Expression Pipeline Explained
│   ├── 5.2 Standard Charts
│   │   ├── LineChart                              ← EXISTS
│   │   ├── BarChart                               ← EXISTS
│   │   ├── AreaChart                              ← EXISTS
│   │   ├── ScatterChart                           ← EXISTS
│   │   └── Heatmap                                ← EXISTS
│   ├── 5.3 Hierarchical
│   │   ├── Treemap                                ← EXISTS (consolidate)
│   │   └── Sunburst                               ← EXISTS (consolidate)
│   ├── 5.4 Network & Flow
│   │   ├── Sankey                                 ← EXISTS (consolidate)
│   │   └── ForceGraph                             ← EXISTS (consolidate)
│   ├── 5.5 Spatial
│   │   ├── ChoroplethMap                          ← EXISTS
│   │   ├── BubbleMap                              ← EXISTS
│   │   └── MapControls                            ← EXISTS
│   ├── 5.6 Composition
│   │   ├── FacetedCharts                          ← EXISTS
│   │   └── LayeredCharts                          ← EXISTS
│   └── 5.7 Patterns                               ← EXISTS (needs fix)
│       └── PatternGalleryV2
│
├── 6. Primitives                                  ← DEMOTED
│   ├── 6.1 Forms
│   │   ├── TextField                              ← EXISTS
│   │   ├── Select                                 ← EXISTS (consolidate)
│   │   ├── Checkbox                               ← EXISTS (consolidate)
│   │   ├── Radio                                  ← EXISTS
│   │   ├── TextArea                               ← EXISTS
│   │   └── Toggle                                 ← EXISTS
│   ├── 6.2 Feedback
│   │   ├── Dialog                                 ← EXISTS
│   │   ├── Popover                                ← EXISTS
│   │   ├── Sheet                                  ← EXISTS
│   │   ├── Tooltip                                ← NEW (component exists, no story)
│   │   ├── Toast                                  ← EXISTS (consolidate)
│   │   ├── Banner                                 ← EXISTS (consolidate)
│   │   └── Badge                                  ← EXISTS (consolidate)
│   ├── 6.3 Navigation
│   │   ├── Tabs                                   ← EXISTS (consolidate)
│   │   ├── Breadcrumbs                            ← EXISTS
│   │   ├── Pagination                             ← EXISTS
│   │   └── Stepper                                ← EXISTS
│   ├── 6.4 Data Display
│   │   ├── Table                                  ← EXISTS
│   │   ├── Progress                               ← EXISTS
│   │   └── EmptyState                             ← EXISTS
│   └── 6.5 Actions
│       └── Button                                 ← EXISTS (consolidate)
│
├── 7. Accessibility                               ← ELEVATED
│   ├── 7.1 Approach & Philosophy                  ← NEW (MDX)
│   ├── 7.2 Token Architecture                     ← NEW (MDX)
│   │   └── Reference → Semantic → Component
│   ├── 7.3 High Contrast / ForcedColors           ← EXISTS
│   ├── 7.4 Status Announcements                   ← NEW (from statusRegistry)
│   └── 7.5 Keyboard Navigation                    ← NEW (MDX)
│
├── 8. Tokens & Theming                            ← NEW SECTION
│   ├── 8.1 Design Tokens                          ← NEW (from VizTokens + others)
│   ├── 8.2 Viz Tokens                             ← EXISTS
│   └── 8.3 Brand Theming                          ← EXISTS (BrandA)
│
├── 9. Domain Patterns                             ← NEW SECTION
│   ├── 9.1 SaaS Billing Flow                      ← NEW (MDX + Demo)
│   │   └── Subscription → Invoice → Payment
│   ├── 9.2 Authorization                          ← EXISTS (relocate)
│   │   ├── MembershipManager
│   │   └── RolePermissionMatrix
│   └── 9.3 Communication                          ← EXISTS (relocate)
│       ├── MessageTimeline
│       ├── ConversationThread
│       └── ChannelPlanEditor
│
└── 10. Proofs & Internals                         ← CONSOLIDATED
    ├── 10.1 View Profile Proofs                   ← EXISTS
    ├── 10.2 Compliance Proofs                     ← EXISTS
    │   ├── Billing ACL
    │   └── Compliance Core
    ├── 10.3 Temporal Hygiene                      ← EXISTS
    └── 10.4 Performance Harnesses                 ← EXISTS
        ├── CompositorHarness
        ├── ListHarness
        ├── TokenTransformHarness
        └── UsageAggregationHarness
```

---

## Part 3: Migration Mapping

### 3.1 Story File Relocations

#### Stories Moving to "Objects" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `stories/objects/UserWithAddresses.stories.tsx` | `Objects/User/With Addressable` | Update title, add context demos |
| `stories/objects/UserWithAuthable.stories.tsx` | `Objects/User/With Authable` | Update title |
| `stories/objects/UserPreferences.stories.tsx` | `Objects/User/With Preferences` | Update title |
| `src/stories/user-stories/UserDetail.stories.tsx` | `Objects/User/In All Contexts` | Merge with context demos |
| `stories/objects/OrganizationMembers.stories.tsx` | `Objects/Organization/Members` | Update title |
| `stories/objects/OrganizationLocations.stories.tsx` | `Objects/Organization/Locations` | Update title |
| `stories/objects/ProductCategoryBrowser.stories.tsx` | `Objects/Product/Category Browser` | Update title |
| `stories/domains/Billing/Invoice.stories.tsx` | `Objects/Domain Objects/Invoice` | Update title |
| `stories/domains/Billing/Invoice.lifecycle.stories.tsx` | `Objects/Domain Objects/Invoice/Lifecycle` | Merge or nest |
| `stories/domains/Billing/Subscription.stories.tsx` | `Objects/Domain Objects/Subscription` | Update title |
| `stories/domains/Billing/Subscription.lifecycle.stories.tsx` | `Objects/Domain Objects/Subscription/Lifecycle` | Merge or nest |
| `stories/domains/Billing/Usage.metered.stories.tsx` | `Objects/Domain Objects/Usage` | Update title |

#### Stories Moving to "Traits" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `stories/traits/AddressFormatting.stories.tsx` | `Traits/Core/Addressable` | Update title, enhance |
| `stories/components/AddressDisplay.stories.tsx` | `Traits/Core/Addressable` | Merge into trait story |
| `stories/components/AddressForm.stories.tsx` | `Traits/Core/Addressable` | Merge into trait story |
| `stories/components/classification/*.stories.tsx` | `Traits/Core/Classifiable` | Create unified trait story |
| `stories/components/Communication.*.stories.tsx` | `Traits/Core/Communicable` | Create unified trait story |
| `stories/components/PreferenceForm.stories.tsx` | `Traits/Core/Preferenceable` | Merge with UserPreferences |

#### Stories Moving to "Contexts" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `src/stories/proofs/view-profiles/Detail.stories.tsx` | `Contexts/Canonical/Detail` | Update title |
| `src/stories/proofs/view-profiles/List.stories.tsx` | `Contexts/Canonical/List` | Update title |
| `src/stories/proofs/view-profiles/Form.stories.tsx` | `Contexts/Canonical/Form` | Update title |
| `src/stories/proofs/view-profiles/Timeline.stories.tsx` | `Contexts/Canonical/Timeline` | Update title |
| `src/stories/proofs/view-profiles/Card.stories.tsx` | `Contexts/Compound/Card` | Update title |
| `src/stories/proofs/view-profiles/Inline.stories.tsx` | `Contexts/Compound/Inline` | Update title |
| `stories/proofs/DashboardContexts.stories.tsx` | `Contexts/Compound/Dashboard` | Update title |
| `stories/proofs/context-gallery.stories.tsx` | `Contexts/Same Object, Different Contexts` | Major enhance |

#### Stories Moving to "Visualization" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `stories/viz/LineChart.stories.tsx` | `Visualization/Standard/LineChart` | Update title |
| `stories/viz/BarChart.stories.tsx` | `Visualization/Standard/BarChart` | Update title |
| `stories/viz/AreaChart.stories.tsx` | `Visualization/Standard/AreaChart` | Update title |
| `stories/viz/ScatterChart.stories.tsx` | `Visualization/Standard/ScatterChart` | Update title |
| `stories/viz/Heatmap.stories.tsx` | `Visualization/Standard/Heatmap` | Update title |
| `stories/components/Treemap.stories.tsx` | `Visualization/Hierarchical/Treemap` | Consolidate with echarts |
| `stories/components/Sunburst.stories.tsx` | `Visualization/Hierarchical/Sunburst` | Consolidate with echarts |
| `stories/components/Sankey.stories.tsx` | `Visualization/Network/Sankey` | Consolidate with echarts |
| `stories/components/ForceGraph.stories.tsx` | `Visualization/Network/ForceGraph` | Update title |
| `src/components/viz/spatial/*.stories.tsx` | `Visualization/Spatial/*` | Update titles |
| `stories/viz/FacetedCharts.stories.tsx` | `Visualization/Composition/Faceted` | Update title |
| `stories/viz/LayeredCharts.stories.tsx` | `Visualization/Composition/Layered` | Update title |

#### Stories Moving to "Primitives" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `src/stories/forms/*.stories.tsx` | `Primitives/Forms/*` | Update titles |
| `src/stories/components/Dialog.stories.tsx` | `Primitives/Feedback/Dialog` | Update title |
| `src/stories/components/Popover.stories.tsx` | `Primitives/Feedback/Popover` | Update title |
| `src/stories/components/Sheet.stories.tsx` | `Primitives/Feedback/Sheet` | Update title |
| **NEW:** `stories/primitives/Tooltip.stories.tsx` | `Primitives/Feedback/Tooltip` | **Create new** (component at `src/components/Tooltip/`) |
| `src/stories/base-stories/Badge.stories.tsx` | `Primitives/Feedback/Badge` | Update title |
| `src/stories/statusables/Banner.stories.tsx` | `Primitives/Feedback/Banner` | Update title |
| `src/stories/statusables/Toast.stories.tsx` | `Primitives/Feedback/Toast` | Update title |
| `stories/components/Tabs.stories.tsx` | `Primitives/Navigation/Tabs` | Update title |
| `stories/components/Breadcrumbs.stories.tsx` | `Primitives/Navigation/Breadcrumbs` | Update title |
| `stories/components/Pagination.stories.tsx` | `Primitives/Navigation/Pagination` | Update title |
| `stories/components/Stepper.stories.tsx` | `Primitives/Navigation/Stepper` | Update title |
| `src/stories/table/Table.stories.tsx` | `Primitives/Data Display/Table` | Update title |
| `stories/components/Progress.stories.tsx` | `Primitives/Data Display/Progress` | Update title |
| `stories/components/EmptyState.stories.tsx` | `Primitives/Data Display/EmptyState` | Update title |
| `src/stories/base-stories/Button.stories.tsx` | `Primitives/Actions/Button` | Update title |

#### Stories Moving to "Accessibility" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `src/stories/proofs/view-profiles/ForcedColors.stories.tsx` | `Accessibility/High Contrast` | Update title, enhance |
| `apps/explorer/src/stories/HighContrast.Guardrails-hc.stories.tsx` | `Accessibility/High Contrast` | Merge |

#### Stories Moving to "Domain Patterns" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `stories/authz/MembershipManager.stories.tsx` | `Domain Patterns/Authorization/Membership` | Update title |
| `stories/authz/RolePermissionMatrix.stories.tsx` | `Domain Patterns/Authorization/Permissions` | Update title |
| `stories/components/Communication.MessageTimeline.stories.tsx` | `Domain Patterns/Communication/Timeline` | Update title |
| `stories/components/Communication.ConversationThread.stories.tsx` | `Domain Patterns/Communication/Thread` | Update title |
| `stories/components/Communication.ChannelPlanEditor.stories.tsx` | `Domain Patterns/Communication/Channels` | Update title |

#### Stories Moving to "Proofs & Internals" Section

| Current Location | New Location | Changes Needed |
|------------------|--------------|----------------|
| `stories/proofs/billing-acl.stories.tsx` | `Proofs/Compliance/Billing ACL` | Update title |
| `stories/proofs/compliance.stories.tsx` | `Proofs/Compliance/Core` | Update title |
| `stories/proofs/TemporalHygiene.stories.tsx` | `Proofs/Temporal Hygiene` | Update title |
| `stories/performance/*.stories.tsx` | `Proofs/Performance/*` | Update titles |

#### Stories to CONSOLIDATE (Remove Duplicates)

| Keep | Remove/Redirect | Reason |
|------|-----------------|--------|
| `src/stories/statusables/Toast.stories.tsx` | `stories/components/Toast.stories.tsx`, `apps/explorer/.../Toast.stories.tsx` | Statusables version is canonical |
| `src/stories/statusables/Banner.stories.tsx` | `apps/explorer/.../Banner.stories.tsx` | Statusables version is canonical |
| `src/stories/base-stories/Badge.stories.tsx` | `apps/explorer/.../Badge.stories.tsx` | Base version is canonical |
| `stories/components/Treemap.stories.tsx` | `stories/viz/echarts/Treemap.stories.tsx` | Component version is user-facing |
| `stories/components/Sankey.stories.tsx` | `stories/viz/echarts/Sankey.stories.tsx` | Component version is user-facing |
| `stories/components/Sunburst.stories.tsx` | `stories/viz/echarts/Sunburst.stories.tsx` | Component version is user-facing |

#### Explorer Stories (Keep Separate, Simplify)

The `apps/explorer/src/stories/` stories should remain as simple demos for the Explorer app but should be clearly labeled as "Explorer App Demos" rather than canonical component docs.

---

## Part 4: New Content Requirements

### 4.1 New MDX Documentation (Philosophy Layer)

| File | Purpose | Priority | Est. Effort |
|------|---------|----------|-------------|
| `stories/docs/1-philosophy.mdx` | Why Object-Oriented Design Systems? OODS value prop | P0 | 2 hours |
| `stories/docs/2-core-concepts.mdx` | Objects, Traits, Contexts explained with diagrams | P0 | 3 hours |
| `stories/docs/3-trait-engine.mdx` | How composition works, dependency resolution | P0 | 3 hours |
| `stories/docs/4-getting-started.mdx` | Quick start for designers and developers | P1 | 2 hours |
| `stories/docs/5-tep-system.mdx` | Token-Expression Pipeline for viz | P1 | 2 hours |
| `stories/docs/6-accessibility-approach.mdx` | A11y philosophy and implementation | P1 | 2 hours |
| `stories/docs/7-token-architecture.mdx` | Reference → Semantic → Component layers | P2 | 2 hours |

### 4.2 New Interactive Stories (Hero Demos)

| Story | Purpose | Priority | Est. Effort |
|-------|---------|----------|-------------|
| `stories/objects/ObjectExplorer.stories.tsx` | Interactive Object × Traits × Context matrix | P0 | 8 hours |
| `stories/contexts/SameObjectDifferentContexts.stories.tsx` | User in all 8 contexts, side-by-side | P0 | 4 hours |
| `stories/traits/Statusable.stories.tsx` | statusRegistry interactive demo (port StatusChip content from Explorer: subscription, invoice, payment_intent, ticket, user states) | P0 | 4 hours |
| `stories/traits/TraitCompositionDemo.stories.tsx` | Live trait composition visualization | P1 | 6 hours |

### 4.3 New Object Stories (Missing Objects)

| Object | Traits to Demonstrate | Priority | Est. Effort |
|--------|----------------------|----------|-------------|
| `stories/objects/Plan.stories.tsx` | Labelled, Stateful, Timestampable, SaaSBillingUsable | P2 | 3 hours |
| `stories/objects/Transaction.stories.tsx` | Timestampable, SaaSBillingPayable, Refundable | P2 | 3 hours |
| `stories/objects/Article.stories.tsx` | Labelled, Stateful, Ownerable, Timestampable | P3 | 3 hours |
| `stories/objects/Media.stories.tsx` | Labelled, Ownerable, Timestampable | P3 | 3 hours |
| `stories/objects/Relationship.stories.tsx` | Labelled, Timestampable, Stateful, Ownerable | P3 | 3 hours |

### 4.4 New Trait Stories (Currently Hidden)

| Trait | What to Show | Priority | Est. Effort |
|-------|--------------|----------|-------------|
| `stories/traits/Authable.stories.tsx` | Role/permission system, membership | P1 | 4 hours |
| `stories/traits/Stateful.stories.tsx` | State machine, transitions, statusRegistry | P1 | 4 hours |
| `stories/traits/Timestampable.stories.tsx` | Temporal fields, formatting | P2 | 2 hours |
| `stories/traits/Archivable.stories.tsx` | Archive/restore lifecycle | P2 | 2 hours |
| `stories/traits/Cancellable.stories.tsx` | Cancel flow, confirmation | P2 | 2 hours |
| `stories/traits/Billable.stories.tsx` | Billing integration | P2 | 3 hours |
| `stories/traits/Payable.stories.tsx` | Payment processing | P2 | 3 hours |
| `stories/traits/Refundable.stories.tsx` | Refund flow | P2 | 3 hours |
| `stories/traits/Metered.stories.tsx` | Usage metering | P2 | 3 hours |

### 4.5 Missing Stories for Existing Components

| Component | Location | Priority | Est. Effort |
|-----------|----------|----------|-------------|
| `stories/primitives/Tooltip.stories.tsx` | Component exists at `src/components/Tooltip/` | P1 | 2 hours |

### 4.6 New Domain Pattern Stories

| Pattern | Components Involved | Priority | Est. Effort |
|---------|---------------------|----------|-------------|
| `stories/patterns/SaaSBillingFlow.stories.tsx` | Subscription → Invoice → Payment journey | P1 | 6 hours |

---

## Part 5: Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Establish philosophy layer and restructure navigation skeleton.

**Tasks:**

1. **Create MDX docs structure**
   - [ ] Create `stories/docs/` directory
   - [ ] Write `1-philosophy.mdx` (OODS value prop)
   - [ ] Write `2-core-concepts.mdx` (Objects, Traits, Contexts)
   - [ ] Write `3-trait-engine.mdx` (composition mechanics)

2. **Update `.storybook/main.ts` story ordering**
   - [ ] Configure story sort order to match target hierarchy
   - [ ] Set up section prefixes (e.g., `1-Understanding OODS`, `2-Objects`, etc.)

3. **Rename existing story titles** (batch update)
   - [ ] Update all story `title` exports to match new hierarchy
   - [ ] Use consistent naming: `Section/Subsection/Story Name`

**Deliverables:**
- Philosophy docs readable in Storybook
- Navigation reflects new top-level structure
- Existing stories appear in correct sections (even if not enhanced)

### Phase 2: Hero Demos (Week 2-3)

**Goal:** Build the showcase demos that prove OODS value.

**Tasks:**

1. **Object Explorer** (P0)
   - [ ] Create `ObjectExplorer.stories.tsx`
   - [ ] Build interactive UI: object selector, trait toggles, context switcher
   - [ ] Wire to actual object definitions and RenderObject

2. **Same Object, Different Contexts** (P0)
   - [ ] Create `SameObjectDifferentContexts.stories.tsx`
   - [ ] Show User object in Detail, List, Form, Card, Timeline, Inline, Chart, Dashboard
   - [ ] Add annotations explaining what changes between contexts

3. **Statusable Demo** (P0)
   - [ ] Create `stories/traits/Statusable.stories.tsx`
   - [ ] Port StatusChip content from Explorer (`apps/explorer/src/stories/StatusChip.stories.tsx`)
   - [ ] Show all domains: Subscription, Invoice, PaymentIntent, Ticket, User states
   - [ ] Use main Badge component (not Explorer's StatusChip)
   - [ ] Interactive statusRegistry explorer showing status → tone → token → visual mapping

4. **Consolidate statusables**
   - [ ] Merge Badge/Banner/Toast stories into unified section
   - [ ] Add statusRegistry integration examples

**Deliverables:**
- Object Explorer functional and prominent
- Context comparison demo complete
- statusRegistry visible and explained

### Phase 3: Catalog Expansion (Week 4)

**Goal:** Surface hidden traits and complete object coverage.

**Tasks:**

1. **Trait catalog stories**
   - [ ] Create `Authable.stories.tsx`
   - [ ] Create `Stateful.stories.tsx`
   - [ ] Create `Timestampable.stories.tsx`
   - [ ] Create remaining lifecycle traits

2. **Object coverage**
   - [ ] Enhance existing object stories with all-context demos
   - [ ] Create Plan, Transaction stories (P2)

3. **Consolidate viz stories**
   - [ ] Merge component-level and echarts-level stories where redundant
   - [ ] Create `5-tep-system.mdx` explaining pipeline

4. **Create missing primitive stories**
   - [ ] Create `stories/primitives/Tooltip.stories.tsx` (component exists at `src/components/Tooltip/`)

5. **Domain patterns**
   - [ ] Create `SaaSBillingFlow.stories.tsx`
   - [ ] Relocate authz and communication stories

**Deliverables:**
- 10+ traits visible in navigation
- All 12 objects represented
- Viz system has cohesive story

### Phase 4: Polish & Cleanup (Week 5)

**Goal:** Consolidate duplicates, fix issues, ensure quality.

**Tasks:**

1. **Remove/redirect duplicates**
   - [ ] Archive redundant Toast/Badge/Banner/etc. stories
   - [ ] Update any cross-references

2. **Fix known issues**
   - [ ] PatternGalleryV2 responsive issues
   - [ ] Patterns clipping issues
   - [ ] TEP color palette not passing to ECharts

3. **Exclude Explorer app stories from main nav**
   - [ ] Update `.storybook/main.ts` to remove Explorer story glob
   - [ ] Verify Explorer app still works with its own Storybook if needed

4. **Final navigation polish**
   - [ ] Verify all stories appear in correct sections
   - [ ] Add section descriptions/intros
   - [ ] Test navigation flow end-to-end

5. **Documentation**
   - [ ] Write `4-getting-started.mdx`
   - [ ] Write `6-accessibility-approach.mdx`
   - [ ] Write `7-token-architecture.mdx`

**Deliverables:**
- No duplicate stories
- All known issues resolved
- Complete documentation layer
- Navigation tells the OODS story

---

## Part 6: File Organization Changes

### 6.1 Proposed Directory Structure

```
stories/
├── docs/                                    ← NEW
│   ├── 1-philosophy.mdx
│   ├── 2-core-concepts.mdx
│   ├── 3-trait-engine.mdx
│   ├── 4-getting-started.mdx
│   ├── 5-tep-system.mdx
│   ├── 6-accessibility-approach.mdx
│   └── 7-token-architecture.mdx
├── objects/                                 ← EXPANDED
│   ├── ObjectExplorer.stories.tsx           ← NEW
│   ├── User/
│   │   ├── UserWithAddresses.stories.tsx
│   │   ├── UserWithAuthable.stories.tsx
│   │   ├── UserPreferences.stories.tsx
│   │   └── UserAllContexts.stories.tsx      ← NEW
│   ├── Organization/
│   │   ├── OrganizationMembers.stories.tsx
│   │   └── OrganizationLocations.stories.tsx
│   ├── Product/
│   │   └── ProductCategoryBrowser.stories.tsx
│   └── domain/                              ← RELOCATED from stories/domains/
│       ├── Invoice.stories.tsx
│       ├── Subscription.stories.tsx
│       ├── Usage.stories.tsx
│       ├── Plan.stories.tsx                 ← NEW
│       └── Transaction.stories.tsx          ← NEW
├── traits/                                  ← EXPANDED
│   ├── Addressable.stories.tsx              ← ENHANCED
│   ├── Authable.stories.tsx                 ← NEW
│   ├── Classifiable.stories.tsx             ← NEW (from classification/)
│   ├── Communicable.stories.tsx             ← NEW (from Communication.*)
│   ├── Preferenceable.stories.tsx           ← NEW
│   ├── Stateful.stories.tsx                 ← NEW
│   ├── Statusable.stories.tsx               ← NEW (statusRegistry demo)
│   └── lifecycle/
│       ├── Timestampable.stories.tsx        ← NEW
│       ├── Archivable.stories.tsx           ← NEW
│       └── Cancellable.stories.tsx          ← NEW
├── contexts/                                ← NEW
│   ├── SameObjectDifferentContexts.stories.tsx  ← NEW
│   ├── canonical/                           ← RELOCATED from view-profiles
│   │   ├── Detail.stories.tsx
│   │   ├── List.stories.tsx
│   │   ├── Form.stories.tsx
│   │   └── Timeline.stories.tsx
│   └── compound/
│       ├── Card.stories.tsx
│       ├── Inline.stories.tsx
│       └── Dashboard.stories.tsx
├── viz/                                     ← CONSOLIDATED
│   ├── standard/
│   │   ├── LineChart.stories.tsx
│   │   ├── BarChart.stories.tsx
│   │   ├── AreaChart.stories.tsx
│   │   ├── ScatterChart.stories.tsx
│   │   └── Heatmap.stories.tsx
│   ├── hierarchical/
│   │   ├── Treemap.stories.tsx              ← CONSOLIDATED
│   │   └── Sunburst.stories.tsx             ← CONSOLIDATED
│   ├── network/
│   │   ├── Sankey.stories.tsx               ← CONSOLIDATED
│   │   └── ForceGraph.stories.tsx
│   ├── spatial/
│   │   ├── ChoroplethMap.stories.tsx
│   │   ├── BubbleMap.stories.tsx
│   │   └── MapControls.stories.tsx
│   ├── composition/
│   │   ├── FacetedCharts.stories.tsx
│   │   └── LayeredCharts.stories.tsx
│   └── patterns/
│       └── PatternGalleryV2.stories.tsx
├── primitives/                              ← REORGANIZED
│   ├── forms/
│   ├── feedback/
│   │   ├── Dialog.stories.tsx
│   │   ├── Popover.stories.tsx
│   │   ├── Sheet.stories.tsx
│   │   ├── Tooltip.stories.tsx              ← NEW
│   │   ├── Toast.stories.tsx
│   │   ├── Banner.stories.tsx
│   │   └── Badge.stories.tsx
│   ├── navigation/
│   ├── data-display/
│   └── actions/
├── accessibility/                           ← NEW
│   ├── ForcedColors.stories.tsx
│   └── StatusAnnouncements.stories.tsx
├── patterns/                                ← NEW
│   ├── SaaSBillingFlow.stories.tsx
│   ├── authz/
│   │   ├── MembershipManager.stories.tsx
│   │   └── RolePermissionMatrix.stories.tsx
│   └── communication/
│       ├── MessageTimeline.stories.tsx
│       ├── ConversationThread.stories.tsx
│       └── ChannelPlanEditor.stories.tsx
├── tokens/                                  ← NEW
│   ├── DesignTokens.stories.tsx
│   ├── VizTokens.stories.tsx
│   └── BrandTheming.stories.tsx
└── proofs/                                  ← CONSOLIDATED
    ├── compliance/
    ├── temporal/
    └── performance/
```

### 6.2 Storybook Configuration Changes

Update `.storybook/main.ts`:

```typescript
// Exclude Explorer app stories from main navigation
const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../src/components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // REMOVED: '../apps/explorer/src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  // ...
};
```

Update `.storybook/preview.ts`:

```typescript
// Story sort order configuration
const order = [
  'Understanding OODS',
  ['Philosophy', 'Core Concepts', 'Trait Engine', 'Getting Started'],
  'Objects',
  ['Object Explorer', 'Core Objects', 'Domain Objects'],
  'Traits',
  ['How Traits Work', 'Core', 'Lifecycle', 'Statusable', 'Domain'],
  'Contexts',
  ['Same Object Different Contexts', 'Canonical', 'Compound'],
  'Visualization',
  ['How TEP Works', 'Standard', 'Hierarchical', 'Network', 'Spatial', 'Composition', 'Patterns'],
  'Primitives',
  ['Forms', 'Feedback', 'Navigation', 'Data Display', 'Actions'],
  'Accessibility',
  'Tokens & Theming',
  'Domain Patterns',
  'Proofs & Internals',
];
```

---

## Part 7: Success Criteria

### 7.1 Navigation Quality

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Philosophy is first | "Understanding OODS" appears at top | ✓ |
| Objects are prominent | Objects section is 2nd, has 12+ entries | ✓ |
| Traits are visible | Traits section has 15+ entries | ✓ |
| Primitives are demoted | Primitives appear after Objects, Traits, Contexts, Viz | ✓ |
| No orphan stories | All 104 stories have a clear home | ✓ |

### 7.2 Content Quality

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Philosophy docs exist | 4 MDX docs in Understanding OODS | ✓ |
| Hero demos work | Object Explorer, Context Comparison functional | ✓ |
| statusRegistry visible | Interactive demo exists | ✓ |
| No duplicates | Each component has single canonical story (Explorer excluded from nav) | ✓ |

### 7.3 Discoverability

| Criterion | Test | Target |
|-----------|------|--------|
| New user can find trait list | Navigate to Traits in <3 clicks | ✓ |
| New user understands OODS | Philosophy docs explain model | ✓ |
| Developer finds component API | Primitives section organized by function | ✓ |
| Designer sees context options | Contexts section shows all 8 | ✓ |

---

## Part 8: Risk Mitigation

### 8.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing story links | Medium | Medium | Implement redirects, communicate changes |
| Object Explorer complexity | Medium | High | Start with static version, iterate |
| Scope creep on new stories | High | Medium | Strict P0/P1/P2 prioritization |
| Team unfamiliarity with new structure | Low | Medium | Create contribution guide |

### 8.2 Rollback Plan

If the restructure causes issues:
1. Git revert navigation config changes
2. Keep new content (MDX docs, hero demos) but restore old navigation
3. Gradually migrate in smaller batches

---

## Appendix A: Story Title Update Reference

Quick reference for updating story `title` exports:

```typescript
// BEFORE
export default {
  title: 'Components/Toast',
  // ...
}

// AFTER
export default {
  title: 'Primitives/Feedback/Toast',
  // ...
}
```

### Mapping Table (Abbreviated)

| Current Title | New Title |
|---------------|-----------|
| `Components/Toast` | `Primitives/Feedback/Toast` |
| `Components/Tabs` | `Primitives/Navigation/Tabs` |
| `Components/Visualization/Treemap` | `Visualization/Hierarchical/Treemap` |
| `Proofs/Dashboard Contexts` | `Contexts/Compound/Dashboard` |
| `Explorer/Components/Badge` | `Explorer App/Badge` |
| *etc.* | *etc.* |

---

## Appendix B: Quick Reference - What Goes Where

| If the story is about... | It goes in... |
|--------------------------|---------------|
| A business entity (User, Invoice, Product) | **Objects** |
| A capability/behavior that objects have | **Traits** |
| How something renders in different places | **Contexts** |
| A chart or data visualization | **Visualization** |
| A raw UI control (button, input, dialog) | **Primitives** |
| Screen reader, contrast, keyboard nav | **Accessibility** |
| Design tokens, theming | **Tokens & Theming** |
| End-to-end workflows (billing, auth) | **Domain Patterns** |
| Internal testing, compliance | **Proofs & Internals** |
| OODS concepts and philosophy | **Understanding OODS** |

---

## Next Steps

1. **Review this plan** - Confirm priorities and timeline fit project constraints
2. **Create mission in CMOS** - Break Phase 1 into trackable tasks
3. **Start with navigation config** - Get skeleton in place before content migration
4. **Build Object Explorer prototype** - Validate hero demo concept early

---

*Generated from synthesis of three research reports + Storybook audit. Ready for implementation.*
