import { describe, expect, it } from 'vitest';
import {
  analyzeVizSpec,
  buildFromIntent,
  buildVizSpecFromRows,
  fieldCorrelation,
  inferFieldProfile,
  suggestPatterns,
  toEChartsOption,
  toSchemaIntent,
  toVegaLiteSpec,
  validateNormalizedVizSpec,
  VizSpecBuilderError,
  type ChartType,
  type IntentChartFamily,
  type SchemaIntent,
} from '@oods/viz-core';
// detectGeoFields is an internal profiler helper (not in the public barrel);
// import it directly to cover its locale-independent tie-break.
import { detectGeoFields } from '../src/analysis/geo-detection.js';

const SALES = [
  { region: 'North', quarter: '2024-01', revenue: 120000 },
  { region: 'South', quarter: '2024-01', revenue: 135000 },
  { region: 'North', quarter: '2024-02', revenue: 128000 },
  { region: 'South', quarter: '2024-02', revenue: 142000 },
];

describe('buildVizSpecFromRows — explicit mode', () => {
  // Contract test: every beachhead chart type assembles into an AJV-valid spec
  // with a non-empty a11y.description and the input rows bound to data.values.
  const beachhead: ReadonlyArray<readonly [ChartType, string]> = [
    ['bar', 'MarkBar'],
    ['line', 'MarkLine'],
    ['area', 'MarkArea'],
    ['scatter', 'MarkPoint'],
    ['heatmap', 'MarkRect'],
  ];

  it.each(beachhead)('builds a valid %s spec (mark %s) with non-empty a11y + bound data', (chartType, markTrait) => {
    const result = buildVizSpecFromRows({
      rows: SALES,
      chartType,
      encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' }, color: 'quarter' },
    });

    expect(result.mode).toBe('explicit');
    expect(result.spec.marks[0].trait).toBe(markTrait);
    expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
    expect(result.spec.a11y.description.length).toBeGreaterThan(0);
    expect(result.spec.data.values).toHaveLength(4);
  });

  it('produces a valid spec with ZERO recommender involvement in explicit mode', () => {
    const result = buildVizSpecFromRows({
      rows: SALES,
      chartType: 'bar',
      encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } },
    });
    // suggestion + inferredFields are populated ONLY when the recommender runs
    // (suggest mode). Their absence is the observable proof the recommender was
    // never consulted in explicit mode.
    expect(result.suggestion).toBeUndefined();
    expect(result.inferredFields).toBeUndefined();
    expect(result.spec.encoding.y).toMatchObject({ field: 'revenue', trait: 'EncodingPositionY', aggregate: 'sum' });
  });

  it('compiles to a renderable Vega-Lite spec whose data.values are byte-equal to the input rows', () => {
    const { spec } = buildVizSpecFromRows({
      rows: SALES,
      chartType: 'bar',
      encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } },
    });
    const vl = toVegaLiteSpec(spec);
    expect(vl.mark).toMatchObject({ type: 'bar' });
    expect(vl.data?.values).toEqual(SALES);
    expect(JSON.stringify(vl.data?.values)).toEqual(JSON.stringify(SALES));
  });

  it('accepts the bare-string field shorthand for an encoding channel', () => {
    const { spec } = buildVizSpecFromRows({
      rows: SALES,
      chartType: 'line',
      encodings: { x: 'quarter', y: 'revenue' },
    });
    expect(spec.encoding.x).toMatchObject({ field: 'quarter', trait: 'EncodingPositionX' });
  });

  it('synthesizes a descriptive a11y.description referencing the encoded fields', () => {
    const { spec } = buildVizSpecFromRows({
      rows: SALES,
      chartType: 'bar',
      encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } },
    });
    expect(spec.a11y.description).toContain('revenue');
    expect(spec.a11y.description).toContain('region');
  });

  it('honours a caller-provided description override', () => {
    const { spec } = buildVizSpecFromRows({
      rows: SALES,
      chartType: 'bar',
      encodings: { x: 'region', y: 'revenue' },
      description: 'Quarterly revenue per region.',
    });
    expect(spec.a11y.description).toBe('Quarterly revenue per region.');
  });

  // sprint-125 m01 (Forge-Demos P0-1): two distinct float columns whose names trip
  // NO measure/year/zip hint, so the ONLY typing signal is the data itself.
  const FLOATS = [
    { sensorA: 40.71, sensorB: 12.34 },
    { sensorA: 34.05, sensorB: 56.78 },
    { sensorA: 41.88, sensorB: 90.12 },
    { sensorA: 29.76, sensorB: 33.45 },
  ];

  it('types an unscaled all-distinct-float x/y as quantitative, not the ordinal channel default (P0-1)', () => {
    // Before m01 an unscaled explicit x/y fell to the adapter channel default
    // (ordinal), so all-distinct floats rendered on a discrete axis. The builder
    // now stamps the data-derived FieldType onto the binding.
    const { spec } = buildVizSpecFromRows({
      rows: FLOATS,
      chartType: 'scatter',
      encodings: { x: 'sensorA', y: 'sensorB' },
    });
    // The binding carries the data-derived type…
    expect(spec.encoding.x?.type).toBe('quantitative');
    expect(spec.encoding.y?.type).toBe('quantitative');
    // …and it reaches the rendered Vega-Lite spec (the actual bug surface — this
    // was 'ordinal' before the fix, so the assertion fails on the old engine).
    const vl = toVegaLiteSpec(spec) as { encoding: Record<string, { type: string }> };
    expect(vl.encoding.x.type).toBe('quantitative');
    expect(vl.encoding.y.type).toBe('quantitative');
  });

  it('preserves a caller-declared scale over the data profile (discrete-numeric-axis escape)', () => {
    // A caller declaring scale:'band' deliberately wants a discrete axis; m01
    // leaves binding.type UNSET for scaled bindings, so the adapter's band→ordinal
    // branch still wins. The sibling unscaled y still gets the quantitative type.
    const { spec } = buildVizSpecFromRows({
      rows: FLOATS,
      chartType: 'scatter',
      encodings: { x: { field: 'sensorA', scale: 'band' }, y: 'sensorB' },
    });
    expect(spec.encoding.x?.type).toBeUndefined();
    const vl = toVegaLiteSpec(spec) as { encoding: Record<string, { type: string }> };
    expect(vl.encoding.x.type).toBe('ordinal');
    expect(vl.encoding.y.type).toBe('quantitative');
  });

  it('a caller-declared type overrides the data profile, and vega + echarts agree (m02)', () => {
    // sensorA all-distinct floats → m01 would profile quantitative. A caller
    // forcing type:'nominal' must WIN (caller > profile), and BOTH adapters must
    // honor it — vega 'nominal' / echarts 'category' — else the dual outputs
    // silently diverge (an explicit quantitative on a category echarts axis).
    const { spec } = buildVizSpecFromRows({
      rows: FLOATS,
      chartType: 'bar',
      encodings: { x: { field: 'sensorA', type: 'nominal' }, y: 'sensorB' },
    });
    expect(spec.encoding.x?.type).toBe('nominal');
    const vl = toVegaLiteSpec(spec) as { encoding: Record<string, { type: string }> };
    expect(vl.encoding.x.type).toBe('nominal');
    const ec = toEChartsOption(spec) as { xAxis?: { type?: string } };
    expect(ec.xAxis?.type).toBe('category');
  });

  it('throws when x or y is missing in explicit mode', () => {
    expect(() => buildVizSpecFromRows({ rows: SALES, chartType: 'bar', encodings: { x: 'region' } })).toThrow(
      VizSpecBuilderError,
    );
  });

  it('throws on empty rows', () => {
    expect(() => buildVizSpecFromRows({ rows: [], chartType: 'bar', encodings: { x: 'a', y: 'b' } })).toThrow(
      VizSpecBuilderError,
    );
  });
});

