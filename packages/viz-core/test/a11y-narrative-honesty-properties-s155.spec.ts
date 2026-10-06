import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  analyzeVizSpec,
  buildVizSpecFromRows,
  generateNarrativeSummary,
  type NormalizedVizSpec,
} from '@oods/viz-core';

// ============================================================================
// Sprint-155 m02 — the a11y-narrative-honesty PROPERTY HARNESS (the class-closure
// proof, SSOT memo §3 m02). RED-FIRST: at HEAD (before m03/m04) these properties
// FAIL for the phantom-trend and false-Total classes; m03 (Trend single-series
// gate) and m04 (Total additive-name gate) turn them GREEN across the WHOLE
// enumerated space. m05 (adversarial-verify closure) added properties (iv)-(vi):
// declared-aggregate authority, grouping-undercount (null-color / detail), and
// natural-order sort-by-X — closing the surfaces the m02 enumeration had missed.
//
// THE INVARIANT (memo §2, CLAIM-ON-POSITIVE-EVIDENCE): a narrative may assert an
// interpretive claim (a directional Trend, an additive Total) only when the claim's
// precondition is POSITIVELY provable from the spec's declared structure. This
// harness proves the invariant holds for the whole CLASS, not one cell — the exit
// from the s150→s154 "enumerate one more surface" treadmill.
//
// ANTI-TAUTOLOGY (memo §3 m02): the two oracles — expectedSeriesCount and
// isProvablyAdditive — are STANDALONE test-side functions that read spec structure
// and a static allowlist. They NEVER call analyzeVizSpec / the name-hint helpers /
// any code under test, so a property passing is independent evidence that the
// runtime matches the spec, not the runtime agreeing with itself.
//
// NO NEW DEPENDENCY (frozen-lockfile; fast-check is NOT installed): the generators
// are hand-rolled DETERMINISTIC cartesian enumeration — exhaustive over a finite
// bounded space beats seeded fuzz for a closure proof, and stays inside the
// viz-core CI lane time budget.
// ============================================================================

