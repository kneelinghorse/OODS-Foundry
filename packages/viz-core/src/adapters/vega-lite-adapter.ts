import type {
  TraitBinding as NormalizedTraitBinding,
  Transform as NormalizedSpecTransform,
} from '../spec/normalized-viz-spec.types.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { resolveCategoricalPalette, resolveSingleSeriesColor, toHex } from '../tokens/categorical-palette.js';
import { resolveOodsVegaConfig } from '../tokens/oods-vega-config.js';
import { getVizScaleTokens } from '../tokens/scale-token-mapper.js';
import { resolveTokenToColor, type TokenScope } from './echarts/token-resolver.js';
import { buildVegaLiteSpec } from './vega-lite-layout-mapper.js';
import { resolveScaleBindings } from './scale-resolver.js';
import { paintedTitle } from '../spec/title-placement.js';

const VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v6.json';

/**
 * s211-m02: a small categorical bar chart drawn at Vega-Lite's intrinsic size was a narrow column: four bars made an
 * 80px plot 300px tall, with its labels turned on end and its title wider than the plot. A vertical bar chart over at
 * most SMALL_CATEGORICAL_MAX categories that sets no size of its own is laid out landscape, and its category labels stay
 * horizontal when the longest fits its band. A caller may still render the chart at another size (a placed chart's
 * narrow render is 360px wide), so the labels are judged at that narrowest width. The estimate is Vega's own arithmetic
 * one (the SVG emitter pins it): about 6px per character at the 10px axis label.
 */
const SMALL_CATEGORICAL_MAX = 12;
/**
 * s222-m02 (#2502 ruling 12): at most 320px tall. `height` is the whole chart's (title, axes and labels included; Vega's
 * fit-y), so turned labels or a painted title take room from the plot instead of growing the chart; it was a 240px plot
 * with everything else added, 315 to 346px tall.
 */
const SMALL_CATEGORICAL_LAYOUT = { minWidth: 400, maxWidth: 640, perCategory: 64, height: 300 } as const;
const AXIS_LABEL_CHAR_WIDTH = 6;
const NARROWEST_RENDER_WIDTH = 360;

/**
 * s222-m02 (#2502 ruling 12): a y axis labels about five values at most. Vega-Lite's default, ceil(height / 40), put nine
 * on a 205px plot and twelve on a 245px one, where d3's nice steps doubled the count; a shorter plot keeps its smaller
 * default. It reads the `height` signal, which a single view and a layer have.
 */
const CAPPED_Y_TICKS = { expr: 'min(5, ceil(height / 40))' } as const;
/**
 * s222-m02 follow-up (#2502 ruling 12): a line, area or scatter chart drawn at no explicit size fits the same 300px as a
 * small bar chart, title, axes and legend included (Vega-Lite's default was a 300px plot with them added, 375px tall);
 * its width stays Vega-Lite's own.
 */
const CONTINUOUS_DEFAULT_TRAITS = new Set(['MarkLine', 'MarkArea', 'MarkPoint']);
function continuousDefaultHeight(spec: NormalizedVizSpec): number | undefined {
  const layout = spec.config?.layout;
  if (layout?.width !== undefined || layout?.height !== undefined || spec.layout !== undefined) return undefined;
  return spec.marks.length > 0 && spec.marks.every((mark) => CONTINUOUS_DEFAULT_TRAITS.has(mark.trait)) ? SMALL_CATEGORICAL_LAYOUT.height : undefined;
}

/** True when the longest category label fits its band at this render width, by Vega's arithmetic label estimate. */
function labelsFit(categories: readonly string[], width: number): boolean {
  const longest = Math.max(...categories.map((category) => category.length));
  return longest * AXIS_LABEL_CHAR_WIDTH <= (width / categories.length) * 0.9;
}

function smallCategoricalDefaults(spec: NormalizedVizSpec): { width: number; height: number; horizontalLabels: boolean } | undefined {
  const layout = spec.config?.layout;
  if (layout?.width !== undefined || layout?.height !== undefined || spec.layout !== undefined) return undefined;
  if (!spec.marks.every((mark) => mark.trait === 'MarkBar')) return undefined;
  const x = spec.encoding?.x ?? spec.marks[0]?.encodings?.x;
  const y = spec.encoding?.y ?? spec.marks[0]?.encodings?.y;
  // s222-m02 (#2502 ruling 12): both types as the compile infers them, so an aggregated measure (the payment chart's summed
  // amount, which declares no type) is quantitative here too, and a band-scaled category (the census bar's region) is
  // ordinal; they were drawn at Vega-Lite's 300px default, 405 to 433px tall.
  if (!x || !y) return undefined;
  const xType = inferFieldType('x', x);
  if ((xType !== 'nominal' && xType !== 'ordinal') || inferFieldType('y', y) !== 'quantitative') return undefined;
  const categories = [...new Set((spec.data?.values ?? []).map((row) => String(row[x.field] ?? '')))];
  if (categories.length === 0 || categories.length > SMALL_CATEGORICAL_MAX) return undefined;
  const { minWidth, maxWidth, perCategory, height } = SMALL_CATEGORICAL_LAYOUT;
  const width = Math.min(maxWidth, Math.max(minWidth, categories.length * perCategory));
  return { width, height, horizontalLabels: labelsFit(categories, NARROWEST_RENDER_WIDTH) };
}

/**
 * s222-m02 (#2502 ruling 12): a bar chart drawn at a known width keeps its category labels level when they fit its bands
 * at that width (the payment chart's "May 12, 2026" turned on end at 720 and 1120 wide). The compiled spec keeps the
 * judgement at the narrowest width, because its content hash never depends on a render size; viz.render applies this to
 * the copy it draws at an explicit width. A single-view bar chart over at most 12 categories whose labels the compile
 * did not already level; anything else is returned unchanged. At phone widths, long labels stay level and Vega samples
 * overlaps instead of rotating full dates into the plot (s231-m04). Every mark and its full accessible label remains.
 */
