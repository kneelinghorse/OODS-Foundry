/**
 * Renderer-specific tests for BubbleMap (vega-lite & echarts branches).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as d3Geo from 'd3-geo';
import { SpatialContextProvider } from '../../../../src/components/viz/spatial/SpatialContext.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import type { DataRecord } from '../../../../src/viz/adapters/spatial/geo-data-joiner.js';
import type { FeatureCollection, Point } from 'geojson';
import { loadVegaEmbed } from '../../../../src/viz/runtime/vega-embed-loader.js';

const mockEchartsInstance = {
  setOption: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};
const mockEchartsInit = vi.fn(() => mockEchartsInstance);
const mockRegisterMap = vi.fn();

vi.mock('../../../../src/viz/runtime/vega-embed-loader.js', async (importOriginal) => {
  const actual = await vi.importActual<typeof import('../../../../src/viz/runtime/vega-embed-loader.js')>(
    '../../../../src/viz/runtime/vega-embed-loader.js'
  );
  const embedMock = vi.fn(async () => ({
    view: {
      finalize: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  }));
  return {
    ...actual,
    loadVegaEmbed: vi.fn(async () => embedMock),
  };
});

vi.mock('echarts', () => ({
  __esModule: true,
  init: mockEchartsInit,
  registerMap: mockRegisterMap,
  default: { init: mockEchartsInit, registerMap: mockRegisterMap },
}));

// Import after mocks
import { BubbleMap } from '../../../../src/components/viz/spatial/BubbleMap.js';

const mockSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/spatial/v1',
  type: 'spatial',
  data: { values: [] },
  projection: { type: 'mercator' },
  layers: [],
  a11y: { description: 'Renderer test' },
};

const projection = d3Geo.geoMercator().scale(120).translate([200, 200]);

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SpatialContextProvider
      value={{
        projection: { type: 'mercator' },
        dimensions: { width: 400, height: 300 },
        layers: [],
        a11y: { description: 'Renderer test map' },
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

describe('BubbleMap renderers', () => {
  const data: DataRecord[] = [{ name: 'Point', lon: -10, lat: 30, value: 5 }];

  it('initializes vega-lite renderer via loader', async () => {
    const { unmount } = render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        preferredRenderer="vega-lite"
        a11y={{ description: 'Vega renderer' }}
      />,
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(loadVegaEmbed).toHaveBeenCalled();
    });
    unmount();
  });

  it('initializes echarts renderer and registers map when geoData provided', async () => {
    const geoData: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {},
        },
      ],
    };

    const { unmount } = render(
      <BubbleMap
        spec={mockSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        preferredRenderer="echarts"
        geoData={geoData}
        a11y={{ description: 'ECharts renderer' }}
      />,
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(mockEchartsInit).toHaveBeenCalled();
    });
    expect(mockRegisterMap).toHaveBeenCalled();
    unmount();
  });
});
