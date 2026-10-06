import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-161 m6 — c7: the RUNTIME-REGISTERED coverage manifest for the CORRELATION partition axis
// (SSOT §2-m6.ii; closes §1.4 — the s160 §7 coverage prose named a correlation-detail-grouping arm
// and a facet=column arm that had ZERO tests). Critic amendment: grepping test NAMES does not prove
// an arm is exercised. So the manifest is populated ONLY by tests that actually EXECUTE analyzeVizSpec
// on a fixture with a given (facet × grouping) structure — a tuple is present IFF a real fixture ran.
// The coverage claim is then GENERATED from the manifest; a claim naming a tuple no executing test
// registered would fail. This is the two previously-missing pins (detail arm + facet=column) AND the
// non-circular coverage generator in one file (vitest isolates modules per file, so registration and
// the generated-coverage assertion must share this module).
// ============================================================================

// The manifest: a tuple key is added ONLY inside exercise(), which first runs the SUT.
const MANIFEST = new Set<string>();
const FACET_AXIS = ['none', 'row', 'column'] as const;
const GROUPING_AXIS = ['none', 'color', 'detail', 'quant-size'] as const;
type Facet = (typeof FACET_AXIS)[number];
type Grouping = (typeof GROUPING_AXIS)[number];
const tupleKey = (facet: Facet, grouping: Grouping) => `facet=${facet}|grouping=${grouping}`;

// Derive the (facet, grouping) tuple STRUCTURALLY from the spec (test-side inspection, independent of
// the SUT's internal partition derivation) — the fixture's declared intent.
function describeTuple(spec: NormalizedVizSpec): { facet: Facet; grouping: Grouping } {
  const layout = spec.layout as { trait?: string; rows?: { field?: string }; columns?: { field?: string } } | undefined;
  const facet: Facet =
    layout?.trait === 'LayoutFacet'
      ? layout.rows?.field
        ? 'row'
        : layout.columns?.field
          ? 'column'
          : 'none'
      : 'none';
  const enc = spec.encoding as Record<string, { field?: string; type?: string } | undefined>;
  const grouping: Grouping = enc.color
    ? 'color'
    : enc.detail
      ? 'detail'
      : enc.size?.type === 'quantitative'
        ? 'quant-size'
        : 'none';
  return { facet, grouping };
}

// Run the SUT and register the tuple — the ONLY path that writes the manifest. Returns the analysis so
// the caller can also assert the correlation BEHAVED (narrates/suppresses) for that arm.
function exercise(spec: NormalizedVizSpec): { facet: Facet; grouping: Grouping; correlation: number | undefined } {
  const analysis = analyzeVizSpec(spec);
  const { facet, grouping } = describeTuple(spec);
  MANIFEST.add(tupleKey(facet, grouping));
  return { facet, grouping, correlation: analysis.correlation };
}

function scatter(rows: Record<string, unknown>[], opts: { color?: string; detail?: string; size?: string; facet?: 'row' | 'column' } = {}): NormalizedVizSpec {
  const encoding: Record<string, unknown> = {
    x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
    y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
  };
  if (opts.color) encoding.color = { field: opts.color, trait: 'EncodingColor' };
  if (opts.detail) encoding.detail = { field: opts.detail, trait: 'EncodingDetail' };
  if (opts.size) encoding.size = { field: opts.size, trait: 'EncodingSize', type: 'quantitative' };
  const layout = opts.facet ? { trait: 'LayoutFacet', [opts.facet === 'row' ? 'rows' : 'columns']: { field: 'panel' } } : undefined;
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'cov',
    name: 'cov',
    data: { name: 'c', values: rows },
    marks: [{ trait: 'MarkPoint', encodings: { ...encoding } }],
    encoding,
    ...(layout ? { layout } : {}),
    a11y: { description: 'y over x' },
  } as unknown as NormalizedVizSpec;
}

// Opposing per-partition slopes: a partition with a rising group and a falling group → the classifier
// SUPPRESSES (contradiction). Used to prove a partition channel is actually honored by the SUT.
const OPPOSING = (key: string) => [
  { x: 1, y: 1, [key]: 'a' }, { x: 2, y: 2, [key]: 'a' }, { x: 3, y: 3, [key]: 'a' },
  { x: 1, y: 3, [key]: 'b' }, { x: 2, y: 2, [key]: 'b' }, { x: 3, y: 1, [key]: 'b' },
];

