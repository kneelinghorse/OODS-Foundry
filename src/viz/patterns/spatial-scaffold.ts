export interface SpatialScaffoldOptions {
  readonly type: 'choropleth' | 'bubble';
  readonly geoSource?: string;
  readonly valueField?: string;
  readonly regionField?: string;
  readonly latField?: string;
  readonly lonField?: string;
  readonly sizeField?: string;
  readonly colorField?: string;
}

export function generateSpatialScaffold(options: SpatialScaffoldOptions): string {
  if (options.type === 'bubble') {
    return buildBubbleScaffold(options);
  }
  return buildChoroplethScaffold(options);
}

function buildChoroplethScaffold(options: SpatialScaffoldOptions): string {
  const regionField = options.regionField ?? 'region';
  const valueField = options.valueField ?? 'value';
  const geoSource = options.geoSource ?? 'us-states.topojson';

  return `import type { FeatureCollection } from 'geojson';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer.js';
import { ChoroplethMap } from '@/components/viz/spatial/ChoroplethMap.js';
import { MapLegend } from '@/components/viz/spatial/MapLegend.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';

// Replace with a real GeoJSON/TopoJSON source
const geoData: FeatureCollection = { type: 'FeatureCollection', features: [] };

const data = [
  { ${regionField}: 'Region A', ${valueField}: 120 },
  { ${regionField}: 'Region B', ${valueField}: 95 },
  { ${regionField}: 'Region C', ${valueField}: 60 }
];

const spec: SpatialSpec = {
  type: 'spatial',
  data: { values: data },
  projection: { type: 'albersUsa', fitToData: true },
  geo: { source: '${geoSource}', format: 'topojson' },
  layers: [
    {
      type: 'regionFill',
      encoding: {
        color: { field: '${valueField}', scale: 'quantize', range: [
          'var(--oods-viz-scale-sequential-01)',
          'var(--oods-viz-scale-sequential-03)',
          'var(--oods-viz-scale-sequential-05)',
          'var(--oods-viz-scale-sequential-07)'
        ] }
      }
    }
  ],
  a11y: {
    description: 'Choropleth showing ${valueField} by ${regionField}',
    tableFallback: {
      enabled: true,
      caption: 'Choropleth data for ${regionField}',
      sortDefault: '${valueField}',
      sortOrder: 'desc'
    },
    narrative: {
      summary: 'Auto-generated spatial scaffold',
      keyFindings: [
        'Edit the narrative to reflect your data.',
        'Ensure join keys match your GeoJSON properties.'
      ]
    }
  }
};

export function ChoroplethScaffold(): JSX.Element {
  return (
    <SpatialContainer
      spec={spec}
      data={data}
      geoData={geoData}
      width={960}
      height={600}
      a11y={{ description: 'Choropleth scaffold with accessibility defaults' }}
    >
      <ChoroplethMap
        data={data}
        geoJoinKey="${regionField}"
        valueField="${valueField}"
        colorRange={[
          'var(--oods-viz-scale-sequential-01)',
          'var(--oods-viz-scale-sequential-03)',
          'var(--oods-viz-scale-sequential-05)',
          'var(--oods-viz-scale-sequential-07)'
        ]}
        a11y={{ description: 'Map of ${regionField} values' }}
      />
      <MapLegend
        title='${valueField} by ${regionField}'
        stops={[
          { label: 'Low', color: 'var(--oods-viz-scale-sequential-01)' },
          { label: 'Medium', color: 'var(--oods-viz-scale-sequential-03)' },
          { label: 'High', color: 'var(--oods-viz-scale-sequential-07)' }
        ]}
      />
    </SpatialContainer>
  );
}
`;
}

function buildBubbleScaffold(options: SpatialScaffoldOptions): string {
  const latField = options.latField ?? 'latitude';
  const lonField = options.lonField ?? 'longitude';
  const sizeField = options.sizeField ?? options.valueField ?? 'magnitude';
  const colorField = options.colorField ?? 'category';

  return `import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer.js';
import { BubbleMap } from '@/components/viz/spatial/BubbleMap.js';
import type { SpatialSpec } from '@/types/viz/spatial.js';

const data = [
  { name: 'Location A', ${latField}: 37.7749, ${lonField}: -122.4194, ${sizeField}: 120, ${colorField}: 'west' },
  { name: 'Location B', ${latField}: 34.0522, ${lonField}: -118.2437, ${sizeField}: 80, ${colorField}: 'west' },
  { name: 'Location C', ${latField}: 40.7128, ${lonField}: -74.006, ${sizeField}: 150, ${colorField}: 'east' }
];

const spec: SpatialSpec = {
  type: 'spatial',
  data: { values: data },
  projection: { type: 'mercator', fitToData: true },
  layers: [
    {
      type: 'symbol',
      encoding: {
        longitude: { field: '${lonField}' },
        latitude: { field: '${latField}' },
        size: { field: '${sizeField}', range: [6, 36] },
        color: { field: '${colorField}' }
      }
    }
  ],
  a11y: {
    description: 'Bubble map showing ${sizeField} by location',
    tableFallback: { enabled: true, caption: 'Bubble map data' },
    narrative: {
      summary: 'Auto-generated bubble map scaffold',
      keyFindings: [
        'Update summary and findings to describe your data.',
        'Ensure lat/lon fields are correct and use WGS84 coordinates.'
      ]
    }
  }
};

export function BubbleMapScaffold(): JSX.Element {
  return (
    <SpatialContainer
      spec={spec}
      data={data}
      width={960}
      height={600}
      a11y={{ description: 'Bubble map scaffold with accessibility defaults' }}
    >
      <BubbleMap
        data={data}
        latitudeField='${latField}'
        longitudeField='${lonField}'
        sizeField='${sizeField}'
        colorField='${colorField}'
        a11y={{ description: 'Bubble map scaffold' }}
      />
    </SpatialContainer>
  );
}
`;
}
