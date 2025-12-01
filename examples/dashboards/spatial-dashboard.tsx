import { useMemo, useReducer, type FC, type JSX } from 'react';
import type { Feature, FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import { RenderObject } from '../../src/components/RenderObject.js';
import type { RenderObjectProps } from '../../src/components/RenderObject.js';
import { ChoroplethMap } from '../../src/components/viz/spatial/ChoroplethMap.js';
import { BubbleMap } from '../../src/components/viz/spatial/BubbleMap.js';
import { MapControls } from '../../src/components/viz/spatial/MapControls.js';
import { MapLegend } from '../../src/components/viz/spatial/MapLegend.js';
import { SpatialContainer } from '../../src/components/viz/spatial/SpatialContainer.js';
import { createQuantizeScale } from '../../src/components/viz/spatial/utils/color-scale-utils.js';
import { createSqrtSizeScale } from '../../src/components/viz/spatial/utils/size-scale-utils.js';
import { selectVizRenderer } from '../../src/viz/adapters/renderer-selector.js';
import { createSpatialInteractionBindings, resolveGridSpan } from '../../src/viz/contexts/dashboard-spatial-context.js';
import {
  DEFAULT_SPATIAL_FILTER_STATE,
  spatialFilterReducer,
  summarizeFilters,
} from '../../src/viz/interactions/spatial-filter-actions.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';
import type { DashboardExample } from './user-adoption.js';
import type { SpatialSpec } from '../../src/types/viz/spatial.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';
import usStatesTopo from '../../src/components/viz/spatial/fixtures/us-states-10m.json';

interface StateMetric {
  readonly state: string;
  readonly value: number;
  readonly change: number;
  readonly lon: number;
  readonly lat: number;
}

interface HubLocation {
  readonly name: string;
  readonly state: string;
  readonly lon: number;
  readonly lat: number;
  readonly volume: number;
}

export interface SpatialDashboardRecord {
  readonly states: readonly StateMetric[];
  readonly hubs: readonly HubLocation[];
}

const STATE_METRICS: readonly StateMetric[] = [
  { state: 'California', value: 128, change: 6.4, lon: -119.4179, lat: 36.7783 },
  { state: 'Texas', value: 94, change: 3.1, lon: -99.9018, lat: 31.9686 },
  { state: 'Washington', value: 72, change: 4.0, lon: -120.7401, lat: 47.7511 },
  { state: 'Colorado', value: 65, change: 2.4, lon: -105.7821, lat: 39.5501 },
  { state: 'New York', value: 80, change: 5.1, lon: -75.0000, lat: 42.9000 },
];

const HUB_LOCATIONS: readonly HubLocation[] = [
  { name: 'Los Angeles', state: 'California', lon: -118.2437, lat: 34.0522, volume: 320 },
  { name: 'San Francisco', state: 'California', lon: -122.4194, lat: 37.7749, volume: 210 },
  { name: 'Seattle', state: 'Washington', lon: -122.3321, lat: 47.6062, volume: 190 },
  { name: 'Denver', state: 'Colorado', lon: -104.9903, lat: 39.7392, volume: 150 },
  { name: 'Austin', state: 'Texas', lon: -97.7431, lat: 30.2672, volume: 160 },
  { name: 'Dallas', state: 'Texas', lon: -96.7969, lat: 32.7767, volume: 180 },
  { name: 'New York City', state: 'New York', lon: -74.0000, lat: 40.7128, volume: 205 },
];

// Color ranges with CSS variable tokens and hex fallbacks
const CHOROPLETH_COLOR_RANGE = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
];

// Hex equivalents for legend display
const CHOROPLETH_COLOR_RANGE_HEX = ['#e8f4f8', '#a8d4e6', '#5ba3c0', '#2d6a8a'];

// Value extent for choropleth scale
const VALUE_EXTENT: [number, number] = [65, 128]; // min/max of STATE_METRICS.value

// Volume extent for bubble size scale
const VOLUME_EXTENT: [number, number] = [150, 320]; // min/max of HUB_LOCATIONS.volume

