# Storybook Cleanup Decisions

**Generated:** 2025-12-03
**Mission:** B35.5 - Storybook Structure Audit
**Status:** Research complete - cleanup mission should be created separately

---

## Executive Summary

After thorough investigation, **most apparent duplicates are intentional variations** serving different purposes. The Storybook structure is more organized than initially appeared. The main issues are:

1. **Naming confusion** - Similar names across different hierarchies
2. **Unclear purpose** for some explorer-specific stories
3. **Some proofs may be obsolete** after development completed

---

## Duplicate Analysis & Decisions

### Toast (3 locations)

| Location | Purpose | Decision |
|----------|---------|----------|
| `stories/components/Toast.stories.tsx` | Full ToastPortal + ToastProvider demo with queue stacking, sticky, actions | **KEEP** - Primary public story |
| `apps/explorer/src/stories/Toast.stories.tsx` | Simple explorer-app Toast component demo | **KEEP** - Explorer-specific implementation |
| `src/stories/statusables/Toast.stories.tsx` | Toast using statusRegistry for domain-driven styling | **KEEP** - Shows statusables pattern |

**Rationale:** Three different Toast implementations exist - these are NOT duplicates. Each serves a specific purpose:
- Main: Interactive toast service
- Explorer: Simplified app-specific component
- Statusables: Domain-aware styling via status registry

---

### Treemap & Sunburst (2 locations each)

| Location | Purpose | Decision |
|----------|---------|----------|
| `stories/components/Treemap.stories.tsx` | React component wrapper with autodocs, controls | **KEEP** - Component API documentation |
| `stories/viz/echarts/Treemap.stories.tsx` | ECharts adapter layer testing | **KEEP** - Adapter implementation details |

**Rationale:** These test different layers of the abstraction:
- Component-level: How to USE the component (props, callbacks)
- Adapter-level: How the ECharts translation works

Same applies to Sunburst, Sankey, and Graph.

---

### Tabs (2 locations)

| Location | Purpose | Lines | Decision |
|----------|---------|-------|----------|
| `stories/components/Tabs.stories.tsx` | Comprehensive with overflow, sizes, a11y, VRT | 334 | **KEEP** - Primary public story |
| `apps/explorer/src/stories/Tabs.stories.tsx` | Simple explorer-app demo | 32 | **KEEP** - Explorer-specific |

