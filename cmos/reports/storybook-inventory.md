# Storybook Inventory Report

**Generated:** 2025-12-03
**Mission:** B35.5 - Storybook Structure Audit
**Total Story Files:** 104

---

## Summary by Location

| Location | Count | Purpose |
|----------|-------|---------|
| `stories/` | 60 | Main public stories (components, viz, domains, proofs) |
| `src/stories/` | 22 | Internal component stories (base, forms, statusables, proofs) |
| `apps/explorer/src/stories/` | 16 | Explorer-app specific component demos |
| `src/components/viz/spatial/` | 6 | Co-located spatial visualization stories |

---

## Detailed Inventory by Directory

### 1. `stories/` (Root Level Stories) - 60 files

#### `stories/authz/` (2 files)
- `MembershipManager.stories.tsx` - Organization membership management
- `RolePermissionMatrix.stories.tsx` - RBAC permission matrix

#### `stories/components/` (18 files)
- `AddressDisplay.stories.tsx` - Address formatting display
- `AddressForm.stories.tsx` - Address input form
- `Breadcrumbs.stories.tsx` - Navigation breadcrumbs
- `Communication.*.stories.tsx` (4 files) - MessageTimeline, ConversationThread, DeliveryHealthWidget, ChannelPlanEditor
- `EmptyState.stories.tsx` - Empty state patterns
- `ForceGraph.stories.tsx` - Force-directed graph viz (component-level)
- `Pagination.stories.tsx` - Pagination controls
- `PreferenceForm.stories.tsx` - User preferences form
- `Progress.stories.tsx` - Progress indicators
- `Sankey.stories.tsx` - Sankey diagram (component-level)
- `Stepper.stories.tsx` - Multi-step wizard
- `Sunburst.stories.tsx` - Sunburst chart (component-level)
- `Tabs.stories.tsx` - Tab navigation (comprehensive, 334 lines)
- `Toast.stories.tsx` - Toast notifications (ToastPortal + ToastProvider)
- `Treemap.stories.tsx` - Treemap viz (component-level)

#### `stories/components/classification/` (4 files)
- `CategoryPicker.stories.tsx`
- `CategoryTree.stories.tsx`
- `TagInput.stories.tsx`
- `TagList.stories.tsx`

#### `stories/domains/` (2 files)
- `AccountArchetypes.stories.tsx` - Account type patterns

#### `stories/domains/Billing/` (5 files)
- `Invoice.stories.tsx` - Invoice views
- `Invoice.lifecycle.stories.tsx` - Invoice state transitions
- `Subscription.stories.tsx` - Subscription views
- `Subscription.lifecycle.stories.tsx` - Subscription state transitions
- `Usage.metered.stories.tsx` - Metered usage patterns

#### `stories/foundations/` (1 file)
- `VizTokens.stories.tsx` - Visualization design tokens

#### `stories/objects/` (6 files)
- `OrganizationLocations.stories.tsx`
- `OrganizationMembers.stories.tsx`
- `ProductCategoryBrowser.stories.tsx`
- `UserPreferences.stories.tsx`
- `UserWithAddresses.stories.tsx`
- `UserWithAuthable.stories.tsx`

#### `stories/performance/` (4 files)
- `CompositorHarness.stories.tsx` - Performance testing
- `ListHarness.stories.tsx` - List virtualization tests
- `TokenTransformHarness.stories.tsx` - Token transform perf
- `UsageAggregationHarness.stories.tsx` - Aggregation perf

#### `stories/proofs/` (5 files)
- `billing-acl.stories.tsx` - Billing ACL adapter proof
- `compliance.stories.tsx` - RBAC/audit proof
- `context-gallery.stories.tsx` - Domain context rendering proof
- `DashboardContexts.stories.tsx` - Dashboard examples
- `TemporalHygiene.stories.tsx` - Dual-time model proof

#### `stories/traits/` (1 file)
- `AddressFormatting.stories.tsx`

#### `stories/viz/` (8 files)
- `AreaChart.stories.tsx`
- `BarChart.stories.tsx`
- `FacetedCharts.stories.tsx`
- `Heatmap.stories.tsx`
- `LayeredCharts.stories.tsx`
- `LineChart.stories.tsx`
- `PatternGalleryV2.stories.tsx` - Pattern gallery (has responsive issues)
- `Patterns.stories.tsx` - Responsive patterns (has clipping issues)
- `ScatterChart.stories.tsx`

#### `stories/viz/echarts/` (4 files)
- `Graph.stories.tsx` - Force graph (ECharts adapter-level)
- `Sankey.stories.tsx` - Sankey diagram (ECharts adapter-level, 535 lines)
- `Sunburst.stories.tsx` - Sunburst chart (ECharts adapter-level)
- `Treemap.stories.tsx` - Treemap (ECharts adapter-level)

---

### 2. `src/stories/` (Internal Stories) - 22 files

#### `src/stories/base-stories/` (3 files)
- `Badge.stories.tsx` - Badge with statusRegistry (87 lines)
- `Button.stories.tsx` - Button variants with intents/sizes (83 lines)
- `TokensRoundtrip.stories.tsx` - Token transformation tests

#### `src/stories/components/` (3 files)
- `Dialog.stories.tsx`
- `Popover.stories.tsx`
- `Sheet.stories.tsx`