const CHOROPLETH_SPEC: SpatialSpec = {
  type: 'spatial',
  data: {
    type: 'data.geo.join',
    source: 'inline://dashboard-spatial',
    geoSource: 'inline://us-states',
    joinKey: 'state',
    geoKey: 'name',
  },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [
    {
      type: 'regionFill',
      encoding: {
        color: {
          field: 'value',
          scale: 'quantize',
          range: CHOROPLETH_COLOR_RANGE,
        },
        stroke: { value: 'var(--viz-map-region-stroke, var(--sys-border-strong))' },
        strokeWidth: { value: 1 },
      },
    },
  ],
  a11y: {
    description: 'Dashboard choropleth of state performance.',
    ariaLabel: 'US state performance choropleth map',
    tableFallback: { enabled: false, caption: 'State performance by value' },
  },
};

const BUBBLE_SPATIAL_SPEC: SpatialSpec = {
  type: 'spatial',
  data: {
    values: HUB_LOCATIONS as unknown as Record<string, unknown>[],
  },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [
    {
      type: 'symbol',
      encoding: {
        longitude: { field: 'lon' },
        latitude: { field: 'lat' },
        size: { field: 'volume', scale: 'sqrt', range: [6, 36] },
        color: { field: 'state', scale: 'ordinal' },
        opacity: { value: 0.85 },
      },
    },
  ],
  a11y: { description: 'Bubble map of hub volume by city' },
};

const BUBBLE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:spatial:hub-bubbles',
  name: 'Logistics hubs',
  data: {
    values: HUB_LOCATIONS as unknown as Record<string, unknown>[],
  },
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: { field: 'lon', trait: 'EncodingPositionX', channel: 'x' },
        y: { field: 'lat', trait: 'EncodingPositionY', channel: 'y' },
        color: { field: 'state', trait: 'EncodingColor', channel: 'color' },
        size: { field: 'volume', trait: 'EncodingSize', channel: 'size' },
      },
    },
  ],
  encoding: {
    x: { field: 'lon', trait: 'EncodingPositionX', channel: 'x' },
    y: { field: 'lat', trait: 'EncodingPositionY', channel: 'y' },
    color: { field: 'state', trait: 'EncodingColor', channel: 'color' },
    size: { field: 'volume', trait: 'EncodingSize', channel: 'size' },
  },
  a11y: { description: 'Bubble map of hub volume by city.' },
};

function toFeatureCollection(topology: typeof usStatesTopo, objectKey: string): FeatureCollection {
  const result = feature(
    topology as never,
    (topology as { objects: Record<string, unknown> }).objects[objectKey] as never
  ) as FeatureCollection | Feature;

  if (result.type === 'FeatureCollection') {
    return result;
  }

  return {
    type: 'FeatureCollection',
    features: [result],
  };
}

const US_STATES_GEOJSON: FeatureCollection = toFeatureCollection(usStatesTopo, 'states');

function normalizeState(value: string): string {
  return value.trim().toLowerCase();
}

function filterByRegions<T extends { state: string }>(
  rows: readonly T[],
  regions: ReadonlySet<string>
): readonly T[] {
  if (regions.size === 0) {
    return rows;
  }
  return rows.filter((row) => regions.has(normalizeState(row.state)));
}

function FiltersSummary({
  filters,
  onClear,
}: {
  readonly filters: ReturnType<typeof summarizeFilters>;
  readonly onClear: () => void;
}): JSX.Element {
  if (filters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-700">
        No spatial filters applied.
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
      <span className="text-slate-600 dark:text-slate-200">{filters.join(' · ')}</span>
      <button
        type="button"
        onClick={onClear}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] dark:border-slate-600"
      >
        Clear
      </button>
    </div>
  );
}

