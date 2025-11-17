import type {
  TraitBinding as NormalizedTraitBinding,
  Transform as NormalizedSpecTransform,
} from '~/generated/types/viz/normalized-viz-spec';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import { buildVegaLiteSpec } from './vega-lite-layout-mapper.js';

const VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v6.json';
const CHANNEL_ORDER = ['x', 'x2', 'y', 'y2', 'color', 'size', 'shape', 'detail'] as const;
const QUANT_SCALE_TYPES = new Set(['linear', 'log', 'sqrt']);
const ORDINAL_SCALE_TYPES = new Set(['band', 'point']);
const MARK_TRAIT_MAP = {
  MarkBar: 'bar',
  MarkLine: 'line',
  MarkPoint: 'point',
  MarkArea: 'area',
  MarkRect: 'rect',
} as const;

type AdapterTransform = Record<string, unknown>;
type NormalizedEncoding = NormalizedVizSpec['encoding'];
type NormalizedMark = NormalizedVizSpec['marks'][number];
type NormalizedTransform = NormalizedSpecTransform;
type ChannelName = (typeof CHANNEL_ORDER)[number];
type EncodingBinding = NormalizedTraitBinding;

interface ConvertedLayer {
  readonly key: string;
  readonly mark: Record<string, unknown>;
  readonly encoding: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
}

interface AdapterInteractionParam {
  readonly name: string;
  readonly select: Record<string, unknown>;
}

export interface VegaLiteUserMeta {
  readonly specId?: string;
  readonly name?: string;
  readonly theme?: string;
  readonly tokens?: Record<string, string | number>;
  readonly a11y: NormalizedVizSpec['a11y'];
  readonly portability?: NormalizedVizSpec['portability'];
}

export interface BaseAdapterSpec {
  readonly $schema?: string;
  readonly title?: string;
  readonly description: string;
  readonly data: Record<string, unknown>;
  readonly transform?: readonly AdapterTransform[];
  readonly params?: readonly AdapterInteractionParam[];
  readonly width?: number;
  readonly height?: number;
  readonly padding?: number;
  readonly config?: Record<string, unknown>;
  readonly usermeta?: {
    readonly oods: VegaLiteUserMeta;
  };
}

export type VegaLiteAdapterSpec =
  | (BaseAdapterSpec & {
      readonly mark: Record<string, unknown>;
      readonly encoding: Record<string, unknown>;
    })
  | (BaseAdapterSpec & {
      readonly layer: readonly {
        readonly mark: Record<string, unknown>;
        readonly encoding: Record<string, unknown>;
        readonly data?: Record<string, unknown>;
      }[];
    });

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

  const interactions = normalizeInteractions(spec.interactions);
  const data = convertData(spec);
  const transform = mergeTransforms(convertTransforms(spec.transforms), buildInteractionTransforms(interactions));
  const baseEncoding = convertEncodingMap(spec.encoding);
  const interactionParams = convertInteractionParams(interactions);
  const interactionEncoding = convertInteractionBindings(interactions);
  const convertedLayers = spec.marks.map((mark) => createLayer(mark, baseEncoding, interactionEncoding));
  const orderedLayers = applyLayerOrdering(spec.layout, convertedLayers);
  const requiresLayer = orderedLayers.length > 1 || orderedLayers.some((layer) => layer.data !== undefined);

  const layout = spec.config?.layout ?? {};
  const markConfig = spec.config?.mark ? { mark: spec.config.mark } : undefined;

  const baseSpec = removeUndefined({
    $schema: VEGA_LITE_SCHEMA_URL,
    title: spec.name,
    description: spec.a11y.description,
    data,
    transform,
    params: interactionParams,
    width: layout.width,
    height: layout.height,
    padding: layout.padding,
    config: markConfig,
    usermeta: buildUserMeta(spec),
  });

  const primitive = requiresLayer
    ? {
        layer: orderedLayers.map((layer) =>
          removeUndefined({
            mark: layer.mark,
            encoding: layer.encoding,
            data: layer.data,
          })
        ),
      }
    : removeUndefined({
        mark: orderedLayers[0]?.mark,
        encoding: orderedLayers[0]?.encoding,
        data: orderedLayers[0]?.data,
      });

  return buildVegaLiteSpec(spec, { base: baseSpec, primitive });
}

