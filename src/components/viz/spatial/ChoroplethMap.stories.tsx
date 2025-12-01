/**
 * Storybook stories for ChoroplethMap component.
 */

import type { Meta, StoryObj } from '@storybook/react';
import type { JSX } from 'react';
import { ChoroplethMap } from './ChoroplethMap.js';
import { SpatialContainer } from './SpatialContainer.js';
import type { SpatialSpec } from '../../../types/viz/spatial.js';
import type { FeatureCollection, Polygon } from 'geojson';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';

const meta: Meta<typeof ChoroplethMap> = {
  title: 'Viz/Spatial/ChoroplethMap',
  component: ChoroplethMap,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Choropleth map component for visualizing regional data with color encoding. Supports multiple color scale types (quantize, quantile, threshold) and full keyboard accessibility.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ChoroplethMap>;

// Sample US states GeoJSON
const usStatesGeoData: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'CA',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-124.4, 42.0],
            [-114.1, 42.0],
            [-114.1, 32.5],
            [-124.4, 32.5],
            [-124.4, 42.0],
          ],
        ],
      },
      properties: { name: 'California', fips: 'CA' },
    },
    {
      type: 'Feature',
      id: 'TX',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-106.6, 36.5],
            [-93.5, 36.5],
            [-93.5, 25.8],
            [-106.6, 25.8],
            [-106.6, 36.5],
          ],
        ],
      },
      properties: { name: 'Texas', fips: 'TX' },
    },
    {
      type: 'Feature',
      id: 'NY',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-79.8, 45.0],
            [-71.8, 45.0],
            [-71.8, 40.5],
            [-79.8, 40.5],
            [-79.8, 45.0],
          ],
        ],
      },
      properties: { name: 'New York', fips: 'NY' },
    },
    {
      type: 'Feature',
      id: 'FL',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-87.6, 31.0],
            [-80.0, 31.0],
            [-80.0, 24.5],
            [-87.6, 24.5],
            [-87.6, 31.0],
          ],
        ],
      },
      properties: { name: 'Florida', fips: 'FL' },
    },
    {
      type: 'Feature',
      id: 'IL',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-91.5, 42.5],
            [-87.0, 42.5],
            [-87.0, 37.0],
            [-91.5, 37.0],
            [-91.5, 42.5],
          ],
        ],
      },
      properties: { name: 'Illinois', fips: 'IL' },
    },
  ],
};

// World countries GeoJSON
const worldCountriesGeoData: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'USA',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-125, 50],
            [-65, 50],
            [-65, 25],
            [-125, 25],
            [-125, 50],
          ],
        ],
      },
      properties: { name: 'United States', iso: 'USA' },
    },
    {
      type: 'Feature',
      id: 'CAN',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-140, 70],
            [-52, 70],
            [-52, 42],
            [-140, 42],
            [-140, 70],
          ],
        ],
      },
      properties: { name: 'Canada', iso: 'CAN' },
    },
    {
      type: 'Feature',
      id: 'MEX',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-117, 32],
            [-86, 32],
            [-86, 14],
            [-117, 14],
            [-117, 32],
          ],
        ],
      },
      properties: { name: 'Mexico', iso: 'MEX' },
    },
    {
      type: 'Feature',
      id: 'BRA',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-73, 5],
            [-35, 5],
            [-35, -33],
            [-73, -33],
            [-73, 5],
          ],
        ],
      },
      properties: { name: 'Brazil', iso: 'BRA' },
    },
  ],
};

// Data: US population by state
const usPopulationData: DataRecord[] = [
  { fips: 'CA', population: 39538223, state: 'California' },
  { fips: 'TX', population: 29145505, state: 'Texas' },
  { fips: 'NY', population: 20201249, state: 'New York' },
  { fips: 'FL', population: 21538187, state: 'Florida' },
  { fips: 'IL', population: 12812508, state: 'Illinois' },
];

// Data: World GDP by country
const worldGDPData: DataRecord[] = [
  { iso: 'USA', gdp: 21427700, country: 'United States' },
  { iso: 'CAN', gdp: 1736425, country: 'Canada' },
  { iso: 'MEX', gdp: 1258287, country: 'Mexico' },
  { iso: 'BRA', gdp: 1839758, country: 'Brazil' },
];