describe('inferFieldProfile + toSchemaIntent (suggest-mode primitives)', () => {
  it('classifies field types, roles and cardinality deterministically', () => {
    const [region, quarter, revenue] = inferFieldProfile(SALES);
    // Type/role/cardinality is the load-bearing contract; the data-aware stat
    // fields are additive (asserted separately below), so we match the triple
    // rather than the whole object.
    expect(region).toMatchObject({ name: 'region', type: 'nominal', role: 'dimension', cardinality: 2 });
    expect(quarter).toMatchObject({
      name: 'quarter',
      type: 'temporal',
      role: 'dimension',
      cardinality: 2,
      temporalGranularity: 'month',
      temporalRegular: true,
    });
    expect(revenue).toMatchObject({ name: 'revenue', type: 'quantitative', role: 'measure', cardinality: 4 });
  });

  it('attaches real numeric statistics to a measure field', () => {
    const revenue = inferFieldProfile(SALES).find((f) => f.name === 'revenue');
    // WHY: the profiler is now data-aware — a measure carries range/centre/shape
    // stats that the downstream recommender (m02/m03) scores against.
    expect(revenue).toMatchObject({
      min: 120000,
      max: 142000,
      mean: 131250,
      isInteger: true,
      hasNegative: false,
      hasZero: false,
      outlierCount: 0,
      distinctRatio: 1,
    });
    expect(typeof revenue?.stddev).toBe('number');
    expect(revenue?.stddev).toBeGreaterThan(0);
  });

  it('classifies a name-hinted year-only column as temporal (year granularity), not a measure', () => {
    // #686 fix: '2024'/'2025' under a year-hinting name is a time axis, NOT a
    // quantitative measure (the superseded s109 behaviour). role must be dimension.
    const [field] = inferFieldProfile([{ year: '2024' }, { year: '2025' }]);
    expect(field).toMatchObject({
      name: 'year',
      type: 'temporal',
      role: 'dimension',
      temporalGranularity: 'year',
    });
  });

  it('derives a count-based SchemaIntent with a temporal-driven trend goal', () => {
    const intent = toSchemaIntent(inferFieldProfile(SALES));
    expect(intent).toMatchObject({ measures: 1, dimensions: 1, temporals: 1, goal: 'trend' });
  });

  it('infers a relationship goal for two-measure data', () => {
    const intent = toSchemaIntent(
      inferFieldProfile([
        { responseMs: 120, conversion: 0.4 },
        { responseMs: 90, conversion: 0.6 },
      ]),
    );
    expect(intent).toMatchObject({ measures: 2, dimensions: 0, goal: 'relationship' });
  });
});

describe('buildVizSpecFromRows — suggest mode (recommender-driven)', () => {
  it('infers a chartType + encodings from rows alone and returns a valid spec', () => {
    const result = buildVizSpecFromRows({ rows: SALES });

    expect(result.mode).toBe('suggest');
    expect(['bar', 'line', 'area', 'scatter', 'heatmap']).toContain(result.chartType);
    expect(result.suggestion?.patternId).toBeTruthy();
    expect(result.inferredFields).toHaveLength(3);

    expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
    expect(result.spec.encoding.x?.field).toBeTruthy();
    expect(result.spec.encoding.y?.field).toBe('revenue');
    expect(result.spec.a11y.description.length).toBeGreaterThan(0);
    expect(() => toVegaLiteSpec(result.spec)).not.toThrow();
  });

  it('is deterministic — identical rows yield an identical spec', () => {
    const a = buildVizSpecFromRows({ rows: SALES });
    const b = buildVizSpecFromRows({ rows: SALES });
    expect(JSON.stringify(b.spec)).toEqual(JSON.stringify(a.spec));
    expect(b.chartType).toBe(a.chartType);
  });

  it('assigns x=measure, y=measure for a two-measure scatter relationship', () => {
    const result = buildVizSpecFromRows({
      rows: [
        { responseMs: 120, conversion: 0.4 },
        { responseMs: 90, conversion: 0.62 },
        { responseMs: 75, conversion: 0.71 },
      ],
    });
    if (result.chartType === 'scatter') {
      expect(result.spec.marks[0].trait).toBe('MarkPoint');
      expect(result.spec.encoding.x?.field).toBe('responseMs');
      expect(result.spec.encoding.y?.field).toBe('conversion');
    }
    expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
  });
});

describe('inferFieldProfile — #686 misclassification regression', () => {
  it('classifies a zip-code column as a nominal region code, not a measure', () => {
    const [zip] = inferFieldProfile([{ zip: '02134' }, { zip: '10001' }, { zip: '94103' }]);
    expect(zip).toMatchObject({ name: 'zip', type: 'nominal', role: 'dimension' });
    expect(zip.geoKind).toBe('region');
  });

  it('classifies a numeric ISO-4217 currency-code column as nominal, not a measure', () => {
    // Numeric currency codes (840=USD, 978=EUR, 826=GBP) would otherwise read as
    // a quantitative measure — the name-based semantic check demotes them.
    const [currency] = inferFieldProfile([{ currency: 840 }, { currency: 978 }, { currency: 826 }]);
    expect(currency).toMatchObject({ name: 'currency', type: 'nominal', role: 'dimension' });
  });

  it('recognises non-ISO date text as temporal', () => {
    const [slash] = inferFieldProfile([
      { d: '03/14/2024' },
      { d: '04/15/2024' },
      { d: '05/16/2024' },
    ]);
    expect(slash).toMatchObject({ name: 'd', type: 'temporal', temporalGranularity: 'day' });

    const [monYear] = inferFieldProfile([{ m: 'Mar 2024' }, { m: 'Apr 2024' }, { m: 'May 2024' }]);
    expect(monYear).toMatchObject({ name: 'm', type: 'temporal', temporalGranularity: 'month' });
  });

  it('classifies a small repeated integer column as ordinal (the previously-unreachable member)', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ rating: (i % 5) + 1 }));
    const [rating] = inferFieldProfile(rows);
    expect(rating).toMatchObject({ name: 'rating', type: 'ordinal', role: 'dimension' });
  });

  it('classifies a mixed numeric/text column as nominal, not quantitative', () => {
    const [code] = inferFieldProfile([{ code: 1 }, { code: 'N/A' }, { code: 3 }]);
    expect(code).toMatchObject({ name: 'code', type: 'nominal', role: 'dimension' });
  });
});

