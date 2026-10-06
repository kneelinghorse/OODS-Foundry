import { describe, expect, it } from 'vitest';
import * as echarts from 'echarts';
import { toEChartsOption } from './echarts-adapter.js';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { analyzeVizSpec } from '../a11y/data-analysis.js';
import { resolveOodsEchartsChrome } from '../tokens/oods-echarts-chrome.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

// Item #16 (sprint-151 m03): a layered mark's `from` must resolve against the new
// top-level `datasets` slot. Before m03 the ECharts adapter emitted `dataset: [dataset]`
// (the single primary) while a `from`-referenced series already carried
// `datasetId = mark.from` (echarts-adapter.ts:291) — a DANGLING reference (the id named
// no registered dataset). m03 builds the dataset ARRAY so `datasetId` resolves.
//
// Imports the SOURCE adapter directly (relative, not the @oods/viz-core barrel) so a src
// regression fails HERE at the viz-core unit level — mirrors the s143 m03 discipline that
// keeps the vega-lite-adapter palette-bake guard from being silently removed.

// Median rows are intentionally keyed in a DIFFERENT order than the mark's encoding
// channels (site before median, i.e. y-field first) so the field-name-binding assertion
// below proves ECharts binds by dimension NAME via `encode`, never by column position.
const MEDIAN_ROWS = [
  { site: 'Gov A', median: 80 },
  { site: 'Gov B', median: 80 },
];

const LADDER_ROWS = [
  { site: 'Site A', score: 92 },
  { site: 'Site B', score: 74 },
];

function ladderSpec(withDatasets: boolean): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'ladder',
    name: 'Accessibility Ladder',
    data: { name: 'ladder', values: LADDER_ROWS },
    marks: [
      // primary bar layer — INLINE, no `from`; resolves against the primary dataset
      {
        trait: 'MarkBar',
        encodings: {
          x: { field: 'site', trait: 'EncodingX' },
          y: { field: 'score', trait: 'EncodingY' },
        },
      },
      // secondary rule/line layer — resolves against datasets['gov_median']
      {
        trait: 'MarkLine',
        from: withDatasets ? 'gov_median' : undefined,
        encodings: {
          x: { field: 'median', trait: 'EncodingX' },
          y: { field: 'site', trait: 'EncodingY' },
        },
      },
    ],
    encoding: {
      x: { field: 'site', trait: 'EncodingX' },
      y: { field: 'score', trait: 'EncodingY' },
    },
    a11y: { description: 'Accessibility ladder with a government-median rule overlay.' },
    ...(withDatasets ? { datasets: { gov_median: MEDIAN_ROWS } } : {}),
  } as NormalizedVizSpec;
}

interface EChartsDatasetLike {
  readonly id: string;
  readonly source?: readonly Record<string, unknown>[];
  readonly dimensions?: readonly string[];
}
interface EChartsSeriesLike {
  readonly type: string;
  readonly datasetId?: string;
  readonly encode?: { x?: string; y?: string };
}

