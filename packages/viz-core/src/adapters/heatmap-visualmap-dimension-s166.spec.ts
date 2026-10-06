// s166 m01 (FF#23, Forge-Demos intel_alert 6b595d87): a dataset-backed MarkRect heatmap
// with TRAILING non-measure fields emitted a dimensionless visualMap; ECharts binds a
// dimensionless continuous visualMap to the LAST dataset dimension (here a string), so
// every cell painted fill:none while option-level emission probes stayed green — all
// pre-s166 fixtures put the measure LAST, which is why the suite never caught it.
// Fix: buildHeatmapVisualMap emits `dimension: colorBinding.field` (the field-NAME form,
// not an index — spec.datasets-linked series' dims can diverge from spec.data.values, so
// a positional index is mis-pointable while a name resolves per-dataset), only when
// drawn cells exist (the empty-data path has no row to read and falls to fallbackDomain).
//
// The PAINT probe renders through echarts@6 SSR (renderToSVGString) and asserts on the
// drawn geometry itself — the ECharts twin of the Vega assertDrewMarks pattern
// (mcp-server viz.render.fidelity.test.ts): "renderable" must mean "the data painted",
// not "the option looked right". ECharts SSR tags every series-drawn element with
// ecmeta_ssr_type="chart", one per datum.
import { describe, expect, it } from 'vitest';
import * as echarts from 'echarts';
import { toEChartsOption } from './echarts-adapter.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

// The Demo 04 Hero 2 shape: measure NOT last — 'segment' (a string) is the final
// dataset dimension, exactly where a dimensionless visualMap binds.
const TRAILING_ROWS = [
  { region: 'North', quarter: 'Q1', revenue: 120, segment: 'retail' },
  { region: 'South', quarter: 'Q1', revenue: 200, segment: 'retail' },
  { region: 'North', quarter: 'Q2', revenue: 150, segment: 'online' },
  { region: 'South', quarter: 'Q2', revenue: 220, segment: 'online' },
];

// Identical grid, measure LAST — the accidentally-green shape every pre-s166 fixture used.
const MEASURE_LAST_ROWS = TRAILING_ROWS.map(({ region, quarter, segment, revenue }) => ({
  region,
  quarter,
  segment,
  revenue,
}));

function heatmapSpec(rows: readonly Record<string, unknown>[]): NormalizedVizSpec {
  const color = { field: 'revenue', trait: 'EncodingColor', type: 'quantitative' as const, title: 'Revenue' };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'ff23',
    name: 'Revenue Heatmap',
    data: { name: 'grid', values: rows },
    marks: [
      {
        trait: 'MarkRect',
        encodings: {
          x: { field: 'region', trait: 'EncodingX', scale: 'band' },
          y: { field: 'quarter', trait: 'EncodingY', scale: 'band' },
          color: { ...color },
        },
      },
    ],
    encoding: {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { field: 'quarter', trait: 'EncodingY', scale: 'band' },
      color: { ...color },
    },
    a11y: { description: 'Revenue by region and quarter.' },
  } as unknown as NormalizedVizSpec;
}

function divergingSpec(rows: readonly Record<string, unknown>[]): NormalizedVizSpec {
  const color = { field: 'corr', trait: 'EncodingColor', scale: 'diverging' as const, title: 'Correlation' };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'ff23-div',
    name: 'Correlation matrix',
    data: { name: 'm', values: rows },
    marks: [
      {
        trait: 'MarkRect',
        encodings: {
          x: { field: 'region', trait: 'EncodingX', scale: 'band' },
          y: { field: 'factor', trait: 'EncodingY', scale: 'band' },
          color: { ...color },
        },
      },
    ],
    encoding: {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { field: 'factor', trait: 'EncodingY', scale: 'band' },
      color: { ...color },
    },
    a11y: { description: 'Correlation matrix with a diverging color scale.' },
  } as unknown as NormalizedVizSpec;
}

interface VisualMapLike {
  readonly dimension?: unknown;
  readonly min?: number;
  readonly max?: number;
}

function optionVisualMap(spec: NormalizedVizSpec): VisualMapLike | undefined {
  return (toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike }).visualMap;
}

// Render the option through the echarts SSR SVG pipeline and return the fill of every
// series-drawn (ecmeta_ssr_type="chart") geometry element — one per drawn cell.
function drawnCellFills(spec: NormalizedVizSpec): string[] {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 400, height: 300 });
  try {
    chart.setOption(toEChartsOption(spec) as Record<string, unknown>);
    const svg = chart.renderToSVGString();
    return [...svg.matchAll(/<(?:path|rect)[^>]*ecmeta_ssr_type="chart"[^>]*>/g)].map(
      (match) => match[0].match(/fill="([^"]*)"/)?.[1] ?? ''
    );
  } finally {
    chart.dispose();
  }
}