export function withRenderWidthLabels<T extends object>(compiled: T, renderWidth: number, marks: readonly string[] = ['bar']): T {
  const view = compiled as { mark?: unknown; encoding?: Record<string, { field?: string; type?: string } | undefined>; data?: { values?: unknown }; config?: { axisX?: Record<string, unknown> } & Record<string, unknown> };
  const mark = typeof view.mark === 'string' ? view.mark : (view.mark as { type?: unknown } | undefined)?.type;
  const x = view.encoding?.x;
  const y = view.encoding?.y;
  // `marks`: the dashboard export also levels a line's or an area's discrete x labels (s222-m02 follow-up).
  if (typeof mark !== 'string' || !marks.includes(mark) || !x?.field || (x.type !== 'nominal' && x.type !== 'ordinal') || y?.type !== 'quantitative') return compiled;
  if (view.config?.axisX?.labelAngle !== undefined || !Array.isArray(view.data?.values)) return compiled;
  const categories = [...new Set((view.data.values as Array<Record<string, unknown>>).map((row) => String(row?.[x.field!] ?? '')))];
  if (categories.length === 0 || categories.length > SMALL_CATEGORICAL_MAX) return compiled;
  const fits = labelsFit(categories, renderWidth);
  if (!fits && (renderWidth > NARROWEST_RENDER_WIDTH || view.config?.axisX?.labelOverlap !== undefined)) return compiled;
  return { ...compiled, config: { ...view.config, axisX: { ...view.config?.axisX, labelAngle: 0, ...(!fits ? { labelOverlap: 'greedy' } : {}) } } };
}
/**
 * s222-m02 (#2502 ruling 12): a chart drawn at a known size labels about five y values at most. Vega-Lite's default,
 * ceil(height / 40), put nine on the payment chart's 205px plot and twelve on a dashboard panel's 245px one, where d3's
 * nice steps doubled the count; a shorter plot keeps its smaller default. Applied, like withRenderWidthLabels, to the copy
 * a caller draws at an explicit size, never to the compiled spec. Only a single view or a layer has the `height` signal
 * the expression reads; any other spec, or an authored tick count, is returned unchanged.
 */
export function withCappedYTicks<T extends object>(compiled: T): T {
  const view = compiled as Record<string, unknown> & { config?: Record<string, unknown> & { axisY?: Record<string, unknown> } };
  if (['facet', 'repeat', 'concat', 'hconcat', 'vconcat'].some((key) => key in view)) return compiled;
  if (view.config?.axisY?.tickCount !== undefined) return compiled;
  return { ...compiled, config: { ...view.config, axisY: { ...view.config?.axisY, tickCount: CAPPED_Y_TICKS } } };
}
/**
 * s223-m01 (#2527 ruling 3): a bar is at most this thick. Placed charts are drawn 720, 360 and 1120 wide with
 * `autosize: fit`, so one or a few categories filled the plot with one bar (a single band was about 90% of it). A bar
 * on a band axis is drawn min(48, bandwidth) thick and centred in its band; a chart whose bands are already narrower,
 * as many categories make them, draws the same bars.
 */
export const BAR_MAX_THICKNESS = 48;
/**
 * s223-m01 (#2527 ruling 2): the label format a currency implies when its binding declares none. A d3-format specifier
 * without a precision takes the precision of the tick step (Vega's tick formatting), so neighbouring ticks never read
 * the same ($0.0, $0.2, ... at a small range) and a large range reads as money ($12,000).
 */
export const CURRENCY_FORMAT = '$,f';
const CHANNEL_ORDER = ['x', 'x2', 'y', 'y2', 'color', 'size', 'shape', 'detail'] as const;
const QUANT_SCALE_TYPES = new Set(['linear', 'log', 'sqrt']);
const ORDINAL_SCALE_TYPES = new Set(['band', 'point']);

// sprint-156 m04: the OODS diverging viz-scale, resolved ONCE to canonical hex through the
// SAME token→color chain the categorical bake + certify use, so the diverging range that
// renders is the diverging range that would be graded ("rendered == certified"). A diverging
// color is a continuous gradient (role-B exempt), so this is a bake, not a graded palette.
const divergingRange = (scope: TokenScope): readonly string[] => getVizScaleTokens('diverging')
  .map((token) => scope.theme === 'hc' ? resolveTokenToColor(token, scope) : toHex(resolveTokenToColor(token, scope) ?? ''))
  .filter((color): color is string => Boolean(color));
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
  // Item #16 (s151 m03): Vega-Lite native top-level named-datasets map that layer
  // `data:{name}` references resolve against; omitted when spec.datasets is absent.
  readonly datasets?: NormalizedVizSpec['datasets'];
  readonly transform?: readonly AdapterTransform[];
  readonly params?: readonly AdapterInteractionParam[];
  readonly width?: number;
  readonly height?: number;
  readonly autosize?: { readonly type: 'fit-y'; readonly contains: 'padding' };
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