describe('echarts-adapter — item #16 datasets slot resolves Mark.from', () => {
  it('builds a multi-dataset array so a from-referenced series datasetId resolves (fails at HEAD: single dataset)', () => {
    const option = toEChartsOption(ladderSpec(true)) as unknown as {
      dataset: readonly EChartsDatasetLike[];
      series: readonly EChartsSeriesLike[];
    };

    // The dataset array now carries the primary PLUS every spec.datasets entry.
    expect(option.dataset.length).toBe(2);
    expect(option.dataset[0]?.id).toBe('ladder');
    const govDataset = option.dataset.find((d) => d.id === 'gov_median');
    expect(govDataset).toBeDefined();
    expect(govDataset?.source).toEqual(MEDIAN_ROWS);

    // The secondary series' datasetId (mark.from) now names a REGISTERED dataset.
    const lineSeries = option.series.find((s) => s.type === 'line');
    expect(lineSeries?.datasetId).toBe('gov_median');
  });

  it('binds a from-referenced series by field NAME, not column order (dimensions preserve names + encode references names)', () => {
    const option = toEChartsOption(ladderSpec(true)) as unknown as {
      dataset: readonly EChartsDatasetLike[];
      series: readonly EChartsSeriesLike[];
    };

    const govDataset = option.dataset.find((d) => d.id === 'gov_median');
    // dimensions come from the row keys (site-first here) — the point is that BOTH names
    // are present so ECharts can resolve `encode` by name irrespective of column order.
    expect(govDataset?.dimensions).toEqual(['site', 'median']);

    const lineSeries = option.series.find((s) => s.type === 'line');
    // encode references the mark's OWN encoding field NAMES (x:'median', y:'site'), so a
    // row keyed {site, median} still binds median→x and site→y — never positionally.
    expect(lineSeries?.encode?.x).toBe('median');
    expect(lineSeries?.encode?.y).toBe('site');
  });

  it('primary (inline) series is byte-UNCHANGED by the datasets slot (mixed-spec contract)', () => {
    const withDs = toEChartsOption(ladderSpec(true)) as unknown as { series: readonly EChartsSeriesLike[] };
    const noDs = toEChartsOption(ladderSpec(false)) as unknown as { series: readonly EChartsSeriesLike[] };

    const primaryWith = withDs.series.find((s) => s.type === 'bar');
    const primaryNo = noDs.series.find((s) => s.type === 'bar');
    // The primary bar resolves against the primary dataset id ('ladder') in BOTH — adding
    // datasets to the spec must not move the inline primary's data path.
    expect(primaryWith?.datasetId).toBe('ladder');
    expect(primaryWith).toEqual(primaryNo);
  });

  it('OMITS the extra datasets when spec.datasets is absent → byte-identical single-dataset array (gate-leak guard)', () => {
    const option = toEChartsOption(ladderSpec(false)) as unknown as { dataset: readonly EChartsDatasetLike[] };
    // No spec.datasets → the dataset array is exactly the single primary, as before #16.
    expect(option.dataset.length).toBe(1);
    expect(option.dataset[0]?.id).toBe('ladder');
  });
});

// s156-m02 (NASA #1): an explicit `scale:'log'` must win over a co-declared
// `type:'quantitative'` so the ECharts axis is not silently rendered linear while
// Vega honors the log scale (the dual-output disagreement trap). inferAxisType
// consulted `binding.type` FIRST and returned 'value' for quantitative BEFORE the
// `scale === 'log'` branch could run — unreachable whenever a type was present.
// The silent loss fires ONLY when the caller co-declares BOTH type AND scale:'log'
// (a scale-only log spec already renders correctly). RED at HEAD 7ef5f96.
const LOG_ROWS = [
  { revenue: 1, users: 10 },
  { revenue: 2, users: 1000 },
];

function logAxisSpec(): NormalizedVizSpec {
  const yBinding = {
    field: 'users',
    trait: 'EncodingY',
    // The redundant-but-valid explicit spec: field type AND a log scale together.
    type: 'quantitative' as const,
    scale: 'log' as const,
  };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'log-axis',
    name: 'Log Axis Scatter',
    data: { name: 'points', values: LOG_ROWS },
    marks: [
      {
        trait: 'MarkPoint',
        encodings: {
          x: { field: 'revenue', trait: 'EncodingX' },
          y: { ...yBinding },
        },
      },
    ],
    encoding: {
      x: { field: 'revenue', trait: 'EncodingX' },
      y: { ...yBinding },
    },
    a11y: { description: 'Scatter with an explicit log y-axis.' },
  } as NormalizedVizSpec;
}

interface EChartsAxisLike {
  readonly type?: string;
}

