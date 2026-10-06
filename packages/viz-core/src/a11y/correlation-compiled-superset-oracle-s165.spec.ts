import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import { toVegaLiteSpec } from '../adapters/vega-lite-adapter.js';
import {
  correlationGateFields,
  correlationSeparabilityEvidence,
  resolvePrimaryChannels,
  getEncodingBinding,
  separableFields,
} from './data-analysis.js';

/**
 * s165 m3 — the COMPILED-SUPERSET ORACLE (SSOT §4) and the COST BOUNDS (§3.6).
 *
 * §3.1's `separableFields` is a fail-safe SUPERSET of the fields that actually split drawn marks. That
 * claim is checkable against ONE renderer: compile the spec through `toVegaLiteSpec` and read back the
 * channels the compiled output really carries. The oracle asserts
 *
 *     separableFields(spec)  ⊇  compiledSplitFields(spec)
 *
 * HONEST SCOPE (§4, amendment A8) — what this oracle does NOT do:
 *  - it validates the SUPERSET RELATION only; it proves nothing about §3.2's decision logic (that rests on
 *    the RED-first fixtures, the monotonicity oracle, and the genuine-close review);
 *  - the dimension/measure exclusion is SHARED (both sides call `resolvePrimaryChannels`), so the oracle
 *    asserts nothing about it;
 *  - ONE renderer, and only the channel→field mapping. **ECharts coverage is ZERO, not partial** — that
 *    adapter has no shape channel, routes `detail` to tooltip only, and uses `colorBy:'data'`; the superset
 *    holds there a fortiori by argument, not by test;
 *  - a `bindTo:'visual' property:'color'` interaction overwrites the compiled color encoding with a
 *    field-less condition, so the oracle passes VACUOUSLY for such a spec (pinned below, not hidden);
 *  - the claim "a new splitting channel goes RED" is DELETED. It is false under an allow-list extractor,
 *    and a new *normalized* channel is already a compile error in `CHANNEL_GROUPING_ROLE`'s exhaustive
 *    Record. What the deny-list buys is coverage of a new *adapter-emitted* channel — proven below.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');

// ─────────────────────────────────────────────────────────────────────────────
// The extractor: a DENY-LIST over compiled encoding channels
// ─────────────────────────────────────────────────────────────────────────────
// PINNED. An ALLOW-LIST (color/size/shape/detail) is structurally blind to any channel the adapter
// learns to emit later — proven in the strokeDash test below. The denied set is exactly the channels that
// are NOT visual separators: the positional axes and band endpoints (the correlation's own geometry) plus
// the non-visual/annotation channels.
const DENIED_COMPILED_CHANNELS = new Set(['x', 'y', 'x2', 'y2', 'tooltip', 'order', 'text', 'href', 'key']);

// Every mark trait `toVegaLiteSpec` can compile. It THROWS on anything else (MarkRule / MarkText /
// MarkArc / MarkGeoshape), which `analyzeVizSpec` still narrates for — so those fixtures are OUT OF DOMAIN
// and are COUNTED, never silently swallowed.
const COMPILABLE_MARK_TRAITS = new Set(['MarkBar', 'MarkLine', 'MarkPoint', 'MarkArea', 'MarkRect']);
const inCompileDomain = (spec: NormalizedVizSpec): boolean =>
  Array.isArray(spec.marks) &&
  spec.marks.length > 0 &&
  spec.marks.every((mark) => COMPILABLE_MARK_TRAITS.has(mark.trait));

/**
 * Walk the compiled Vega-Lite object and collect every field bound to a channel that is NOT denied.
 * Recursive because the adapter emits four different shapes: a bare `{mark, encoding}`, a `{layer:[…]}`
 * (one layer per mark), a `{facet, spec}` (small multiples), and concat sections. `facet.row/column` are
 * collected explicitly — they are panels, not an encoding channel.
 */
