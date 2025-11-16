import type {
  TraitBinding as NormalizedTraitBinding,
  Transform as NormalizedSpecTransform,
} from '~/generated/types/viz/normalized-viz-spec';
import type {
  IntervalSelection,
  LayoutProjection,
  NormalizedVizSpec,
} from '@/viz/spec/normalized-viz-spec.js';
import { applyEChartsLayout } from './echarts-layout-mapper.js';
import type { ScaleResolution } from './scale-resolver.js';

const DEFAULT_DATASET_ID = 'viz-dataset';
const CATEGORY_SCALES = new Set(['band', 'point']);
const QUANT_SCALES = new Set(['linear', 'sqrt']);
interface MarkTraitConfig {
  readonly type: 'bar' | 'line' | 'scatter' | 'heatmap';
  readonly areaStyle?: Record<string, unknown>;
}

const MARK_TRAIT_MAP: Record<string, MarkTraitConfig> = {
  MarkBar: { type: 'bar' },
  MarkLine: { type: 'line' },
  MarkPoint: { type: 'scatter' },
  MarkArea: { type: 'line', areaStyle: { opacity: 0.3 } },
  MarkRect: { type: 'heatmap' },
};

type ChannelName = keyof NormalizedVizSpec['encoding'];
type NormalizedEncoding = NormalizedVizSpec['encoding'];
type NormalizedMark = NormalizedVizSpec['marks'][number];
type NormalizedTransform = NormalizedSpecTransform;
type EncodingBinding = NormalizedTraitBinding;
type LayoutConfig = NonNullable<NormalizedVizSpec['config']> extends { layout?: infer L } ? L : undefined;
type NormalizedInteraction = NonNullable<NormalizedVizSpec['interactions']>[number];
type IntervalInteraction = NormalizedInteraction & { select: IntervalSelection };

export interface EChartsDatasetTransform {
  readonly type: string;
  readonly config?: Record<string, unknown>;
}

export interface EChartsDataset {
  readonly id: string;
  readonly fromDatasetId?: string;
  readonly source?: readonly Record<string, unknown>[];
  readonly transform?: readonly EChartsDatasetTransform[];
  readonly dimensions?: readonly string[];
}

export interface EChartsEncode {
  x?: string | readonly string[];
  y?: string | readonly string[];
  tooltip?: readonly string[];
  itemName?: string;
  itemId?: string;
  seriesName?: string;
  value?: string | readonly string[];
  size?: string;
  detail?: string;
}

export interface EChartsSeries {
  readonly [key: string]: unknown;
  readonly id?: string;
  readonly name?: string;
  readonly type: 'bar' | 'line' | 'scatter' | 'heatmap';
  readonly datasetId?: string;
  readonly encode: EChartsEncode;
  readonly smooth?: boolean;
  readonly stack?: string;
  readonly colorBy?: 'series' | 'data';
  readonly areaStyle?: Record<string, unknown>;
  readonly emphasis?: Record<string, unknown>;
  readonly showSymbol?: boolean;
  readonly symbol?: string;
  readonly symbolSize?: number;
  readonly lineStyle?: Record<string, unknown>;
  readonly itemStyle?: Record<string, unknown>;
  readonly xAxisIndex?: number;
  readonly yAxisIndex?: number;
}

export interface EChartsAxis {
  readonly type: 'value' | 'category' | 'time' | 'log';
  readonly name?: string;
  readonly nameLocation?: 'middle' | 'end';
  readonly boundaryGap?: boolean | readonly [number | string, number | string];
  readonly axisLabel?: Record<string, unknown>;
}

export interface EChartsGrid {
  readonly containLabel?: boolean;
  readonly left?: number | string;
  readonly right?: number | string;
  readonly top?: number | string;
  readonly bottom?: number | string;
   readonly width?: number | string;
   readonly height?: number | string;
}

export interface EChartsDataZoom {
  readonly id?: string;
  readonly type?: 'inside' | 'slider';
  readonly xAxisIndex?: 'all' | readonly number[];
  readonly yAxisIndex?: 'all' | readonly number[];
  readonly filterMode?: 'filter' | 'none' | 'weakFilter';
  readonly orient?: 'horizontal' | 'vertical';
}