describe('echarts-adapter — item s156-m02 explicit log scale wins over quantitative type', () => {
  it('emits a log y-axis when the binding co-declares type:quantitative AND scale:log (fails at HEAD: value)', () => {
    const option = toEChartsOption(logAxisSpec()) as unknown as {
      yAxis: EChartsAxisLike | readonly EChartsAxisLike[];
    };
    const yAxis = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis;
    // Before m02, the quantitative short-circuit returned 'value' and the log axis
    // was silently lost — this asserted 'value', diverging from Vega.
    expect((yAxis as EChartsAxisLike)?.type).toBe('log');
  });

  it('matches Vega parity — the same spec compiles to encoding.y.scale.type:log in Vega', () => {
    const compiled = toVegaLiteSpec(logAxisSpec()) as unknown as {
      encoding?: { y?: { scale?: { type?: string } } };
    };
    // Vega already emitted scale.type:'log' at HEAD (orthogonal to field type); the
    // parity assertion pins that the two adapters now AGREE on the log axis.
    expect(compiled.encoding?.y?.scale?.type).toBe('log');
  });
});

// s156-m04 (NASA #4 / FD#18): a cartesian MarkRect heatmap whose color is a quantitative
// measure must emit an ECharts `visualMap` so the continuous color legend renders (Vega
// auto-legends; ECharts had NO visualMap key → the ECharts-only gap). Reuses the a11y
// measure predicates (isMarkRectGrid + heatmapColorIsMeasure) and the SHARED spatial
// visualmap generator; the tick label is themed onto chrome exactly like the geo path
// (visualMap.textStyle.color = chrome.visualMapLabel). RED at HEAD: option.visualMap absent.
const HEATMAP_ROWS = [
  { region: 'North', quarter: 'Q1', revenue: 120 },
  { region: 'South', quarter: 'Q1', revenue: 200 },
  { region: 'North', quarter: 'Q2', revenue: 150 },
  { region: 'South', quarter: 'Q2', revenue: 220 },
];

function heatmapMeasureSpec(): NormalizedVizSpec {
  const color = { field: 'revenue', trait: 'EncodingColor', type: 'quantitative' as const, title: 'Revenue' };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'heatmap',
    name: 'Revenue Heatmap',
    data: { name: 'grid', values: HEATMAP_ROWS },
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
  } as NormalizedVizSpec;
}

interface VisualMapLike {
  readonly type?: string;
  readonly min?: number;
  readonly max?: number;
  readonly inRange?: { color?: readonly string[] };
  readonly textStyle?: { color?: string };
}

describe('echarts-adapter — item s156-m04 cartesian heatmap emits a continuous visualMap', () => {
  it('emits a continuous visualMap for a MarkRect measure heatmap (fails at HEAD: no visualMap)', () => {
    const option = toEChartsOption(heatmapMeasureSpec()) as unknown as { visualMap?: VisualMapLike };
    expect(option.visualMap).toBeDefined();
    expect(option.visualMap?.type).toBe('continuous');
    // Domain is the color field's numeric extent across the rows.
    expect(option.visualMap?.min).toBe(120);
    expect(option.visualMap?.max).toBe(220);
  });

  it('bakes the OODS sequential range (resolved colors) as inRange.color', () => {
    const option = toEChartsOption(heatmapMeasureSpec()) as unknown as { visualMap?: VisualMapLike };
    const colors = option.visualMap?.inRange?.color;
    expect(Array.isArray(colors)).toBe(true);
    expect((colors ?? []).length).toBeGreaterThan(2);
    // Colors are RESOLVED for the headless canvas (rgb/hex), never raw `var(--token)`.
    for (const color of colors ?? []) {
      expect(color.startsWith('var(')).toBe(false);
      expect(/^(#|rgb)/.test(color)).toBe(true);
    }
  });

  it('bakes the visualMap tick label onto chrome (textStyle.color = chrome.visualMapLabel)', () => {
    const spec = heatmapMeasureSpec();
    const option = toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike };
    const chrome = resolveOodsEchartsChrome(spec);
    expect(option.visualMap?.textStyle?.color).toBe(chrome.visualMapLabel);
  });

  it('OMITS the visualMap for a non-heatmap (bar) spec — gate-leak guard', () => {
    const option = toEChartsOption(logAxisSpec()) as unknown as { visualMap?: VisualMapLike };
    expect(option.visualMap).toBeUndefined();
  });

  // s157 m03 (B2): a DIVERGING cartesian heatmap centers its visualMap at data 0 (symmetric
  // [-M,+M] domain) == Vega's baked color.scale.domainMid:0 — not the asymmetric-midpoint 0.34.
  it('centers a diverging heatmap visualMap at 0 (symmetric domain == Vega domainMid)', () => {
    const color = { field: 'corr', trait: 'EncodingColor', type: 'quantitative' as const, scale: 'diverging' as const, title: 'Correlation' };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'corr',
      name: 'Correlation matrix',
      data: {
        name: 'm',
        values: [
          { region: 'A', factor: 'x', corr: -0.32 },
          { region: 'A', factor: 'y', corr: 0.5 },
          { region: 'B', factor: 'x', corr: 1 },
        ],
      },
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

    const option = toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike };
    expect(option.visualMap?.type).toBe('continuous');
    // M = max(|-0.32|, |1|) = 1 → [-1, 1], center 0.
    expect(option.visualMap?.min).toBe(-1);
    expect(option.visualMap?.max).toBe(1);
    expect((option.visualMap!.min! + option.visualMap!.max!) / 2).toBe(0);
  });
});

