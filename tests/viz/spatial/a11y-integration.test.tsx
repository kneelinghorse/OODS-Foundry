/* @vitest-environment jsdom */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import type { FeatureCollection } from 'geojson';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer.js';
import { ChoroplethMap } from '@/components/viz/spatial/ChoroplethMap.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';
import type { DataRecord } from '@/viz/adapters/spatial/geo-data-joiner.js';
import usStates50 from '../../../src/components/viz/spatial/fixtures/us-states-50.json' assert { type: 'json' };

expect.extend({ toHaveNoViolations });

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as unknown as CanvasRenderingContext2D);
});

function buildSpec(id: string, description: string, data: DataRecord[]): SpatialSpec {
  return {
    type: 'spatial',
    id,
    name: 'Spatial A11y Harness',
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
          opacity: { value: 0.95 },
        },
      },
    ],
    a11y: {
      description,
      tableFallback: { enabled: true, caption: 'Spatial accessibility table' },
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

describe('Spatial accessibility integration', () => {
  const geo = usStates50 as FeatureCollection;
  const geoSlice: FeatureCollection = { type: 'FeatureCollection', features: geo.features.slice(0, 5) };
  const data = mapFeatureValues(geoSlice);

  it('cycles keyboard focus and announces active feature', async () => {
    const spec = buildSpec('a11y-cycle', 'Keyboard navigation integration', data);

    const view = render(
      <SpatialContainer
        spec={spec}
        geoData={geoSlice}
        data={data}
        width={720}
        height={480}
        a11y={{ description: spec.a11y.description, tableFallback: spec.a11y.tableFallback }}
      >
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="region"
          a11y={{ description: 'Keyboard navigable choropleth' }}
        />
      </SpatialContainer>
    );

    const app = await view.findByRole('application');
    await waitFor(() => expect(view.container.querySelectorAll('path').length).toBe(geoSlice.features.length));
    const user = userEvent.setup();
    app.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(app.dataset.activeFeature).toBeTruthy());
    await user.keyboard(' ');
    await waitFor(() => expect(app.dataset.selectedFeature).toBeTruthy());

    await waitFor(() => {
      const liveRegion = document.querySelector('[data-spatial-live-region=\"polite\"]');
      expect(liveRegion?.textContent ?? '').not.toBe('');
    });
  });

  it('exposes accessible table fallback with headers', async () => {
    const spec = buildSpec('a11y-table', 'Accessible table fallback', data);

    const { container, getByRole, getByText } = render(
      <SpatialContainer
        spec={spec}
        geoData={geoSlice}
        data={data}
        width={720}
        height={480}
        a11y={{ description: spec.a11y.description, tableFallback: spec.a11y.tableFallback }}
      >
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="region"
          a11y={{ description: 'Choropleth with table fallback' }}
        />
      </SpatialContainer>
    );

    await waitFor(() => expect(container.querySelectorAll('path').length).toBe(geoSlice.features.length));
    const table = getByRole('table');
    expect(getByText('Spatial accessibility table')).toBeInTheDocument();
    expect(table.querySelectorAll('th').length).toBeGreaterThan(0);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('keeps live region updates stable across navigation resets', async () => {
    const spec = buildSpec('a11y-live', 'Live region stability', data);
    const view = render(
      <SpatialContainer
        spec={spec}
        geoData={geoSlice}
        data={data}
        width={640}
        height={420}
        a11y={{ description: spec.a11y.description, tableFallback: spec.a11y.tableFallback }}
      >
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="region"
          a11y={{ description: 'Choropleth with live region updates' }}
        />
      </SpatialContainer>
    );

    const app = await view.findByRole('application');
    await waitFor(() => expect(view.container.querySelectorAll('path').length).toBe(geoSlice.features.length));
    const user = userEvent.setup();
    app.focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      const liveRegion = document.querySelector('[data-spatial-live-region=\"polite\"]');
      const text = liveRegion?.textContent ?? '';
      expect(text === '' ? '' : text).toMatch(/Focus|Selection/);
    });
  });
});
