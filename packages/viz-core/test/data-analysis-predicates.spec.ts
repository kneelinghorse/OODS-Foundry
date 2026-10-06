import { describe, expect, it } from 'vitest';
import {
  buildVizSpecFromRows,
  generateNarrativeSummary,
  heatmapColorIsMeasure,
  inferFieldProfile,
  isMarkRectGrid,
  validateVizEquivalenceRules,
} from '@oods/viz-core';

// s150 m02 — the two pure predicates that structurally fix the s149 F6d mislabel.
//
// P1 heatmapColorIsMeasure(spec) = all-MarkRect AND color binding exists AND color is
//    quantitative (raw toNumber .some() probe, NOT the `type` marker). Gates the measure
//    rebind + colorField drop + the measureLabel channel — ONE predicate on ONE spec, so the
//    binding and label decisions can never diverge again.
// P2 isMarkRectGrid(spec) = all-MarkRect only. Gates the phantom trend/correlation, whose
//    order-freeness is independent of which channel is the measure.
//
// A 3×4 grid: two dimensions (region, quarter) crossed by a quantitative measure (revenue),
// plus a categorical `tier` used only for the categorical-color case.
const ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, q) => ({
    region,
    quarter,
    revenue: 40 + r * 30 + q * 11,
    tier: q < 2 ? 'low' : 'high',
  })),
);

function heatmap(encodings: Record<string, unknown>) {
  const { spec } = buildVizSpecFromRows({ rows: ROWS, chartType: 'heatmap', encodings } as never);
  return spec;
}

// Quantitative color — the shipped F6d fixture. The color binding pins scale:'linear', so
// applyDataAwareTypes leaves its `type` UNDEFINED; only the raw-value probe classifies it.
const quantColorHeatmap = () =>
  heatmap({
    x: { field: 'region', scale: 'band' },
    y: { field: 'quarter', scale: 'band' },
    color: { field: 'revenue', scale: 'linear' },
  });

// Categorical color — a string series on the color channel.
const categoricalColorHeatmap = () =>
  heatmap({
    x: { field: 'region', scale: 'band' },
    y: { field: 'quarter', scale: 'band' },
    color: { field: 'tier', scale: 'band' },
  });

// Absent color — two dimensions, no color channel at all.
const absentColorHeatmap = () =>
  heatmap({
    x: { field: 'region', scale: 'band' },
    y: { field: 'quarter', scale: 'band' },
  });

const barChart = () => {
  const { spec } = buildVizSpecFromRows({
    rows: ROWS,
    chartType: 'bar',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'revenue', scale: 'linear' },
    },
  } as never);
  return spec;
};

describe('s150 m02 — isMarkRectGrid (P2)', () => {
  it('is true for every MarkRect grid regardless of the color channel', () => {
    expect(isMarkRectGrid(quantColorHeatmap())).toBe(true);
    expect(isMarkRectGrid(categoricalColorHeatmap())).toBe(true);
    expect(isMarkRectGrid(absentColorHeatmap())).toBe(true);
  });

  it('is false for a non-rect mark (bar)', () => {
    expect(isMarkRectGrid(barChart())).toBe(false);
  });
});

describe('s150 m02 — heatmapColorIsMeasure (P1)', () => {
  it('is true only when a MarkRect grid binds a real quantitative color measure', () => {
    expect(heatmapColorIsMeasure(quantColorHeatmap())).toBe(true);
  });

  it('is false when color is categorical (falls back to Y → restores A11Y-R-11)', () => {
    expect(heatmapColorIsMeasure(categoricalColorHeatmap())).toBe(false);
  });

  it('is false when color is absent (falls back to Y → restores A11Y-R-11)', () => {
    expect(heatmapColorIsMeasure(absentColorHeatmap())).toBe(false);
  });

  it('is false for a non-rect mark (bar) even with a numeric measure', () => {
    expect(heatmapColorIsMeasure(barChart())).toBe(false);
  });
});

