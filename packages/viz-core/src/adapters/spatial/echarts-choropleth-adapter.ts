import type { TokenScope } from '../echarts/token-resolver.js';
// Choropleth (region-fill) ECharts adapter (sprint-112 m01 port).
// Ported from src/viz/adapters/spatial/echarts-choropleth-adapter.ts; only the
// imports are repointed (slim spatial spec + local tooltip config) and echarts is
// a TYPE-ONLY import. Logic is byte-identical to the source.

import type { FeatureCollection, Feature } from 'geojson';
import type { EChartsOption, GeoComponentOption, MapSeriesOption, VisualMapComponentOption } from 'echarts';
import { isGeoJoinData, type RegionFillLayer, type SpatialSpec } from '../../spec/spatial.js';
import { buildEChartsTooltipFormatter, createChoroplethTooltipFields } from './spatial-tooltip-config.js';
import { joinGeoWithData, type DataRecord } from './geo-data-joiner.js';
import { registerGeoJson, type GeoRegistration } from './echarts-geo-registration.js';
import { createVisualMapForScale } from './echarts-visualmap-generator.js';
import { resolveColor } from './geo-token-color.js';
import { applyHcEchartsChrome, resolveOodsEchartsChrome } from '../../tokens/oods-echarts-chrome.js';
import { withTitleBand } from './titled-geo.js';

const DEFAULT_MAP_NAME = 'custom-geo';
// Geo region fills/borders stay via resolveColor on the UNIFIED --oods-sys-* namespace
// (sprint-145 m02 re-point; hex-neutral — token-resolver already maps --sys-*→--oods-sys-*
// via the --oods- fallback, so the resolved bytes do not move). These are non-text
// surfaces certify does not grade; the geo golden churn is from the net-new
// backgroundColor + baked visualMap label, not this re-point (memo §2).
// s222-m02 (#2502 ruling 12): the land is the neutral's component background (step 3) in each theme; the token this read,
// --oods-sys-surface-strong, does not exist, so every theme painted the #f2f2f2 fallback, a light map on a dark canvas.
const DEFAULT_AREA_COLOR = 'var(--oods-sys-surface-subtle, #f2f2f2)';
const DEFAULT_BORDER_COLOR = 'var(--oods-sys-border-subtle, #e0e0e0)';
const DEFAULT_EMPHASIS_COLOR = 'var(--oods-sys-surface-raised, #dbeafe)';

/** Geo-join diagnostics (sprint-118 m06): data records / features that did not join. */
interface GeoJoinDiagnostics {
  /** Row join-key values with NO matching map feature (silently dropped today). */
  readonly unmatchedData: string[];
  /** Map feature ids with no matching data record. */
  readonly unmatchedFeatures: string[];
}