// ----------------------------------------------------------------------------
// Test-side helpers (independent of the SUT). humanize is a pure formatter mirror
// of a11y/format.ts (NOT re-exported on the public barrel) — used only to build
// EXPECTED label strings, never to decide a claim.
// ----------------------------------------------------------------------------
function humanize(value: string): string {
  const s = value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function specRows(spec: NormalizedVizSpec): Record<string, unknown>[] {
  const v = (spec as { data?: { values?: unknown } }).data?.values;
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function distinctCount(rows: readonly Record<string, unknown>[], field: string): number {
  const s = new Set<string>();
  for (const r of rows) {
    const val = r[field];
    if (val !== null && val !== undefined) s.add(String(val));
  }
  return s.size;
}

// s155 m05: distinct GROUP count counting null/undefined as its OWN bucket (a null-labelled
// reference series is a distinct series) — mirrors the fixed distinctGroupCount.
function distinctGroupCount(rows: readonly Record<string, unknown>[], field: string): number {
  const s = new Set<string>();
  for (const r of rows) {
    const val = r[field];
    s.add(val === null || val === undefined ? ' null' : String(val));
  }
  return s.size;
}

// The color/detail grouping fields the spec declares (top-level encoding first, then the first
// mark's encodings) — the same STRUCTURAL read the fail-safe keys on, implemented independently
// (spec-structure only, no analyzer call). s155 m05: BOTH color and detail (not one), so a
// detail-grouped multi-series shadowed by a constant color is caught.
function resolveGroupingField(spec: NormalizedVizSpec, channel: 'color' | 'detail' | 'size'): string | undefined {
  const enc = (spec as { encoding?: Record<string, Record<string, { field?: string }>> }).encoding ?? {};
  if (enc[channel]?.field) return enc[channel]?.field;
  const marks = (spec as { marks?: { encodings?: Record<string, { field?: string }> }[] }).marks ?? [];
  for (const m of marks) {
    const f = m.encodings?.[channel]?.field;
    if (f) return f;
  }
  return undefined;
}

// s157 m05 (A1): size joins color+detail — a size channel on a nominal field facets a line into
// multiple series, so it suppresses a first→last phantom trend. shape is NOT consulted (it draws
// one path + a symbol overlay, the dup-X residual). Mirrors the fixed runtime seriesGroupingFields.
function seriesGroupingFields(spec: NormalizedVizSpec): string[] {
  return [
    resolveGroupingField(spec, 'color'),
    resolveGroupingField(spec, 'detail'),
    resolveGroupingField(spec, 'size'),
  ].filter((f): f is string => Boolean(f));
}

// ORACLE 1 — expectedSeriesCount(spec): how many ordered series the spec's DECLARED
// structure proves it carries. > 1 ⇒ a first→last "Trend" is a cross-series phantom.
//   - LayoutFacet → product of distinct facet-key (rows/columns.field) values.
//   - else the MAX distinct GROUP count across the color AND detail grouping fields (null-bucketed).
//   - else 1 (provably single series).
// NOTE ON CONCAT (memo §3 m03): a LayoutConcat's series-multiplicity is folded VIA its
// color arm (focus-context-line carries color=region, 3 distinct), NOT via sections.length
// — a real single-series concat (0/1-distinct color) is genuinely single and keeps its
// trend. The memo's "LayoutConcat→sections.length" sketch is superseded by the ratified
// m03 mechanism; this oracle encodes the ratified contract so it stays GREEN after m03.
function expectedSeriesCount(spec: NormalizedVizSpec): number {
  const rows = specRows(spec);
  const layout = (spec as { layout?: { trait?: string; rows?: { field?: string }; columns?: { field?: string } } })
    .layout;
  if (layout?.trait === 'LayoutFacet') {
    const keys = [layout.rows?.field, layout.columns?.field].filter((f): f is string => Boolean(f));
    if (keys.length === 0) return 1;
    return keys.reduce((prod, f) => prod * Math.max(1, distinctCount(rows, f)), 1);
  }
  const groups = seriesGroupingFields(spec).map((f) => distinctGroupCount(rows, f));
  const maxGroups = groups.length > 0 ? Math.max(...groups) : 1;
  return maxGroups > 1 ? maxGroups : 1;
}

// ORACLE 2 — DE-MIRRORED (s157 m06 / V2b, from the s155 NOT_GENUINE review PS-2026-07-21-004).
// The prior oracle was a BYTE-IDENTICAL COPY of the runtime isProvablyAdditive (an ADDITIVE_HEAD
// allowlist + a qualifier set + the SAME token algorithm), so property (ii)/(iii) proved
// runtime == copy (drift detection) — NOT honesty. It was BLIND to any bug shared by both:
// `distinct_count` has the additive head 'count' and no 'distinct' qualifier existed in EITHER set,
// so it passed the runtime AND the copy and the harness stayed GREEN on the dishonest "Total
// Distinct count: 6,006". REPLACED with an INDEPENDENT hand-authored truth: a fixed PRESENT/ABSENT
// verdict per name, decided by reading the ratified CONTRACT'S INTENT (summing this measure is
// meaningful ⇔ its HEAD noun is an additive level AND no qualifier makes it a rate / average /
// share / cumulative / EXTREMUM / DISTINCT-cardinality), NOT by re-running the runtime predicate.
// A runtime bug now surfaces as a runtime-vs-map DISAGREEMENT — the A5 de-mirror proof a byte copy
// could never give. Every name in NAME_BANK / NAMES_III MUST appear here (asserted below).
const EXPECTED_TOTAL_PRESENT: Readonly<Record<string, boolean>> = {
  // plain measures — additive levels; 'price' is per-unit (summing is meaningless), deliberately
  // excluded by the ratified floor (documented less-rich: silence, never a false sum).
  revenue: true, sales: true, amount: true, quantity: true, price: false,
  // id / zip / compound edges — the HEAD noun decides: an id/zip head is never additive, but a
  // measure head with an id qualifier (postal_revenue, id_sales) legitimately escapes.
  sales_id: false, store_id: false, id_count: true, id_max: false, id_median: false,
  zip: false, postal_revenue: true, sku_price: false, lines_of_code: false,
  // bidirectional head-position pairs.
  total_revenue: true, revenue_total: true, count_id: false, id_sales: true, revenue_per_id: false,
  // aggregate / rate / cumulative QUALIFIERS over an additive head → NOT additive.
  avg_revenue: false, average_sales: false, mean_cost: false, median_sales: false,
  unit_cost: false, unit_price: false, running_total: false, cumulative_revenue: false,
  percent_of_total: false, ytd_total: false, sales_rate: false, revenue_per_unit: false,
  max_revenue: false, weighted_sales: false, sales_index: false,
  // neutral domain qualifiers must NOT suppress a genuine additive.
  net_revenue: true, gross_sales: true, daily_sales: true, monthly_revenue: true,
  // s157 m06 (V2): distinct/unique CARDINALITY qualifiers over an additive head → NOT additive
  // (the live "Total Distinct count" bug). Each pairs the token with an additive head so the map
  // proves the QUALIFIER — not the head — withholds the Total.
  distinct_count: false, unique_count: false, uniq_sales: false, nunique_total: false,
  cardinality_count: false, distinctcount_amount: false,
  // property (iii) NAMES_III coverage (revenue/sales_id already above); id_count/zip above.
};

// ----------------------------------------------------------------------------
// Narrative claim detectors (read the RENDERED narrative, assert the LABEL string).
// ----------------------------------------------------------------------------
const DIRECTIONAL_SUMMARY = /\brises\b|\bdeclines\b|remains relatively flat/i;

function trendClaimFindings(n: { keyFindings: readonly string[] }): string[] {
  return n.keyFindings.filter((f) => /^Trend /.test(f));
}

function totalClaimFinding(n: { keyFindings: readonly string[] }): string | undefined {
  return n.keyFindings.find((f) => /^Total /.test(f));
}

// ----------------------------------------------------------------------------
// Deterministic spec generator. Builds a NormalizedVizSpec DIRECTLY (the generated
// path — no authored a11y.narrative, so generateNarrativeSummary derives from the
// analysis) so layout / color-multiplicity / measure-name are all independently
// controllable (buildVizSpecFromRows cannot emit a facet/concat/layer layout).
// ----------------------------------------------------------------------------
type Mark = 'bar' | 'line' | 'area' | 'point' | 'rect';
const MARK_TRAIT: Record<Mark, string> = {
  bar: 'MarkBar', line: 'MarkLine', area: 'MarkArea', point: 'MarkPoint', rect: 'MarkRect',
};
type Layout = 'none' | 'facet' | 'concat' | 'layer';

interface CellOpts {
  mark: Mark;
  layout: Layout;
  /** distinct color/group values; 0 = no color field (a bare single series). */
  colorCard: number;
  /** rows PER group (the density dimension). */
  rowsPerGroup: number;
  /** the measure field NAME bound to y (the additive-claim dimension). */
  measure: string;
}

function makeRows(o: CellOpts): Record<string, unknown>[] {
  const groups = o.colorCard === 0 ? ['_'] : Array.from({ length: o.colorCard }, (_, i) => `g${i}`);
  const rows: Record<string, unknown>[] = [];
  groups.forEach((g, gi) => {
    for (let i = 0; i < o.rowsPerGroup; i += 1) {
      const row: Record<string, unknown> = {
        // zero-padded so lexical order == intended sequence order (W01 < … < W20),
        // giving sort-by-X a stable canonical order for the metamorphic leg.
        week: `W${String(i + 1).padStart(2, '0')}`,
        // rising within each group, offset per group so groups are distinct series and
        // the flat cross-series concatenation first→last SIGN-INVERTS vs each real series.
        [o.measure]: (gi + 1) * 1000 + i * 10,
      };
      if (o.colorCard > 0) row.grp = g;
      rows.push(row);
    }
  });
  return rows;
}

function makeSpec(o: CellOpts): NormalizedVizSpec {
  const encoding: Record<string, unknown> = {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'point', title: 'Week' },
    y: { field: o.measure, trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: humanize(o.measure) },
  };
  if (o.colorCard > 0) {
    encoding.color = { field: 'grp', trait: 'EncodingColor', channel: 'color', legend: { title: 'Group' } };
  }
  let layout: Record<string, unknown> | undefined;
  switch (o.layout) {
    case 'facet':
      layout = { trait: 'LayoutFacet', rows: { field: 'grp' }, maxPanels: 24 };
      break;
    case 'concat':
      layout = {
        trait: 'LayoutConcat',
        direction: 'vertical',
        sections: [{ id: 'a', title: 'Overview' }, { id: 'b', title: 'Focus' }],
      };
      break;
    case 'layer':
      layout = { trait: 'LayoutLayer', sharedScales: { x: 'shared', y: 'shared' } };
      break;
    case 'none':
      layout = undefined;
      break;
  }
  return {
    id: 'synthetic',
    name: 'Synthetic chart',
    data: { values: makeRows(o) },
    encoding,
    marks: [{ trait: MARK_TRAIT[o.mark], encodings: encoding }],
    ...(layout ? { layout } : {}),
    a11y: { ariaLabel: 'Synthetic chart', description: 'Synthetic chart for the s155 property harness.' },
  } as unknown as NormalizedVizSpec;
}

function withReversedRows(spec: NormalizedVizSpec): NormalizedVizSpec {
  return {
    ...spec,
    data: { ...(spec as { data: { values: unknown[] } }).data, values: [...specRows(spec)].reverse() },
  } as NormalizedVizSpec;
}

const fixture = (rel: string): NormalizedVizSpec =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../examples/viz/patterns-v2/${rel}`, import.meta.url)), 'utf8'),
  ) as NormalizedVizSpec;

// ============================================================================
// PROPERTY (i) — SINGLE-SERIES-TREND (subsumes row-permutation / #910).
//   A directional Trend claim is emitted ⇒ the spec is PROVABLY single-series.
//   Metamorphic leg: reversing data.values leaves the direction UNCHANGED (a real
//   single series is order-invariant once canonicalized by X) or ABSENT (a
//   multi-series phantom is suppressed). Either way the sign never FLIPS.
// ============================================================================
const MARKS: Mark[] = ['bar', 'line', 'area', 'point', 'rect'];
const LAYOUTS_I: Layout[] = ['none', 'facet', 'concat', 'layer'];
const COLOR_CARDS_I = [0, 1, 3];

// Precompute the (i) cell list so the coverage count is asserted STRUCTURALLY
// (independent of pass/fail), not by a counter that only increments on success.
const CELLS_I: CellOpts[] = [];
for (const mark of MARKS) {
  for (const layout of LAYOUTS_I) {
    for (const colorCard of COLOR_CARDS_I) {
      // facet/concat need a grouping to fold across — skip the degenerate 0/1-group cells.
      if ((layout === 'facet' || layout === 'concat') && colorCard < 2) continue;
      CELLS_I.push({ mark, layout, colorCard, rowsPerGroup: 4, measure: 'value' });
    }
  }
}

describe('s155 property (i) — single-series-trend (CLAIM-ON-POSITIVE-EVIDENCE)', () => {
  it('enumerated the expected number of (i) cells (no silent cap)', () => {
    // 5 marks × [none,layer with {0,1,3} = 6 + facet,concat with {3} = 2] = 5 × 8 = 40.
    expect(CELLS_I.length).toBe(40);
  });

  for (const cell of CELLS_I) {
    const label = `${cell.mark} / ${cell.layout} / colorCard=${cell.colorCard}`;
    it(`no directional trend claim unless provably single-series — ${label}`, () => {
      const spec = makeSpec(cell);
      const exp = expectedSeriesCount(spec);
      const analysis = analyzeVizSpec(spec);
      const n = generateNarrativeSummary(spec);

      // Positive-evidence: a directional claim (analysis field, summary token, or
      // "Trend …" finding) may appear ONLY when exp === 1.
      if (analysis.trend !== undefined) {
        expect(exp, `directional trend on a ${exp}-series spec — ${label}`).toBe(1);
      }
      if (exp > 1) {
        expect(analysis.trend, label).toBeUndefined();
        expect(trendClaimFindings(n), label).toEqual([]);
        expect(DIRECTIONAL_SUMMARY.test(n.summary), `directional summary — ${label}`).toBe(false);
      }

      // Metamorphic row-permutation: the direction never flips on a row reversal.
      const reversed = analyzeVizSpec(withReversedRows(spec)).trend;
      expect(reversed, `row-reversal flipped the direction — ${label}`).toBe(analysis.trend);
    });
  }

  // Concrete fork anchors, tying the property to the two open forks + the shipped facet fix.
  it('fork-2 anchor: focus-context-line (LayoutConcat, color=region ×3) emits NO directional Trend', () => {
    const spec = fixture('focus-context-line.spec.json');
    expect(expectedSeriesCount(spec)).toBe(3);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendClaimFindings(generateNarrativeSummary(spec))).toEqual([]);
  });

  it('fork-4 anchor: a color-grouped line (×3, no layout) emits NO directional Trend', () => {
    const spec = makeSpec({ mark: 'line', layout: 'none', colorCard: 3, rowsPerGroup: 4, measure: 'value' });
    expect(expectedSeriesCount(spec)).toBe(3);
    const n = generateNarrativeSummary(spec);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendClaimFindings(n)).toEqual([]);
    expect(n.summary).not.toMatch(DIRECTIONAL_SUMMARY);
  });

  it('A1 (s157 m05): a SIZE-grouped rising multi-series line emits NO directional Trend (size facets)', () => {
    // 3 size buckets, each a rising series, offset so the flat cross-series concatenation
    // first→last SIGN-INVERTS vs each real series (the phantom "declines −21.9%" at HEAD).
    const rows: Record<string, unknown>[] = [];
    ['small', 'medium', 'large'].forEach((bucket, gi) => {
      for (let i = 0; i < 4; i += 1) {
        rows.push({ week: `W0${i + 1}`, v: (gi + 1) * 1000 + i * 10, bucket });
      }
    });
    const enc = {
      x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'point', title: 'Week' },
      y: { field: 'v', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'V' },
      size: { field: 'bucket', trait: 'EncodingSize', channel: 'size', legend: { title: 'Bucket' } },
    };
    const spec = {
      id: 'size-grouped',
      name: 'Size grouped line',
      data: { values: rows },
      encoding: enc,
      marks: [{ trait: 'MarkLine', encodings: enc }],
      a11y: { ariaLabel: 'Size grouped', description: 'size-grouped multi-series line for the s157 A1 anchor' },
    } as unknown as NormalizedVizSpec;
    expect(expectedSeriesCount(spec)).toBe(3);
    const n = generateNarrativeSummary(spec);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendClaimFindings(n)).toEqual([]);
    expect(n.summary).not.toMatch(DIRECTIONAL_SUMMARY);
  });

  it('must-not-move: a bare single line (no color, no layout) keeps its directional trend, order-invariantly', () => {
    const spec = makeSpec({ mark: 'line', layout: 'none', colorCard: 0, rowsPerGroup: 4, measure: 'value' });
    expect(expectedSeriesCount(spec)).toBe(1);
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    expect(analyzeVizSpec(withReversedRows(spec)).trend).toBe('increasing');
    expect(generateNarrativeSummary(spec).summary).toMatch(/rises from/i);
  });

  it('must-not-move: a single-distinct color line is NOT over-suppressed (gate keys on distinct count, not color presence)', () => {
    const spec = makeSpec({ mark: 'line', layout: 'none', colorCard: 1, rowsPerGroup: 4, measure: 'value' });
    expect(expectedSeriesCount(spec)).toBe(1);
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
  });
});

// ============================================================================
// PROPERTY (ii) — NO-UNPROVEN-SUM.
//   A "Total <label>" claim is emitted ⇔ the measure name is PROVABLY additive.
//   Two-way (⇔) is stronger than the memo's one-way (⇒): it also proves the gate
//   does NOT over-suppress a genuinely additive measure.
// ============================================================================
// Name bank (memo §3 m02): plain measure names | id/zip/compound adversarial edge
// cases, PLUS bidirectional head-position pairs (standing rule: both head-positions
// of every hint compound). Each name's KEEP/LOSE verdict comes from isProvablyAdditive
// (HEAD noun), not from which group it is listed in.
const NAME_BANK: readonly string[] = [
  // plain
  'revenue', 'sales', 'amount', 'quantity', 'price',
  // id / zip / rate / compound edges
  'sales_id', 'store_id', 'id_count', 'id_max', 'id_median', 'zip', 'postal_revenue', 'sku_price', 'lines_of_code',
  // bidirectional head-position pairs
  'total_revenue', 'revenue_total', 'count_id', 'id_sales', 'revenue_per_id',
  // s155 m05: aggregate/rate/cumulative QUALIFIER over an additive head → NOT additive (the
  // adversarial-verify closure: additive head noun no longer rescues a non-additive column).
  'avg_revenue', 'average_sales', 'mean_cost', 'median_sales', 'unit_cost', 'unit_price',
  'running_total', 'cumulative_revenue', 'percent_of_total', 'ytd_total', 'sales_rate', 'revenue_per_unit',
  'max_revenue', 'weighted_sales', 'sales_index',
  // s155 m05: neutral domain qualifiers must NOT suppress a genuine additive (net/gross/daily/monthly).
  'net_revenue', 'gross_sales', 'daily_sales', 'monthly_revenue',
  // s157 m06 (V2): distinct/unique CARDINALITY over an additive head → NOT additive (the live
  // "Total Distinct count: 6,006" bug). One per new qualifier token, each on an additive head.
  'distinct_count', 'unique_count', 'uniq_sales', 'nunique_total', 'cardinality_count', 'distinctcount_amount',
];

function totalBarSpec(measure: string): NormalizedVizSpec {
  // Explicit mode — the caller binds y=<measure> directly, so measureField is exactly
  // <measure> regardless of how inferFieldType would have typed it. Numeric values so a
  // sum is always COMPUTABLE (the test isolates the CLAIM gate, not data availability).
  return buildVizSpecFromRows({
    rows: [
      { cat: 'A', [measure]: 1001 },
      { cat: 'B', [measure]: 2002 },
      { cat: 'C', [measure]: 3003 },
    ],
    chartType: 'bar',
    encodings: { x: { field: 'cat', scale: 'band' }, y: { field: measure, scale: 'linear' } },
  } as never).spec;
}

describe('s155 property (ii) — no-unproven-sum (Total ⇔ provably additive)', () => {
  // De-mirror coverage guard: every bank name has a hand-authored verdict (a new name added
  // without one would read as `undefined` → falsy, silently weakening the test — fail loud here).
  it('every NAME_BANK / NAMES_III name has a hand-authored expected verdict (no silent undefined)', () => {
    const missing = [...NAME_BANK, ...NAMES_III].filter((name) => !(name in EXPECTED_TOTAL_PRESENT));
    expect(missing, `names missing from EXPECTED_TOTAL_PRESENT: ${missing.join(', ')}`).toEqual([]);
  });

  for (const name of NAME_BANK) {
    // INDEPENDENT verdict (hand-authored map, NOT a re-run of the runtime predicate).
    const additive = EXPECTED_TOTAL_PRESENT[name];
    it(`Total for "${name}" ${additive ? 'PRESENT (additive head)' : 'ABSENT (non-additive head)'}`, () => {
      const n = generateNarrativeSummary(totalBarSpec(name));
      const total = totalClaimFinding(n);
      expect(Boolean(total), `Total presence must match additivity for "${name}"`).toBe(additive);
      if (additive) {
        // Assert the exact human-readable LABEL (sum 1001+2002+3003 = 6,006).
        expect(total).toBe(`Total ${humanize(name)}: 6,006`);
      }
    });
  }

  it('High / Low still emit for a non-additive measure (A11Y-R stays green — only the SUM is withheld)', () => {
    const n = generateNarrativeSummary(totalBarSpec('sales_id'));
    expect(totalClaimFinding(n)).toBeUndefined();
    expect(n.keyFindings.some((f) => f.startsWith('High '))).toBe(true);
    expect(n.keyFindings.some((f) => f.startsWith('Low '))).toBe(true);
  });
});

// ============================================================================
// PROPERTY (iii) — CARTESIAN COMPOSITE. (i) ∧ (ii) ∧ (no directional trend on any
// NON-SEQUENCE mark) over the full bounded product {name × mark × layout × colorCard
// × density}. One live narrative per cell, incl. supposed-unchanged. This is the
// machine replacement for the hand-built enumeration matrix: if EVERY cell of a
// finite space satisfies a POSITIVE-precondition invariant, no unseen cell can lie.
// ============================================================================
const NAMES_III = ['revenue', 'sales_id', 'id_count', 'zip']; // 2 additive, 2 not
const LAYOUTS_III: Layout[] = ['none', 'facet', 'concat'];
const COLOR_CARDS_III = [0, 1, 2, 5, 13];
const DENSITIES_III = [3, 8, 20]; // rows per group: sparse / mid / dense
const SEQUENCE_MARKS: ReadonlySet<Mark> = new Set(['line', 'area']);

describe('s155 property (iii) — cartesian composite (class closure)', () => {
  // Build the full cell list up front so the count is asserted (no silent cap).
  const cells: CellOpts[] = [];
  for (const measure of NAMES_III) {
    for (const mark of MARKS) {
      for (const layout of LAYOUTS_III) {
        for (const colorCard of COLOR_CARDS_III) {
          if ((layout === 'facet' || layout === 'concat') && colorCard < 2) continue;
          for (const rowsPerGroup of DENSITIES_III) {
            cells.push({ mark, layout, colorCard, rowsPerGroup, measure });
          }
        }
      }
    }
  }

  it(`covers the full bounded product (${'no silent cap'})`, () => {
    // per (name,mark): none→{0,1,2,5,13}=5, facet→{2,5,13}=3, concat→{2,5,13}=3 ⇒ 11 layout×color combos
    // × 3 densities = 33; × 5 marks × 4 names = 660.
    expect(cells.length).toBe(660);
  });

  it('every cell satisfies (i) single-series-trend ∧ (ii) no-unproven-sum ∧ non-sequence-never-trends', () => {
    const violations: string[] = [];
    for (const cell of cells) {
      const spec = makeSpec(cell);
      const label = `${cell.measure}/${cell.mark}/${cell.layout}/c${cell.colorCard}/d${cell.rowsPerGroup}`;
      const analysis = analyzeVizSpec(spec);
      const n = generateNarrativeSummary(spec);

      // (i) directional trend ⇒ provably single series.
      if (analysis.trend !== undefined && expectedSeriesCount(spec) !== 1) {
        violations.push(`(i) phantom trend on ${expectedSeriesCount(spec)}-series: ${label}`);
      }
      // non-sequence mark ⇒ never a trend claim (bar / point / rect).
      if (!SEQUENCE_MARKS.has(cell.mark) && analysis.trend !== undefined) {
        violations.push(`(iii) trend on non-sequence mark: ${label}`);
      }
      // (ii) a Total claim ⇒ provably additive measure name (INDEPENDENT hand-authored verdict).
      const total = totalClaimFinding(n);
      if (total && !EXPECTED_TOTAL_PRESENT[cell.measure]) {
        violations.push(`(ii) unproven Total "${total}": ${label}`);
      }
    }
    expect(violations, `${violations.length} composite violations:\n${violations.slice(0, 20).join('\n')}`).toEqual([]);
  });

  it('metamorphic: no cell flips its trend direction under row reversal', () => {
    const flips: string[] = [];
    for (const cell of cells) {
      const spec = makeSpec(cell);
      const fwd = analyzeVizSpec(spec).trend;
      const rev = analyzeVizSpec(withReversedRows(spec)).trend;
      if (fwd !== rev) {
        flips.push(`${cell.measure}/${cell.mark}/${cell.layout}/c${cell.colorCard}/d${cell.rowsPerGroup}: ${fwd}→${rev}`);
      }
    }
    expect(flips, `${flips.length} direction flips:\n${flips.slice(0, 20).join('\n')}`).toEqual([]);
  });
});

// ============================================================================
// PROPERTY (iv) — DECLARED-AGGREGATE AUTHORITATIVE (s155 m05 adversarial closure).
//   A caller-declared aggregate overrides the name guess: sum/count ⇒ additive (but never on an
//   identifier/zip); average/median/min/max/distinct ⇒ NON-additive even over an additive name.
// ============================================================================
function aggBarSpec(measure: string, aggregate: string): NormalizedVizSpec {
  return buildVizSpecFromRows({
    rows: [{ cat: 'A', [measure]: 1001 }, { cat: 'B', [measure]: 2002 }, { cat: 'C', [measure]: 3003 }],
    chartType: 'bar',
    encodings: { x: { field: 'cat', scale: 'band' }, y: { field: measure, aggregate } },
  } as never).spec;
}

function countLabelSpec(title?: string): NormalizedVizSpec {
  const rows = [
    ...Array.from({ length: 4 }, (_, i) => ({ method: 'Microlensing', planetName: `M${i}` })),
    ...Array.from({ length: 3 }, (_, i) => ({ method: 'Radial Velocity', planetName: `R${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ method: 'Transit', planetName: `T${i}` })),
    { method: 'Imaging', planetName: 'I0' },
  ];
  return buildVizSpecFromRows({
    rows,
    chartType: 'bar',
    encodings: {
      x: { field: 'method', scale: 'band' },
      y: { field: 'planetName', aggregate: 'count', ...(title ? { title } : {}) },
    },
  } as never).spec;
}

