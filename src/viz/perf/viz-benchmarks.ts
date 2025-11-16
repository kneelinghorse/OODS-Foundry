import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import path from 'node:path';

import TimeService from '@/services/time/index.js';
import { bindEChartsInteractions } from '@/viz/adapters/echarts-interactions.js';
import type { EChartsRuntime } from '@/viz/adapters/echarts-interactions.js';
import type { VizRendererId } from '@/viz/adapters/renderer-selector.js';
import { toEChartsOption } from '@/viz/adapters/echarts-adapter.js';
import type { EChartsOption } from '@/viz/adapters/echarts-adapter.js';
import { toVegaLiteSpec } from '@/viz/adapters/vega-lite-adapter.js';
import type { VegaLiteAdapterSpec } from '@/viz/adapters/vega-lite-adapter.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';

import barExample from '../../../examples/viz/bar-chart.spec.json' assert { type: 'json' };
import lineExample from '../../../examples/viz/line-chart.spec.json' assert { type: 'json' };
import scatterExample from '../../../examples/viz/scatter-chart.spec.json' assert { type: 'json' };
import areaExample from '../../../examples/viz/patterns-v2/running-total-area.spec.json' assert { type: 'json' };
import heatmapExample from '../../../examples/viz/patterns-v2/time-grid-heatmap.spec.json' assert { type: 'json' };

export const BASE_CHART_TYPES = ['bar', 'line', 'scatter', 'area', 'heatmap'] as const;
export const LAYOUT_CHART_TYPES = ['facet-scatter-brush', 'layered-target-band', 'concat-detail-overview'] as const;
export type VizBenchmarkChartType =
  | (typeof BASE_CHART_TYPES)[number]
  | (typeof LAYOUT_CHART_TYPES)[number];
type MetricKind = 'render' | 'update' | 'interaction';

export interface VizBenchmarkScenario {
  readonly id: string;
  readonly chartType: VizBenchmarkChartType;
  readonly renderer: VizRendererId;
  readonly dataPoints: number;
}

export interface VizBenchmarkMetrics {
  readonly renderTimeMs: number;
  readonly updateTimeMs: number;
  readonly interactionLatencyMs: number;
  readonly memoryBytes: number;
  readonly bundleImpactBytes: number;
}

export interface VizBenchmarkResult extends VizBenchmarkScenario {
  readonly metrics: VizBenchmarkMetrics;
  readonly specId: string;
  readonly preferredReason: string;
}

export interface VizBenchmarkSuite {
  readonly generatedAt: string;
  readonly results: readonly VizBenchmarkResult[];
  readonly recommendations: readonly VizRendererRecommendation[];
}

export interface VizRendererRecommendation {
  readonly chartType: VizBenchmarkChartType;
  readonly dataPoints: number;
  readonly bestRenderer: VizRendererId;
  readonly advantageMs: number;
  readonly comparison: {
    readonly vegaLite: VizBenchmarkMetrics;
    readonly echarts: VizBenchmarkMetrics;
  };
}

const DEFAULT_DATA_POINTS: readonly number[] = [10, 100, 1000, 10000] as const;
const RENDERERS: readonly VizRendererId[] = ['vega-lite', 'echarts'];
const DETERMINISTIC_MODE = process.env.VIZ_BENCHMARK_MODE === 'deterministic';

