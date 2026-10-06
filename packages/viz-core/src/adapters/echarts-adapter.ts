import type { TokenScope } from './echarts/token-resolver.js';
import type {
  TraitBinding as NormalizedTraitBinding,
  Transform as NormalizedSpecTransform,
} from '../spec/normalized-viz-spec.types.js';
import type {
  IntervalSelection,
  LayoutProjection,
  NormalizedVizSpec,
} from '../spec/normalized-viz-spec.js';
import { applyEChartsLayout, facetRenderedCellFilter } from './echarts-layout-mapper.js';
import { resolveScaleBindings, type ScaleResolution } from './scale-resolver.js';
import { numberFormatLocale, numberFormatDefaultLocale, timeFormatDefaultLocale } from 'vega-format';
import { BAR_MAX_THICKNESS, CURRENCY_FORMAT, currencyNumberLocale } from './vega-lite-adapter.js';
import { isMarkRectGrid, heatmapColorIsMeasure, getEncodingBinding, aggregateMarkRectCells } from '../a11y/data-analysis.js';
import { getVizScaleTokens } from '../tokens/scale-token-mapper.js';
import { resolveOodsEchartsChrome } from '../tokens/oods-echarts-chrome.js';
import { createVisualMapForScale } from './spatial/echarts-visualmap-generator.js';
import { paintedTitle } from '../spec/title-placement.js';

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
  readonly useUTC?: boolean;
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