export interface EChartsBrush {
  readonly toolbox?: readonly string[];
  readonly brushMode?: 'single' | 'multiple';
  readonly brushLink?: 'all' | readonly number[];
  readonly xAxisIndex?: 'all' | readonly number[];
  readonly yAxisIndex?: 'all' | readonly number[];
  readonly throttleType?: 'debounce' | 'fixed';
}

export interface EChartsUserMeta {
  readonly specId?: string;
  readonly name?: string;
  readonly theme?: string;
  readonly tokens?: Record<string, string | number>;
  readonly layout?: LayoutConfig;
  readonly layoutTrait?: NormalizedVizSpec['layout'];
  readonly layoutRuntime?: LayoutRuntimeMetadata;
  readonly portability?: NormalizedVizSpec['portability'];
  readonly a11y: NormalizedVizSpec['a11y'];
  readonly interactions?: NormalizedVizSpec['interactions'];
}

export interface LayoutRuntimeMetadata {
  readonly trait: NonNullable<NormalizedVizSpec['layout']>['trait'];
  readonly panelCount?: number;
  readonly sharedScales?: ScaleResolution;
  readonly shareX: boolean;
  readonly shareY: boolean;
  readonly shareColor: boolean;
  readonly projection?: LayoutProjection;
}

export interface EChartsOption {
  readonly [key: string]: unknown;
  readonly dataset: readonly EChartsDataset[];
  readonly series: readonly EChartsSeries[];
  readonly xAxis: EChartsAxis | readonly EChartsAxis[];
  readonly yAxis: EChartsAxis | readonly EChartsAxis[];
  readonly legend?: Record<string, unknown>;
  readonly tooltip?: Record<string, unknown>;
  readonly grid?: EChartsGrid | readonly EChartsGrid[];
  readonly dataZoom?: readonly EChartsDataZoom[];
  readonly brush?: EChartsBrush;
  readonly visualMap?: Record<string, unknown> | readonly Record<string, unknown>[];
  readonly aria?: Record<string, unknown>;
  readonly title?: Record<string, unknown> | readonly Record<string, unknown>[];
  readonly usermeta?: {
    readonly oods: EChartsUserMeta;
  };
}

export class EChartsAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EChartsAdapterError';
  }
}

export function toEChartsOption(spec: NormalizedVizSpec): EChartsOption {
  if (spec.marks.length === 0) {
    throw new EChartsAdapterError('Normalized viz spec must contain at least one mark.');
  }

  const datasetId = deriveDatasetId(spec);
  const dataset = convertDataset(spec, datasetId);
  const baseEncoding = convertEncodingMap(spec.encoding);
  const axisEncoding = resolveAxisEncoding(baseEncoding, spec.marks);
  const series = spec.marks.map((mark) => createSeries(mark, baseEncoding, datasetId));
  const xAxis = createAxis('x', axisEncoding.x);
  const yAxis = createAxis('y', axisEncoding.y);
  const legend = baseEncoding.color ? { show: true } : undefined;
  const tooltip = buildTooltip(spec);
  const dataZoom = buildDataZoomComponents(spec);
  const brush = buildBrushComponent(spec);

  const option = removeUndefined({
    dataset: [dataset],
    series,
    xAxis: xAxis ?? defaultAxis('x'),
    yAxis: yAxis ?? defaultAxis('y'),
    legend,
    tooltip,
    grid: convertGrid(spec.config?.layout),
    dataZoom,
    brush,
    aria: buildAria(spec),
    title: buildTitle(spec),
    usermeta: buildUserMeta(spec),
  });

  return applyEChartsLayout(spec, option);
}

function deriveDatasetId(spec: NormalizedVizSpec): string {
  if (spec.data.name) {
    return spec.data.name;
  }

  if (spec.id) {
    return `${spec.id}:dataset`;
  }

  return DEFAULT_DATASET_ID;
}

function convertDataset(spec: NormalizedVizSpec, datasetId: string): EChartsDataset {
  const source = Array.isArray(spec.data.values) ? spec.data.values : undefined;
  const dimensions = source ? inferDimensions(source) : undefined;

  return removeUndefined({
    id: datasetId,
    source,
    dimensions,
    transform: convertTransforms(spec.transforms),
  });
}

function inferDimensions(rows: readonly Record<string, unknown>[]): readonly string[] | undefined {
  const [first] = rows;

  if (!first) {
    return undefined;
  }

  return Object.keys(first);
}