const BAR_BASE_SPEC = barExample as unknown as NormalizedVizSpec;
const LINE_BASE_SPEC = lineExample as unknown as NormalizedVizSpec;
const SCATTER_BASE_SPEC = scatterExample as unknown as NormalizedVizSpec;
const AREA_BASE_SPEC = areaExample as unknown as NormalizedVizSpec;
const HEATMAP_BASE_SPEC = heatmapExample as unknown as NormalizedVizSpec;
const FACET_SCATTER_BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'benchmark:layout:facet-scatter',
  name: 'Facet scatter with linked brush',
  data: { values: [] },
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', title: 'Lead time (days)', scale: 'linear' },
        y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', title: 'Win rate (%)', scale: 'linear' },
        color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
        size: { field: 'pipeline', trait: 'EncodingSize', channel: 'size', legend: { title: 'Pipeline ($M)' } },
      },
    },
  ],
  encoding: {
    x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear' },
    y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear' },
    color: { field: 'segment', trait: 'EncodingColor', channel: 'color' },
  },
  layout: {
    trait: 'LayoutFacet',
    rows: { field: 'region', title: 'Region', limit: 2, sort: 'ascending' },
    columns: { field: 'segment', title: 'Segment', limit: 2, sort: 'ascending' },
    wrap: 'row',
    maxPanels: 4,
    gap: 16,
    sharedScales: { x: 'shared', y: 'shared', color: 'shared' },
  },
  interactions: [
    {
      id: 'facet-brush',
      select: { type: 'interval', on: 'drag', encodings: ['x', 'y'] },
      rule: {
        bindTo: 'visual',
        property: 'strokeWidth',
        condition: { value: 2 },
        else: { value: 0.4 },
      },
    },
    {
      id: 'facet-tooltip',
      select: { type: 'point', on: 'hover', fields: ['region', 'segment', 'pipeline'] },
      rule: {
        bindTo: 'tooltip',
        fields: ['region', 'segment', 'leadTime', 'winRate', 'pipeline'],
      },
    },
  ],
  config: {
    theme: 'brand-a',
    layout: { width: 360, height: 240, padding: 16 },
  },
  a11y: {
    ariaLabel: 'Facet scatter grid with brush selection',
    description: 'Scatter plots per region × segment to compare win rates and lead times.',
    tableFallback: { enabled: true, caption: 'Win rate and lead time by region/segment' },
  },
  portability: {
    preferredRenderer: 'vega-lite',
  },
};
const LAYERED_TARGET_BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'benchmark:layout:layered-target',
  name: 'Layered actual vs target band',
  data: { values: [] },
  marks: [
    {
      trait: 'MarkArea',
      options: { id: 'target-band', title: 'Target band' },
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
        y: { field: 'target', trait: 'EncodingPositionY', channel: 'y', title: 'Target index', scale: 'linear' },
      },
    },
    {
      trait: 'MarkLine',
      options: { id: 'actual-line', title: 'Actuals' },
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
        y: { field: 'actual', trait: 'EncodingPositionY', channel: 'y', title: 'Actual index', scale: 'linear' },
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
    y: { field: 'actual', trait: 'EncodingPositionY', channel: 'y', title: 'Performance index' },
  },
  layout: {
    trait: 'LayoutLayer',
    order: ['target-band', 'actual-line'],
    sharedScales: { x: 'shared', y: 'shared' },
  },
  interactions: [
    {
      id: 'layered-focus',
      select: { type: 'point', on: 'hover', fields: ['month'] },
      rule: {
        bindTo: 'visual',
        property: 'strokeWidth',
        condition: { value: 3 },
        else: { value: 1 },
      },
    },
  ],
  config: {
    theme: 'brand-a',
    layout: { width: 640, height: 360, padding: 20 },
  },
  a11y: {
    ariaLabel: 'Layered actual vs target band',
    description: 'Actual index overlays a transparent target band to expose deltas.',
    tableFallback: { enabled: true, caption: 'Actual vs target index by period' },
  },
  portability: {
    preferredRenderer: 'echarts',
  },
};
const CONCAT_DETAIL_BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'benchmark:layout:concat-detail',
  name: 'Detail-overview bookings',
  data: { values: [] },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'segment', trait: 'EncodingPositionX', channel: 'x', title: 'Segment', scale: 'band' },
        y: { field: 'bookings', trait: 'EncodingPositionY', channel: 'y', title: 'Bookings ($M)', scale: 'linear' },
        color: { field: 'product', trait: 'EncodingColor', channel: 'color', legend: { title: 'Product' } },
      },
    },
  ],
  encoding: {
    x: { field: 'segment', trait: 'EncodingPositionX', channel: 'x' },
    y: { field: 'bookings', trait: 'EncodingPositionY', channel: 'y' },
    color: { field: 'product', trait: 'EncodingColor', channel: 'color' },
  },
  layout: {
    trait: 'LayoutConcat',
    direction: 'horizontal',
    gap: 18,
    sections: [
      { id: 'overview', title: 'All products' },
      {
        id: 'core-detail',
        title: 'Core detail',
        filters: [{ field: 'product', operator: '==', value: 'Core' }],
      },
      {
        id: 'plus-detail',
        title: 'Plus detail',
        filters: [{ field: 'product', operator: '==', value: 'Plus' }],
      },
    ],
  },
  interactions: [
    {
      id: 'concat-tooltip',
      select: { type: 'point', on: 'click', fields: ['product', 'segment'] },
      rule: {
        bindTo: 'tooltip',
        fields: ['product', 'segment', 'bookings', 'target'],
      },
    },
  ],
  config: {
    theme: 'brand-a',
    layout: { width: 960, height: 360, padding: 20 },
  },
  a11y: {
    ariaLabel: 'Detail-overview layout for bookings by product and segment',
    description: 'Overview plus filtered panels to inspect Core and Plus performance.',
    tableFallback: { enabled: true, caption: 'Bookings vs target by segment' },
  },
  portability: {
    preferredRenderer: 'echarts',
  },
};