describe('inferFieldProfile — determinism (the moat)', () => {
  const MIXED = [
    { region: 'North', month: '2024-01', revenue: 120000, rating: 3, lat: 40.7, lon: -74.0 },
    { region: 'South', month: '2024-02', revenue: -135000, rating: 5, lat: 34.0, lon: -118.2 },
    { region: 'East', month: '2024-03', revenue: 0, rating: 1, lat: 41.8, lon: -87.6 },
    { region: 'North', month: '2024-04', revenue: 999999, rating: 2, lat: 29.7, lon: -95.3 },
    { region: 'West', month: '2024-05', revenue: 50000, rating: 4, lat: 47.6, lon: -122.3 },
  ];

  it('produces a byte-identical FieldProfile[] across repeated runs', () => {
    const runs = Array.from({ length: 5 }, () => JSON.stringify(inferFieldProfile(MIXED)));
    expect(new Set(runs).size).toBe(1);
  });

  it('detects geo roles, negativity and zero from real data', () => {
    const byName = Object.fromEntries(inferFieldProfile(MIXED).map((f) => [f.name, f]));
    expect(byName.lat.geoKind).toBe('lat');
    expect(byName.lon.geoKind).toBe('lon');
    expect(byName.region.geoKind).toBe('region');
    expect(byName.revenue).toMatchObject({ type: 'quantitative', hasNegative: true, hasZero: true });
    expect(byName.month).toMatchObject({ type: 'temporal', temporalGranularity: 'month', temporalRegular: true });
  });
});

describe('detectGeoFields — locale-independent tie-break (determinism)', () => {
  // Both columns match the SAME region token ('region') with equal occurrence, so
  // they tie on score AND priority and fall to the key tie-break — the path that
  // previously used host-locale localeCompare (a determinism hole). 'region_code'
  // sorts before 'sales_region' by UTF-16 code unit ('r' < 's'), so it is the
  // deterministic winner regardless of column or host locale.
  it('resolves a score+priority tie by code point, independent of column order', () => {
    const colsForward = [
      { region_code: 'A1', sales_region: 'North', value: 1 },
      { region_code: 'B2', sales_region: 'South', value: 2 },
    ];
    const colsReversed = [
      { sales_region: 'North', region_code: 'A1', value: 1 },
      { sales_region: 'South', region_code: 'B2', value: 2 },
    ];
    expect(detectGeoFields(colsForward).regionField).toBe('region_code');
    expect(detectGeoFields(colsReversed).regionField).toBe('region_code');
  });

  it('selects the same geo field across repeated runs', () => {
    const rows = [
      { region_code: 'A1', sales_region: 'North' },
      { region_code: 'B2', sales_region: 'South' },
    ];
    const runs = Array.from({ length: 5 }, () => detectGeoFields(rows).regionField);
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toBe('region_code');
  });

  it('resolves a locale-divergent (é/z) score+priority tie by code point, not ICU collation', () => {
    // The region_code/sales_region pair above CANNOT catch a regression back to
    // localeCompare: 'r' < 's' agrees in BOTH UTF-16 code-unit and ICU collation. These
    // keys DIVERGE — at index 7 they differ by 'z' (U+007A) vs the precomposed 'é'
    // (U+00E9). By code unit 0x7A < 0xE9, so compareKeys ranks 'region_zone' first
    // (deterministic, host-independent). Under a regression to ICU localeCompare, 'é'
    // collates BEFORE 'z', so 'region_éire' would win and these assertions would fail.
    // Field names are lowercased (normalizeFieldName), so the divergence MUST use a
    // DIACRITIC, not case; the 'é' sits in the NON-token suffix so both keys still split to
    // include the 'region' token (REGION_TOKENS) and reach the tie-break. DO NOT 'simplify'
    // these back to an ASCII pair — that silently re-opens the localeCompare blind spot (#410).
    const DIVERGENT = 'region_éire';
    // Fixture self-guard: the é MUST be PRECOMPOSED (U+00E9) so 0xE9 sits at the divergence
    // index. An NFD-normalised source ('e' + U+0301) would put 0x65 there and quietly invert
    // the contrast — fail loud if the file was re-encoded.
    expect(DIVERGENT.codePointAt(7)).toBe(0xe9);

    const colsForward = [
      { region_zone: 'A1', [DIVERGENT]: 'North', value: 1 },
      { region_zone: 'B2', [DIVERGENT]: 'South', value: 2 },
    ];
    const colsReversed = [
      { [DIVERGENT]: 'North', region_zone: 'A1', value: 1 },
      { [DIVERGENT]: 'South', region_zone: 'B2', value: 2 },
    ];
    expect(detectGeoFields(colsForward).regionField).toBe('region_zone');
    expect(detectGeoFields(colsReversed).regionField).toBe('region_zone');
  });
});