function createLayer(
  mark: NormalizedMark,
  baseEncoding?: Record<string, unknown>,
  interactionEncoding?: Record<string, unknown>
): ConvertedLayer {
  const markEncodings = convertEncodingMap(mark.encodings);
  const encoding = mergeEncodings(mergeEncodings(baseEncoding, markEncodings), interactionEncoding);

  if (Object.keys(encoding).length === 0) {
    throw new VegaLiteAdapterError(`Mark ${mark.trait} does not provide any encodings.`);
  }

  return {
    key: inferLayerKey(mark),
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
    const binding = (map as Record<string, EncodingBinding | undefined>)[channel];

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

function convertBinding(channel: ChannelName, binding: EncodingBinding): Record<string, unknown> {
  const normalizedChannel = channel === 'x2' ? 'x' : channel === 'y2' ? 'y' : channel;
  const definition: Record<string, unknown> = {
    field: binding.field,
    type: inferFieldType(normalizedChannel, binding),
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

function convertInteractionParams(
  interactions?: NormalizedVizSpec['interactions']
): readonly AdapterInteractionParam[] | undefined {
  if (!interactions || interactions.length === 0) {
    return undefined;
  }

  const params = interactions
    .map((interaction) => {
      const select = convertInteractionSelection(interaction.select);
      if (!select) {
        return undefined;
      }
      return {
        name: interaction.id,
        select,
      } satisfies AdapterInteractionParam;
    })
    .filter((entry): entry is AdapterInteractionParam => Boolean(entry));

  return params.length > 0 ? params : undefined;
}

function convertInteractionSelection(selection: NonNullable<NormalizedVizSpec['interactions']>[number]['select']):
  | Record<string, unknown>
  | undefined {
  if (selection.type === 'point') {
    return removeUndefined({
      type: 'point',
      on: selection.on,
      fields: selection.fields,
    });
  }

  if (selection.type === 'interval') {
    return removeUndefined({
      type: 'interval',
      on: selection.on,
      encodings: selection.encodings,
      bind: selection.bind,
    });
  }

  return undefined;
}

function convertInteractionBindings(
  interactions?: NormalizedVizSpec['interactions']
): Record<string, unknown> | undefined {
  if (!interactions || interactions.length === 0) {
    return undefined;
  }

  const encoding: Record<string, unknown> = {};

  for (const interaction of interactions) {
    if (interaction.rule.bindTo === 'visual') {
      const { property } = interaction.rule;
      const active = interaction.rule.condition?.value;
      const inactive = interaction.rule.else?.value;

      if (!property || active === undefined) {
        continue;
      }

      encoding[property] = removeUndefined({
        condition: {
          param: interaction.id,
          value: active,
        },
        value: inactive,
      });
    }

    if (interaction.rule.bindTo === 'tooltip' && !encoding.tooltip && interaction.rule.fields.length > 0) {
      encoding.tooltip = interaction.rule.fields.map((field) => ({ field }));
    }
  }

  return Object.keys(encoding).length > 0 ? encoding : undefined;
}

function inferFieldType(channel: ChannelName, binding: EncodingBinding): 'quantitative' | 'temporal' | 'ordinal' | 'nominal' {
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

  if (channel === 'y') {
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

function mapAggregate(value?: EncodingBinding['aggregate']): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'average') {
    return 'mean';
  }

  return value;
}

function mapScaleType(scale?: EncodingBinding['scale']): string | undefined {
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

function convertTransforms(transforms?: NormalizedVizSpec['transforms']): AdapterTransform[] | undefined {
  if (!transforms || transforms.length === 0) {
    return undefined;
  }

  const converted = transforms
    .map((transform) => convertTransform(transform))
    .filter((entry): entry is AdapterTransform => entry !== undefined);

  return converted.length > 0 ? converted : undefined;
}

function buildInteractionTransforms(interactions?: NormalizedVizSpec['interactions']): AdapterTransform[] | undefined {
  if (!interactions || interactions.length === 0) {
    return undefined;
  }

  const filters = interactions
    .filter((interaction) => interaction.rule.bindTo === 'filter')
    .map((interaction) => ({ filter: { param: interaction.id } } satisfies AdapterTransform));

  return filters.length > 0 ? filters : undefined;
}

function mergeTransforms(
  ...pipelines: Array<AdapterTransform[] | undefined>
): AdapterTransform[] | undefined {
  const merged = pipelines.filter((pipeline): pipeline is AdapterTransform[] => Boolean(pipeline)).flat();
  return merged.length > 0 ? merged : undefined;
}

function convertTransform(transform: NormalizedTransform): AdapterTransform | undefined {
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

  return transform.params as AdapterTransform;
}

function convertCalculateTransform(params: Record<string, unknown>): AdapterTransform | undefined {
  if (typeof params.calculate === 'string') {
    const as = typeof params.as === 'string' ? params.as : undefined;
    return removeUndefined({
      calculate: params.calculate,
      as,
    }) as AdapterTransform;
  }

  if (typeof params.expression === 'string') {
    const as = typeof params.as === 'string' ? params.as : undefined;
    return removeUndefined({
      calculate: params.expression,
      as,
    }) as AdapterTransform;
  }

  if (typeof params.field === 'string' && typeof params.format === 'string') {
    const as = typeof params.as === 'string' ? params.as : params.field;
    return {
      calculate: `timeParse(datum["${params.field}"], "${params.format}")`,
      as,
    } as AdapterTransform;
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

function normalizeInteractions(
  interactions?: NormalizedVizSpec['interactions']
): NormalizedVizSpec['interactions'] | undefined {
  if (!interactions || interactions.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized = interactions
    .map((interaction) => {
      const rawId = interaction.id?.trim();
      if (!rawId) {
        return undefined;
      }
      const baseKey = canonicalizeInteractionId(rawId);
      let candidate = rawId;
      let candidateKey = baseKey;
      let counter = 2;
      while (seen.has(candidateKey)) {
        candidate = `${rawId}-${counter}`;
        candidateKey = `${baseKey}-${counter}`;
        counter += 1;
      }
      seen.add(candidateKey);
      return {
        ...interaction,
        id: candidate,
      };
    })
    .filter((interaction): interaction is NonNullable<typeof interaction> => Boolean(interaction));

  return normalized.length > 0 ? normalized : undefined;
}

function canonicalizeInteractionId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function removeUndefined<T extends object>(input: T): T {
  const entries = Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}

function inferLayerKey(mark: NormalizedMark): string {
  const candidate = mark.options?.id;
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }

  return mark.trait;
}

function applyLayerOrdering(
  layout: NormalizedVizSpec['layout'],
  layers: readonly ConvertedLayer[]
): readonly ConvertedLayer[] {
  if (!layout || layout.trait !== 'LayoutLayer' || !layout.order || layout.order.length === 0) {
    return layers;
  }

  const order = layout.order;
  const remaining = new Map<string, ConvertedLayer>();
  layers.forEach((layer) => remaining.set(layer.key, layer));

  const ordered: ConvertedLayer[] = [];
  for (const key of order) {
    const match = remaining.get(key);
    if (match) {
      ordered.push(match);
      remaining.delete(key);
    }
  }

  for (const layer of layers) {
    if (!ordered.includes(layer)) {
      ordered.push(layer);
    }
  }

  return ordered;
}
