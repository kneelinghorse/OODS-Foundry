import type { NormalizedVizSpec, TraitBinding } from '../spec/normalized-viz-spec.js';
import { formatDimension, formatNumeric } from './format.js';

export type ChartShape = 'bar' | 'line' | 'point' | 'area' | 'mixed' | 'unknown';

export interface DataPoint {
  readonly label: string;
  readonly value: number;
}

export interface VizDataAnalysis {
  readonly mark: ChartShape;
  readonly dimensionField?: string;
  readonly measureField?: string;
  readonly colorField?: string;
  readonly sizeField?: string;
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
  readonly dimensionValues: readonly string[];
  readonly numericValues: readonly number[];
  readonly sizeValues: readonly number[];
  readonly colorCategories: readonly string[];
  readonly min?: DataPoint;
  readonly max?: DataPoint;
  readonly first?: DataPoint;
  readonly last?: DataPoint;
  readonly total?: number;
  readonly mean?: number;
  readonly trend?: 'increasing' | 'decreasing' | 'flat';
  readonly trendDelta?: number;
  readonly correlation?: number;
}

const TREND_EPSILON = 0.015;

export function analyzeVizSpec(spec: NormalizedVizSpec): VizDataAnalysis {
  const bindings = resolvePrimaryBindings(spec);
  const rows = collectRows(spec);
  const dataPoints = buildDataPoints(rows, bindings);
  const min = findExtreme(dataPoints, 'min');
  const max = findExtreme(dataPoints, 'max');
  const first = dataPoints.at(0);
  const last = dataPoints.at(-1);
  const numericValues = dataPoints.map((point) => point.value);
  const total = numericValues.length > 0 ? numericValues.reduce((sum, value) => sum + value, 0) : undefined;
  const mean = numericValues.length > 0 && total !== undefined ? total / numericValues.length : undefined;
  const dimensionValues = bindings.dimensionField ? extractDimensions(rows, bindings.dimensionField) : [];
  const sizeValues = bindings.sizeField ? extractNumericValues(rows, bindings.sizeField) : [];
  const colorCategories = bindings.colorField ? extractCategories(rows, bindings.colorField) : [];
  const trendInfo = deriveTrend(first, last);
  const correlation = deriveCorrelation(rows, bindings);

  return {
    mark: bindings.mark,
    dimensionField: bindings.dimensionField,
    measureField: bindings.measureField,
    colorField: bindings.colorField,
    sizeField: bindings.sizeField,
    rows,
    rowCount: rows.length,
    dimensionValues,
    numericValues,
    sizeValues,
    colorCategories,
    min,
    max,
    first,
    last,
    total,
    mean,
    trend: trendInfo?.trend,
    trendDelta: trendInfo?.delta,
    correlation,
  } satisfies VizDataAnalysis;
}

function resolvePrimaryBindings(spec: NormalizedVizSpec): {
  readonly mark: ChartShape;
  readonly dimensionField?: string;
  readonly measureField?: string;
  readonly colorField?: string;
  readonly sizeField?: string;
} {
  const normalizedMarks = spec.marks.map((mark) => normalizeMark(mark.trait));
  const uniqueMarks = [...new Set(normalizedMarks.filter((mark) => mark !== 'unknown'))];
  const mark = uniqueMarks.length === 1 ? uniqueMarks[0] : uniqueMarks.length > 1 ? 'mixed' : 'unknown';

  const dimensionBinding = resolveBinding(spec, 'x');
  const measureBinding = resolveBinding(spec, 'y');
  const colorBinding = resolveBinding(spec, 'color');
  const sizeBinding = resolveBinding(spec, 'size');

  return {
    mark,
    dimensionField: dimensionBinding?.field,
    measureField: measureBinding?.field,
    colorField: colorBinding?.field,
    sizeField: sizeBinding?.field,
  };
}

export function getEncodingBinding(
  spec: NormalizedVizSpec,
  channel: keyof NormalizedVizSpec['encoding']
): TraitBinding | undefined {
  return resolveBinding(spec, channel);
}

function resolveBinding(spec: NormalizedVizSpec, channel: keyof NormalizedVizSpec['encoding']): TraitBinding | undefined {
  const topLevel = spec.encoding?.[channel];
  if (topLevel) {
    return topLevel;
  }
  for (const mark of spec.marks) {
    const binding = mark.encodings?.[channel];
    if (binding) {
      return binding;
    }
  }
  return undefined;
}