function collectCompiledSplitFields(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectCompiledSplitFields(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'encoding' && value && typeof value === 'object') {
      for (const [channel, binding] of Object.entries(value as Record<string, unknown>)) {
        if (DENIED_COMPILED_CHANNELS.has(channel)) continue;
        const field = (binding as { field?: unknown } | null)?.field;
        if (typeof field === 'string') out.add(field);
      }
      continue;
    }
    if (key === 'facet' && value && typeof value === 'object') {
      for (const panel of Object.values(value as Record<string, unknown>)) {
        const field = (panel as { field?: unknown } | null)?.field;
        if (typeof field === 'string') out.add(field);
      }
      continue;
    }
    // `usermeta` is a 60-byte provenance stamp with no encoding blocks; everything else is walked.
    if (key !== 'usermeta') collectCompiledSplitFields(value, out);
  }
}

function compiledSplitFields(spec: NormalizedVizSpec): string[] {
  const out = new Set<string>();
  collectCompiledSplitFields(toVegaLiteSpec(spec), out);
  return [...out];
}

// The SHARED exclusion (disclosed above): the correlation's own two axes are not separators.
function correlationAxes(spec: NormalizedVizSpec): { dimensionField: string; measureField: string } {
  const channels = resolvePrimaryChannels(spec);
  return {
    dimensionField: getEncodingBinding(spec, channels.dimensionChannel)?.field ?? '',
    measureField: getEncodingBinding(spec, channels.measureChannel)?.field ?? '',
  };
}

function assertSuperset(label: string, spec: NormalizedVizSpec): void {
  const { dimensionField, measureField } = correlationAxes(spec);
  const superset = separableFields(spec, dimensionField, measureField);
  const compiled = compiledSplitFields(spec).filter(
    (field) => field !== dimensionField && field !== measureField
  );
  const missing = compiled.filter((field) => !superset.includes(field));
  expect(missing, `${label}: compiled splits not in the superset — superset=[${superset}] compiled=[${compiled}]`).toEqual([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) THE ORACLE over the shipped corpus, with the DOMAIN pinned
// ─────────────────────────────────────────────────────────────────────────────
// A typed recursive walk instead of fs.globSync — this file lives under src/, which the package
// tsconfig typechecks, and the installed @types/node does not declare globSync.
function specJsonFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...specJsonFilesUnder(full));
    else if (entry.isFile() && entry.name.endsWith('.spec.json')) out.push(full);
  }
  return out;
}
const CORPUS = [...new Set(specJsonFilesUnder(path.join(REPO_ROOT, 'examples/viz')))].sort();

