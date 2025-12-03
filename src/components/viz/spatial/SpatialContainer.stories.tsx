/**
 * Storybook stories for SpatialContainer component.
 *
 * SpatialContainer is the root component that manages:
 * - Projection state and configuration
 * - Layer ordering and composition
 * - Accessibility context (narratives, table fallback)
 * - Geo data joining
 */

import { useState, useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SpatialContainer } from './SpatialContainer.js';
import { ChoroplethMap } from './ChoroplethMap.js';
import { BubbleMap } from './BubbleMap.js';
import type { SpatialSpec } from '../../../types/viz/spatial.js';
import type { NormalizedVizSpec } from '../../../viz/spec/normalized-viz-spec.js';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import usStatesTopology from './fixtures/us-states-10m.json';
import worldCountriesTopology from './fixtures/world-countries-110m.json';

const meta: Meta<typeof SpatialContainer> = {
  title: 'Visualization/Spatial/Spatial Container',
  component: SpatialContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Root container component for spatial visualizations that manages projection state, layer ordering, and accessibility context.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SpatialContainer>;

function toFeatureCollection(topology: Topology, objectKey: string): FeatureCollection<Geometry> {
  const result = feature(
    topology as unknown as Topology,
    (topology as { objects: Record<string, unknown> }).objects[objectKey] as never
  ) as FeatureCollection<Geometry> | Feature<Geometry>;

  if (result.type === 'FeatureCollection') {
    return result;
  }

  return {
    type: 'FeatureCollection',
    features: [result],
  };
}

// Real US states GeoJSON via TopoJSON conversion
const usStatesGeoData = toFeatureCollection(usStatesTopology as unknown as Topology, 'states');

// World countries for projection comparison
const worldCountriesGeoData = toFeatureCollection(worldCountriesTopology as unknown as Topology, 'countries');

// Sample data for US states
const usStateData = [
  { name: 'California', population: 39538223 },
  { name: 'Texas', population: 29145505 },
  { name: 'Florida', population: 21538187 },
  { name: 'New York', population: 20201249 },
  { name: 'Pennsylvania', population: 13002700 },
  { name: 'Illinois', population: 12812508 },
  { name: 'Ohio', population: 11799448 },
  { name: 'Georgia', population: 10711908 },
];

// City data for bubble overlay
const usCityData = [
  { city: 'Los Angeles', lon: -118.2437, lat: 34.0522, population: 3898747 },
  { city: 'Houston', lon: -95.3698, lat: 29.7604, population: 2304580 },
  { city: 'Phoenix', lon: -112.074, lat: 33.4484, population: 1608139 },
  { city: 'Philadelphia', lon: -75.1652, lat: 39.9526, population: 1603797 },
  { city: 'Chicago', lon: -87.6298, lat: 41.8781, population: 2746388 },
];

// World country data for projection demo
const worldCountryData = [
  { name: 'United States of America', gdp: 21427700 },
  { name: 'China', gdp: 14342903 },
  { name: 'Japan', gdp: 5081770 },
  { name: 'Germany', gdp: 3845630 },
  { name: 'United Kingdom', gdp: 2825208 },
  { name: 'India', gdp: 2875142 },
  { name: 'France', gdp: 2715518 },
  { name: 'Brazil', gdp: 1839758 },
];

const sampleSpec: SpatialSpec = {
  type: 'spatial',
  name: 'US States Map',
  data: { values: usStateData },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [
    {
      type: 'regionFill',
      encoding: {
        color: { field: 'population' },
      },
      zIndex: 0,
    },
  ],
  a11y: {
    description: 'A map showing US states with population data',
    ariaLabel: 'US States Map',
  },
};

function asNormalized(spec: SpatialSpec): NormalizedVizSpec {
  return spec as unknown as NormalizedVizSpec;
}

/**
 * Default: Basic SpatialContainer with US states choropleth.
 * Shows the container managing projection and rendering a child visualization.
 */
export const Default: Story = {
  args: {
    spec: sampleSpec,
    geoData: usStatesGeoData,
    data: usStateData,
    width: 800,
    height: 600,
    a11y: {
      description: 'US states colored by population (2020 Census)',
    },
    children: (
      <ChoroplethMap
        data={usStateData}
        valueField="population"
        geoJoinKey="name"
        a11y={{ description: 'US population by state' }}
      />
    ),
  },
};

/**
 * WithProjection: World map using Equal Earth projection.
 * Demonstrates SpatialContainer managing a different projection type.
 * Compare to Default which uses Albers USA for continental US.
 */
export const WithProjection: Story = {
  render: () => {
    const worldSpec: SpatialSpec = {
      type: 'spatial',
      name: 'World GDP Map',
      data: { values: worldCountryData },
      projection: { type: 'equalEarth', fitToData: true },
      layers: [{ type: 'regionFill', encoding: { color: { field: 'gdp' } } }],
      a11y: { description: 'World countries by GDP' },
    };

    return (
      <SpatialContainer
        spec={worldSpec}
        geoData={worldCountriesGeoData}
        data={worldCountryData}
        width={900}
        height={500}
        a11y={{ description: 'World GDP using Equal Earth projection' }}
      >
        <ChoroplethMap
          data={worldCountryData}
          valueField="gdp"
          geoJoinKey="name"
          projection="equalEarth"
          fitToData
          colorRange={[
            'var(--oods-viz-scale-sequential-01)',
            'var(--oods-viz-scale-sequential-04)',
            'var(--oods-viz-scale-sequential-07)',
          ]}
          a11y={{ description: 'World GDP choropleth' }}
        />
      </SpatialContainer>
    );
  },
};

/**
 * WithLayers: Demonstrates layer composition - choropleth base with bubble overlay.
 * Each visualization component renders its own SVG, so we position them absolutely
 * to create a layered effect with bubbles appearing above regions.
 */
export const WithLayers: Story = {
  render: () => {
    const layeredSpec: SpatialSpec = {
      type: 'spatial',
      name: 'US Population with Cities',
      data: { values: usStateData },
      projection: { type: 'albersUsa', fitToData: true },
      layers: [
        { type: 'regionFill', encoding: { color: { field: 'population' } }, zIndex: 0 },
        { type: 'symbol', encoding: { longitude: { field: 'lon' }, latitude: { field: 'lat' }, size: { field: 'population' } }, zIndex: 1 },
      ],
      a11y: { description: 'US states with major city bubbles' },
    };

    return (
      <SpatialContainer
        spec={layeredSpec}
        geoData={usStatesGeoData}
        data={usStateData}
        width={900}
        height={600}
        a11y={{ description: 'Multi-layer map: states + cities' }}
      >
        {/* Layer 1: State choropleth (base layer) */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <ChoroplethMap
            data={usStateData}
            valueField="population"
            geoJoinKey="name"
            colorRange={[
              'var(--oods-viz-scale-sequential-01)',
              'var(--oods-viz-scale-sequential-03)',
              'var(--oods-viz-scale-sequential-05)',
            ]}
            a11y={{ description: 'State population choropleth' }}
          />
        </div>
        {/* Layer 2: City bubbles (overlay) - positioned above choropleth */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <BubbleMap
            spec={asNormalized(layeredSpec)}
            data={usCityData}
            longitudeField="lon"
            latitudeField="lat"
            sizeField="population"
            sizeRange={[10, 32]}
            colorRange={['var(--oods-viz-scale-diverging-05, #ef4444)']}
            a11y={{ description: 'Major city populations' }}
          />
        </div>
      </SpatialContainer>
    );
  },
};

/**
 * WithA11y: Demonstrates accessibility features.
 *
 * WHAT YOU SEE:
 * - Left side: Data table fallback (for screen readers and when visuals fail)
 * - Right side: The choropleth map
 * - Narrative summary and key findings for assistive technologies
 *
 * The table on the left is INTENTIONAL - it's the accessible data fallback
 * that ensures screen reader users can access the underlying data.
 */
export const WithA11y: Story = {
  args: {
    spec: sampleSpec,
    geoData: usStatesGeoData,
    width: 800,
    height: 600,
    a11y: {
      description: 'US states map with full accessibility features',
      narrative: {
        summary: 'Population distribution across major US states from the 2020 Census.',
        keyFindings: [
          'California has the highest population at 39.5 million',
          'Texas is second with 29.1 million residents',
          'Florida rounds out the top three at 21.5 million',
        ],
      },
      tableFallback: {
        enabled: true,
        caption: 'US State Population Data (2020)',
      },
    },
    data: usStateData,
    children: (
      <ChoroplethMap
        data={usStateData}
        valueField="population"
        geoJoinKey="name"
        a11y={{
          description: 'Accessible choropleth with table fallback',
          tableFallback: { enabled: true, caption: 'US State Population Data' },
          narrative: {
            summary: 'Population distribution across major US states.',
            keyFindings: [
              'California leads with 39.5 million',
              'Texas follows with 29.1 million',
            ],
          },
        }}
      />
    ),
  },
};

/**
 * Loading: Simulates async data loading with a delay.
 * Shows loading indicator while geo data is being fetched.
 */
export const Loading: Story = {
  render: () => {
    const [geoData, setGeoData] = useState<FeatureCollection<Geometry> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      // Simulate network delay
      const timer = setTimeout(() => {
        setGeoData(usStatesGeoData);
        setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
      return (
        <div
          style={{
            width: 800,
            height: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--sys-surface, #f5f5f5)',
            border: '1px solid var(--sys-border-subtle, #e0e0e0)',
            borderRadius: 8,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--sys-border-subtle, #ccc)',
                borderTopColor: 'var(--sys-accent-strong, #0066cc)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ color: 'var(--sys-text-subtle, #666)' }}>Loading map data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      );
    }

    return (
      <SpatialContainer
        spec={sampleSpec}
        geoData={geoData!}
        data={usStateData}
        width={800}
        height={600}
        a11y={{ description: 'Map loaded successfully' }}
      >
        <ChoroplethMap
          data={usStateData}
          valueField="population"
          geoJoinKey="name"
          a11y={{ description: 'US population after loading' }}
        />
      </SpatialContainer>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates loading state with a 2-second simulated delay before map renders.',
      },
    },
  },
};

/**
 * Error: Shows error state when geo data fails to load.
 * Displays user-friendly error message with retry option.
 */
export const Error: Story = {
  render: () => {
    const [retryCount, setRetryCount] = useState(0);

    const handleRetry = () => {
      setRetryCount((c) => c + 1);
      // Still fail to demonstrate persistent error state
      // In real usage, this would attempt to refetch data
    };

    // Always show error state for this demo
    return (
      <div
        style={{
          width: 800,
          height: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--sys-status-danger-surface, #fef2f2)',
          border: '1px solid var(--sys-status-danger-border, #fca5a5)',
          borderRadius: 8,
        }}
        role="alert"
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
            }}
            aria-hidden="true"
          >
            ⚠️
          </div>
          <h3 style={{ color: 'var(--sys-status-danger-fg, #dc2626)', margin: '0 0 8px' }}>
            Failed to Load Map Data
          </h3>
          <p style={{ color: 'var(--sys-text-subtle, #666)', margin: '0 0 16px' }}>
            Unable to fetch geographic data. Please check your connection and try again.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              padding: '8px 16px',
              background: 'var(--sys-accent-strong, #0066cc)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Retry {retryCount > 0 ? `(${retryCount})` : ''}
          </button>
          <p style={{ fontSize: 12, color: 'var(--sys-text-subtle, #999)', marginTop: 12 }}>
            Error: NETWORK_ERROR - Connection timed out
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates error state UI when geo data resolution fails.',
      },
    },
  },
};