describe('toSchemaIntent — data-aware derivation (m02)', () => {
  // Irregular monthly axis: Jan, Feb, Sep, Dec — gaps of 1, 7, 3 months.
  const IRREGULAR = [
    { month: '2024-01', revenue: 100 },
    { month: '2024-02', revenue: 120 },
    { month: '2024-09', revenue: 90 },
    { month: '2024-12', revenue: 140 },
  ];

  it('gates trend on temporal REGULARITY — an irregular temporal axis is not a trend', () => {
    const profiles = inferFieldProfile(IRREGULAR);
    expect(profiles.find((f) => f.name === 'month')).toMatchObject({
      type: 'temporal',
      temporalRegular: false,
    });
    // count-only baseline rule (temporals>=1 -> trend) WOULD have fired here…
    expect(profiles.filter((f) => f.type === 'temporal').length).toBeGreaterThanOrEqual(1);
    // …but the data-aware derivation downgrades it to comparison.
    expect(toSchemaIntent(profiles, IRREGULAR).goal).toBe('comparison');
  });

  it('yields a different top recommendation than the count-only baseline (committed flip)', () => {
    const profiles = inferFieldProfile(IRREGULAR);
    // The pre-m02 count-only intent: any temporal field => trend goal, no
    // populated attribute fields.
    const countOnly: SchemaIntent = {
      measures: 1,
      dimensions: 0,
      temporals: 1,
      goal: 'trend',
      multiMetrics: false,
      requiresGrouping: false,
    };
    const baselineTop = suggestPatterns(countOnly, { limit: 1 })[0].pattern;
    const dataAwareTop = suggestPatterns(toSchemaIntent(profiles, IRREGULAR), { limit: 1 })[0].pattern;

    expect(baselineTop).toMatchObject({ id: 'running-total-area', chartType: 'area' });
    // FLIP: the data-aware pick is no longer the cumulative-trend area chart.
    expect(dataAwareTop.id).not.toBe(baselineTop.id);
    expect(dataAwareTop.chartType).toBe('line');
  });

  it('keeps trend for a REGULAR temporal axis (the gate does not over-fire)', () => {
    const regular = [
      { month: '2024-01', revenue: 100 },
      { month: '2024-02', revenue: 120 },
      { month: '2024-03', revenue: 90 },
      { month: '2024-04', revenue: 140 },
    ];
    expect(toSchemaIntent(inferFieldProfile(regular), regular).goal).toBe('trend');
  });

  it('populates allowNegative + density from the data and revives the diverging-bar score', () => {
    const negative = [
      { region: 'N', delta: -10 },
      { region: 'S', delta: 15 },
      { region: 'E', delta: -5 },
      { region: 'W', delta: 8 },
    ];
    const intent = toSchemaIntent(inferFieldProfile(negative), negative);
    expect(intent.allowNegative).toBe(true);
    expect(intent.density).toBe('sparse'); // 4 rows

    // The allowNegative field was DEAD on the rows path; populating it lifts the
    // pattern that actually supports negatives.
    const withNeg = suggestPatterns(intent, { limit: 20 }).find((s) => s.pattern.id === 'diverging-bar');
    const withoutNeg = suggestPatterns({ ...intent, allowNegative: false }, { limit: 20 }).find(
      (s) => s.pattern.id === 'diverging-bar',
    );
    expect(withNeg!.score).toBeGreaterThan(withoutNeg!.score);
  });

  it('carries correlationStrength and keeps relationship for a correlated two-measure pair', () => {
    const rows = [
      { x: 1, y: 2 },
      { x: 2, y: 4.1 },
      { x: 3, y: 5.9 },
      { x: 4, y: 8.2 },
      { x: 5, y: 9.8 },
    ];
    const intent = toSchemaIntent(inferFieldProfile(rows), rows);
    expect(intent.correlationStrength).toBeGreaterThan(0.9);
    expect(intent.goal).toBe('relationship');
  });

  it('preserves the count-only relationship call when rows are absent (additive, non-breaking)', () => {
    // No rows -> correlation unmeasurable -> the count-based relationship result
    // is preserved, so existing profile-only callers keep working.
    const intent = toSchemaIntent(
      inferFieldProfile([
        { responseMs: 120, conversion: 0.4 },
        { responseMs: 90, conversion: 0.6 },
      ]),
    );
    expect(intent).toMatchObject({ measures: 2, dimensions: 0, goal: 'relationship' });
  });
});

describe('suggestPatterns — deterministic total-order tie-break (m02)', () => {
  it('produces a byte-identical full ranking across N runs', () => {
    const intent: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      temporals: 1,
      goal: 'trend',
      requiresGrouping: true,
    };
    const runs = Array.from({ length: 5 }, () =>
      suggestPatterns(intent, { limit: 20 })
        .map((s) => `${s.pattern.id}:${s.score}`)
        .join('|'),
    );
    expect(new Set(runs).size).toBe(1);
  });

  it('resolves equal-score patterns to the lexicographically-lower pattern.id', () => {
    // measures1/dims2/temporals1/trend/requiresGrouping ties multi-series-line,
    // focus-context-line and sparkline-grid at the same score — the tie-break
    // must order them by ascending id (focus-context-line first).
    const intent: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      temporals: 1,
      goal: 'trend',
      requiresGrouping: true,
    };
    const ranked = suggestPatterns(intent, { limit: 20 });
    let sawTie = false;
    for (let i = 1; i < ranked.length; i += 1) {
      if (ranked[i].score === ranked[i - 1].score) {
        sawTie = true;
        expect(ranked[i - 1].pattern.id.localeCompare(ranked[i].pattern.id)).toBeLessThanOrEqual(0);
      }
    }
    expect(sawTie).toBe(true); // non-vacuous: a real tie was exercised
  });
});