interface ChartBlueprint {
  readonly base: NormalizedVizSpec;
  readonly highlightFields: readonly string[];
  readonly tooltipFields: readonly string[];
  readonly generator: (count: number, seed: number) => readonly Record<string, unknown>[];
}

const CHART_BLUEPRINTS: Record<VizBenchmarkChartType, ChartBlueprint> = {
  bar: {
    base: BAR_BASE_SPEC,
    highlightFields: ['region'],
    tooltipFields: ['region', 'mrr'],
    generator: (count, seed) => generateBarRows(count, seed),
  },
  line: {
    base: LINE_BASE_SPEC,
    highlightFields: ['month'],
    tooltipFields: ['month', 'subscribers'],
    generator: (count, seed) => generateSeriesRows(count, seed, 'subscribers', 3600, 55),
  },
  scatter: {
    base: SCATTER_BASE_SPEC,
    highlightFields: ['segment'],
    tooltipFields: ['segment', 'leadTime', 'winRate', 'pipeline'],
    generator: (count, seed) => generateScatterRows(count, seed),
  },
  area: {
    base: AREA_BASE_SPEC,
    highlightFields: ['month'],
    tooltipFields: ['month', 'arr'],
    generator: (count, seed) => generateSeriesRows(count, seed, 'arr', 220, 4.5),
  },
  heatmap: {
    base: HEATMAP_BASE_SPEC,
    highlightFields: ['day', 'hour'],
    tooltipFields: ['day', 'hour', 'tickets'],
    generator: (count, seed) => generateHeatmapRows(count, seed),
  },
  'facet-scatter-brush': {
    base: FACET_SCATTER_BASE_SPEC,
    highlightFields: ['region', 'segment'],
    tooltipFields: ['region', 'segment', 'leadTime', 'winRate', 'pipeline'],
    generator: (count, seed) => generateFacetScatterRows(count, seed),
  },
  'layered-target-band': {
    base: LAYERED_TARGET_BASE_SPEC,
    highlightFields: ['month'],
    tooltipFields: ['month', 'actual', 'target'],
    generator: (count, seed) => generateLayeredBandRows(count, seed),
  },
  'concat-detail-overview': {
    base: CONCAT_DETAIL_BASE_SPEC,
    highlightFields: ['product', 'segment'],
    tooltipFields: ['product', 'segment', 'bookings', 'target'],
    generator: (count, seed) => generateDetailOverviewRows(count, seed),
  },
};