export function toVegaLiteSpec(spec: NormalizedVizSpec, scope: TokenScope = {}): VegaLiteAdapterSpec {
  if (spec.marks.length === 0) {
    throw new VegaLiteAdapterError('Normalized viz spec must contain at least one mark.');
  }

  // Brand-fidelity (sprint-138 m02): resolve the OODS categorical palette ONCE here,
  // at the only level that can see spec.config.tokens, then THREAD the resolved hex[]
  // down into convertBinding (multi-series scale.range) and createMark (single-series
  // mark.color). convertBinding's (channel, binding) signature cannot reach the spec,
  // so the palette must be passed in — never re-resolved per binding (memo §6 blocker-2).
  const categoricalPalette = resolveCategoricalPalette(spec, scope);
  // A single-series chart carries NO color channel anywhere; it renders one mark color,
  // so bake the single-series token as mark.color, matching the shared certification resolver
  // (memo §6 — else the hollow survives silently for the common single-series case).
  const hasColorEncoding =
    Boolean(spec.encoding?.color) || spec.marks.some((mark) => Boolean(mark.encodings?.color));
  const singleSeriesColor =
    !hasColorEncoding ? resolveSingleSeriesColor(spec, scope) : undefined;

  // Cartesian chrome theme (sprint-144 m02): resolve the OODS-tokened Vega `config`
  // theme ONCE here — the only level that sees spec.config.tokens — and attach it
  // top-level below (merged with the caller's config.mark). Unlike the palette it
  // needs no per-binding threading: config is a top-level Vega-Lite block that
  // applies to every nested view. Chrome only — series color stays in the bake above.
  const oodsConfig = resolveOodsVegaConfig(spec, scope);

  const interactions = normalizeInteractions(spec.interactions);
  const data = convertData(spec);
  const transform = mergeTransforms(convertTransforms(spec.transforms), buildInteractionTransforms(interactions));
  const baseEncoding = convertEncodingMap(spec.encoding, categoricalPalette, scope);
  const interactionParams = convertInteractionParams(interactions);
  const interactionEncoding = convertInteractionBindings(interactions);
  const namedBands = namedBandChannels(spec.layout);
  const convertedLayers = keepRowOrder(spec.marks.map((mark) =>
    createLayer(mark, baseEncoding, interactionEncoding, categoricalPalette, singleSeriesColor, scope, namedBands),
  ));
  const currency = chartCurrency(spec);
  const orderedLayers = applyLayerOrdering(spec.layout, convertedLayers);
  const requiresLayer = orderedLayers.length > 1 || orderedLayers.some((layer) => layer.data !== undefined);

  const layout = spec.config?.layout ?? {};
  const small = smallCategoricalDefaults(spec);
  const continuousHeight = small ? undefined : continuousDefaultHeight(spec);
  const defaultSized = small !== undefined || continuousHeight !== undefined;
  // Merge, don't overwrite (backward-compat #84): the OODS chrome config carries no
  // `mark` key (chrome-only guardrail), and the caller's config.mark is spread LAST
  // so it wins its own key — zero collision. The baked config is now unconditionally
  // present (was conditional on a caller mark), which is correct and additive.
  const config = {
    ...oodsConfig,
    ...(small?.horizontalLabels ? { axisX: { ...oodsConfig.axisX, labelAngle: 0 } } : {}),
    // A chart the compile sizes carries the y-tick cap with its size (s222-m02 follow-up).
    ...(defaultSized ? { axisY: { ...oodsConfig.axisY, tickCount: CAPPED_Y_TICKS } } : {}),
    ...(spec.config?.mark ? { mark: spec.config.mark } : {}),
    // s223-m01 (#2527 ruling 2): the chart's currency is its number locale's, so "$" in a label format prints € or £.
    ...(currency ? { locale: { number: currencyNumberLocale(currency) } } : {}),
  };

  const baseSpec = removeUndefined({
    $schema: VEGA_LITE_SCHEMA_URL,
    title: paintedTitle(spec),
    description: spec.a11y.description,
    data,
    // Item #16 (s151 m03): thread the named-datasets map onto Vega-Lite's NATIVE top-level
    // `datasets` block so a layer's `data:{name:mark.from}` (createLayer) resolves instead
    // of dangling. `removeUndefined` strips the key when spec.datasets is absent → a spec
    // without the slot compiles byte-identically to pre-#16 (the gate). Only `from`-
    // referenced layers gain a data:{name}; the primary layer stays inline (top-level data).
    datasets: spec.datasets,
    transform,
    params: requiresLayer ? undefined : interactionParams,
    width: layout.width ?? small?.width,
    height: layout.height ?? small?.height ?? continuousHeight,
    autosize: defaultSized ? ({ type: 'fit-y', contains: 'padding' } as const) : undefined,
    padding: layout.padding,
    config,
    usermeta: buildUserMeta(spec),
  });

  const primitive = requiresLayer
    ? {
        layer: orderedLayers.map((layer, index) =>
          removeUndefined({
            params: index === 0 ? interactionParams : undefined,
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
  interactionEncoding?: Record<string, unknown>,
  palette?: readonly string[],
  singleSeriesColor?: string,
  scope: TokenScope = {},
  namedBands: ReadonlySet<'x' | 'y'> = new Set()
): ConvertedLayer {
  const markEncodings = convertEncodingMap(mark.encodings, palette, scope);
  const encoding = mergeEncodings(mergeEncodings(baseEncoding, markEncodings), interactionEncoding);

  if (Object.keys(encoding).length === 0) {
    throw new VegaLiteAdapterError(`Mark ${mark.trait} does not provide any encodings.`);
  }

  const banded = applyBarBand(mark, createMark(mark, singleSeriesColor), applyBaselineToEncoding(mark, applyHeatmapPalette(mark, encoding, scope)), namedBands);
  return {
    key: inferLayerKey(mark),
    mark: banded.mark,
    encoding: banded.encoding,
    data: mark.from ? { name: mark.from } : undefined,
  };
}

/**
 * s223-m01 (#2527 ruling 3): the channels whose compiled band scale Vega names after the channel, which a bar's thickness
 * expression can read (`bandwidth('x')`). A single view, and a layer or facet that shares the channel's scale (the
 * default), name it 'x' or 'y'; an independent scale is renamed per child (child_x, layer_0_x) and a concat's per section
 * (concat_0_x). There `bandwidth('x')` is 0 and would erase the bars, so those bars keep Vega-Lite's own thickness.
 */
function namedBandChannels(layout: NormalizedVizSpec['layout']): ReadonlySet<'x' | 'y'> {
  if (!layout) return new Set(['x', 'y']);
  if (layout.trait === 'LayoutConcat') return new Set();
  const resolution = resolveScaleBindings(layout);
  return new Set((['x', 'y'] as const).filter((channel) => resolution?.[channel] !== 'independent'));
}

/** A positional definition Vega-Lite draws on a band scale: a discrete field, not binned, not a time unit, not a point scale. */
function onBandScale(definition: unknown): boolean {
  if (!definition || typeof definition !== 'object') return false;
  const { type, bin, timeUnit, scale } = definition as { type?: unknown; bin?: unknown; timeUnit?: unknown; scale?: { type?: unknown } };
  return (type === 'nominal' || type === 'ordinal') && !bin && !timeUnit && (scale?.type === undefined || scale.type === 'band');
}

/** The channel a bar's bands run along: x for a vertical bar (a band x over a quantitative y), y for a horizontal one. */
function barBandChannel(encoding: Record<string, unknown>): 'x' | 'y' | undefined {
  const quantitative = (definition: unknown) => (definition as { type?: unknown } | undefined)?.type === 'quantitative';
  if (onBandScale(encoding.x) && quantitative(encoding.y)) return 'x';
  if (onBandScale(encoding.y) && quantitative(encoding.x)) return 'y';
  return undefined;
}

/**
 * s223-m01 (#2527 ruling 3): a bar on a band axis is at most BAR_MAX_THICKNESS thick (MarkDef.width, or height for a
 * horizontal bar, `min(48, bandwidth(<channel>))`; Vega-Lite then centres it in its band), and MarkBar's `bandPadding`
 * option is the band scale's paddingInner (it was dropped as a key MarkDef does not have). Neither applies to a bar on a
 * temporal, linear or binned axis (no bands: bandwidth is 0), to a bar whose thickness the spec already sets (a size
 * encoding or option, or its own width/height), or to a declared orientation the encodings contradict. The cap needs
 * the band scale's name, so it waits for a channel `namedBandChannels` names; the padding does not.
 */
function applyBarBand(
  mark: NormalizedMark,
  markDef: Record<string, unknown>,
  encoding: Record<string, unknown>,
  namedBands: ReadonlySet<'x' | 'y'>,
): { mark: Record<string, unknown>; encoding: Record<string, unknown> } {
  if (markDef.type !== 'bar') return { mark: markDef, encoding };
  const channel = barBandChannel(encoding);
  if (!channel || (markDef.orient !== undefined && markDef.orient !== (channel === 'x' ? 'vertical' : 'horizontal'))) return { mark: markDef, encoding };
  const padding = (mark.options as Record<string, unknown> | undefined)?.bandPadding;
  const padded = typeof padding === 'number' && Number.isFinite(padding) && padding >= 0 && padding < 1
    ? { ...encoding, [channel]: { ...(encoding[channel] as object), scale: { ...((encoding[channel] as { scale?: object }).scale ?? {}), paddingInner: padding } } }
    : encoding;
  const thickness = channel === 'x' ? 'width' : 'height';
  if (!namedBands.has(channel) || markDef[thickness] !== undefined || markDef.size !== undefined || encoding.size !== undefined) return { mark: markDef, encoding: padded };
  return { mark: { ...markDef, [thickness]: { expr: `min(${BAR_MAX_THICKNESS}, bandwidth('${channel}'))` } }, encoding: padded };
}

/**
 * s224-m01 (#2542 ruling 3): a line or an area reads in its rows' order. Vega-Lite sorts a discrete domain ascending
 * when no sort is given, so rows Jan, Feb drew as Feb, Jan and rising revenue read as falling. A line or area layer on
 * a nominal or ordinal x (not binned, no time unit) that declares no sort takes `sort: null`, Vega-Lite's data order,
 * and so does every other layer's undeclared discrete x: layers union their x domains, where one ascending sort would
 * win. A declared sort is kept ('none' arrives as null, convertBinding); a bar chart keeps its ascending order, and a
 * temporal x is continuous.
 */
function keepRowOrder(layers: readonly ConvertedLayer[]): ConvertedLayer[] {
  const undeclared = (definition: unknown): boolean => {
    const { type, bin, timeUnit, sort } = (definition ?? {}) as Record<string, unknown>;
    return (type === 'nominal' || type === 'ordinal') && !bin && !timeUnit && sort === undefined;
  };
  if (!layers.some((layer) => (layer.mark.type === 'line' || layer.mark.type === 'area') && undeclared(layer.encoding.x))) return [...layers];
  return layers.map((layer) => undeclared(layer.encoding.x) ? { ...layer, encoding: { ...layer.encoding, x: { ...(layer.encoding.x as object), sort: null } } } : layer);
}

/**
 * s223-m01 (#2527 ruling 2): the one currency a chart's bindings declare. Vega's number locale is the chart's, so two
 * currencies cannot both print their symbol: that is an error, never a silent pick.
 */
function chartCurrency(spec: NormalizedVizSpec): string | undefined {
  const bindings = [spec.encoding, ...spec.marks.map((mark) => mark.encodings)].flatMap((map) => Object.values(map ?? {}) as Array<EncodingBinding | undefined>);
  const currencies = [...new Set(bindings.map((binding) => binding?.currency).filter((code): code is string => typeof code === 'string'))];
  if (currencies.length > 1) throw new VegaLiteAdapterError(`A chart formats one currency; its bindings declare ${currencies.join(' and ')}.`);
  return currencies[0];
}

/**
 * s223-m01 (#2527 ruling 2): Vega's number locale for a currency: en-US separators, as the record view's
 * Intl.NumberFormat('en-US') prints money, with that currency's en-US symbol where a format writes "$" (EUR €12,000,
 * GBP £12,000, CHF "CHF 12,000").
 */
export function currencyNumberLocale(code: string): { decimal: string; thousands: string; grouping: number[]; currency: [string, string] } {
  let parts: Intl.NumberFormatPart[];
  try {
    parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(1);
  } catch {
    throw new VegaLiteAdapterError(`"${code}" is not an ISO 4217 currency code.`);
  }
  const number = new Set(['integer', 'group', 'decimal', 'fraction']);
  const first = parts.findIndex((part) => number.has(part.type));
  let last = parts.length - 1;
  while (last >= 0 && !number.has(parts[last]!.type)) last -= 1;
  const text = (slice: Intl.NumberFormatPart[]) => slice.map((part) => part.value).join('');
  return { decimal: '.', thousands: ',', grouping: [3], currency: [text(parts.slice(0, first)), text(parts.slice(last + 1))] };
}

/**
 * Public defaults opt into the sequential range; authored pattern presentation stays stable. In hc every continuous colour
 * takes the declared scale as quantized symbols (s222-m02, I48: not only a MarkRect heatmap's; diverging-bar's bars left
 * Vega's default gradient legend, black and #ddd, outside the hc token scope).
 */
function applyHeatmapPalette(mark: NormalizedMark, encoding: Record<string, unknown>, scope: TokenScope): Record<string, unknown> {
  const color = encoding.color as Record<string, unknown> | undefined;
  const hc = scope.theme === 'hc';
  if (color?.type !== 'quantitative' || (!hc && mark.trait !== 'MarkRect')) return encoding;
  const scale = (color.scale ?? {}) as Record<string, unknown>;
  if (!hc && (mark.options?.colorScheme !== 'sequential' || scale.range)) return encoding;
  const range = (scale.domainMid === 0 ? getVizScaleTokens('diverging') : getVizScaleTokens('sequential'))
    .map(token => hc ? resolveTokenToColor(token, scope) : toHex(resolveTokenToColor(token, scope) ?? ''));
  if (range.some(paint => !paint)) throw new VegaLiteAdapterError('Heatmap palette tokens did not resolve.');
  return { ...encoding, color: { ...color,
    scale: { ...scale, ...(hc ? { type: 'quantize' } : {}), range },
    ...(hc ? { legend: { ...(color.legend as object), type: 'symbol', symbolStrokeColor: resolveTokenToColor('--oods-sys-text-primary', scope) } } : {}),
  } };
}

/**
 * `mark.options.baseline` → `encoding.<quantitative>.scale.zero` (s168 m02).
 *
 * This lives in the ENCODING region and not in `createMark` because its target IS an
 * encoding: OODS's `baseline` says where the measure axis starts, which Vega-Lite spells
 * `scale.zero`. Emitting it as a mark property is what made four committed fixtures
 * schema-invalid — `MarkDef.baseline` is `TextBaseline` (`'alphabetic' | 'top' | ...`),
 * so `'zero'` failed an enum check and the numeric `0` failed a type check.
 *
 * Three accepted spellings, all of them observed:
 *   `'zero'` → `zero: true`   (declared by mark-area.parameters.schema.json)
 *   `'min'`  → `zero: false`  (declared, no committed occurrence)
 *   `0`      → `zero: true`   (NOT declared anywhere — it comes from the committed
 *                              MarkBar fixtures, which is why a declared-surface-only
 *                              derivation would have missed it)
 * Anything else is dropped rather than guessed at.
 *
 * CHANNEL CHOICE, stated because it is a judgement call: `y` if it is quantitative,
 * else `x`. `baseline` names the measure axis; the channel's own TYPE is the signal used
 * to find it. If neither positional channel is quantitative, nothing is emitted.
 * (s171 m05a CORRECTION: this used to add "a caller-declared `scale.zero` always wins" —
 * no caller can declare one: `TraitBinding.scale` is a string enum, and no code path
 * writes `scale.zero` onto an encoding before this function runs.)
 *
 * s169 m05 CORRECTION: this comment used to justify the choice partly by saying
 * `orientation` "is itself an OODS-only key with no MarkDef target, so it cannot be relied
 * on here". The first half is no longer true — `orientation` now translates to
 * `MarkDef.orient`. The channel choice is UNCHANGED and still correct, because
 * quantitative-ness is the direct signal and `orient` is advisory (Vega-Lite ignores it on
 * stacked charts). The stale half of the rationale is removed rather than left to be read
 * as a live constraint.
 */
function applyBaselineToEncoding(
  mark: NormalizedMark,
  encoding: Record<string, unknown>,
): Record<string, unknown> {
  const baseline = (mark.options as Record<string, unknown> | undefined)?.baseline;
  if (baseline === undefined) return encoding;

  const zero =
    baseline === 'zero' || baseline === 0 ? true : baseline === 'min' ? false : undefined;
  if (zero === undefined) return encoding;

  for (const channel of ['y', 'x'] as const) {
    const definition = encoding[channel] as Record<string, unknown> | undefined;
    if (!definition || definition.type !== 'quantitative') continue;
    const scale = (definition.scale as Record<string, unknown> | undefined) ?? {};
    // Defensive, currently unreachable: nothing upstream writes scale.zero (see the
    // s171 m05a correction above). Kept so a future writer cannot be silently clobbered.
    if (scale.zero !== undefined) return encoding;
    return { ...encoding, [channel]: { ...definition, scale: { ...scale, zero } } };
  }

  return encoding;
}

/**
 * Every property the Vega-Lite v6 `MarkDef` accepts (88 of them), as an ALLOWLIST.
 *
 * s167 m03 shipped a two-entry DENYLIST (`id`, `curve`) derived from the fixture CORPUS.
 * That was the wrong operand. The declared surface is
 * `schemas/traits/mark-*.parameters.schema.json` — closed per-trait vocabularies that
 * s167 never consulted — and unioned with the corpus and the keys the ECharts adapter
 * and the React views read off the IR, **14 distinct keys are not MarkDef properties**:
 * `areaStyle`, `bandPadding`, `curve`, `enableMarkers`, `id`, `itemStyle`, `join`,
 * `lineStyle`, `name`, `orientation`, `stack`, `stacking`, `symbolSize`, `title`.
 * A denylist can only ever cover the keys someone remembered to enumerate; an allowlist
 * covers the twelve the denylist missed *and* every key a future trait adds.
 *
 * STATIC ON PURPOSE (s168 m02). Deriving this from the vega-lite schema at runtime would
 * let a dependency bump silently change what the adapter emits. The list is pinned here
 * and `tests/viz/mark-options-schema-validity-s167.test.ts` derives the same set from the
 * installed schema and asserts the two still match — so a bump fails a test instead of
 * quietly altering output.
 */
const MARK_DEF_PROPERTIES: ReadonlySet<string> = new Set([
  'align', 'angle', 'aria', 'ariaRole', 'ariaRoleDescription', 'aspect', 'bandSize',
  'baseline', 'binSpacing', 'blend', 'clip', 'color', 'continuousBandSize', 'cornerRadius',
  'cornerRadiusBottomLeft', 'cornerRadiusBottomRight', 'cornerRadiusEnd',
  'cornerRadiusTopLeft', 'cornerRadiusTopRight', 'cursor', 'description', 'dir',
  'discreteBandSize', 'dx', 'dy', 'ellipsis', 'fill', 'fillOpacity', 'filled', 'font',
  'fontSize', 'fontStyle', 'fontWeight', 'height', 'href', 'innerRadius', 'interpolate',
  'invalid', 'limit', 'line', 'lineBreak', 'lineHeight', 'minBandSize', 'opacity', 'order',
  'orient', 'outerRadius', 'padAngle', 'point', 'radius', 'radius2', 'radius2Offset',
  'radiusOffset', 'shape', 'size', 'smooth', 'stroke', 'strokeCap', 'strokeDash',
  'strokeDashOffset', 'strokeJoin', 'strokeMiterLimit', 'strokeOffset', 'strokeOpacity',
  'strokeWidth', 'style', 'tension', 'text', 'theta', 'theta2', 'theta2Offset',
  'thetaOffset', 'thickness', 'time', 'timeUnitBandPosition', 'timeUnitBandSize', 'tooltip',
  'type', 'url', 'width', 'x', 'x2', 'x2Offset', 'xOffset', 'y', 'y2', 'y2Offset',
  'yOffset',
]);

/**
 * `MarkDef.interpolate`'s accepted values. OODS's `curve` vocabulary
 * (`linear` | `monotone` | `step`) is a literal subset, so the translation below is a
 * rename, not a mapping — but the guard still checks membership, because `mark.options`
 * is a free-form object and nothing stops a caller putting `curve: 'wobbly'` in a spec.
 */
const VEGA_LITE_INTERPOLATE: ReadonlySet<string> = new Set([
  'basis', 'basis-open', 'basis-closed', 'bundle', 'cardinal', 'cardinal-open',
  'cardinal-closed', 'catmull-rom', 'linear', 'linear-closed', 'monotone', 'natural',
  'step', 'step-before', 'step-after',
]);

/**
 * `MarkDef.orient` (`Orientation`) and `MarkDef.strokeJoin` (`StrokeJoin`), verified
 * against the INSTALLED vega-lite 6.4.1 schema rather than from memory. Both are EXACT
 * matches for the OODS trait vocabularies they translate from:
 *
 *   `schemas/traits/mark-bar.parameters.schema.json` `orientation` — ["vertical","horizontal"]
 *   `schemas/traits/mark-line.parameters.schema.json` `join`       — ["miter","round","bevel"]
 *
 * Same-set, different name — so these are renames, and the membership guard exists for the
 * same reason `curve`'s does: `mark.options` is free-form and nothing stops a caller
 * writing `orientation: 'sideways'`.
 */
const VEGA_LITE_ORIENTATION: ReadonlySet<string> = new Set(['horizontal', 'vertical']);
const VEGA_LITE_STROKE_JOIN: ReadonlySet<string> = new Set(['miter', 'round', 'bevel']);

/**
 * OODS-only option keys with an exact Vega-Lite target, translated rather than dropped.
 *
 *   `curve`         → `interpolate`  (same concept, different name)
 *   `orientation`   → `orient`       (s169 m05 — exact vocabulary match, see above)
 *   `enableMarkers` → `point`        (s169 m05 — OODS boolean; `MarkDef.point` accepts
 *                     `boolean | OverlayMarkDef | 'transparent'`, so the boolean branch is
 *                     an exact fit. Guarded on `typeof === 'boolean'` so an object or the
 *                     string `'transparent'` arriving under the OODS key is dropped rather
 *                     than smuggled through a key whose declared type is boolean.)
 *   `join`          → `strokeJoin`   (s169 m05 — exact vocabulary match, see above)
 *
 * ORIENT CAVEAT, stated because the translation is faithful and the RESULT still may not
 * be what a caller expects: Vega-Lite ignores an explicitly-specified `orient` on STACKED
 * charts, where orientation is determined by the stack. Translating `orientation` is
 * therefore value-faithful — the declared value reaches the output — but it is NOT a
 * layout swap, and on a stacked chart it will have no visible effect. That is Vega-Lite's
 * documented behaviour, not a defect in this translation, and dropping the key instead
 * would be strictly worse (silent on both counts).
 *
 *   `fill`     → `filled` (boolean) ONLY for the OODS point vocabulary `'solid'|'hollow'`.
 *                `fill` IS a real MarkDef property accepting any string as a Color, so
 *                ajv ACCEPTS `fill:'hollow'` — the allowlist cannot catch it and the mark
 *                would paint with a non-colour. Any other `fill` value is a genuine
 *                colour and passes through untouched.
 *   `baseline` → handled in the ENCODING region (`applyBaselineToEncoding`), not here.
 *                It is a real MarkDef property (TextBaseline), so the allowlist passes it
 *                and ajv then rejects `'zero'`/`'min'`/`0`. OODS has no text mark
 *                (MARK_TRAIT_MAP is bar/line/point/area/rect), so no legitimate use of
 *                MarkDef.baseline exists here and removing it from the mark def is safe.
 *
 * All three are OUTPUT-only. The IR keeps every key: the ECharts adapter reads `curve`
 * (echarts-adapter.ts:348) plus `id`/`name`/`stack`/`areaStyle`/`lineStyle`/`itemStyle`/
 * `symbolSize`, `inferLayerKey` reads `id`, and the React views read `title`/`id`. This
 * builds a NEW object and never deletes from `mark.options`.
 */
function translateMarkOption(key: string, value: unknown): [string, unknown] | undefined {
  if (key === 'baseline') return undefined;
  if (key === 'curve') {
    return typeof value === 'string' && VEGA_LITE_INTERPOLATE.has(value)
      ? ['interpolate', value]
      : undefined;
  }
  if (key === 'orientation') {
    return typeof value === 'string' && VEGA_LITE_ORIENTATION.has(value)
      ? ['orient', value]
      : undefined;
  }
  if (key === 'enableMarkers') {
    return typeof value === 'boolean' ? ['point', value] : undefined;
  }
  if (key === 'join') {
    return typeof value === 'string' && VEGA_LITE_STROKE_JOIN.has(value)
      ? ['strokeJoin', value]
      : undefined;
  }
  if (key === 'fill' && (value === 'solid' || value === 'hollow')) {
    return ['filled', value === 'solid'];
  }
  return MARK_DEF_PROPERTIES.has(key) ? [key, value] : undefined;
}

function createMark(mark: NormalizedMark, singleSeriesColor?: string): Record<string, unknown> {
  const type = MARK_TRAIT_MAP[mark.trait as keyof typeof MARK_TRAIT_MAP];

  if (!type) {
    throw new VegaLiteAdapterError(`Unsupported mark trait: ${mark.trait}`);
  }

  const result: Record<string, unknown> = { type };
  for (const [key, value] of Object.entries(mark.options ?? {})) {
    const translated = translateMarkOption(key, value);
    if (translated) {
      result[translated[0]] = translated[1];
    }
  }

  // s221-m03 (the Sprint 218 chart reservation): Vega-Lite's defaults drew points as hollow rings at 0.7 opacity and
  // lines at 1.5px, so series read as subdued. OODS marks default to filled points and 2.5px lines; a spec's own mark
  // options (fill: 'hollow', size, opacity, strokeWidth) were applied above and win.
  if (type === 'point') {
    if (result.filled === undefined) result.filled = true;
    if (result.size === undefined) result.size = 60;
    if (result.opacity === undefined) result.opacity = 0.85;
  }
  if (type === 'line' && result.strokeWidth === undefined) result.strokeWidth = 2.5;

  // Brand-fidelity (sprint-138 m02): single-series bake — a chart with no color encoding
  // gets the single-series token as its mark color, exactly what certification grades.
  // An explicit mark.options.color always wins (the spread above already set it).
  if (singleSeriesColor !== undefined && result.color === undefined) {
    result.color = singleSeriesColor;
  }

  return result;
}

function convertEncodingMap(map?: NormalizedEncoding, palette?: readonly string[], scope: TokenScope = {}): Record<string, unknown> {
  if (!map) {
    return {};
  }

  const encoding: Record<string, unknown> = {};

  for (const channel of CHANNEL_ORDER) {
    const binding = (map as Record<string, EncodingBinding | undefined>)[channel];

    if (!binding) {
      continue;
    }

    encoding[channel] = convertBinding(channel, binding, palette, scope);
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

/** Vega's UTC multi-format with the day tick reading month and day, as its week tick already does (s213-m01). */
const DAY_TICK_LABEL = "utcFormat(datum.value, {date: '%b %d'})";

function convertBinding(
  channel: ChannelName,
  binding: EncodingBinding,
  palette?: readonly string[],
  scope: TokenScope = {}
): Record<string, unknown> {
  // Secondary positions inherit their type and scale from x/y in Vega-Lite.
  if (channel === 'x2' || channel === 'y2') return { field: binding.field, ...(binding.aggregate ? { aggregate: mapAggregate(binding.aggregate) } : {}) };
  const normalizedChannel = channel;
  const definition: Record<string, unknown> = {
    field: binding.field,
    type: inferFieldType(normalizedChannel, binding),
  };

  const aggregate = mapAggregate(binding.aggregate);
  // Temporal axes and time-unit buckets must not inherit the host timezone.
  const scaleType = definition.type === 'temporal' ? 'utc' : mapScaleType(binding.scale);

  if (aggregate) {
    definition.aggregate = aggregate;
  }

  if (typeof binding.bin === 'boolean') {
    definition.bin = binding.bin;
  }

  if (binding.timeUnit) {
    // The normalized vocabulary is singular; Vega uses plural sub-day units.
    const unit = ['hour', 'minute', 'second'].includes(binding.timeUnit) ? `${binding.timeUnit}s` : binding.timeUnit;
    definition.timeUnit = `utc${unit}`;
  }

  if (scaleType) {
    definition.scale = { type: scaleType };
  }

  // s213-m01: a raw date axis names the month on every day tick. Vega's default prints a weekday and a day ("Tue 02")
  // for a tick on no week or month start, so a wide render or a short span lost the month. Only that one branch of
  // Vega's multi-format changes; a binned axis (timeUnit) keeps Vega-Lite's own format.
  if ((channel === 'x' || channel === 'y') && definition.type === 'temporal' && !binding.timeUnit) {
    definition.axis = { labelExpr: DAY_TICK_LABEL };
  }

  // Brand-fidelity (sprint-138 m02): multi-series bake — a nominal/ordinal color
  // channel gets the FIXED full 6-slot OODS palette as scale.range, so the compiled
  // spec renders OODS colors by construction (not Vega's default tableau10). Vega's
  // ordinal domain[i]->range[i] recycling gives >6-series cycle-6 for free, matching
  // certify's cap-at-6 as a set (memo §4 F5). A continuous (quantitative/temporal)
  // color channel is a gradient — role-B exempt — and is intentionally NOT baked.
  if (
    channel === 'color' &&
    (definition.type === 'nominal' || definition.type === 'ordinal') &&
    !binding.range?.length &&
    palette &&
    palette.length > 0
  ) {
    // s149 #853a: length-based, symmetric with the F5 range-write guard below
    // (`binding.range && binding.range.length > 0`). `!binding.range` alone stepped
    // aside for an EMPTY `range: []` too, so neither write fired and the OODS palette
    // was silently dropped (a dead-zone). `?.length` bakes on both no-range and empty-
    // range, so exactly one of the two writes fires in every case. Do NOT rewrite as
    // `=== undefined`: that reopens the `[]` dead-zone.
    const existingScale = (definition.scale as Record<string, unknown> | undefined) ?? {};
    definition.scale = { ...existingScale, range: [...palette] };
  }

  // F5 (sprint-147 m02): an explicit color range overrides the baked OODS palette
  // on a categorical color channel. Scoped to color + nominal/ordinal so a range on
  // a continuous color scale is dropped (gradient-ignored; warned by V-code in m03),
  // and a range never reaches a non-color channel (color-only schema def, memo D-ii).
  // The bake above steps aside when binding.range is set, so exactly one of these two
  // writes fires — #564 holds: field absent ⇒ identical [...palette] output.
  if (
    channel === 'color' &&
    (definition.type === 'nominal' || definition.type === 'ordinal') &&
    binding.range &&
    binding.range.length > 0
  ) {
    const existingScale = (definition.scale as Record<string, unknown> | undefined) ?? {};
    definition.scale = { ...existingScale, range: [...binding.range] };
  }

  // sprint-156 m04 (NASA #4 + band M2): a diverging color scale bakes the OODS diverging
  // range + `domainMid:0` so Vega renders the two hues about zero. Continuous (the type is
  // forced quantitative above), so it is disjoint from the nominal/ordinal categorical bakes.
  if (channel === 'color' && binding.scale === 'diverging') {
    const existingScale = (definition.scale as Record<string, unknown> | undefined) ?? {};
    definition.scale = { ...existingScale, range: [...divergingRange(scope)], domainMid: 0 };
  }

  if (binding.sort) {
    // s224-m01 (#2542 ruling 3): Vega-Lite spells "no sort" null; 'none' is not one of its sort values.
    definition.sort = binding.sort === 'none' ? null : binding.sort;
  }

  if (binding.title) {
    definition.title = binding.title;
  }

  if (binding.legend) {
    definition.legend = binding.legend;
  }

  // s223-m01 (#2527 ruling 2): a declared label format reaches the axis (x, y) or the legend; a currency without one
  // reads as money. It replaces the day-tick label expression above: the declared format is the one asked for.
  const format = binding.format ?? (binding.currency ? CURRENCY_FORMAT : undefined);
  if (format !== undefined) {
    if (channel === 'x' || channel === 'y') definition.axis = { format };
    else definition.legend = { ...(definition.legend as Record<string, unknown> | undefined), format };
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
      on: Array.isArray(selection.on) ? selection.on.join(', ') : selection.on,
      fields: selection.fields,
    });
  }

  if (selection.type === 'interval') {
    return removeUndefined({
      type: 'interval',
      on: Array.isArray(selection.on) ? selection.on.join(', ') : selection.on,
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
          empty: false,
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
  // A data-aware or caller-declared field type wins over channel-default
  // inference (sprint-125: m01 stamps an unscaled binding's profiled FieldType
  // here; m02 lets a caller override it directly). The scale branches below stay
  // authoritative whenever the caller declared a scale — m01 leaves binding.type
  // unset in that case, so this short-circuit never fires for a scaled binding.
  if (binding.type) {
    return binding.type;
  }

  if (binding.timeUnit || binding.scale === 'temporal') {
    return 'temporal';
  }

  if (binding.trait === 'EncodingSize') {
    return 'quantitative';
  }

  if (binding.trait === 'EncodingColor') {
    // sprint-156 m04: a diverging color scale is a continuous quantitative gradient — it
    // must NOT default to nominal (which would render discrete swatches instead of a ramp).
    if (binding.scale === 'diverging') {
      return 'quantitative';
    }

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
    return 'utc';
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
      calculate: `utcParse(datum["${params.field}"], "${params.format}")`,
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
