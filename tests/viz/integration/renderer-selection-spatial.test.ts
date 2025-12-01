import { describe, expect, it } from 'vitest';
import type { SpatialSpec } from '../../../src/types/viz/spatial.js';
import { selectVizRenderer } from '../../../src/viz/adapters/renderer-selector.js';

const BASE_SPATIAL_SPEC: SpatialSpec = {
  type: 'spatial',
  data: {
    values: [
      { name: 'Alpha', lon: -120, lat: 38, magnitude: 12 },
      { name: 'Beta', lon: -90, lat: 32, magnitude: 18 },
    ],
  },
  projection: { type: 'mercator', fitToData: true },
  layers: [
    {
      type: 'symbol',
      encoding: {
        longitude: { field: 'lon' },
        latitude: { field: 'lat' },
        size: { field: 'magnitude', scale: 'sqrt' },
        color: { field: 'name', scale: 'ordinal' },
      },
    },
  ],
  a11y: { description: 'Spatial renderer selection test' },
};

function createSpatialSpec(overrides: Partial<SpatialSpec> = {}): SpatialSpec {
  return {
    ...BASE_SPATIAL_SPEC,
    ...overrides,
    data: {
      ...(BASE_SPATIAL_SPEC.data as Record<string, unknown>),
      ...(overrides.data as Record<string, unknown> | undefined),
    },
    layers: overrides.layers ?? BASE_SPATIAL_SPEC.layers,
  };
}

describe('Spatial renderer selection', () => {
  it('defaults to Vega-Lite for modest point counts', () => {
    const spec = createSpatialSpec();
    const result = selectVizRenderer(spec);
    expect(result).toEqual({ renderer: 'vega-lite', reason: 'spatial' });
  });

  it('prefers ECharts for dense datasets', () => {
    const denseSpec = createSpatialSpec({
      data: {
        values: Array.from({ length: 12000 }, (_, index) => ({
          name: `point-${index}`,
          lon: -120 + index * 0.001,
          lat: 35 + index * 0.001,
          magnitude: index % 10,
        })),
      },
    });

    const result = selectVizRenderer(denseSpec);
    expect(result).toEqual({ renderer: 'echarts', reason: 'spatial' });
  });

  it('prefers ECharts when streaming is enabled', () => {
    const streamingSpec = createSpatialSpec({
      streaming: { enabled: true },
    } as SpatialSpec & { streaming: { enabled: boolean } });
    const result = selectVizRenderer(streamingSpec);
    expect(result).toEqual({ renderer: 'echarts', reason: 'spatial' });
  });

  it('prefers Vega-Lite when portability priority is high', () => {
    const portableSpec = createSpatialSpec({
      portability: { priority: 'high' },
    } as SpatialSpec & { portability: { priority: string } });
    const result = selectVizRenderer(portableSpec, { available: ['echarts', 'vega-lite'] });
    expect(result).toEqual({ renderer: 'vega-lite', reason: 'spatial' });
  });

  it('falls back to Vega-Lite when heuristics do not trigger', () => {
    const result = selectVizRenderer(createSpatialSpec(), { available: ['vega-lite', 'echarts'] });
    expect(result.renderer).toBe('vega-lite');
    expect(result.reason).toBe('spatial');
  });
});