describe('scorePattern — data-aware ranking terms (m03)', () => {
  // Deterministic dense generator: `catCount` distinct primary categories.
  const denseRows = (catCount: number) =>
    Array.from({ length: 240 }, (_, i) => ({
      category: `cat-${i % catCount}`,
      segment: `seg-${i % 3}`,
      revenue: (i * 7) % 1000,
    }));

  const STRONG = [
    { x: 1, y: 2 },
    { x: 2, y: 4.1 },
    { x: 3, y: 5.9 },
    { x: 4, y: 8.2 },
    { x: 5, y: 9.8 },
  ];
  const WEAK = [
    { x: 1, y: 5 },
    { x: 2, y: 1 },
    { x: 3, y: 9 },
    { x: 4, y: 2 },
    { x: 5, y: 7 },
  ];

  it('lifts correlation-scatter to the top for a strongly-correlated pair, with rationale on the top pick', () => {
    const intent = toSchemaIntent(inferFieldProfile(STRONG), STRONG);
    const ranked = suggestPatterns(intent, { limit: 20 });
    expect(ranked[0].pattern.id).toBe('correlation-scatter');
    // it now outranks the count-shape winner (cohort-scatter)…
    const linked = ranked.find((s) => s.pattern.id === 'cohort-scatter');
    expect(ranked[0].score).toBeGreaterThan(linked!.score);
    // …and its rationale explains why (the data-aware justification string).
    expect(ranked[0].signals.some((s) => /correlation/i.test(s))).toBe(true);
  });

  it('does NOT pick correlation-scatter for an uncorrelated pair (the gate + bonus are data-driven)', () => {
    const intent = toSchemaIntent(inferFieldProfile(WEAK), WEAK);
    const top = suggestPatterns(intent, { limit: 1 })[0];
    expect(top.pattern.id).not.toBe('correlation-scatter');
    expect(top.pattern.id).toBe('cohort-scatter');
  });

  it('demotes bars below a line/aggregate when a categorical dimension is high-cardinality', () => {
    const lowRanked = suggestPatterns(toSchemaIntent(inferFieldProfile(denseRows(4)), denseRows(4)), {
      limit: 20,
    });
    const highRows = denseRows(200);
    const highRanked = suggestPatterns(toSchemaIntent(inferFieldProfile(highRows), highRows), { limit: 20 });

    // Low cardinality → grouped-bar is the canonical top pick.
    expect(lowRanked[0].pattern.id).toBe('grouped-bar');
    // High cardinality (200 categories) → bars are penalised below a line; the
    // top pick is no longer a bar, and grouped-bar has fallen in the ranking.
    expect(highRanked[0].pattern.chartType).toBe('line');
    const groupedHigh = highRanked.findIndex((s) => s.pattern.id === 'grouped-bar');
    expect(groupedHigh).toBeGreaterThan(0);
    // Rationale is present in the ranking: grouped-bar carries the overflow signal.
    expect(highRanked[groupedHigh].signals.some((s) => /cardinality/i.test(s))).toBe(true);
  });

  it('is deterministic on the data-aware fixtures (N-run identical full ranking)', () => {
    const highRows = denseRows(200);
    const intent = toSchemaIntent(inferFieldProfile(highRows), highRows);
    const runs = Array.from({ length: 5 }, () =>
      suggestPatterns(intent, { limit: 20 })
        .map((s) => `${s.pattern.id}:${s.score}`)
        .join('|'),
    );
    expect(new Set(runs).size).toBe(1);
  });

  it('leaves patterns without a cardinality cap unpenalised (additive — unset heuristics are no-ops)', () => {
    const intent: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      temporals: 1,
      goal: 'trend',
      requiresGrouping: true,
      maxNominalCardinality: 9999,
    };
    const ml = suggestPatterns(intent, { limit: 20 }).find((s) => s.pattern.id === 'multi-series-line');
    expect(ml!.signals.every((s) => !/cardinality/i.test(s))).toBe(true);
  });

  it('flags a low-confidence suggestion instead of silently returning bar', () => {
    // The uncorrelated 2-measure pair's best match barely clears the floor.
    const result = buildVizSpecFromRows({ rows: WEAK });
    expect(result.lowConfidence).toBe(true);
    // The rationale is carried on the result for the agent surface (m04).
    expect(result.suggestion?.signals.length).toBeGreaterThan(0);
  });

  it('does not flag low-confidence for a clean count-shape match', () => {
    expect(buildVizSpecFromRows({ rows: SALES }).lowConfidence).toBe(false);
  });
});

describe('correlation — single Pearson implementation', () => {
  it('profiler fieldCorrelation and the a11y narrator agree (no second Pearson impl)', () => {
    const rows = [
      { x: 1, y: 2 },
      { x: 2, y: 4.1 },
      { x: 3, y: 5.9 },
      { x: 4, y: 8.2 },
      { x: 5, y: 9.8 },
    ];
    const { spec } = buildVizSpecFromRows({ rows, chartType: 'scatter', encodings: { x: 'x', y: 'y' } });
    const narratorCorrelation = analyzeVizSpec(spec).correlation;
    // Both surfaces route through analysis/stats.pearson, so the values are equal
    // to the bit — the proof that there is exactly one correlation implementation.
    expect(narratorCorrelation).toBe(fieldCorrelation(rows, 'x', 'y'));
    expect(narratorCorrelation).toBeGreaterThan(0.9);
  });
});

describe('recommender + inference honesty (sprint-118 m04)', () => {
  it('a measure-named low-cardinality integer column types quantitative, not ordinal', () => {
    // Shape alone trips rule (4): all-integer, present 20 >= 8, distinct 4 <= 12, ratio 0.2.
    // 'qty' is in the conservative measure token set, so nameHintsMeasure rescues it.
    const rows = Array.from({ length: 20 }, (_, i) => ({ shipment_qty: (i % 4) + 1 }));
    const [qty] = inferFieldProfile(rows);
    expect(qty).toMatchObject({ name: 'shipment_qty', type: 'quantitative', role: 'measure' });
  });

  it("a non-measure-named low-cardinality integer column ('count') still types ordinal", () => {
    // 'count' is DELIBERATELY excluded from the token set (a legitimate ordinal scale).
    const rows = Array.from({ length: 20 }, (_, i) => ({ count: (i % 4) + 1 }));
    const [count] = inferFieldProfile(rows);
    expect(count).toMatchObject({ name: 'count', type: 'ordinal', role: 'dimension' });
  });

  it('geo-coordinate (lat/lon) flat rows flag lowConfidence + a geo rationale', () => {
    const rows = [
      { city: 'A', lat: 40, lon: -74, pop: 800 },
      { city: 'B', lat: 34, lon: -118, pop: 600 },
      { city: 'C', lat: 41, lon: -87, pop: 500 },
      { city: 'D', lat: 29, lon: -95, pop: 400 },
    ];
    const result = buildVizSpecFromRows({ rows });
    expect(result.lowConfidence).toBe(true);
    expect((result.suggestion?.signals ?? []).some((s) => /choropleth|bubble_map/.test(s))).toBe(true);
  });

  it("a bare 'region' categorical (no coordinates) does NOT flag geo lowConfidence", () => {
    // region is a common categorical dimension, not map intent — geoShaped gates on lat/lon
    // ONLY, so a clean region+measure count-shape stays a confident recommendation.
    const rows = [
      { region: 'North', revenue: 120 },
      { region: 'South', revenue: 135 },
      { region: 'East', revenue: 128 },
      { region: 'West', revenue: 142 },
    ];
    expect(buildVizSpecFromRows({ rows }).lowConfidence).toBe(false);
  });
});

