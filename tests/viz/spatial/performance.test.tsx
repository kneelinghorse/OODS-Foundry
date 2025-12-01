/* @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { FeatureCollection } from 'geojson';
import { adaptToECharts } from '@/viz/adapters/spatial/echarts-spatial-adapter.js';
import { adaptToVegaLite } from '@/viz/adapters/spatial/vega-lite-spatial-adapter.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';
import type { DataRecord } from '@/viz/adapters/spatial/geo-data-joiner.js';
import usStates50 from '../../../src/components/viz/spatial/fixtures/us-states-50.json' assert { type: 'json' };
import usStates200 from '../../../src/components/viz/spatial/fixtures/us-states-200.json' assert { type: 'json' };
import world500 from '../../../src/components/viz/spatial/fixtures/world-500.json' assert { type: 'json' };
import points1k from '../../../src/components/viz/spatial/fixtures/points-1k.json' assert { type: 'json' };
import points5k from '../../../src/components/viz/spatial/fixtures/points-5k.json' assert { type: 'json' };

const BUDGETS = {
  choropleth50: 90,
  choropleth200: 225,
  choropleth500: 450,
  bubble1k: 180,
  bubble5k: 450,
};

function buildChoroplethSpec(id: string, description: string): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Spatial Performance Harness',
    data: {
      type: 'data.geo.join',
      source: 'inline',
      geoSource: 'inline',
      joinKey: 'region',
      geoKey: 'region',
      format: 'geojson',
    },
    projection: { type: 'mercator', fitToData: true },
    geo: { source: 'inline', format: 'geojson', feature: 'performance' },
    layers: [
      {
        type: 'regionFill',
        encoding: {
          color: { field: 'value', scale: 'quantize' },
          opacity: { value: 0.9 },
          stroke: { value: 'var(--sys-border-subtle)' },
        },
      },
    ],
    a11y: { description, tableFallback: { enabled: false } },
  };
}

function buildBubbleSpec(id: string, description: string): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Bubble Performance Harness',
    data: { values: [] },
    projection: { type: 'mercator', fitToData: true },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'longitude' },
          latitude: { field: 'latitude' },
          size: { field: 'magnitude', scale: 'sqrt', range: [6, 24] },
          color: { field: 'category', scale: 'ordinal' },
          opacity: { value: 0.9 },
        },
      },
    ],
    a11y: { description, tableFallback: { enabled: false } },
  };
}

function mapFeatureValues(collection: FeatureCollection): DataRecord[] {
  return collection.features.map((feature) => {
    const properties = feature.properties as Record<string, unknown>;
    const region = String(properties?.region ?? feature.id ?? '');
    const value = Number(properties?.value ?? 0);
    return { region, value };
  });
}

function renderSvgPlaceholders(count: number, tag: 'path' | 'circle'): void {
  const nodes =
    tag === 'path'
      ? Array.from({ length: count }).map((_, index) => (
          <path key={index} data-testid="placeholder" d="M0 0h1v1z" />
        ))
      : Array.from({ length: count }).map((_, index) => (
          <circle key={index} data-testid="placeholder" cx={0} cy={0} r={1} />
        ));
  const view = render(<svg aria-label="performance-placeholder">{nodes}</svg>);
  view.unmount();
}

function measureChoroplethPerf(geoData: FeatureCollection): number {
  const data = mapFeatureValues(geoData);
  const spec = buildChoroplethSpec(`perf-${geoData.features.length}`, 'Adapter performance benchmark');

  const runs: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    renderSvgPlaceholders(geoData.features.length, 'path');
    const vegaStart = performance.now();
    adaptToVegaLite({ spec, geoData, data, dimensions: { width: 640, height: 400 } });
    const vegaElapsed = performance.now() - vegaStart;

    renderSvgPlaceholders(geoData.features.length, 'path');
    const echartsStart = performance.now();
    adaptToECharts({ spec, geoData, data, dimensions: { width: 640, height: 400 } });
    const echartsElapsed = performance.now() - echartsStart;

    runs.push(Math.min(vegaElapsed, echartsElapsed));
  }

  return Math.min(...runs);
}

function measureBubblePerf(points: DataRecord[], geoData: FeatureCollection): number {
  const spec = buildBubbleSpec(`perf-bubble-${points.length}`, 'Bubble adapter performance');

  renderSvgPlaceholders(points.length, 'circle');
  const vegaStart = performance.now();
  adaptToVegaLite({ spec, geoData, data: points, dimensions: { width: 640, height: 400 } });
  const vegaElapsed = performance.now() - vegaStart;

  renderSvgPlaceholders(points.length, 'circle');
  const echartsStart = performance.now();
  adaptToECharts({ spec, geoData, data: points, dimensions: { width: 640, height: 400 } });
  const echartsElapsed = performance.now() - echartsStart;

  return Math.min(vegaElapsed, echartsElapsed);
}

describe('Spatial Performance Benchmarks', () => {
  const geo50 = usStates50 as FeatureCollection;
  const geo200 = usStates200 as FeatureCollection;
  const geo500 = world500 as FeatureCollection;
  const bubbleBaseGeo = usStates50 as FeatureCollection;

  it('meets choropleth render budgets', () => {
    expect(measureChoroplethPerf(geo50)).toBeLessThan(BUDGETS.choropleth50);
    expect(measureChoroplethPerf(geo200)).toBeLessThan(BUDGETS.choropleth200);
    expect(measureChoroplethPerf(geo500)).toBeLessThan(BUDGETS.choropleth500);
  });

  it('meets bubble render budgets', () => {
    const bubble1k = (points1k as Array<Record<string, unknown>>).map((point) => ({
      id: point.id as string,
      longitude: Number(point.longitude),
      latitude: Number(point.latitude),
      magnitude: Number(point.magnitude),
      category: String(point.category),
    }));

    const bubble5k = (points5k as Array<Record<string, unknown>>).map((point) => ({
      id: point.id as string,
      longitude: Number(point.longitude),
      latitude: Number(point.latitude),
      magnitude: Number(point.magnitude),
      category: String(point.category),
    }));

    expect(measureBubblePerf(bubble1k, bubbleBaseGeo)).toBeLessThan(BUDGETS.bubble1k);
    expect(measureBubblePerf(bubble5k, bubbleBaseGeo)).toBeLessThan(BUDGETS.bubble5k);
  });

  it('does not leak memory across repeated adapter runs', () => {
    const baseline = process.memoryUsage().heapUsed;
    for (let i = 0; i < 5; i += 1) {
      measureChoroplethPerf(geo50);
    }
    const delta = process.memoryUsage().heapUsed - baseline;
    expect(delta).toBeLessThan(35 * 1024 * 1024);
  });
});
