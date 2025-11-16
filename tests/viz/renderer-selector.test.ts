import { describe, expect, it } from 'vitest';
import {
  RendererSelectionError,
  selectVizRenderer,
  type VizRendererId,
} from '../../src/viz/adapters/renderer-selector.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';

const BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'test:viz:selector',
  name: 'Renderer selector fixture',
  data: {
    values: [
      { category: 'A', value: 10 },
      { category: 'B', value: 12 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'category', trait: 'EncodingPositionX', channel: 'x' },
        y: { field: 'value', trait: 'EncodingPositionY', channel: 'y' },
      },
    },
  ],
  encoding: {
    x: { field: 'category', trait: 'EncodingPositionX', channel: 'x' },
    y: { field: 'value', trait: 'EncodingPositionY', channel: 'y' },
  },
  a11y: {
    description: 'Renderer selector test fixture',
  },
};

function createSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return {
    ...BASE_SPEC,
    ...overrides,
    data: {
      ...BASE_SPEC.data,
      ...(overrides.data ?? {}),
    },
    encoding: {
      ...BASE_SPEC.encoding,
      ...(overrides.encoding ?? {}),
    },
    marks: overrides.marks ?? BASE_SPEC.marks,
    a11y: {
      ...BASE_SPEC.a11y,
      ...(overrides.a11y ?? {}),
    },
    portability: overrides.portability ?? BASE_SPEC.portability,
    config: overrides.config ?? BASE_SPEC.config,
  };
}

describe('Renderer selector', () => {
  it('respects the explicit preferred renderer option', () => {
    const spec = createSpec();
    const result = selectVizRenderer(spec, { preferred: 'echarts' });

    expect(result).toEqual({ renderer: 'echarts', reason: 'user-preference' });
  });

  it('honors the spec portability preference when available', () => {
    const spec = createSpec({
      portability: { preferredRenderer: 'echarts' },
    });

    const result = selectVizRenderer(spec, { available: ['vega-lite', 'echarts'] });
    expect(result).toEqual({ renderer: 'echarts', reason: 'spec-preference' });
  });

  it('prefers ECharts for large datasets when both renderers are available', () => {
    const spec = createSpec({
      data: {
        values: Array.from({ length: 600 }, (_, index) => ({
          category: `c-${index}`,
          value: index,
        })),
      },
    });

    const result = selectVizRenderer(spec);
    expect(result).toEqual({ renderer: 'echarts', reason: 'data-volume' });
  });

  it('falls back to Vega-Lite when temporal encodings are present', () => {
    const spec = createSpec({
      encoding: {
        ...BASE_SPEC.encoding,
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
        },
      },
    });

    const result = selectVizRenderer(spec, { available: ['vega-lite', 'echarts'] });
    expect(result).toEqual({ renderer: 'vega-lite', reason: 'temporal' });
  });

  it('prefers Vega-Lite for facet layouts when available', () => {
    const spec = createSpec({
      layout: {
        trait: 'LayoutFacet',
        rows: { field: 'region', limit: 2 },
        columns: { field: 'segment', limit: 2 },
        sharedScales: { x: 'shared', y: 'shared' },
      },
    });

    const result = selectVizRenderer(spec, { available: ['vega-lite', 'echarts'] });
    expect(result).toEqual({ renderer: 'vega-lite', reason: 'layout' });
  });

  it('prefers ECharts when layering metadata is supplied', () => {
    const spec = createSpec({
      layout: {
        trait: 'LayoutLayer',
        order: ['MarkBar', 'MarkLine'],
        sharedScales: { x: 'shared', y: 'shared' },
      },
    });

    const result = selectVizRenderer(spec, { available: ['vega-lite', 'echarts'] });
    expect(result).toEqual({ renderer: 'echarts', reason: 'layout' });
  });

  it('throws when no renderer options are supplied', () => {
    const spec = createSpec();

    expect(() =>
      selectVizRenderer(spec, { available: [] as VizRendererId[] })
    ).toThrow(RendererSelectionError);
  });
});