const CHART_DATA_POINTS: Partial<Record<VizBenchmarkChartType, readonly number[]>> = {
  'facet-scatter-brush': [240, 960],
  'layered-target-band': [360, 1440],
  'concat-detail-overview': [180, 720],
};

const CHART_TYPES_LIST = [...BASE_CHART_TYPES, ...LAYOUT_CHART_TYPES] as const;

const requireForPaths = createRequire(import.meta.url);
const bundleFootprintCache = new Map<VizRendererId, number>();

export const defaultVizBenchmarkPlan: readonly VizBenchmarkScenario[] = CHART_TYPES().flatMap((chartType) =>
  chartDataPoints(chartType)
    .map((points) =>
      RENDERERS.map((renderer) => ({
        id: `${chartType}-${points}-${renderer}`,
        chartType,
        renderer,
        dataPoints: points,
      }))
    )
    .flat()
);

function chartDataPoints(chartType: VizBenchmarkChartType): readonly number[] {
  return CHART_DATA_POINTS[chartType] ?? DEFAULT_DATA_POINTS;
}

export function CHART_TYPES(): readonly VizBenchmarkChartType[] {
  return CHART_TYPES_LIST;
}

export function runVizBenchmarks(
  scenarios: readonly VizBenchmarkScenario[] = defaultVizBenchmarkPlan,
  seed: number = 42
): VizBenchmarkSuite {
  const results = scenarios.map((scenario, index) => runScenario(scenario, seed + index));
  const recommendations = buildRecommendations(results);

  return {
    generatedAt: TimeService.nowSystem().toISO() ?? '',
    results,
    recommendations,
  };
}

function runScenario(scenario: VizBenchmarkScenario, seed: number): VizBenchmarkResult {
  const spec = buildSpec(scenario.chartType, scenario.dataPoints, scenario.renderer, seed);
  const renderMeasurement = measureRender(spec, scenario.renderer);
  const updateTimeMs = measureUpdate(spec, scenario.renderer);
  const interactionLatencyMs = measureInteractions(spec, scenario.renderer);
  const memoryBytes = measureMemory(renderMeasurement.product);
  const bundleImpactBytes = resolveBundleFootprint(scenario.renderer);
  const preferredReason = describePreference(renderMeasurement.renderTimeMs, updateTimeMs);

  return {
    ...scenario,
    metrics: {
      renderTimeMs: renderMeasurement.renderTimeMs,
      updateTimeMs,
      interactionLatencyMs,
      memoryBytes,
      bundleImpactBytes,
    },
    specId: spec.id ?? scenario.id,
    preferredReason,
  };
}

function buildSpec(
  chartType: VizBenchmarkChartType,
  dataPoints: number,
  renderer: VizRendererId,
  seed: number
): NormalizedVizSpec {
  const blueprint = CHART_BLUEPRINTS[chartType];
  if (!blueprint) {
    throw new Error(`Unknown chart type: ${chartType}`);
  }

  const spec = structuredClone(blueprint.base);
  const values = blueprint.generator(dataPoints, seed);
  spec.data = {
    ...(spec.data ?? {}),
    values: values.map((row) => ({ ...row })),
  };
  spec.id = `${spec.id ?? chartType}:${renderer}:${dataPoints}`;
  spec.name = `${spec.name ?? chartType} (${renderer}, ${dataPoints} rows)`;
  spec.portability = {
    ...(spec.portability ?? {}),
    preferredRenderer: renderer,
  };
  spec.interactions = ensureInteractions(spec.interactions, blueprint.highlightFields, blueprint.tooltipFields);
  return spec;
}

