/* @vitest-environment jsdom */

/**
 * Tests for ChoroplethMap component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoroplethMap } from '../../../../src/components/viz/spatial/ChoroplethMap.js';
import { SpatialContextProvider } from '../../../../src/components/viz/spatial/SpatialContext.js';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { DataRecord } from '../../../../src/viz/adapters/spatial/geo-data-joiner.js';
import * as d3Geo from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import * as projectionUtils from '../../../../src/components/viz/spatial/utils/projection-utils.js';

const mockVegaEmbed = vi.fn(async () => ({
  view: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    finalize: vi.fn(),
  },
}));

const mockEchartsInstance = {
  setOption: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const mockEchartsInit = vi.fn(() => mockEchartsInstance);
const mockRegisterMap = vi.fn();

vi.mock('vega-embed', () => ({
  __esModule: true,
  default: mockVegaEmbed,
}));

vi.mock('echarts', () => ({
  __esModule: true,
  init: mockEchartsInit,
  registerMap: mockRegisterMap,
  default: { init: mockEchartsInit, registerMap: mockRegisterMap },
}));

// Mock geo data: US states
const mockUSStates: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
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
    {
      type: 'Feature',
      id: 'NY',
      properties: { name: 'New York', fips: 'NY' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-79, 45],
            [-79, 40],
            [-71, 40],
            [-71, 45],
            [-79, 45],
          ],
        ],
      },
    },
  ],
};

// Mock world countries
const mockWorldCountries: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'USA',
      properties: { name: 'United States', iso: 'USA' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-125, 50],
            [-125, 25],
            [-65, 25],
            [-65, 50],
            [-125, 50],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'CAN',
      properties: { name: 'Canada', iso: 'CAN' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-140, 70],
            [-140, 42],
            [-52, 42],
            [-52, 70],
            [-140, 70],
          ],
        ],
      },
    },
  ],
};

const BLUE_RANGE = [
  'var(--viz-scale-sequential-01)',
  'var(--viz-scale-sequential-03)',
  'var(--viz-scale-sequential-05)',
  'var(--viz-scale-sequential-07)',
];

const BLUE_RANGE_SHORT = [
  'var(--viz-scale-sequential-01)',
  'var(--viz-scale-sequential-03)',
  'var(--viz-scale-sequential-05)',
];

// Create a test context provider wrapper
function createContextWrapper(
  features: Feature[],
  joinedData: Map<string, DataRecord>,
  projectionOverride?: GeoProjection
) {
  const projection = projectionOverride ?? d3Geo.geoMercator().scale(150).translate([400, 300]);

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

describe('ChoroplethMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with US states data', () => {
      const data: DataRecord[] = [
        { fips: 'CA', population: 39538223 },
        { fips: 'TX', population: 29145505 },
        { fips: 'NY', population: 20201249 },
      ];

      const joinedData = new Map([
        ['ca', { fips: 'CA', population: 39538223 }],
        ['tx', { fips: 'TX', population: 29145505 }],
        ['ny', { fips: 'NY', population: 20201249 }],
      ]);

      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="population"
          geoJoinKey="fips"
          a11y={{ description: 'US Population by State' }}
        />,
        { wrapper: Wrapper }
      );

      expect(container.querySelector('svg')).toBeDefined();
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3); // Three states
    });

    it('should render with world countries data', () => {
      const data: DataRecord[] = [
        { iso: 'USA', gdp: 21427700 },
        { iso: 'CAN', gdp: 1736425 },
      ];

      const joinedData = new Map([
        ['usa', { iso: 'USA', gdp: 21427700 }],
        ['can', { iso: 'CAN', gdp: 1736425 }],
      ]);

      const Wrapper = createContextWrapper(mockWorldCountries.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="gdp"
          geoJoinKey="iso"
          a11y={{ description: 'World GDP by Country' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(2); // Two countries
    });
  });

  describe('Color Encoding', () => {
    it('should apply color encoding correctly', () => {
      const data: DataRecord[] = [
        { fips: 'CA', value: 100 },
        { fips: 'TX', value: 50 },
        { fips: 'NY', value: 75 },
      ];

      const joinedData = new Map([
        ['ca', { fips: 'CA', value: 100 }],
        ['tx', { fips: 'TX', value: 50 }],
        ['ny', { fips: 'NY', value: 75 }],
      ]);

      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          colorRange={BLUE_RANGE}
          a11y={{ description: 'Test choropleth' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);

      // Each path should have a fill color
      paths.forEach((path) => {
        const fill = path.getAttribute('fill');
        expect(fill).toBeTruthy();
      });
    });

    it('should use quantize scale to distribute colors evenly', () => {
      const data: DataRecord[] = [
        { id: 'CA', value: 0 },
        { id: 'TX', value: 50 },
        { id: 'NY', value: 100 },
      ];

      const joinedData = new Map([
        ['ca', { id: 'CA', value: 0 }],
        ['tx', { id: 'TX', value: 50 }],
        ['ny', { id: 'NY', value: 100 }],
      ]);

      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          colorScale="quantize"
          colorRange={BLUE_RANGE_SHORT}
          a11y={{ description: 'Quantize scale test' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);
    });

    it('should use quantile scale to distribute colors by data distribution', () => {
      // Skewed data: most values low, few high
      const data: DataRecord[] = [
        { id: 'CA', value: 10 },
        { id: 'TX', value: 15 },
        { id: 'NY', value: 1000 },
      ];

      const joinedData = new Map([
        ['ca', { id: 'CA', value: 10 }],
        ['tx', { id: 'TX', value: 15 }],
        ['ny', { id: 'NY', value: 1000 }],
      ]);

      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          colorScale="quantile"
          colorRange={BLUE_RANGE_SHORT}
          a11y={{ description: 'Quantile scale test' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);
    });

    it('should use threshold scale with specified breakpoints', () => {
      const data: DataRecord[] = [
        { id: 'CA', value: 5 },
        { id: 'TX', value: 15 },
        { id: 'NY', value: 25 },
      ];

      const joinedData = new Map([
        ['ca', { id: 'CA', value: 5 }],
        ['tx', { id: 'TX', value: 15 }],
        ['ny', { id: 'NY', value: 25 }],
      ]);

      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          colorScale="threshold"
          thresholds={[10, 20]}
          colorRange={BLUE_RANGE_SHORT}
          a11y={{ description: 'Threshold scale test' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);
    });
  });

  describe('Interactions', () => {
    it('should change region styling on hover', () => {
      const data: DataRecord[] = [{ fips: 'CA', value: 100 }];
      const joinedData = new Map([['ca', { fips: 'CA', value: 100 }]]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          a11y={{ description: 'Hover test' }}
        />,
        { wrapper: Wrapper }
      );

      const path = container.querySelector('path');
      expect(path).toBeTruthy();

      if (path) {
        const originalStrokeWidth = path.getAttribute('stroke-width');
        fireEvent.mouseEnter(path);

        // Hover state should change stroke width (doubled in ChoroplethMapRegion)
        const hoveredStrokeWidth = path.getAttribute('stroke-width');
        expect(hoveredStrokeWidth).not.toBe(originalStrokeWidth);
      }
    });

    it('should fire click event with correct data', () => {
      const handleClick = vi.fn();
      const data: DataRecord[] = [{ fips: 'CA', value: 100 }];
      const joinedData = new Map([['ca', { fips: 'CA', value: 100 }]]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          onRegionClick={handleClick}
          a11y={{ description: 'Click test' }}
        />,
        { wrapper: Wrapper }
      );

      const path = container.querySelector('path');
      expect(path).toBeTruthy();

      if (path) {
        fireEvent.click(path);
        expect(handleClick).toHaveBeenCalledTimes(1);

        const [feature, datum] = handleClick.mock.calls[0];
        expect(feature).toBeTruthy();
        expect(datum).toBeTruthy();
      }
    });
  });

  describe('Projection', () => {
    it('should use provided projection instance when available', () => {
      const createProjectionSpy = vi.spyOn(projectionUtils, 'createProjection');
      const customProjection = d3Geo.geoMercator().scale(200).translate([500, 400]);
      const data: DataRecord[] = [{ fips: 'CA', population: 39538223 }];
      const joinedData = new Map([['ca', { fips: 'CA', population: 39538223 }]]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData, customProjection);

      render(
        <ChoroplethMap
          data={data}
          valueField="population"
          geoJoinKey="fips"
          a11y={{ description: 'Projection reuse test' }}
        />,
        { wrapper: Wrapper }
      );

      expect(createProjectionSpy).not.toHaveBeenCalled();
      createProjectionSpy.mockRestore();
    });
  });

  describe('Missing Data Handling', () => {
    it('should handle missing data gracefully (unmatched regions)', () => {
      // Only provide data for CA, not TX or NY
      const data: DataRecord[] = [{ fips: 'CA', value: 100 }];
      const joinedData = new Map([['ca', { fips: 'CA', value: 100 }]]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          a11y={{ description: 'Missing data test' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      // Should still render all 3 states, even those without data
      expect(paths.length).toBe(3);

      // Regions without data should get default color (first in range)
      paths.forEach((path) => {
        const fill = path.getAttribute('fill');
        expect(fill).toBeTruthy();
      });
    });

    it('should handle null values in data', () => {
      const data: DataRecord[] = [
        { fips: 'CA', value: 100 },
        { fips: 'TX', value: null },
        { fips: 'NY', value: undefined },
      ];

      const joinedData = new Map([
        ['ca', { fips: 'CA', value: 100 }],
        ['tx', { fips: 'TX', value: null }],
        ['ny', { fips: 'NY', value: undefined }],
      ]);

      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          a11y={{ description: 'Null values test' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);
    });
  });

  describe('Renderer integration', () => {
    it('should render via Vega-Lite when requested', async () => {
      const data: DataRecord[] = [
        { fips: 'CA', population: 39538223 },
        { fips: 'TX', population: 29145505 },
      ];
      const joinedData = new Map([
        ['ca', { fips: 'CA', population: 39538223 }],
        ['tx', { fips: 'TX', population: 29145505 }],
      ]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      render(
        <ChoroplethMap
          data={data}
          valueField="population"
          geoJoinKey="fips"
          preferredRenderer="vega-lite"
          a11y={{ description: 'US Population by State' }}
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(mockVegaEmbed).toHaveBeenCalled();
      });

      const [, spec] = mockVegaEmbed.mock.calls[0];
      expect((spec as { mark?: string }).mark).toBe('geoshape');
    });

    it('should render via ECharts when requested', async () => {
      const data: DataRecord[] = [
        { fips: 'CA', population: 39538223 },
        { fips: 'TX', population: 29145505 },
      ];
      const joinedData = new Map([
        ['ca', { fips: 'CA', population: 39538223 }],
        ['tx', { fips: 'TX', population: 29145505 }],
      ]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      render(
        <ChoroplethMap
          data={data}
          valueField="population"
          geoJoinKey="fips"
          preferredRenderer="echarts"
          a11y={{ description: 'US Population by State' }}
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(mockRegisterMap).toHaveBeenCalled();
        expect(mockEchartsInit).toHaveBeenCalled();
        expect(mockEchartsInstance.setOption).toHaveBeenCalled();
      });

      const option = mockEchartsInstance.setOption.mock.calls[0][0] as {
        series: Array<{ data: Array<{ value: number | null }> }>;
      };
      expect(option.series[0].data).toHaveLength(mockUSStates.features.length);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const data: DataRecord[] = [{ fips: 'CA', value: 100 }];
      const joinedData = new Map([['ca', { fips: 'CA', value: 100 }]]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          a11y={{
            description: 'US Population Map',
            narrative: {
              summary: 'Population distribution across US states',
              keyFindings: ['California has highest population', 'Texas is second'],
            },
          }}
        />,
        { wrapper: Wrapper }
      );

      const svg = container.querySelector('svg');
      // SVG should not have role="img" to avoid nested interactive controls
      expect(svg?.getAttribute('role')).toBeNull();
      expect(svg?.getAttribute('aria-label')).toBe('US Population Map');

      const title = container.querySelector('title');
      expect(title?.textContent).toBe('US Population Map');

      const desc = container.querySelector('desc');
      expect(desc).toBeTruthy();
    });

    it('should have keyboard-focusable regions', () => {
      const data: DataRecord[] = [{ fips: 'CA', value: 100 }];
      const joinedData = new Map([['ca', { fips: 'CA', value: 100 }]]);
      const Wrapper = createContextWrapper(mockUSStates.features, joinedData);

      const { container } = render(
        <ChoroplethMap
          data={data}
          valueField="value"
          geoJoinKey="fips"
          a11y={{ description: 'Keyboard test' }}
        />,
        { wrapper: Wrapper }
      );

      const paths = container.querySelectorAll('path');
      paths.forEach((path) => {
        expect(path.getAttribute('tabindex')).toBe('0');
        expect(path.getAttribute('role')).toBe('button');
      });
    });
  });
});
