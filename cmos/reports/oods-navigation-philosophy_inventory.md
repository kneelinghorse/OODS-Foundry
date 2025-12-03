# OODS Navigation Philosophy Research Report

**Generated:** 2025-12-03
**Mission:** RESEARCH-OODS-NAV

---

## Executive Summary

OODS Foundry has a rich, well-implemented architecture that is **poorly represented** by its current Storybook navigation. The current structure treats OODS like a generic component library when it's actually a **trait-based object system** with context-aware rendering.

---

## Task 1: Inventory by OODS Concept

### TRAITS (58 trait files found)

**Core Traits (5):**
| Trait | Status | Stories |
|-------|--------|---------|
| Addressable | Implemented | AddressFormatting, AddressDisplay, AddressForm, UserWithAddresses |
| Authable | Implemented | UserWithAuthable, MembershipManager, RolePermissionMatrix |
| Classifiable | Implemented | CategoryPicker, CategoryTree, TagInput, TagList, ProductCategoryBrowser |
| Communicable | Implemented | MessageTimeline, ConversationThread, DeliveryHealthWidget, ChannelPlanEditor |
| Preferenceable | Implemented | UserPreferences, PreferenceForm |

**Lifecycle Traits (4):** Stateful, Archivable, Cancellable, Timestampable
**Behavioral Traits (1):** Taggable
**Visual/Content Traits (2):** Colorized, Labelled
**Financial Traits (2):** Priceable, Billable
**Structural Traits (1):** Ownerable

**Visualization Traits (27):**
- Mark traits: bar, line, point, area
- Encoding traits: position-x, position-y, color, size
- Scale traits: linear, temporal
- Interaction traits: highlight, tooltip
- Layout traits: facet, layer, concat
- Spatial traits: geocodable

**Domain-Specific (SaaS Billing):** billable, payable, refundable, metered

### OBJECTS (12 found in structured data)

| Object | Traits Composed | Stories |
|--------|-----------------|---------|
| User | Addressable, Authable, Preferenceable | UserDetail, UserPreferences, UserWithAddresses, UserWithAuthable |
| Organization | Addressable, Authable | OrganizationMembers, OrganizationLocations |
| Product | Classifiable | ProductCategoryBrowser |
| Invoice | Billable, Payable, Refundable | Invoice, Invoice.lifecycle |
| Subscription | Billable, Stateful | Subscription, Subscription.lifecycle |

### CONTEXTS (8 view profiles)

| Context | Purpose | Stories |
|---------|---------|---------|
| Detail | Two-column comprehensive view | View Profile proofs |
| List | Tabular/grid with filters | View Profile proofs |
| Form | Data entry with guidance | View Profile proofs |
| Timeline | Chronological stream | View Profile proofs |
| Card | Constrained self-contained | View Profile proofs |
| Inline | Minimal space-efficient | View Profile proofs |
| Chart | Focused visualization | Dashboard stories |
| Dashboard | Multi-panel analytics | DashboardContexts |

**Context Rendering System:**
- `RenderObject` component - core context-aware renderer
- `ViewContainer` - applies data attributes for CSS targeting
- Region system: globalNavigation, pageHeader, breadcrumbs, viewToolbar, main, contextPanel
- Trait contributions register content for specific contexts/regions

### PRIMITIVES (Supporting Components)

**Forms:** TextField, Select, Checkbox, Radio, TextArea, Toggle
**Feedback:** Dialog, Popover, Sheet, Tooltip, Toast, Banner, Badge
**Navigation:** Tabs, Breadcrumbs, Pagination, Stepper
**Data Display:** Table, Progress, EmptyState
**Classification:** CategoryPicker, CategoryTree, TagInput, TagList

### ACCESSIBILITY (Comprehensive but Buried)

**Where it lives:**
- ARIA patterns in base components (Banner, Toast, form controls)
- ForcedColors/High Contrast proofs (2 stories)
- Table fallbacks for all visualizations (4 components)
- 20+ dedicated a11y test files
- CI enforcement via `aria-contract.json`

**Documentation:**
- `/docs/viz/accessibility-checklist.md` (15 rules)
- `/docs/viz/network-flow/accessibility.md` (360 lines)
- `/docs/viz/spatial-accessibility.md`
- `/docs/policies/dark-a11y-coverage.md`

### TRAIT ENGINE (statusRegistry)

**Location:** `src/components/statusables/statusRegistry.ts`

**What it does:**
- Maps domain statuses to presentation (tone, tokens, icons)
- Provides badge/banner styling per status
- Used by Badge, Banner, Toast, Table, EmptyState, Stepper, Progress

**Stories demonstrating it:**
- `src/stories/base-stories/Badge.stories.tsx` - SnapshotGrid shows all statuses
- `src/stories/statusables/Toast.stories.tsx` - ToneGallery
- `src/stories/statusables/Banner.stories.tsx`

### TEP VISUALIZATION SYSTEM

**Token-Expression Pipeline:**
- Normalized specs → Adapters → ECharts renderer
- Hierarchical: Treemap, Sunburst
- Network/Flow: Sankey, ForceGraph
- Standard Charts: Line, Bar, Area, Scatter, Heatmap
- Spatial: Choropleth, Bubble Map

**Current Issue:** Not passing color palette to ECharts (everything is blue)

