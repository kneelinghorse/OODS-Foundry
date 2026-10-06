// Headless KPI primitive (sprint-113 m03). Pure compute reducing a
// (cross-filtered) row set to a renderer-AGNOSTIC structured payload — NOT a
// forced ECharts big-number option. Reuses the deterministic stats.ts helpers.
// Emits SEMANTIC flags only (thresholdBreached / anomaly) — NO inline colors
// (SEAM e: KPI threshold colors stay deferred to the consumer CSS bundle), and
// presentation/locale formatting is the renderer's job. Pure + deterministic
// (no Date.now / Math.random): values feeding goldens are rounded via stats.round.
//
// TIME AXIS (sprint-114 m03, v0.2): by default the metric series is in DATASET
// ROW ORDER (latest = last row, sparkline + window/prior_period slice by row).
// When KpiPanel.periodField is set, the series is built along an EXPLICIT,
// PARSED + SORTED period axis via the UTC-pinned analysis/temporal.ts instead:
// latest = max period, sparkline is period-ordered, window/prior_period slice by
// DISTINCT period. periodField ABSENT => byte-identical to v0.1 (opt-in additive).
//
// CELL TYPES (sprint-175 m05, decision 11 — Dashboard-demos FD#1): count/distinct
// are COUNT(field) — every NON-NULL cell of the field regardless of type (never
// rows.length: an absent field and an empty/cross-filtered-empty row set stay 0);
// distinct keys are canonicalised as toNumber(cell) ?? String(cell) so numeric
// fields keep their cardinality. The six numeric aggregates (sum/average/median/
// min/max/latest) use numeric cells only, and when the field HAS values but NONE
// numeric they throw KpiComputeError instead of returning a plausible 0 (the
// mcp-server maps it to OODS-V160 through onPanelError). Both rules apply on the
// row-order AND the periodField series builders. All-numeric input is byte-
// identical to the pre-s175 output for all eight aggregates.

import { deriveTrend, mean, populationStdDev, quantileSorted, round, toNumber } from '../analysis/stats.js';
import { finestGranularity, parseTemporalValue, unitIndexFor, type ParsedTemporal } from '../analysis/temporal.js';
import type { KpiPanel } from '../spec/dashboard.types.js';

type DataRecord = Record<string, unknown>;

/** Renderer-agnostic KPI payload. */
export interface KpiResult {
  /** The point-in-time aggregated value (rounded for golden stability). */
  readonly value: number;
  /** Deterministic, locale-free string form of `value` (renderer does pretty/locale formatting). */
  readonly formatted: string;
  /** value − comparison baseline; null when no comparison basis resolves. */
  readonly delta: number | null;
  /** delta / |baseline|; null when the baseline is 0 or unresolved. */
  readonly deltaPct: number | null;
  /** Direction of the comparison (or the series when no comparison). */
  readonly trendDirection: 'increasing' | 'decreasing' | 'flat';
  /** Per-row metric series in row order; present only when there is more than one point. */
  readonly sparkline?: readonly number[];
  /** Threshold breach by the panel's direction; present only when a threshold is set. */
  readonly thresholdBreached?: boolean;
  /** Stddev-outlier flag on the latest point; present only when threshold.anomaly is requested. */
  readonly anomaly?: boolean;
}

/** Latest point is flagged anomalous when it is more than this many σ from the series mean. */
const STDDEV_OUTLIER_SIGMA = 2;

type AggregateKind = NonNullable<KpiPanel['aggregate']>;

/** A metric cell after canonicalisation: numeric where toNumber resolves, else its String form. */
type MetricCell = number | string;

const NUMERIC_AGGREGATES: ReadonlySet<AggregateKind> = new Set<AggregateKind>(['sum', 'average', 'median', 'min', 'max', 'latest']);

function isCountLike(kind: AggregateKind): boolean {
  return kind === 'count' || kind === 'distinct';
}

