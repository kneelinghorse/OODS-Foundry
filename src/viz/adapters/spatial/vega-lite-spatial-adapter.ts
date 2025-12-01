import type { FeatureCollection } from 'geojson';
import type { TopLevelSpec } from 'vega-lite';
import { isGeoJoinData, isRegionFillLayer, isSymbolLayer, type SpatialSpec } from '@/types/viz/spatial.js';
import { joinGeoWithData, type DataRecord } from './geo-data-joiner.js';
import { buildBubbleLayers, type VegaLiteLayer as BubbleLayer } from './vega-lite-bubble-adapter.js';
import { buildChoroplethLayer, type VegaLiteLayer as ChoroplethLayer } from './vega-lite-choropleth-adapter.js';
import { mapProjectionConfig } from './vega-lite-projection-map.js';

export interface VegaLiteSpatialAdapterInput {
  readonly spec: SpatialSpec;
  readonly geoData?: FeatureCollection;
  readonly data?: DataRecord[];
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface VegaLiteSpatialAdapterOutput {
  readonly vegaLiteSpec: TopLevelSpec;
  readonly dataUrls?: { readonly geo?: string; readonly data?: string };
}

export class VegaLiteSpatialAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VegaLiteSpatialAdapterError';
  }
}

const VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v6.json';

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

function ensureGeoData(
  geoData: FeatureCollection | undefined,
  requiresGeo: boolean
): FeatureCollection | undefined {
  if (geoData) {
    return geoData;
  }

  if (requiresGeo) {
    throw new VegaLiteSpatialAdapterError('GeoJSON FeatureCollection is required for spatial adapters.');
  }

  return undefined;
}

function mergeGeoWithData(spec: SpatialSpec, geoData: FeatureCollection, data?: DataRecord[]): FeatureCollection {
  if (!data || data.length === 0) {
    return geoData;
  }

  if (!isGeoJoinData(spec.data)) {
    return geoData;
  }

  const joinResult = joinGeoWithData(geoData.features, data, {
    geoKey: spec.data.geoKey,
    dataKey: spec.data.joinKey,
  });

  return {
    type: 'FeatureCollection',
    features: joinResult.features,
  };
}

function collectDataUrls(spec: SpatialSpec): VegaLiteSpatialAdapterOutput['dataUrls'] {
  const urls: Record<string, string> = {};

  if (isGeoJoinData(spec.data)) {
    if (spec.data.source) {
      urls.data = spec.data.source;
    }
    if (spec.data.geoSource) {
      urls.geo = spec.data.geoSource;
    }
  } else if ('url' in spec.data && spec.data.url) {
    urls.data = spec.data.url;
  }

  if (spec.geo?.source && typeof spec.geo.source === 'string' && !urls.geo) {
    urls.geo = spec.geo.source as string;
  }

  return Object.keys(urls).length > 0 ? urls : undefined;
}

function buildUserMeta(spec: SpatialSpec): TopLevelSpec['usermeta'] {
  return {
    oods: pruneUndefined({
      specId: spec.id,
      name: spec.name,
      theme: spec.config?.theme,
      tokens: spec.config?.tokens,
      a11y: spec.a11y,
    }),
  };
}

function buildBaseSpec(spec: SpatialSpec, dimensions: { width: number; height: number }): Record<string, unknown> {
  const layout = spec.config?.layout;

  return pruneUndefined({
    $schema: VEGA_LITE_SCHEMA_URL,
    title: spec.name,
    description: spec.a11y.description,
    width: dimensions.width ?? layout?.width,
    height: dimensions.height ?? layout?.height,
    padding: layout?.padding,
    projection: mapProjectionConfig(spec.projection, { fitToData: spec.projection.fitToData ?? true, dimensions }),
    usermeta: buildUserMeta(spec),
  });
}

export function adaptToVegaLite(input: VegaLiteSpatialAdapterInput): VegaLiteSpatialAdapterOutput {
  const { spec } = input;
  const regionLayers = spec.layers.filter(isRegionFillLayer);
  const symbolLayers = spec.layers.filter(isSymbolLayer);

  if (regionLayers.length === 0 && symbolLayers.length === 0) {
    throw new VegaLiteSpatialAdapterError('Spatial spec must include at least one regionFill or symbol layer.');
  }

  const tabularData = resolveData(spec, input.data);
  const needsGeo = regionLayers.length > 0;
  const baseGeoData = ensureGeoData(input.geoData, needsGeo);
  const featureCollection = baseGeoData ? mergeGeoWithData(spec, baseGeoData, tabularData) : undefined;

  const layers: Array<ChoroplethLayer | BubbleLayer> = [];

  if (regionLayers.length > 0 && featureCollection) {
    for (const layer of regionLayers) {
      layers.push(
        buildChoroplethLayer({
          layer,
          featureCollection,
          nameField: spec.geo?.feature ?? undefined,
        })
      );
    }
  }

  if (symbolLayers.length > 0) {
    if (!tabularData || tabularData.length === 0) {
      throw new VegaLiteSpatialAdapterError('Bubble map layers require tabular data records.');
    }

    for (const layer of symbolLayers) {
      layers.push(
        ...buildBubbleLayers({
          layer,
          data: tabularData,
          geoData: regionLayers.length === 0 ? featureCollection : undefined,
        })
      );
    }
  }

  const baseSpec = buildBaseSpec(spec, input.dimensions);

  const vegaLiteSpec = {
    ...baseSpec,
    layer: layers,
  } as unknown as TopLevelSpec;

  return {
    vegaLiteSpec,
    dataUrls: collectDataUrls(spec),
  };
}
