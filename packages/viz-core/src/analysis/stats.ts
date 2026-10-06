// Shared, pure, deterministic statistics primitives (sprint-110 m01).
//
// SINGLE HOME for the numeric helpers used on BOTH sides of the recommender:
//   - the PRE-selection field profiler (builder/spec-builder.ts), and
//   - the POST-selection a11y narrator (a11y/data-analysis.ts).
//
// Before this module the narrator carried its own Pearson + toNumber + trend
// copies; the profiler would have drifted a second Pearson. Factoring them here
// guarantees ONE correlation implementation (grep-provable) and identical
// numeric semantics across the two surfaces.
//
// DETERMINISM CONTRACT (the moat): no Math.random, no Date.now, no host-locale
// or host-timezone dependence. Reductions run in a fixed order; floating-point
// results that feed committed goldens are rounded with `round` to a fixed
// precision so float non-associativity across platforms can't flip a snapshot.

/** Fixed rounding precision for stat values that may feed committed goldens. */
const STAT_PRECISION = 6;

/** Trend is "flat" when the first→last relative change is under this bound. */
export const TREND_EPSILON = 0.015;

/**
 * Round to a fixed number of decimals (default 6). Normalises `-0` to `0` so a
 * sign-only difference can never produce a spurious golden diff.
 */
export function round(value: number, precision: number = STAT_PRECISION): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const rounded = Number(value.toFixed(precision));
  return rounded === 0 ? 0 : rounded;
}

/**
 * Coerce a cell value to a finite number, or `null` when it is not numeric.
 * Mirrors the narrator's historical behaviour: real finite numbers pass through;
 * non-empty numeric strings parse; everything else is `null`.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Arithmetic mean in array order. Returns 0 for an empty input. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

/**
 * POPULATION standard deviation: sqrt(Σ(x-mean)² / n). Population (n), not
 * sample (n-1), is chosen so a single-value field yields a defined 0 rather than
 * a divide-by-zero — and documented here so it is not "magic".
 */
export function populationStdDev(values: readonly number[], meanValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  let acc = 0;
  for (const v of values) {
    const d = v - meanValue;
    acc += d * d;
  }
  return Math.sqrt(acc / values.length);
}

/**
 * Fisher–Pearson skewness: (1/n)·Σ((x-mean)/sd)³. Returns 0 when it is
 * undefined (sd === 0, or fewer than 3 values) rather than NaN, so the stat is
 * always a finite, golden-stable number.
 */
export function skewness(values: readonly number[], meanValue: number, stdDev: number): number {
  if (values.length < 3 || stdDev === 0) {
    return 0;
  }
  let acc = 0;
  for (const v of values) {
    const z = (v - meanValue) / stdDev;
    acc += z * z * z;
  }
  return acc / values.length;
}

/**
 * Linear-interpolation quantile over an ascending-sorted array (the "type-7" /
 * Excel PERCENTILE.INC convention). Deterministic given a stable sort.
 */
export function quantileSorted(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) {
    return 0;
  }
  if (sortedAsc.length === 1) {
    return sortedAsc[0];
  }
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) {
    return sortedAsc[lo];
  }
  const frac = pos - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

/**
 * Count of Tukey outliers: values below Q1 − 1.5·IQR or above Q3 + 1.5·IQR.
 * Sorts a copy ascending (numeric, stable) so the result is order-independent.
 */
export function tukeyOutlierCount(values: readonly number[]): number {
  if (values.length < 4) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) {
    return 0;
  }
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  let count = 0;
  for (const v of values) {
    if (v < lower || v > upper) {
      count += 1;
    }
  }
  return count;
}

/**
 * THE single Pearson correlation implementation. Both the profiler and the a11y
 * narrator route through this. Returns `null` when correlation is undefined
 * (fewer than 3 paired points, unequal lengths, or zero variance on either
 * axis). Rounded to 3 decimals — preserving the narrator's historical contract.
 */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) {
    return null;
  }
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(3));
}

/**
 * First→last trend classification, factored out of the narrator. "flat" when the
 * relative change is under TREND_EPSILON; otherwise increasing/decreasing by the
 * sign of the delta.
 */
export function deriveTrend(
  firstValue: number,
  lastValue: number,
): { trend: 'increasing' | 'decreasing' | 'flat'; delta: number } {
  const delta = lastValue - firstValue;
  const relative = firstValue !== 0 ? Math.abs(delta / firstValue) : Math.abs(delta);
  if (relative < TREND_EPSILON) {
    return { trend: 'flat', delta };
  }
  return { trend: delta >= 0 ? 'increasing' : 'decreasing', delta };
}