/**
 * Thrown by computeKpi when a NUMERIC aggregate (sum/average/median/min/max/latest) is
 * asked over a field that HAS values but none of them numeric (sprint-175 m05,
 * decision 11). Fail loud instead of the pre-s175 silent value:0. NEVER thrown for
 * count/distinct (defined over any cell type), for an absent field (zero non-null
 * cells) or for an empty row set — those keep their ratified value:0 paths. The
 * mcp-server's dashboard.render maps it to an OODS-V160 error panel via onPanelError.
 */
export class KpiComputeError extends Error {
  readonly panelId: string;
  readonly field: string;
  readonly aggregate: AggregateKind;
  readonly reason: 'no_numeric_cells';

  constructor(input: { readonly panelId: string; readonly field: string; readonly aggregate: AggregateKind }) {
    super(
      `KPI panel "${input.panelId}": ${input.aggregate} over field "${input.field}" found no numeric cells (the field has values, none of them numeric).`,
    );
    this.name = 'KpiComputeError';
    this.panelId = input.panelId;
    this.field = input.field;
    this.aggregate = input.aggregate;
    this.reason = 'no_numeric_cells';
  }
}

/**
 * The cell feeding the series for `kind`, or null when the row is dropped:
 * numeric where toNumber resolves (numeric strings coerce); for count/distinct
 * ALSO every other non-null cell as its String form; for the numeric aggregates
 * non-numeric cells are dropped (the pre-s175 rule, unchanged).
 */
function metricCell(raw: unknown, kind: AggregateKind): MetricCell | null {
  const n = toNumber(raw);
  if (n !== null) {
    return n;
  }
  if (isCountLike(kind) && raw !== null && raw !== undefined) {
    return String(raw);
  }
  return null;
}

function cellSeries(field: string, rows: readonly DataRecord[], kind: AggregateKind): MetricCell[] {
  const series: MetricCell[] = [];
  for (const row of rows) {
    const cell = metricCell(row[field], kind);
    if (cell !== null) {
      series.push(cell);
    }
  }
  return series;
}

/** The numeric cells of a series, in order (the identity for a numeric aggregate's series). */
function numericValues(cells: readonly MetricCell[]): number[] {
  const values: number[] = [];
  for (const cell of cells) {
    if (typeof cell === 'number') {
      values.push(cell);
    }
  }
  return values;
}

/**
 * Decision 11 (ii): a numeric aggregate over a field that has values but no numeric
 * cell is a silent-wrong answer, not a 0. Throws ONLY when rows exist, the field
 * has >= 1 non-null cell, and no cell is numeric. Evaluated over the RAW field
 * cells, before any period keying — a numeric field whose periods all fail to
 * parse still resolves to value 0 (the pinned periodField empty-set behaviour).
 */
function assertNumericCells(panel: KpiPanel, rows: readonly DataRecord[], kind: AggregateKind): void {
  if (!NUMERIC_AGGREGATES.has(kind) || rows.length === 0) {
    return;
  }
  let sawNonNull = false;
  for (const row of rows) {
    const raw = row[panel.field];
    if (raw === null || raw === undefined) {
      continue;
    }
    if (toNumber(raw) !== null) {
      return;
    }
    sawNonNull = true;
  }
  if (sawNonNull) {
    throw new KpiComputeError({ panelId: panel.id, field: panel.field, aggregate: kind });
  }
}

/**
 * The metric series feeding the KPI compute. `cells` are the metric cells in
 * series order (numeric only for a numeric aggregate; any non-null cell for
 * count/distinct); `periodKeys` is present ONLY when the panel sets an explicit
 * periodField — a parallel array of period unit-indices (ascending) that lets the
 * baseline slice by DISTINCT period instead of by row. When it is absent, every
 * read falls back to ROW ORDER (byte-identical to v0.1).
 */
interface MetricSeries {
  readonly cells: MetricCell[];
  readonly periodKeys?: number[];
}