---

## Task 2: Gap Analysis

### What's MISSING from telling the OODS story

| Gap | Current State | Impact |
|-----|---------------|--------|
| **Trait showcase** | Only Addressable has dedicated story | Users don't see the 58 traits available |
| **Trait composition demo** | Buried in test files | No visible demo of composing traits onto objects |
| **Object gallery** | 3 objects in nav, 12 exist | Objects are supposed to be central |
| **Context comparison** | View profiles isolated | No side-by-side "same object, different context" |
| **Trait engine demo** | statusRegistry not explained | Key differentiator is invisible |
| **A11y visibility** | Buried in proofs, no nav entry | First-class concern appears hidden |
| **Viz system story** | Charts scattered, no cohesion | TEP architecture not visible |

### What EXISTS but is HIDDEN

1. **Trait definitions** (58 YAML files) - no browsable index
2. **Object definitions** (12 YAML files) - no discoverable catalog
3. **Accessibility implementation** - scattered across 6+ directories
4. **Contribution system** - traits register context-aware UI, not visible
5. **Status registry** - key pattern, no explanation

---

## Task 3: Proposed OODS-Native Navigation

```
OODS Foundry
│
├── 1. Understanding OODS
│   ├── Philosophy (Objects, Traits, Contexts explained)
│   ├── How Trait Composition Works
│   ├── The Status Registry
│   └── Accessibility Approach
│
├── 2. Objects (THE STARS)
│   ├── User
│   │   ├── With Addressable
│   │   ├── With Authable
│   │   ├── With Preferences
│   │   └── In All Contexts (Detail, List, Card, etc.)
│   ├── Organization
│   │   ├── Members (Authable)
│   │   └── Locations (Addressable)
│   ├── Product
│   │   └── Category Browser (Classifiable)
│   ├── Invoice
│   │   └── Lifecycle (Stateful, Billable)
│   └── Subscription
│       └── Lifecycle (Stateful, Billable)
│
├── 3. Traits (Building Blocks)
│   ├── Core
│   │   ├── Addressable
│   │   ├── Authable
│   │   ├── Classifiable
│   │   ├── Communicable
│   │   └── Preferenceable
│   ├── Lifecycle
│   │   ├── Stateful
│   │   ├── Timestampable
│   │   └── Archivable
│   └── Statusable (with Registry Demo)
│
├── 4. Contexts (How Objects Render)
│   ├── Same Object, Different Contexts (HERO DEMO)
│   ├── Detail View
│   ├── List View
│   ├── Form View
│   ├── Card View
│   ├── Timeline View
│   └── Dashboard View
│
├── 5. Visualizations (TEP System)
│   ├── How TEP Works
│   ├── Charts (Line, Bar, Area, Scatter, Heatmap)
│   ├── Hierarchical (Treemap, Sunburst)
│   ├── Network & Flow (Sankey, ForceGraph)
│   └── Spatial (Choropleth, Bubble Map)
│
├── 6. Primitives (Supporting Cast)
│   ├── Forms (TextField, Select, Checkbox, etc.)
│   ├── Feedback (Dialog, Toast, Banner, Badge)
│   ├── Navigation (Tabs, Breadcrumbs, Pagination)
│   └── Data Display (Table, Progress, EmptyState)
│
├── 7. Domains
│   ├── Authz (Membership, Roles, Permissions)
│   ├── Billing (Invoice, Subscription, Usage)
│   └── Communication (Messages, Channels)
│
├── 8. Accessibility
│   ├── Approach & Philosophy
│   ├── High Contrast / ForcedColors
│   ├── Screen Reader Support
│   └── Keyboard Navigation
│
├── 9. Tokens & Theming
│   ├── Token Architecture (Reference → Semantic → Component)
│   ├── Design Tokens
│   ├── Viz Tokens
│   └── Brand Theming
│
└── 10. Proofs & Internals
    ├── Proofs (Billing ACL, Compliance, Temporal)
    ├── Performance Harnesses
    └── Explorer (App-Specific)
```

---

## Task 4: Key Recommendations

1. **Create "Understanding OODS" section** - explain the philosophy before showing components
2. **Make Objects the hero** - move from 3 buried entries to central navigation
3. **Add trait browsing** - show the 58 traits as composable capabilities
4. **Create context comparison demo** - same object rendered in all 8 contexts
5. **Surface the trait engine** - demo the statusRegistry pattern
6. **Elevate accessibility** - dedicated section, not buried proofs
7. **Tell the TEP story** - viz system as cohesive architecture, not scattered charts
8. **Demote primitives** - supporting cast, not the main show

---

## Structured Data Reference

From `refresh_structured_data.py` (as of 2025-11-26):
- **Components:** 70
- **Traits:** 34 (in structured data, 58 total trait files)
- **Objects:** 12
- **Domains:** 1
- **Patterns:** 2

The agent research found significantly more trait files (58) than the structured data reports (34), suggesting some traits aren't captured in the YAML extraction.

---

## Conclusion

OODS Foundry is **not a component library**. It's a **trait-based object system** with **context-aware rendering**. The navigation should teach this philosophy, not hide it behind a generic "Components" section.

The current structure tells the wrong story. The proposed structure makes Objects central, Traits visible, Contexts demonstrable, and the trait engine discoverable.
