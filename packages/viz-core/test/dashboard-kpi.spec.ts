import { describe, expect, it } from 'vitest';
import { computeKpi, KpiComputeError, type KpiPanel } from '@oods/viz-core';

function kpiPanel(overrides: Partial<KpiPanel> = {}): KpiPanel {
  return { id: 'kpi', kind: 'kpi', datasetId: 'd', field: 'revenue', ...overrides } as KpiPanel;
}
const rows = (vals: Array<number | string | null>) => vals.map((v) => ({ revenue: v }));
const SERIES = rows([100, 80, 120, 90, 200]); // sum 590, mean 118, latest 200, median 100

describe('@oods/viz-core — computeKpi', () => {
  it('computes the standard aggregates over the metric series', () => {
    expect(computeKpi(kpiPanel({ aggregate: 'sum' }), SERIES).value).toBe(590);
    expect(computeKpi(kpiPanel({ aggregate: 'average' }), SERIES).value).toBe(118);
    expect(computeKpi(kpiPanel({ aggregate: 'latest' }), SERIES).value).toBe(200);
    expect(computeKpi(kpiPanel({ aggregate: 'count' }), SERIES).value).toBe(5);
    expect(computeKpi(kpiPanel({ aggregate: 'distinct' }), SERIES).value).toBe(5);
    expect(computeKpi(kpiPanel({ aggregate: 'min' }), SERIES).value).toBe(80);
    expect(computeKpi(kpiPanel({ aggregate: 'max' }), SERIES).value).toBe(200);
    expect(computeKpi(kpiPanel({ aggregate: 'median' }), SERIES).value).toBe(100);
  });

  it('defaults to sum and filters out non-numeric cells', () => {
    const r = computeKpi(kpiPanel(), rows([100, 'n/a', 80, null]));
    expect(r.value).toBe(180);
    expect(r.formatted).toBe('180');
  });

  it('computes delta/deltaPct/trend against an explicit target', () => {
    const r = computeKpi(kpiPanel({ aggregate: 'latest', comparison: { basis: 'target', value: 150 } }), SERIES);
    expect(r.delta).toBe(50);
    expect(r.deltaPct).toBe(round6(50 / 150));
    expect(r.trendDirection).toBe('increasing');
  });

  it('computes a prior_period delta (same aggregate over the series minus the last point)', () => {
    // latest of full = 200; latest of [100,80,120,90] = 90 -> delta 110
    const r = computeKpi(kpiPanel({ aggregate: 'latest', comparison: { basis: 'prior_period' } }), SERIES);
    expect(r.delta).toBe(110);
    expect(r.trendDirection).toBe('increasing');
  });

  it('computes a window delta (excludes the last N points)', () => {
    // latest of series.slice(0,3)=[100,80,120] is 120 -> delta 80
    const r = computeKpi(kpiPanel({ aggregate: 'latest', comparison: { basis: 'window', window: 2 } }), SERIES);
    expect(r.delta).toBe(80);
  });

  it('returns null delta when the comparison basis cannot resolve', () => {
    const noTarget = computeKpi(kpiPanel({ comparison: { basis: 'target' } }), SERIES);
    expect(noTarget.delta).toBeNull();
    const tooShort = computeKpi(kpiPanel({ aggregate: 'latest', comparison: { basis: 'window', window: 9 } }), SERIES);
    expect(tooShort.delta).toBeNull();
  });

  it('includes the sparkline only when there is more than one point', () => {
    expect(computeKpi(kpiPanel(), SERIES).sparkline).toEqual([100, 80, 120, 90, 200]);
    expect(computeKpi(kpiPanel(), rows([42])).sparkline).toBeUndefined();
  });

  it('flags a threshold breach by direction', () => {
    expect(computeKpi(kpiPanel({ aggregate: 'sum', threshold: { direction: 'above', value: 500 } }), SERIES).thresholdBreached).toBe(true);
    expect(computeKpi(kpiPanel({ aggregate: 'sum', threshold: { direction: 'below', value: 500 } }), SERIES).thresholdBreached).toBe(false);
    expect(computeKpi(kpiPanel(), SERIES).thresholdBreached).toBeUndefined();
  });

  it('flags a stddev outlier on the latest point only when requested', () => {
    const outlier = computeKpi(
      kpiPanel({ aggregate: 'latest', threshold: { anomaly: 'stddev_outlier' } }),
      rows([10, 10, 10, 10, 10, 1000]),
    );
    expect(outlier.anomaly).toBe(true);
    const calm = computeKpi(
      kpiPanel({ aggregate: 'latest', threshold: { anomaly: 'stddev_outlier' } }),
      rows([10, 12, 11, 13, 10]),
    );
    expect(calm.anomaly).toBe(false);
    expect(computeKpi(kpiPanel(), SERIES).anomaly).toBeUndefined();
  });

  it('handles an empty row set deterministically', () => {
    const r = computeKpi(kpiPanel({ comparison: { basis: 'prior_period' } }), []);
    expect(r).toMatchObject({ value: 0, delta: null, deltaPct: null, trendDirection: 'flat' });
    expect(r.sparkline).toBeUndefined();
  });

  it('is deterministic — running twice is byte-identical', () => {
    const panel = kpiPanel({ aggregate: 'average', comparison: { basis: 'window', window: 2 }, threshold: { direction: 'above', value: 100, anomaly: 'stddev_outlier' } });
    expect(JSON.stringify(computeKpi(panel, SERIES))).toBe(JSON.stringify(computeKpi(panel, SERIES)));
  });

  // s149 F6b: a KPI with NO periodField and NO comparison basis has no real temporal
  // (or comparative) axis — its values are in arbitrary ROW order. Deriving a
  // first-vs-last "trend" there narrates row order as a trend on non-temporal data
  // (unchanged values). Suppress it: report 'flat' rather than invent a direction. The
  // baseline branch (comparison present) and the periodField branch are unaffected.
  describe('F6b — no phantom trend without a temporal or comparison axis', () => {
    it('no periodField + no comparison => flat, even when row-order first<last', () => {
      // SERIES row order is 100 -> ... -> 200; pre-F6b this reported 'increasing'.
      expect(computeKpi(kpiPanel({ aggregate: 'sum' }), SERIES).trendDirection).toBe('flat');
    });

    it('no periodField + no comparison => flat, even when row-order first>last', () => {
      expect(computeKpi(kpiPanel({ aggregate: 'sum' }), rows([200, 50])).trendDirection).toBe('flat');
    });

    it('a comparison basis STILL trends without periodField (baseline branch unchanged)', () => {
      const r = computeKpi(kpiPanel({ aggregate: 'latest', comparison: { basis: 'target', value: 150 } }), SERIES);
      expect(r.trendDirection).toBe('increasing');
    });

    it('periodField STILL trends earliest->latest without a comparison (real temporal axis)', () => {
      // UNSORTED sorts to [Jan 100, Feb 150, Mar 200] -> genuine increasing trend.
      expect(computeKpi(periodPanel(), UNSORTED).trendDirection).toBe('increasing');
    });
  });
});

