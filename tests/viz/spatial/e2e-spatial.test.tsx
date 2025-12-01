/* @vitest-environment jsdom */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Feature, FeatureCollection } from 'geojson';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer.js';
import { ChoroplethMap } from '@/components/viz/spatial/ChoroplethMap.js';
import { BubbleMap } from '@/components/viz/spatial/BubbleMap.js';
import { AccessibleMapFallback } from '@/components/viz/spatial/AccessibleMapFallback.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';
import type { DataRecord } from '@/viz/adapters/spatial/geo-data-joiner.js';
import usStates50 from '../../../src/components/viz/spatial/fixtures/us-states-50.json' assert { type: 'json' };
import points1k from '../../../src/components/viz/spatial/fixtures/points-1k.json' assert { type: 'json' };

function buildChoroplethSpec(id: string, description: string, data: DataRecord[]): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Choropleth E2E Harness',
    data: {
      type: 'data.geo.join',
      source: 'inline',
      geoSource: 'inline',
      joinKey: 'region',
      geoKey: 'region',
      format: 'geojson',
      values: data,
    },
    projection: { type: 'mercator', fitToData: true },
    geo: { source: 'inline', format: 'geojson' },
    layers: [
      {
        type: 'regionFill',
        encoding: {
          color: { field: 'value', scale: 'quantize', range: ['var(--oods-viz-scale-sequential-02)', 'var(--oods-viz-scale-sequential-06)'] },
          stroke: { value: 'var(--sys-border-subtle)' },
          opacity: { value: 0.9 },
        },
      },
    ],
    a11y: {
      description,
      tableFallback: { enabled: true, caption: 'Spatial table fallback' },
    },
  };
}

function buildBubbleSpec(id: string, description: string, data: DataRecord[]): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Bubble E2E Harness',
    data: { values: data },
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
    a11y: {
      description,
      tableFallback: { enabled: false },
    },
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

describe('Spatial E2E flows', () => {
  const geo = usStates50 as FeatureCollection;
  const geoSlice: FeatureCollection = {
    type: 'FeatureCollection',
    features: geo.features.slice(0, 6),
  };
  const choroplethData = mapFeatureValues(geoSlice);
  const bubbleData = (points1k as Array<Record<string, unknown>>).slice(0, 40).map((point) => ({
    id: point.id as string,
    longitude: Number(point.longitude),
    latitude: Number(point.latitude),
    magnitude: Number(point.magnitude),
    category: String(point.category),
  }));

  it('renders choropleth regions and propagates hover/click events', async () => {
    const onRegionClick = vi.fn();
    const onRegionHover = vi.fn();
    const spec = buildChoroplethSpec('e2e-choropleth', 'E2E choropleth render', choroplethData);

    const view = render(
      <SpatialContainer
        spec={spec}
        geoData={geoSlice}
        data={choroplethData}
        width={820}
        height={520}
        a11y={{ description: 'Choropleth E2E container', tableFallback: spec.a11y.tableFallback }}
      >
        <ChoroplethMap
          data={choroplethData}
          valueField="value"
          geoJoinKey="region"
          a11y={{ description: 'Choropleth map with hover/click handlers' }}
          onRegionClick={onRegionClick}
          onRegionHover={onRegionHover}
        />
      </SpatialContainer>
    );

    await waitFor(() => expect(view.container.querySelectorAll('path').length).toBe(geoSlice.features.length));
    const regions = view.container.querySelectorAll('path');
    expect(regions.length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.hover(regions[0]);
    await user.click(regions[0]);

    expect(onRegionHover).toHaveBeenCalled();
    expect(onRegionClick).toHaveBeenCalled();
    const [[hoverFeature]] = onRegionHover.mock.calls as Array<[Feature, DataRecord | null]>;
    expect(hoverFeature.id).toBe(geoSlice.features[0].id);
  });

  it('renders bubble map points and handles hover/click', async () => {
    const onPointClick = vi.fn();
    const onPointHover = vi.fn();
    const spec = buildBubbleSpec('e2e-bubble', 'E2E bubble render', bubbleData);

    const view = render(
      <SpatialContainer
        spec={spec}
        geoData={geoSlice}
        data={bubbleData}
        width={820}
        height={520}
        a11y={{ description: 'Bubble E2E container' }}
      >
        <BubbleMap
          data={bubbleData}
          longitudeField="longitude"
          latitudeField="latitude"
          sizeField="magnitude"
          colorField="category"
          a11y={{ description: 'Bubble map with point handlers' }}
          onPointClick={onPointClick}
          onPointHover={onPointHover}
        />
      </SpatialContainer>
    );

    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-testid=\"bubble-point\"]').length).toBeGreaterThan(0)
    );
    const points = view.container.querySelectorAll('[data-testid=\"bubble-point\"]');
    const user = userEvent.setup();
    await user.hover(points[0]);
    await user.click(points[0]);

    expect(onPointHover).toHaveBeenCalled();
    expect(onPointClick).toHaveBeenCalled();
  });

  it('surfaces table fallback and cross-filter callback from container', async () => {
    const onFeatureClick = vi.fn();
    const spec = buildChoroplethSpec('e2e-table', 'Table fallback render', choroplethData);

    const view = render(
      <SpatialContainer
        spec={spec}
        geoData={geoSlice}
        data={choroplethData}
        width={760}
        height={480}
        a11y={{ description: spec.a11y.description, tableFallback: spec.a11y.tableFallback }}
        onFeatureClick={onFeatureClick}
      >
        <ChoroplethMap
          data={choroplethData}
          valueField="value"
          geoJoinKey="region"
          a11y={{ description: 'Choropleth map with table fallback' }}
        />
        <AccessibleMapFallback
          data={choroplethData}
          features={geoSlice.features}
          joinedData={new Map(choroplethData.map((datum) => [datum.region, datum]))}
          alwaysVisible
          table={{
            caption: 'Spatial accessibility table',
            columns: [
              { field: 'region', label: 'Region' },
              { field: 'value', label: 'Value' },
            ],
          }}
        />
      </SpatialContainer>
    );

    await waitFor(() => expect(view.getByRole('table')).toBeInTheDocument());
    expect(view.getByText('Spatial accessibility table')).toBeInTheDocument();
    const user = userEvent.setup();
    const app = await view.findByRole('application');
    await user.click(app);
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    await waitFor(() => expect(app.dataset.selectedFeature).toBeTruthy());
    expect(onFeatureClick).toHaveBeenCalled();
  });
});
