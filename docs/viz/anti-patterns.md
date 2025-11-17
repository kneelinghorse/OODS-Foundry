# Visualization Anti-patterns

These anti-patterns are pulled from 24 visualization missions plus the telemetry gathered in Sprints 21-23. Review them before approving specs or Storybook demos.

## 1. Pie/Donut overload
- **Symptom**: categorical shares communicated through pie/donut segments.
- **Issue**: hard to compare slices; fails accessibility contrast checks.
- **Fix**: use `stacked-bar` (absolute) or `stacked-100-bar` (normalized). See [`chart-selection-decision-tree.md`](./chart-selection-decision-tree.md).

## 2. Raw heatmaps for sparse data
- **Symptom**: applying `MarkRect` to a dataset with gaps or <6 rows.
- **Issue**: empty cells imply missing data and mislead confidence.
- **Fix**: switch to grouped bar/line or fill missing combinations explicitly so the heatmap remains dense. The CLI flags this via the `density` hint.

## 3. Trend lines without consistent grids
- **Symptom**: multi-series line charts using irregular temporal spacing.
- **Issue**: hard to parse slopes; leads to incorrect correlation claims.
- **Fix**: align to a fixed interval (week/month) or use grouped bars if sampling is inconsistent.

## 4. Overloaded color encodings
- **Symptom**: reusing `EncodingColor` for both grouping and semantics (positive/negative or KPI thresholds).
- **Issue**: accessible palettes cannot communicate two concepts at once.
- **Fix**: dedicate color to a single meaning; introduce annotations for the rest.

## 5. Missing fallback narratives
- **Symptom**: complex charts lacking `spec.a11y.narrative` or table fallbacks.
- **Issue**: fails RDV.4; screen-reader users lose insight.
- **Fix**: populate the `a11y` block and render `<AccessibleTable>` per the [Accessibility Checklist](./accessibility-checklist.md).

## 6. Ignoring responsive contracts
- **Symptom**: leaving facet grids horizontal on mobile or exposing drag interactions on narrow touch breakpoints.
- **Issue**: users must scroll sideways, hover affordances disappear, and Chromatic baselines fail to catch regressions.
- **Fix**: follow `scoreResponsiveStrategies()` output, collapse legends, and document the plan in `docs/viz/best-practices.md`.

## 7. Layout mismatch
- **Symptom**: using concat when a facet or layer would explain the story with fewer panels.
- **Issue**: redundant components inflate payloads and scatter focus order.
- **Fix**: run through the [layout selection guide](./best-practices.md#layout-selection-guide-facet-vs-layer-vs-concat) and downgrade layouts wherever possible.

## 8. Renderer drift
- **Symptom**: forcing Vega-Lite to render >5k points with highlight interactions or switching to ECharts without evidence.
- **Issue**: laggy interactions or bloated bundles.
- **Fix**: consult [`performance-optimization.md`](./performance-optimization.md) and attach the `artifacts/performance/` JSON when overriding `selectVizRenderer`.

## 9. Interaction overload
- **Symptom**: stacking highlight + tooltip + filter + brush + zoom on a single chart.
- **Issue**: noisy UX and confusing keyboard equivalents.
- **Fix**: limit to the smallest interaction set that solves the task. Split workflows into multiple panels if needed and document the non-pointer story.

## 10. Anonymous layers and marks
- **Symptom**: layered charts without `mark.options.id` or `LayoutLayer.order` hints.
- **Issue**: renderers reorder layers differently, producing inconsistent screenshots and Chromatic noise.
- **Fix**: set explicit IDs and order hints; add notes to the spec referencing the canonical pattern.

## 11. Unscoped layout filters
- **Symptom**: facets or concat sections reference the entire dataset without `filters`, then rely on component-level filtering.
- **Issue**: redundant data flows and mismatched totals between panels.
- **Fix**: encode section filters in the layout trait so adapters pre-slice data deterministically.

## 12. No before/after validation
- **Symptom**: merging fixes without proving improvement.
- **Issue**: future contributors cannot learn from the change and regressions recur.
- **Fix**: capture a normalized spec pair under `examples/viz/before-after/` and reference it in docs/PRs.

Keep this checklist handy and pair it with `pnpm viz:best-practices` for contextual reminders.