function StateTable({ rows }: { readonly rows: readonly StateMetric[] }): JSX.Element {
  return (
    <table className="w-full table-auto border-collapse text-sm">
      <thead>
        <tr className="text-left text-slate-500 dark:text-slate-300">
          <th className="border-b border-slate-200 py-2 dark:border-slate-700">State</th>
          <th className="border-b border-slate-200 py-2 dark:border-slate-700">Value</th>
          <th className="border-b border-slate-200 py-2 dark:border-slate-700">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.state} className="odd:bg-slate-50/60 dark:odd:bg-slate-800/40">
            <td className="py-2 font-medium text-slate-800 dark:text-slate-100">{row.state}</td>
            <td className="py-2 text-slate-700 dark:text-slate-200">{row.value.toFixed(1)}</td>
            <td className="py-2 text-emerald-600 dark:text-emerald-400">{`${row.change.toFixed(1)}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpatialDashboardPanels({
  data,
  viewportWidth,
}: {
  readonly data: SpatialDashboardRecord;
  readonly viewportWidth: number;
}): JSX.Element {
  const [filterState, dispatch] = useReducer(spatialFilterReducer, DEFAULT_SPATIAL_FILTER_STATE);
  const regionFilters = useMemo(
    () => new Set(filterState.regions.map((entry) => entry.regionId)),
    [filterState.regions]
  );

  const filteredStates = useMemo(
    () => filterByRegions(data.states, regionFilters),
    [data.states, regionFilters]
  );
  const filteredHubs = useMemo(
    () => filterByRegions(data.hubs, regionFilters),
    [data.hubs, regionFilters]
  );

  const choroplethBindings = useMemo(
    () => createSpatialInteractionBindings('dashboard:choropleth', dispatch),
    [dispatch]
  );
  const bubbleBindings = useMemo(
    () => createSpatialInteractionBindings('dashboard:bubble', dispatch),
    [dispatch]
  );

  const choroplethSpan = resolveGridSpan(undefined, viewportWidth);
  const bubbleSpan = resolveGridSpan({ cols: 1, rows: 1 }, viewportWidth);
  const mapWidth = Math.max(400, Math.min(540, (viewportWidth - 96) / 2));
  const mapHeight = 440;

  const bubbleRenderer = selectVizRenderer(BUBBLE_SPEC);
  const stateRecords = useMemo(
    () => data.states.map((row) => ({ ...row }) as Record<string, unknown>),
    [data.states]
  );
  const hubRecords = useMemo(
    () => filteredHubs.map((row) => ({ ...row }) as Record<string, unknown>),
    [filteredHubs]
  );
  const bubbleSpatialSpec = useMemo<SpatialSpec>(
    () => ({
      ...BUBBLE_SPATIAL_SPEC,
      data: {
        ...(BUBBLE_SPATIAL_SPEC.data as Record<string, unknown>),
        values: hubRecords,
      },
    }),
    [hubRecords]
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div
        data-dashboard-widget="spatial"
        data-spatial-kind="choropleth"
        data-grid-span-cols={choroplethSpan.cols}
        data-grid-span-rows={choroplethSpan.rows}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">State performance</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click a region to filter linked widgets
            </p>
          </div>
          <MapControls />
        </div>
        <div style={{ position: 'relative' }}>
          <SpatialContainer
            spec={CHOROPLETH_SPEC}
            geoData={US_STATES_GEOJSON}
            data={stateRecords}
            width={mapWidth}
            height={mapHeight}
            projection="albersUsa"
            a11y={{
              description: CHOROPLETH_SPEC.a11y.description,
              tableFallback: { enabled: false, caption: 'State performance' },
            }}
            onFeatureClick={(feature, datum) => choroplethBindings.onRegionClick(feature, datum ?? null)}
          >
            <ChoroplethMap
              data={stateRecords}
              valueField="value"
              geoJoinKey="name"
              dataJoinKey="state"
              colorScale="quantize"
              projection="albersUsa"
              colorRange={CHOROPLETH_COLOR_RANGE}
              onRegionClick={(feature, datum) => choroplethBindings.onRegionClick(feature, datum ?? null)}
              a11y={{
                description: 'State performance values',
                tableFallback: { enabled: false, caption: 'State performance' },
                narrative: { summary: 'Regional performance overview', keyFindings: [] },
              }}
            />
          </SpatialContainer>
          <MapLegend
            colorScale={{
              type: 'categorical',
              scale: createQuantizeScale(VALUE_EXTENT, CHOROPLETH_COLOR_RANGE_HEX),
              label: 'Performance',
              format: (v) => v.toFixed(0),
            }}
            position="bottom-right"
          />
        </div>
      </div>

      <div
        data-dashboard-widget="spatial"
        data-spatial-kind="bubble"
        data-grid-span-cols={bubbleSpan.cols}
        data-grid-span-rows={bubbleSpan.rows}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Hub volume</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click a bubble to focus linked widgets
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {bubbleRenderer.renderer}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <SpatialContainer
            spec={bubbleSpatialSpec}
            geoData={US_STATES_GEOJSON}
            data={hubRecords}
            width={mapWidth}
            height={mapHeight}
            projection="albersUsa"
            a11y={{
              description: 'Hub volume bubble map',
              tableFallback: { enabled: false, caption: 'Hub volume by city' },
            }}
          >
            <BubbleMap
              spec={BUBBLE_SPEC}
              data={hubRecords}
              geoData={US_STATES_GEOJSON}
              longitudeField="lon"
              latitudeField="lat"
              sizeField="volume"
              sizeRange={[6, 36]}
              colorField="state"
              colorType="categorical"
              projection="albersUsa"
              onPointClick={(datum) => bubbleBindings.onPointClick(datum as Record<string, unknown>)}
              a11y={{
                description: 'Hub volume bubble map',
                tableFallback: { enabled: false, caption: 'Hub volume by city' },
              }}
            />
          </SpatialContainer>
          <MapLegend
            sizeScale={{
              scale: createSqrtSizeScale(VOLUME_EXTENT, [6, 36]),
              label: 'Volume',
              format: (v) => v.toFixed(0),
            }}
            position="bottom-right"
          />
        </div>
      </div>

      <div className="lg:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Linked table</p>
        <FiltersSummary
          filters={summarizeFilters(filterState)}
          onClear={() => dispatch({ type: 'CLEAR_SPATIAL_FILTER' })}
        />
        <StateTable rows={filteredStates} />
      </div>
    </div>
  );
}

function createSpatialDashboardTrait(): TraitAdapter<SpatialDashboardRecord> {
  return {
    id: 'SpatialDashboard',
    view: () => [
      {
        id: 'spatial-dashboard:panels',
        region: 'main',
        type: 'section',
        priority: 60,
        render: (ctx) => (
          <SpatialDashboardPanels
            data={ctx.data}
            viewportWidth={ctx.viewport.width}
          />
        ),
        metadata: {
          tags: ['spatial-widget', 'dashboard'],
          notes: 'Choropleth and bubble map with linked filters',
        },
      },
    ],
  };
}

const SPATIAL_DASHBOARD_OBJECT: ObjectSpec<SpatialDashboardRecord> = {
  id: 'object:SpatialDashboard',
  name: 'Spatial dashboard',
  version: '1.0.0',
  traits: [createSpatialDashboardTrait()],
  metadata: {
    category: 'viz',
    status: 'experimental',
  },
};

const SPATIAL_DASHBOARD_DATA: SpatialDashboardRecord = {
  states: STATE_METRICS,
  hubs: HUB_LOCATIONS,
};

export function createSpatialDashboardExample(): DashboardExample<SpatialDashboardRecord> {
  return {
    object: SPATIAL_DASHBOARD_OBJECT,
    data: SPATIAL_DASHBOARD_DATA,
  };
}

export function SpatialDashboardPreview(): JSX.Element {
  const { object, data } = createSpatialDashboardExample();
  const DashboardRender = RenderObject as FC<RenderObjectProps<SpatialDashboardRecord>>;
  return <DashboardRender context="dashboard" object={object} data={data} />;
}
