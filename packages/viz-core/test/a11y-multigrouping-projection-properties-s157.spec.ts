import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, generateNarrativeSummary, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-157 m02 — B1 PER-DRAWN-CELL aggregate projection under a color/detail
// sub-grouping (SSOT memo §2). The s156 m06 projection keys by the dimension
// field ONLY, so a grouped bar (y aggregate:'average', color:product) collapses a
// coexisting color grouping → extrema/total name a value drawn on NO mark (the
// "High Value: 105 (South)" phantom, where 105 = (10+200)/2 is a region-only mean).
//
// FIX (Option A, ratified): extend the projection group key to the discrete
// channels the chart actually draws by (dimension + the s155 seriesGroupingFields
// color/detail), EXCLUDING the measure channel (A1) and the dimension itself, then
// reduce PER DRAWN CELL — except for STACKING aggregates (A2), where Vega draws a
// per-dimension stack total.
//
// RED-FIRST: at HEAD (s156 dimension-only projection) P5 (no-phantom) FAILS for
// average/median/distinct under a real color sub-group — the reported extremum is
// the region-collapsed reduction, drawn on no cell. The per-cell key turns it GREEN
// across the whole enumerated space.
//
// ANTI-TAUTOLOGY: the oracle `drawnReductions` is a STANDALONE test-side reducer
// built from the KNOWN cell construction (not by parsing the spec or calling any
// SUT). It encodes the DRAWN-mark ground truth — for a non-stacking aggregate one
// value per (dim,color) cell; for a stacking aggregate the per-dimension stack
// total — so a property passing is independent evidence the analysis names real
// marks. NO NEW DEPENDENCY: a hand-rolled deterministic cartesian enumeration.
// ============================================================================

const AGGREGATES = ['sum', 'count', 'average', 'min', 'max', 'median', 'distinct'] as const;
type Aggregate = (typeof AGGREGATES)[number];
type MeasureKind = 'numeric' | 'nonNumeric';
type ColorMode = 'none' | 'sameAsDim' | 'sub';

const DIM_FIELD = 'region';
const MEASURE_FIELD = 'orders';
const SUB_FIELD = 'product';
const ALL_DIMS = ['D0', 'D1', 'D2'] as const;

// A11Y-R needs stacking aggregates (sum/count) reduced to the per-dimension stack
// total; average/min/max/median/distinct reduced per drawn cell. This is the DRAWN
// ground truth, asserted independently of the runtime's own isStackTotalAggregate.
function isStackTotal(aggregate: Aggregate): boolean {
  return aggregate === 'sum' || aggregate === 'count';
}

// ---- one (dim, color) drawn cell + its raw measure values -------------------
interface CellDef {
  dim: string;
  /** the color-channel VALUE for this cell; undefined ⇒ no color field. */
  color?: string;
  values: unknown[];
}

// Deterministic construction: value base is distinct per (dim,color) so a
// dimension-level average/median differs from every per-cell reduction (the 105
// class). Non-numeric values are distinct strings so count/distinct are defined but
// sum/avg/min/max/median honestly drop out.
function cellDefs(dimCard: number, colorMode: ColorMode, cellRows: number, kind: MeasureKind): CellDef[] {
  const dims = ALL_DIMS.slice(0, dimCard);
  const defs: CellDef[] = [];
  dims.forEach((dim, di) => {
    // sameAsDim: the color VALUE equals the dim value (one color per dim, so the
    // composite key must dedup back to the dimension). sub: two genuine subgroups.
    const colors =
      colorMode === 'none' ? [undefined] : colorMode === 'sameAsDim' ? [dim] : ['g0', 'g1'];
    colors.forEach((color, ci) => {
      const base = (di + 1) * 1000 + (ci + 1) * 100;
      const values: unknown[] = [];
      for (let r = 0; r < cellRows; r += 1) {
        values.push(kind === 'numeric' ? base + r : `s${di}${ci}${r}`);
      }
      defs.push({ dim, color, values });
    });
  });
  return defs;
}