function measureRender(
  spec: NormalizedVizSpec,
  renderer: VizRendererId
): { renderTimeMs: number; product: VegaLiteAdapterSpec | EChartsOption } {
  let product: VegaLiteAdapterSpec | EChartsOption =
    renderer === 'vega-lite' ? toVegaLiteSpec(spec) : toEChartsOption(spec);

  if (DETERMINISTIC_MODE) {
    return {
      renderTimeMs: simulateMetric('render', spec, renderer),
      product,
    };
  }

  const iterations = spec.data?.values && spec.data.values.length > 2000 ? 2 : 4;
  const samples: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    product = renderer === 'vega-lite'
      ? toVegaLiteSpec(spec)
      : toEChartsOption(spec);
    samples.push(performance.now() - start);
  }

  return {
    renderTimeMs: Math.min(...samples),
    product,
  };
}

function measureUpdate(spec: NormalizedVizSpec, renderer: VizRendererId): number {
  if (DETERMINISTIC_MODE) {
    return simulateMetric('update', spec, renderer);
  }

  const iterations = spec.data?.values && spec.data.values.length > 1000 ? 2 : 3;
  const samples: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const mutated = structuredClone(spec);
    disturbSeries(mutated, 0.015 * (i + 1));
    const start = performance.now();
    if (renderer === 'vega-lite') {
      toVegaLiteSpec(mutated);
    } else {
      toEChartsOption(mutated);
    }
    samples.push(performance.now() - start);
  }

  return Math.min(...samples);
}

function measureInteractions(spec: NormalizedVizSpec, renderer: VizRendererId): number {
  if (!spec.interactions || spec.interactions.length === 0) {
    return 0;
  }

  if (DETERMINISTIC_MODE) {
    return simulateMetric('interaction', spec, renderer);
  }

  if (renderer === 'vega-lite') {
    const start = performance.now();
    const payload = spec.interactions.map((interaction) => ({
      id: interaction.id,
      bindTo: interaction.rule.bindTo,
      select: interaction.select.type,
    }));
    JSON.stringify(payload);
    return performance.now() - start;
  }

  const runtime = new BenchmarkEChartsRuntime();
  const bindStart = performance.now();
  const cleanup = bindEChartsInteractions(runtime, spec);
  const bindDuration = performance.now() - bindStart;

  const interactionStart = performance.now();
  runtime.emit('mouseover', { seriesIndex: 0, dataIndex: 0 });
  runtime.emit('globalout', {});
  const interactionDuration = performance.now() - interactionStart;
  cleanup();

  return bindDuration + interactionDuration;
}

function measureMemory(product: VegaLiteAdapterSpec | EChartsOption): number {
  const serialized = JSON.stringify(product);
  return Buffer.byteLength(serialized, 'utf8');
}

function resolveBundleFootprint(renderer: VizRendererId): number {
  const cached = bundleFootprintCache.get(renderer);
  if (typeof cached === 'number') {
    return cached;
  }

  let target = '';
  try {
    const resolved = requireForPaths.resolve(renderer === 'vega-lite' ? 'vega-lite' : 'echarts');
    const dir = path.dirname(resolved);
    target = path.join(dir, renderer === 'vega-lite' ? 'vega-lite.min.js' : 'echarts.min.js');
  } catch {
    target = '';
  }

  let size = 0;
  if (target) {
    try {
      size = statSync(target).size;
    } catch {
      size = 0;
    }
  }
  bundleFootprintCache.set(renderer, size);
  return size;
}

function describePreference(renderTimeMs: number, updateTimeMs: number): string {
  if (renderTimeMs <= updateTimeMs) {
    return 'renderer faster on initial paint';
  }
  return 'renderer faster on update cycle';
}

