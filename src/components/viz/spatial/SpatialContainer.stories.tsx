/**
 * Storybook stories for SpatialContainer component.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { SpatialContainer } from './SpatialContainer.js';
import type { SpatialSpec } from '../../../types/viz/spatial.js';
import type { FeatureCollection, Polygon } from 'geojson';

const meta: Meta<typeof SpatialContainer> = {
  title: 'Viz/Spatial/SpatialContainer',
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

// Sample US states GeoJSON (simplified)
const sampleGeoData: FeatureCollection<Polygon> = {
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
            [-120.0, 42.0],
            [-120.0, 38.5],
            [-124.4, 38.5],
            [-124.4, 42.0],
          ],
        ],
      },
      properties: {
        name: 'California',
        state: 'CA',
      },
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
      properties: {
        name: 'Texas',
        state: 'TX',
      },
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
      properties: {
        name: 'New York',
        state: 'NY',
      },
    },
  ],
};

const sampleSpec: SpatialSpec = {
  type: 'spatial',
  name: 'US States Map',
  data: { values: [] },
  projection: { type: 'mercator' },
  layers: [
    {
      type: 'regionFill',
      encoding: {
        color: { field: 'value' },
      },
      zIndex: 0,
    },
  ],
  a11y: {
    description: 'A map showing US states with sample data',
    ariaLabel: 'US States Map',
  },
};

export const Default: Story = {
  args: {
    spec: sampleSpec,
    geoData: sampleGeoData,
    width: 800,
    height: 600,
    a11y: {
      description: 'A map showing US states',
    },
  },
};

export const WithProjection: Story = {
  args: {
    spec: sampleSpec,
    geoData: sampleGeoData,
    width: 800,
    height: 600,
    projection: 'albersUsa',
    projectionConfig: {
      type: 'albersUsa',
      scale: 1000,
    },
    a11y: {
      description: 'US states map with Albers USA projection',
    },
  },
};

export const WithLayers: Story = {
  args: {
    spec: sampleSpec,
    geoData: sampleGeoData,
    width: 800,
    height: 600,
    layers: [
      {
        type: 'regionFill',
        encoding: {
          color: { field: 'value' },
        },
        zIndex: 0,
      },
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'lon' },
          latitude: { field: 'lat' },
        },
        zIndex: 1,
      },
    ],
    a11y: {
      description: 'US states map with multiple layers',
    },
  },
};

export const WithA11y: Story = {
  args: {
    spec: sampleSpec,
    geoData: sampleGeoData,
    width: 800,
    height: 600,
    a11y: {
      description: 'US states map with full accessibility features',
      narrative: {
        summary: 'This map displays three US states: California, Texas, and New York.',
        keyFindings: [
          'California is located on the west coast',
          'Texas is the largest state shown',
          'New York is on the east coast',
        ],
      },
      tableFallback: {
        enabled: true,
        caption: 'US States Data',
      },
    },
    data: [
      { state: 'CA', value: 100 },
      { state: 'TX', value: 200 },
      { state: 'NY', value: 150 },
    ],
  },
};

export const Loading: Story = {
  args: {
    spec: sampleSpec,
    geoData: sampleGeoData,
    width: 800,
    height: 600,
    a11y: {
      description: 'Loading map data...',
    },
  },
  parameters: {
    // Mock loading state in test environment
    docs: {
      description: {
        story: 'Container displays loading state while geo data is being resolved.',
      },
    },
  },
};

export const Error: Story = {
  args: {
    spec: sampleSpec,
    geoData: sampleGeoData,
    width: 800,
    height: 600,
    a11y: {
      description: 'Error loading map',
    },
  },
  parameters: {
    // Mock error state in test environment
    docs: {
      description: {
        story: 'Container displays error state when geo data resolution fails.',
      },
    },
  },
};