// Wrapper component to provide SpatialContainer context
function ChoroplethMapStory({
  geoData,
  data,
  valueField,
  geoJoinKey,
  colorScale,
  colorRange,
  thresholds,
  onRegionClick,
  a11y,
}: {
  geoData: FeatureCollection<Polygon>;
  data: DataRecord[];
  valueField: string;
  geoJoinKey: string;
  colorScale?: 'quantize' | 'quantile' | 'threshold';
  colorRange?: string[];
  thresholds?: number[];
  onRegionClick?: (feature: any, datum: any) => void;
  a11y: any;
}): JSX.Element {
  const spec: SpatialSpec = {
    type: 'spatial',
    data: { values: data },
    projection: { type: 'mercator', fitToData: true },
    layers: [
      {
        type: 'regionFill',
        encoding: { color: { field: valueField } },
      },
    ],
    a11y: a11y,
  };

  return (
    <SpatialContainer spec={spec} geoData={geoData} width={1000} height={600} a11y={a11y} data={data}>
      <ChoroplethMap
        data={data}
        valueField={valueField}
        geoJoinKey={geoJoinKey}
        colorScale={colorScale}
        colorRange={colorRange}
        thresholds={thresholds}
        onRegionClick={onRegionClick}
        a11y={a11y}
      />
    </SpatialContainer>
  );
}

export const USPopulation: Story = {
  render: () => (
    <ChoroplethMapStory
      geoData={usStatesGeoData}
      data={usPopulationData}
      valueField="population"
      geoJoinKey="fips"
      a11y={{
        description: 'US Population by State (2020)',
        narrative: {
          summary: 'Population distribution across US states',
          keyFindings: [
            'California has the highest population at 39.5 million',
            'Texas is second with 29.1 million',
          ],
        },
      }}
    />
  ),
};

export const WorldGDP: Story = {
  render: () => (
    <ChoroplethMapStory
      geoData={worldCountriesGeoData}
      data={worldGDPData}
      valueField="gdp"
      geoJoinKey="iso"
      colorRange={['#fff7ec', '#fee8c8', '#fdd49e', '#fc8d59']}
      a11y={{
        description: 'World GDP by Country (millions USD)',
        narrative: {
          summary: 'Economic output comparison across countries',
          keyFindings: ['United States has the highest GDP at $21.4 trillion'],
        },
      }}
    />
  ),
};

export const QuantizeScale: Story = {
  render: () => (
    <ChoroplethMapStory
      geoData={usStatesGeoData}
      data={usPopulationData}
      valueField="population"
      geoJoinKey="fips"
      colorScale="quantize"
      colorRange={['#f0f0f0', '#bdbdbd', '#737373', '#252525']}
      a11y={{
        description: 'US Population with Quantize Scale (Equal Intervals)',
      }}
    />
  ),
};

export const QuantileScale: Story = {
  render: () => (
    <ChoroplethMapStory
      geoData={usStatesGeoData}
      data={usPopulationData}
      valueField="population"
      geoJoinKey="fips"
      colorScale="quantile"
      colorRange={['#edf8fb', '#b3cde3', '#8c96c6', '#88419d']}
      a11y={{
        description: 'US Population with Quantile Scale (Equal Count)',
      }}
    />
  ),
};

export const ThresholdScale: Story = {
  render: () => (
    <ChoroplethMapStory
      geoData={usStatesGeoData}
      data={usPopulationData}
      valueField="population"
      geoJoinKey="fips"
      colorScale="threshold"
      thresholds={[15000000, 25000000, 35000000]}
      colorRange={['#feedde', '#fdbe85', '#fd8d3c', '#d94701']}
      a11y={{
        description: 'US Population with Threshold Scale (Custom Breakpoints)',
      }}
    />
  ),
};

export const Interactive: Story = {
  render: () => {
    const handleClick = (_feature: any, datum: any) => {
      if (datum) {
        alert(`Clicked: ${datum.state || datum.country}\nValue: ${datum.population || datum.gdp}`);
      }
    };

    return (
      <ChoroplethMapStory
        geoData={usStatesGeoData}
        data={usPopulationData}
        valueField="population"
        geoJoinKey="fips"
        onRegionClick={handleClick}
        a11y={{
          description: 'Interactive Choropleth Map - Click regions for details',
        }}
      />
    );
  },
};

export const WithLegend: Story = {
  render: () => (
    <div style={{ position: 'relative' }}>
      <ChoroplethMapStory
        geoData={usStatesGeoData}
        data={usPopulationData}
        valueField="population"
        geoJoinKey="fips"
        colorRange={['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26']}
        a11y={{
          description: 'US Population with Color Legend',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'white',
          padding: '15px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Population</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: '#fee5d9' }} />
            <span>12M - 20M</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: '#fcae91' }} />
            <span>20M - 28M</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: '#fb6a4a' }} />
            <span>28M - 36M</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: '#de2d26' }} />
            <span>36M+</span>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Accessible: Story = {
  render: () => (
    <ChoroplethMapStory
      geoData={usStatesGeoData}
      data={usPopulationData}
      valueField="population"
      geoJoinKey="fips"
      a11y={{
        description: 'Accessible Choropleth Map with Table Fallback',
        tableFallback: {
          enabled: true,
          caption: 'US Population by State (2020)',
        },
        narrative: {
          summary: 'Population distribution across major US states',
          keyFindings: [
            'California leads with 39.5 million residents',
            'Texas follows with 29.1 million',
            'New York has 20.2 million',
          ],
        },
      }}
    />
  ),
};
