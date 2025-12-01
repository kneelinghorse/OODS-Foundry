/**
 * Tests for BubbleMap component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as d3Geo from 'd3-geo';
import { BubbleMap } from '../../../../src/components/viz/spatial/BubbleMap.js';
import { SpatialContextProvider } from '../../../../src/components/viz/spatial/SpatialContext.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import type { DataRecord } from '../../../../src/viz/adapters/spatial/geo-data-joiner.js';

const mockSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/spatial/v1',
  type: 'spatial',
  data: { values: [] },
  projection: { type: 'mercator' },
  layers: [],
  a11y: { description: 'Test bubble map' },
};

function createWrapper(projection = d3Geo.geoMercator().scale(120).translate([400, 300])) {
  return ({ children }: { children: React.ReactNode }) => (
    <SpatialContextProvider
      value={{
        projection: { type: 'mercator' },
        dimensions: { width: 800, height: 600 },
        layers: [],
        a11y: { description: 'Test map' },
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

describe('BubbleMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('projects points to expected coordinates', () => {
    const projection = d3Geo.geoMercator().scale(150).translate([400, 300]);
    const Wrapper = createWrapper(projection);

    const data: DataRecord[] = [
      { city: 'A', lon: -122.4194, lat: 37.7749 },
      { city: 'B', lon: -74.006, lat: 40.7128 },
    ];

    render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        a11y={{ description: 'Cities' }}
      />,
      { wrapper: Wrapper }
    );

    const circles = screen.getAllByTestId('bubble-point');
    expect(circles).toHaveLength(2);

    const [sfX, sfY] = projection([-122.4194, 37.7749]) ?? [0, 0];
    const [nyX, nyY] = projection([-74.006, 40.7128]) ?? [0, 0];

    expect(Number(circles[0].getAttribute('cx'))).toBeCloseTo(sfX);
    expect(Number(circles[0].getAttribute('cy'))).toBeCloseTo(sfY);
    expect(Number(circles[1].getAttribute('cx'))).toBeCloseTo(nyX);
    expect(Number(circles[1].getAttribute('cy'))).toBeCloseTo(nyY);
  });

  it('applies size encoding with sqrt scale', () => {
    const projection = d3Geo.geoMercator().scale(120).translate([400, 300]);
    const Wrapper = createWrapper(projection);

    const data: DataRecord[] = [
      { city: 'Small', lon: -100, lat: 40, value: 10 },
      { city: 'Large', lon: -90, lat: 35, value: 90 },
    ];

    render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        sizeField="value"
        sizeRange={[4, 16]}
        sizeScale="sqrt"
        a11y={{ description: 'Sized points' }}
      />,
      { wrapper: Wrapper }
    );

    const circles = screen.getAllByTestId('bubble-point');
    expect(circles).toHaveLength(2);

    const smallRadius = Number(circles[0].getAttribute('r'));
    const largeRadius = Number(circles[1].getAttribute('r'));
    expect(largeRadius).toBeGreaterThan(smallRadius);
    expect(largeRadius).toBeLessThanOrEqual(16);
    expect(smallRadius).toBeGreaterThanOrEqual(4);
  });

  it('applies categorical color encoding', () => {
    const Wrapper = createWrapper();
    const data: DataRecord[] = [
      { city: 'A', lon: -80, lat: 35, category: 'alpha' },
      { city: 'B', lon: -81, lat: 36, category: 'beta' },
    ];

    render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        colorField="category"
        colorType="categorical"
        colorRange={['#111111', '#222222']}
        a11y={{ description: 'Colored points' }}
      />,
      { wrapper: Wrapper }
    );

    const circles = screen.getAllByTestId('bubble-point');
    expect(circles[0].getAttribute('fill')).toBe('#111111');
    expect(circles[1].getAttribute('fill')).toBe('#222222');
  });

  it('fires hover and click handlers', () => {
    const Wrapper = createWrapper();
    const handleHover = vi.fn();
    const handleClick = vi.fn();
    const data: DataRecord[] = [{ city: 'Only', lon: -100, lat: 45 }];

    render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        onPointHover={handleHover}
        onPointClick={handleClick}
        a11y={{ description: 'Interactive points' }}
      />,
      { wrapper: Wrapper }
    );

    const circle = screen.getByTestId('bubble-point');
    fireEvent.mouseEnter(circle);
    fireEvent.click(circle);

    expect(handleHover).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({ city: 'Only' }));
  });

  it('omits points with invalid coordinates', () => {
    const Wrapper = createWrapper();
    const data: DataRecord[] = [
      { city: 'Valid', lon: -100, lat: 40 },
      { city: 'MissingLat', lon: -90 },
      { city: 'MissingLon', lat: 50 },
    ];

    render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        a11y={{ description: 'Validation' }}
      />,
      { wrapper: Wrapper }
    );

    const circles = screen.getAllByTestId('bubble-point');
    expect(circles).toHaveLength(1);
  });

  it('renders clusters when enabled', () => {
    const projection = d3Geo.geoMercator().scale(200).translate([300, 200]);
    const Wrapper = createWrapper(projection);
    const handleClusterClick = vi.fn();
    const data: DataRecord[] = [
      { id: 1, lon: -100, lat: 40 },
      { id: 2, lon: -101, lat: 40.5 },
      { id: 3, lon: 20, lat: 10 },
    ];

    render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        cluster={{ enabled: true, radius: 15, minPoints: 2 }}
        onClusterClick={(points) => handleClusterClick(points.map((point) => point.id))}
        a11y={{ description: 'Clustered points' }}
      />,
      { wrapper: Wrapper }
    );

    const clusters = screen.getAllByTestId('bubble-cluster');
    expect(clusters.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(clusters[0]);
    expect(handleClusterClick).toHaveBeenCalled();
  });
});