function normalizeMark(traitId: string | undefined): ChartShape {
  if (!traitId) {
    return 'unknown';
  }
  const normalized = traitId.toLowerCase();
  if (normalized.includes('markbar')) {
    return 'bar';
  }
  if (normalized.includes('markline')) {
    return 'line';
  }
  if (normalized.includes('markpoint')) {
    return 'point';
  }
  if (normalized.includes('markarea')) {
    return 'area';
  }
  return 'unknown';
}

function collectRows(spec: NormalizedVizSpec): Record<string, unknown>[] {
  if (!Array.isArray(spec.data.values)) {
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  for (const entry of spec.data.values) {
    if (isRecord(entry)) {
      rows.push(entry);
    }
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildDataPoints(
  rows: readonly Record<string, unknown>[],
  bindings: ReturnType<typeof resolvePrimaryBindings>
): DataPoint[] {
  if (!bindings.measureField) {
    return [];
  }
  const points: DataPoint[] = [];
  rows.forEach((row, index) => {
    const rawValue = row[bindings.measureField as keyof typeof row];
    const numericValue = toNumber(rawValue);
    if (numericValue === null) {
      return;
    }
    const label = bindings.dimensionField
      ? formatDimension(row[bindings.dimensionField as keyof typeof row])
      : undefined;
    points.push({ label: label ?? `Row ${index + 1}`, value: numericValue });
  });
  return points;
}

function extractDimensions(rows: readonly Record<string, unknown>[], field: string): string[] {
  const values: string[] = [];
  rows.forEach((row) => {
    const label = formatDimension(row[field as keyof typeof row]);
    if (label) {
      values.push(label);
    }
  });
  return values;
}

function extractNumericValues(rows: readonly Record<string, unknown>[], field: string): number[] {
  const values: number[] = [];
  rows.forEach((row) => {
    const numeric = toNumber(row[field as keyof typeof row]);
    if (numeric !== null) {
      values.push(numeric);
    }
  });
  return values;
}

function extractCategories(rows: readonly Record<string, unknown>[], field: string): string[] {
  const set = new Set<string>();
  rows.forEach((row) => {
    const value = row[field as keyof typeof row];
    if (value === null || value === undefined) {
      return;
    }
    set.add(String(value));
  });
  return [...set];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function findExtreme(points: readonly DataPoint[], kind: 'min' | 'max'): DataPoint | undefined {
  if (points.length === 0) {
    return undefined;
  }
  return points.reduce((extreme, current) => {
    if (kind === 'min') {
      return current.value < extreme.value ? current : extreme;
    }
    return current.value > extreme.value ? current : extreme;
  }, points[0]);
}

function deriveTrend(first?: DataPoint, last?: DataPoint): { trend: 'increasing' | 'decreasing' | 'flat'; delta: number } | undefined {
  if (!first || !last) {
    return undefined;
  }
  const delta = last.value - first.value;
  const relative = first.value !== 0 ? Math.abs(delta / first.value) : Math.abs(delta);
  if (relative < TREND_EPSILON) {
    return { trend: 'flat', delta };
  }
  return {
    trend: delta >= 0 ? 'increasing' : 'decreasing',
    delta,
  };
}

function deriveCorrelation(
  rows: readonly Record<string, unknown>[],
  bindings: ReturnType<typeof resolvePrimaryBindings>
): number | undefined {
  if (!bindings.dimensionField || !bindings.measureField) {
    return undefined;
  }
  const pairs: Array<[number, number]> = [];
  rows.forEach((row) => {
    const x = toNumber(row[bindings.dimensionField as keyof typeof row]);
    const y = toNumber(row[bindings.measureField as keyof typeof row]);
    if (x === null || y === null) {
      return;
    }
    pairs.push([x, y]);
  });
  if (pairs.length < 3) {
    return undefined;
  }
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }
  const denominator = Math.sqrt(denominatorX * denominatorY);
  if (denominator === 0) {
    return undefined;
  }
  return Number((numerator / denominator).toFixed(3));
}

export function describeDataPoint(point: DataPoint | undefined, measureLabel?: string): string | undefined {
  if (!point) {
    return undefined;
  }
  const label = measureLabel ? `${measureLabel}` : 'Value';
  return `${label} ${formatNumeric(point.value)} (${point.label})`;
}