// ---------------------------------------------------------------------------
// Explicit period axis (v0.2, sprint-114). WHY these matter: s113 read DATASET
// ROW ORDER as the time axis everywhere; periodField makes the axis a PARSED +
// SORTED period via temporal.ts. The opt-in additivity contract is the load-
// bearing invariant — periodField ABSENT must stay byte-identical to s113 (the
// row-order goldens above are that guard); periodField PRESENT must sort, drop
// unparseable, keep duplicates stable, key at the finest granularity, and slice
// baselines by DISTINCT period (not row).
// ---------------------------------------------------------------------------
const periodRows = (pairs: Array<[number, string]>) => pairs.map(([revenue, period]) => ({ revenue, period }));
// Deliberately out of period order so a row-order read and a period read DIVERGE.
const UNSORTED = periodRows([[200, '2024-03'], [100, '2024-01'], [150, '2024-02']]);
const periodPanel = (o: Partial<KpiPanel> = {}) => kpiPanel({ periodField: 'period', ...o });

describe('@oods/viz-core — computeKpi explicit period axis (v0.2, sprint-114)', () => {
  it('sorts an unsorted row set by period; latest = max period; sparkline is period-ordered', () => {
    expect(computeKpi(periodPanel({ aggregate: 'latest' }), UNSORTED).value).toBe(200);
    expect(computeKpi(periodPanel({ aggregate: 'sum' }), UNSORTED).value).toBe(450);
    expect(computeKpi(periodPanel({ aggregate: 'average' }), UNSORTED).value).toBe(150);
    expect(computeKpi(periodPanel(), UNSORTED).sparkline).toEqual([100, 150, 200]);
  });

  it('ABSENT periodField stays pure row order (the opt-in additivity contract)', () => {
    // Same rows, no periodField: latest = LAST ROW (150), sparkline in row order.
    expect(computeKpi(kpiPanel({ aggregate: 'latest' }), UNSORTED).value).toBe(150);
    expect(computeKpi(kpiPanel(), UNSORTED).sparkline).toEqual([200, 100, 150]);
  });

  it('prior_period excludes the single most-recent DISTINCT period', () => {
    // latest = Mar 200; prior_period -> exclude Mar -> latest of {Jan,Feb} = 150 -> delta 50
    const r = computeKpi(periodPanel({ aggregate: 'latest', comparison: { basis: 'prior_period' } }), UNSORTED);
    expect(r.delta).toBe(50);
    expect(r.trendDirection).toBe('increasing');
  });

  it('window excludes the last N DISTINCT periods (not the last N rows)', () => {
    // window 2 -> exclude Feb+Mar -> latest of {Jan} = 100 -> delta 100
    expect(computeKpi(periodPanel({ aggregate: 'latest', comparison: { basis: 'window', window: 2 } }), UNSORTED).delta).toBe(100);
  });

  it('slices baselines by DISTINCT period even when the latest period has duplicate rows', () => {
    // Mar has TWO rows (40, 50). prior_period must drop BOTH (distinct period),
    // not just the last row: sum 130 vs prior {Jan10,Feb30}=40 -> delta 90.
    // (A row-based slice would drop only 50 -> prior 80 -> delta 50, which this rejects.)
    const dupLatest = periodRows([[10, '2024-01'], [30, '2024-02'], [40, '2024-03'], [50, '2024-03']]);
    const r = computeKpi(periodPanel({ aggregate: 'sum', comparison: { basis: 'prior_period' } }), dupLatest);
    expect(r.value).toBe(130);
    expect(r.delta).toBe(90);
    expect(computeKpi(periodPanel(), dupLatest).sparkline).toEqual([10, 30, 40, 50]); // dup-period rows kept in input order
  });

  it('window N>1 slices by DISTINCT periods even when a non-latest period repeats', () => {
    // Feb has TWO rows. distinct periods = {Jan,Feb,Mar}; window 2 -> exclude Feb+Mar
    // -> prior = {Jan 10} sum 10; value sum 100 -> delta 90.
    // (A row-based 'last 2 rows' slice would keep [10,20] sum 30 -> delta 70, which this rejects.)
    const dupMiddle = periodRows([[10, '2024-01'], [20, '2024-02'], [30, '2024-02'], [40, '2024-03']]);
    expect(computeKpi(periodPanel({ aggregate: 'sum', comparison: { basis: 'window', window: 2 } }), dupMiddle).delta).toBe(90);
  });

  it('drops rows whose period cell is unparseable (mirrors numericSeries dropping non-numerics)', () => {
    const withGarbage = periodRows([[10, '2024-01'], [999, 'garbage'], [20, '2024-02']]);
    expect(computeKpi(periodPanel({ aggregate: 'sum' }), withGarbage).value).toBe(30); // 999 dropped
    expect(computeKpi(periodPanel(), withGarbage).sparkline).toEqual([10, 20]);
  });

  it('coerces mixed granularity to the finest present (year -> month)', () => {
    const mixed = periodRows([[5, '2023'], [7, '2024-06'], [6, '2024-01']]);
    // finest = month: 2023 -> 2024-01 -> 2024-06, so latest = 2024-06 = 7
    expect(computeKpi(periodPanel({ aggregate: 'latest' }), mixed).value).toBe(7);
    expect(computeKpi(periodPanel(), mixed).sparkline).toEqual([5, 6, 7]);
  });

  it('sorts correctly at quarter, day, and time granularity (unitIndexFor branches)', () => {
    expect(computeKpi(periodPanel(), periodRows([[3, '2024-Q3'], [1, '2023-Q4'], [2, '2024-Q1']])).sparkline).toEqual([1, 2, 3]);
    expect(computeKpi(periodPanel(), periodRows([[2, '2024-01-15'], [1, '2024-01-02']])).sparkline).toEqual([1, 2]);
    expect(computeKpi(periodPanel(), periodRows([[2, '2024-01-01T10:00'], [1, '2024-01-01T08:00']])).sparkline).toEqual([1, 2]);
  });

  it('behaves like an empty set when periodField is set but no period parses', () => {
    const r = computeKpi(periodPanel({ comparison: { basis: 'prior_period' } }), periodRows([[10, 'x'], [20, 'y']]));
    expect(r).toMatchObject({ value: 0, delta: null, deltaPct: null, trendDirection: 'flat' });
    expect(r.sparkline).toBeUndefined();
  });

  it('is deterministic on the period path — running twice is byte-identical', () => {
    const panel = periodPanel({ aggregate: 'average', comparison: { basis: 'window', window: 2 }, threshold: { anomaly: 'stddev_outlier' } });
    expect(JSON.stringify(computeKpi(panel, UNSORTED))).toBe(JSON.stringify(computeKpi(panel, UNSORTED)));
  });
});