describe('s165 m3 §4 — separableFields ⊇ compiledSplitFields over the shipped corpus', () => {
  it('the corpus is non-empty (a corpus move cannot hollow this gate)', () => {
    expect(CORPUS.length).toBe(44);
  });

  it('every IN-DOMAIN corpus spec satisfies the superset relation, and the skips are COUNTED', () => {
    let checked = 0;
    let skipped = 0;
    const skippedTraits = new Set<string>();
    for (const file of CORPUS) {
      const spec = JSON.parse(readFileSync(file, 'utf8')) as NormalizedVizSpec;
      if (!inCompileDomain(spec)) {
        skipped += 1;
        for (const mark of spec.marks ?? []) {
          if (!COMPILABLE_MARK_TRAITS.has(mark.trait)) skippedTraits.add(mark.trait);
        }
        continue;
      }
      // NOT wrapped in try/catch: an in-domain spec that throws is a DOMAIN-PIN failure, not a skip.
      assertSuperset(path.relative(REPO_ROOT, file), spec);
      checked += 1;
    }
    // Pinned so a domain drift (fixtures silently skipped) turns this RED rather than shrinking coverage
    // quietly. MEASURED TRUTH: the shipped corpus has ZERO out-of-domain fixtures, so the skip-counting
    // machinery is INERT here — the domain gap is real but is proven only by the dedicated throw test
    // below, never by a corpus instance. Stated rather than left to look like coverage.
    expect(checked).toBe(44);
    expect(skipped).toBe(0);
    expect([...skippedTraits]).toEqual([]);
  });

  it('the domain gap is CONCRETE: analyzeVizSpec reaches the gate on a spec the oracle cannot compile', () => {
    // MarkRule normalizes to 'unknown', so a categorical shape on it is separable (m1 mechanism 1) and the
    // correlation gate runs — but toVegaLiteSpec THROWS, so the superset relation is UNVERIFIABLE for this
    // spec. No corpus fixture is in this class; the gap is disclosed, not covered.
    const enc = {
      x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
      shape: { field: 'shp', trait: 'EncodingShape' },
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'gap',
      name: 'gap',
      data: {
        name: 'd',
        values: [
          { x: 1, y: 10, shp: 'a' },
          { x: 2, y: 20, shp: 'a' },
          { x: 3, y: 30, shp: 'b' },
        ],
      },
      marks: [{ trait: 'MarkRule', encodings: enc }],
      encoding: enc,
      a11y: { description: 'd' },
    } as unknown as NormalizedVizSpec;
    expect(correlationGateFields(spec).separableFields).toEqual(['shp']);
    expect(() => analyzeVizSpec(spec)).not.toThrow();
    expect(() => compiledSplitFields(spec)).toThrow(/Unsupported mark trait/);
  });

  it('the out-of-domain traits really do THROW (the domain pin is a fact, not an assumption)', () => {
    const enc = {
      x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
    };
    for (const trait of ['MarkRule', 'MarkText', 'MarkArc', 'MarkGeoshape']) {
      const spec = {
        $schema: 'https://oods-foundry.com/viz-spec/v1',
        id: 'dom',
        name: 'dom',
        data: { name: 'd', values: [{ x: 1, y: 2 }] },
        marks: [{ trait, encodings: enc }],
        encoding: enc,
        a11y: { description: 'd' },
      } as unknown as NormalizedVizSpec;
      expect(() => toVegaLiteSpec(spec), trait).toThrow(/Unsupported mark trait/);
      // …and analyzeVizSpec still narrates for them, which is exactly why this is a disclosed gap.
      expect(() => analyzeVizSpec(spec)).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) THE ORACLE over the structural space + the four survivors
// ─────────────────────────────────────────────────────────────────────────────
const XY = {
  x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
};
const structural = (
  traits: string[],
  encoding: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): NormalizedVizSpec =>
  ({
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'struct',
    name: 'struct',
    data: { name: 'd', values: [{ x: 1, y: 2, seg: 'a', grp: 'p', sz: 10, dt: 1 }, { x: 2, y: 4, seg: 'b', grp: 'q', sz: 20, dt: 2 }] },
    marks: traits.map((trait) => ({ trait, encodings: { ...encoding } })),
    encoding,
    a11y: { description: 'd' },
    ...extra,
  }) as unknown as NormalizedVizSpec;

describe('s165 m3 §4 — the superset relation holds across the compilable structural space', () => {
  it('every mark × channel × facet combination in the compile domain satisfies it', () => {
    const MARK_SETS = [['MarkBar'], ['MarkLine'], ['MarkPoint'], ['MarkArea'], ['MarkRect'], ['MarkLine', 'MarkPoint']];
    const CHANNELS: [string, string, string][] = [
      ['color', 'EncodingColor', 'seg'],
      ['size', 'EncodingSize', 'sz'],
      ['shape', 'EncodingShape', 'grp'],
      ['detail', 'EncodingDetail', 'dt'],
    ];
    let checked = 0;
    for (const traits of MARK_SETS) {
      for (const [channel, trait, field] of CHANNELS) {
        for (const quantitative of [false, true]) {
          for (const facet of [false, true]) {
            for (const aggregate of [undefined, 'sum', 'average']) {
              const encoding: Record<string, unknown> = {
                x: XY.x,
                y: { field: 'y', trait: 'EncodingY', type: 'quantitative', ...(aggregate ? { aggregate } : {}) },
                [channel]: { field, trait, ...(quantitative ? { type: 'quantitative' } : {}) },
              };
              const spec = structural(
                traits,
                encoding,
                facet ? { layout: { trait: 'LayoutFacet', columns: { field: 'grp' } } } : {}
              );
              assertSuperset(`${traits}/${channel}/${quantitative ? 'quant' : 'cat'}/facet=${facet}/agg=${aggregate}`, spec);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBe(288);
  });

  it('PER-LAYER bindings: the layer-1 field is in the compiled output AND in the superset (survivor D)', () => {
    const spec = structural([], XY) as unknown as Record<string, unknown>;
    const layered = {
      ...spec,
      marks: [
        { trait: 'MarkLine', encodings: { ...XY, color: { field: 'seg', trait: 'EncodingColor' } } },
        { trait: 'MarkPoint', encodings: { ...XY, color: { field: 'grp', trait: 'EncodingColor' } } },
      ],
      encoding: XY,
    } as unknown as NormalizedVizSpec;
    // the compiled output really draws BOTH — this is the fact that made D a live phantom
    expect(compiledSplitFields(layered).sort()).toEqual(['grp', 'seg']);
    assertSuperset('per-layer color', layered);
  });

  it('a faceted spec contributes its panel fields on BOTH sides', () => {
    const enc = { ...XY, color: { field: 'seg', trait: 'EncodingColor' } };
    const spec = structural(['MarkPoint'], enc, {
      layout: { trait: 'LayoutFacet', rows: { field: 'grp' }, columns: { field: 'dt' } },
    });
    expect(compiledSplitFields(spec).sort()).toEqual(['dt', 'grp', 'seg']);
    assertSuperset('faceted rows+columns', spec);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) WHY A DENY-LIST — the proof an allow-list would be blind
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m3 §4 — the extractor is a DENY-LIST, and that choice is load-bearing', () => {
  const enc = { ...XY, color: { field: 'seg', trait: 'EncodingColor' } };
  const compiled = () => toVegaLiteSpec(structural(['MarkPoint'], enc)) as unknown as Record<string, unknown>;

  it('a channel the adapter learns to emit later (strokeDash) is CAUGHT by the deny-list', () => {
    const injected = compiled();
    // simulate a future adapter emitting a new visual channel bound to a field
    (injected.encoding as Record<string, unknown>).strokeDash = { field: 'newSplitter', type: 'nominal' };
    const found = new Set<string>();
    collectCompiledSplitFields(injected, found);
    expect(found.has('newSplitter')).toBe(true);
  });

  it('the same injection is INVISIBLE to an allow-list extractor (which is why §4 rejects one)', () => {
    const injected = compiled();
    (injected.encoding as Record<string, unknown>).strokeDash = { field: 'newSplitter', type: 'nominal' };
    const ALLOWED = new Set(['color', 'size', 'shape', 'detail']);
    const allowListFound = Object.entries((injected.encoding as Record<string, unknown>) ?? {})
      .filter(([channel]) => ALLOWED.has(channel))
      .map(([, binding]) => (binding as { field?: string }).field)
      .filter((field): field is string => typeof field === 'string');
    expect(allowListFound).not.toContain('newSplitter');
  });

  it('the denied set is PINNED (a silent widening would hollow the oracle)', () => {
    expect([...DENIED_COMPILED_CHANNELS].sort()).toEqual([
      'href', 'key', 'order', 'text', 'tooltip', 'x', 'x2', 'y', 'y2',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) THE DISCLOSED VACUOUS PASS — named, not hidden
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m3 §4 — the bindTo:visual color interaction makes the oracle pass VACUOUSLY', () => {
  it('a visual color interaction erases the compiled color FIELD, so the oracle checks nothing there', () => {
    const enc = { ...XY, color: { field: 'seg', trait: 'EncodingColor' } };
    const spec = structural(['MarkPoint'], enc, {
      interactions: [
        {
          id: 'hl',
          select: { type: 'point', on: 'mouseover', fields: ['seg'] },
          rule: {
            bindTo: 'visual',
            property: 'color',
            condition: { value: '#f00' },
            else: { value: '#ccc' },
          },
        },
      ],
    });
    // the compiled color encoding is now a field-LESS condition → the extractor finds no color field
    expect(compiledSplitFields(spec)).not.toContain('seg');
    // the superset still carries it (so the gate still scans it — the vacuity is the ORACLE's, not the gate's)
    expect(correlationGateFields(spec).separableFields).toContain('seg');
    assertSuperset('visual-color interaction (vacuous)', spec);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (5) §3.6 COST BOUNDS — a STRUCTURAL assertion, not a wall clock
// ─────────────────────────────────────────────────────────────────────────────
// A per-subset row-walk implementation reads O(2^k × rows) row properties; bucket-once reads O(rows).
// Measured on this exact fixture: bucket-once ≈ 78 reads/row, the row-walk shape it replaced ≈ 151. The
// threshold below separates them with margin in both directions and is deterministic (no timing).
describe('s165 m3 §3.6 — the subset lattice never re-walks the rows (bucket once, merge upward)', () => {
  function proxiedSpec(rowCount: number, counter: { reads: number }): NormalizedVizSpec {
    const segs = ['A', 'B', 'C'];
    const values: unknown[] = [];
    for (let i = 0; i < rowCount; i += 1) {
      const raw: Record<string, unknown> = {
        x: i % 40,
        y: 100 + (i % 40) * 3 + (i % 7),
        seg: segs[i % segs.length],
        sz: (i % 4) * 10 + 10,
        dt: i % 25,
      };
      values.push(
        new Proxy(raw, {
          get(target, prop, receiver) {
            if (typeof prop === 'string') counter.reads += 1;
            return Reflect.get(target, prop, receiver);
          },
        })
      );
    }
    const encoding: Record<string, unknown> = {
      x: XY.x,
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
      color: { field: 'seg', trait: 'EncodingColor' },
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
      detail: { field: 'dt', trait: 'EncodingDetail', type: 'quantitative' },
    };
    return {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'cost',
      name: 'cost',
      data: { name: 'd', values },
      marks: [{ trait: 'MarkPoint', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'd' },
    } as unknown as NormalizedVizSpec;
  }

  it('row property reads stay LINEAR in row count at 10k rows with 3 separable fields', () => {
    const counter = { reads: 0 };
    const spec = proxiedSpec(10_000, counter);
    expect(correlationGateFields(spec).separableFields).toEqual(['seg', 'sz', 'dt']);
    analyzeVizSpec(spec);
    const perRow = counter.reads / 10_000;
    // bucket-once measured 77.6; the per-subset row-walk it replaced measured 150.6.
    expect(perRow).toBeLessThan(110);
  });

  it('the read count scales LINEARLY, not with the 2^k lattice (2× rows ⇒ ~2× reads)', () => {
    const small = { reads: 0 };
    analyzeVizSpec(proxiedSpec(2_000, small));
    const large = { reads: 0 };
    analyzeVizSpec(proxiedSpec(4_000, large));
    expect(large.reads / small.reads).toBeLessThan(2.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (6) §3.6 THE CAP — above it, SUPPRESS (never drop fields)
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m3 §3.6 — above the |separableFields| cap the gate SUPPRESSES, it does not drop fields', () => {
  // 9 distinct separable fields via per-layer color bindings (the m1 union) — one over the cap of 8.
  function overCap(fieldCount: number): NormalizedVizSpec {
    const values: Record<string, unknown>[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const row: Record<string, unknown> = { x: i, y: i * 10 };
      for (let f = 0; f < fieldCount; f += 1) row[`f${f}`] = `v${i % 2}`;
      values.push(row);
    }
    return {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'cap',
      name: 'cap',
      data: { name: 'd', values },
      marks: Array.from({ length: fieldCount }, (_, f) => ({
        trait: 'MarkPoint',
        encodings: { ...XY, color: { field: `f${f}`, trait: 'EncodingColor' } },
      })),
      encoding: XY,
      a11y: { description: 'd' },
    } as unknown as NormalizedVizSpec;
  }

  it('AT the cap (8 fields) the scan runs normally and this honest rise narrates', () => {
    const spec = overCap(8);
    expect(correlationGateFields(spec).separableFields).toHaveLength(8);
    expect(analyzeVizSpec(spec).correlation).toBeDefined();
  });

  it('ABOVE the cap (9 fields) the SAME honest rise is SUPPRESSED — fail-safe to silence', () => {
    const spec = overCap(9);
    // the fields are all still ENUMERATED (nothing dropped) — the gate simply refuses to narrate
    expect(correlationGateFields(spec).separableFields).toHaveLength(9);
    expect(correlationSeparabilityEvidence(spec).suppresses).toBe(true);
    expect(analyzeVizSpec(spec).correlation).toBeUndefined();
  });
});