// s151 m05 (closes s150 review carries #895 MED + #896 LOW). The s150 predicate re-derived
// quantitativeness with a COERCIVE raw-cell probe (rows.some(toNumber(cell) !== null)); m05
// honors the field profiler's stamped type/scale instead. Two boundary fixtures the s150
// predicate had NO coverage for, in either direction.

// #895 BUG REPRO: a color field whose VALUES are numeric STRINGS but which is CATEGORICAL
// (ordinal `band` scale) — store codes "01".."04". The coercive probe read toNumber("01")=1
// and classified the codes as a measure → the narrative SUMMED them ("Total Store Id: 18").
// Honoring the ordinal scale falls back to Y (revenue) as the shipped #115 prose promises.
const NUMERIC_STRING_ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['01', '02', '03', '04'].map((storeCode, q) => ({
    region,
    storeCode,
    revenue: 40 + r * 30 + q * 11,
  })),
);
const numericStringColorHeatmap = () => {
  const { spec } = buildVizSpecFromRows({
    rows: NUMERIC_STRING_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'revenue', scale: 'linear' },
      color: { field: 'storeCode', scale: 'band' },
    },
  } as never);
  return spec;
};

// #896 NULL-TOLERANCE GUARD: a quantitative-scale (`linear`) color heatmap with a NULL cell.
// Because the decision is now made on the scale, null cells never flip it — this stays a
// measure. Reds if the predicate ever regresses to a cell probe that uses `.every()`
// (the null cell would flip it false and re-break a genuine sparse heatmap).
const SPARSE_NULL_ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, q) => ({
    region,
    quarter,
    revenue: r === 0 && q === 0 ? null : 40 + r * 30 + q * 11,
  })),
);
const sparseNullLinearHeatmap = () => {
  const { spec } = buildVizSpecFromRows({
    rows: SPARSE_NULL_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'quarter', scale: 'band' },
      color: { field: 'revenue', scale: 'linear' },
    },
  } as never);
  return spec;
};

describe('s151 m05 — heatmapColorIsMeasure honors the profiler type/scale (closes #895/#896)', () => {
  it('#895: a numeric-STRING categorical color falls back to Y (fails at HEAD: coercive probe sums the codes)', () => {
    // The color field profiles ordinal (scale:'band'); its numeric-string values must NOT be
    // read as a measure. At HEAD the coercive toNumber probe returned true here.
    expect(heatmapColorIsMeasure(numericStringColorHeatmap())).toBe(false);
  });

  it('#896: a sparse linear-scale color with a NULL cell STAYS a measure (null-tolerance, no .every())', () => {
    expect(heatmapColorIsMeasure(sparseNullLinearHeatmap())).toBe(true);
  });
});

// s152 F2 (closes the residual live #895 gap the s151 review confirmed). The s151 m05 tests
// above hand-declare `scale:'band'` on the color binding — which WINS over the profiler, so
// they never exercised the BARE-field path where the profiler itself decides. The residual
// open case is a BARE numeric-string identifier color (store_id "1001".."1006", <8 rows so
// rule-(4) ordinal is unmet, distinctRatio ≥ 0.5): inferFieldType rule-(5) typed it
// QUANTITATIVE, and applyDataAwareTypes stamped that onto the binding, feeding a THREE-WAY
// disagreement — RENDER draws a continuous gradient (color.type='quantitative'), narrative
// SUMS the ids ("…totaling 6,021 Store id"), a11y table isNumeric=false. The fix is at the
// profiler ROOT (inferFieldType nameHintsIdentifier → 'nominal'), so render + narrative + table
// agree. These tests exercise the BARE path (no scale) end-to-end; they are RED at HEAD.

// Two dimensions crossed by a BARE numeric-string id color — the canonical #895 shape.
const BARE_ID_ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['Q1', 'Q2'].map((quarter, q) => ({
    region,
    quarter,
    store_id: String(1001 + r * 2 + q), // 1001..1006, all distinct numeric strings
  })),
);
const bareIdHeatmap = () => {
  const { spec } = buildVizSpecFromRows({
    rows: BARE_ID_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'quarter', scale: 'band' },
      color: { field: 'store_id' }, // BARE — no scale; the profiler decides its type
    },
  } as never);
  return spec;
};