export function toEChartsOption(spec: NormalizedVizSpec, scope: TokenScope = {}): EChartsOption {
  if (spec.marks.length === 0) {
    throw new EChartsAdapterError('Normalized viz spec must contain at least one mark.');
  }

  const currency = chartCurrency(spec);
  const datasetId = deriveDatasetId(spec);
  const bands = bandEncodings(spec, datasetId);
  const dataset = convertDataset(spec, datasetId, bands);
  const linkedDatasets = convertLinkedDatasets(spec, bands);
  const baseEncoding = convertEncodingMap(spec.encoding);
  const axisEncoding = resolveAxisEncoding(baseEncoding, spec.marks);
  const series = spec.marks.flatMap((mark, index) => {
    const entry = createSeries(mark, baseEncoding, datasetId, spec.layout);
    const band = bands.find((candidate) => candidate.markIndex === index);
    return band ? createBandSeries(entry, band) : [entry];
  });
  const xAxis = createAxis('x', axisEncoding.x, currency);
  const yAxis = createAxis('y', axisEncoding.y, currency);
  const legend = baseEncoding.color ? { show: true } : undefined;
  const tooltip = buildTooltip(spec, currency, bands);
  const dataZoom = buildDataZoomComponents(spec);
  const brush = buildBrushComponent(spec);
  const visualMap = buildHeatmapVisualMap(spec, scope);

  const option = removeUndefined({
    dataset: [dataset, ...linkedDatasets],
    series,
    xAxis: xAxis ?? defaultAxis('x'),
    yAxis: yAxis ?? defaultAxis('y'),
    // Preserve non-temporal options while fixing temporal ticks to UTC.
    useUTC: xAxis?.type === 'time' || yAxis?.type === 'time' ? true : undefined,
    legend,
    tooltip,
    grid: convertGrid(spec.config?.layout),
    dataZoom,
    brush,
    visualMap,
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

interface BandEncoding {
  readonly markIndex: number;
  readonly datasetId: string;
  readonly axis: 'x' | 'y';
  readonly first: string;
  readonly second: string;
  readonly difference: string;
}

function bandEncodings(spec: NormalizedVizSpec, datasetId: string): BandEncoding[] {
  const occupied = new Set([...(spec.data.values ?? []), ...Object.values(spec.datasets ?? {}).flat()].flatMap(Object.keys));
  return spec.marks.flatMap((mark, markIndex) => {
    if (mark.trait !== 'MarkArea' && mark.trait !== 'MarkBar') return [];
    const encoding = { ...spec.encoding, ...mark.encodings };
    if (encoding.x2 && encoding.y2) throw new EChartsAdapterError('A ranged area/bar supports one secondary axis at a time.');
    const axis = encoding.y2 ? 'y' : encoding.x2 ? 'x' : undefined;
    if (!axis) return [];
    const first = encoding[axis]?.field;
    const second = encoding[axis === 'y' ? 'y2' : 'x2']?.field;
    if (!first || !second) throw new EChartsAdapterError('A ranged area/bar requires both bound fields.');
    let difference = `__oods_band_${markIndex}`;
    while (occupied.has(difference)) difference += '_';
    occupied.add(difference);
    return [{ markIndex, datasetId: mark.from ?? datasetId, axis, first, second, difference }];
  });
}

function bandRows(rows: readonly Record<string, unknown>[] | undefined, bands: readonly BandEncoding[], datasetId: string): typeof rows {
  const selected = bands.filter((band) => band.datasetId === datasetId);
  if (!rows || selected.length === 0) return rows;
  return rows.map((row) => ({
    ...row,
    ...Object.fromEntries(selected.map((band) => [band.difference,
      row[band.first] == null || row[band.second] == null ? null : Number(row[band.second]) - Number(row[band.first]),
    ])),
  }));
}

function createBandSeries(series: EChartsSeries, band: BandEncoding): EChartsSeries[] {
  const stack = `__oods_band_stack_${band.markIndex}`;
  const tooltip = [...new Set([...(series.encode.tooltip ?? []), band.first, band.second])];
  const common = { ...series, stack, stackStrategy: 'all', showSymbol: false };
  return [
    {
      ...common, id: `${series.id ?? stack}:base`, silent: true,
      encode: { ...series.encode, [band.axis]: band.first, tooltip: [] },
      itemStyle: { color: 'transparent', opacity: 0 },
      lineStyle: { color: 'transparent', opacity: 0 },
      areaStyle: series.areaStyle ? { color: 'transparent', opacity: 0 } : undefined,
      tooltip: { show: false }, emphasis: { disabled: true },
    },
    { ...common, encode: { ...series.encode, [band.axis]: band.difference, tooltip } },
  ];
}

function convertDataset(spec: NormalizedVizSpec, datasetId: string, bands: readonly BandEncoding[]): EChartsDataset {
  // s159 m5: a MarkRect heatmap with a declared color aggregate DRAWS one aggregated cell per (x,y),
  // so the dataset source is the aggregated cells (not the raw multi-row source) — render == narrative.
  // undefined for every other spec → byte-identical.
  const source = bandRows(aggregateMarkRectCells(spec) ?? (Array.isArray(spec.data.values) ? spec.data.values : undefined), bands, datasetId);
  const dimensions = source ? inferDimensions(source) : undefined;

  return removeUndefined({
    id: datasetId,
    source,
    dimensions,
    transform: convertTransforms(spec.transforms),
  });
}

// Item #16 (s151 m03): resolve layered `Mark.from` references by registering each
// spec.datasets entry as a named ECharts dataset, so the series `datasetId = mark.from`
// (createSeries) names a real dataset instead of dangling. The primary dataset stays
// FIRST; spec.datasets entries follow in object-insertion order (deterministic). When
// spec.datasets is absent the map is empty → the spread contributes nothing → the option
// is byte-identical to pre-#16 (the gate). A `from` naming a missing key still dangles
// (left as a consumer error — the honest-fail WARN is a separate future item, #110).
function convertLinkedDatasets(spec: NormalizedVizSpec, bands: readonly BandEncoding[]): readonly EChartsDataset[] {
  return Object.entries(spec.datasets ?? {}).map(([id, rows]) =>
    removeUndefined({
      id,
      source: bandRows(rows, bands, id),
      dimensions: inferDimensions(bandRows(rows, bands, id) ?? []),
    })
  );
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
  fallbackDatasetId: string,
  layout: NormalizedVizSpec['layout'],
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
    barMaxWidth: categoryBarCap(mark, mergedEncoding, layout),
    areaStyle: (mark.options?.areaStyle as Record<string, unknown> | undefined) ?? markConfig.areaStyle,
    colorBy,
    smooth,
    showSymbol: mark.trait === 'MarkLine' ? false : undefined,
    symbolSize: inferSymbolSize(mark),
    lineStyle: mark.options?.lineStyle as Record<string, unknown> | undefined,
    itemStyle: mark.options?.itemStyle as Record<string, unknown> | undefined,
  });
}

/** s232-m01: match the Vega cap's band-axis and authored-thickness exclusions. */
function categoryBarCap(mark: NormalizedMark, encoding: Partial<Record<ChannelName, EncodingBinding>>, layout: NormalizedVizSpec['layout']): number | undefined {
  if (mark.trait !== 'MarkBar' || layout?.trait === 'LayoutConcat') return undefined;
  const band = (channel: 'x' | 'y') => {
    const binding = encoding[channel];
    return binding && inferAxisType(channel, binding) === 'category' && !binding.bin && !binding.timeUnit
      && (binding.scale === undefined || binding.scale === 'band');
  };
  const measure = (channel: 'x' | 'y') => {
    const binding = encoding[channel];
    return binding && (binding.type ? binding.type === 'quantitative' : binding.aggregate || ['linear', 'sqrt', 'log'].includes(binding.scale ?? ''));
  };
  const channel = band('x') && measure('y') ? 'x' : band('y') && measure('x') ? 'y' : undefined;
  if (!channel || resolveScaleBindings(layout)?.[channel] === 'independent') return undefined;
  const options = mark.options as Record<string, unknown> | undefined;
  const thickness = channel === 'x' ? 'width' : 'height';
  if (options?.orient !== undefined && options.orient !== (channel === 'x' ? 'vertical' : 'horizontal')) return undefined;
  if (encoding.size || options?.size !== undefined || options?.[thickness] !== undefined || options?.barWidth !== undefined) return undefined;
  return BAR_MAX_THICKNESS;
}

/** Like Vega's chart locale, one currency applies to every "$" format in the chart. */
function chartCurrency(spec: NormalizedVizSpec): string | undefined {
  const bindings = [spec.encoding, ...spec.marks.map(mark => mark.encodings)].flatMap(map => Object.values(convertEncodingMap(map)) as EncodingBinding[]);
  const currencies = [...new Set(bindings.map(binding => binding.currency).filter((code): code is string => typeof code === 'string'))];
  if (currencies.length > 1) throw new EChartsAdapterError(`A chart formats one currency; its bindings declare ${currencies.join(' and ')}.`);
  return currencies[0];
}

/** ECharts chooses its own ticks. Vega's floating formatter preserves each tick's precision when none is authored. */
function bindingFormatter(binding: EncodingBinding, currency?: string): ((value: unknown) => string) | undefined {
  const format = binding.format ?? (binding.currency ? CURRENCY_FORMAT : undefined);
  if (format === undefined) return undefined;
  if (binding.type === 'temporal' || binding.scale === 'temporal' || binding.timeUnit) {
    const formatted = timeFormatDefaultLocale().utcFormat(format);
    return value => formatted(new Date(value as string | number));
  }
  const locale = currency ? numberFormatLocale(currencyNumberLocale(currency)) : numberFormatDefaultLocale();
  const formatted = locale.formatFloat(format);
  return value => formatted(Number(value));
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

// sprint-156 m04 (NASA #4 / FD#18): a cartesian MarkRect heatmap whose color is a
// continuous measure emits an ECharts `visualMap` so the color legend renders (Vega
// auto-legends the same channel; ECharts had NO visualMap → the ECharts-only gap).
// Gate reuses the a11y measure predicates (isMarkRectGrid + heatmapColorIsMeasure) and
// ALSO fires for a `scale:'diverging'` heatmap (diverging is a continuous scale even when
// the color binding carries no explicit quantitative type). The continuous domain is the
// color field's numeric extent; the range is the OODS sequential (or diverging) viz-scale,
// resolved to canvas colors by the SHARED spatial generator; and the tick label is themed
// onto chrome exactly like the geo adapters (visualMap.textStyle.color = chrome.visualMapLabel).
function buildHeatmapVisualMap(spec: NormalizedVizSpec, scope: TokenScope): Record<string, unknown> | undefined {
  if (!isMarkRectGrid(spec)) {
    return undefined;
  }

  const colorBinding = getEncodingBinding(spec, 'color');
  const isDiverging = colorBinding?.scale === 'diverging';
  if (!colorBinding || !(heatmapColorIsMeasure(spec) || isDiverging)) {
    return undefined;
  }

  // s159 m5: extent from the AGGREGATED drawn cells when a color aggregate is declared (so the
  // visualMap legend == the drawn cells == the a11y narrative), else the raw color extent (unchanged).
  const allCells = aggregateMarkRectCells(spec) ?? (Array.isArray(spec.data.values) ? spec.data.values : []);
  // s161 m5 (Fork-4=A): when the facet is TRUNCATED (columns.limit / maxPanels) the ECharts render
  // draws only the rendered panels, so the visualMap must span only those cells — a cell in a
  // dropped panel is legended on nothing (the s160 review's facet-limit phantom: visualMap max=94 vs
  // ECharts-drawn max=30). The shared a11y narrative stays at the full-data extremum, honest for the
  // Vega-PRIMARY render (Vega draws every panel). Non-faceted / untruncated specs: predicate is
  // undefined or matches all → byte-identical to HEAD.
  const rendered = facetRenderedCellFilter(spec);
  const rows = rendered ? allCells.filter((cell) => rendered(cell as Record<string, unknown>)) : allCells;
  const values = rows
    .map((row) => Number((row as Record<string, unknown>)[colorBinding.field]))
    .filter((value) => Number.isFinite(value));

  const range = isDiverging ? getVizScaleTokens('diverging') : getVizScaleTokens('sequential');
  const base = createVisualMapForScale({
    scope,
    scale: isDiverging ? 'diverging' : 'linear',
    range,
    values,
  });

  // s166 m01 (FF#23): a dimensionless continuous visualMap binds to the LAST dataset
  // dimension, so a trailing non-measure field (a string) blanked every cell to fill:none.
  // Pin the mapped dimension to the color field by NAME — not index: a series reading a
  // spec.datasets-linked dataset (convertLinkedDatasets) can carry dims that diverge from
  // spec.data.values, and a name resolves per-dataset. Emitted only when drawn cells exist;
  // the empty-data path has no row to read and keeps the bare fallbackDomain visualMap.
  const dimension = rows.length > 0 ? colorBinding.field : undefined;

  // Bake the tick label onto chrome — the same visualMap-label token the geo adapters use.
  const chrome = resolveOodsEchartsChrome(spec, scope);
  return {
    ...base,
    ...(dimension !== undefined ? { dimension } : {}),
    textStyle: { color: chrome.visualMapLabel },
  };
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

function createAxis(channel: 'x' | 'y', binding?: EncodingBinding, currency?: string): EChartsAxis | undefined {
  if (!binding) {
    return undefined;
  }

  return removeUndefined({
    type: inferAxisType(channel, binding),
    name: binding.title,
    nameLocation: 'end' as const,
    axisLabel: binding.format !== undefined || binding.currency ? { formatter: bindingFormatter(binding, currency) } : undefined,
    boundaryGap: binding.channel === 'x' ? true : undefined,
  });
}

function defaultAxis(channel: 'x' | 'y'): EChartsAxis {
  return channel === 'x'
    ? { type: 'category', boundaryGap: true }
    : { type: 'value', boundaryGap: [0, 0] };
}

function inferAxisType(channel: 'x' | 'y', binding: EncodingBinding): EChartsAxis['type'] {
  // A data-aware or caller-declared field type maps directly onto the ECharts
  // axis kind so the vega + echarts dual outputs AGREE (sprint-125 m01/m02).
  // Without this, an explicit `quantitative` would still fall to the echarts
  // category-axis channel default below while vega honored the type — the
  // silent dual-output trap.
  if (binding.type) {
    if (binding.type === 'temporal') return 'time';
    // An explicit `scale:'log'` wins over the quantitative default so a co-declared
    // type+log spec is not silently rendered linear while Vega honors the log scale
    // (sprint-156 m02 — the dual-output disagreement trap). Non-log quantitative
    // still maps to 'value'.
    if (binding.type === 'quantitative') return binding.scale === 'log' ? 'log' : 'value';
    return 'category'; // ordinal | nominal
  }

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
  const text = paintedTitle(spec);
  if (!text) {
    return undefined;
  }

  return removeUndefined({
    text,
    subtext: spec.a11y.narrative?.summary,
  });
}

function buildTooltip(spec: NormalizedVizSpec, currency: string | undefined, bands: readonly BandEncoding[]): Record<string, unknown> {
  const bindings = [spec.encoding, ...spec.marks.map(mark => mark.encodings)].flatMap(map => Object.values(convertEncodingMap(map)) as EncodingBinding[]);
  const formatters = bindingFormatters(bindings, currency);
  const interaction = findTooltipInteraction(spec.interactions);

  if (!interaction || interaction.rule.bindTo !== 'tooltip') {
    const formatted = bindings.some(binding => binding.format !== undefined || binding.currency);
    return { trigger: 'axis', axisPointer: { type: 'shadow' },
      ...(formatted ? { formatter: createAxisTooltipFormatter(spec, currency, bands) } : {}) };
  }

  return removeUndefined({
    trigger: 'item',
    appendToBody: true,
    className: 'oods-viz-tooltip',
    formatter: createTooltipFormatter(interaction.rule.fields, formatters),
  });
}

function findTooltipInteraction(interactions?: NormalizedVizSpec['interactions']): NormalizedInteraction | undefined {
  if (!interactions) {
    return undefined;
  }

  return interactions.find((interaction) => interaction.rule.bindTo === 'tooltip');
}

/** A size/color channel may reuse a money field without declaring its own format. Do not erase the positional one. */
function bindingFormatters(bindings: readonly EncodingBinding[], currency?: string): ReadonlyMap<string, (value: unknown) => string> {
  const formatters = new Map<string, (value: unknown) => string>();
  for (const binding of bindings) {
    const formatter = bindingFormatter(binding, currency);
    if (formatter) formatters.set(binding.field, formatter);
  }
  return formatters;
}

/** Axis tooltips contain one datum per visible series, including layers on different named datasets. */
function createAxisTooltipFormatter(spec: NormalizedVizSpec, currency: string | undefined, bands: readonly BandEncoding[]): (params: unknown) => string {
  const formatters = spec.marks.flatMap((mark, index) => {
    const bindings = Object.values(mergeEncodings(convertEncodingMap(spec.encoding), convertEncodingMap(mark.encodings))) as EncodingBinding[];
    const formatter = createTooltipFormatter([...new Set(bindings.map(binding => binding.field))], bindingFormatters(bindings, currency));
    // A ranged band has a transparent spacer series before the visible series; its tooltip is disabled.
    return bands.some(band => band.markIndex === index) ? [formatter, formatter] : [formatter];
  });
  return params => {
    const items = Array.isArray(params) ? params : [params];
    return items.map(item => {
      const series = item as { seriesIndex?: number; seriesName?: string } | null;
      const formatter = formatters[(series?.seriesIndex ?? 0) % formatters.length] ?? formatters[0]!;
      const name = items.length > 1 && series?.seriesName ? `<div class="oods-viz-tooltip__label">${escapeHtml(series.seriesName)}</div>` : '';
      return name + formatter(item);
    }).join('');
  };
}

function escapeHtml(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function createTooltipFormatter(fields: readonly string[], formatters: ReadonlyMap<string, ((value: unknown) => string) | undefined>): (params: unknown) => string {
  return (params: unknown) => {
    const datum = extractDatum(params);

    if (!datum) {
      return '';
    }

    const rows = fields
      .map((field) => {
        const raw = datum[field as keyof typeof datum];
        const value = raw == null ? '—' : formatters.get(field)?.(raw) ?? raw;
        return `<div class="oods-viz-tooltip__row"><span class="oods-viz-tooltip__label">${escapeHtml(field)}: </span><span class="oods-viz-tooltip__value">${escapeHtml(value)}</span></div>`;
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
