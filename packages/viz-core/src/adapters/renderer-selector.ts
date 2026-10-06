import type { NormalizedVizSpec, TraitBinding } from '../spec/normalized-viz-spec.js';

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
    | 'network-flow'
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

export function selectVizRenderer(
  spec: NormalizedVizSpec,
  options: RendererSelectionOptions = {}
): RendererSelectionResult {
  const pool = normalizePool(options.available);

  if (pool.length === 0) {
    throw new RendererSelectionError('No renderer targets provided.');
  }

  if (hasNetworkFlowHints(spec)) {
    if (pool.includes('echarts')) {
      return { renderer: 'echarts', reason: 'network-flow' };
    }
  }

  if (options.preferred && pool.includes(options.preferred)) {
    return { renderer: options.preferred, reason: 'user-preference' };
  }

  const specPreferred = normalizeRendererId(spec.portability?.preferredRenderer);
  if (specPreferred && pool.includes(specPreferred)) {
    return { renderer: specPreferred, reason: 'spec-preference' };
  }

  const layoutPreferred = selectLayoutRenderer(spec, pool);
  if (layoutPreferred) {
    return { renderer: layoutPreferred, reason: 'layout' };
  }

  const valuesCount = Array.isArray(spec.data.values) ? spec.data.values.length : 0;
  const isStreaming = hasStreamingEnabled(spec);

  const isSpatial = hasSpatialHints(spec);
  const portablePriority = getPortabilityPriority(spec);
  if (isSpatial) {
    if (specPreferred && pool.includes(specPreferred)) {
      return { renderer: specPreferred, reason: 'spatial' };
    }
    if (portablePriority === 'high' && pool.includes('vega-lite')) {
      return { renderer: 'vega-lite', reason: 'spatial' };
    }
    if (isStreaming && pool.includes('echarts')) {
      return { renderer: 'echarts', reason: 'spatial' };
    }
    // ECharts handles very dense spatial better
    if (valuesCount >= 10000 && pool.includes('echarts')) {
      return { renderer: 'echarts', reason: 'spatial' };
    }

    if (pool.includes('vega-lite')) {
      return { renderer: 'vega-lite', reason: 'spatial' };
    }
    if (pool.includes('echarts')) {
      return { renderer: 'echarts', reason: 'spatial' };
    }
  }

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

function hasTemporalEncodings(spec: NormalizedVizSpec): boolean {
  const channelMaps = [
    spec.encoding,
    ...readMarks(spec).map((mark) => mark.encodings),
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

function hasNetworkFlowHints(spec: NormalizedVizSpec): boolean {
  return readLegacyMarkTypes(spec).some((markType) => isNetworkFlowMarkType(markType));
}

function hasSpatialHints(spec: NormalizedVizSpec): boolean {
  return readSpecType(spec) === 'spatial' || readLegacyMarkTypes(spec).some((markType) => markType.includes('geoshape'));
}

function hasStreamingEnabled(spec: NormalizedVizSpec): boolean {
  if (!('streaming' in spec)) {
    return false;
  }

  const streaming = spec.streaming;
  return Boolean(
    streaming &&
      typeof streaming === 'object' &&
      'enabled' in streaming &&
      streaming.enabled === true
  );
}

function getPortabilityPriority(spec: NormalizedVizSpec): string | undefined {
  const portability = spec.portability as (NormalizedVizSpec['portability'] & { priority?: string }) | undefined;
  return portability?.priority;
}

function readSpecType(spec: NormalizedVizSpec): string | undefined {
  if (!('type' in spec)) {
    return undefined;
  }

  return typeof spec.type === 'string' ? spec.type : undefined;
}

function readLegacyMarkTypes(spec: NormalizedVizSpec): string[] {
  const markTypes = readMarks(spec)
    .map((mark) => readLegacyMarkType(mark))
    .filter((markType): markType is string => typeof markType === 'string');

  if ('mark' in spec) {
    const singleMarkType = readLooseType(spec.mark);
    if (singleMarkType) {
      markTypes.push(singleMarkType);
    }
  }

  return markTypes;
}

function readMarks(spec: NormalizedVizSpec): Array<NormalizedVizSpec['marks'][number]> {
  if (!('marks' in spec) || !Array.isArray(spec.marks)) {
    return [];
  }

  return spec.marks as Array<NormalizedVizSpec['marks'][number]>;
}

function readLegacyMarkType(mark: NormalizedVizSpec['marks'][number]): string | undefined {
  return readLooseType(mark);
}

function readLooseType(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return undefined;
  }

  return typeof value.type === 'string' ? value.type : undefined;
}

function isNetworkFlowMarkType(markType: string): boolean {
  return ['sankey', 'force_graph', 'treemap', 'sunburst'].includes(markType);
}