// ---------------------------------------------------------------------------
// measureRef inertness (sprint-116, Phase-3 beachhead). WHY this matters: the
// measureRef descriptor is a governed-measure provenance tag, and the frozen
// contract (schema seam (vi)) is "ABSENT or PRESENT => byte-identical compute,
// no golden re-bake" — field + aggregate stay the authoritative compute inputs.
// computeKpi must NEVER read panel.measureRef. This guard reds the moment any
// compute branch starts consuming it (e.g. a premature resolver lands here
// instead of at the deferred mcp-server boundary).
// ---------------------------------------------------------------------------
describe('@oods/viz-core — computeKpi measureRef is inert (sprint-116)', () => {
  it('changes nothing — byte-identical output with vs without measureRef (row-order path)', () => {
    const base = kpiPanel({ aggregate: 'latest', comparison: { basis: 'prior_period' }, threshold: { direction: 'above', value: 100, anomaly: 'stddev_outlier' } });
    const withRef = kpiPanel({ ...base, measureRef: 'gm.revenue' });
    expect(JSON.stringify(computeKpi(withRef, SERIES))).toBe(JSON.stringify(computeKpi(base, SERIES)));
  });

  it('changes nothing on the explicit-period path either', () => {
    const base = periodPanel({ aggregate: 'sum', comparison: { basis: 'window', window: 2 } });
    const withRef = periodPanel({ ...base, measureRef: 'gm.revenue' });
    expect(JSON.stringify(computeKpi(withRef, UNSORTED))).toBe(JSON.stringify(computeKpi(base, UNSORTED)));
  });
});