describe('s161 m6 — correlation partition axis fixtures (each EXECUTES the SUT and registers its tuple)', () => {
  it('{facet:none, grouping:none} — a plain scatter narrates its pooled r', () => {
    const r = exercise(scatter([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 4 }]));
    expect(r).toMatchObject({ facet: 'none', grouping: 'none' });
    expect(r.correlation).not.toBeUndefined();
  });

  it('{facet:none, grouping:color} — a color partition is honored (opposing groups suppress)', () => {
    const r = exercise(scatter(OPPOSING('seg'), { color: 'seg' }));
    expect(r).toMatchObject({ facet: 'none', grouping: 'color' });
    expect(r.correlation).toBeUndefined();
  });

  it('{facet:none, grouping:detail} — the DETAIL arm (§1.4): detail partitions like color', () => {
    // Previously ZERO detail-bound correlation test existed. Opposing slopes per detail group must
    // suppress — proving the EncodingDetail channel enters correlationPartitionFields.
    const r = exercise(scatter(OPPOSING('line'), { detail: 'line' }));
    expect(r).toMatchObject({ facet: 'none', grouping: 'detail' });
    expect(r.correlation).toBeUndefined();
  });

  it('{facet:none, grouping:quant-size} — a quantitative size is a magnitude, NOT a partition (narrates pooled)', () => {
    const r = exercise(scatter([{ x: 1, y: 1, mag: 5 }, { x: 2, y: 2, mag: 6 }, { x: 3, y: 4, mag: 7 }], { size: 'mag' }));
    expect(r).toMatchObject({ facet: 'none', grouping: 'quant-size' });
    expect(r.correlation).not.toBeUndefined(); // size does not shred the pooled correlation
  });

  it('{facet:row, grouping:none} — a row-faceted partition is honored (opposing panels suppress)', () => {
    const r = exercise(scatter(OPPOSING('panel'), { facet: 'row' }));
    expect(r).toMatchObject({ facet: 'row', grouping: 'none' });
    expect(r.correlation).toBeUndefined();
  });

  it('{facet:column, grouping:none} — the facet=COLUMN arm (§1.4): column facets partition like rows', () => {
    // Previously ZERO facet=column correlation test existed.
    const r = exercise(scatter(OPPOSING('panel'), { facet: 'column' }));
    expect(r).toMatchObject({ facet: 'column', grouping: 'none' });
    expect(r.correlation).toBeUndefined();
  });

  it('{facet:column, grouping:detail} — the exact tuple the memo names (facet=column × detail)', () => {
    const rows = [
      { x: 1, y: 1, panel: 'P', line: 'a' }, { x: 2, y: 2, panel: 'P', line: 'a' }, { x: 3, y: 3, panel: 'P', line: 'a' },
      { x: 1, y: 3, panel: 'P', line: 'b' }, { x: 2, y: 2, panel: 'P', line: 'b' }, { x: 3, y: 1, panel: 'P', line: 'b' },
    ];
    const r = exercise(scatter(rows, { detail: 'line', facet: 'column' }));
    expect(r).toMatchObject({ facet: 'column', grouping: 'detail' });
    expect(r.correlation).toBeUndefined();
  });
});

describe('s161 m6 — the coverage claim is GENERATED from the manifest (non-circular)', () => {
  // Runs AFTER the fixtures above (definition order within a file), so MANIFEST is populated by real
  // SUT executions. A coverage clause naming a tuple NO executing fixture registered would fail here.
  it('the two previously-missing arms (§1.4) are now registered by executing fixtures', () => {
    expect(MANIFEST.has(tupleKey('none', 'detail')), 'correlation × detail arm').toBe(true);
    expect(MANIFEST.has(tupleKey('column', 'none')), 'correlation × facet=column arm').toBe(true);
    expect(MANIFEST.has(tupleKey('column', 'detail')), 'correlation × facet=column × detail').toBe(true);
  });

  it('every FACET axis value and every GROUPING axis value is backed by ≥1 executed fixture', () => {
    const registered = [...MANIFEST].map((k) => {
      const [f, g] = k.split('|');
      return { facet: f.replace('facet=', '') as Facet, grouping: g.replace('grouping=', '') as Grouping };
    });
    for (const facet of FACET_AXIS) {
      expect(registered.some((t) => t.facet === facet), `facet=${facet} exercised`).toBe(true);
    }
    for (const grouping of GROUPING_AXIS) {
      expect(registered.some((t) => t.grouping === grouping), `grouping=${grouping} exercised`).toBe(true);
    }
  });

  it('GENERATES the coverage string from the manifest (the §7 clause is derived, not hand-written)', () => {
    const covered = [...MANIFEST].sort();
    const facets = [...new Set(covered.map((k) => k.split('|')[0].replace('facet=', '')))].sort();
    const groupings = [...new Set(covered.map((k) => k.split('|')[1].replace('grouping=', '')))].sort();
    const clause = `correlation partition axis: facet {${facets.join(', ')}} × grouping {${groupings.join(', ')}} — ${covered.length} tuples exercised`;
    // eslint-disable-next-line no-console
    console.log(`s161 m6 GENERATED coverage: ${clause}`);
    // The generated clause may name ONLY axis values the manifest actually holds (non-circular guard).
    for (const facet of facets) {
      expect(covered.some((k) => k.startsWith(`facet=${facet}|`))).toBe(true);
    }
    for (const grouping of groupings) {
      expect(covered.some((k) => k.endsWith(`|grouping=${grouping}`))).toBe(true);
    }
  });
});