**Rationale:** Different components with different APIs. The explorer version imports from `../components/Tabs` (explorer's own implementation).

---

### Button (2 locations)

| Location | Purpose | Lines | Decision |
|----------|---------|-------|----------|
| `src/stories/base-stories/Button.stories.tsx` | Intents, sizes, VRT-critical | 83 | **KEEP** - Primary |
| `apps/explorer/src/stories/Button.stories.tsx` | Simple demo | 25 | **KEEP** - Explorer-specific |

**Rationale:** Different implementations. Main Button has `intent` prop, explorer Button is simpler.

---

### Badge (2 locations)

| Location | Purpose | Lines | Decision |
|----------|---------|-------|----------|
| `src/stories/base-stories/Badge.stories.tsx` | statusRegistry-driven, SnapshotGrid, VRT | 87 | **KEEP** - Primary |
| `apps/explorer/src/stories/Badge.stories.tsx` | Simple demo | 25 | **KEEP** - Explorer-specific |

**Rationale:** Main uses statusables pattern; explorer is standalone.

---

### Banner (2 locations)

| Location | Purpose | Lines | Decision |
|----------|---------|-------|----------|
| `src/stories/statusables/Banner.stories.tsx` | statusRegistry-driven, emphasis variants | 82 | **KEEP** - Primary |
| `apps/explorer/src/stories/Banner.stories.tsx` | Simple demo | 26 | **KEEP** - Explorer-specific |

**Rationale:** Different implementations - main uses statusables, explorer is standalone.

---

### Checkbox (2 locations)

| Location | Purpose | Lines | Decision |
|----------|---------|-------|----------|
| `src/stories/forms/Checkbox.stories.tsx` | Validation states, density variants, VRT | 89 | **KEEP** - Primary |
| `apps/explorer/src/stories/Checkbox.stories.tsx` | Simple demo | 25 | **KEEP** - Explorer-specific |

**Rationale:** Different implementations with different features.

---

### Select (2 locations)

| Location | Purpose | Lines | Decision |
|----------|---------|-------|----------|
| `src/stories/forms/Select.stories.tsx` | Validation states, density variants, VRT | 112 | **KEEP** - Primary |
| `apps/explorer/src/stories/Select.stories.tsx` | Simple demo | 32 | **KEEP** - Explorer-specific |

**Rationale:** Different implementations with different features.

---

## Proofs Section Audit

### `stories/proofs/` (Main Proofs)

| Story | Purpose | Value | Decision |
|-------|---------|-------|----------|
| `context-gallery.stories.tsx` | Shows RenderObject in all view contexts (detail, list, form, timeline, card, inline) | HIGH - Demonstrates core rendering pattern | **KEEP** |
| `billing-acl.stories.tsx` | Demonstrates ACL adapters (Stripe, Chargebee, Zuora) translating to canonical types | HIGH - Documents integration pattern | **KEEP** |
| `compliance.stories.tsx` | Interactive RBAC permission check + audit log demo | HIGH - Documents compliance features | **KEEP** |
| `DashboardContexts.stories.tsx` | Dashboard examples (User, Subscription, Product, Spatial, NetworkFlow) | HIGH - Documents dashboard patterns | **KEEP** |
| `TemporalHygiene.stories.tsx` | Dual-time model demo (business_time vs system_time) | HIGH - Documents time handling | **KEEP** |

**Rationale:** All proofs in `stories/proofs/` are valuable documentation of architectural patterns.

---

### `src/stories/proofs/view-profiles/` (View Profile Proofs)

| Story | Purpose | Decision |
|-------|---------|----------|
| `Card.stories.tsx` | Card view context | **KEEP** - View profile documentation |
| `Detail.stories.tsx` | Detail view context | **KEEP** |
| `Form.stories.tsx` | Form view context | **KEEP** |
| `Inline.stories.tsx` | Inline view context | **KEEP** |
| `List.stories.tsx` | List view context | **KEEP** |
| `Timeline.stories.tsx` | Timeline view context | **KEEP** |
| `ForcedColors.stories.tsx` | High-contrast mode proof | **KEEP** - A11y documentation |

**Rationale:** These document the view profile system. Keep all.

---

## Explorer Stories Audit

The `apps/explorer/src/stories/` directory contains 16 stories that appear to be simplified versions of main components.

### Why Does Explorer Have Its Own Stories?

After investigation, the explorer app has its own component implementations in `apps/explorer/src/components/`:
- These are NOT imports from the main `src/components/`
- They are simpler, app-specific implementations
- The stories document the explorer's own API

### Decision: KEEP ALL Explorer Stories

They are **not duplicates** - they document a separate component library used by the explorer app.

---

## Performance Stories

| Story | Purpose | Decision |
|-------|---------|----------|
| `CompositorHarness.stories.tsx` | Performance testing | **KEEP** - Internal testing tool |
| `ListHarness.stories.tsx` | List virtualization tests | **KEEP** |
| `TokenTransformHarness.stories.tsx` | Token transform perf | **KEEP** |
| `UsageAggregationHarness.stories.tsx` | Aggregation perf | **KEEP** |

**Rationale:** These are internal testing tools, not public documentation. Consider moving to a separate "Internals" or "Dev Tools" section in future.

---

## Recommended Actions

### Immediate (No Changes Needed)
1. **No true duplicates found** - All apparent duplicates serve different purposes
2. **Current structure is valid** - Stories are organized by purpose

### Future Improvements (Separate Mission)

1. **Consolidate story hierarchy titles:**
   - Main primitives: `Components/Primitives/*`
   - Explorer: `Explorer/Components/*`
   - This is already done correctly

2. **Add story descriptions:**
   - Some explorer stories lack context about why they exist separately
   - Add docs explaining "This is the explorer app's own implementation"

3. **Consider reorganizing:**
   - Move `src/stories/` into `stories/` with clear naming
   - Currently split between two directories with no clear reason

4. **Add Storybook hierarchy documentation:**
   - Document the intentional structure in a README
   - Explain the three-tier pattern (main, explorer, statusables)

---

## Files That Could Be Deleted (NONE IDENTIFIED)

After thorough investigation, **no files should be deleted**. All apparent duplicates are intentional variations serving different purposes.

---

## Conclusion

The Storybook appears to have duplicates but actually has a well-organized structure:

1. **Main stories** (`stories/`) - Public component documentation
2. **Internal stories** (`src/stories/`) - Statusables, forms, base components with VRT
3. **Explorer stories** (`apps/explorer/`) - App-specific component library
4. **Co-located stories** (`src/components/viz/spatial/`) - Spatial viz documentation

The confusion arises from:
- Similar component names across different implementations
- Lack of documentation explaining the structure
- Multiple Toast/Badge/Button implementations that look the same but aren't

**Recommendation:** Create a follow-up mission to add documentation explaining this structure, rather than deleting anything.