function convertTransforms(transforms?: NormalizedVizSpec['transforms']): readonly EChartsDatasetTransform[] | undefined {
  if (!transforms || transforms.length === 0) {
    return undefined;
  }

  const converted = transforms
    .map((transform) => convertTransform(transform))
    .filter((entry): entry is EChartsDatasetTransform => Boolean(entry));

  return converted.length > 0 ? converted : undefined;
}

function convertTransform(transform: NormalizedTransform): EChartsDatasetTransform | undefined {
  if (!transform.type) {
    return undefined;
  }

  const config = sanitizeTransformParams(transform.params);

  return removeUndefined({
    type: transform.type,
    config,
  });
}

function sanitizeTransformParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) {
    return undefined;
  }

  const entries = Object.entries(params).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function createSeries(
  mark: NormalizedMark,
  baseEncoding: Partial<Record<ChannelName, EncodingBinding>>,
  fallbackDatasetId: string
): EChartsSeries {
  const markConfig = MARK_TRAIT_MAP[mark.trait as keyof typeof MARK_TRAIT_MAP];

  if (!markConfig) {
    throw new EChartsAdapterError(`Unsupported mark trait: ${mark.trait}`);
  }

  const encodingOverrides = convertEncodingMap(mark.encodings);
  const mergedEncoding = mergeEncodings(baseEncoding, encodingOverrides);
  const encode = convertSeriesEncoding(mergedEncoding);
  const datasetId = mark.from ?? fallbackDatasetId;
  const colorBy = mergedEncoding.color ? 'data' : undefined;
  const smooth = inferSmooth(mark);

  if (markConfig.type === 'heatmap') {
    applyHeatmapEncoding(encode, mergedEncoding);
  }

  return removeUndefined({
    id: mark.options?.id as string | undefined,
    name: mark.options?.name as string | undefined,
    type: markConfig.type,
    datasetId,
    encode,
    stack: (mark.options?.stack as string) ?? undefined,
    areaStyle: (mark.options?.areaStyle as Record<string, unknown> | undefined) ?? markConfig.areaStyle,
    colorBy,
    smooth,
    showSymbol: mark.trait === 'MarkLine' ? false : undefined,
    symbolSize: inferSymbolSize(mark),
    lineStyle: mark.options?.lineStyle as Record<string, unknown> | undefined,
    itemStyle: mark.options?.itemStyle as Record<string, unknown> | undefined,
  });
}

function inferSmooth(mark: NormalizedMark): boolean | undefined {
  if (mark.trait !== 'MarkLine') {
    return undefined;
  }

  const curve = mark.options?.curve;
  if (typeof curve === 'string') {
    return curve !== 'linear';
  }

  return undefined;
}

function inferSymbolSize(mark: NormalizedMark): number | undefined {
  if (mark.trait !== 'MarkPoint') {
    return undefined;
  }

  if (typeof mark.options?.symbolSize === 'number') {
    return mark.options.symbolSize;
  }

  return 14;
}

function convertEncodingMap(map?: NormalizedEncoding): Partial<Record<ChannelName, EncodingBinding>> {
  if (!map) {
    return {};
  }

  const result: Partial<Record<ChannelName, EncodingBinding>> = {};

  for (const key of Object.keys(map) as ChannelName[]) {
    const binding = map[key];

    if (binding) {
      result[key] = binding;
    }
  }

  return result;
}

function mergeEncodings(
  base?: Partial<Record<ChannelName, EncodingBinding>>,
  overrides?: Partial<Record<ChannelName, EncodingBinding>>
): Partial<Record<ChannelName, EncodingBinding>> {
  return { ...(base ?? {}), ...(overrides ?? {}) };
}

function convertSeriesEncoding(map: Partial<Record<ChannelName, EncodingBinding>>): EChartsEncode {
  const encode: EChartsEncode = {};
  const tooltipFields = new Set<string>();

  if (map.x) {
    encode.x = map.x.field;
    tooltipFields.add(map.x.field);
  }

  if (map.y) {
    encode.y = map.y.field;
    tooltipFields.add(map.y.field);
  }

  if (map.color) {
    encode.itemName = map.color.field;
    tooltipFields.add(map.color.field);
  }

  if (map.size) {
    encode.size = map.size.field;
    tooltipFields.add(map.size.field);
  }

  if (map.detail) {
    encode.detail = map.detail.field;
    tooltipFields.add(map.detail.field);
  }

  if (tooltipFields.size > 0) {
    encode.tooltip = [...tooltipFields];
  }

  return encode;
}

