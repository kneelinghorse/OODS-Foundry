# Responsive Visualization Strategies

`src/viz/patterns/responsive-scorer.ts` formalises the **mobile → tablet → desktop** decisions we previously duplicated in specs and docstrings. The scorer evaluates a pattern’s heuristics plus the caller-provided `SchemaIntent` and emits concrete layout + adjustment recommendations.

## When to Use

- **Storybook** – drive toolbar controls so reviewers can preview mobile/tablet/desktop in one gallery.
- **CLI scaffolds** – `pnpm viz:suggest` can print responsive hints next to the suggested pattern.
- **Runtime components** – feed breakpoints from `RenderObject` contexts to pick the correct layout/interaction bundle.

## API

```ts
import { scoreResponsiveStrategies } from '@/viz/patterns/responsive-scorer';

const schema: SchemaIntent = {
  measures: 1,
  dimensions: 2,
  goal: ['comparison'],
  requiresGrouping: true,
  density: 'dense',
};

const { recipes } = scoreResponsiveStrategies('sparkline-grid', schema);
```

Each recipe contains:

| Field | Description |
| --- | --- |
| `breakpoint` | `'mobile' | 'tablet' | 'desktop'` |
| `layout` | `single | facet | layer | concat` recommendation for the viewport |
| `score` | Confidence (0–1) that the layout satisfies the schema at that breakpoint |
| `adjustments[]` | Actionable strings – collapse legend, stack panels, enable brush, etc. |

## Heuristic Highlights

1. **Grouping pressure** – `dimensions > 1` or `requiresGrouping` pushes mobile layouts into `single` stacks, encourages tablet facets, and leaves desktop at the default.
2. **Multi-metric patterns** – enable tap-to-isolate on mobile and keep layered layouts on tablet/desktop.
3. **Temporal data** – tablet and desktop breakpoints recommend brush/zoom interactions when `temporals > 0`.
4. **Dense scatter/heatmap** – mobile disables brushes and emphasises keyboard/tap friendly cues.

## Implementation Notes

- Baseline scores: `mobile=0.60`, `tablet=0.72`, `desktop=0.88`. Adjustments bump or penalise within a safe window (0.48–0.98).
- Layout fallbacks: `concat → facet` on tablet, `layer → facet` when grouping pressure exists, `single` on mobile by default.
- Adjustments list is idempotent – call `scoreResponsiveStrategies` once and cache per pattern per schema to avoid churn.

## Author Workflow

1. Call scorer inside docs/stories to show recommended layout per breakpoint.
2. Update component props (e.g., `BarChart` height, facet columns) based on emitted layout.
3. Feed adjustments into UI (chips, callouts, inline tips) so designers can reason about trade-offs early.

## Testing

`tests/viz/patterns/pattern-library-v2.test.ts` validates the scorer for representative schemas. Add new assertions there whenever a heuristic changes.
