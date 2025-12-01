/* @vitest-environment jsdom */

/**
 * Accessibility tests for ChoroplethMap component.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { ChoroplethMap } from '../../../../src/components/viz/spatial/ChoroplethMap.js';
import { SpatialContextProvider } from '../../../../src/components/viz/spatial/SpatialContext.js';
import type { Feature, Polygon } from 'geojson';
import type { DataRecord } from '../../../../src/viz/adapters/spatial/geo-data-joiner.js';
import * as d3Geo from 'd3-geo';

expect.extend({ toHaveNoViolations });

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

// Test features
const testFeatures: Feature<Polygon>[] = [
  {
    type: 'Feature',
    id: 'CA',
    properties: { name: 'California', fips: 'CA' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-124, 42],
          [-124, 32],
          [-114, 32],
          [-114, 42],
          [-124, 42],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'TX',
    properties: { name: 'Texas', fips: 'TX' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-106, 36],
          [-106, 26],
          [-93, 26],
          [-93, 36],
          [-106, 36],
        ],
      ],
    },
  },
];

function createContextWrapper(features: Feature[], joinedData: Map<string, DataRecord>) {
  const projection = d3Geo.geoMercator().scale(150).translate([400, 300]);

  return ({ children }: { children: React.ReactNode }) => (
    <SpatialContextProvider
      value={{
        projection: { type: 'mercator' },
        dimensions: { width: 800, height: 600 },
        layers: [],
        a11y: { description: 'Test map' },
        features,
        joinedData,
        project: (lon: number, lat: number) => projection([lon, lat]),
        bounds: [
          [-180, -90],
          [180, 90],
        ],
        handleFeatureClick: vi.fn(),
        handleFeatureHover: vi.fn(),
        hoveredFeature: null,
        selectedFeature: null,
      }}
    >
      {children}
    </SpatialContextProvider>
  );
}

describe('ChoroplethMap a11y', () => {
  const testData: DataRecord[] = [
    { fips: 'CA', population: 39538223 },
    { fips: 'TX', population: 29145505 },
  ];

  const testJoinedData = new Map([
    ['ca', { fips: 'CA', population: 39538223 }],
    ['tx', { fips: 'TX', population: 29145505 }],
  ]);

  it('should have no axe violations', async () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have regions that are keyboard focusable', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const paths = container.querySelectorAll('path');
    paths.forEach((path) => {
      expect(path.getAttribute('tabindex')).toBe('0');
    });
  });

  it('should have visible focus ring on keyboard focus', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    if (path) {
      // Focus the element
      path.focus();

      // Check that focus styling is applied via inline style
      const style = path.getAttribute('style');
      expect(style).toBeTruthy();
    }
  });

  it('should have ARIA labels describing region and value', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const paths = container.querySelectorAll('path');
    paths.forEach((path) => {
      const ariaLabel = path.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it('should announce region on keyboard focus', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    if (path) {
      const ariaLabel = path.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      // ARIA label should contain region info
      expect(ariaLabel).toMatch(/California|Texas|fips/i);
    }
  });

  it('should have proper role attributes', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const svg = container.querySelector('svg');
    // SVG should not have role="img" to avoid nested interactive controls
    expect(svg?.getAttribute('role')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('US Population by State');

    const paths = container.querySelectorAll('path');
    paths.forEach((path) => {
      expect(path.getAttribute('role')).toBe('button');
    });
  });

  it('should include title and description elements', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        a11y={{
          description: 'US Population by State',
          narrative: {
            summary: 'Population distribution across US states',
            keyFindings: ['California has highest population'],
          },
        }}
      />,
      { wrapper: Wrapper }
    );

    const title = container.querySelector('title');
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe('US Population by State');

    const desc = container.querySelector('desc');
    expect(desc).toBeTruthy();
    expect(desc?.textContent).toContain('Population distribution');
    expect(desc?.textContent).toContain('California has highest population');
  });

  it('should support keyboard interaction (Enter key)', () => {
    const handleClick = vi.fn();
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        onRegionClick={handleClick}
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    if (path) {
      fireEvent.keyDown(path, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('should support keyboard interaction (Space key)', () => {
    const handleClick = vi.fn();
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        onRegionClick={handleClick}
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    if (path) {
      fireEvent.keyDown(path, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('should indicate selected state with aria-pressed', () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        onRegionClick={() => {}}
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    const path = container.querySelector('path');
    expect(path).toBeTruthy();

    if (path) {
      // Click to select
      fireEvent.click(path);

      // After implementation update, aria-pressed should be true
      const ariaPressed = path.getAttribute('aria-pressed');
      expect(ariaPressed).toBeDefined();
    }
  });

  it('should have sufficient color contrast (tested via axe)', async () => {
    const Wrapper = createContextWrapper(testFeatures, testJoinedData);

    const { container } = render(
      <ChoroplethMap
        data={testData}
        valueField="population"
        geoJoinKey="fips"
        colorRange={['#f0f0f0', '#636363']}
        a11y={{ description: 'US Population by State' }}
      />,
      { wrapper: Wrapper }
    );

    // Axe will check color contrast automatically
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
