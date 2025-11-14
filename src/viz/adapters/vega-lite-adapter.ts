import type { TopLevelSpec } from 'vega-lite';
import type { Transform } from 'vega-lite/types_unstable/transform';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';

const VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v6.json';
const CHANNEL_ORDER = ['x', 'y', 'color', 'size', 'shape', 'detail'] as const;
const QUANT_SCALE_TYPES = new Set(['linear', 'log', 'sqrt']);
const ORDINAL_SCALE_TYPES = new Set(['band', 'point']);
const MARK_TRAIT_MAP = {
  MarkBar: 'bar',
  MarkLine: 'line',
  MarkPoint: 'point',
  MarkArea: 'area',
} as const;

type NormalizedEncoding = NormalizedVizSpec['encoding'];
type NormalizedMark = NormalizedVizSpec['marks'][number];
type NormalizedTransform = NonNullable<NormalizedVizSpec['transforms']>[number];
type TraitBinding = NonNullable<NormalizedEncoding>[keyof NonNullable<NormalizedEncoding>];

interface ConvertedLayer {
  readonly mark: Record<string, unknown>;
  readonly encoding: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
}

export interface VegaLiteUserMeta {
  readonly specId?: string;
  readonly name?: string;
  readonly theme?: string;
  readonly tokens?: Record<string, string | number>;
  readonly a11y: NormalizedVizSpec['a11y'];
  readonly portability?: NormalizedVizSpec['portability'];
}

export type VegaLiteAdapterSpec = TopLevelSpec & {
  readonly usermeta?: {
    readonly oods: VegaLiteUserMeta;
  };
};

export class VegaLiteAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VegaLiteAdapterError';
  }
}

export function toVegaLiteSpec(spec: NormalizedVizSpec): VegaLiteAdapterSpec {
  if (spec.marks.length === 0) {
    throw new VegaLiteAdapterError('Normalized viz spec must contain at least one mark.');
  }

  const data = convertData(spec);
  const transform = convertTransforms(spec.transforms);
  const baseEncoding = convertEncodingMap(spec.encoding);
  const layers = spec.marks.map((mark) => createLayer(mark, baseEncoding));
  const requiresLayer = layers.length > 1 || layers.some((layer) => layer.data !== undefined);

  const layout = spec.config?.layout ?? {};
  const markConfig = spec.config?.mark ? { mark: spec.config.mark } : undefined;

  const vegaSpec = removeUndefined({
    $schema: VEGA_LITE_SCHEMA_URL,
    title: spec.name,
    description: spec.a11y.description,
    data,
    transform,
    width: layout.width,
    height: layout.height,
    padding: layout.padding,
    config: markConfig,
    usermeta: buildUserMeta(spec),
  }) as VegaLiteAdapterSpec;

  if (requiresLayer) {
    vegaSpec.layer = layers.map((layer) =>
      removeUndefined({
        mark: layer.mark,
        encoding: layer.encoding,
        data: layer.data,
      })
    ) as VegaLiteAdapterSpec['layer'];
    return vegaSpec;
  }

  const [layer] = layers;
  vegaSpec.mark = layer.mark as VegaLiteAdapterSpec['mark'];
  vegaSpec.encoding = layer.encoding as VegaLiteAdapterSpec['encoding'];
  return vegaSpec;
}

function createLayer(mark: NormalizedMark, baseEncoding?: Record<string, unknown>): ConvertedLayer {
  const markEncodings = convertEncodingMap(mark.encodings);
  const encoding = mergeEncodings(baseEncoding, markEncodings);

  if (Object.keys(encoding).length === 0) {
    throw new VegaLiteAdapterError(`Mark ${mark.trait} does not provide any encodings.`);
  }

  return {
    mark: createMark(mark),
    encoding,
    data: mark.from ? { name: mark.from } : undefined,
  };
}

function createMark(mark: NormalizedMark): Record<string, unknown> {
  const type = MARK_TRAIT_MAP[mark.trait as keyof typeof MARK_TRAIT_MAP];

  if (!type) {
    throw new VegaLiteAdapterError(`Unsupported mark trait: ${mark.trait}`);
  }

  return {
    type,
    ...(mark.options ?? {}),
  };
}

function convertEncodingMap(map?: NormalizedEncoding): Record<string, unknown> {
  if (!map) {
    return {};
  }

  const encoding: Record<string, unknown> = {};

  for (const channel of CHANNEL_ORDER) {
    const binding = map[channel];

    if (!binding) {
      continue;
    }

    encoding[channel] = convertBinding(channel, binding);
  }

  return encoding;
}

function mergeEncodings(
  base?: Record<string, unknown>,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  if (!base && !overrides) {
    return {};
  }

  const merged: Record<string, unknown> = {};

  if (base) {
    for (const [channel, config] of Object.entries(base)) {
      merged[channel] = config;
    }
  }

  if (overrides) {
    for (const [channel, config] of Object.entries(overrides)) {
      merged[channel] = config;
    }
  }

  return merged;
}