describe('s155 property (iv) — declared aggregate is authoritative over the name guess', () => {
  const cases: Array<[string, string, boolean]> = [
    // [measure, aggregate, expectedAdditive] — the expected verdict is HAND-AUTHORED here (an
    // independent truth), NOT read back from the runtime predicate (de-mirrored, s157 m06).
    ['widget', 'sum', true], // declared sum on a non-additive name ⇒ Total
    ['widget', 'count', true], // declared count ⇒ Total
    ['sales', 'average', false], // mean of an additive column is NOT summable
    ['revenue', 'median', false],
    ['revenue', 'max', false],
    ['revenue', 'min', false],
    ['customer_id', 'sum', false], // never sum an identifier, even declared (#895 guard)
    ['zip', 'sum', false], // never sum a zip, even declared
    ['users', 'distinct', false], // declared distinct ⇒ never a Total (non-summable cardinality)
  ];
  for (const [measure, aggregate, expectedAdditive] of cases) {
    it(`${measure} @ aggregate=${aggregate} → Total ${expectedAdditive ? 'PRESENT' : 'ABSENT'}`, () => {
      const has = Boolean(totalClaimFinding(generateNarrativeSummary(aggBarSpec(measure, aggregate))));
      expect(has, `runtime Total presence must match the hand-authored declared-aggregate verdict`).toBe(expectedAdditive);
    });
  }

  it('labels an untitled count by its operation, not by the counted identity field', () => {
    const spec = countLabelSpec();
    const result = generateNarrativeSummary(spec);
    const findings = result.keyFindings;
    expect(findings).toEqual([
      'High Count: Count 4 (Microlensing)',
      'Low Count: Count 1 (Imaging)',
      'Total Count: 10',
    ]);
    expect(findings).toHaveLength(3);
    expect(result.analysis).toEqual(analyzeVizSpec(spec));
    expect(result.analysis).not.toHaveProperty('findingMeasureLabel');
  });

  it('keeps an explicit count title as the grouping-context label', () => {
    const findings = generateNarrativeSummary(countLabelSpec('Confirmed planets')).keyFindings;
    expect(findings).toEqual([
      'High Confirmed planets: Confirmed planets 4 (Microlensing)',
      'Low Confirmed planets: Confirmed planets 1 (Imaging)',
      'Total Confirmed planets: 10',
    ]);
    expect(findings).toHaveLength(3);
  });
});

