import type { FeatureCollection, Feature } from 'geojson';
import type { EChartsOption, GeoComponentOption, MapSeriesOption, VisualMapComponentOption } from 'echarts';
import { isGeoJoinData, type RegionFillLayer, type SpatialSpec } from '@/types/viz/spatial.js';
import { buildEChartsTooltipFormatter, createChoroplethTooltipFields } from '../../tooltip/spatial-tooltip-config.js';
import { joinGeoWithData, type DataRecord } from './geo-data-joiner.js';
import { registerGeoJson, type GeoRegistration } from './echarts-geo-registration.js';
import { createVisualMapForScale } from './echarts-visualmap-generator.js';

const DEFAULT_MAP_NAME = 'custom-geo';
const DEFAULT_AREA_COLOR = 'var(--sys-surface-strong, #f2f2f2)';
const DEFAULT_BORDER_COLOR = 'var(--sys-border-subtle, #e0e0e0)';
const DEFAULT_EMPHASIS_COLOR = 'var(--sys-surface-raised, #dbeafe)';

interface ChoroplethBuildResult {
  readonly series: MapSeriesOption;
  readonly visualMap: VisualMapComponentOption;
  readonly registration: GeoRegistration;
  readonly geo: GeoComponentOption;
}

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function deriveMapName(spec: SpatialSpec): string {
  if (spec.geo?.feature && typeof spec.geo.feature === 'string') {
    return spec.geo.feature;
  }
  if (spec.geo?.source && typeof spec.geo.source === 'string') {
    const segments = spec.geo.source.split('/');
    return segments[segments.length - 1] || DEFAULT_MAP_NAME;
  }
  if (spec.id) {
    return `map-${spec.id}`;
  }
  if (spec.name) {
    return spec.name.toLowerCase().replace(/\\s+/g, '-');
  }
  return DEFAULT_MAP_NAME;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveName(properties: Record<string, unknown>, feature: Feature, nameField: string): string {
  const candidate = properties[nameField] ?? properties.name ?? feature.id;
  return candidate !== undefined ? String(candidate) : 'unknown';
}

function buildGeoComponent(mapName: string, roam: boolean): GeoComponentOption {
  return pruneUndefined({
    map: mapName,
    roam,
    label: { show: false },
    itemStyle: {
      areaColor: DEFAULT_AREA_COLOR,
      borderColor: DEFAULT_BORDER_COLOR,
    },
    emphasis: {
      itemStyle: { areaColor: DEFAULT_EMPHASIS_COLOR },
    },
  });
}

function collectDomainValues(
  features: readonly Feature[],
  valueField: string
): number[] {
  const values: number[] = [];
  for (const feature of features) {
    const properties = feature.properties as Record<string, unknown> | undefined;
    if (!properties) {
      continue;
    }
    const value = coerceNumber(properties[valueField]);
    if (value !== null) {
      values.push(value);
    }
  }
  return values;
}

export function buildChoropleth(
  spec: SpatialSpec,
  layer: RegionFillLayer,
  geoData: FeatureCollection,
  data: DataRecord[] | undefined
): ChoroplethBuildResult {
  const mapName = deriveMapName(spec);
  const join = isGeoJoinData(spec.data) ? spec.data : null;
  const nameField = join?.geoKey ?? 'name';

  const features = geoData.features;
  const mergedFeatures =
    join && data
      ? joinGeoWithData(features, data, { geoKey: join.geoKey, dataKey: join.joinKey }).features
      : features;

  const domainValues = collectDomainValues(mergedFeatures, layer.encoding.color.field);
  const visualMap = createVisualMapForScale({
    scale: layer.encoding.color.scale,
    domain: (layer.encoding.color.domain as [number, number] | undefined) ?? undefined,
    range: layer.encoding.color.range,
    values: domainValues,
  });

  const seriesData = mergedFeatures.map((feature) => {
    const properties = feature.properties as Record<string, unknown> | undefined;
    const name = resolveName(properties ?? {}, feature, nameField);
    const rawValue = properties ? properties[layer.encoding.color.field] : null;
    return {
      name,
      value: coerceNumber(rawValue) ?? undefined,
      rawProperties: properties,
    };
  });

  const geo = buildGeoComponent(mapName, Boolean(spec.interactions?.some((interaction) => interaction.type === 'panZoom')));
  const registration = registerGeoJson(mapName, { type: 'FeatureCollection', features: mergedFeatures });

  const series = pruneUndefined({
    type: 'map',
    map: mapName,
    geoIndex: 0,
    name: spec.name ?? 'Choropleth',
    data: seriesData,
    emphasis: { focus: 'self' },
  }) as unknown as MapSeriesOption;

  return {
    series,
    visualMap,
    registration,
    geo,
  };
}

export function adaptChoroplethToECharts(
  spec: SpatialSpec,
  geoData: FeatureCollection,
  data: DataRecord[] | undefined,
  dimensions: { readonly width: number; readonly height: number }
): EChartsOption {
  if (!geoData) {
    throw new Error('GeoJSON FeatureCollection is required for choropleth maps.');
  }

  const regionLayer = spec.layers.find((layer): layer is RegionFillLayer => layer.type === 'regionFill');
  if (!regionLayer) {
    throw new Error('Spatial spec is missing a regionFill layer required for choropleth rendering.');
  }

  const result = buildChoropleth(spec, regionLayer, geoData, data);
  const nameField = isGeoJoinData(spec.data) ? spec.data.geoKey : 'name';
  const tooltipFormatter = buildEChartsTooltipFormatter(
    createChoroplethTooltipFields({ regionField: nameField, valueField: regionLayer.encoding.color.field })
  );

  const option = pruneUndefined({
    geo: result.geo,
    visualMap: result.visualMap,
    series: [result.series],
    tooltip: { trigger: 'item', formatter: tooltipFormatter },
    aria: { enabled: true, description: spec.a11y?.description },
    title: spec.name ? { text: spec.name } : undefined,
    usermeta: {
      oods: pruneUndefined({
        specId: spec.id,
        name: spec.name,
        theme: spec.config?.theme,
        tokens: spec.config?.tokens,
        a11y: spec.a11y,
        layout: spec.config?.layout,
        dimensions,
      }),
    },
  }) as unknown as EChartsOption;

  // Expose registration info for callers who need manual map registration.
  (option as Record<string, unknown>).__registration = result.registration;

  return option;
}

export type { ChoroplethBuildResult };