function convertBinding(channel: (typeof CHANNEL_ORDER)[number], binding: TraitBinding): Record<string, unknown> {
  const definition: Record<string, unknown> = {
    field: binding.field,
    type: inferFieldType(channel, binding),
  };

  const aggregate = mapAggregate(binding.aggregate);
  const scaleType = mapScaleType(binding.scale);

  if (aggregate) {
    definition.aggregate = aggregate;
  }

  if (typeof binding.bin === 'boolean') {
    definition.bin = binding.bin;
  }

  if (binding.timeUnit) {
    definition.timeUnit = binding.timeUnit;
  }

  if (scaleType) {
    definition.scale = { type: scaleType };
  }

  if (binding.sort) {
    definition.sort = binding.sort;
  }

  if (binding.title) {
    definition.title = binding.title;
  }

  if (binding.legend) {
    definition.legend = binding.legend;
  }

  return definition;
}

function inferFieldType(
  channel: (typeof CHANNEL_ORDER)[number],
  binding: TraitBinding
): 'quantitative' | 'temporal' | 'ordinal' | 'nominal' {
  if (binding.timeUnit || binding.scale === 'temporal') {
    return 'temporal';
  }

  if (binding.trait === 'EncodingSize') {
    return 'quantitative';
  }

  if (binding.trait === 'EncodingColor') {
    if (binding.scale && QUANT_SCALE_TYPES.has(binding.scale)) {
      return 'quantitative';
    }

    return 'nominal';
  }

  if (binding.aggregate) {
    return 'quantitative';
  }

  if (binding.scale && QUANT_SCALE_TYPES.has(binding.scale)) {
    return 'quantitative';
  }

  if (binding.scale && ORDINAL_SCALE_TYPES.has(binding.scale)) {
    return 'ordinal';
  }

  if (channel === 'x') {
    return 'ordinal';
  }

  if (channel === 'shape') {
    return 'nominal';
  }

  if (channel === 'detail') {
    return 'nominal';
  }

  return 'quantitative';
}

function mapAggregate(value?: TraitBinding['aggregate']): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'average') {
    return 'mean';
  }

  return value;
}

function mapScaleType(scale?: TraitBinding['scale']): string | undefined {
  if (!scale || scale === 'linear' || scale === 'log' || scale === 'sqrt' || scale === 'band' || scale === 'point') {
    return scale ?? undefined;
  }

  if (scale === 'temporal') {
    return 'time';
  }

  return undefined;
}

function convertData(spec: NormalizedVizSpec): Record<string, unknown> {
  const source = spec.data;
  const data: Record<string, unknown> = {};

  if (Array.isArray(source.values)) {
    data.values = source.values;
  }

  if (source.url) {
    data.url = source.url;
  }

  if (source.format && source.format !== 'auto') {
    data.format = { type: source.format };
  }

  if (source.name) {
    data.name = source.name;
  }

  return data;
}

function convertTransforms(transforms?: NormalizedVizSpec['transforms']): Transform[] | undefined {
  if (!transforms || transforms.length === 0) {
    return undefined;
  }

  const converted = transforms
    .map((transform) => convertTransform(transform))
    .filter((entry): entry is Transform => entry !== undefined);

  return converted.length > 0 ? converted : undefined;
}

function convertTransform(transform: NormalizedTransform): Transform | undefined {
  if (transform.type === 'calculate') {
    const calculated = convertCalculateTransform(transform.params ?? {});

    if (calculated) {
      return calculated;
    }
  }

  if (!transform.params) {
    return undefined;
  }

  if (Object.keys(transform.params).length === 0) {
    return undefined;
  }

  return transform.params as Transform;
}

function convertCalculateTransform(params: Record<string, unknown>): Transform | undefined {
  if (typeof params.calculate === 'string') {
    const as = typeof params.as === 'string' ? params.as : undefined;
    return removeUndefined({
      calculate: params.calculate,
      as,
    }) as Transform;
  }

  if (typeof params.expression === 'string') {
    const as = typeof params.as === 'string' ? params.as : undefined;
    return removeUndefined({
      calculate: params.expression,
      as,
    }) as Transform;
  }

  if (typeof params.field === 'string' && typeof params.format === 'string') {
    const as = typeof params.as === 'string' ? params.as : params.field;
    return {
      calculate: `timeParse(datum["${params.field}"], "${params.format}")`,
      as,
    } as Transform;
  }

  return undefined;
}

function buildUserMeta(spec: NormalizedVizSpec): VegaLiteAdapterSpec['usermeta'] {
  const meta: VegaLiteUserMeta = {
    specId: spec.id,
    name: spec.name,
    theme: spec.config?.theme,
    tokens: spec.config?.tokens,
    portability: spec.portability,
    a11y: spec.a11y,
  };

  return {
    oods: removeUndefined(meta),
  };
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}
