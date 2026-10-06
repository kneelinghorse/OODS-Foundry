// The 13 {spec}-only certify inputs behind the s172 §1g byte-compat control.
//
// ONE definition, shared by the baseline capture script and the assertion spec, so the
// fixture and the test can never drift onto different operands.
//
// The 5 cartesian cases come from the production builder. The 8 ECharts-primary cases
// reproduce the METADATA-ONLY IR viz.render actually emits for those types
// (buildEChartsPrimarySpec: data:{values:[]}, encoding:{}, one mark) — the shape s142
// proved certify must accept, not a cartesian IR with the trait swapped.

import type { NormalizedVizSpec } from '@oods/viz-core';

const ROWS = [
  { region: 'North', quarter: 'Q1', revenue: 100 },
  { region: 'South', quarter: 'Q1', revenue: 120 },
  { region: 'East', quarter: 'Q1', revenue: 90 },
];

const CARTESIAN: ReadonlyArray<{ trait: string; chartType: string }> = [
  { trait: 'MarkBar', chartType: 'bar' },
  { trait: 'MarkLine', chartType: 'line' },
  { trait: 'MarkArea', chartType: 'area' },
  { trait: 'MarkPoint', chartType: 'scatter' },
  { trait: 'MarkRect', chartType: 'heatmap' },
];

export const ECHARTS_MARK_TRAITS = [
  'MarkTreemap',
  'MarkSunburst',
  'MarkSankey',
  'MarkGraph',
  'MarkChord',
  'MarkChoropleth',
  'MarkBubble',
  'MarkFlow',
] as const;

export const CARTESIAN_MARK_TRAITS = CARTESIAN.map((c) => c.trait);

/** The metadata-only IR viz.render emits for an ECharts-primary type. */
export function echartsPrimaryIr(trait: string, chartType: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: `viz:${chartType}`,
    data: { values: [] },
    marks: [{ trait }],
    encoding: {},
    a11y: { description: `${chartType} of test data.` },
  } as unknown as NormalizedVizSpec;
}

type BuildVizSpecFromRows = (input: {
  rows: Array<Record<string, unknown>>;
  chartType: string;
  encodings: unknown;
}) => { spec: NormalizedVizSpec };

/** trait -> the {spec}-only certify input. Keyed by trait so the fixture is readable. */
export function SPEC_ONLY_CASES(
  buildVizSpecFromRows: unknown,
): Record<string, NormalizedVizSpec> {
  const build = buildVizSpecFromRows as BuildVizSpecFromRows;
  const cases: Record<string, NormalizedVizSpec> = {};
  for (const { trait, chartType } of CARTESIAN) {
    cases[trait] = build({
      rows: ROWS,
      chartType,
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } },
    }).spec;
  }
  const ECHARTS_CHART_TYPES: Record<string, string> = {
    MarkTreemap: 'treemap',
    MarkSunburst: 'sunburst',
    MarkSankey: 'sankey',
    MarkGraph: 'force_graph',
    MarkChord: 'chord',
    MarkChoropleth: 'choropleth',
    MarkBubble: 'bubble_map',
    MarkFlow: 'flow_map',
  };
  for (const trait of ECHARTS_MARK_TRAITS) {
    cases[trait] = echartsPrimaryIr(trait, ECHARTS_CHART_TYPES[trait]);
  }
  return cases;
}
