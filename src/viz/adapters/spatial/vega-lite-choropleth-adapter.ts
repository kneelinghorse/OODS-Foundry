import type { FeatureCollection } from 'geojson';
import type { RegionFillLayer } from '@/types/viz/spatial.js';
import { buildVegaLiteTooltip, createChoroplethTooltipFields } from '../../tooltip/spatial-tooltip-config.js';
import { mapColorScale } from './vega-lite-scale-map.js';

export type VegaLiteLayer = Record<string, unknown>;

const DEFAULT_REGION_NAME_FIELD = 'name';
const DEFAULT_REGION_STROKE = 'var(--sys-border-subtle)';
const DEFAULT_REGION_STROKE_WIDTH = 0.75;

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function withProperties(field: string): string {
  return field.startsWith('properties.') ? field : `properties.${field}`;
}

function buildColorEncoding(layer: RegionFillLayer): Record<string, unknown> {
  const colorEncoding = layer.encoding.color;
  const field = withProperties(colorEncoding.field);
  const scale = mapColorScale(colorEncoding);

  const baseEncoding: Record<string, unknown> = pruneUndefined({
    field,
    type: 'quantitative',
    scale,
  });

  if (colorEncoding.nullValue) {
    return {
      condition: {
        test: `isValid(datum["${field}"]) && datum["${field}"] !== null`,
        ...baseEncoding,
      },
      value: colorEncoding.nullValue,
    };
  }

  return baseEncoding;
}

function buildOpacityEncoding(opacity?: RegionFillLayer['encoding']['opacity']): Record<string, unknown> | undefined {
  if (!opacity) {
    return undefined;
  }

  if (opacity.value !== undefined) {
    return { value: opacity.value };
  }

  if (opacity.field) {
    return {
      field: withProperties(opacity.field),
      type: 'quantitative',
    };
  }

  return undefined;
}

function buildTooltip(nameField: string, valueField: string): Array<Record<string, unknown>> {
  const fields = createChoroplethTooltipFields({
    regionField: nameField,
    valueField,
  });
  return buildVegaLiteTooltip(fields);
}

export interface ChoroplethLayerParams {
  readonly layer: RegionFillLayer;
  readonly featureCollection: FeatureCollection;
  readonly nameField?: string;
}

export function buildChoroplethLayer(params: ChoroplethLayerParams): VegaLiteLayer {
  const { layer, featureCollection, nameField = DEFAULT_REGION_NAME_FIELD } = params;
  const color = buildColorEncoding(layer);
  const opacity = buildOpacityEncoding(layer.encoding.opacity);
  const tooltip = buildTooltip(nameField, layer.encoding.color.field);

  return {
    data: {
      values: featureCollection,
      format: { type: 'json', property: 'features' },
    },
    mark: pruneUndefined({
      type: 'geoshape',
      stroke: layer.encoding.stroke?.value ?? DEFAULT_REGION_STROKE,
      strokeWidth: layer.encoding.strokeWidth?.value ?? DEFAULT_REGION_STROKE_WIDTH,
    }),
    encoding: pruneUndefined({
      color,
      opacity,
      tooltip,
    }),
  };
}
