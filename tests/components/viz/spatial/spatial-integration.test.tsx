/* @vitest-environment jsdom */

/**
 * Integration tests for spatial components composition.
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as d3Geo from 'd3-geo';
import type { Feature, Polygon } from 'geojson';
import { SpatialContextProvider, type SpatialContextValue } from '../../../../src/components/viz/spatial/SpatialContext.js';
import { ChoroplethMap } from '../../../../src/components/viz/spatial/ChoroplethMap.js';
import { BubbleMap } from '../../../../src/components/viz/spatial/BubbleMap.js';
import { MapLegend } from '../../../../src/components/viz/spatial/MapLegend.js';
import { MapControls } from '../../../../src/components/viz/spatial/MapControls.js';
import { AccessibleMapFallback } from '../../../../src/components/viz/spatial/AccessibleMapFallback.js';

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

const features: Feature<Polygon>[] = [
  {
    type: 'Feature',
    id: 'A',
    properties: { name: 'Alpha' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-10, -10],
          [-10, 10],
          [10, 10],
          [10, -10],
          [-10, -10],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'B',
    properties: { name: 'Beta' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [20, -10],
          [20, 10],
          [40, 10],
          [40, -10],
          [20, -10],
        ],
      ],
    },
  },
];

const data = [
  { id: 'A', value: 10, latitude: 0, longitude: 0, magnitude: 5 },
  { id: 'B', value: 20, latitude: 0, longitude: 30, magnitude: 10 },
];

function createContext(): SpatialContextValue {
  const projection = d3Geo.geoMercator().scale(150).translate([200, 150]);
  return {
    projection: { type: 'mercator' },
    dimensions: { width: 400, height: 300 },
    layers: [
      {
        layer: { type: 'regionFill', encoding: { color: { field: 'value' } } },
        order: 0,
        zIndex: 0,
      },
      {
        layer: {
          type: 'symbol',
          encoding: {
            longitude: { field: 'longitude' },
            latitude: { field: 'latitude' },
            size: { field: 'magnitude' },
          },
        },
        order: 1,
        zIndex: 1,
      },
    ],
    a11y: { description: 'Test spatial visualization' },
    features,
    joinedData: new Map([
      ['A', data[0]],
      ['B', data[1]],
    ]),
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
  };
}

describe('Spatial component composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders choropleth with legend, controls, and fallback', () => {
    const contextValue = createContext();
    render(
      <SpatialContextProvider value={contextValue}>
        <div style={{ position: 'relative', width: '400px', height: '300px' }}>
          <MapControls
            onZoomIn={vi.fn()}
            onZoomOut={vi.fn()}
            onZoomReset={vi.fn()}
            position="top-left"
          />
          <MapLegend position="top-right" />
          <ChoroplethMap
            data={data}
            valueField="value"
            geoJoinKey="id"
            a11y={{ description: 'Choropleth with legend' }}
            preferredRenderer="svg"
          />
          <AccessibleMapFallback
            table={{
              caption: 'Integration Table',
              columns: [
                { field: 'value', label: 'Value' },
                { field: 'magnitude', label: 'Magnitude' },
              ],
            }}
            narrative={{ summary: 'Beta exceeds Alpha', keyFindings: ['Beta has higher value'] }}
            alwaysVisible
          />
        </div>
      </SpatialContextProvider>
    );

    expect(screen.getByLabelText('Map legend')).toBeInTheDocument();
    expect(screen.getByLabelText('Map controls')).toBeInTheDocument();
    expect(screen.getByText('Integration Table')).toBeInTheDocument();
    expect(document.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('renders bubble map with legend and layer toggle interaction', () => {
    const contextValue = createContext();
    render(
      <SpatialContextProvider value={contextValue}>
        <div style={{ position: 'relative', width: '400px', height: '300px' }}>
          <MapControls
            layers={[
              { id: 'regions', label: 'Regions', visible: true },
              { id: 'symbols', label: 'Symbols', visible: true },
            ]}
            onLayerToggle={vi.fn()}
            position="bottom-right"
          />
          <MapLegend position="bottom-left" />
          <BubbleMap
            spec={{
              type: 'spatial',
              data: { values: data },
              projection: { type: 'mercator' },
              layers: [],
              a11y: { description: 'Bubble map test' },
            }}
            data={data}
            longitudeField="longitude"
            latitudeField="latitude"
            sizeField="magnitude"
            a11y={{ description: 'Bubble map test' }}
            preferredRenderer="svg"
          />
        </div>
      </SpatialContextProvider>
    );

    expect(screen.getByLabelText('Map controls')).toBeInTheDocument();
    expect(screen.getByLabelText('Map legend')).toBeInTheDocument();
    const layerCheckbox = screen.getByLabelText('Toggle Regions');
    fireEvent.click(layerCheckbox);
    expect((layerCheckbox as HTMLInputElement).checked).toBe(false);
  });
});
