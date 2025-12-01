import type { FeatureCollection } from 'geojson';
import type { SymbolLayer } from '@/types/viz/spatial.js';
import { buildVegaLiteTooltip, createBubbleTooltipFields } from '../../tooltip/spatial-tooltip-config.js';
import type { DataRecord } from './geo-data-joiner.js';
import { mapColorScale } from './vega-lite-scale-map.js';

export type VegaLiteLayer = Record<string, unknown>;

const BASEMAP_FILL = 'var(--sys-surface-strong)';
const BASEMAP_STROKE = 'var(--sys-border-subtle)';
const DEFAULT_SIZE_SCALE = 'sqrt';

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function buildBasemapLayer(geoData: FeatureCollection): VegaLiteLayer {
  return {
    data: {
      values: geoData,
      format: { type: 'json', property: 'features' },
    },
    mark: pruneUndefined({
      type: 'geoshape',
      fill: BASEMAP_FILL,
      stroke: BASEMAP_STROKE,
      strokeWidth: 0.75,
    }),
  };
}

function buildSizeEncoding(layer: SymbolLayer): Record<string, unknown> | undefined {
  const size = layer.encoding.size;
  if (!size) {
    return undefined;
  }

  if (size.value !== undefined) {
    return { value: size.value };
  }

  if (size.field) {
    return pruneUndefined({
      field: size.field,
      type: 'quantitative',
      scale: pruneUndefined({
        type: size.scale ?? DEFAULT_SIZE_SCALE,
        range: size.range,
      }),
    });
  }

  return undefined;
}

function buildColorEncoding(layer: SymbolLayer): Record<string, unknown> | undefined {
  const color = layer.encoding.color;
  if (!color) {
    return undefined;
  }

  if (color.value) {
    return { value: color.value };
  }

  if (color.field) {
    const isOrdinal = color.scale === 'ordinal';
    const scale = mapColorScale(color);
    const baseEncoding: Record<string, unknown> = pruneUndefined({
      field: color.field,
      type: isOrdinal ? 'nominal' : 'quantitative',
      scale,
    });

    if (color.nullValue) {
      return {
        condition: {
          test: `isValid(datum["${color.field}"]) && datum["${color.field}"] !== null`,
          ...baseEncoding,
        },
        value: color.nullValue,
      };
    }

    return baseEncoding;
  }

  return undefined;
}

function buildOpacityEncoding(opacity?: SymbolLayer['encoding']['opacity']): Record<string, unknown> | undefined {
  if (!opacity) {
    return undefined;
  }

  if (opacity.value !== undefined) {
    return { value: opacity.value };
  }

  if (opacity.field) {
    return {
      field: opacity.field,
      type: 'quantitative',
    };
  }

  return undefined;
}

function buildShapeEncoding(shape?: SymbolLayer['encoding']['shape']): Record<string, unknown> | undefined {
  if (!shape) {
    return undefined;
  }

  if (shape.value) {
    return { value: shape.value };
  }

  if (shape.field) {
    return {
      field: shape.field,
      type: 'nominal',
    };
  }

  return undefined;
}

function buildTooltip(layer: SymbolLayer): Array<Record<string, unknown>> {
  const fields = createBubbleTooltipFields({
    longitudeField: layer.encoding.longitude.field,
    latitudeField: layer.encoding.latitude.field,
    sizeField: layer.encoding.size?.field,
    colorField: layer.encoding.color?.field,
  });
  return buildVegaLiteTooltip(fields);
}

export interface BubbleLayerParams {
  readonly layer: SymbolLayer;
  readonly data: DataRecord[];
  readonly geoData?: FeatureCollection;
}

export function buildBubbleLayers(params: BubbleLayerParams): VegaLiteLayer[] {
  const { layer, data, geoData } = params;

  const symbolLayer: VegaLiteLayer = {
    data: { values: data },
    mark: { type: 'circle' },
    encoding: pruneUndefined({
      longitude: { field: layer.encoding.longitude.field, type: 'quantitative' },
      latitude: { field: layer.encoding.latitude.field, type: 'quantitative' },
      size: buildSizeEncoding(layer),
      color: buildColorEncoding(layer),
      opacity: buildOpacityEncoding(layer.encoding.opacity),
      shape: buildShapeEncoding(layer.encoding.shape),
      tooltip: buildTooltip(layer),
    }),
  };

  const layers: VegaLiteLayer[] = [];
  if (geoData) {
    layers.push(buildBasemapLayer(geoData));
  }
  layers.push(symbolLayer);

  return layers;
}
