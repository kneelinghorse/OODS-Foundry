/**
 * Storybook stories for BubbleMap component.
 *
 * These stories emphasize realistic data, interaction demos, and accessibility fallbacks.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState, type JSX } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { BubbleMap, type BubbleMapProps } from './BubbleMap.js';
import { MapLegend } from './MapLegend.js';
import { SpatialContainer } from './SpatialContainer.js';
import { createLinearScale } from './utils/color-scale-utils.js';
import { createSqrtSizeScale } from './utils/size-scale-utils.js';
import type { ProjectionType, SpatialSpec } from '../../../types/viz/spatial.js';
import type { NormalizedVizSpec } from '../../../viz/spec/normalized-viz-spec.js';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import usStatesTopology from './fixtures/us-states-10m.json';

interface BubbleStoryArgs
  extends Omit<
    BubbleMapProps,
    'spec' | 'cluster' | 'geoData' | 'preferredRenderer' | 'onPointHover' | 'onPointClick' | 'onClusterClick'
  > {
  geoData?: FeatureCollection;
  specProjection: ProjectionType;
  clusterEnabled: boolean;
  clusterRadius: number;
  clusterMinPoints: number;
  showLegend: boolean;
  enableTooltip: boolean;
  enableSelection: boolean;
  title?: string;
}

const DEFAULT_DIMENSIONS = { width: 1100, height: 640 };
const DEFAULT_COLOR_RANGE = ['var(--oods-viz-scale-sequential-02)', 'var(--oods-viz-scale-sequential-06)'];
const CATEGORY_COLORS = [
  'var(--oods-viz-scale-categorical-01)',
  'var(--oods-viz-scale-categorical-03)',
  'var(--oods-viz-scale-categorical-04)',
  'var(--oods-viz-scale-categorical-05)',
];
const EMPTY_GEOJSON: FeatureCollection = { type: 'FeatureCollection', features: [] };

function toFeatureCollection(topology: Topology, objectKey: string): FeatureCollection<Geometry> {
  const result = feature(
    topology as unknown as Topology,
    (topology as { objects: Record<string, unknown> }).objects[objectKey] as never
  ) as Feature<Geometry> | FeatureCollection<Geometry>;

  if (result.type === 'FeatureCollection') {
    return result;
  }

  return {
    type: 'FeatureCollection',
    features: [result],
  };
}

const usStatesGeoData = toFeatureCollection(usStatesTopology as unknown as Topology, 'states');

const retailLocations: DataRecord[] = [
  { id: 'sf', store: 'San Francisco', region: 'West', lon: -122.4194, lat: 37.7749, sales: 2_300_000 },
  { id: 'nyc', store: 'New York', region: 'Northeast', lon: -74.006, lat: 40.7128, sales: 3_100_000 },
  { id: 'atl', store: 'Atlanta', region: 'Southeast', lon: -84.39, lat: 33.749, sales: 1_200_000 },
  { id: 'chi', store: 'Chicago', region: 'Midwest', lon: -87.6298, lat: 41.8781, sales: 1_450_000 },
  { id: 'den', store: 'Denver', region: 'Mountain', lon: -104.9903, lat: 39.7392, sales: 920_000 },
  { id: 'dal', store: 'Dallas', region: 'South', lon: -96.7969, lat: 32.7767, sales: 1_050_000 },
];

const categorizedLocations: DataRecord[] = [
  { id: 'bos', city: 'Boston', category: 'flagship', lon: -71.0589, lat: 42.3601, revenue: 1_800_000 },
  { id: 'phx', city: 'Phoenix', category: 'outlet', lon: -112.074, lat: 33.4484, revenue: 760_000 },
  { id: 'sea', city: 'Seattle', category: 'flagship', lon: -122.3321, lat: 47.6062, revenue: 1_450_000 },
  { id: 'mia', city: 'Miami', category: 'partner', lon: -80.1918, lat: 25.7617, revenue: 640_000 },
  { id: 'kc', city: 'Kansas City', category: 'outlet', lon: -94.5786, lat: 39.0997, revenue: 530_000 },
  { id: 'la', city: 'Los Angeles', category: 'flagship', lon: -118.2437, lat: 34.0522, revenue: 2_050_000 },
];

const clusteredPoints: DataRecord[] = Array.from({ length: 45 }).map((_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return {
    id: `midtown-${index}`,
    lon: -73.99 + col * 0.03,
    lat: 40.68 + row * 0.015,
    visits: 800 + row * 90 + col * 25,
  };
});

const worldHubs: DataRecord[] = [
  { city: 'London', lon: -0.1276, lat: 51.5072, traffic: 92 },
  { city: 'Tokyo', lon: 139.6917, lat: 35.6895, traffic: 110 },
  { city: 'Singapore', lon: 103.8198, lat: 1.3521, traffic: 78 },
  { city: 'Johannesburg', lon: 28.0473, lat: -26.2041, traffic: 48 },
  { city: 'Toronto', lon: -79.3832, lat: 43.6532, traffic: 65 },
];

const accessibilityLocations: DataRecord[] = [
  { city: 'Portland', lon: -122.6765, lat: 45.5231, riders: 180_000, status: 'stable' },
  { city: 'Minneapolis', lon: -93.265, lat: 44.9778, riders: 220_000, status: 'increasing' },
  { city: 'Austin', lon: -97.7431, lat: 30.2672, riders: 140_000, status: 'stable' },
  { city: 'Detroit', lon: -83.0458, lat: 42.3314, riders: 95_000, status: 'decreasing' },
];

function asNormalized(spec: SpatialSpec): NormalizedVizSpec {
  return spec as unknown as NormalizedVizSpec;
}

function numericExtent(data: DataRecord[], field: string | undefined, fallback: [number, number]): [number, number] {
  if (!field) {
    return fallback;
  }
  const values = data
    .map((entry) => {
      const value = entry[field];
      return typeof value === 'number' ? value : Number.NaN;
    })
    .filter((value) => Number.isFinite(value)) as number[];
  if (!values.length) {
    return fallback;
  }
  return [Math.min(...values), Math.max(...values)];
}

function formatForLegend(field: string | undefined): (value: number) => string {
  if (field === 'sales' || field === 'revenue') {
    return (value) => `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (field === 'visits' || field === 'riders') {
    return (value) => value.toLocaleString();
  }
  if (field === 'traffic') {
    return (value) => `${value}k`;
  }
  return (value) => value.toLocaleString();
}

function BubbleStory({
  data,
  geoData = usStatesGeoData,
  specProjection,
  clusterEnabled,
  clusterRadius,
  clusterMinPoints,
  showLegend,
  enableTooltip,
  enableSelection,
  title,
  longitudeField,
  latitudeField,
  sizeField,
  sizeRange,
  sizeScale,
  colorField,
  colorType,
  colorRange,
  a11y,
}: BubbleStoryArgs): JSX.Element {
  const [hovered, setHovered] = useState<DataRecord | null>(null);
  const [selected, setSelected] = useState<DataRecord | null>(null);

  const spec: SpatialSpec = useMemo(
    () => ({
      type: 'spatial',
      data: { values: data },
      projection: { type: specProjection, fitToData: true },
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: longitudeField },
            latitude: { field: latitudeField },
            size: sizeField ? { field: sizeField, range: sizeRange } : undefined,
            color: colorField ? { field: colorField, range: colorRange } : undefined,
          },
        },
      ],
      a11y,
    }),
    [a11y, colorField, colorRange, data, latitudeField, longitudeField, sizeField, sizeRange, specProjection]
  );

  const normalizedSpec = useMemo(() => asNormalized(spec), [spec]);
  const sizeExtent = useMemo(() => numericExtent(data, sizeField, [0, 1]), [data, sizeField]);
  const colorExtent = useMemo(() => numericExtent(data, colorField, [0, 1]), [data, colorField]);

  const legendFormat = useMemo(() => formatForLegend(sizeField ?? colorField), [colorField, sizeField]);
  const showColorLegend = showLegend && colorField && colorType === 'continuous';

  return (
    <div className="space-y-4">
      {title ? <p className="text-sm text-[--cmp-text-muted]">{title}</p> : null}
      <SpatialContainer
        spec={spec}
        geoData={geoData}
        data={data}
        width={DEFAULT_DIMENSIONS.width}
        height={DEFAULT_DIMENSIONS.height}
        a11y={a11y}
        onFeatureHover={
          enableTooltip
            ? (_feature, datum) => {
                setHovered(datum ?? null);
              }
            : undefined
        }
      >
        <BubbleMap
          spec={normalizedSpec}
          geoData={geoData}
          data={data}
          longitudeField={longitudeField}
          latitudeField={latitudeField}
          sizeField={sizeField}
          sizeRange={sizeRange}
          sizeScale={sizeScale}
          colorField={colorField}
          colorType={colorType}
          colorRange={colorRange}
          cluster={{ enabled: clusterEnabled, radius: clusterRadius, minPoints: clusterMinPoints }}
          onPointClick={enableSelection ? (datum) => setSelected(datum) : undefined}
          onPointHover={enableTooltip ? (datum) => setHovered(datum) : undefined}
          a11y={a11y}
        />
      </SpatialContainer>

      {enableTooltip && hovered ? (
        <div className="rounded-md border border-[--cmp-border-muted] bg-[--cmp-surface] p-3 shadow-sm">
          <p className="text-sm font-semibold">{(hovered.city ?? hovered.store ?? hovered.id) as string}</p>
          {sizeField && sizeField in hovered ? (
            <p className="text-sm">
              {sizeField}: {legendFormat(hovered[sizeField] as number)}
            </p>
          ) : null}
          {colorField && colorField in hovered ? (
            <p className="text-sm">
              {colorField}: {hovered[colorField] as string}
            </p>
          ) : null}
        </div>
      ) : null}

      {enableSelection && selected ? (
        <div className="rounded-md border border-[--cmp-border-strong] bg-[--cmp-surface-strong] p-3 shadow-sm">
          <p className="text-sm font-semibold">Selected point</p>
          <p className="text-sm">
            {(selected.city ?? selected.store ?? selected.id) as string}{' '}
            {sizeField && sizeField in selected ? `— ${legendFormat(selected[sizeField] as number)}` : ''}
          </p>
        </div>
      ) : null}

      {showLegend ? (
        <MapLegend
          colorScale={
            showColorLegend
              ? {
                  type: 'continuous',
                  scale: createLinearScale(colorExtent, colorRange ?? DEFAULT_COLOR_RANGE),
                  label: colorField ?? 'Color metric',
                  format: legendFormat,
                }
              : undefined
          }
          sizeScale={
            sizeField
              ? {
                  scale: createSqrtSizeScale(sizeExtent, sizeRange ?? [6, 36]),
                  label: sizeField,
                  format: legendFormat,
                }
              : undefined
          }
          position="bottom-right"
          orientation="horizontal"
          className="!bottom-20"
        />
      ) : null}
    </div>
  );
}

const meta = {
  title: 'Visualization/Spatial/Bubble Map',
  component: BubbleStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bubble (symbol) maps with clustering, categorical coloring, table fallbacks, and interaction demos using real coordinates.',
      },
    },
  },
  argTypes: {
    specProjection: { control: 'select', options: ['albersUsa', 'mercator', 'equalEarth', 'naturalEarth1'] },
    sizeRange: { control: 'object' },
    colorField: { control: 'select', options: ['region', 'category', 'sales', 'revenue', 'status', 'traffic', 'visits', 'riders'] },
    colorType: { control: 'select', options: ['categorical', 'continuous'] },
    colorRange: { control: 'object' },
    clusterEnabled: { control: 'boolean' },
    clusterRadius: { control: { type: 'range', min: 8, max: 40, step: 1 } },
    clusterMinPoints: { control: { type: 'number', min: 1, max: 10, step: 1 } },
    showLegend: { control: 'boolean' },
    enableTooltip: { control: 'boolean' },
    enableSelection: { control: 'boolean' },
    geoData: { control: false },
    data: { control: false },
    longitudeField: { control: false },
    latitudeField: { control: false },
    sizeField: { control: false },
    a11y: { control: false },
  },
} satisfies Meta<BubbleStoryArgs>;

export default meta;
type Story = StoryObj<BubbleStoryArgs>;

export const Default: Story = {
  args: {
    data: retailLocations,
    geoData: usStatesGeoData,
    specProjection: 'albersUsa',
    longitudeField: 'lon',
    latitudeField: 'lat',
    sizeField: 'sales',
    sizeRange: [8, 42],
    sizeScale: 'sqrt',
    colorField: 'region',
    colorType: 'categorical',
    colorRange: CATEGORY_COLORS,
    clusterEnabled: false,
    clusterRadius: 18,
    clusterMinPoints: 3,
    showLegend: true,
    enableTooltip: true,
    enableSelection: true,
    a11y: {
      description: 'Store locations sized by revenue with regional coloring',
      tableFallback: { enabled: false, caption: 'Retail locations and revenue' },
      narrative: {
        summary: 'Revenue is concentrated in coastal markets with emerging gains in the south.',
        keyFindings: ['NYC and LA lead total sales', 'Dallas and Denver show solid mid-tier performance'],
      },
    },
  },
  render: (args) => (
    <BubbleStory {...args} title="Default: revenue-sized store locations with regional coloring and controls" />
  ),
};

export const Clustered: Story = {
  args: {
    data: clusteredPoints,
    geoData: usStatesGeoData,
    specProjection: 'albersUsa',
    longitudeField: 'lon',
    latitudeField: 'lat',
    sizeField: 'visits',
    sizeRange: [6, 32],
    sizeScale: 'sqrt',
    colorField: undefined,
    colorType: undefined,
    colorRange: DEFAULT_COLOR_RANGE,
    clusterEnabled: true,
    clusterRadius: 24,
    clusterMinPoints: 3,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'Dense point clustering example with visit counts',
      tableFallback: { enabled: false, caption: 'Visit density by cluster' },
      narrative: {
        summary: 'Hotspots center around Midtown; clusters summarize dense visits.',
        keyFindings: ['Clustering reduces visual overload', 'Hover to inspect representative points'],
      },
    },
  },
  render: (args) => (
    <BubbleStory {...args} title="Clustered: dense midtown points with clustering and adjustable radius" />
  ),
};

export const Categorized: Story = {
  args: {
    data: categorizedLocations,
    geoData: usStatesGeoData,
    specProjection: 'albersUsa',
    longitudeField: 'lon',
    latitudeField: 'lat',
    sizeField: 'revenue',
    sizeRange: [8, 38],
    sizeScale: 'sqrt',
    colorField: 'category',
    colorType: 'categorical',
    colorRange: CATEGORY_COLORS,
    clusterEnabled: false,
    clusterRadius: 18,
    clusterMinPoints: 3,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'Categorized bubbles sized by revenue and colored by store class',
      tableFallback: { enabled: false, caption: 'Store class and revenue' },
      narrative: {
        summary: 'Flagships dominate revenue while outlet locations remain smaller.',
        keyFindings: ['Flagship stores lead in the West and Northeast', 'Partners provide coverage in Miami'],
      },
    },
  },
  render: (args) => (
    <BubbleStory {...args} title="Categorized: color by store class and size by revenue" />
  ),
};

export const Interactions: Story = {
  args: {
    data: retailLocations,
    geoData: usStatesGeoData,
    specProjection: 'albersUsa',
    longitudeField: 'lon',
    latitudeField: 'lat',
    sizeField: 'sales',
    sizeRange: [8, 42],
    sizeScale: 'sqrt',
    colorField: 'region',
    colorType: 'categorical',
    colorRange: CATEGORY_COLORS,
    clusterEnabled: false,
    clusterRadius: 18,
    clusterMinPoints: 3,
    showLegend: true,
    enableTooltip: true,
    enableSelection: true,
    a11y: {
      description: 'Interaction demo with hover tooltips and click selection',
      tableFallback: { enabled: false, caption: 'Interactive selection data' },
      narrative: {
        summary: 'Use hover for quick insights and click to pin selections for dashboards.',
        keyFindings: ['Selection is keyboard accessible', 'Hover matches the a11y live region output'],
      },
    },
  },
  render: (args) => (
    <BubbleStory {...args} title="Interactions: hover tooltip + click-to-select for dashboard wiring" />
  ),
};

export const NoBasemap: Story = {
  args: {
    data: worldHubs,
    geoData: EMPTY_GEOJSON,
    specProjection: 'naturalEarth1',
    longitudeField: 'lon',
    latitudeField: 'lat',
    sizeField: 'traffic',
    sizeRange: [10, 40],
    sizeScale: 'sqrt',
    colorField: 'traffic',
    colorType: 'continuous',
    colorRange: DEFAULT_COLOR_RANGE,
    clusterEnabled: false,
    clusterRadius: 18,
    clusterMinPoints: 3,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'No basemap view highlighting global hubs only',
      tableFallback: { enabled: false, caption: 'Traffic by global hub' },
      narrative: {
        summary: 'Focus exclusively on symbol data without basemap context.',
        keyFindings: ['Tokyo leads traffic volume', 'Singapore and London follow as dense hubs'],
      },
    },
  },
  render: (args) => <BubbleStory {...args} title="No basemap: points only with global traffic metric" />,
};

export const Accessibility: Story = {
  args: {
    data: accessibilityLocations,
    geoData: usStatesGeoData,
    specProjection: 'albersUsa',
    longitudeField: 'lon',
    latitudeField: 'lat',
    sizeField: 'riders',
    sizeRange: [8, 32],
    sizeScale: 'sqrt',
    colorField: 'status',
    colorType: 'categorical',
    colorRange: CATEGORY_COLORS,
    clusterEnabled: false,
    clusterRadius: 18,
    clusterMinPoints: 3,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'Accessibility story with table and narrative fallback for ridership',
      tableFallback: { enabled: true, caption: 'Transit ridership by city' },
      narrative: {
        summary: 'Narrative + table ensure parity with the visual bubbles for screen readers.',
        keyFindings: ['Portland and Minneapolis lead stable ridership', 'Detroit is trending down and needs focus'],
      },
    },
  },
  render: (args) => (
    <BubbleStory
      {...args}
      title="Accessibility: table fallback, narrative summary, and live hover announcements for bubbles"
    />
  ),
};