function applyHeatmapEncoding(
  encode: EChartsEncode,
  map: Partial<Record<ChannelName, EncodingBinding>>
): void {
  if (map.color) {
    encode.value = map.color.field;
    const tooltip: string[] = Array.isArray(encode.tooltip) ? [...encode.tooltip] : [];
    if (!tooltip.includes(map.color.field)) {
      tooltip.push(map.color.field);
    }
    encode.tooltip = tooltip;
  }

  if ('itemName' in encode) {
    delete (encode as { itemName?: string }).itemName;
  }
}

function resolveAxisEncoding(
  base: Partial<Record<ChannelName, EncodingBinding>>,
  marks: readonly NormalizedMark[]
): Partial<Record<ChannelName, EncodingBinding>> {
  const resolved: Partial<Record<ChannelName, EncodingBinding>> = { ...base };

  for (const mark of marks) {
    if (resolved.x && resolved.y) {
      break;
    }

    const markEncodings = convertEncodingMap(mark.encodings);

    if (!resolved.x && markEncodings.x) {
      resolved.x = markEncodings.x;
    }

    if (!resolved.y && markEncodings.y) {
      resolved.y = markEncodings.y;
    }
  }

  return resolved;
}

function createAxis(channel: 'x' | 'y', binding?: EncodingBinding): EChartsAxis | undefined {
  if (!binding) {
    return undefined;
  }

  return removeUndefined({
    type: inferAxisType(channel, binding),
    name: binding.title,
    nameLocation: 'end' as const,
    boundaryGap: binding.channel === 'x' ? true : undefined,
  });
}

function defaultAxis(channel: 'x' | 'y'): EChartsAxis {
  return channel === 'x'
    ? { type: 'category', boundaryGap: true }
    : { type: 'value', boundaryGap: [0, 0] };
}

function inferAxisType(channel: 'x' | 'y', binding: EncodingBinding): EChartsAxis['type'] {
  if (binding.scale === 'temporal' || binding.timeUnit) {
    return 'time';
  }

  if (binding.scale === 'log') {
    return 'log';
  }

  if (binding.aggregate || (binding.scale && QUANT_SCALES.has(binding.scale))) {
    return 'value';
  }

  if (binding.scale && CATEGORY_SCALES.has(binding.scale)) {
    return 'category';
  }

  if (channel === 'x') {
    return 'category';
  }

  return 'value';
}

function convertGrid(layout?: LayoutConfig): EChartsGrid | undefined {
  if (!layout) {
    return undefined;
  }

  const padding = layout.padding ?? 24;

  return {
    containLabel: true,
    left: padding,
    right: padding,
    top: padding,
    bottom: padding,
  };
}

function buildDataZoomComponents(spec: NormalizedVizSpec): readonly EChartsDataZoom[] | undefined {
  const interactions = spec.interactions ?? [];
  const components: EChartsDataZoom[] = [];

  for (const interaction of interactions) {
    if (!isIntervalInteraction(interaction)) {
      continue;
    }

    if (interaction.rule.bindTo !== 'filter' && interaction.rule.bindTo !== 'zoom') {
      continue;
    }

    const axes = deriveAxisTargets(interaction.select.encodings);
    if (!axes) {
      continue;
    }

    const filterMode: EChartsDataZoom['filterMode'] =
      interaction.rule.bindTo === 'filter' ? 'filter' : 'none';

    components.push(
      removeUndefined<EChartsDataZoom>({
        id: `${interaction.id}:inside`,
        type: 'inside',
        filterMode,
        xAxisIndex: axes.xAxisIndex,
        yAxisIndex: axes.yAxisIndex,
      })
    );

    if (interaction.rule.bindTo === 'filter') {
      components.push(
        removeUndefined<EChartsDataZoom>({
          id: `${interaction.id}:slider`,
          type: 'slider',
          filterMode,
          orient: axes.xAxisIndex && !axes.yAxisIndex ? 'horizontal' : 'vertical',
          xAxisIndex: axes.xAxisIndex,
          yAxisIndex: axes.yAxisIndex,
        })
      );
    }
  }

  return components.length > 0 ? components : undefined;
}

