/* @vitest-environment jsdom */

/**
 * Accessibility tests for SpatialContainer component.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

expect.extend({ toHaveNoViolations });
import { SpatialContainer } from '../../../../src/components/viz/spatial/SpatialContainer.js';
import type { SpatialSpec } from '../../../../src/types/viz/spatial.js';
import type { FeatureCollection, Point } from 'geojson';
import * as d3Geo from 'd3-geo';

// Mock the hooks
vi.mock('../../../../src/viz/hooks/useSpatialSpec.js', () => ({
  useSpatialSpec: () => ({
    isLoading: false,
    error: null,
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-100, 40] },
        properties: { name: 'Test Point' },
        id: '1',
      },
    ],
    joinedData: new Map([['1', { value: 100 }]]),
    projectionConfig: { type: 'mercator' },
    layerConfigs: [],
  }),
}));

vi.mock('../../../../src/viz/hooks/useSpatialProjection.js', () => ({
  useSpatialProjection: () => ({
    project: (lon: number, lat: number) => [lon * 10, lat * 10] as [number, number],
    fitToFeatures: () => ({ type: 'mercator' }),
    projection: d3Geo.geoMercator(),
    bounds: [
      [-180, -90],
      [180, 90],
    ] as [[number, number], [number, number]],
  }),
}));

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('SpatialContainer a11y', () => {
  const mockSpec: SpatialSpec = {
    type: 'spatial',
    name: 'Test Map',
    data: { values: [] },
    projection: { type: 'mercator' },
    layers: [
      {
        type: 'regionFill',
        encoding: { color: { field: 'value' } },
      },
    ],
    a11y: {
      description: 'Test spatial visualization showing geographic data',
      ariaLabel: 'Test Map',
    },
  };

  const mockGeoData: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-100, 40],
        },
        properties: { name: 'Test Point' },
      },
    ],
  };

  it('should have no axe violations', async () => {
    const { container } = render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    const application = container.querySelector('[role="application"]');
    expect(application).toBeDefined();
    expect(application?.getAttribute('aria-label')).toBeTruthy();
    expect(application?.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('should be keyboard navigable', () => {
    const { container } = render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    const application = container.querySelector('[role="application"]');
    expect(application?.getAttribute('tabindex')).toBe('0');
  });

  it('should provide screen reader description', () => {
    const { container } = render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{
          description: 'Test map description',
          narrative: {
            summary: 'This map shows test data',
            keyFindings: ['Finding 1', 'Finding 2'],
          },
        }}
      />
    );

    const description = container.querySelector('[id*="description"]');
    expect(description).toBeDefined();
    expect(description?.textContent).toContain('Test map description');
  });

  it('should render table fallback with proper structure', () => {
    const { container } = render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{
          description: 'Test map',
          tableFallback: { enabled: true, caption: 'Data Table' },
        }}
        data={[{ value: 100 }]}
      />
    );

    const table = container.querySelector('table');
    expect(table).toBeDefined();
    const caption = table?.querySelector('caption');
    expect(caption?.textContent).toContain('Data Table');
  });

  it('should announce keyboard navigation changes', () => {
    const { container } = render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    const application = container.querySelector('[role="application"]');
    expect(application).toBeDefined();
    if (application) {
      fireEvent.keyDown(application, { key: 'ArrowRight' });
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
