import type { FeatureCollection } from 'geojson';
import type { EChartsOption, GeoComponentOption, SeriesOption, VisualMapComponentOption } from 'echarts';
import { isRegionFillLayer, isSymbolLayer, type SpatialSpec } from '@/types/viz/spatial.js';
import { buildChoropleth, type ChoroplethBuildResult } from './echarts-choropleth-adapter.js';
import { buildBubbleSeries, type BubbleBuildResult } from './echarts-bubble-adapter.js';
import type { DataRecord } from './geo-data-joiner.js';

export interface EChartsSpatialAdapterInput {
  readonly spec: SpatialSpec;
  readonly geoData?: FeatureCollection;
  readonly data?: DataRecord[];
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface EChartsSpatialAdapterOutput {
  readonly echartsOption: EChartsOption;
  readonly geoRegistration?: { readonly name: string; readonly geoJson: FeatureCollection };
}

export class EChartsSpatialAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EChartsSpatialAdapterError';
  }
}

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function resolveData(spec: SpatialSpec, override?: DataRecord[]): DataRecord[] | undefined {
  if (override && override.length > 0) {
    return override;
  }

  if ('values' in spec.data && Array.isArray(spec.data.values)) {
    return spec.data.values as DataRecord[];
  }

  return undefined;
}

export function adaptToECharts(input: EChartsSpatialAdapterInput): EChartsSpatialAdapterOutput {
  const { spec, geoData, data, dimensions } = input;
  const regionLayers = spec.layers.filter(isRegionFillLayer);
  const symbolLayers = spec.layers.filter(isSymbolLayer);

  if (regionLayers.length === 0 && symbolLayers.length === 0) {
    throw new EChartsSpatialAdapterError('Spatial spec must include at least one regionFill or symbol layer.');
  }

  const tabularData = resolveData(spec, data);
  const series: SeriesOption[] = [];
  const visualMaps: VisualMapComponentOption[] = [];
  let geo: GeoComponentOption | undefined;
  let geoRegistration: FeatureCollection | undefined;

  if (regionLayers.length > 0) {
    if (!geoData) {
      throw new EChartsSpatialAdapterError('GeoJSON FeatureCollection is required for choropleth rendering.');
    }

    for (const layer of regionLayers) {
      const result: ChoroplethBuildResult = buildChoropleth(spec, layer, geoData, tabularData);
      series.push(result.series as SeriesOption);
      visualMaps.push(result.visualMap);
      geo = geo ?? (result.geo as GeoComponentOption);
      geoRegistration = geoRegistration ?? result.registration.geoJson;
    }
  }

  if (symbolLayers.length > 0) {
    if (!tabularData || tabularData.length === 0) {
      throw new EChartsSpatialAdapterError('Bubble map layers require tabular data records.');
    }

    for (const layer of symbolLayers) {
      const result: BubbleBuildResult = buildBubbleSeries(spec, layer, tabularData, geoData);
      series.push(result.series as SeriesOption);
      if (result.visualMap) {
        visualMaps.push(result.visualMap);
      }
      geo = geo ?? (result.geo as GeoComponentOption);
      geoRegistration = geoRegistration ?? result.registration?.geoJson;
    }
  }

  const option: EChartsOption = pruneUndefined({
    geo,
    visualMap:
      visualMaps.length === 0 ? undefined : visualMaps.length === 1 ? visualMaps[0] : (visualMaps as VisualMapComponentOption[]),
    series,
    tooltip: { trigger: 'item' },
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
  });

  if (geoRegistration) {
    (option as Record<string, unknown>).__registration = geoRegistration;
  }

  return {
    echartsOption: option,
    geoRegistration: geoRegistration ? { name: (geo as GeoComponentOption | undefined)?.map as string, geoJson: geoRegistration } : undefined,
  };
}