// ============================================================================
// PROPERTY (v) — GROUPING-UNDERCOUNT CLOSURE (s155 m05).
//   A grouping field split into a null-labelled series + a labelled series is multi-series; a
//   detail grouping is NOT shadowed by a constant color. Both suppress the phantom trend, while a
//   genuinely single series (all-null or constant color) keeps its honest trend.
// ============================================================================
function groupedLine(rows: Record<string, unknown>[], opts: { color?: string; detail?: string }): NormalizedVizSpec {
  const enc: Record<string, unknown> = {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'point', title: 'Week' },
    y: { field: 'v', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'V' },
  };
  if (opts.color) enc.color = { field: opts.color, trait: 'EncodingColor', channel: 'color' };
  if (opts.detail) enc.detail = { field: opts.detail, trait: 'EncodingDetail', channel: 'detail' };
  return {
    id: 'g', name: 'G', data: { values: rows }, encoding: enc,
    marks: [{ trait: 'MarkLine', encodings: enc }],
    a11y: { ariaLabel: 'G', description: 'grouping-undercount probe line spec for the property harness' },
  } as unknown as NormalizedVizSpec;
}

describe('s155 property (v) — grouping-undercount phantom closure', () => {
  it('null-labelled reference + labelled forecast (2 series via color) → NO trend, invariant under reversal', () => {
    const rows = [
      { week: 'W1', v: 500, series: null }, { week: 'W2', v: 460, series: null }, { week: 'W3', v: 420, series: null },
      { week: 'W1', v: 100, series: 'forecast' }, { week: 'W2', v: 200, series: 'forecast' }, { week: 'W3', v: 300, series: 'forecast' },
    ];
    const spec = groupedLine(rows, { color: 'series' });
    expect(expectedSeriesCount(spec)).toBe(2);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(analyzeVizSpec(withReversedRows(spec)).trend).toBeUndefined();
    expect(trendClaimFindings(generateNarrativeSummary(spec))).toEqual([]);
  });

  it('detail-grouped 2 series shadowed by a CONSTANT color → NO trend (color+detail both consulted)', () => {
    const rows = [
      { week: 'W1', v: 500, theme: 'x', grp: 'A' }, { week: 'W2', v: 400, theme: 'x', grp: 'A' }, { week: 'W3', v: 130, theme: 'x', grp: 'A' },
      { week: 'W1', v: 50, theme: 'x', grp: 'B' }, { week: 'W2', v: 90, theme: 'x', grp: 'B' }, { week: 'W3', v: 140, theme: 'x', grp: 'B' },
    ];
    const spec = groupedLine(rows, { color: 'theme', detail: 'grp' });
    expect(expectedSeriesCount(spec)).toBe(2);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendClaimFindings(generateNarrativeSummary(spec))).toEqual([]);
  });

  it('must-not-move: an all-null (or absent) color field is a SINGLE series → trend preserved', () => {
    const rows = [{ week: 'W1', v: 10, series: null }, { week: 'W2', v: 20, series: null }, { week: 'W3', v: 30, series: null }];
    const spec = groupedLine(rows, { color: 'series' });
    expect(expectedSeriesCount(spec)).toBe(1);
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
  });
});

