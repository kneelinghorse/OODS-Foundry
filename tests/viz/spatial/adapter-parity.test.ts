/* @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { adaptToECharts } from '@/viz/adapters/spatial/echarts-spatial-adapter.js';
import { adaptToVegaLite } from '@/viz/adapters/spatial/vega-lite-spatial-adapter.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';
import usStates50 from '../../../src/components/viz/spatial/fixtures/us-states-50.json' assert { type: 'json' };
import worldRegions from '../../../src/components/viz/spatial/fixtures/world-500.json' assert { type: 'json' };
import bubblePoints from '../../../src/components/viz/spatial/fixtures/points-1k.json' assert { type: 'json' };

function buildChoroplethSpec(id: string, description: string): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Choropleth Parity Harness',
    data: {
      type: 'data.geo.join',
      source: 'inline',
      geoSource: 'inline',
      joinKey: 'region',
      geoKey: 'region',
      format: 'geojson',
    },
    projection: { type: 'mercator', fitToData: true },
    geo: { source: 'inline', format: 'geojson', feature: 'choropleth' },
    layers: [
      {
        type: 'regionFill',
        encoding: {
          color: {
            field: 'value',
            scale: 'quantize',
            range: [
              'var(--oods-viz-scale-sequential-02)',
              'var(--oods-viz-scale-sequential-04)',
              'var(--oods-viz-scale-sequential-06)',
              'var(--oods-viz-scale-sequential-08)',
            ],
            nullValue: 'var(--sys-surface-strong)',
          },
          opacity: { value: 0.9 },
          stroke: { value: 'var(--sys-border-subtle)' },
          strokeWidth: { value: 0.8 },
        },
        zIndex: 10,
      },
    ],
    a11y: {
      description,
      tableFallback: { enabled: true, caption: 'Choropleth parity data' },
    },
  };
}

function buildBubbleSpec(id: string, description: string): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Bubble Parity Harness',
    data: { values: [] },
    projection: { type: 'mercator', fitToData: true },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'longitude' },
          latitude: { field: 'latitude' },
          size: { field: 'magnitude', scale: 'sqrt', range: [6, 28] },
          color: {
            field: 'category',
            scale: 'ordinal',
            range: [
              'var(--oods-viz-categorical-01)',
              'var(--oods-viz-categorical-02)',
              'var(--oods-viz-categorical-03)',
              'var(--oods-viz-categorical-04)',
            ],
            domain: ['alpha', 'beta', 'gamma', 'delta'],
          },
          opacity: { value: 0.85 },
        },
        zIndex: 5,
      },
    ],
    a11y: {
      description,
      tableFallback: { enabled: true, caption: 'Bubble parity data' },
    },
  };
}

function mapFeatureValues(collection: FeatureCollection): Array<{ region: string; value: number }> {
  return collection.features.map((feature) => {
    const properties = feature.properties as Record<string, unknown>;
    const region = String(properties?.region ?? feature.id ?? '');
    const value = Number(properties?.value ?? 0);
    return { region, value };
  });
}

describe('Spatial Adapter Parity', () => {
  const choroplethGeo = usStates50 as FeatureCollection;
  const bubbleGeo = worldRegions as FeatureCollection;

  it('aligns choropleth adapter output between Vega-Lite and ECharts', () => {
    const data = mapFeatureValues(choroplethGeo);
    const spec = buildChoroplethSpec('parity-choropleth', 'Parity check for choropleth adapters');

    const vegaResult = adaptToVegaLite({
      spec,
      geoData: choroplethGeo,
      data,
      dimensions: { width: 720, height: 480 },
    });
    const echartsResult = adaptToECharts({
      spec,
      geoData: choroplethGeo,
      data,
      dimensions: { width: 720, height: 480 },
    });

    const vegaLayer = Array.isArray(vegaResult.vegaLiteSpec.layer)
      ? vegaResult.vegaLiteSpec.layer[0]
      : undefined;
    const echartsSeries = Array.isArray(echartsResult.echartsOption.series)
      ? echartsResult.echartsOption.series[0]
      : undefined;

    expect(vegaLayer?.mark).toBeDefined();
    expect((vegaLayer?.mark as Record<string, unknown>)?.type).toBe('geoshape');
    expect(vegaLayer?.encoding?.color).toBeDefined();
    expect((vegaLayer?.data as { values?: FeatureCollection } | undefined)?.values?.features).toHaveLength(
      choroplethGeo.features.length
    );

    expect(echartsSeries).toBeDefined();
    expect((echartsSeries as { type?: string } | undefined)?.type).toBe('map');
    expect((echartsSeries as { data?: unknown[] } | undefined)?.data?.length).toBe(data.length);
    expect(echartsResult.echartsOption.tooltip?.trigger).toBe('item');

    expect(vegaResult.vegaLiteSpec.usermeta?.oods?.specId).toBe(spec.id);
    expect((echartsResult.echartsOption as Record<string, any>).usermeta?.oods?.specId).toBe(spec.id);
    expect(vegaResult.vegaLiteSpec.description).toContain('Parity');
    expect(echartsResult.echartsOption.aria?.enabled).toBe(true);
  });

  it('aligns bubble adapter output across renderers', () => {
    const bubbleData = (bubblePoints as Array<Record<string, unknown>>).slice(0, 250).map((point) => ({
      id: point.id as string,
      longitude: Number(point.longitude),
      latitude: Number(point.latitude),
      magnitude: Number(point.magnitude),
      category: String(point.category),
    }));
    const spec = buildBubbleSpec('parity-bubble', 'Parity check for bubble adapters');

    const vegaResult = adaptToVegaLite({
      spec,
      geoData: bubbleGeo,
      data: bubbleData,
      dimensions: { width: 720, height: 480 },
    });
    const echartsResult = adaptToECharts({
      spec,
      geoData: bubbleGeo,
      data: bubbleData,
      dimensions: { width: 720, height: 480 },
    });

    const vegaLayers = vegaResult.vegaLiteSpec.layer ?? [];
    const symbolLayer = vegaLayers[vegaLayers.length - 1];
    const echartsSeries = Array.isArray(echartsResult.echartsOption.series)
      ? echartsResult.echartsOption.series[0]
      : undefined;

    expect(vegaLayers.length).toBeGreaterThanOrEqual(1);
    expect((symbolLayer?.mark as Record<string, unknown> | undefined)?.type).toBe('circle');
    expect(symbolLayer?.encoding?.longitude).toBeDefined();
    expect(symbolLayer?.encoding?.latitude).toBeDefined();
    expect(symbolLayer?.encoding?.tooltip).toBeDefined();

    expect((echartsSeries as { type?: string } | undefined)?.type).toBe('scatter');
    expect((echartsSeries as { data?: unknown[] } | undefined)?.data?.length).toBe(bubbleData.length);
    expect(echartsResult.echartsOption.tooltip?.trigger).toBe('item');
    expect((echartsResult.echartsOption as Record<string, any>).__registration).toBeDefined();

    expect(vegaResult.vegaLiteSpec.usermeta?.oods?.name).toBe(spec.name);
    expect((echartsResult.echartsOption as Record<string, any>).usermeta?.oods?.name).toBe(spec.name);
  });
});
