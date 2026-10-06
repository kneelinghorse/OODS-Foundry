const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export function formatNumeric(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const absolute = Math.abs(value);
  if (absolute >= 1000 && absolute % 1 === 0) {
    return integerFormatter.format(value);
  }
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return percentFormatter.format(value);
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    return formatNumeric(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatDimension(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number') {
    return formatNumeric(value);
  }
  return String(value);
}

// ============================================================================
// s160 m4 — the narrated-value KIND registry + tagged numeric emission (SSOT memo §2-m4).
// Every NUMBER the single-chart narrative (generateNarrativeSummary) or the dashboard narrative
// (deriveDashboardNarrative) interpolates into text is emitted through narrateNumber with a
// declared kind, and every kind is classified 'guard-checked' (the drawn-value guard independently
// verifies it) or 'disclosed' (enumerated, NOT verified — the claim ceiling's residual list is
// GENERATED from this registry). The Record below is COMPILE-EXHAUSTIVE (the s158
// CHANNEL_GROUPING_ROLE recipe): a new kind without a classification is a TYPE ERROR, and the
// standing provenance sweep (narrated-value-provenance-sweep-s160.spec.ts) fails on any numeric
// token in emitted text that no tagged emission (or dimension-label numeral) accounts for — so a
// raw `${value}` template interpolation cannot ship silently (the pre-s160 correlation coefficient
// at full 3-decimal precision was exactly that bypass). This module is deliberately OFF the a11y
// barrel and the package barrel — none of this is public API.
// ============================================================================

export type NarratedValueKind =
  // guard-checked: enforceDrawnValueInvariant / findNonDrawnNarrativeValues verifies these against
  // the independently-derived drawn set (max/min/total) or the recompute oracle (correlation-r).
  | 'extremum-max'
  | 'extremum-min'
  | 'total'
  | 'correlation-r'
  // disclosed: enumerated narrated numerics the guard does NOT verify (the honest residual list).
  | 'first'
  | 'last'
  | 'trend-percent'
  | 'trend-delta'
  | 'mean'
  | 'row-count'
  | 'governed-threshold'
  | 'governed-target'
  // Author-governed context STRINGS (a unit/format descriptor like "1000 USD") whose digits are not
  // data-derived narrated values — tagged so the provenance sweep accounts for them (s161 m4 §1.9).
  | 'governed-unit'
  | 'governed-format'
  | 'kpi-count'
  | 'kpi-breach-count'
  | 'kpi-anomaly-count'
  | 'kpi-value'
  | 'kpi-delta'
  | 'kpi-threshold'
  | 'kpi-target';

export const NARRATED_VALUE_CLASSIFICATION: Record<NarratedValueKind, 'guard-checked' | 'disclosed'> = {
  'extremum-max': 'guard-checked',
  'extremum-min': 'guard-checked',
  total: 'guard-checked',
  'correlation-r': 'guard-checked',
  first: 'disclosed',
  last: 'disclosed',
  'trend-percent': 'disclosed',
  'trend-delta': 'disclosed',
  // NOTE (s160 m3 side-effect, disclosed): mean GAINS emission traffic — a suppressed correlation
  // shifts point summaries to the extrema+mean fallback arm.
  mean: 'disclosed',
  // Raw row count — narrated even beside an AGGREGATED Total ("N data points totaling …"), where N
  // counts raw rows, not drawn marks. Its own registry entry so that mismatch stays visible.
  'row-count': 'disclosed',
  'governed-threshold': 'disclosed',
  'governed-target': 'disclosed',
  'governed-unit': 'disclosed',
  'governed-format': 'disclosed',
  'kpi-count': 'disclosed',
  'kpi-breach-count': 'disclosed',
  'kpi-anomaly-count': 'disclosed',
  'kpi-value': 'disclosed',
  'kpi-delta': 'disclosed',
  'kpi-threshold': 'disclosed',
  'kpi-target': 'disclosed',
};

export interface NarratedNumberEmission {
  readonly kind: NarratedValueKind;
  /** The raw numeric; undefined for a pre-formatted upstream value (kpi-value's formatted string). */
  readonly value: number | undefined;
  readonly formatted: string;
}

// Capture sink for the standing provenance sweep. Null in production — narrateNumber is then a pure
// format call with zero retained state (determinism preserved).
let captureSink: NarratedNumberEmission[] | null = null;

/** Emit a narrated numeric: format (shared formatter unless a pre-formatted string is supplied) + tag. */
export function narrateNumber(value: number, kind: NarratedValueKind, formatted?: string): string {
  const text = formatted ?? formatNumeric(value);
  if (captureSink) {
    captureSink.push({ kind, value, formatted: text });
  }
  return text;
}

/** Tag a numeric that was formatted UPSTREAM (e.g. a KPI's precomputed display string). */
export function narrateFormatted(kind: NarratedValueKind, formatted: string): string {
  if (captureSink) {
    captureSink.push({ kind, value: undefined, formatted });
  }
  return formatted;
}

/** Run `fn` with emission capture on (test hook for the provenance sweep). Re-entrant-safe. */
export function captureNarratedNumbers<T>(fn: () => T): { result: T; emissions: NarratedNumberEmission[] } {
  const prev = captureSink;
  const sink: NarratedNumberEmission[] = [];
  captureSink = sink;
  try {
    return { result: fn(), emissions: sink };
  } finally {
    captureSink = prev;
  }
}

/**
 * Turn a raw field name into a human-readable label: snake_case / kebab-case /
 * camelCase collapse to spaces and only the FIRST character is capitalized
 * (sentence case, NOT full Title Case) — e.g. `total_revenue` -> `Total revenue`,
 * `grossMargin` -> `Gross margin`. Deterministic (pure string transform, no
 * locale). Shared so the accessible-table column labels, the narrative field
 * labels, and (sprint-135 m02) the synthesized axis titles / aria-labels all
 * agree; any drift between them is a screen-reader mismatch.
 */
export function humanize(value: string): string {
  const withSpaces = value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