// s159 m5 — ECharts aggregate dual-output honesty (SSOT memo §1.5/§2-m5). A MarkRect heatmap whose
// color declares an aggregate draws ONE aggregated value per (x,y) cell, but the ECharts dataset used
// the RAW rows and buildHeatmapVisualMap took the RAW color extent → the visualMap legend (raw min
// 88/max 500) disagreed with the aggregated a11y narrative (188/912). Fix: aggregate the dataset +
// visualMap per cell (shared reduceAggregate) so render == narrative == certify.
describe('echarts-adapter — s159 m5 aggregated heatmap dual-output parity', () => {
  function aggregateHeatmapSpec(): NormalizedVizSpec {
    // multi-row-per-cell: N/9 = 88+100 = 188, S/9 = 412+500 = 912. Raw extent 88..500 ≠ cells 188..912.
    const rows = [
      { region: 'N', hour: '9', temp: 88 },
      { region: 'N', hour: '9', temp: 100 },
      { region: 'S', hour: '9', temp: 412 },
      { region: 'S', hour: '9', temp: 500 },
    ];
    const color = { field: 'temp', trait: 'EncodingColor', scale: 'linear' as const, aggregate: 'sum' as const };
    return {
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
  }

  it('visualMap extent + dataset == AGGREGATED cells == narrative (not the raw color extent)', () => {
    const spec = aggregateHeatmapSpec();
    const option = toEChartsOption(spec) as unknown as {
      visualMap?: VisualMapLike;
      dataset: readonly { source?: readonly Record<string, unknown>[] }[];
    };
    // visualMap extent is the AGGREGATED cell range, not the raw color extent (88..500).
    expect(option.visualMap?.min).toBe(188);
    expect(option.visualMap?.max).toBe(912);
    // the DRAWN dataset is one row per (region,hour) cell carrying the reduced measure.
    const source = option.dataset[0]?.source ?? [];
    expect(source).toHaveLength(2);
    expect(source.map((r) => r.temp).sort((a, b) => Number(a) - Number(b))).toEqual([188, 912]);
    // cross-renderer parity: the a11y narrative already aggregates to the SAME extent.
    const analysis = analyzeVizSpec(spec);
    expect(analysis.max?.value).toBe(912);
    expect(analysis.min?.value).toBe(188);
    // ...and the Vega path aggregates VISUALLY (color.aggregate → Vega-Lite reduces per cell at render),
    // so all three surfaces (ECharts extent, Vega render, narrative) now agree.
    const vl = toVegaLiteSpec(spec) as unknown as { encoding?: { color?: { aggregate?: string } } };
    expect(vl.encoding?.color?.aggregate).toBe('sum');
  });

  it('a single-row-per-cell heatmap (no multi-row) is byte-unchanged (extent == the cell values)', () => {
    // one row per cell → aggregation is identity; the extent equals the raw == aggregated values.
    const rows = [
      { region: 'N', hour: '9', temp: 10 },
      { region: 'S', hour: '9', temp: 90 },
    ];
    const color = { field: 'temp', trait: 'EncodingColor', scale: 'linear' as const, aggregate: 'sum' as const };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'single',
      name: 'single-cell heatmap',
      data: { name: 's', values: rows },
      marks: [{ trait: 'MarkRect', encodings: { x: { field: 'region', trait: 'EncodingX', scale: 'band' }, y: { field: 'hour', trait: 'EncodingY', scale: 'band' }, color: { ...color } } }],
      encoding: { x: { field: 'region', trait: 'EncodingX', scale: 'band' }, y: { field: 'hour', trait: 'EncodingY', scale: 'band' }, color: { ...color } },
      a11y: { description: 'temp' },
    } as unknown as NormalizedVizSpec;
    const option = toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike };
    expect(option.visualMap?.min).toBe(10);
    expect(option.visualMap?.max).toBe(90);
  });
});