/**
 * Build the metric series for a panel. Without periodField: the admitted cells in
 * row order (v0.1, unchanged for numeric input). With periodField (v0.2): keep rows
 * that have BOTH an admitted metric cell AND a parseable period (periodField is
 * author-declared temporal, so bare years are allowed — mirroring
 * summarizeTemporal); key each by the FINEST granularity present across those
 * cells; stable-sort ASCending by that key. Unparseable-period rows are dropped
 * (mirrors the numeric-only drop for numeric aggregates); duplicate-period rows
 * are kept in input order (no roll-up in v1). temporal.ts is UTC-pinned, so the
 * resulting order is deterministic.
 */
function buildMetricSeries(panel: KpiPanel, rows: readonly DataRecord[], kind: AggregateKind): MetricSeries {
  if (!panel.periodField) {
    return { cells: cellSeries(panel.field, rows, kind) };
  }
  const { field, periodField } = panel;
  const kept: { cell: MetricCell; parsed: ParsedTemporal }[] = [];
  for (const row of rows) {
    const cell = metricCell(row[field], kind);
    if (cell === null) {
      continue;
    }
    const parsed = parseTemporalValue(row[periodField], true);
    if (parsed === null) {
      continue;
    }
    kept.push({ cell, parsed });
  }
  if (kept.length === 0) {
    return { cells: [], periodKeys: [] };
  }
  const granularity = finestGranularity(kept.map((k) => k.parsed));
  // Carry the pre-sort index so ties (duplicate periods) keep input order
  // EXPLICITLY — not relying on the engine's sort stability.
  const keyed = kept.map((k, index) => ({ cell: k.cell, key: unitIndexFor(k.parsed, granularity), index }));
  keyed.sort((a, b) => a.key - b.key || a.index - b.index);
  return {
    cells: keyed.map((k) => k.cell),
    periodKeys: keyed.map((k) => k.key),
  };
}

function aggregate(cells: readonly MetricCell[], kind: AggregateKind): number {
  if (cells.length === 0) {
    return 0;
  }
  // count/distinct are defined over every admitted cell (any type); the canonical
  // form (toNumber ?? String) means 1, '1' and '1.0' are ONE distinct key.
  if (kind === 'count') {
    return cells.length;
  }
  if (kind === 'distinct') {
    return new Set(cells).size;
  }
  // A numeric aggregate's series admits only numeric cells, so this is the identity.
  const series = numericValues(cells);
  if (series.length === 0) {
    return 0;
  }
  switch (kind) {
    case 'sum':
      return series.reduce((acc, v) => acc + v, 0);
    case 'average':
      return mean(series);
    case 'median':
      return quantileSorted([...series].sort((a, b) => a - b), 0.5);
    case 'min':
      return series.reduce((m, v) => (v < m ? v : m), series[0]);
    case 'max':
      return series.reduce((m, v) => (v > m ? v : m), series[0]);
    case 'latest':
      return series[series.length - 1];
    default:
      return series.reduce((acc, v) => acc + v, 0);
  }
}

/**
 * Resolve the comparison baseline for the KPI delta. deriveTrend is first-vs-last
 * only, so this adds the three frozen bases:
 *  - 'target'        → the explicit target value;
 *  - 'prior_period'  → the same aggregate over the series EXCLUDING the most-recent point/period;
 *  - 'window'        → the same aggregate over the series EXCLUDING the last `window` points/periods.
 * Without periodField the slice is by trailing ROWS (v0.1); with periodField it
 * is by trailing DISTINCT PERIODS (v0.2). prior_period is window-of-1. Returns
 * null when the basis cannot be resolved (no target value, or the prior slice is empty).
 */
function resolveBaseline(panel: KpiPanel, series: MetricSeries, kind: AggregateKind): number | null {
  const comparison = panel.comparison;
  if (!comparison) {
    return null;
  }
  if (comparison.basis === 'target') {
    return typeof comparison.value === 'number' ? comparison.value : null;
  }
  const window = comparison.basis === 'prior_period' ? 1 : Math.max(1, Math.trunc(comparison.window ?? 1));
  const priorSlice = priorCells(series, window);
  return priorSlice.length > 0 ? round(aggregate(priorSlice, kind)) : null;
}

