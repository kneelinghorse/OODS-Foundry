/* @vitest-environment jsdom */

/**
 * Accessibility tests for BubbleMap component.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import * as d3Geo from 'd3-geo';
import { BubbleMap } from '../../../../src/components/viz/spatial/BubbleMap.js';
import { SpatialContextProvider } from '../../../../src/components/viz/spatial/SpatialContext.js';
import type { DataRecord } from '../../../../src/viz/adapters/spatial/geo-data-joiner.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';

expect.extend({ toHaveNoViolations });

const mockSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/spatial/v1',
  type: 'spatial',
  data: { values: [] },
  projection: { type: 'mercator' },
  layers: [],
  a11y: { description: 'A11y bubble map' },
};

const projection = d3Geo.geoMercator().scale(120).translate([400, 300]);

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SpatialContextProvider
      value={{
        projection: { type: 'mercator' },
        dimensions: { width: 800, height: 600 },
        layers: [],
        a11y: { description: 'A11y map' },
        features: [],
        joinedData: new Map(),
        project: (lon: number, lat: number) => projection([lon, lat]),
        projectionInstance: projection,
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

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('BubbleMap accessibility', () => {
  const data: DataRecord[] = [
    { city: 'A', lon: -100, lat: 40, value: 10 },
    { city: 'B', lon: -90, lat: 35, value: 20 },
  ];

  it('has no axe violations', async () => {
    const { container } = render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        sizeField="value"
        a11y={{ description: 'Accessible bubble map' }}
      />,
      { wrapper: Wrapper }
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders focusable points with descriptive labels', () => {
    const { container } = render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        sizeField="value"
        colorField="value"
        a11y={{ description: 'Focusable bubbles' }}
      />,
      { wrapper: Wrapper }
    );

    const circles = container.querySelectorAll('[data-testid="bubble-point"]');
    expect(circles.length).toBeGreaterThan(0);
    circles.forEach((circle) => {
      expect(circle.getAttribute('tabindex')).toBe('0');
      const ariaLabel = circle.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Point at/);
    });
  });

  it('supports keyboard interaction', () => {
    const handleClick = vi.fn();

    const { container } = render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        a11y={{ description: 'Keyboard test' }}
        onPointClick={handleClick}
      />,
      { wrapper: Wrapper }
    );

    const circle = container.querySelector('[data-testid="bubble-point"]');
    expect(circle).toBeTruthy();

    if (circle) {
      fireEvent.keyDown(circle, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });
});