interface ChoroplethBuildResult {
  readonly series: MapSeriesOption;
  readonly visualMap: VisualMapComponentOption;
  readonly registration: GeoRegistration;
  readonly geo: GeoComponentOption;
  /** Present only when the join left something unmatched (additive; existing consumers ignore it). */
  readonly diagnostics?: GeoJoinDiagnostics;
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

function buildGeoComponent(mapName: string, roam: boolean, nameProperty?: string, scope: TokenScope = {}): GeoComponentOption {
  return pruneUndefined({
    map: mapName,
    nameProperty,
    roam,
    label: { show: false },
    itemStyle: {
      // HC owns a declared system canvas; the legacy light/dark fallback stays scoped.
      areaColor: resolveColor(scope.theme === 'hc' ? '--oods-sys-surface-canvas' : DEFAULT_AREA_COLOR, scope),
      borderColor: resolveColor(DEFAULT_BORDER_COLOR, scope),
    },
    emphasis: {
      itemStyle: { areaColor: resolveColor(scope.theme === 'hc' ? '--oods-sys-surface-canvas' : DEFAULT_EMPHASIS_COLOR, scope) },
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
  data: DataRecord[] | undefined,
  emitJoinNameProperty = false,
  scope: TokenScope = {}
): ChoroplethBuildResult {
  const mapName = deriveMapName(spec);
  const join = isGeoJoinData(spec.data) ? spec.data : null;
  const nameField = join?.geoKey ?? 'name';

  const features = geoData.features;
  // Capture the FULL join result (sprint-118 m06): today only `.features` is consumed and the
  // unmatchedData/unmatchedFeatures lists are silently dropped. Thread them up as diagnostics.
  const joinResult = join && data ? joinGeoWithData(features, data, { geoKey: join.geoKey, dataKey: join.joinKey }) : null;
  const mergedFeatures = joinResult ? joinResult.features : features;

  const domainValues = collectDomainValues(mergedFeatures, layer.encoding.color.field);
  const visualMap = createVisualMapForScale({
    scope,
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

  const geo = buildGeoComponent(
    mapName,
    Boolean(spec.interactions?.some((interaction) => interaction.type === 'panZoom')),
    emitJoinNameProperty && join ? nameField : undefined, scope);
  const registration = registerGeoJson(mapName, { type: 'FeatureCollection', features: mergedFeatures });

  const series = pruneUndefined({
    type: 'map',
    map: mapName,
    geoIndex: 0,
    name: spec.name ?? 'Choropleth',
    data: seriesData,
    emphasis: { focus: 'self', itemStyle: { areaColor: resolveColor(scope.theme === 'hc' ? '--oods-sys-surface-canvas' : DEFAULT_EMPHASIS_COLOR, scope) } },
  }) as unknown as MapSeriesOption;

  const diagnostics: GeoJoinDiagnostics | undefined =
    joinResult && (joinResult.unmatchedData.length > 0 || joinResult.unmatchedFeatures.length > 0)
      ? { unmatchedData: joinResult.unmatchedData, unmatchedFeatures: joinResult.unmatchedFeatures }
      : undefined;

  return {
    series,
    visualMap,
    registration,
    geo,
    ...(diagnostics ? { diagnostics } : {}),
  };
}

export function adaptChoroplethToECharts(
  spec: SpatialSpec,
  geoData: FeatureCollection,
  data: DataRecord[] | undefined,
  dimensions: { readonly width: number; readonly height: number },
  scope: TokenScope = {}
): EChartsOption {
  if (!geoData) {
    throw new Error('GeoJSON FeatureCollection is required for choropleth maps.');
  }

  const regionLayer = spec.layers.find((layer): layer is RegionFillLayer => layer.type === 'regionFill');
  if (!regionLayer) {
    throw new Error('Spatial spec is missing a regionFill layer required for choropleth rendering.');
  }

  const result = buildChoropleth(spec, regionLayer, geoData, data, true, scope);
  const chrome = resolveOodsEchartsChrome(spec, scope);
  const nameField = isGeoJoinData(spec.data) ? spec.data.geoKey : 'name';
  const tooltipFormatter = buildEChartsTooltipFormatter(
    createChoroplethTooltipFields({ regionField: nameField, valueField: regionLayer.encoding.color.field })
  );

  const option = pruneUndefined({
    backgroundColor: chrome.background,
    geo: withTitleBand(result.geo, spec.name),
    // Bake the visualMap numeric-tick label onto text-neutral (8.13:1 on the baked
    // canvas) — ECharts-default today, so ungraded chrome; the tripwire covers it (memo §6).
    visualMap: { ...result.visualMap, textStyle: { color: chrome.visualMapLabel } },
    series: [result.series],
    tooltip: { trigger: 'item', formatter: tooltipFormatter },
    aria: { enabled: true, description: spec.a11y?.description },
    // s222-m02: the title in the text colour of the theme (it was ECharts' default grey, unreadable on a dark canvas).
    title: spec.name ? { text: spec.name, textStyle: { color: chrome.title } } : undefined,
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

  // Expose geo-join diagnostics (sprint-118 m06) ONLY when something was unmatched — mirrors the
  // __registration escape hatch. viz.render reads this to emit OODS-V134 under a flag, then STRIPS
  // it from the returned echartsSpec so the default path stays byte-identical (silent-drop preserved).
  if (result.diagnostics) {
    (option as Record<string, unknown>).__joinDiagnostics = result.diagnostics;
  }

  return applyHcEchartsChrome(option, chrome, scope);
}

export type { ChoroplethBuildResult };
