import type { NetworkFlowVizType } from '@/types/viz/resolver.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';
import type { NormalizedVizSpec, TraitBinding } from '@/viz/spec/normalized-viz-spec.js';
import { resolveNetworkFlowPath } from '@/viz/resolver/network-flow-resolver.js';

export type VizRendererId = 'vega-lite' | 'echarts' | 'vega';

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
    | 'network-flow'
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
  spec: NormalizedVizSpec | SpatialSpec | NetworkFlowSpec,
  options: RendererSelectionOptions = {}
): RendererSelectionResult {
  const pool = normalizePool(options.available);

  if (pool.length === 0) {
    throw new RendererSelectionError('No renderer targets provided.');
  }

  if (isNetworkFlowSpec(spec)) {
    const networkFlowType = detectNetworkFlowVizType(spec);

    if (!networkFlowType) {
      throw new RendererSelectionError('Network & Flow visualization type is missing or invalid.');
    }

    const result = resolveNetworkFlowPath({
      vizType: networkFlowType,
      data: spec.data ?? {},
      availableRenderers: pool,
      dimensions: extractDimensions(spec),
    });

    if (result.path === 'unsupported' || !result.renderer) {
      throw new RendererSelectionError(result.reason);
    }

    return { renderer: result.renderer, reason: 'network-flow' };
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

  return available.filter(
    (renderer): renderer is VizRendererId =>
      renderer === 'vega-lite' || renderer === 'echarts' || renderer === 'vega'
  );
}

function normalizeRendererId(renderer?: string | null): VizRendererId | undefined {
  if (renderer === 'vega-lite' || renderer === 'echarts' || renderer === 'vega') {
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

type NetworkFlowSpec = {
  mark?: { type?: string | null };
  marks?: Array<{ type?: string | null }>;
  data?: unknown;
  dimensions?: { width?: number; height?: number };
  config?: { layout?: { width?: number; height?: number } };
  portability?: { preferredRenderer?: string | null };
};

function isNetworkFlowSpec(
  spec: NetworkFlowSpec | SpatialSpec | NormalizedVizSpec
): spec is NetworkFlowSpec {
  if ('mark' in spec && spec.mark && typeof spec.mark.type === 'string') {
    return true;
  }

  if (!('marks' in spec)) {
    return false;
  }

  const marks = spec.marks;
  return Array.isArray(marks) && marks.some((mark) => typeof (mark as { type?: unknown })?.type === 'string');
}

function detectNetworkFlowVizType(spec: NetworkFlowSpec): NetworkFlowVizType | null {
  const markType = spec.mark?.type;
  if (typeof markType === 'string' && isNetworkFlowVizType(markType)) {
    return markType;
  }

  const marks = spec.marks;
  if (Array.isArray(marks)) {
    for (const mark of marks) {
      const candidate = typeof mark?.type === 'string' ? mark.type : undefined;
      if (candidate && isNetworkFlowVizType(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function isNetworkFlowVizType(candidate: string): candidate is NetworkFlowVizType {
  return candidate === 'treemap' || candidate === 'sunburst' || candidate === 'force_graph' || candidate === 'sankey';
}

function extractDimensions(
  spec: NetworkFlowSpec | SpatialSpec | NormalizedVizSpec
): { width: number; height: number } {
  const explicit = (spec as { dimensions?: { width?: number; height?: number } }).dimensions;
  const width = explicit?.width ?? (spec as { config?: { layout?: { width?: number } } }).config?.layout?.width ?? 0;
  const height =
    explicit?.height ?? (spec as { config?: { layout?: { height?: number } } }).config?.layout?.height ?? 0;

  return {
    width: typeof width === 'number' ? width : 0,
    height: typeof height === 'number' ? height : 0,
  };
}