// ---------------------------------------------------------------------------
// Cell-type semantics (sprint-175 m05, decision 11 — Dashboard-demos FD#1). WHY
// this matters: HEAD 852be47 built EVERY metric series through a numeric-only
// filter BEFORE the aggregate switch, so `count` over a string field returned a
// plausible 0 with no error (the consumer's FD#1), and `sum` over an all-string
// field did the same. The contract now: count/distinct are COUNT(field) — every
// non-null cell regardless of type, never rows.length (the absent-field and empty
// paths stay 0); the six numeric aggregates use numeric cells only and FAIL LOUD
// (KpiComputeError) when the field has values but none numeric. All-numeric
// inputs are byte-identical to HEAD on both series builders — the goldens below
// were captured at 852be47 before kpi.ts changed.
// ---------------------------------------------------------------------------
const STRINGS = [{ chartType: 'bar' }, { chartType: 'line' }, { chartType: 'bar' }];
const typed = (o: Partial<KpiPanel> = {}) => kpiPanel({ field: 'chartType', ...o });
const ALL_AGGREGATES = ['sum', 'count', 'average', 'median', 'min', 'max', 'distinct', 'latest'] as const;
const NUMERIC_AGGREGATES = ['sum', 'average', 'median', 'min', 'max', 'latest'] as const;
// Captured at HEAD 852be47 (pre-change): row-order path over SERIES with prior_period +
// an above-100 threshold + stddev anomaly, for every aggregate.
const ROW_GOLDENS: Record<(typeof ALL_AGGREGATES)[number], string> = {
  sum: '{"value":590,"formatted":"590","delta":200,"deltaPct":0.512821,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":true,"anomaly":false}',
  count: '{"value":5,"formatted":"5","delta":1,"deltaPct":0.25,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":false,"anomaly":false}',
  average: '{"value":118,"formatted":"118","delta":20.5,"deltaPct":0.210256,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":true,"anomaly":false}',
  median: '{"value":100,"formatted":"100","delta":5,"deltaPct":0.052632,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":false,"anomaly":false}',
  min: '{"value":80,"formatted":"80","delta":0,"deltaPct":0,"trendDirection":"flat","sparkline":[100,80,120,90,200],"thresholdBreached":false,"anomaly":false}',
  max: '{"value":200,"formatted":"200","delta":80,"deltaPct":0.666667,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":true,"anomaly":false}',
  distinct: '{"value":5,"formatted":"5","delta":1,"deltaPct":0.25,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":false,"anomaly":false}',
  latest: '{"value":200,"formatted":"200","delta":110,"deltaPct":1.222222,"trendDirection":"increasing","sparkline":[100,80,120,90,200],"thresholdBreached":true,"anomaly":false}',
};
// Same capture on the explicit-period path over UNSORTED.
const PERIOD_GOLDENS: Record<(typeof ALL_AGGREGATES)[number], string> = {
  sum: '{"value":450,"formatted":"450","delta":200,"deltaPct":0.8,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":true,"anomaly":false}',
  count: '{"value":3,"formatted":"3","delta":1,"deltaPct":0.5,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":false,"anomaly":false}',
  average: '{"value":150,"formatted":"150","delta":25,"deltaPct":0.2,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":true,"anomaly":false}',
  median: '{"value":150,"formatted":"150","delta":25,"deltaPct":0.2,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":true,"anomaly":false}',
  min: '{"value":100,"formatted":"100","delta":0,"deltaPct":0,"trendDirection":"flat","sparkline":[100,150,200],"thresholdBreached":false,"anomaly":false}',
  max: '{"value":200,"formatted":"200","delta":50,"deltaPct":0.333333,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":true,"anomaly":false}',
  distinct: '{"value":3,"formatted":"3","delta":1,"deltaPct":0.5,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":false,"anomaly":false}',
  latest: '{"value":200,"formatted":"200","delta":50,"deltaPct":0.333333,"trendDirection":"increasing","sparkline":[100,150,200],"thresholdBreached":true,"anomaly":false}',
};
const goldenPanel = (o: Partial<KpiPanel>) =>
  kpiPanel({ comparison: { basis: 'prior_period' }, threshold: { direction: 'above', value: 100, anomaly: 'stddev_outlier' }, ...o });

