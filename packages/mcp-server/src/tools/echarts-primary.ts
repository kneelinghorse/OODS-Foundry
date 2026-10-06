// Shared source of truth for the ECharts-primary chart types.
//
// Lifted verbatim out of viz.render.ts (sprint-136 m02) so the two consumers
// share ONE definition and can never drift:
//   - viz.render dispatches by the tool INPUT's chartType (isEChartsPrimaryType).
//   - artifact.certify classifies by the IR's first mark trait
//     (isEChartsPrimaryMarkTrait) — a NormalizedVizSpec has no chartType.
// Drift here would let certify certify a type viz.render treats as ECharts-primary.

import type { VizRenderInput } from '../schemas/generated.js';

// ---- ECharts-primary render path (sprint-111 m02 treemap; m03 sunburst+sankey) -
// treemap/sunburst/sankey are EXPLICIT-ONLY and DECOUPLED from the rows/recommender
// path: each builds a metadata-only spec, dispatches to its ported adapter with the
// SEPARATE data branch (hierarchy or sankey), and auto-promotes the ECharts option
// as the primary payload (these chart types have no Vega-Lite equivalent).
export type EChartsPrimaryType = 'treemap' | 'sunburst' | 'sankey' | 'force_graph' | 'choropleth' | 'bubble_map' | 'flow_map' | 'chord';

export interface EChartsPrimaryConfig {
  readonly mark: string;
  readonly label: string;
  readonly noun: string;
  readonly dataBranch: 'hierarchy' | 'sankey' | 'network' | 'geo' | 'chord';
}

export const ECHARTS_PRIMARY: Record<EChartsPrimaryType, EChartsPrimaryConfig> = {
  treemap: { mark: 'MarkTreemap', label: 'Treemap', noun: 'hierarchical data', dataBranch: 'hierarchy' },
  sunburst: { mark: 'MarkSunburst', label: 'Sunburst', noun: 'hierarchical data', dataBranch: 'hierarchy' },
  sankey: { mark: 'MarkSankey', label: 'Sankey diagram', noun: 'flow data', dataBranch: 'sankey' },
  force_graph: { mark: 'MarkGraph', label: 'Force-directed graph', noun: 'network data', dataBranch: 'network' },
  // sprint-112 geo: choropleth/bubble_map carry the 'geo' branch (inline geometry +
  // per-type encoding) and dispatch to the ported spatial adapters. Like the
  // hierarchy/flow types they have no Vega-Lite equivalent, so the ECharts option
  // is the primary payload. UNLIKE them they are NOT self-contained: the
  // FeatureCollection rides back on echartsSpec.__registration (the client
  // re-registers the map by name).
  choropleth: { mark: 'MarkChoropleth', label: 'Choropleth map', noun: 'regional values', dataBranch: 'geo' },
  bubble_map: { mark: 'MarkBubble', label: 'Bubble map', noun: 'geographic points', dataBranch: 'geo' },
  // sprint-119 m01 flow_map: origin→destination ARC lines on the geo coordinate
  // system. Reuses the 'geo' data branch + the __registration escape hatch exactly
  // like choropleth/bubble_map; rendered via the headless flow-line spatial adapter.
  flow_map: { mark: 'MarkFlow', label: 'Flow map', noun: 'origin→destination flows', dataBranch: 'geo' },
  // sprint-120 m01 chord: native ECharts-6 series.type:'chord' ribbon diagram —
  // category↔category weighted flows (ribbon width = edge.value). Carries a NEW
  // dedicated 'chord' data branch (sankey-shaped: required source/target/value); the
  // IR reuses SankeyInput. Rendered via the headless chord adapter; self-contained
  // (no __registration), so the option is the primary payload like sankey.
  chord: { mark: 'MarkChord', label: 'Chord diagram', noun: 'category↔category weighted flows', dataBranch: 'chord' },
};

export function isEChartsPrimaryType(chartType: VizRenderInput['chartType']): chartType is EChartsPrimaryType {
  return (
    chartType === 'treemap' ||
    chartType === 'sunburst' ||
    chartType === 'sankey' ||
    chartType === 'force_graph' ||
    chartType === 'choropleth' ||
    chartType === 'bubble_map' ||
    chartType === 'flow_map' ||
    chartType === 'chord'
  );
}

// The Mark trait -> chartType inverse of ECHARTS_PRIMARY, DERIVED from the table (never
// hand-mirrored) so it can never drift from the render dispatch. Every `mark` above is
// distinct, so the inverse is a function.
const MARK_TRAIT_TO_TYPE: ReadonlyMap<string, EChartsPrimaryType> = new Map(
  (Object.entries(ECHARTS_PRIMARY) as Array<[EChartsPrimaryType, EChartsPrimaryConfig]>).map(
    ([chartType, config]) => [config.mark, chartType],
  ),
);

// IR-side classifier (sprint-136 m02): a NormalizedVizSpec carries no chartType,
// so artifact.certify classifies an ECharts-primary spec from its first mark's
// trait. With the matching `data` operand, certify re-emits these types and grades
// the 16 a11y-equivalence rules (failures → findings[], not-applicable →
// a11yNotApplicable[]) as part of the declared operand profile. Spec-only calls
// remain uncertified. The render-side a11y-equivalence gate remains Cartesian.
export function isEChartsPrimaryMarkTrait(trait: string): boolean {
  return MARK_TRAIT_TO_TYPE.has(trait);
}

/**
 * The chartType an IR mark trait renders as (s172 m01) — the seam that lets certify
 * drive the SAME adapters and the SAME `dataBranch` coupling viz.render dispatches on,
 * from an IR that carries no chartType. Returns undefined for a non-ECharts-primary trait.
 */
export function echartsPrimaryTypeForMarkTrait(trait: string): EChartsPrimaryType | undefined {
  return MARK_TRAIT_TO_TYPE.get(trait);
}