// ============================================================================
// PROPERTY (vi) — SORT-BY-X NATURAL ORDER (s155 m05).
//   A rising single series narrates 'increasing' regardless of label FORMAT — non-zero-padded
//   dates, version strings — and stays row-permutation invariant (natural order is a total order).
// ============================================================================
describe('s155 property (vi) — natural-order sort-by-X (correct direction, order-invariant)', () => {
  const rising = (weeks: string[]): NormalizedVizSpec =>
    groupedLine(weeks.map((week, i) => ({ week, v: 100 + i * 100 })), {});

  const banks: Array<[string, string[]]> = [
    ['non-zero-padded ISO months', ['2021-8', '2021-9', '2021-10', '2021-11', '2021-12']],
    ['version strings', ['v8', 'v9', 'v10', 'v11', 'v12']],
    ['bare integers as strings', ['8', '9', '10', '11', '12']],
    ['zero-padded weeks (unchanged baseline)', ['W08', 'W09', 'W10', 'W11', 'W12']],
    ['sprint labels', ['S1', 'S2', 'S9', 'S10', 'S11']],
    // s157 m05 (V1): dotted-decimal release axes — Number('1.10')=1.1 < 1.11 < Number('1.9')=1.9
    // took the numeric fast-path and narrated a DECLINE on rising data. The string-with-dot gate
    // routes them to naturalCompare (1.9 < 1.10 < 1.11).
    ['dotted-decimal release versions', ['1.9', '1.10', '1.11']],
    ['dotted-decimal minor versions', ['3.9', '3.10', '3.11', '3.12']],
  ];
  for (const [label, weeks] of banks) {
    it(`rising over ${label} → 'increasing' (NOT lexical 'decreasing'), reversal-invariant`, () => {
      const spec = rising(weeks);
      expect(analyzeVizSpec(spec).trend, label).toBe('increasing');
      // Natural order is a TOTAL order: the direction is identical however the rows are stored.
      expect(analyzeVizSpec(withReversedRows(spec)).trend, `${label} reversed`).toBe('increasing');
      expect(generateNarrativeSummary(spec).summary).toMatch(/rises from/i);
    });
  }
});