// Same bare id color, but Y is a genuine MEASURE (revenue): the id color must fall back to the
// Y measure, NOT be summed itself.
const BARE_ID_YMEASURE_ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['Q1', 'Q2'].map((_quarter, q) => ({
    region,
    revenue: 40 + r * 30 + q * 11,
    store_id: String(1001 + r * 2 + q),
  })),
);
const bareIdYMeasureHeatmap = () => {
  const { spec } = buildVizSpecFromRows({
    rows: BARE_ID_YMEASURE_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'revenue', scale: 'linear' },
      color: { field: 'store_id' },
    },
  } as never);
  return spec;
};

// Control: a BARE genuine measure color (revenue, no scale) — the profiler types it
// quantitative, so it STAYS the measure and sums. Proves the identifier guard is narrow.
const BARE_REVENUE_COLOR_ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, q) => ({
    region,
    quarter,
    revenue: 40 + r * 30 + q * 11,
  })),
);
const bareRevenueColorHeatmap = () => {
  const { spec } = buildVizSpecFromRows({
    rows: BARE_REVENUE_COLOR_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'quarter', scale: 'band' },
      color: { field: 'revenue' }, // BARE genuine measure — profiler → quantitative
    },
  } as never);
  return spec;
};

describe('s152 F2 — #895 bare numeric-string-ID heatmap honesty (profiler root)', () => {
  // (a) END-TO-END, Y is a dimension: no measure remains → the id color must NOT be summed,
  //     and the heatmap honestly WARNS on R-11 (an a11y ADVANCE over a false "Total 6,021").
  it('(a) a bare id color is not a measure and is never summed (LABEL-asserting; RED at HEAD)', () => {
    const spec = bareIdHeatmap();
    expect(heatmapColorIsMeasure(spec)).toBe(false);
    const n = generateNarrativeSummary(spec);
    // Assert the human-readable LABEL string (s149 F6d root cause), not just the predicate.
    expect(n.summary).not.toMatch(/totaling [\d,]+ Store id/i);
    expect(n.summary).not.toContain('Total Store id');
    expect(n.keyFindings.some((f) => /^Total Store id/i.test(f))).toBe(false);
    expect(n.keyFindings.some((f) => /^High Store id/i.test(f))).toBe(false);
  });

  it('(a) the measure-less bare-id heatmap trips A11Y-R-11 (warn, non-blocking — the a11y advance)', () => {
    const r11 = validateVizEquivalenceRules(bareIdHeatmap()).find((r) => r.id === 'A11Y-R-11');
    expect(r11?.severity).toBe('warn'); // non-blocking
    expect(r11?.passed).toBe(false); // honestly warns instead of asserting a phantom "Total"
  });

  // (a2) Y is a genuine measure: the id color falls back to the Y MEASURE (revenue).
  it('(a2) with a numeric Y, a bare id color falls back to the Y measure — names Revenue, sums Revenue not the ids', () => {
    const spec = bareIdYMeasureHeatmap();
    expect(heatmapColorIsMeasure(spec)).toBe(false);
    const n = generateNarrativeSummary(spec);
    expect(n.analysis.measureField).toBe('revenue');
    expect(n.summary).toContain('Revenue');
    expect(n.summary).not.toMatch(/Store id/); // the id is never the measured quantity
    expect(n.keyFindings.some((f) => /Total Store id/i.test(f))).toBe(false);
  });

  // (d) render-layer: the color scale is discrete, not a continuous gradient over the ids.
  it('(d) the bare id color binding types NOT quantitative (gradient-over-IDs gone; RED at HEAD)', () => {
    const spec = bareIdHeatmap();
    const colorType = (spec.encoding as { color?: { type?: string } }).color?.type;
    expect(colorType).not.toBe('quantitative');
    expect(colorType).toBe('nominal');
  });

  // (b) boundary, the OTHER direction: a bare genuine measure color STILL sums (control).
  it('(b) a bare genuine measure color (revenue) STAYS a measure and sums (guard is narrow)', () => {
    const spec = bareRevenueColorHeatmap();
    expect(heatmapColorIsMeasure(spec)).toBe(true);
    const n = generateNarrativeSummary(spec);
    expect(n.summary).toMatch(/totaling [\d,]+ Revenue/i);
  });

  // (b) sparse-null tolerance preserved — the fix is name-gated, no value probe, so a genuine
  //     sparse quantitative color with null cells is untouched (reds if a .every() probe returns).
  it('(b) sparse linear-scale quantitative color with a NULL cell STILL a measure (no .some()->.every())', () => {
    expect(heatmapColorIsMeasure(sparseNullLinearHeatmap())).toBe(true);
  });

  // (c) profiler fixtures at the ROOT: the identifier guard classifies by NAME, both directions.
  it('(c) inferFieldProfile: an id-named numeric-string field is nominal/dimension (RED at HEAD)', () => {
    const prof = inferFieldProfile(BARE_ID_ROWS).find((p) => p.name === 'store_id');
    expect(prof?.type).toBe('nominal');
    expect(prof?.role).toBe('dimension');
  });

  it('(c) inferFieldProfile: a measure-named numeric-string field stays quantitative/measure', () => {
    const rows = [{ amount: '40' }, { amount: '51' }, { amount: '62' }, { amount: '73' }];
    const prof = inferFieldProfile(rows).find((p) => p.name === 'amount');
    expect(prof?.type).toBe('quantitative');
    expect(prof?.role).toBe('measure');
  });

  // s153 F2 REWRITE: the s152 identifier set treated bare 'code'/'sku' as identifier tokens,
  // which over-reached — a numeric-string 'product_code'/'sku' column is a genuine measure, not
  // an ID (summing lines_of_code is meaningful; summing a store_id is not). The token set was
  // narrowed to id/ids/uuid/guid, so product_code/sku now type quantitative (= their pre-s152
  // typing — a narrower fix, NOT a new regression), while uuid/guid remain nominal identifiers.
  it('(c) inferFieldProfile: id/uuid/guid are nominal; product_code/sku are NOT identifiers (narrowed s153)', () => {
    const rows = [
      { product_code: '100', sku: '200', uuid: '300', guid: '400' },
      { product_code: '101', sku: '201', uuid: '301', guid: '401' },
      { product_code: '102', sku: '202', uuid: '302', guid: '402' },
    ];
    const profs = inferFieldProfile(rows);
    for (const name of ['uuid', 'guid']) {
      expect(profs.find((p) => p.name === name)?.type, name).toBe('nominal');
    }
    for (const name of ['product_code', 'sku']) {
      expect(profs.find((p) => p.name === name)?.type, name).toBe('quantitative');
    }
  });
});

