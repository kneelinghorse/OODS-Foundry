// @oods/viz-core — headless visualization engine (sprint-109 Phase-0 beachhead).
//
// Public surface mirrors the original src/viz/index.ts headless exports (minus
// the React hooks, which stay in src/viz) and additionally exposes the chart
// recommender so the MCP viz.render handler can consume it. The spatial (geo) /
// network / hierarchy / echarts-complex chart clusters that began deferred have
// since shipped (sprints 111–120) and are exported below.

// Spec IR + AJV validator
export * from './spec/normalized-viz-spec.js';

// Dashboard IR + AJV validator (sprint-113 m01) — composes bare viz.render chart
// specs as panels + layout + cross-filter links + KPI tiles (Option C).
export * from './spec/dashboard-spec.js';

// Runtime cross-filter selection types (sprint-113 m01) — Selection / SelectionState
// frozen here so m03 (resolver) + m04 (linked-selection reducer) depend only on m01.
export * from './spec/dashboard-selection.js';

// Headless dashboard primitives (sprint-113) — pure deterministic helpers over
// the DashboardSpec IR (m02 auto-layout; m03 KPI + cross-filter resolver; ...).
export * from './dashboard/index.js';

// Network/hierarchy data contracts (treemap/sunburst/force/sankey inputs).
// These are carried as the SEPARATE adapter `input` param — decoupled from the IR.
export * from './spec/network-flow.js';

// Geo (choropleth/bubble_map) data contract — the slim SpatialSpec subset the
// headless spatial adapters read (sprint-112 m01). Distinct from the IR.
export * from './spec/spatial.js';

// Spec -> renderer adapters (pure, headless transformers)
export * from './adapters/vega-lite-adapter.js';
export * from './adapters/echarts-adapter.js';
export { restoreEChartsFormats } from './adapters/echarts-format.js';
export * from './adapters/echarts-interactions.js';
export * from './adapters/renderer-selector.js';

// Network/hierarchy ECharts adapters (sprint-111). Explicit-only types that build
// their ECharts series from the input data param, not the IR.
export * from './adapters/echarts/token-resolver.js';
export * from './adapters/echarts/link-integrity.js';
export * from './adapters/echarts/hierarchy-utils.js';
export * from './adapters/echarts/treemap-adapter.js';
export * from './adapters/echarts/sunburst-adapter.js';
export * from './adapters/echarts/sankey-utils.js';
export * from './adapters/echarts/sankey-adapter.js';
export * from './adapters/echarts/graph-adapter.js';
export * from './adapters/echarts/chord-adapter.js';

// Geo (choropleth/bubble_map) ECharts adapters (sprint-112). Explicit-only types
// that build their ECharts option from a parsed FeatureCollection + tabular data.
export * from './adapters/spatial/index.js';

// Chart recommender + pattern catalogue
export * from './patterns/suggest-chart.js';
export * from './patterns/index.js';
export * from './patterns/translate-pattern.js';

// Rung-1 retirement surface: these implementations have always lived in
// viz-core, but the legacy src/viz forwarding modules exposed them only by
// deep path. Keep the package entry as the single consumer-facing resolution.
export {
  chartPatternsV2,
  getPatternV2ById,
  type ChartPatternV2,
  type LayoutStrategy,
} from './patterns/chart-patterns-v2.js';
export {
  recommendInteractions,
  type InteractionBundle,
  type InteractionScoreEntry,
} from './patterns/interaction-scorer.js';
export {
  scoreLayoutForPattern,
  type LayoutRecommendationBundle,
} from './patterns/layout-scorer.js';
export { extractFieldBlueprint } from './patterns/pattern-field-helpers.js';
export {
  RESPONSIVE_BREAKPOINT_MIN_PX,
  scoreResponsiveStrategies,
} from './patterns/responsive-scorer.js';

// Headless rows -> NormalizedVizSpec builder (explicit + suggest modes)
export * from './builder/spec-builder.js';

// Accessibility synthesis (table / narrative / equivalence / data-analysis)
export * from './a11y/index.js';
export { formatDimension, formatValue } from './a11y/format.js';

// Accuracy rules (sprint-170 m01) — the four deterministic, reader-only structural rules
// artifact.certify evaluates as its accuracy pillar (#818, the fourth #977 pillar). Pure
// readers of the IR + the compiled Vega-Lite spec; they never rebuild or re-render (#110).
export * from './accuracy/index.js';

// Transforms, encoding, token mapping
export * from './transforms/stack-transform.js';
export * from './encoding/color-intensity-mapper.js';
export * from './tokens/scale-token-mapper.js';
// Shared categorical-palette resolver (sprint-138 m02) — ONE source for the bake
// (vega-lite-adapter) AND the grade (certify-contrast), so certified == baked.
export * from './tokens/categorical-palette.js';
// OODS chrome-config resolver (sprint-144 m02) — the chrome counterpart to the
// palette bake; themes the cartesian Vega `config` (background/axes/type/legend/view).
export * from './tokens/oods-vega-config.js';
// OODS ECharts chrome resolver (sprint-145 m02) — the ECharts mirror of the cartesian
// chrome; themes the 8 ECharts-primary types' background/borders/labels/title by
// per-adapter direct assignment (no single config block).
export * from './tokens/oods-echarts-chrome.js';

// Temporal analysis runtime (sprint-110) — the finest-granularity scan + the UTC-pinned cell
// parser, surfaced on the barrel for the mcp-server measure time-grain check (sprint-122 m02).
// NAMED (not `export *`) so the TemporalGranularity TYPE stays the single re-export from
// builder/spec-builder.ts (an `export *` here would duplicate it).
export { finestGranularity, parseTemporalValue } from './analysis/temporal.js';

export { VIZ_RECIPES, VIZ_RECIPES_CENSUS, type VizRecipeCapability, type VizRecipesCensus } from './registry/viz-recipes.js';
export { validateVizPatternRegistry, canonicalPatternValue, type VizPatternCapability, type VizPatternScope, type VizPatternProvenance } from './registry/viz-patterns.js';