describe('@oods/viz-core — computeKpi cell-type semantics (sprint-175 m05, FD#1)', () => {
  it('count over string cells = the non-null cell count (FD#1 — HEAD returned 0)', () => {
    const r = computeKpi(typed({ aggregate: 'count' }), STRINGS);
    expect(r.value).toBe(3);
    expect(r.formatted).toBe('3');
  });

  it("distinct over ['bar','line','bar'] = 2", () => {
    expect(computeKpi(typed({ aggregate: 'distinct' }), STRINGS).value).toBe(2);
  });

  it('count/distinct skip null and undefined cells — COUNT(field), never rows.length', () => {
    const sparse = [{ chartType: 'bar' }, { chartType: null }, {}, { chartType: 'line' }];
    expect(computeKpi(typed({ aggregate: 'count' }), sparse).value).toBe(2);
    expect(computeKpi(typed({ aggregate: 'distinct' }), sparse).value).toBe(2);
  });

  it('distinct canonicalises numeric-looking cells (toNumber ?? String) so numeric fields keep their cardinality', () => {
    expect(computeKpi(kpiPanel({ aggregate: 'distinct' }), rows([1, '1', '1.0', 2])).value).toBe(2);
    expect(computeKpi(kpiPanel({ aggregate: 'count' }), rows([1, '1', '1.0', 2])).value).toBe(4);
  });

  it('count over strings WITH periodField = 3 (HEAD: 0); unparseable periods still drop', () => {
    const periodStrings = [
      { chartType: 'bar', period: '2024-01' },
      { chartType: 'line', period: '2024-02' },
      { chartType: 'bar', period: '2024-03' },
    ];
    expect(computeKpi(typed({ aggregate: 'count', periodField: 'period' }), periodStrings).value).toBe(3);
    expect(computeKpi(typed({ aggregate: 'distinct', periodField: 'period' }), periodStrings).value).toBe(2);
    const withGarbage = [...periodStrings, { chartType: 'area', period: 'garbage' }];
    expect(computeKpi(typed({ aggregate: 'count', periodField: 'period' }), withGarbage).value).toBe(3);
  });

  it('prior_period for count over strings slices by DISTINCT period (prior count 2 -> delta 1)', () => {
    const periodStrings = [
      { chartType: 'bar', period: '2024-03' },
      { chartType: 'line', period: '2024-01' },
      { chartType: 'bar', period: '2024-02' },
    ];
    const r = computeKpi(typed({ aggregate: 'count', periodField: 'period', comparison: { basis: 'prior_period' } }), periodStrings);
    expect(r.value).toBe(3);
    expect(r.delta).toBe(1);
    expect(r.sparkline).toBeUndefined(); // no numeric cells -> no numeric sparkline
  });

  it('an all-numeric row-order SERIES is byte-identical to HEAD for all 8 aggregates', () => {
    for (const kind of ALL_AGGREGATES) {
      expect(JSON.stringify(computeKpi(goldenPanel({ aggregate: kind }), SERIES)), kind).toBe(ROW_GOLDENS[kind]);
    }
  });

  it('an all-numeric periodField series is byte-identical to HEAD for all 8 aggregates', () => {
    for (const kind of ALL_AGGREGATES) {
      expect(JSON.stringify(computeKpi(goldenPanel({ aggregate: kind, periodField: 'period' }), UNSORTED)), kind).toBe(PERIOD_GOLDENS[kind]);
    }
  });

  it('sum over an all-string field throws KpiComputeError (not a silent 0)', () => {
    expect(() => computeKpi(typed({ aggregate: 'sum' }), STRINGS)).toThrow(KpiComputeError);
    let caught: unknown;
    try {
      computeKpi(typed({ aggregate: 'sum' }), STRINGS);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const e = caught as KpiComputeError;
    expect(e.name).toBe('KpiComputeError');
    expect(e.panelId).toBe('kpi');
    expect(e.field).toBe('chartType');
    expect(e.aggregate).toBe('sum');
    expect(e.reason).toBe('no_numeric_cells');
  });

  it('every numeric aggregate throws over an all-string field (incl. the sum default); count/distinct do not', () => {
    for (const kind of NUMERIC_AGGREGATES) {
      expect(() => computeKpi(typed({ aggregate: kind }), STRINGS), kind).toThrow(KpiComputeError);
    }
    expect(() => computeKpi(typed(), STRINGS)).toThrow(KpiComputeError); // aggregate omitted -> sum
    expect(() => computeKpi(typed({ aggregate: 'count' }), STRINGS)).not.toThrow();
    expect(() => computeKpi(typed({ aggregate: 'distinct' }), STRINGS)).not.toThrow();
  });

  it('throws on the periodField path too', () => {
    const periodStrings = [{ chartType: 'bar', period: '2024-01' }, { chartType: 'line', period: '2024-02' }];
    expect(() => computeKpi(typed({ aggregate: 'sum', periodField: 'period' }), periodStrings)).toThrow(KpiComputeError);
  });

  it('does NOT throw when at least one numeric cell exists — mixed cells keep the numeric-only filter (180)', () => {
    expect(computeKpi(kpiPanel({ aggregate: 'sum' }), rows([100, 'n/a', 80, null])).value).toBe(180);
  });

  it('absent field: count = 0 and sum = 0 (zero non-null cells — no throw; the ratified silent path)', () => {
    expect(computeKpi(kpiPanel({ field: 'nope', aggregate: 'count' }), SERIES).value).toBe(0);
    expect(computeKpi(kpiPanel({ field: 'nope', aggregate: 'sum' }), SERIES).value).toBe(0);
  });

  it('empty rows: count = 0 and sum = 0 (no throw)', () => {
    expect(computeKpi(typed({ aggregate: 'count' }), []).value).toBe(0);
    expect(computeKpi(typed({ aggregate: 'sum' }), []).value).toBe(0);
  });

  it('a numeric field whose periods all fail to parse still yields 0 (numeric cells exist — no throw)', () => {
    expect(computeKpi(periodPanel({ aggregate: 'sum' }), periodRows([[10, 'x'], [20, 'y']])).value).toBe(0);
  });
});

function round6(n: number): number {
  const r = Number(n.toFixed(6));
  return r === 0 ? 0 : r;
}