describe('buildFromIntent — structured-intent mode (sprint-131 m02)', () => {
  // SALES fields: region (nominal), quarter (temporal YYYY-MM), revenue (quantitative).
  // A two-measure fixture for the relationship/scatter case (responseMs + conversion).
  const CORR = [
    { responseMs: 120, conversion: 0.4, region: 'North' },
    { responseMs: 90, conversion: 0.62, region: 'South' },
    { responseMs: 75, conversion: 0.71, region: 'East' },
    { responseMs: 60, conversion: 0.85, region: 'West' },
  ];

  it('builds a recommender-chosen, data-bound spec under a structured intent', () => {
    const result = buildFromIntent({
      intent: { goal: 'comparison', measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }] },
      rows: SALES,
    });
    expect(result.mode).toBe('intent');
    expect(['bar', 'line', 'area', 'scatter', 'heatmap']).toContain(result.chartType);
    expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
    // The NAMED fields drive encoding — x + y both present (Amendment C: no x/y throw).
    expect(result.spec.encoding.x?.field).toBeTruthy();
    expect(result.spec.encoding.y?.field).toBe('revenue');
    // inferredFields is the SELECTED named subset (2), not all 3 row fields.
    expect(result.inferredFields).toHaveLength(2);
    expect(result.spec.data.values).toHaveLength(4);
    expect(() => toVegaLiteSpec(result.spec)).not.toThrow();
  });

  it('is deterministic — identical {intent, rows} yield a byte-identical spec', () => {
    const intent = { goal: 'trend' as const, measures: [{ name: 'revenue' }], dimensions: [{ name: 'quarter' }] };
    const a = buildFromIntent({ intent, rows: SALES });
    const b = buildFromIntent({ intent, rows: SALES });
    expect(JSON.stringify(b.spec)).toEqual(JSON.stringify(a.spec));
    expect(b.chartType).toBe(a.chartType);
  });

  // THE INVARIANT (Amendment C): deriving the SchemaIntent counts from the SELECTED named
  // profiles keeps the recommender pick consistent with what autoAssignEncodings can encode,
  // so a count-driven goal with 1 measure + 1 dimension never picks a 2-measure scatter that
  // would throw — it resolves to a real bar/line/area instead.
  it.each(['comparison', 'trend', 'composition', 'intensity', 'part-to-whole'] as const)(
    'count-driven goal=%s with 1 measure + 1 dimension stays encodeable (no x/y throw)',
    (goal) => {
      const result = buildFromIntent({
        intent: { goal, measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }] },
        rows: SALES,
      });
      expect(result.mode).toBe('intent');
      expect(result.spec.encoding.x?.field).toBeTruthy();
      expect(result.spec.encoding.y?.field).toBe('revenue');
      expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
    },
  );

  // FAIL-LOUD (Rule 12 / the "deterministic tool validates the intent" half of NL→viz): a
  // scatter-home goal (relationship/distribution) with a single measure resolves to a scatter
  // that genuinely needs two — so it is REJECTED with an actionable message, never silently
  // degraded to a comparison bar.
  it.each(['relationship', 'distribution'] as const)(
    'scatter-home goal=%s with only 1 measure fails loud (an incoherent intent is rejected)',
    (goal) => {
      expect(() =>
        buildFromIntent({
          intent: { goal, measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }] },
          rows: SALES,
        }),
      ).toThrow(/needs more fields than were named/);
    },
  );

  it('renders a genuine 2-measure relationship as a scatter (the invariant when fields suffice)', () => {
    const result = buildFromIntent({
      intent: { goal: 'relationship', measures: [{ name: 'responseMs' }, { name: 'conversion' }], dimensions: [] },
      rows: CORR,
    });
    expect(result.chartType).toBe('scatter');
    expect(result.spec.encoding.x?.field).toBe('responseMs');
    expect(result.spec.encoding.y?.field).toBe('conversion');
    expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
  });

  it('POST-FILTERS the ranking by chartFamily — returns the requested tabular family', () => {
    const base = { goal: 'trend' as const, measures: [{ name: 'revenue' }], dimensions: [{ name: 'quarter' }] };
    // Two different requested families over the SAME data prove the post-filter selects within
    // the ranking rather than echoing one recommender pick.
    expect(buildFromIntent({ intent: { ...base, chartFamily: 'bar' }, rows: SALES }).chartType).toBe('bar');
    expect(buildFromIntent({ intent: { ...base, chartFamily: 'area' }, rows: SALES }).chartType).toBe('area');
  });

  it('flags lowConfidence when the requested family is not the recommender top pick', () => {
    // trend data ranks an area pattern top; a bar is honoured but flagged low-confidence.
    const bar = buildFromIntent({
      intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'quarter' }], chartFamily: 'bar' },
      rows: SALES,
    });
    expect(bar.chartType).toBe('bar');
    expect(bar.lowConfidence).toBe(true);
  });

  it('fails loud when a requested family needs more fields than were named (scatter, 1 measure)', () => {
    expect(() =>
      buildFromIntent({
        intent: { goal: 'comparison', measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }], chartFamily: 'scatter' },
        rows: SALES,
      }),
    ).toThrow(/needs more fields than were named/);
  });

  it('fails loud when a named field is absent from the rows (names the missing field)', () => {
    expect(() =>
      buildFromIntent({
        intent: { goal: 'comparison', measures: [{ name: 'profit' }], dimensions: [{ name: 'region' }] },
        rows: SALES,
      }),
    ).toThrow(/profit/);
  });

  it('requires a non-empty rows array (v0.1 — Amendment B)', () => {
    expect(() =>
      buildFromIntent({
        intent: { goal: 'comparison', measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }] },
        rows: [],
      }),
    ).toThrow(/non-empty rows/);
  });

  it('rejects an explicit-only chartFamily (defense-in-depth — Amendment E)', () => {
    expect(() =>
      buildFromIntent({
        intent: {
          goal: 'part-to-whole',
          measures: [{ name: 'revenue' }],
          dimensions: [{ name: 'region' }],
          // simulate an out-of-contract runtime value that the schema would also reject
          chartFamily: 'treemap' as unknown as IntentChartFamily,
        },
        rows: SALES,
      }),
    ).toThrow(/not a tabular mark/);
  });

  it('is measure-agnostic — measureRef does NOT change the spec (viz.render owns the narrative overlay)', () => {
    const withRef = buildFromIntent({
      intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'quarter' }], measureRef: 'gm.revenue.total' },
      rows: SALES,
    });
    const without = buildFromIntent({
      intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'quarter' }] },
      rows: SALES,
    });
    expect(JSON.stringify(withRef.spec)).toEqual(JSON.stringify(without.spec));
    expect(withRef.chartType).toBe(without.chartType);
  });
});

