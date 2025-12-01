/**
 * Tests for SpatialContainer component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SpatialContainer } from '../../../../src/components/viz/spatial/SpatialContainer.js';
import { useSpatialContext } from '../../../../src/components/viz/spatial/SpatialContext.js';
import type { SpatialSpec } from '../../../../src/types/viz/spatial.js';
import type { FeatureCollection, Point } from 'geojson';
import * as d3Geo from 'd3-geo';

// Mock the hooks
const mockUseSpatialSpec = vi.fn(() => ({
  isLoading: false,
  error: null,
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-100, 40] },
      properties: { name: 'Test' },
      id: '1',
    },
  ],
  joinedData: new Map(),
  projectionConfig: { type: 'mercator' },
  layerConfigs: [
    {
      type: 'regionFill',
      encoding: { color: { field: 'value' } },
    },
  ],
}));

vi.mock('../../../../src/viz/hooks/useSpatialSpec.js', () => ({
  useSpatialSpec: () => mockUseSpatialSpec(),
}));

vi.mock('../../../../src/viz/hooks/useSpatialProjection.js', () => ({
  useSpatialProjection: vi.fn(() => ({
    project: (lon: number, lat: number) => [lon * 10, lat * 10] as [number, number],
    fitToFeatures: () => ({ type: 'mercator' }),
    projection: d3Geo.geoMercator(),
    bounds: [
      [-180, -90],
      [180, 90],
    ] as [[number, number], [number, number]],
  })),
}));

function ContextProbe(): JSX.Element {
  const context = useSpatialContext();
  return (
    <div
      data-testid="context-probe"
      data-projection={context.projection.type}
      data-layer-count={context.layers.length}
      data-feature-count={context.features.length}
    />
  );
}

describe('SpatialContainer', () => {
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
      description: 'Test spatial visualization',
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    expect(screen.getByRole('application')).toBeDefined();
  });

  it('should render loading state', () => {
    mockUseSpatialSpec.mockReturnValueOnce({
      isLoading: true,
      error: null,
      features: [],
      joinedData: new Map(),
      projectionConfig: { type: 'mercator' },
      layerConfigs: [],
    });

    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    expect(screen.getByText(/Loading map data/i)).toBeDefined();
  });

  it('should render error state', () => {
    mockUseSpatialSpec.mockReturnValueOnce({
      isLoading: false,
      error: new Error('Test error'),
      features: [],
      joinedData: new Map(),
      projectionConfig: { type: 'mercator' },
      layerConfigs: [],
    });

    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      />
    );

    expect(screen.getByText(/Error:/i)).toBeDefined();
  });

  it('should render children', () => {
    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      >
        <div data-testid="child">Child content</div>
      </SpatialContainer>
    );

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('should provide context values to children', async () => {
    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
      >
        <ContextProbe />
      </SpatialContainer>
    );

    const probe = await screen.findByTestId('context-probe');
    expect(probe.getAttribute('data-projection')).toBe('mercator');
    expect(probe.getAttribute('data-layer-count')).toBe('1');
    expect(probe.getAttribute('data-feature-count')).toBe('1');
  });

  it('should render table fallback when enabled', async () => {
    mockUseSpatialSpec.mockReturnValueOnce({
      isLoading: false,
      error: null,
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-100, 40] },
          properties: { name: 'Test' },
          id: '1',
        },
      ] as any[],
      joinedData: new Map([['1', { value: 100 }]]),
      projectionConfig: { type: 'mercator' },
      layerConfigs: [],
    });

    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{
          description: 'Test map',
          tableFallback: { enabled: true, caption: 'Test Table' },
        }}
        data={[{ value: 100 }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Table')).toBeDefined();
    });
  });

  it('should call onFeatureClick when feature is clicked', () => {
    const handleClick = vi.fn();

    render(
      <SpatialContainer
        spec={mockSpec}
        geoData={mockGeoData}
        width={800}
        height={600}
        a11y={{ description: 'Test map' }}
        onFeatureClick={handleClick}
      />
    );

    const application = screen.getByRole('application');
    fireEvent.keyDown(application, { key: 'ArrowRight' });
    fireEvent.keyDown(application, { key: 'Enter' });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