// s153 F2 corrective (closes the s152 F2 HIGH regression, PS-2026-07-12-006). The s152 identifier
// token set {id,ids,code,sku,uuid,guid} demoted genuine numeric MEASURES that merely contained
// 'code'/'sku' (lines_of_code, code_coverage, sku_price, sku_revenue) to nominal dimensions, AND
// the identifier check ran in rule-(3) BEFORE the rule-(3b) measure-name rescue, so measure+id
// compounds (revenue_per_id, amount_per_uuid) demoted too. The fix NARROWS the tokens to
// {id,ids,uuid,guid} and REORDERS the identifier check into a new rule-(3c) AFTER the measure
// rescue, so a measure name wins over an id token. These tests exercise both halves at the
// profiler root and re-confirm the #895 store_id path still falls back correctly.

// All-distinct numeric-string columns (distinctRatio 1.0, <8 rows) so rule-(4) ordinal never
// fires — the type is decided purely by the name-hint precedence being corrected.
const s153NumericStringRows = (names: readonly string[]) =>
  Array.from({ length: 6 }, (_, i) => {
    const row: Record<string, string> = {};
    for (const name of names) row[name] = String(1000 + i * 7 + name.length);
    return row;
  });

describe('s153 F2 — numeric measures with code/sku tokens are measures, not dimensions', () => {
  it('NARROW: the 5 defect measure columns type quantitative/measure (RED at HEAD: all nominal)', () => {
    const names = ['lines_of_code', 'code_coverage', 'code_complexity', 'sku_price', 'sku_revenue'];
    const profs = inferFieldProfile(s153NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('quantitative');
      expect(p?.role, name).toBe('measure');
    }
  });

  it('REORDER: measure+id compounds win on the measure name (revenue_per_id/amount_per_uuid/revenue_per_sku → measure)', () => {
    const names = ['revenue_per_id', 'amount_per_uuid', 'revenue_per_sku'];
    const profs = inferFieldProfile(s153NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('quantitative');
      expect(p?.role, name).toBe('measure');
    }
  });

  it('preserved: pure identifier columns store_id/uuid/guid stay nominal/dimension (guard still bites)', () => {
    const names = ['store_id', 'uuid', 'guid'];
    const profs = inferFieldProfile(s153NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('nominal');
      expect(p?.role, name).toBe('dimension');
    }
  });

  // #895 still fixed after the narrow+reorder: a bare numeric-string store_id color with a
  // dimension Y has no measure to fall back to → the id is never summed and the table stays
  // isNumeric:false. Asserts the human-readable LABEL string (the s149 F6d root-cause lesson).
  it('#895 preserved: a bare store_id heatmap never sums the ids; table isNumeric:false', () => {
    const rows = ['North', 'South', 'East'].flatMap((region, r) =>
      ['Q1', 'Q2'].map((quarter, q) => ({
        region,
        quarter,
        store_id: String(1001 + r * 2 + q),
      })),
    );
    const { spec } = buildVizSpecFromRows({
      rows,
      chartType: 'heatmap',
      encodings: {
        x: { field: 'region', scale: 'band' },
        y: { field: 'quarter', scale: 'band' },
        color: { field: 'store_id' },
      },
    } as never);
    expect(heatmapColorIsMeasure(spec)).toBe(false);
    const n = generateNarrativeSummary(spec);
    expect(n.summary).not.toMatch(/totaling [\d,]+ Store id/i);
    expect(n.keyFindings.some((f) => /Total Store id/i.test(f))).toBe(false);
    const colorType = (spec.encoding as { color?: { type?: string } }).color?.type;
    expect(colorType).toBe('nominal');
  });
});