function ensureInteractions(
  existing: NormalizedVizSpec['interactions'] | undefined,
  highlightFields: readonly string[],
  tooltipFields: readonly string[]
): NormalizedVizSpec['interactions'] {
  const interactions = [...(existing ?? [])];
  const hasHighlight = interactions.some((interaction) => interaction.rule.bindTo === 'visual');
  const hasTooltip = interactions.some((interaction) => interaction.rule.bindTo === 'tooltip');

  const highlightTuple = toInteractionFields(highlightFields);
  if (!hasHighlight && highlightTuple) {
    interactions.push({
      id: `benchmark-highlight-${highlightFields.join('-')}`,
      select: { type: 'point', on: 'hover', fields: highlightTuple },
      rule: {
        bindTo: 'visual',
        property: 'fillOpacity',
        condition: { value: 1 },
        else: { value: 0.35 },
      },
    });
  }

  const tooltipTuple = toInteractionFields(tooltipFields);
  if (!hasTooltip && tooltipTuple) {
    interactions.push({
      id: `benchmark-tooltip-${tooltipFields.join('-')}`,
      select: { type: 'point', on: 'hover', fields: tooltipTuple },
      rule: {
        bindTo: 'tooltip',
        fields: tooltipTuple,
      },
    });
  }

  return interactions;
}

function toInteractionFields(fields: readonly string[]): [string, ...string[]] | undefined {
  if (fields.length === 0) {
    return undefined;
  }
  const [first, ...rest] = fields;
  return [first, ...rest];
}

function disturbSeries(spec: NormalizedVizSpec, magnitude: number): void {
  const values = Array.isArray(spec.data?.values) ? spec.data?.values : [];
  for (const row of values) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'number') {
        // eslint-disable-next-line no-param-reassign
        row[key] = value * (1 + magnitude);
      }
    }
  }
}

function generateBarRows(count: number, seed: number): readonly Record<string, unknown>[] {
  const categories = ['North', 'South', 'East', 'West', 'Central', 'EMEA', 'APAC'];
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => ({
    region: categories[index % categories.length],
    mrr: Math.round(90000 + random() * 120000),
  }));
}

function generateSeriesRows(
  count: number,
  seed: number,
  metricField: string,
  baseValue: number,
  slope: number
): readonly Record<string, unknown>[] {
  const random = createSeededRandom(seed);
  const start = TimeService.nowSystem().set({ year: 2024, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
  return Array.from({ length: count }, (_, index) => {
    const current = start.plus({ days: index });
    const month = current.toISODate()?.slice(0, 7) ?? '1970-01';
    const variance = random() * slope * 3;
    const value = baseValue + slope * index + variance;
    return {
      month,
      [metricField]: Number(value.toFixed(2)),
    };
  });
}

function generateScatterRows(count: number, seed: number): readonly Record<string, unknown>[] {
  const segments = ['Growth', 'Enterprise', 'Mid-Market'];
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => ({
    segment: segments[index % segments.length],
    leadTime: 8 + (index % 24),
    winRate: Number((28 + random() * 25).toFixed(2)),
    pipeline: Math.round(300000 + random() * 450000),
  }));
}

function generateHeatmapRows(count: number, seed: number): readonly Record<string, unknown>[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 24 }, (_, index) => `${index.toString().padStart(2, '0')}:00`);
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => ({
    day: days[index % days.length],
    hour: hours[index % hours.length],
    tickets: Math.round(8 + random() * 40 + (index % 6)),
  }));
}

function generateFacetScatterRows(count: number, seed: number): readonly Record<string, unknown>[] {
  const regions = ['North', 'South'];
  const segments = ['Enterprise', 'Growth'];
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const region = regions[index % regions.length];
    const segment = segments[Math.floor(index / regions.length) % segments.length];
    const leadTime = 4 + (index % 28);
    const winRate = Number((32 + random() * 45).toFixed(3));
    const pipeline = Math.round(200000 + random() * 650000);
    return {
      region,
      segment,
      leadTime,
      winRate,
      pipeline,
    };
  });
}