describe('echarts-adapter — s166 m01 heatmap visualMap.dimension (FF#23)', () => {
  it('emits dimension as the color FIELD NAME on a trailing-field heatmap (fails at HEAD: undefined)', () => {
    const visualMap = optionVisualMap(heatmapSpec(TRAILING_ROWS));
    expect(visualMap).toBeDefined();
    // NAME form, not an index — linked-dataset dims can diverge from spec.data.values.
    expect(visualMap?.dimension).toBe('revenue');
  });

  it('emits the same name-form dimension on the diverging branch (fails at HEAD: undefined)', () => {
    const rows = [
      { region: 'A', factor: 'x', corr: -0.32, tag: 'seed' },
      { region: 'A', factor: 'y', corr: 0.5, tag: 'seed' },
      { region: 'B', factor: 'x', corr: 1, tag: 'seed' },
    ];
    const visualMap = optionVisualMap(divergingSpec(rows));
    expect(visualMap?.dimension).toBe('corr');
    // Keep-green: the s157 symmetrized center is untouched by the dimension emission.
    expect(visualMap?.min).toBe(-1);
    expect(visualMap?.max).toBe(1);
  });

  it('OMITS dimension when no drawn cell exists (empty-data fallbackDomain path unchanged)', () => {
    const visualMap = optionVisualMap(divergingSpec([]));
    // The diverging gate fires with no rows: visualMap still emits (fallback domain),
    // but there is no dataset row for a name to resolve against — no dimension.
    expect(visualMap).toBeDefined();
    expect(visualMap?.dimension).toBeUndefined();
  });

  it('emits dimension on the aggregated-cell path (behavior-neutral hardening: aggregated cells put the measure last)', () => {
    const rows = [
      { region: 'N', hour: '9', temp: 88 },
      { region: 'N', hour: '9', temp: 100 },
      { region: 'S', hour: '9', temp: 412 },
      { region: 'S', hour: '9', temp: 500 },
    ];
    const color = { field: 'temp', trait: 'EncodingColor', scale: 'linear' as const, aggregate: 'sum' as const };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'agg-heat',
      name: 'Aggregated heatmap',
      data: { name: 'g', values: rows },
      marks: [
        {
          trait: 'MarkRect',
          encodings: {
            x: { field: 'region', trait: 'EncodingX', scale: 'band' },
            y: { field: 'hour', trait: 'EncodingY', scale: 'band' },
            color: { ...color },
          },
        },
      ],
      encoding: {
        x: { field: 'region', trait: 'EncodingX', scale: 'band' },
        y: { field: 'hour', trait: 'EncodingY', scale: 'band' },
        color: { ...color },
      },
      a11y: { description: 'temp by region and hour' },
    } as unknown as NormalizedVizSpec;
    const visualMap = optionVisualMap(spec);
    expect(visualMap?.dimension).toBe('temp');
    // Keep-green: the s159 aggregated extent is untouched.
    expect(visualMap?.min).toBe(188);
    expect(visualMap?.max).toBe(912);
  });
});

describe('echarts-adapter — s166 m01 SSR paint probe (drawn cells carry real fills)', () => {
  it('paints every trailing-field heatmap cell with a resolved non-none fill (fails at HEAD: all fill:none)', () => {
    const fills = drawnCellFills(heatmapSpec(TRAILING_ROWS));
    // The grid draws one geometry per cell — a degenerate render would have none.
    expect(fills).toHaveLength(TRAILING_ROWS.length);
    for (const fill of fills) {
      expect(fill).not.toBe('none');
      // Resolved for the headless canvas (rgb/hex), never a raw var(--token).
      expect(/^(#|rgb)/.test(fill)).toBe(true);
    }
  });

  it('keep-green: the measure-last control paints every cell before AND after the fix', () => {
    const fills = drawnCellFills(heatmapSpec(MEASURE_LAST_ROWS));
    expect(fills).toHaveLength(MEASURE_LAST_ROWS.length);
    for (const fill of fills) {
      expect(fill).not.toBe('none');
      expect(/^(#|rgb)/.test(fill)).toBe(true);
    }
  });

  it('paints the diverging trailing-field matrix (covers the :462 diverging branch at paint level)', () => {
    const rows = [
      { region: 'A', factor: 'x', corr: -0.32, tag: 'seed' },
      { region: 'A', factor: 'y', corr: 0.5, tag: 'seed' },
      { region: 'B', factor: 'x', corr: 1, tag: 'seed' },
    ];
    const fills = drawnCellFills(divergingSpec(rows));
    expect(fills).toHaveLength(rows.length);
    for (const fill of fills) {
      expect(fill).not.toBe('none');
      expect(/^(#|rgb)/.test(fill)).toBe(true);
    }
  });
});