// Item #15 (sprint-151 m04): the registry had NO plain 1-measure/1-dimension bar, so an
// all-positive comparison fell to `diverging-bar` — which then carries its own
// self-contradictory "needs positive AND negative values, but the data is all-positive"
// signal (evaluateDivergingFit) at score 10.4. Approach A adds a plain `bar` pattern that
// wins the all-positive case cleanly (13.4) WITHOUT reviving negatives, while the signed
// case keeps electing diverging-bar (17.4 > 14.4) so the s110 diverging-revival is intact.
describe('suggestPatterns — plain bar for 1M/1D all-positive comparison (s151 m04)', () => {
  const ALL_POSITIVE_1M1D = [
    { department: 'Engineering', headcount: 45 },
    { department: 'Sales', headcount: 30 },
    { department: 'Marketing', headcount: 18 },
    { department: 'Support', headcount: 22 },
  ];

  it('elects the plain bar (not diverging-bar) with clean signals + confidence (fails at HEAD: returns diverging-bar 10.4)', () => {
    const result = buildVizSpecFromRows({ rows: ALL_POSITIVE_1M1D });

    expect(result.suggestion?.patternId).toBe('simple-bar');
    expect(result.chartType).toBe('bar');
    expect(result.lowConfidence).toBe(false);
    // The elected pattern must NOT carry the diverging-on-positive contradiction.
    expect(result.suggestion?.signals.some((s) => /positive AND negative/.test(s))).toBe(false);
  });

  it('preserves the s110 diverging-revival: a SIGNED 1M/1D still elects diverging-bar (17.4 > 14.4)', () => {
    const signed = [
      { region: 'N', delta: -10 },
      { region: 'S', delta: 15 },
      { region: 'E', delta: -5 },
      { region: 'W', delta: 8 },
    ];
    const intent = toSchemaIntent(inferFieldProfile(signed), signed);
    const ranked = suggestPatterns(intent, { limit: 20 });
    const bar = ranked.find((s) => s.pattern.id === 'simple-bar');
    const diverging = ranked.find((s) => s.pattern.id === 'diverging-bar');
    expect(diverging!.score).toBeGreaterThan(bar!.score);
    expect(ranked[0].pattern.id).toBe('diverging-bar');
  });

  it('DEFERS to the specialised scatter on a tie: a scatter-home goal with 1 measure still fails loud (not silently a bar)', () => {
    // Regression guard for the s151 m04 misprediction: `simple-bar` ties `correlation-scatter`
    // at 5.4 for a relationship/1M-1D intent. Because `simple-bar` sorts AFTER the scatter in
    // the id tie-break, the scatter stays the chosen chartType, so buildFromIntent fails loud
    // on the missing 2nd measure — the incoherent intent is NOT degraded to a comparison bar.
    expect(() =>
      buildFromIntent({
        intent: { goal: 'relationship', measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }] },
        rows: SALES,
      }),
    ).toThrow(/needs more fields than were named/);
  });
});

// s152 F4 — diverging-bar cardinality cap (Option 1: honest-fail lowConfidence). diverging-bar
// was the ONLY bar pattern without a maxSeriesCardinality, so at >12 categories it escaped the
// CARDINALITY_OVERFLOW_PENALTY every other bar takes and out-ranked simple-bar as the CONFIDENT
// pick — carrying the self-contradictory "needs positive AND negative" signal on all-positive
// data (the slice #15 did not close). The one-line cap (maxSeriesCardinality:12) demotes it.
describe('s152 F4 — diverging-bar cardinality cap', () => {
  const CATS = 'ABCDEFGHIJKLMNO'.split(''); // 15 categories (>12)
  const allPositive = (n: number) => CATS.slice(0, n).map((c, i) => ({ category: c, value: 10 + i * 3 }));
  const signed = (n: number) => CATS.slice(0, n).map((c, i) => ({ category: c, delta: i % 2 === 0 ? 10 + i : -(5 + i) }));
  const rank = (rows: Record<string, unknown>[]) => suggestPatterns(toSchemaIntent(inferFieldProfile(rows), rows), { limit: 20 });
  const scoreOf = (rows: Record<string, unknown>[], id: string) => rank(rows).find((s) => s.pattern.id === id)?.score;

  // (a) CORRECTNESS (honest-fail): a >12-cat all-positive comparison demotes diverging-bar below
  //     simple-bar and returns a lowConfidence top with NO "positive AND negative" contradiction.
  //     Do NOT assert patternId==='simple-bar' — under Option 1 the honest top is layered-line-area.
  it('(a) >12-cat all-positive demotes diverging-bar below simple-bar and flags lowConfidence (RED at HEAD)', () => {
    const rows = allPositive(15);
    const diverging = scoreOf(rows, 'diverging-bar');
    const simpleBar = scoreOf(rows, 'simple-bar');
    expect(diverging).toBeLessThan(simpleBar as number); // 2.4 < 5.4 (was 10.4 > 5.4 at HEAD)

    const built = buildVizSpecFromRows({ rows } as never);
    expect(built.lowConfidence).toBe(true); // honestly "no confident pick"

    const top = rank(rows)[0];
    expect(top.pattern.id).not.toBe('diverging-bar'); // the confidently-wrong pick is gone
    expect(top.signals.some((s) => /positive AND negative/i.test(s))).toBe(false);
  });

  // (b) LOAD-BEARING REGRESSION: a >12-cat SIGNED comparison must STILL elect diverging-bar. This
  //     was SPARSE (15 rows), where diverging-bar's density:'sparse' +2 match masked the s152 cap
  //     so it stayed green vacuously — the s153-F4 dense tests below cover the regime that actually
  //     regressed. After the s153-F4 signed gate the cap no longer bites signed data at all, so the
  //     score rises from the s152 9.4 to 17.4 (> 6.4 simple-bar).
  it('(b) >12-cat SIGNED comparison STILL elects diverging-bar (load-bearing; diverging > simple-bar)', () => {
    const rows = signed(15);
    const ranked = rank(rows);
    expect(ranked[0].pattern.id).toBe('diverging-bar');
    expect(scoreOf(rows, 'diverging-bar')).toBeGreaterThan(scoreOf(rows, 'simple-bar') as number); // 17.4 > 6.4
  });

  // (c) BOUNDARY: the cap engages strictly at 13+ — at exactly 12 categories it does not fire, so
  //     all-positive→simple-bar and signed→diverging-bar both hold as before the cap.
  it('(c) at exactly 12 categories the cap does not fire (all-positive→simple-bar, signed→diverging-bar)', () => {
    expect(rank(allPositive(12))[0].pattern.id).toBe('simple-bar');
    expect(rank(signed(12))[0].pattern.id).toBe('diverging-bar');
    // 13 = first cardinality that trips the cap: diverging-bar demoted below simple-bar.
    expect(scoreOf(allPositive(13), 'diverging-bar')).toBeLessThan(scoreOf(allPositive(13), 'simple-bar') as number);
  });

  // (d) DETERMINISM: the full ranking is byte-identical across N runs (pure scorer, no cap-induced tie).
  it('(d) the >12-cat all-positive full ranking is byte-identical across runs', () => {
    const rows = allPositive(15);
    const serialize = () => rank(rows).map((s) => `${s.pattern.id}:${s.score}`).join('|');
    const first = serialize();
    for (let i = 0; i < 5; i += 1) {
      expect(serialize()).toBe(first);
    }
  });

  // s153 F4 — the DENSE regime the s152 tests missed. At ≥200 rows the density signal is 'dense',
  // so diverging-bar loses the sparse +2 that had masked the s152 cap: the -8 CARDINALITY_OVERFLOW
  // penalty then sank a genuinely SIGNED >12-cat comparison below the CAPLESS layered-line-area,
  // flipping the confident pick and breaking "signed still elects diverging-bar". The signed gate
  // in evaluateCardinality (cap bites all-positive only) restores it. ≥200 rows → dense; a signed
  // delta series → allowNegative:true; a repeated string category → the nominal dimension cardinality.
  const DENSE = 210; // > DENSITY_DENSE_ROW_COUNT (200)
  const denseSigned = (cats: number, total = DENSE) =>
    Array.from({ length: total }, (_, i) => ({
      category: CATS[i % cats],
      delta: i % 2 === 0 ? 10 + (i % cats) : -(5 + (i % cats)),
    }));
  const denseAllPositive = (cats: number, total = DENSE) =>
    Array.from({ length: total }, (_, i) => ({ category: CATS[i % cats], value: 10 + (i % cats) * 3 }));

  // (e) THE REGRESSION: a DENSE (≥200-row) SIGNED >12-cat comparison elects diverging-bar again
  //     (RED at HEAD → the capless layered-line-area stole the confident pick).
  it('(e) dense >12-cat SIGNED comparison elects diverging-bar (RED at HEAD → layered-line-area)', () => {
    const intent = toSchemaIntent(inferFieldProfile(denseSigned(13)), denseSigned(13));
    expect(intent.density).toBe('dense');
    expect(intent.allowNegative).toBe(true);
    expect(rank(denseSigned(13))[0].pattern.id).toBe('diverging-bar');
    expect(rank(denseSigned(15))[0].pattern.id).toBe('diverging-bar');
  });

  // (f) THE SPECIFIC FLIP: diverging-bar must outscore the CAPLESS layered-line-area that stole the
  //     pick — the exact rival the s152 cap handed the win to on dense signed data.
  it('(f) dense >12-cat SIGNED: diverging-bar outscores the capless layered-line-area', () => {
    const rows = denseSigned(13);
    expect(scoreOf(rows, 'diverging-bar') as number).toBeGreaterThan(scoreOf(rows, 'layered-line-area') as number);
  });

  // (g) SCOPE PROOF: the gate is signed-only — a DENSE ALL-POSITIVE >12-cat comparison must STILL
  //     demote diverging-bar below simple-bar (the honest-fail is preserved in the dense regime too,
  //     where evaluateDivergingFit still flags the "positive AND negative" contradiction).
  it('(g) dense >12-cat ALL-POSITIVE still demotes diverging-bar (signed-only gate; honest-fail kept)', () => {
    const rows = denseAllPositive(13);
    expect(toSchemaIntent(inferFieldProfile(rows), rows).allowNegative).toBe(false);
    expect(scoreOf(rows, 'diverging-bar') ?? -Infinity).toBeLessThan(scoreOf(rows, 'simple-bar') as number);
    expect(rank(rows)[0].pattern.id).not.toBe('diverging-bar');
  });
});

