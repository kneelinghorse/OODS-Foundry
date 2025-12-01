import type { SpatialSpec } from '@/types/viz/spatial.js';
import type { NormalizedVizSpec, TraitBinding } from '@/viz/spec/normalized-viz-spec.js';

export type VizRendererId = 'vega-lite' | 'echarts';

export interface RendererSelectionOptions {
  readonly available?: readonly VizRendererId[];
  readonly preferred?: VizRendererId;
  readonly minRowsForECharts?: number;
}

export interface RendererSelectionResult {
  readonly renderer: VizRendererId;
  readonly reason:
    | 'user-preference'
    | 'spec-preference'
    | 'layout'
    | 'data-volume'
    | 'temporal'
    | 'spatial'
    | 'default';
}

export class RendererSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RendererSelectionError';
  }
}

const DEFAULT_RENDERERS: readonly VizRendererId[] = ['vega-lite', 'echarts'];
const DEFAULT_ECHARTS_THRESHOLD = 500;
const DEFAULT_SPATIAL_POINT_THRESHOLD = 10_000;

export function selectVizRenderer(
  spec: NormalizedVizSpec | SpatialSpec,
  options: RendererSelectionOptions = {}
): RendererSelectionResult {
  const pool = normalizePool(options.available);

  if (pool.length === 0) {
    throw new RendererSelectionError('No renderer targets provided.');
  }

  if (options.preferred && pool.includes(options.preferred)) {
    return { renderer: options.preferred, reason: 'user-preference' };
  }

  const specPreferred = normalizeRendererId((spec as NormalizedVizSpec).portability?.preferredRenderer);
  if (specPreferred && pool.includes(specPreferred)) {
    return { renderer: specPreferred, reason: 'spec-preference' };
  }

  if (isSpatialSpec(spec)) {
    return { renderer: selectSpatialRenderer(spec, pool), reason: 'spatial' };
  }

  const layoutPreferred = selectLayoutRenderer(spec, pool);
  if (layoutPreferred) {
    return { renderer: layoutPreferred, reason: 'layout' };
  }

  const valuesCount = Array.isArray(spec.data.values) ? spec.data.values.length : 0;
  const minEChartsRows = options.minRowsForECharts ?? DEFAULT_ECHARTS_THRESHOLD;
  if (valuesCount >= minEChartsRows && pool.includes('echarts')) {
    return { renderer: 'echarts', reason: 'data-volume' };
  }

  if (hasTemporalEncodings(spec) && pool.includes('vega-lite')) {
    return { renderer: 'vega-lite', reason: 'temporal' };
  }

  return { renderer: pool[0], reason: 'default' };
}

function normalizePool(available?: readonly VizRendererId[]): VizRendererId[] {
  if (!available) {
    return [...DEFAULT_RENDERERS];
  }

  return available.filter((renderer): renderer is VizRendererId => renderer === 'vega-lite' || renderer === 'echarts');
}

function normalizeRendererId(renderer?: string | null): VizRendererId | undefined {
  if (renderer === 'vega-lite' || renderer === 'echarts') {
    return renderer;
  }

  return undefined;
}

function selectLayoutRenderer(spec: NormalizedVizSpec, pool: VizRendererId[]): VizRendererId | undefined {
  const layout = spec.layout;

  if (!layout) {
    return undefined;
  }

  if (layout.trait === 'LayoutFacet' && pool.includes('vega-lite')) {
    return 'vega-lite';
  }

  if (layout.trait === 'LayoutLayer' && pool.includes('echarts')) {
    return 'echarts';
  }

  if (layout.trait === 'LayoutConcat' && pool.includes('vega-lite')) {
    return 'vega-lite';
  }

  return undefined;
}

function isSpatialSpec(candidate: NormalizedVizSpec | SpatialSpec): candidate is SpatialSpec {
  return (candidate as SpatialSpec).type === 'spatial';
}

function selectSpatialRenderer(spec: SpatialSpec, pool: VizRendererId[]): VizRendererId {
  const counts = estimateSpatialCounts(spec);
  const streamingEnabled = Boolean((spec as { streaming?: { enabled?: boolean } }).streaming?.enabled);
  const portability = (spec as { portability?: { priority?: string } }).portability;

  if (counts.pointCount > DEFAULT_SPATIAL_POINT_THRESHOLD && pool.includes('echarts')) {
    return 'echarts';
  }

  if (streamingEnabled && pool.includes('echarts')) {
    return 'echarts';
  }

  if (portability?.priority === 'high' && pool.includes('vega-lite')) {
    return 'vega-lite';
  }

  return pool.includes('vega-lite') ? 'vega-lite' : pool[0];
}

function estimateSpatialCounts(spec: SpatialSpec): { pointCount: number } {
  const dataSource = spec.data as { values?: unknown };
  const values = Array.isArray(dataSource.values) ? dataSource.values : [];
  return { pointCount: values.length };
}

function hasTemporalEncodings(spec: NormalizedVizSpec): boolean {
  const channelMaps = [
    spec.encoding,
    ...spec.marks.map((mark) => mark.encodings),
  ].filter((map): map is NormalizedVizSpec['encoding'] => Boolean(map));

  for (const map of channelMaps) {
    for (const channel of Object.keys(map) as (keyof NormalizedVizSpec['encoding'])[]) {
      const binding = map[channel] as TraitBinding | undefined;

      if (!binding) {
        continue;
      }

      if (binding.timeUnit || binding.scale === 'temporal') {
        return true;
      }
    }
  }

  return false;
}