function reduceGroup(values: readonly unknown[], aggregate: Aggregate): number | undefined {
  if (aggregate === 'count') return values.length;
  if (aggregate === 'distinct') {
    const s = new Set<string>();
    for (const v of values) if (v !== null && v !== undefined) s.add(String(v));
    return s.size;
  }
  const numeric = values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (numeric.length === 0) return undefined;
  if (aggregate === 'sum') return numeric.reduce((a, b) => a + b, 0);
  if (aggregate === 'average') return numeric.reduce((a, b) => a + b, 0) / numeric.length;
  if (aggregate === 'min') return Math.min(...numeric);
  if (aggregate === 'max') return Math.max(...numeric);
  const sorted = [...numeric].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// The values the chart DRAWS, in first-appearance order, dropping undefined cells.
// Non-stacking ⇒ one point per (dim,color) cell; stacking ⇒ one per-dimension stack
// total (values merged across colors). Label is always the dimension value (what
// buildDataPoints labels a point by). sameAsDim collapses to per-dim for BOTH cases
// because each dim carries exactly one color.
function drawnReductions(defs: CellDef[], aggregate: Aggregate): { label: string; value: number }[] {
  const stacking = isStackTotal(aggregate);
  const order: string[] = [];
  const groups = new Map<string, { dim: string; values: unknown[] }>();
  for (const def of defs) {
    const key = stacking ? def.dim : `${def.dim}${def.color ?? ''}`;
    let g = groups.get(key);
    if (!g) {
      g = { dim: def.dim, values: [] };
      groups.set(key, g);
      order.push(key);
    }
    g.values.push(...def.values);
  }
  const points: { label: string; value: number }[] = [];
  for (const key of order) {
    const g = groups.get(key)!;
    const reduced = reduceGroup(g.values, aggregate);
    if (reduced !== undefined) points.push({ label: g.dim, value: reduced });
  }
  return points;
}

function aggSpec(dimCard: number, colorMode: ColorMode, cellRows: number, kind: MeasureKind, aggregate: Aggregate): NormalizedVizSpec {
  const defs = cellDefs(dimCard, colorMode, cellRows, kind);
  const rows: Record<string, unknown>[] = [];
  for (const def of defs) {
    for (const v of def.values) {
      const row: Record<string, unknown> = { [DIM_FIELD]: def.dim, [MEASURE_FIELD]: v };
      if (colorMode === 'sub') row[SUB_FIELD] = def.color;
      rows.push(row);
    }
  }
  const y = { field: MEASURE_FIELD, trait: 'EncodingY', aggregate };
  const encoding: Record<string, unknown> = {
    x: { field: DIM_FIELD, trait: 'EncodingX', scale: 'band' },
    y: { ...y },
  };
  // sameAsDim points the color channel at the DIMENSION field (redundant recolor);
  // sub points it at a genuine second field.
  if (colorMode === 'sameAsDim') {
    encoding.color = { field: DIM_FIELD, trait: 'EncodingColor', channel: 'color' };
  } else if (colorMode === 'sub') {
    encoding.color = { field: SUB_FIELD, trait: 'EncodingColor', channel: 'color' };
  }
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'multi-agg',
    name: 'Multi-grouping Aggregate',
    data: { name: 'panel', values: rows },
    marks: [{ trait: 'MarkBar', encodings: { ...encoding } }],
    encoding,
    a11y: { description: 'Aggregated measure by region under a color sub-grouping.' },
  } as NormalizedVizSpec;
}

// ---------------------------------------------------------------------------
// The full bounded cartesian.
// ---------------------------------------------------------------------------
interface Cell {
  aggregate: Aggregate;
  dimCard: number;
  colorMode: ColorMode;
  kind: MeasureKind;
  cellRows: number;
}
const DIM_CARDS = [1, 2, 3];
const COLOR_MODES: ColorMode[] = ['none', 'sameAsDim', 'sub'];
const KINDS: MeasureKind[] = ['numeric', 'nonNumeric'];
const CELL_ROWS = [1, 2];