// s154 F2 corrective (closes the s153 F2 HIGH+MED regressions, PS-2026-07-17-001). The s153
// REORDER (identifier check moved AFTER the measure rescue) promoted measure-PREFIXED identifier
// columns — sales_id/total_id/price_id/... all typed quantitative/measure at 1342ab2 (nominal at
// s152 a93477f) → live #895 sum-the-IDs narrative ("Total Sales id: 6,021") + gradient over IDs.
// The review proved NO ordering of an unordered token-bag is correct in both directions
// (id_count wants measure, id_number wants nominal; both are id-hinted). Head POSITION is the
// missing axis. The fix keeps the hint helpers matching ANYWHERE (.some, unchanged) and adds a
// HEAD-NOUN escape: a zip/identifier-hinted numeric column stays nominal UNLESS its HEAD noun
// (last token after stripping a trailing all-digit suffix) is aggregate-shaped or a measure word,
// or the name carries a 'per' rate marker. These tests enumerate BOTH head-positions of every
// hint-class compound (the bidirectional-enumeration lesson) and assert type/role AND the label.

// 6 all-distinct numeric-string rows: distinctRatio 1.0 AND <8 rows so rule-(4) ordinal never
// fires — the type is decided purely by the head-noun arbitration under test.
const s154NumericStringRows = (names: readonly string[]) =>
  Array.from({ length: 6 }, (_, i) => {
    const row: Record<string, string> = {};
    for (const name of names) row[name] = String(1000 + i * 7 + name.length);
    return row;
  });