// s154 F4 — the MID-density cell (31–199 rows, density undefined) that s152 (sparse) and s153
// (dense) both skipped. The s152 review proved the ungated cap's flip regime was NOT "non-dense":
// live margins for a signed >12-cat comparison were sparse +1.4 (HELD), mid -0.6 (FLIPPED), dense
// -1.6 (FLIPPED) — so the cap held ONLY in the sparse regime. With the s153 signed gate the cap no
// longer bites signed data at any density; this pins the previously-unenumerated mid cell and makes
// the corrected registry comment executable (Rule 9).
describe('s154 F4 — diverging-bar mid-density + off-shape scope', () => {
  const CATS = 'ABCDEFGHIJKLMNO'.split(''); // 15 categories (>12)
  const rank = (rows: Record<string, unknown>[]) => suggestPatterns(toSchemaIntent(inferFieldProfile(rows), rows), { limit: 20 });
  const scoreOf = (rows: Record<string, unknown>[], id: string) => rank(rows).find((s) => s.pattern.id === id)?.score;
  const MID = 100; // 31 ≤ MID ≤ 199 → density undefined (mid)

  // 1 measure + 1 dimension, signed, >12 categories — diverging-bar's own count-shape.
  const midSigned = (cats = 15, total = MID) =>
    Array.from({ length: total }, (_, i) => ({
      category: CATS[i % cats],
      delta: i % 2 === 0 ? 10 + (i % cats) : -(5 + (i % cats)),
    }));

  it('(mid) a >12-cat SIGNED comparison elects diverging-bar in the mid regime (density undefined)', () => {
    const rows = midSigned();
    const intent = toSchemaIntent(inferFieldProfile(rows), rows);
    expect(intent.density).toBeUndefined(); // mid — neither sparse (≤30) nor dense (≥200)
    expect(intent.allowNegative).toBe(true);
    expect(rank(rows)[0].pattern.id).toBe('diverging-bar');
    expect(scoreOf(rows, 'diverging-bar') as number).toBeGreaterThan(scoreOf(rows, 'layered-line-area') as number);
  });

  // Off-shape guards: outside diverging-bar's count-shape (measures 1, dimensions 1-2) a signed
  // >12-cat comparison never elects it — the count mismatch is gate-INDEPENDENT.
  // s170 m04 (#951): a `DIMS3` constant and an `expect(DIMS3).toHaveLength(3)` assertion lived
  // here to "document the 1M/3D shape under test". The constant was referenced by nothing else
  // and the assertion could not fail for any change to the code under test — it asserted a
  // literal against itself. The three dimension fields the test actually exercises are the ones
  // `midSigned3Dim` builds below (region / segment / channel); that is where the shape is
  // documented, by being used.
  const REGIONS = CATS; // 15 nominal categories on the primary dimension
  const SEGMENTS = ['Ent', 'Mid', 'SMB', 'Gov', 'Edu'];
  const CHANNELS = ['Web', 'App', 'Field', 'Partner'];
  const midSigned3Dim = (total = MID) =>
    Array.from({ length: total }, (_, i) => ({
      region: REGIONS[i % 15],
      segment: SEGMENTS[i % SEGMENTS.length],
      channel: CHANNELS[i % CHANNELS.length],
      delta: i % 2 === 0 ? 10 + (i % 15) : -(5 + (i % 15)),
    }));
  const midSigned2Meas = (total = MID) =>
    Array.from({ length: total }, (_, i) => ({
      category: CATS[i % 15],
      delta: i % 2 === 0 ? 10 + (i % 15) : -(5 + (i % 15)),
      magnitude: 100 + (i % 15) * 7,
    }));

  it('(off-shape) 1M/3D routes to facet-small-multiples-line, 2M/1D to cohort-scatter — NOT diverging-bar', () => {
    expect(rank(midSigned3Dim())[0].pattern.id).toBe('facet-small-multiples-line');
    expect(rank(midSigned2Meas())[0].pattern.id).toBe('cohort-scatter');
  });
});
