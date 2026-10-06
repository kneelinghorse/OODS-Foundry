import type { TokenScope } from '../echarts/token-resolver.js';
// VisualMap generation for the choropleth/bubble geo adapters (sprint-112 m01 port).
// Ported verbatim from src/viz/adapters/spatial/echarts-visualmap-generator.ts;
// the only change is the ColorScaleType import (now the local slim spatial spec)
// and echarts as a TYPE-ONLY import.

import type { VisualMapComponentOption } from 'echarts';
import type { ColorScaleType } from '../../spec/spatial.js';
import { resolveColor } from './geo-token-color.js';

const DEFAULT_CONTINUOUS_COLORS = [
  'var(--oods-viz-scale-sequential-01, #e0f2ff)',
  'var(--oods-viz-scale-sequential-05, #5ea3ff)',
  'var(--oods-viz-scale-sequential-07, #1f6feb)',
];

const DEFAULT_PIECEWISE_COLORS = [
  'var(--oods-viz-scale-sequential-01, #e0f2ff)',
  'var(--oods-viz-scale-sequential-03, #add3ff)',
  'var(--oods-viz-scale-sequential-05, #5ea3ff)',
  'var(--oods-viz-scale-sequential-07, #1f6feb)',
];

// sprint-156 m04: the OODS diverging viz-scale — a two-hue gradient about a neutral mid.
// A `scale:'diverging'` routes to a CONTINUOUS visualMap (not piecewise) with this palette
// so ECharts renders the same divergence the Vega side bakes (getVizScaleTokens('diverging')).
const DEFAULT_DIVERGING_COLORS = [
  'var(--oods-viz-scale-diverging-neg-05, #400031)',
  'var(--oods-viz-scale-diverging-neutral, #c0c4cb)',
  'var(--oods-viz-scale-diverging-pos-05, #400000)',
];

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function fallbackDomain(domain: [number, number] | undefined, values: number[]): [number, number] {
  if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1])) {
    return domain;
  }

  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return [0, 1];
  }

  return [Math.min(...finiteValues), Math.max(...finiteValues)];
}

// s157 m03 (B2): symmetrize a finite diverging domain about 0 so the palette's neutral (its exact
// array-center hue) renders at DATA value 0 — matching Vega's baked color.scale.domainMid:0.
// ECharts continuous visualMap has no domainMid and distributes the palette EVENLY across
// [min,max], so an asymmetric domain (e.g. correlation [-0.32, 1]) lands neutral at (min+max)/2
// (0.34) — contradicting Vega, where 0 is neutral. M = max(|min|,|max|) > 0 ⇒ [-M,+M] centers
// neutral at 0 while the larger-magnitude extreme still reaches a palette endpoint. A degenerate
// (min===max) or non-finite domain is returned UNCHANGED (fail-safe: no false centering, no throw).
function symmetrizeDivergingDomain(domain: [number, number]): [number, number] {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return domain;
  }
  const m = Math.max(Math.abs(min), Math.abs(max));
  return m > 0 ? [-m, m] : domain;
}

function interpolatePieces(domain: [number, number], count: number): Array<{ min: number; max: number }> {
  const [min, max] = domain;
  if (count <= 1 || min === max) {
    return [{ min, max }];
  }

  const step = (max - min) / count;
  const pieces: Array<{ min: number; max: number }> = [];
  let cursor = min;
  for (let index = 0; index < count; index += 1) {
    const next = index === count - 1 ? max : cursor + step;
    pieces.push({ min: cursor, max: next });
    cursor = next;
  }
  return pieces;
}

export function createContinuousVisualMap(
  domain: [number, number],
  range: readonly string[] = DEFAULT_CONTINUOUS_COLORS,
  scope: TokenScope = {}
): VisualMapComponentOption {
  const [min, max] = domain;
  return pruneUndefined({
    type: 'continuous',
    min,
    max,
    calculable: true,
    inRange: { color: range.map((color) => resolveColor(color, scope)) },
  });
}

export function createPiecewiseVisualMap(
  pieces: Array<{ min?: number; max?: number; label?: string; value?: number }> | undefined,
  colors: readonly string[] = DEFAULT_PIECEWISE_COLORS,
  splitNumber?: number,
  scope: TokenScope = {}
): VisualMapComponentOption {
  const palette = colors.length > 0 ? colors : DEFAULT_PIECEWISE_COLORS;
  const resolvedPieces =
    pieces && pieces.length > 0
      ? pieces
      : [{ min: 0, max: 1 }];

  const coloredPieces = resolvedPieces.map((piece, index) => ({
    ...piece,
    color: resolveColor(palette[index % palette.length], scope),
  }));

  return pruneUndefined({
    type: 'piecewise',
    splitNumber,
    pieces: coloredPieces,
  });
}

export function createVisualMapForScale(params: {
  readonly scope?: TokenScope;
  readonly scale: ColorScaleType | undefined;
  readonly domain?: [number, number];
  readonly range?: readonly string[];
  readonly values: readonly number[];
}): VisualMapComponentOption {
  const domain = fallbackDomain(params.domain, [...params.values]);
  const hasRange = Boolean(params.range && params.range.length > 0);
  const palette = hasRange ? (params.range as readonly string[]) : DEFAULT_CONTINUOUS_COLORS;
  const { scale } = params;

  // HC literals must never enter continuous interpolation (ECharts cannot parse oklch).
  // Each numeric bin receives a declared paint verbatim; no replacement palette.
  if (params.scope?.theme === 'hc') {
    const bounds = scale === 'diverging' ? symmetrizeDivergingDomain(domain) : domain;
    const colors = scale === 'diverging' && !hasRange ? DEFAULT_DIVERGING_COLORS : palette;
    const pieces = interpolatePieces(bounds, colors.length);
    return createPiecewiseVisualMap(pieces, colors, colors.length, params.scope);
  }

  // sprint-156 m04: diverging is a CONTINUOUS scale — a caller-supplied range wins, else
  // the OODS diverging default. Grouped with linear so a diverging heatmap/geo layer emits
  // one continuous visualMap (never binned pieces). s157 m03 (B2): center the domain at 0
  // (symmetrizeDivergingDomain) so the neutral hue renders at data 0 == Vega domainMid:0.
  if (scale === 'diverging') {
    return createContinuousVisualMap(symmetrizeDivergingDomain(domain), hasRange ? palette : DEFAULT_DIVERGING_COLORS, params.scope);
  }

  if (!scale || scale === 'linear') {
    return createContinuousVisualMap(domain, palette, params.scope);
  }

  const pieceCount = palette.length || 5;
  const pieces = interpolatePieces(domain, pieceCount).map((piece, index) => ({
    ...piece,
    label: `Bin ${index + 1}`,
  }));

  return createPiecewiseVisualMap(pieces, palette, pieceCount, params.scope);
}
