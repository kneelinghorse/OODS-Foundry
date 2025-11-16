import { describe, expect, it, vi } from 'vitest';
import { bindEChartsInteractions } from '../../src/viz/adapters/echarts-interactions.js';
import type { EChartsRuntime } from '../../src/viz/adapters/echarts-interactions.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';

function createSpec(): NormalizedVizSpec {
  return {
    $schema: 'https://oods.dev/viz-spec/v1',
    id: 'spec:echarts:runtime',
    name: 'Runtime Highlight',
    data: {
      values: [
        { category: 'North', value: 100 },
        { category: 'South', value: 80 },
      ],
    },
    marks: [
      {
        trait: 'MarkBar',
        encodings: {
          x: { field: 'category', trait: 'EncodingPositionX', channel: 'x', title: 'Region' },
          y: { field: 'value', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Value' },
        },
      },
    ],
    encoding: {
      x: { field: 'category', trait: 'EncodingPositionX', channel: 'x' },
      y: { field: 'value', trait: 'EncodingPositionY', channel: 'y' },
    },
    interactions: [
      {
        id: 'hover-highlight',
        select: { type: 'point', on: 'hover', fields: ['category'] },
        rule: {
          bindTo: 'visual',
          property: 'fillOpacity',
          condition: { value: 1 },
          else: { value: 0.25 },
        },
      },
    ],
    a11y: {
      description: 'Runtime interactions',
    },
  };
}

function createFacetSpec(): NormalizedVizSpec {
  const spec = createSpec();
  spec.layout = {
    trait: 'LayoutFacet',
    rows: { field: 'region', limit: 2 },
    sharedScales: { x: 'shared', y: 'shared' },
  };
  spec.data = {
    values: [
      { region: 'North', category: 'A', value: 100 },
      { region: 'South', category: 'B', value: 80 },
    ],
  };
  return spec;
}

describe('bindEChartsInteractions', () => {
  it('registers highlight handlers for point interactions', () => {
    const handlers: Record<string, (payload: unknown) => void> = {};
    const onSpy = vi.fn<(event: string, handler: (payload: unknown) => void) => void>((event, handler) => {
      handlers[event] = handler;
    });
    const offSpy = vi.fn<(event: string, handler: (payload: unknown) => void) => void>((event, handler) => {
      if (handlers[event] === handler) {
        delete handlers[event];
      }
    });
    const dispatchSpy = vi.fn<(action: { type: string; seriesIndex?: number; dataIndex?: number }) => void>();

    const instance: EChartsRuntime = {
      on: onSpy,
      off: offSpy,
      dispatchAction: dispatchSpy,
    };

    const cleanup = bindEChartsInteractions(instance, createSpec());

    expect(onSpy).toHaveBeenCalledWith('mouseover', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('globalout', expect.any(Function));

    handlers.mouseover?.({ seriesIndex: 0, dataIndex: 1 });
    expect(dispatchSpy).toHaveBeenNthCalledWith(1, { type: 'downplay' });
    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: 1,
    });

    cleanup();
    expect(offSpy).toHaveBeenCalled();
  });

  it('no-ops when no visual interactions are defined', () => {
    const spec = createSpec();
    spec.interactions = undefined;
    const onSpy = vi.fn<(event: string, handler: (payload: unknown) => void) => void>();
    const dispatchSpy = vi.fn<(action: { type: string }) => void>();
    const instance: EChartsRuntime = {
      on: onSpy,
      dispatchAction: dispatchSpy,
    };

    const cleanup = bindEChartsInteractions(instance, spec);

    expect(onSpy).not.toHaveBeenCalled();
    cleanup();
  });

  it('propagates highlights across panels when layout syncing is enabled', () => {
    const spec = createFacetSpec();
    const handlers: Record<string, (payload: unknown) => void> = {};
    const onSpy = vi.fn<(event: string, handler: (payload: unknown) => void) => void>((event, handler) => {
      handlers[event] = handler;
    });
    const dispatchSpy = vi.fn<(action: { type: string; seriesIndex?: number; dataIndex?: number }) => void>();

    const instance: EChartsRuntime = {
      on: onSpy,
      dispatchAction: dispatchSpy,
    };

    bindEChartsInteractions(instance, spec);

    handlers.mouseover?.({ seriesIndex: 0, dataIndex: 1 });

    expect(dispatchSpy).toHaveBeenNthCalledWith(1, { type: 'downplay' });
    expect(dispatchSpy).toHaveBeenNthCalledWith(2, {
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: 1,
    });
    expect(dispatchSpy).toHaveBeenNthCalledWith(3, {
      type: 'highlight',
      seriesIndex: 1,
      dataIndex: 1,
    });
  });

  it('registers brush handlers for interval filters across axes', () => {
    const spec = createSpec();
    spec.interactions = [
      {
        id: 'brush-all',
        select: { type: 'interval', on: 'drag', encodings: ['x', 'y'] },
        rule: { bindTo: 'filter' },
      },
    ];
    const handlers: Record<string, (event: unknown) => void> = {};
    const onSpy = vi.fn<(event: string, handler: (event: unknown) => void) => void>((event, handler) => {
      handlers[event] = handler;
    });
    const dispatchSpy = vi.fn<(action: { type: string; seriesIndex?: number; dataIndex?: number }) => void>();

    bindEChartsInteractions(
      {
        on: onSpy,
        dispatchAction: dispatchSpy,
      },
      spec
    );

    expect(onSpy).toHaveBeenCalledWith('brushselected', expect.any(Function));
    handlers.brushselected?.({
      batch: [
        {
          selected: [
            {
              seriesIndex: 0,
              dataIndex: [0, 1],
            },
          ],
        },
      ],
    });

    expect(dispatchSpy).toHaveBeenNthCalledWith(1, { type: 'downplay' });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: 0,
    });
  });

  it('clears highlights when zoom interactions fire datazoom events', () => {
    const spec = createSpec();
    spec.interactions = [
      {
        id: 'zoom',
        select: { type: 'interval', on: 'wheel', encodings: ['x'] },
        rule: { bindTo: 'zoom' },
      },
    ];
    const handlers: Record<string, (event: unknown) => void> = {};
    const onSpy = vi.fn<(event: string, handler: (event: unknown) => void) => void>((event, handler) => {
      handlers[event] = handler;
    });
    const dispatchSpy = vi.fn<(action: { type: string }) => void>();

    bindEChartsInteractions(
      {
        on: onSpy,
        dispatchAction: dispatchSpy,
      },
      spec
    );

    expect(onSpy).toHaveBeenCalledWith('datazoom', expect.any(Function));
    handlers.datazoom?.({});
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'downplay' });
  });
});