function generateLayeredBandRows(count: number, seed: number): readonly Record<string, unknown>[] {
  const random = createSeededRandom(seed);
  const start = TimeService.nowSystem().set({ year: 2024, month: 1, day: 1 });
  return Array.from({ length: count }, (_, index) => {
    const current = start.plus({ days: index });
    const month = current.toISODate() ?? `2024-01-${String((index % 30) + 1).padStart(2, '0')}`;
    const target = 90 + (index % 60) * 0.35 + random() * 3;
    const actual = target + 4 + random() * 6;
    return {
      month,
      target: Number(target.toFixed(3)),
      actual: Number(actual.toFixed(3)),
    };
  });
}

function generateDetailOverviewRows(count: number, seed: number): readonly Record<string, unknown>[] {
  const products = ['Core', 'Plus', 'Edge', 'Data'];
  const segments = ['Enterprise', 'Growth', 'SMB', 'Mid-Market'];
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const product = products[index % products.length];
    const segment = segments[Math.floor(index / products.length) % segments.length];
    const bookings = 1.2 + (index % 10) * 0.18 + random() * 0.6;
    const target = bookings * (0.82 + random() * 0.22);
    return {
      product,
      segment,
      bookings: Number(bookings.toFixed(3)),
      target: Number(target.toFixed(3)),
    };
  });
}

function createSeededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

class BenchmarkEChartsRuntime implements EChartsRuntime {
  private readonly handlers = new Map<string, Set<(params: Record<string, unknown>) => void>>();

  on(event: string, handler: (params: Record<string, unknown>) => void): void {
    const existing = this.handlers.get(event);
    if (existing) {
      existing.add(handler);
    } else {
      this.handlers.set(event, new Set([handler]));
    }
  }

  off(event: string, handler: (params: Record<string, unknown>) => void): void {
    const existing = this.handlers.get(event);
    existing?.delete(handler);
  }

  dispatchAction(): void {
    // Intentionally no-op for benchmark instrumentation
  }

  emit(event: string, params: Record<string, unknown>): void {
    const handlers = this.handlers.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(params);
    }
  }
}

function simulateMetric(kind: MetricKind, spec: NormalizedVizSpec, renderer: VizRendererId): number {
  const valuesCount = Array.isArray(spec.data?.values) ? spec.data.values.length : 0;
  const multipliers: Record<MetricKind, number> = {
    render: 0.000005,
    update: 0.000007,
    interaction: 0.000004,
  };
  const base = renderer === 'echarts' ? 0.03 : 0.018;
  const jitter = kind === 'interaction' ? 0.005 : 0;
  const duration = base + valuesCount * multipliers[kind] + jitter;
  return Number(duration.toFixed(6));
}

function buildRecommendations(results: readonly VizBenchmarkResult[]): VizRendererRecommendation[] {
  const groups = new Map<string, VizBenchmarkResult[]>();
  for (const result of results) {
    const key = `${result.chartType}:${result.dataPoints}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(result);
    groups.set(key, bucket);
  }

  const recommendations: VizRendererRecommendation[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length < 2) {
      continue;
    }
    const [first] = bucket;
    const chartType = first.chartType;
    const dataPoints = first.dataPoints;
    const sorted = [...bucket].sort((a, b) => a.metrics.renderTimeMs - b.metrics.renderTimeMs);
    const best = sorted[0]!;
    const next = sorted[1]!;

    const bestRenderer = best.renderer;
    const advantageMs = next.metrics.renderTimeMs - best.metrics.renderTimeMs;

    const vegaLite = bucket.find((entry) => entry.renderer === 'vega-lite');
    const echarts = bucket.find((entry) => entry.renderer === 'echarts');
    if (!vegaLite || !echarts) {
      continue;
    }

    recommendations.push({
      chartType,
      dataPoints,
      bestRenderer,
      advantageMs,
      comparison: {
        vegaLite: vegaLite.metrics,
        echarts: echarts.metrics,
      },
    });
  }

  return recommendations.sort((a, b) => a.chartType.localeCompare(b.chartType) || a.dataPoints - b.dataPoints);
}