// ============================================================================
// Sprint-160 m2 — the drawn-cell key spine (SSOT memo §2-m2, Fork-2 = FULL SPINE). s159-m5's
// aggregateMarkRectCells hand-built its key as [x,y], so a FACETED aggregated heatmap pooled cells
// ACROSS panels while every per-panel dataset filtered to EMPTY (the filter names a field the
// aggregated cells no longer carried), and a detail grouping collapsed (visualMap 40/40 vs narrated
// 30/10). The cells now key AND CARRY x,y ∪ facetFields ∪ series groupings (measure-excluded) via
// the ONE shared drawnCellKeyFields derivation the projection and the guard consume.
// ============================================================================
describe('echarts-adapter — s160 m2 faceted/detail aggregated heatmap honesty', () => {
  type DatasetLike = {
    id?: string;
    fromDatasetId?: string;
    source?: readonly Record<string, unknown>[];
    transform?: readonly { type: string; config: { field: string; operator: string; value: unknown } }[];
  };

  function bandEnc(field: string, axis: 'X' | 'Y') {
    return { field, trait: `Encoding${axis}`, scale: 'band' as const };
  }

  function heatmapSpec(opts: {
    rows: Record<string, unknown>[];
    detailField?: string;
    facetColumnField?: string;
  }): NormalizedVizSpec {
    const color = { field: 'temp', trait: 'EncodingColor', scale: 'linear' as const, aggregate: 'sum' as const };
    const encoding: Record<string, unknown> = {
      x: bandEnc('region', 'X'),
      y: bandEnc('hour', 'Y'),
      color: { ...color },
    };
    if (opts.detailField) {
      encoding.detail = { field: opts.detailField, trait: 'EncodingDetail' };
    }
    return {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'spine-heat',
      name: 'spine heatmap',
      data: { name: 'sh', values: opts.rows },
      marks: [{ trait: 'MarkRect', encodings: { ...encoding } }],
      encoding,
      ...(opts.facetColumnField
        ? { layout: { trait: 'LayoutFacet', columns: { field: opts.facetColumnField } } }
        : {}),
      a11y: { description: 'temp by region and hour' },
    } as unknown as NormalizedVizSpec;
  }

  it('FACETED aggregated heatmap: cells stay per-panel, carry the facet field, and panel filters match', () => {
    const spec = heatmapSpec({
      rows: [
        { site: 'A', region: 'N', hour: '9', temp: 10 },
        { site: 'B', region: 'N', hour: '9', temp: 30 },
        { site: 'A', region: 'S', hour: '9', temp: 54 },
        { site: 'B', region: 'S', hour: '9', temp: 94 },
      ],
      facetColumnField: 'site',
    });
    const option = toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike; dataset: DatasetLike[] };
    const source = option.dataset[0]?.source ?? [];
    // Per-(panel × x,y) cells — NOT pooled across panels (HEAD pools to [{40},{148}] without `site`).
    expect(source).toHaveLength(4);
    expect(source.every((r) => 'site' in r)).toBe(true);
    expect(source.map((r) => r.temp).sort((a, b) => Number(a) - Number(b))).toEqual([10, 30, 54, 94]);
    // visualMap extent == per-panel drawn cells == the s159 facet-aware narrative.
    expect(option.visualMap?.min).toBe(10);
    expect(option.visualMap?.max).toBe(94);
    const analysis = analyzeVizSpec(spec);
    expect(analysis.min?.value).toBe(10);
    expect(analysis.max?.value).toBe(94);
    expect(analysis.total).toBe(188);
    // Every derived panel dataset's filter matches a NON-EMPTY subset of the base source.
    const derived = option.dataset.filter((d) => d.fromDatasetId !== undefined);
    expect(derived.length).toBeGreaterThanOrEqual(2);
    for (const panel of derived) {
      const filters = panel.transform ?? [];
      expect(filters.length).toBeGreaterThan(0);
      const matches = source.filter((row) =>
        filters.every((t) => row[t.config.field] === t.config.value),
      );
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it('DETAIL-grouped aggregated heatmap: per-group cells survive (visualMap == narrative, not 40/40)', () => {
    const spec = heatmapSpec({
      rows: [
        { region: 'N', hour: '9', line: 'd1', temp: 30 },
        { region: 'N', hour: '9', line: 'd2', temp: 10 },
      ],
      detailField: 'line',
    });
    const option = toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike; dataset: DatasetLike[] };
    const source = option.dataset[0]?.source ?? [];
    expect(source).toHaveLength(2);
    expect(source.every((r) => 'line' in r)).toBe(true);
    expect(option.visualMap?.min).toBe(10);
    expect(option.visualMap?.max).toBe(30);
    const analysis = analyzeVizSpec(spec);
    expect(analysis.min?.value).toBe(10);
    expect(analysis.max?.value).toBe(30);
  });

  it('multi-row-per-(x,y,detail) discriminator: cells re-reduce PER GROUP (the fail-safe posture stays dishonest here — full spine does not)', () => {
    const spec = heatmapSpec({
      rows: [
        { region: 'N', hour: '9', line: 'd1', temp: 20 },
        { region: 'N', hour: '9', line: 'd1', temp: 10 },
        { region: 'N', hour: '9', line: 'd2', temp: 10 },
      ],
      detailField: 'line',
    });
    const option = toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike; dataset: DatasetLike[] };
    const source = option.dataset[0]?.source ?? [];
    expect(source.map((r) => r.temp).sort((a, b) => Number(a) - Number(b))).toEqual([10, 30]);
    expect(option.visualMap?.min).toBe(10);
    expect(option.visualMap?.max).toBe(30);
  });

  it('LOCK: a plain (no facet/detail/size) aggregated heatmap emits cells with EXACTLY the [x,y,measure] shape', () => {
    const spec = heatmapSpec({
      rows: [
        { region: 'N', hour: '9', temp: 88 },
        { region: 'N', hour: '9', temp: 100 },
        { region: 'S', hour: '9', temp: 412 },
      ],
    });
    const option = toEChartsOption(spec) as unknown as { dataset: DatasetLike[] };
    const source = option.dataset[0]?.source ?? [];
    expect(source.length).toBeGreaterThan(0);
    for (const row of source) {
      expect(Object.keys(row).sort()).toEqual(['hour', 'region', 'temp']);
    }
  });
});