/**
 * The metric cells BEFORE the trailing `window` units. v0.1 (no periodKeys):
 * exclude the last `window` ROWS. v0.2 (periodKeys present): exclude the last
 * `window` DISTINCT PERIODS — keep cells whose period key is below the cutoff.
 * A window covering every unit leaves an empty slice (baseline unresolved).
 */
function priorCells(series: MetricSeries, window: number): MetricCell[] {
  const { cells, periodKeys } = series;
  if (!periodKeys) {
    // Clamp the slice end at 0: a window >= series length leaves no prior slice.
    // (A negative slice end would wrongly count from the array's tail.)
    return cells.slice(0, Math.max(0, cells.length - window));
  }
  // periodKeys is ascending, so first-seen Set insertion order is ascending too.
  const distinct = [...new Set(periodKeys)];
  if (window >= distinct.length) {
    return [];
  }
  const cutoff = distinct[distinct.length - window];
  const prior: MetricCell[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (periodKeys[i] < cutoff) {
      prior.push(cells[i]);
    }
  }
  return prior;
}

/** Compute a KPI payload from the (already cross-filtered) rows for the panel. */
export function computeKpi(panel: KpiPanel, rows: readonly DataRecord[]): KpiResult {
  const kind: AggregateKind = panel.aggregate ?? 'sum';
  assertNumericCells(panel, rows, kind);
  const series = buildMetricSeries(panel, rows, kind);
  const value = round(aggregate(series.cells, kind));
  // The numeric projection feeds the sparkline, the period trend and the anomaly
  // flag. For a numeric aggregate (and for any all-numeric input) it IS the series;
  // for count/distinct over non-numeric cells it is the numeric cells only, so a
  // string-only field carries no sparkline/anomaly rather than an invented one.
  const values = numericValues(series.cells);

  const baseline = resolveBaseline(panel, series, kind);
  const delta = baseline !== null ? round(value - baseline) : null;
  const deltaPct = baseline !== null && baseline !== 0 ? round((value - baseline) / Math.abs(baseline)) : null;

  let trendDirection: KpiResult['trendDirection'];
  if (baseline !== null) {
    trendDirection = deriveTrend(baseline, value).trend;
  } else if (panel.periodField && values.length >= 2) {
    // s149 F6b: a first-vs-last trend is only meaningful when the series has a real
    // temporal order. With periodField the values are sorted ascending by period
    // (buildMetricSeries), so values[0]→values[last] is earliest→latest. WITHOUT it
    // the values are in arbitrary ROW order, so first-vs-last narrates row order as a
    // trend on non-temporal data — a phantom. Report 'flat' rather than invent one.
    trendDirection = deriveTrend(values[0], values[values.length - 1]).trend;
  } else {
    trendDirection = 'flat';
  }

  const result: {
    value: number;
    formatted: string;
    delta: number | null;
    deltaPct: number | null;
    trendDirection: KpiResult['trendDirection'];
    sparkline?: readonly number[];
    thresholdBreached?: boolean;
    anomaly?: boolean;
  } = {
    value,
    formatted: String(value),
    delta,
    deltaPct,
    trendDirection,
  };

  if (values.length > 1) {
    result.sparkline = values.map((v) => round(v));
  }

  const threshold = panel.threshold;
  if (threshold && typeof threshold.value === 'number' && threshold.direction) {
    result.thresholdBreached = threshold.direction === 'above' ? value > threshold.value : value < threshold.value;
  }

  if (threshold?.anomaly === 'stddev_outlier' && values.length >= 2) {
    const seriesMean = mean(values);
    const sd = populationStdDev(values, seriesMean);
    const latest = values[values.length - 1];
    result.anomaly = sd > 0 ? Math.abs(latest - seriesMean) > STDDEV_OUTLIER_SIGMA * sd : false;
  }

  return result;
}
