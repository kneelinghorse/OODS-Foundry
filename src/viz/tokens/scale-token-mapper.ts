const VIZ_SEQUENTIAL_SCALE = [
  '--viz-scale-sequential-01',
  '--viz-scale-sequential-02',
  '--viz-scale-sequential-03',
  '--viz-scale-sequential-04',
  '--viz-scale-sequential-05',
  '--viz-scale-sequential-06',
  '--viz-scale-sequential-07',
  '--viz-scale-sequential-08',
  '--viz-scale-sequential-09',
] as const;

const VIZ_DIVERGING_NEGATIVE = [
  '--viz-scale-diverging-neg-05',
  '--viz-scale-diverging-neg-04',
  '--viz-scale-diverging-neg-03',
  '--viz-scale-diverging-neg-02',
  '--viz-scale-diverging-neg-01',
] as const;
const VIZ_DIVERGING_NEUTRAL = '--viz-scale-diverging-neutral' as const;
const VIZ_DIVERGING_POSITIVE = [
  '--viz-scale-diverging-pos-01',
  '--viz-scale-diverging-pos-02',
  '--viz-scale-diverging-pos-03',
  '--viz-scale-diverging-pos-04',
  '--viz-scale-diverging-pos-05',
] as const;

const VIZ_CATEGORICAL_SCALE = [
  '--viz-scale-categorical-01',
  '--viz-scale-categorical-02',
  '--viz-scale-categorical-03',
  '--viz-scale-categorical-04',
  '--viz-scale-categorical-05',
  '--viz-scale-categorical-06',
] as const;

const VIZ_POINT_SIZES = [
  '--viz-size-point-01',
  '--viz-size-point-02',
  '--viz-size-point-03',
  '--viz-size-point-04',
  '--viz-size-point-05',
] as const;

const VIZ_STROKE_SIZES = [
  '--viz-size-stroke-01',
  '--viz-size-stroke-02',
  '--viz-size-stroke-03',
  '--viz-size-stroke-04',
] as const;

const VIZ_BAR_SIZES = [
  '--viz-size-bar-narrow',
  '--viz-size-bar-standard',
  '--viz-size-bar-wide',
] as const;

const VIZ_MARGINS = {
  tight: '--viz-margin-tight',
  default: '--viz-margin-default',
  roomy: '--viz-margin-roomy',
} as const;

type SequentialToken = (typeof VIZ_SEQUENTIAL_SCALE)[number];
type DivergingToken =
  | (typeof VIZ_DIVERGING_NEGATIVE)[number]
  | typeof VIZ_DIVERGING_NEUTRAL
  | (typeof VIZ_DIVERGING_POSITIVE)[number];
type CategoricalToken = (typeof VIZ_CATEGORICAL_SCALE)[number];
type PointSizeToken = (typeof VIZ_POINT_SIZES)[number];
type StrokeSizeToken = (typeof VIZ_STROKE_SIZES)[number];
type BarSizeToken = (typeof VIZ_BAR_SIZES)[number];
type MarginToken = (typeof VIZ_MARGINS)[keyof typeof VIZ_MARGINS];

export type VizScaleScheme = 'sequential' | 'diverging' | 'categorical';
export type VizSizeScale = 'point' | 'stroke' | 'bar';
export type VizMarginKind = keyof typeof VIZ_MARGINS;

export interface SequentialScaleOptions {
  readonly count?: number;
  readonly reverse?: boolean;
}

export interface DivergingScaleOptions {
  readonly extent?: number;
  readonly includeNeutral?: boolean;
  readonly reverse?: boolean;
}

export interface CategoricalScaleOptions {
  readonly count?: number;
  readonly reverse?: boolean;
}

export interface SizeScaleOptions {
  readonly count?: number;
  readonly reverse?: boolean;
}

export function getVizScaleTokens(scheme: 'sequential', options?: SequentialScaleOptions): SequentialToken[];
export function getVizScaleTokens(scheme: 'diverging', options?: DivergingScaleOptions): DivergingToken[];
export function getVizScaleTokens(scheme: 'categorical', options?: CategoricalScaleOptions): CategoricalToken[];
export function getVizScaleTokens(
  scheme: VizScaleScheme,
  options?: SequentialScaleOptions | DivergingScaleOptions | CategoricalScaleOptions,
): (SequentialToken | DivergingToken | CategoricalToken)[] {
  if (scheme === 'sequential') {
    const settings = options as SequentialScaleOptions | undefined;
    return sliceAndMaybeReverse(VIZ_SEQUENTIAL_SCALE, settings?.count, settings?.reverse);
  }

  if (scheme === 'diverging') {
    const settings = options as DivergingScaleOptions | undefined;
    return getDivergingValues(settings);
  }

  const settings = options as CategoricalScaleOptions | undefined;
  return sliceAndMaybeReverse(VIZ_CATEGORICAL_SCALE, settings?.count, settings?.reverse);
}

export function getVizSizeTokens(kind: 'point', options?: SizeScaleOptions): PointSizeToken[];
export function getVizSizeTokens(kind: 'stroke', options?: SizeScaleOptions): StrokeSizeToken[];
export function getVizSizeTokens(kind: 'bar', options?: SizeScaleOptions): BarSizeToken[];
export function getVizSizeTokens(
  kind: VizSizeScale,
  options?: SizeScaleOptions,
): (PointSizeToken | StrokeSizeToken | BarSizeToken)[] {
  const settings = options ?? {};
  switch (kind) {
    case 'point':
      return sliceAndMaybeReverse(VIZ_POINT_SIZES, settings.count, settings.reverse);
    case 'stroke':
      return sliceAndMaybeReverse(VIZ_STROKE_SIZES, settings.count, settings.reverse);
    case 'bar':
      return sliceAndMaybeReverse(VIZ_BAR_SIZES, settings.count, settings.reverse);
    default:
      return [];
  }
}

export function getVizMarginToken(kind: VizMarginKind = 'default'): MarginToken {
  return VIZ_MARGINS[kind];
}

function getDivergingValues(options?: DivergingScaleOptions): DivergingToken[] {
  const extent = clamp(options?.extent ?? VIZ_DIVERGING_NEGATIVE.length, 1, VIZ_DIVERGING_NEGATIVE.length);
  const includeNeutral = options?.includeNeutral !== false;
  const negative = VIZ_DIVERGING_NEGATIVE.slice(VIZ_DIVERGING_NEGATIVE.length - extent);
  const positive = VIZ_DIVERGING_POSITIVE.slice(0, extent);

  const values: DivergingToken[] = [...negative];
  if (includeNeutral) {
    values.push(VIZ_DIVERGING_NEUTRAL);
  }
  values.push(...positive);

  return options?.reverse ? [...values].reverse() : values;
}

function sliceAndMaybeReverse<T>(values: readonly T[], count?: number, reverse?: boolean): T[] {
  const clamped = clamp(count ?? values.length, 1, values.length);
  const sliced = values.slice(0, clamped);
  return reverse ? [...sliced].reverse() : sliced.slice();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