const CELLS: Cell[] = [];
for (const aggregate of AGGREGATES) {
  for (const dimCard of DIM_CARDS) {
    for (const colorMode of COLOR_MODES) {
      for (const kind of KINDS) {
        for (const cellRows of CELL_ROWS) {
          CELLS.push({ aggregate, dimCard, colorMode, kind, cellRows });
        }
      }
    }
  }
}
const label = (c: Cell) => `${c.aggregate}/dim${c.dimCard}/${c.colorMode}/${c.kind}/rows${c.cellRows}`;

describe('s157 m02 — coverage (no silent cap)', () => {
  it('enumerated the full bounded product', () => {
    // 7 aggregates × 3 dimCard × 3 colorMode × 2 kind × 2 cellRows = 252.
    expect(CELLS.length).toBe(252);
  });
});

describe('s157 m02 property P4 — per-drawn-cell parity (extrema/total match the drawn marks)', () => {
  it('every cell: analysis max/min/total equal the standalone drawn-cell reduction', () => {
    const violations: string[] = [];
    for (const c of CELLS) {
      const analysis = analyzeVizSpec(aggSpec(c.dimCard, c.colorMode, c.cellRows, c.kind, c.aggregate));
      const points = drawnReductions(cellDefs(c.dimCard, c.colorMode, c.cellRows, c.kind), c.aggregate);
      if (points.length === 0) {
        if (analysis.max !== undefined || analysis.min !== undefined || analysis.total !== undefined) {
          violations.push(`${label(c)}: expected no dataPoints, got max=${analysis.max?.value}`);
        }
        continue;
      }
      const values = points.map((p) => p.value);
      const maxV = Math.max(...values);
      const minV = Math.min(...values);
      const maxLabels = points.filter((p) => p.value === maxV).map((p) => p.label);
      const minLabels = points.filter((p) => p.value === minV).map((p) => p.label);
      if (analysis.max?.value !== maxV) violations.push(`${label(c)}: max value ${analysis.max?.value} ≠ ${maxV}`);
      if (!maxLabels.includes(analysis.max?.label as string)) violations.push(`${label(c)}: max label ${analysis.max?.label} ∉ ${maxLabels}`);
      if (analysis.min?.value !== minV) violations.push(`${label(c)}: min value ${analysis.min?.value} ≠ ${minV}`);
      if (!minLabels.includes(analysis.min?.label as string)) violations.push(`${label(c)}: min label ${analysis.min?.label} ∉ ${minLabels}`);
      const expectedTotal = values.reduce((a, b) => a + b, 0);
      if (analysis.total !== expectedTotal) violations.push(`${label(c)}: total ${analysis.total} ≠ ${expectedTotal}`);
    }
    expect(violations, `${violations.length} parity violations:\n${violations.slice(0, 20).join('\n')}`).toEqual([]);
  });
});

describe('s157 m02 property P5 — NO PHANTOM (load-bearing: every extremum is a DRAWN value)', () => {
  it('every reported extremum ∈ the set of drawn-cell reductions (the 105 class is impossible)', () => {
    const violations: string[] = [];
    for (const c of CELLS) {
      const analysis = analyzeVizSpec(aggSpec(c.dimCard, c.colorMode, c.cellRows, c.kind, c.aggregate));
      const drawn = new Set(drawnReductions(cellDefs(c.dimCard, c.colorMode, c.cellRows, c.kind), c.aggregate).map((p) => p.value));
      if (drawn.size === 0) continue;
      if (analysis.max && !drawn.has(analysis.max.value)) violations.push(`${label(c)}: phantom max ${analysis.max.value} ∉ drawn ${[...drawn]}`);
      if (analysis.min && !drawn.has(analysis.min.value)) violations.push(`${label(c)}: phantom min ${analysis.min.value} ∉ drawn ${[...drawn]}`);
    }
    expect(violations, `${violations.length} phantom extrema:\n${violations.slice(0, 20).join('\n')}`).toEqual([]);
  });
});

