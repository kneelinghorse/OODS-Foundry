import type { VisualMapComponentOption } from 'echarts';
import type { ColorScaleType } from '@/types/viz/spatial.js';

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
  range: readonly string[] = DEFAULT_CONTINUOUS_COLORS
): VisualMapComponentOption {
  const [min, max] = domain;
  return pruneUndefined({
    type: 'continuous',
    min,
    max,
    calculable: true,
    inRange: { color: [...range] },
  });
}

export function createPiecewiseVisualMap(
  pieces: Array<{ min?: number; max?: number; label?: string; value?: number }> | undefined,
  colors: readonly string[] = DEFAULT_PIECEWISE_COLORS,
  splitNumber?: number
): VisualMapComponentOption {
  const palette = colors.length > 0 ? colors : DEFAULT_PIECEWISE_COLORS;
  const resolvedPieces =
    pieces && pieces.length > 0
      ? pieces
      : [{ min: 0, max: 1 }];

  const coloredPieces = resolvedPieces.map((piece, index) => ({
    ...piece,
    color: palette[index % palette.length],
  }));

  return pruneUndefined({
    type: 'piecewise',
    splitNumber,
    pieces: coloredPieces,
  });
}

export function createVisualMapForScale(params: {
  readonly scale: ColorScaleType | undefined;
  readonly domain?: [number, number];
  readonly range?: readonly string[];
  readonly values: readonly number[];
}): VisualMapComponentOption {
  const domain = fallbackDomain(params.domain, [...params.values]);
  const palette = params.range && params.range.length > 0 ? params.range : DEFAULT_CONTINUOUS_COLORS;
  const { scale } = params;

  if (!scale || scale === 'linear') {
    return createContinuousVisualMap(domain, palette);
  }

  const pieceCount = palette.length || 5;
  const pieces = interpolatePieces(domain, pieceCount).map((piece, index) => ({
    ...piece,
    label: `Bin ${index + 1}`,
  }));

  return createPiecewiseVisualMap(pieces, palette, pieceCount);
}
