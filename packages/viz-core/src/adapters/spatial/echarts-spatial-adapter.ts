// Spatial dispatcher: composes region-fill (choropleth) + symbol (bubble) layers
// into one ECharts option (sprint-112 m01 port). Ported from
// src/viz/adapters/spatial/echarts-spatial-adapter.ts; only the spatial-spec
// import is repointed and echarts is a TYPE-ONLY import. Logic is byte-identical.

import type { FeatureCollection } from 'geojson';
import type { EChartsOption, GeoComponentOption, SeriesOption, VisualMapComponentOption } from 'echarts';
import { isRegionFillLayer, isRouteLayer, isSymbolLayer, type SpatialSpec } from '../../spec/spatial.js';
import { buildChoropleth, type ChoroplethBuildResult } from './echarts-choropleth-adapter.js';
import { buildBubbleSeries, type BubbleBuildResult } from './echarts-bubble-adapter.js';
import { buildFlowLineSeries, type FlowLineBuildResult } from './echarts-flow-line-adapter.js';
import type { DataRecord } from './geo-data-joiner.js';
import { withTitleBand } from './titled-geo.js';

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
  const routeLayers = spec.layers.filter(isRouteLayer);

  if (regionLayers.length === 0 && symbolLayers.length === 0 && routeLayers.length === 0) {
    throw new EChartsSpatialAdapterError('Spatial spec must include at least one regionFill, symbol, or route layer.');
  }

  const tabularData = resolveData(spec, data);
  const series: SeriesOption[] = [];
  const visualMaps: VisualMapComponentOption[] = [];
  let geo: GeoComponentOption | undefined;
  let geoRegistration: FeatureCollection | undefined;
  // Accumulate geo-join diagnostics across ALL region layers (sprint-126 m06 / Forge-Demos #11).
  // The single-layer choropleth adapter attaches __joinDiagnostics, but this multi-layer
  // dispatcher previously discarded result.diagnostics, so OODS-V134 unmatched-region warnings
  // never reached consumers on the layers:[regionFill, route] overlay path.
  type JoinDiagnostics = NonNullable<ChoroplethBuildResult['diagnostics']>;
  let joinDiagnostics: { unmatchedData: string[]; unmatchedFeatures: string[] } | undefined;

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
      if (result.diagnostics) {
        const diagnostics: JoinDiagnostics = result.diagnostics;
        joinDiagnostics ??= { unmatchedData: [], unmatchedFeatures: [] };
        joinDiagnostics.unmatchedData.push(...diagnostics.unmatchedData);
        joinDiagnostics.unmatchedFeatures.push(...diagnostics.unmatchedFeatures);
      }
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

  if (routeLayers.length > 0) {
    if (!tabularData || tabularData.length === 0) {
      throw new EChartsSpatialAdapterError('Flow map route layers require tabular data records (the origin→destination flows).');
    }

    for (const layer of routeLayers) {
      const result: FlowLineBuildResult = buildFlowLineSeries(spec, layer, tabularData, geoData);
      series.push(result.series as SeriesOption);
      if (result.visualMap) {
        visualMaps.push(result.visualMap);
      }
      geo = geo ?? (result.geo as GeoComponentOption);
      geoRegistration = geoRegistration ?? result.registration?.geoJson;
    }
  }

  const option: EChartsOption = pruneUndefined({
    geo: withTitleBand(geo, spec.name),
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

  // Expose merged geo-join diagnostics ONLY when something was unmatched, mirroring the
  // single-layer choropleth adapter's __joinDiagnostics escape hatch (and the __registration
  // pattern above). Dedupe across layers so a region unmatched in multiple layers reports once;
  // Set preserves insertion order, keeping output deterministic. viz.render reads this to emit
  // OODS-V134, then strips it so the default (fully-matched) path stays byte-identical.
  if (joinDiagnostics) {
    const dedupe = (values: string[]): string[] => Array.from(new Set(values));
    (option as Record<string, unknown>).__joinDiagnostics = {
      unmatchedData: dedupe(joinDiagnostics.unmatchedData),
      unmatchedFeatures: dedupe(joinDiagnostics.unmatchedFeatures),
    };
  }

  return {
    echartsOption: option,
    geoRegistration: geoRegistration ? { name: (geo as GeoComponentOption | undefined)?.map as string, geoJson: geoRegistration } : undefined,
  };
}