function buildBrushComponent(spec: NormalizedVizSpec): EChartsBrush | undefined {
  const interactions = spec.interactions ?? [];
  const candidate = interactions.find(isMultiAxisBrushInteraction);

  if (!candidate) {
    return undefined;
  }

  const axes = deriveAxisTargets(candidate.select.encodings);
  if (!axes?.xAxisIndex || !axes?.yAxisIndex) {
    return undefined;
  }

  return {
    toolbox: ['rect', 'keep', 'clear'],
    brushMode: 'single',
    brushLink: 'all',
    throttleType: 'debounce',
    xAxisIndex: axes.xAxisIndex,
    yAxisIndex: axes.yAxisIndex,
  };
}

function deriveAxisTargets(encodings: readonly ('x' | 'y')[]): {
  readonly xAxisIndex?: 'all';
  readonly yAxisIndex?: 'all';
} | undefined {
  const hasX = encodings.includes('x');
  const hasY = encodings.includes('y');

  if (!hasX && !hasY) {
    return undefined;
  }

  return {
    xAxisIndex: hasX ? 'all' : undefined,
    yAxisIndex: hasY ? 'all' : undefined,
  };
}

function isIntervalInteraction(interaction: NormalizedInteraction): interaction is IntervalInteraction {
  return interaction.select.type === 'interval';
}

function isMultiAxisBrushInteraction(interaction: NormalizedInteraction): interaction is IntervalInteraction {
  return (
    isIntervalInteraction(interaction) &&
    interaction.rule.bindTo === 'filter' &&
    interaction.select.encodings.length > 1
  );
}

function buildAria(spec: NormalizedVizSpec): Record<string, unknown> {
  const ariaLabel = spec.a11y.ariaLabel;

  return removeUndefined({
    enabled: true,
    description: spec.a11y.description,
    label: ariaLabel
      ? {
          enabled: true,
          description: ariaLabel,
        }
      : undefined,
  });
}

function buildTitle(spec: NormalizedVizSpec): Record<string, unknown> | undefined {
  if (!spec.name) {
    return undefined;
  }

  return removeUndefined({
    text: spec.name,
    subtext: spec.a11y.narrative?.summary,
  });
}

function buildTooltip(spec: NormalizedVizSpec): Record<string, unknown> {
  const interaction = findTooltipInteraction(spec.interactions);

  if (!interaction || interaction.rule.bindTo !== 'tooltip') {
    return { trigger: 'axis', axisPointer: { type: 'shadow' } };
  }

  return removeUndefined({
    trigger: 'item',
    appendToBody: true,
    className: 'oods-viz-tooltip',
    formatter: createTooltipFormatter(interaction.rule.fields),
  });
}

function findTooltipInteraction(interactions?: NormalizedVizSpec['interactions']): NormalizedInteraction | undefined {
  if (!interactions) {
    return undefined;
  }

  return interactions.find((interaction) => interaction.rule.bindTo === 'tooltip');
}

function createTooltipFormatter(fields: readonly string[]): (params: unknown) => string {
  return (params: unknown) => {
    const datum = extractDatum(params);

    if (!datum) {
      return '';
    }

    const rows = fields
      .map((field) => {
        const value = datum[field as keyof typeof datum];
        return `<div class="oods-viz-tooltip__row"><span class="oods-viz-tooltip__label">${field}</span><span class="oods-viz-tooltip__value">${value ?? '—'}</span></div>`;
      })
      .join('');

    return `<div class="oods-viz-tooltip__content">${rows}</div>`;
  };
}

function extractDatum(params: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(params)) {
    const [first] = params;
    if (first && typeof first === 'object' && first !== null && typeof (first as { data?: unknown }).data === 'object') {
      return (first as { data: Record<string, unknown> }).data;
    }
    return undefined;
  }

  if (params && typeof params === 'object') {
    const record = params as { data?: unknown };
    if (record.data && typeof record.data === 'object') {
      return record.data as Record<string, unknown>;
    }
  }

  return undefined;
}

function buildUserMeta(spec: NormalizedVizSpec): EChartsOption['usermeta'] {
  const meta: EChartsUserMeta = {
    specId: spec.id,
    name: spec.name,
    theme: spec.config?.theme,
    tokens: spec.config?.tokens,
    layout: spec.config?.layout,
    a11y: spec.a11y,
    portability: spec.portability,
    interactions: spec.interactions,
    layoutTrait: spec.layout,
  };

  return { oods: removeUndefined(meta) };
}

function removeUndefined<T extends object>(input: T): T {
  const entries = Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}
