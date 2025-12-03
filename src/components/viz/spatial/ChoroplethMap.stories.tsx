/**
 * Storybook stories for ChoroplethMap component.
 *
 * This set focuses on realistic data, comprehensive controls, and explicit
 * accessibility demonstrations so stories double as documentation.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState, type JSX } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { ChoroplethMap, type ChoroplethMapProps } from './ChoroplethMap.js';
import { MapLegend, type MapLegendProps } from './MapLegend.js';
import { SpatialContainer } from './SpatialContainer.js';
import {
  createQuantileScale,
  createQuantizeScale,
  createThresholdScale,
} from './utils/color-scale-utils.js';
import type { ProjectionType, SpatialSpec } from '../../../types/viz/spatial.js';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import usStatesTopology from './fixtures/us-states-10m.json';
import worldCountriesTopology from './fixtures/world-countries-110m.json';

interface ChoroplethStoryArgs
  extends Omit<ChoroplethMapProps, 'data' | 'projection'> {
  data: DataRecord[];
  geoData: FeatureCollection<Geometry>;
  projection: ProjectionType;
  showLegend: boolean;
  enableTooltip: boolean;
  enableSelection: boolean;
  title?: string;
}

const DEFAULT_DIMENSIONS = { width: 1100, height: 640 };
const SEQUENTIAL_RANGE = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
];
const DIVERGING_RANGE = [
  'var(--oods-viz-scale-diverging-neg-03)',
  'var(--oods-viz-scale-diverging-neg-01)',
  'var(--oods-viz-scale-diverging-pos-01)',
  'var(--oods-viz-scale-diverging-pos-03)',
];

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
const worldCountriesGeoData = toFeatureCollection(worldCountriesTopology as unknown as Topology, 'countries');

const salesByState: DataRecord[] = [
  { name: 'California', sales: 2_320_000, change: 0.12 },
  { name: 'Texas', sales: 1_850_000, change: 0.08 },
  { name: 'Florida', sales: 1_420_000, change: 0.06 },
  { name: 'New York', sales: 1_680_000, change: 0.09 },
  { name: 'Illinois', sales: 970_000, change: 0.04 },
  { name: 'Pennsylvania', sales: 1_010_000, change: 0.05 },
  { name: 'Georgia', sales: 880_000, change: 0.05 },
  { name: 'Washington', sales: 720_000, change: 0.07 },
  { name: 'Colorado', sales: 560_000, change: 0.03 },
  { name: 'Arizona', sales: 640_000, change: 0.05 },
];

const worldPopulation: DataRecord[] = [
  { name: 'United States of America', population: 331_900_000 },
  { name: 'Canada', population: 38_900_000 },
  { name: 'Brazil', population: 214_300_000 },
  { name: 'United Kingdom', population: 67_200_000 },
  { name: 'France', population: 67_500_000 },
  { name: 'Germany', population: 83_100_000 },
  { name: 'Nigeria', population: 216_700_000 },
  { name: 'India', population: 1_408_000_000 },
  { name: 'China', population: 1_412_000_000 },
  { name: 'Japan', population: 125_000_000 },
  { name: 'Australia', population: 26_000_000 },
];

const wellbeingIndex: DataRecord[] = [
  { name: 'Oregon', wellbeing: 68, healthScore: 71 },
  { name: 'Nevada', wellbeing: 55, healthScore: 58 },
  { name: 'Idaho', wellbeing: 62, healthScore: 64 },
  { name: 'Utah', wellbeing: 74, healthScore: 77 },
  { name: 'Montana', wellbeing: 60, healthScore: 63 },
  { name: 'Wyoming', wellbeing: 57, healthScore: 59 },
  { name: 'Arizona', wellbeing: 59, healthScore: 61 },
  { name: 'Colorado', wellbeing: 71, healthScore: 73 },
];

const defaultA11y = {
  description: 'Regional performance map',
  tableFallback: { enabled: true, caption: 'Regional performance with totals' },
  narrative: {
    summary: 'Sales concentration is strongest on the coasts with steady growth in the south.',
    keyFindings: [
      'California leads revenue with $2.3M',
      'Texas and New York anchor the second tier',
      'Mountain West shows emerging growth signals',
    ],
  },
};

function getNumericExtent(data: DataRecord[], field: string): [number, number] {
  const values = data
    .map((entry) => {
      const value = entry[field];
      return typeof value === 'number' ? value : Number.NaN;
    })
    .filter((value) => Number.isFinite(value)) as number[];

  if (values.length === 0) {
    return [0, 0];
  }
  return [Math.min(...values), Math.max(...values)];
}

function legendFormatter(valueField: string): (value: number) => string {
  if (valueField === 'population') {
    return (value) => `${Math.round(value / 1_000_000)}M`;
  }
  if (valueField === 'sales') {
    return (value) => `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return (value) => value.toLocaleString();
}

function buildLegendScale(
  args: Pick<ChoroplethStoryArgs, 'colorScale' | 'colorRange' | 'thresholds' | 'data' | 'valueField'>
): MapLegendProps['colorScale'] | null {
  const { colorScale = 'quantize', colorRange = SEQUENTIAL_RANGE, thresholds, data, valueField } = args;
  const values = data
    .map((entry) => (typeof entry[valueField] === 'number' ? (entry[valueField] as number) : null))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  if (colorScale === 'quantile') {
    return { type: 'categorical', scale: createQuantileScale(values, colorRange) };
  }
  if (colorScale === 'threshold') {
    const appliedThresholds = thresholds?.length ? thresholds : [750_000, 1_250_000, 1_750_000, 2_250_000];
    return { type: 'categorical', scale: createThresholdScale(appliedThresholds, colorRange) };
  }
  const extent = getNumericExtent(data, valueField);
  return { type: 'categorical', scale: createQuantizeScale(extent, colorRange) };
}

function ChoroplethStory({
  data,
  geoData,
  projection,
  showLegend,
  enableTooltip,
  enableSelection,
  thresholds,
  title,
  ...mapArgs
}: ChoroplethStoryArgs): JSX.Element {
  const [hovered, setHovered] = useState<DataRecord | null>(null);
  const [selected, setSelected] = useState<DataRecord | null>(null);

  const spec: SpatialSpec = useMemo(
    () => ({
      type: 'spatial',
      data: { values: data },
      projection: { type: projection, fitToData: true },
      layers: [{ type: 'regionFill', encoding: { color: { field: mapArgs.valueField } } }],
      a11y: mapArgs.a11y,
    }),
    [data, mapArgs.a11y, mapArgs.valueField, projection]
  );

  const legendScale = useMemo(
    () =>
      showLegend
        ? buildLegendScale({
            colorScale: mapArgs.colorScale,
            colorRange: mapArgs.colorRange,
            thresholds,
            data,
            valueField: mapArgs.valueField,
          })
        : null,
    [data, mapArgs.colorRange, mapArgs.colorScale, mapArgs.valueField, showLegend, thresholds]
  );
  const legendLabel =
    mapArgs.valueField === 'population'
      ? 'Population'
      : mapArgs.valueField === 'sales'
        ? 'Sales'
        : 'Metric';
  const legendFormat = useMemo(() => legendFormatter(mapArgs.valueField), [mapArgs.valueField]);

  return (
    <div className="space-y-4">
      {title ? <p className="text-sm text-[--cmp-text-muted]">{title}</p> : null}
      <SpatialContainer
        spec={spec}
        geoData={geoData}
        data={data}
        width={DEFAULT_DIMENSIONS.width}
        height={DEFAULT_DIMENSIONS.height}
        a11y={mapArgs.a11y}
        onFeatureClick={
          enableSelection
            ? (_feature, datum) => {
                setSelected(datum ?? null);
              }
            : undefined
        }
        onFeatureHover={
          enableTooltip
            ? (_feature, datum) => {
                setHovered(datum ?? null);
              }
            : undefined
        }
      >
        <ChoroplethMap
          {...mapArgs}
          data={data}
          projection={projection}
          thresholds={mapArgs.colorScale === 'threshold' ? thresholds : undefined}
          colorRange={mapArgs.colorRange ?? SEQUENTIAL_RANGE}
        />
      </SpatialContainer>

      {enableTooltip && hovered ? (
        <div className="rounded-md border border-[--cmp-border-muted] bg-[--cmp-surface] p-3 shadow-sm">
          <p className="text-sm font-semibold">
            {typeof hovered.name === 'string' ? hovered.name : 'Region'}
          </p>
          {mapArgs.valueField in hovered ? (
            <p className="text-sm">
              {mapArgs.valueField}: {(hovered[mapArgs.valueField] as number | string).toLocaleString()}
            </p>
          ) : null}
          {'change' in hovered ? (
            <p className="text-sm">Change: {Math.round((Number(hovered.change) ?? 0) * 100)}%</p>
          ) : null}
        </div>
      ) : null}

      {enableSelection && selected ? (
        <div className="rounded-md border border-[--cmp-border-strong] bg-[--cmp-surface-strong] p-3 shadow-sm">
          <p className="text-sm font-semibold">Selected region</p>
          <p className="text-sm">
            {typeof selected.name === 'string' ? selected.name : 'Unknown'} —{' '}
            {mapArgs.valueField in selected
              ? (selected[mapArgs.valueField] as number | string).toLocaleString()
              : 'No metric'}
          </p>
        </div>
      ) : null}

      {legendScale ? (
        <MapLegend
          colorScale={{ ...legendScale, label: legendLabel, format: legendFormat }}
          position="bottom-right"
          orientation="horizontal"
        />
      ) : null}
    </div>
  );
}

const meta = {
  title: 'Visualization/Spatial/Choropleth Map',
  component: ChoroplethStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Choropleth map with real GeoJSON/TopoJSON data, full controls, interaction demos, and accessibility fallbacks.',
      },
    },
  },
  argTypes: {
    projection: { control: 'select', options: ['albersUsa', 'mercator', 'equalEarth', 'naturalEarth1'] },
    colorScale: { control: 'select', options: ['quantize', 'quantile', 'threshold'] },
    colorRange: { control: 'object' },
    showLegend: { control: 'boolean' },
    enableTooltip: { control: 'boolean' },
    enableSelection: { control: 'boolean' },
    thresholds: { control: 'object' },
    geoData: { control: false },
    data: { control: false },
    geoJoinKey: { control: false },
    valueField: { control: false },
    a11y: { control: false },
  },
} satisfies Meta<ChoroplethStoryArgs>;

export default meta;
type Story = StoryObj<ChoroplethStoryArgs>;

export const Default: Story = {
  args: {
    data: salesByState,
    geoData: usStatesGeoData,
    valueField: 'sales',
    geoJoinKey: 'name',
    projection: 'albersUsa',
    colorScale: 'quantize',
    colorRange: SEQUENTIAL_RANGE,
    showLegend: true,
    enableTooltip: true,
    enableSelection: true,
    a11y: {
      ...defaultA11y,
      description: 'US sales by state (2024)',
      tableFallback: { enabled: false, caption: 'Sales by state (USD)' },
    },
  },
  render: (args) => (
    <ChoroplethStory {...args} title="Default: US states choropleth with sales data and interactive controls" />
  ),
};

export const WorldMap: Story = {
  args: {
    data: worldPopulation,
    geoData: worldCountriesGeoData,
    valueField: 'population',
    geoJoinKey: 'name',
    projection: 'equalEarth',
    colorScale: 'quantile',
    colorRange: SEQUENTIAL_RANGE,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'World population by country (2024)',
      narrative: {
        summary: 'Population concentrates in India and China with strong representation across the Americas.',
        keyFindings: ['India narrowly edges China', 'Nigeria leads African growth', 'US remains the third most populous'],
      },
      tableFallback: { enabled: false, caption: 'Population by country' },
    },
  },
  render: (args) => (
    <ChoroplethStory {...args} title="World countries with population using Equal Earth projection" />
  ),
};

export const ColorScales: Story = {
  args: {
    data: wellbeingIndex,
    geoData: usStatesGeoData,
    valueField: 'wellbeing',
    geoJoinKey: 'name',
    projection: 'albersUsa',
    colorScale: 'threshold',
    colorRange: DIVERGING_RANGE,
    thresholds: [55, 62, 70],
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'Wellbeing index across western states with diverging palette',
      tableFallback: { enabled: false, caption: 'Wellbeing by state' },
      narrative: {
        summary: 'Utah and Colorado lead the wellbeing index; Nevada trails the cohort.',
        keyFindings: ['Utah scores above 70', 'Colorado remains high across wellbeing and health scores'],
      },
    },
  },
  render: (args) => (
    <ChoroplethStory
      {...args}
      title="Color scales: switch between quantize, quantile, and threshold to compare palette behavior"
    />
  ),
};

export const Interactions: Story = {
  args: {
    data: salesByState,
    geoData: usStatesGeoData,
    valueField: 'sales',
    geoJoinKey: 'name',
    projection: 'albersUsa',
    colorScale: 'quantize',
    colorRange: SEQUENTIAL_RANGE,
    showLegend: true,
    enableTooltip: true,
    enableSelection: true,
    a11y: {
      description: 'Interactive hover and click selection for sales map',
      tableFallback: { enabled: false, caption: 'Sales by state (interactive)' },
      narrative: {
        summary: 'Use hover for tooltips and click to pin a region for dashboard context.',
        keyFindings: ['Interactions mirror keyboard focus cues', 'Selection updates live region announcements'],
      },
    },
  },
  render: (args) => (
    <ChoroplethStory {...args} title="Hover highlights and click-to-select interactions for dashboard wiring" />
  ),
};

export const Projections: Story = {
  args: {
    data: worldPopulation,
    geoData: worldCountriesGeoData,
    valueField: 'population',
    geoJoinKey: 'name',
    projection: 'naturalEarth1',
    colorScale: 'quantize',
    colorRange: SEQUENTIAL_RANGE,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'Projection comparison story for spatial rendering',
      tableFallback: { enabled: false, caption: 'Population by country' },
      narrative: {
        summary: 'Toggle projections to validate shape fidelity and scale for global data.',
        keyFindings: ['Equal Earth maintains area balance', 'Mercator exaggerates high latitudes'],
      },
    },
  },
  render: (args) => (
    <ChoroplethStory {...args} title="Projection variants: Mercator, AlbersUSA, EqualEarth, NaturalEarth1" />
  ),
};

export const Accessibility: Story = {
  args: {
    data: salesByState,
    geoData: usStatesGeoData,
    valueField: 'sales',
    geoJoinKey: 'name',
    projection: 'albersUsa',
    colorScale: 'quantile',
    colorRange: SEQUENTIAL_RANGE,
    showLegend: true,
    enableTooltip: true,
    enableSelection: false,
    a11y: {
      description: 'Accessible choropleth with table and narrative fallback',
      tableFallback: { enabled: true, caption: 'Sales by state (sortable)' },
      narrative: {
        summary: 'Narrative and tabular fallbacks accompany the visual map for accessibility.',
        keyFindings: ['Supports screen reader announcements', 'Table fallback keeps metric parity with the map'],
      },
    },
  },
  render: (args) => <ChoroplethStory {...args} title="Accessibility: table fallback and narrative always visible" />,
};