describe('s157 m02 property P6 — undefined-cell-drop (honest silence, not phantom 0)', () => {
  it('sum/avg/min/max/median over a NON-numeric measure yields no dataPoints (no phantom 0)', () => {
    const nonSummable: Aggregate[] = ['sum', 'average', 'min', 'max', 'median'];
    for (const aggregate of nonSummable) {
      for (const colorMode of COLOR_MODES) {
        const analysis = analyzeVizSpec(aggSpec(2, colorMode, 2, 'nonNumeric', aggregate));
        expect(analysis.max, `${aggregate}/${colorMode}`).toBeUndefined();
        expect(analysis.min, `${aggregate}/${colorMode}`).toBeUndefined();
        expect(analysis.total, `${aggregate}/${colorMode}`).toBeUndefined();
      }
    }
  });
});

describe('s157 m02 — regression guards (byte-identical where s156 held)', () => {
  it('sameAsDim (color==dimension) ⇒ extrema/total identical to the no-color dimension-only projection', () => {
    for (const aggregate of AGGREGATES) {
      for (const kind of KINDS) {
        for (const cellRows of CELL_ROWS) {
          const none = analyzeVizSpec(aggSpec(3, 'none', cellRows, kind, aggregate));
          const same = analyzeVizSpec(aggSpec(3, 'sameAsDim', cellRows, kind, aggregate));
          const tag = `${aggregate}/${kind}/rows${cellRows}`;
          expect(same.max?.value, tag).toBe(none.max?.value);
          expect(same.min?.value, tag).toBe(none.min?.value);
          expect(same.total, tag).toBe(none.total);
        }
      }
    }
  });
});