#### `src/stories/components-stories/` (1 file)
- `PageHeader.stories.tsx`

#### `src/stories/forms/` (3 files)
- `Checkbox.stories.tsx` - Checkbox with validation states (89 lines)
- `Select.stories.tsx` - Select with validation/density (112 lines)
- `TextField.stories.tsx`

#### `src/stories/proofs/view-profiles/` (7 files)
- `Card.stories.tsx`
- `Detail.stories.tsx`
- `Form.stories.tsx`
- `ForcedColors.stories.tsx` - High-contrast mode proof
- `Inline.stories.tsx`
- `List.stories.tsx`
- `Timeline.stories.tsx`
- `shared.tsx` (helper module, not a story)

#### `src/stories/statusables/` (2 files)
- `Banner.stories.tsx` - Banner with statusRegistry (82 lines)
- `Toast.stories.tsx` - Toast with statusRegistry (108 lines)

#### `src/stories/subscription-stories/` (1 file)
- `SubscriptionContexts.stories.tsx`

#### `src/stories/table/` (1 file)
- `Table.stories.tsx`

#### `src/stories/user-stories/` (1 file)
- `UserDetail.stories.tsx`

---

### 3. `apps/explorer/src/stories/` (Explorer-Specific) - 16 files

- `Badge.stories.tsx` - Simple badge demo (25 lines)
- `Banner.stories.tsx` - Simple banner demo (26 lines)
- `BrandA.stories.tsx` - Brand theming example
- `Button.stories.tsx` - Simple button demo (25 lines)
- `Checkbox.stories.tsx` - Simple checkbox demo (25 lines)
- `HighContrast.Guardrails-hc.stories.tsx` - HC mode testing
- `Input.stories.tsx` - Text input
- `Patterns.Form.stories.tsx` - Form patterns
- `Radio.stories.tsx` - Radio buttons
- `Select.stories.tsx` - Simple select demo (32 lines)
- `StatusChip.stories.tsx` - Status chips
- `Tabs.stories.tsx` - Simple tabs demo (32 lines)
- `TextArea.stories.tsx` - Text area
- `Toast.stories.tsx` - Simple toast demo (30 lines)
- `Toggle.stories.tsx` - Toggle switch
- `Tooltip.stories.tsx` - Tooltips

---

### 4. `src/components/viz/spatial/` (Co-located) - 6 files

- `AccessibleMapFallback.stories.tsx`
- `BubbleMap.stories.tsx`
- `ChoroplethMap.stories.tsx`
- `MapControls.stories.tsx`
- `MapLegend.stories.tsx`
- `SpatialContainer.stories.tsx`

---

## Duplicate Analysis

### Stories with Same Base Name in Multiple Locations

| Component | Count | Locations |
|-----------|-------|-----------|
| Toast | 3 | `stories/components/`, `apps/explorer/`, `src/stories/statusables/` |
| Treemap | 2 | `stories/components/`, `stories/viz/echarts/` |
| Tabs | 2 | `stories/components/`, `apps/explorer/` |
| Sunburst | 2 | `stories/components/`, `stories/viz/echarts/` |
| Select | 2 | `apps/explorer/`, `src/stories/forms/` |
| Sankey | 2 | `stories/components/`, `stories/viz/echarts/` |
| Checkbox | 2 | `apps/explorer/`, `src/stories/forms/` |
| Button | 2 | `apps/explorer/`, `src/stories/base-stories/` |
| Banner | 2 | `apps/explorer/`, `src/stories/statusables/` |
| Badge | 2 | `apps/explorer/`, `src/stories/base-stories/` |

---

## Story Hierarchy Structure

```
Storybook
├── Components/
│   ├── Feedback/
│   │   └── Toast (stories/components/)
│   ├── Navigation/
│   │   └── Tabs (stories/components/)
│   ├── Primitives/
│   │   ├── Button (src/stories/base-stories/)
│   │   ├── Checkbox (src/stories/forms/)
│   │   ├── Select (src/stories/forms/)
│   │   └── Tabs (apps/explorer/) [different title!]
│   ├── Statusables/
│   │   ├── Badge (src/stories/base-stories/)
│   │   ├── Banner (src/stories/statusables/)
│   │   └── Toast (src/stories/statusables/)
│   └── Visualization/
│       ├── ForceGraph
│       ├── Sankey
│       ├── Sunburst
│       └── Treemap
├── Contexts/
│   └── Domain Context Gallery
├── Explorer/
│   ├── Components/
│   │   ├── Badge
│   │   ├── Banner
│   │   ├── Button
│   │   └── ... (all apps/explorer/ stories)
│   └── Proofs/
│       ├── Billing ACL
│       └── Compliance Core
├── Proofs/
│   ├── Dashboard Contexts
│   └── Temporal Hygiene
└── Visualization/
    └── ECharts/
        ├── Graph
        ├── Sankey
        ├── Sunburst
        └── Treemap
```

---

## Notes

1. **Explorer stories** use their own component implementations (imported from `../components/`) with simpler props API
2. **Viz component stories** (e.g., `stories/components/Treemap.stories.tsx`) test the React wrapper component
3. **Viz ECharts stories** (e.g., `stories/viz/echarts/Treemap.stories.tsx`) test the underlying ECharts adapter
4. **Statusables stories** use the statusRegistry for domain-driven status styling
5. **Performance harness stories** are for internal testing, not public documentation