describe('s154 F2 — head-noun arbitration (ANYWHERE-hint + head-noun escape)', () => {
  // (HIGH) measure-word PREFIX + identifier HEAD → nominal dimension. The measure token is not
  // the head noun, so it must NOT rescue the id. RED at HEAD 1342ab2: all quantitative/measure.
  it('measure-prefixed id/uuid/guid compounds are nominal, not measures (RED at HEAD)', () => {
    const names = [
      'sales_id', 'total_id', 'amount_id', 'price_id', 'cost_id',
      'value_id', 'qty_id', 'order_total_id', 'sales_uuid', 'revenue_guid',
    ];
    const profs = inferFieldProfile(s154NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('nominal');
      expect(p?.role, name).toBe('dimension');
    }
  });

  // (attacker class) identifier HEAD + a non-measure tail token (number/no/num/fk/pk/ref/key/seq)
  // → nominal. The original head-token design mis-typed these as measures (#895 resurrection).
  it('identifier-head compounds with non-measure tails stay nominal (id_number/user_id_fk/...)', () => {
    const names = [
      'id_number', 'id_no', 'id_num', 'customer_id_number', 'tax_id_number',
      'user_id_fk', 'order_id_pk', 'parent_id_ref', 'store_id_key', 'record_id_seq',
    ];
    const profs = inferFieldProfile(s154NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('nominal');
      expect(p?.role, name).toBe('dimension');
    }
  });

  // (MED) aggregate-HEADED identifier compounds ESCAPE to genuine quantitative measures —
  // counting/summing IDs is meaningful. RED at HEAD: nominal (the s152 carry only half-fixed).
  it('aggregate-headed identifier compounds are quantitative measures (RED at HEAD: nominal)', () => {
    const names = ['id_count', 'uuid_count', 'guid_score', 'ids_sum', 'user_id_count'];
    const profs = inferFieldProfile(s154NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('quantitative');
      expect(p?.role, name).toBe('measure');
    }
  });

  // The COLLISION the review proved inexpressible in any token-ORDERING model, pinned in ONE
  // dataset: id_count (aggregate head) is a measure while id_number (non-measure head) is a
  // dimension — same 'id' hint, opposite outcome, resolved only by head POSITION.
  it('COLLISION: id_count is quantitative AND id_number is nominal in the same dataset', () => {
    const profs = inferFieldProfile(s154NumericStringRows(['id_count', 'id_number']));
    expect(profs.find((p) => p.name === 'id_count')?.type).toBe('quantitative');
    expect(profs.find((p) => p.name === 'id_count')?.role).toBe('measure');
    expect(profs.find((p) => p.name === 'id_number')?.type).toBe('nominal');
    expect(profs.find((p) => p.name === 'id_number')?.role).toBe('dimension');
  });

  // One cell per AGGREGATE_HEADS member — each rescues an identifier compound to a measure.
  it('every AGGREGATE_HEADS token escapes an identifier compound to quantitative', () => {
    const heads = ['count', 'counts', 'sum', 'avg', 'average', 'mean', 'median', 'min', 'max', 'score'];
    for (const h of heads) {
      const name = `id_${h}`;
      const p = inferFieldProfile(s154NumericStringRows([name])).find((f) => f.name === name);
      expect(p?.type, name).toBe('quantitative');
      expect(p?.role, name).toBe('measure');
    }
  });

  // (MED, zip class) a measure-HEADED zip/postal compound escapes to a measure; a non-measure
  // zip compound stays nominal. RED at HEAD: postal_revenue mis-typed by the zip-first return.
  it('postal_revenue is quantitative (measure head escapes); postal_area_code stays nominal', () => {
    const profs = inferFieldProfile(s154NumericStringRows(['postal_revenue', 'postal_area_code']));
    expect(profs.find((p) => p.name === 'postal_revenue')?.type).toBe('quantitative');
    expect(profs.find((p) => p.name === 'postal_revenue')?.role).toBe('measure');
    expect(profs.find((p) => p.name === 'postal_area_code')?.type).toBe('nominal');
    expect(profs.find((p) => p.name === 'postal_area_code')?.role).toBe('dimension');
  });

  // 'per' rate marker escapes in BOTH head-positions (measure_per_id AND ..._per_..._id).
  it('per-rate identifier compounds are quantitative (revenue_per_id/revenue_per_customer_id/sales_per_store_id)', () => {
    const names = ['revenue_per_id', 'revenue_per_customer_id', 'sales_per_store_id'];
    const profs = inferFieldProfile(s154NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('quantitative');
      expect(p?.role, name).toBe('measure');
    }
  });

  // MUST-NOT-MOVE (nominal): bare identifiers and non-escaping id compounds stay dimensions.
  it('MUST-NOT-MOVE: bare/non-escaping identifiers stay nominal', () => {
    const names = ['store_id', 'uuid', 'guid', 'ids', 'id', 'user_id_session_id'];
    const profs = inferFieldProfile(s154NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('nominal');
      expect(p?.role, name).toBe('dimension');
    }
  });

  // MUST-NOT-MOVE (quantitative): code/sku are NOT identifier tokens (narrowed s153) and must not
  // re-demote; genuine measure names stay measures.
  it('MUST-NOT-MOVE: code/sku/measure names stay quantitative', () => {
    const names = ['lines_of_code', 'code_coverage', 'sku_price', 'sku_revenue', 'product_code', 'sku'];
    const profs = inferFieldProfile(s154NumericStringRows(names));
    for (const name of names) {
      const p = profs.find((f) => f.name === name);
      expect(p?.type, name).toBe('quantitative');
      expect(p?.role, name).toBe('measure');
    }
  });

  // MUST-NOT-MOVE: a trailing all-digit suffix is stripped for the head noun, so store_id_2024
  // keeps head 'id' (nominal) while sales_2024 has head 'sales' via the measure rescue (quant).
  it('MUST-NOT-MOVE: digit-suffix — store_id_2024 nominal, sales_2024 quantitative', () => {
    const profs = inferFieldProfile(s154NumericStringRows(['store_id_2024', 'sales_2024']));
    expect(profs.find((p) => p.name === 'store_id_2024')?.type).toBe('nominal');
    expect(profs.find((p) => p.name === 'sales_2024')?.type).toBe('quantitative');
  });

  // End-to-end LABEL (the s149 F6d lesson: assert the human-readable string). A heatmap with
  // color=sales_id must route to the categorical branch — nominal color, no "Total Sales id" sum.
  // Mirror of the live #895 defect "Total Sales id: 6,021". RED at HEAD.
  it('heatmap color=sales_id: nominal color, never sums the ids (RED at HEAD)', () => {
    const rows = ['North', 'South', 'East'].flatMap((region, r) =>
      ['Q1', 'Q2'].map((quarter, q) => ({
        region,
        quarter,
        sales_id: String(1001 + r * 2 + q),
      })),
    );
    const { spec } = buildVizSpecFromRows({
      rows,
      chartType: 'heatmap',
      encodings: {
        x: { field: 'region', scale: 'band' },
        y: { field: 'quarter', scale: 'band' },
        color: { field: 'sales_id' },
      },
    } as never);
    expect(heatmapColorIsMeasure(spec)).toBe(false);
    const n = generateNarrativeSummary(spec);
    expect(n.summary).not.toMatch(/totaling [\d,]+ Sales id/i);
    expect(n.keyFindings.some((f) => /Total Sales id/i.test(f))).toBe(false);
    const colorType = (spec.encoding as { color?: { type?: string } }).color?.type;
    expect(colorType).toBe('nominal');
  });
});