// ============================================================================
// Concrete anchors — the memo's live-repro cases (RED-FIRST) + the A1/A2/A3 amendments.
// ============================================================================
describe('s157 m02 — concrete anchors', () => {
  // The memo §2 105-phantom: N/A=100 N/B=100 S/A=10 S/B=200, y average, color=product.
  // At HEAD max=105 (region mean, NO mark); after the fix max=200, min=10 (real cells).
  it('105-anchor (RED-first): grouped bar avg+color names a DRAWN value (200/10), never the 105 region-mean', () => {
    const rows = [
      { region: 'North', product: 'A', orders: 100 },
      { region: 'North', product: 'B', orders: 100 },
      { region: 'South', product: 'A', orders: 10 },
      { region: 'South', product: 'B', orders: 200 },
    ];
    const y = { field: 'orders', trait: 'EncodingY', aggregate: 'average' };
    const encoding = {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { ...y },
      color: { field: 'product', trait: 'EncodingColor', channel: 'color' },
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'phantom-105',
      name: 'Orders by region and product',
      data: { name: 'p', values: rows },
      marks: [{ trait: 'MarkBar', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'Average orders by region, split by product.' },
    } as unknown as NormalizedVizSpec;

    const analysis = analyzeVizSpec(spec);
    expect(analysis.max?.value).toBe(200); // drawn South/B
    expect(analysis.max?.label).toBe('South');
    expect(analysis.min?.value).toBe(10); // drawn South/A
    // The rendered narrative names a DRAWN value (assert the LABEL string), never 105.
    const { keyFindings } = generateNarrativeSummary(spec);
    const high = keyFindings.find((f) => /^High /.test(f));
    expect(high).toBeDefined();
    expect(high).toContain('200 (South)');
    expect(keyFindings.every((f) => !f.includes('105'))).toBe(true);
  });

  // s158 m4 (DE-MIRROR of the s157 mirror-oracle): a continuous-color heatmap draws one rect per
  // (x=region, y=hour) cell, so the narrated extrema MUST be a real DRAWN cell — never a per-region
  // marginal mean over hour, which is drawn on NO rect (the s157 survivor, review PS-2026-07-21-006).
  // The projection key now carries the SECOND positional dimension (y=hour), so groups are per
  // (region,hour): drawn max = 90 (South, hour 10), min = 10 (North, hour 9). The prior assertion
  // (max=70/min=20 = the South/North marginal means) CODIFIED the phantom and is corrected here.
  it('A1: color-is-measure heatmap names a DRAWN cell, not a per-region marginal mean', () => {
    const color = { field: 'temp', trait: 'EncodingColor', channel: 'color', type: 'quantitative', scale: 'linear', aggregate: 'average' };
    const encoding = {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { field: 'hour', trait: 'EncodingY', scale: 'band' },
      color,
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'heat',
      name: 'Temperature heatmap',
      data: {
        name: 'h',
        values: [
          { region: 'North', hour: 9, temp: 10 },
          { region: 'North', hour: 10, temp: 30 },
          { region: 'South', hour: 9, temp: 50 },
          { region: 'South', hour: 10, temp: 90 },
        ],
      },
      marks: [{ trait: 'MarkRect', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'Average temperature by region and hour.' },
    } as unknown as NormalizedVizSpec;

    const analysis = analyzeVizSpec(spec);
    // Drawn (region,hour) cells: North/9=10, North/10=30, South/9=50, South/10=90.
    expect(analysis.max?.value).toBe(90); // drawn South/hour-10, never the 70 marginal mean
    expect(analysis.max?.label).toBe('South');
    expect(analysis.min?.value).toBe(10); // drawn North/hour-9, never the 20 marginal mean
    expect(analysis.min?.label).toBe('North');
  });

  // A2 — a STACKING aggregate (sum) over a color sub-group keeps the per-dimension
  // stack total (the drawn bar height), NOT a per-cell segment. North stack=100+40=140,
  // South stack=10+200=210 → max=210 is the drawn stack height for South.
  it('A2: stacked sum+color reduces to the per-dimension stack total (the drawn bar height)', () => {
    const rows = [
      { region: 'North', product: 'A', orders: 100 },
      { region: 'North', product: 'B', orders: 40 },
      { region: 'South', product: 'A', orders: 10 },
      { region: 'South', product: 'B', orders: 200 },
    ];
    const y = { field: 'orders', trait: 'EncodingY', aggregate: 'sum' };
    const encoding = {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { ...y },
      color: { field: 'product', trait: 'EncodingColor', channel: 'color' },
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'stack-sum',
      name: 'Total orders by region',
      data: { name: 'p', values: rows },
      marks: [{ trait: 'MarkBar', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'Total orders by region, stacked by product.' },
    } as unknown as NormalizedVizSpec;

    const analysis = analyzeVizSpec(spec);
    expect(analysis.max?.value).toBe(210); // South stack total (drawn bar height)
    expect(analysis.max?.label).toBe('South');
    expect(analysis.min?.value).toBe(140); // North stack total
    expect(analysis.total).toBe(350); // 140 + 210
  });

  // A3 — a DETAIL sub-group (not color) folds into the per-cell projection too.
  // North detail x=100, y=100; South detail x=10, y=200 → per-cell drawn 100/100/10/200.
  it('A3: detail-grouped sub-cells project per drawn cell (detail folded into the key)', () => {
    const rows = [
      { region: 'North', line: 'x', orders: 100 },
      { region: 'North', line: 'y', orders: 100 },
      { region: 'South', line: 'x', orders: 10 },
      { region: 'South', line: 'y', orders: 200 },
    ];
    const y = { field: 'orders', trait: 'EncodingY', aggregate: 'average' };
    const encoding = {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { ...y },
      detail: { field: 'line', trait: 'EncodingDetail', channel: 'detail' },
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'detail-sub',
      name: 'Average orders by region and line',
      data: { name: 'p', values: rows },
      marks: [{ trait: 'MarkBar', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'Average orders by region, split by line.' },
    } as unknown as NormalizedVizSpec;

    const analysis = analyzeVizSpec(spec);
    expect(analysis.max?.value).toBe(200); // drawn South/y — never the 105 region mean
    expect(analysis.min?.value).toBe(10); // drawn South/x
  });
});
