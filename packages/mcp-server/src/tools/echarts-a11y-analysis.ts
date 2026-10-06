// The ECharts-primary a11y derivation, LIFTED out of viz.render.ts (sprint-174 m01).
//
// viz.render has derived structured a11y for the 8 ECharts-primary types since s128 (FD#10):
// route the data BRANCH through the analyzer its family uses, then run the shared table +
// narrative generators over the resulting VizDataAnalysis. s174 gives artifact.certify the
// same derivation — it needs the operand-built table and narrative to evaluate the 16-rule
// equivalence engine — initially warn-first, now graded under the declared operand
// profile — so the code is shared rather than transcribed.
//
// STANDING RULE B (s173, "when a private function is LIFTED to a shared module, compare the
// CALLERS' argument guarding, not just the function body"). The two callers' guarding,
// compared:
//
//   viz.render  — chartType is the AJV-validated tool input narrowed by isEChartsPrimaryType;
//                 branchData is the branch ECHARTS_PRIMARY[chartType].dataBranch names, already
//                 through that branch's validator and through the adapter emit (the a11y block
//                 runs AFTER the option was built, inside the same try/catch).
//   certify     — chartType/branchData come from resolveCertifyOperand, which resolves the
//                 branch from the SAME ECHARTS_PRIMARY table and reuses the render path's own
//                 validators; the a11y block runs AFTER evaluateEChartsDeterminism re-emitted
//                 the option successfully.
//
// So both callers hand this function a (chartType, branchData) pair that the type's branch
// validator accepted AND that an adapter emit already consumed. The one asymmetry is the
// failure channel: viz.render's outer try/catch converts a throw into a structured V126/V128/
// V129, while certify must never let an a11y fault turn a valid verdict into status:error —
// so certify wraps its call, exactly as it wraps the accuracy rules.

import {
  analyzeHierarchy,
  analyzeNetwork,
  analyzeSankey,
  analyzeSpatial,
  generateAccessibleTable,
  generateNarrativeSummary,
  type AccessibleTableResult,
  type HierarchyInput,
  type NarrativeResult,
  type NetworkInput,
  type NormalizedVizSpec,
  type SankeyInput,
  type SpatialFeatureRow,
  type VizDataAnalysis,
  type VizEquivalenceContext,
} from '@oods/viz-core';
import { ECHARTS_PRIMARY, type EChartsPrimaryType } from './echarts-primary.js';
import type { GeoBranch, GeoChartType } from './echarts-geo-option.js';

/**
 * Pick the input-shaped analyzer for the type's data branch: treemap/sunburst via
 * analyzeHierarchy, sankey/chord via analyzeSankey, force_graph via analyzeNetwork, the 3 geo
 * types via analyzeSpatial — routed through the SAME generators every type uses.
 */
export function analyzeEChartsPrimary(
  chartType: EChartsPrimaryType,
  branchData: unknown,
): { analysis: VizDataAnalysis; measureLabel?: string } {
  switch (chartType) {
    case 'treemap':
    case 'sunburst':
      return { analysis: analyzeHierarchy(branchData as HierarchyInput), measureLabel: 'Value' };
    case 'sankey':
    case 'chord':
      return { analysis: analyzeSankey(branchData as SankeyInput), measureLabel: 'Flow' };
    case 'force_graph':
      return { analysis: analyzeNetwork(branchData as NetworkInput), measureLabel: 'Connections' };
    default:
      return analyzeGeoForA11y(chartType, branchData as GeoBranch);
  }
}

/**
 * The full equivalence-evaluation context for an ECharts-primary (spec, data) pair.
 *
 * This is the SHARED derivation the two callers must not disagree about: viz.render projects
 * `table` + `narrative` onto its wire a11y shape, and certify hands the whole context to the
 * 16-rule engine. Because both go through here, certify's operand-built table/narrative are
 * the ones viz.render would have emitted for the same pair — proven by test, not asserted.
 */
export function buildEChartsA11yContext(
  spec: NormalizedVizSpec,
  chartType: EChartsPrimaryType,
  branchData: unknown,
): VizEquivalenceContext {
  const { analysis, measureLabel } = analyzeEChartsPrimary(chartType, branchData);
  const table = generateAccessibleTable({
    analysis,
    ...(spec.name ? { caption: `Data table for ${spec.name}` } : {}),
    id: spec.id,
  });
  const narrative = generateNarrativeSummary({
    analysis,
    chartLabel: spec.name ?? ECHARTS_PRIMARY[chartType].label,
    ...(measureLabel ? { measureLabel } : {}),
    fallbackSummary: spec.a11y.description,
  });
  return { spec, table, narrative, analysis };
}

export type { AccessibleTableResult, NarrativeResult };

// Geo a11y: the bound `rows` ARE the per-feature data (one row per region / point /
// flow); map them to the SpatialFeatureRow shape analyzeSpatial consumes, using the
// per-type metric as the measure and the join key (or a `name` field) as the label.
function analyzeGeoForA11y(
  chartType: GeoChartType,
  geo: GeoBranch,
): { analysis: VizDataAnalysis; measureLabel?: string } {
  const rows = (geo.rows ?? []) as Array<Record<string, unknown>>;
  const valueField =
    chartType === 'choropleth'
      ? geo.valueField
      : chartType === 'bubble_map'
        ? geo.sizeField ?? geo.colorField
        : geo.strengthField;
  const labelField = geo.join?.dataKey;
  const features: SpatialFeatureRow[] = rows.map((row, index) => {
    const label = (labelField ? row[labelField] : undefined) ?? row.name ?? `Feature ${index + 1}`;
    return { id: String(label), featureLabel: String(label), values: row };
  });
  return {
    analysis: analyzeSpatial({ features, ...(valueField ? { valueField } : {}) }),
    ...(valueField ? { measureLabel: valueField } : {}),
  };
}