describe('s199 ranged areas and bars preserve both bounds', () => {
  for (const trait of ['MarkArea', 'MarkBar']) {
    for (const axis of ['x', 'y'] as const) {
      it(`${trait} ${axis}2 stacks a difference above negative lower bounds in every facet`, () => {
        const other = axis === 'x' ? 'y' : 'x';
        const rows = [{ category: 'A', panel: 'one', lower: -5, upper: 3 }, { category: 'B', panel: 'two', lower: -8, upper: -2 }];
        const spec = {
          $schema: 'https://oods-foundry.com/viz-spec/v1', id: 'negative-band',
          data: { values: rows }, encoding: {
            [other]: { field: 'category', trait: 'EncodingX', type: 'nominal' },
            [axis]: { field: 'lower', trait: 'EncodingY', type: 'quantitative' },
            // No binding.channel: the encoding KEY is the source of truth.
            [`${axis}2`]: { field: 'upper', trait: 'EncodingY', type: 'quantitative' },
          }, marks: [{ trait }], layout: { trait: 'LayoutFacet', columns: { field: 'panel' } },
          a11y: { description: 'Intervals crossing zero and wholly below it.' },
        } as NormalizedVizSpec;
        const option = toEChartsOption(spec);
        expect(option.series).toHaveLength(4);
        const source = option.dataset[0].source!;
        for (let panel = 0; panel < 2; panel++) {
          const [base, range] = option.series.slice(panel * 2, panel * 2 + 2);
          expect(base).toMatchObject({ stackStrategy: 'all', silent: true, itemStyle: { color: 'transparent' } });
          expect(range.stack).toBe(base.stack);
          expect(range.stackStrategy).toBe('all');
          expect(range.datasetId).toBe(base.datasetId);
          expect(base.encode[axis]).toBe('lower');
          expect(range.encode.tooltip).toEqual(expect.arrayContaining(['lower', 'upper']));
          expect(range.encode.tooltip).not.toContain(range.encode[axis]);
          expect(source.map((row) => row[range.encode[axis] as string])).toEqual([8, 6]);
          expect(source.map((row) => Number(row[base.encode[axis] as string]) + Number(row[range.encode[axis] as string]))).toEqual([3, -2]);
          expect(option.dataset[panel + 1].transform?.[0].config).toHaveProperty('dimension', 'panel');
        }
        const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 600, height: 400 });
        try {
          chart.setOption({ ...option, animation: false } as echarts.EChartsOption);
          const models = (chart as any).getModel().getSeries();
          expect(models.map((model: any) => model.getData().count())).toEqual([1, 1, 1, 1]);
          // ECharts' actual stack calculation must reach the authored second bound,
          // including an opposite-sign difference. Merely storing fields is insufficient.
          for (const [index, upper] of [[1, 3], [3, -2]]) {
            const data = models[index].getData();
            expect(data.get(data.getCalculationInfo('stackResultDimension'), 0)).toBe(upper);
          }
        } finally { chart.dispose(); }
        expect(rows[0]).toEqual({ category: 'A', panel: 'one', lower: -5, upper: 3 });
      });
    }
  }
});


it('s199 band fields cannot overwrite authored or linked dataset columns', () => {
  const spec = ladderSpec(true);
  spec.datasets = { intervals: [{ site: 'A', lower: -4, upper: 2, __oods_band_0: 'authored' }] };
  spec.marks = [{ trait: 'MarkBar', from: 'intervals', encodings: {
    x: { field: 'site', trait: 'EncodingX' }, y: { field: 'lower', trait: 'EncodingY' }, y2: { field: 'upper', trait: 'EncodingY' },
  } }];
  const option = toEChartsOption(spec);
  const [base, range] = option.series;
  const linked = option.dataset.find(dataset => dataset.id === 'intervals')!;
  expect(base.datasetId).toBe('intervals');
  expect(linked.source?.[0].__oods_band_0).toBe('authored');
  expect(range.encode.y).not.toBe('__oods_band_0');
  expect(linked.source?.[0][range.encode.y as string]).toBe(6);
  expect(linked.dimensions).toContain(range.encode.y);
  expect(option.dataset[0].source).toEqual(spec.data.values);
});
