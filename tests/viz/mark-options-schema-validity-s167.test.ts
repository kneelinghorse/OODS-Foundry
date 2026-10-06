/**
 * OODS-only `mark.options` keys must not invalidate the emitted Vega-Lite mark definition.
 *
 * s167 m03 opened this file. s168 m02 REPLACED its oracle and widened its coverage; the
 * filename is kept so the arc reads as one story.
 *
 * ── WHAT s167 GOT RIGHT ────────────────────────────────────────────────────────────
 * `createMark` spread `mark.options` wholesale into the mark def. The emitted spec stamps
 * the Vega-Lite v6 `$schema`, whose `MarkDef` is `additionalProperties: false`, so every
 * OODS-only key rode out as a schema violation — including `id`, which the s166 docs
 * PRESCRIBE for ordering repeated same-trait layers. Following the documented pattern
 * emitted an invalid spec. That defect, and its keep-green constraints, are still pinned
 * below.
 *
 * ── WHAT s167 GOT WRONG, AND HOW ───────────────────────────────────────────────────
 * TWO independent errors, each of which alone was enough to let the defect survive a
 * mission aimed at it:
 *
 *   1. THE ORACLE WAS SHAPE-BLIND. Errors were filtered with `/^\/layer\/\d+\/mark/`,
 *      which matches LAYERED specs only. All four still-invalid committed fixtures are
 *      UNIT specs, anchored at `/mark` — so the oracle could not have caught them at any
 *      severity. This file now compiles `{...schema, $ref:'#/definitions/MarkDef'}` once
 *      and validates every emitted mark def as a STANDALONE object, found by walking the
 *      compiled spec. Unit, layered, or nested: same check.
 *
 *   2. THE DENYLIST DERIVED FROM THE CORPUS, NOT THE SURFACE. s167 enumerated the keys
 *      that happened to appear in committed fixtures and denied the two OODS-only ones.
 *      The declared surface is `schemas/traits/mark-*.parameters.schema.json` — closed
 *      per-trait vocabularies that s167 never opened. Unioned with the corpus and the
 *      keys the ECharts adapter and React views read off the IR, FOURTEEN keys are not
 *      MarkDef properties. An allowlist covers all fourteen and every key a future trait
 *      adds; a denylist covers only what someone remembered.
 *
 * MEASURED AGAINST THE PRE-FIX ADAPTER, per key, as a standalone MarkDef:
 *   `orientation` `bandPadding` `stacking` `join` `enableMarkers` → `/` additionalProperties
 *   `baseline:'zero'`                                            → `/baseline` enum/const
 *   `baseline:0`                                                 → `/baseline` type
 *   `fill:'hollow'`                                              → VALID, and wrong: `fill`
 *       is a real MarkDef property accepting any string as a Color, so ajv accepts it while
 *       the mark paints with a non-colour. No allowlist can catch this one — it needs a
 *       value check, which is why `fill` has its own control below.
 * Corpus, same run: 42 mark-bearing fixtures, 4 invalid mark defs → 0 after the fix.
 *
 * ── CLAIM CEILING ──────────────────────────────────────────────────────────────────
 * No OODS-only key reaches the emitted mark def, every declared Cartesian trait option
 * is covered by a probe, and every committed mark-bearing fixture emits a schema-valid mark def.
 * Whole-spec validity is checked directly for all 44 mark-bearing product fixtures,
 * with no output corrections or accepted exceptions (s217 m06).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from '../../packages/viz-core/src/adapters/vega-lite-adapter.js';
import { toEChartsOption } from '../../packages/viz-core/src/adapters/echarts-adapter.js';
import type { NormalizedVizSpec } from '../../packages/viz-core/src/spec/normalized-viz-spec.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../..');
const schemaPath = path.resolve(repoRoot, 'node_modules/vega-lite/build/vega-lite-schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

/**
 * THE SHAPE-AGNOSTIC ORACLE. Compiled against the MarkDef definition directly, so a mark
 * def is checked wherever it sits — `/mark` on a unit spec, `/layer/N/mark` on a layered
 * one, or nested inside a concat/facet. This is what replaces the s167 path filter.
 */
const validateMarkDef = ajv.compile({ ...schema, $ref: '#/definitions/MarkDef' });

/** Every mark definition in a compiled spec, regardless of nesting. */
function markDefsOf(compiled: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.mark && typeof obj.mark === 'object' && !Array.isArray(obj.mark)) {
      found.push(obj.mark as Record<string, unknown>);
    }
    for (const value of Object.values(obj)) visit(value);
  };
  visit(compiled);
  return found;
}

/** `instancePath|keyword|params` per failure — the STATED REASON, not just a boolean. */
function markDefErrors(compiled: unknown): string[] {
  const out: string[] = [];
  for (const def of markDefsOf(compiled)) {
    if (validateMarkDef(def)) continue;
    for (const error of validateMarkDef.errors ?? []) {
      out.push(`${error.instancePath || '/'}|${error.keyword}|${JSON.stringify(error.params)}`);
    }
  }
  return out;
}

const x = { field: 'month', trait: 'EncodingPositionX', channel: 'x' };

function prescribedSpec(layout?: Record<string, unknown>): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'ff22-s167-mark-options',
    name: 'Plan vs actual vs target',
    data: {
      values: [
        { month: 'Jan', baseline: 10, actual: 12, target: 15 },
        { month: 'Feb', baseline: 11, actual: 14, target: 15 },
      ],
    },
    marks: [
      {
        trait: 'MarkLine',
        options: { id: 'baseline', curve: 'monotone', strokeWidth: 3 },
        encodings: { x, y: { field: 'baseline', trait: 'EncodingPositionY', channel: 'y' } },
      },
      {
        trait: 'MarkLine',
        options: { id: 'actual', opacity: 0.8 },
        encodings: { x, y: { field: 'actual', trait: 'EncodingPositionY', channel: 'y' } },
      },
      {
        trait: 'MarkPoint',
        options: { id: 'target', fillOpacity: 0.5, strokeDash: [4, 2] },
        encodings: { x, y: { field: 'target', trait: 'EncodingPositionY', channel: 'y' } },
      },
    ],
    encoding: { x, y: { field: 'baseline', trait: 'EncodingPositionY', channel: 'y' } },
    ...(layout ? { layout } : {}),
    a11y: { description: 'Three layers: baseline, actual, and target by month.' },
  } as unknown as NormalizedVizSpec;
}

type CompiledSpec = {
  readonly layer?: readonly { mark?: Record<string, unknown>; encoding?: { y?: { field?: string } } }[];
};

describe('s167 m03 — OODS-only mark.options keys stay out of the Vega-Lite mark def (FF#22)', () => {
  it('the prescribed id-keyed ordering pattern emits a SCHEMA-VALID spec', () => {
    const compiled = toVegaLiteSpec(
      prescribedSpec({ trait: 'LayoutLayer', order: ['target', 'baseline', 'actual'] }),
    );
    const errors = markDefErrors(compiled);
    expect(errors, `mark definitions are schema-invalid:\n  ${errors.join('\n  ')}`).toEqual([]);
    expect(validate(compiled)).toBe(true);
  });

  it('no emitted mark def carries an OODS-only key', () => {
    const compiled = toVegaLiteSpec(prescribedSpec()) as CompiledSpec;
    const marks = (compiled.layer ?? []).map((layer) => layer.mark ?? {});
    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      expect(Object.keys(mark)).not.toContain('id');
      expect(Object.keys(mark)).not.toContain('curve');
    }
  });

  it('KEEP-GREEN: genuine Vega-Lite passthrough survives the filter', () => {
    const compiled = toVegaLiteSpec(prescribedSpec()) as CompiledSpec;
    const marks = (compiled.layer ?? []).map((layer) => layer.mark ?? {});
    expect(marks[0]).toMatchObject({ type: 'line', strokeWidth: 3 });
    expect(marks[1]).toMatchObject({ type: 'line', opacity: 0.8 });
    expect(marks[2]).toMatchObject({ type: 'point', fillOpacity: 0.5, strokeDash: [4, 2] });
  });

  it('KEEP-GREEN: id-keyed layer ordering still works (options.id stays visible to inferLayerKey)', () => {
    // The filter must remove `id` from the OUTPUT only. If it were removed from the IR,
    // inferLayerKey would fall back to the trait name, the Map matcher would collapse the
    // two MarkLine layers, and the consumer would be back at the original FF#22 dead end.
    const ordered = toVegaLiteSpec(
      prescribedSpec({ trait: 'LayoutLayer', order: ['target', 'baseline', 'actual'] }),
    ) as CompiledSpec;
    expect((ordered.layer ?? []).map((l) => l.encoding?.y?.field)).toEqual([
      'target',
      'baseline',
      'actual',
    ]);

    const declared = toVegaLiteSpec(prescribedSpec()) as CompiledSpec;
    expect((declared.layer ?? []).map((l) => l.encoding?.y?.field)).toEqual([
      'baseline',
      'actual',
      'target',
    ]);
  });

  it('the schema validator is discriminating: re-injecting each OODS-only key turns it RED', () => {
    const compiled = toVegaLiteSpec(prescribedSpec()) as unknown as {
      layer: { mark: Record<string, unknown> }[];
    };
    expect(markDefErrors(compiled)).toEqual([]);

    for (const [key, value] of [
      ['id', 'target'],
      ['curve', 'monotone'],
    ] as const) {
      const mutated = structuredClone(compiled) as typeof compiled;
      mutated.layer[0].mark[key] = value;
      const errors = markDefErrors(mutated);
      expect(errors.length, `re-injecting mark.${key} did not fail schema validation`).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain(`"additionalProperty":"${key}"`);
    }
  });

  it('reaches a REAL committed fixture: examples/viz/line-chart.spec.json', () => {
    const fixturePath = path.resolve(repoRoot, 'examples/viz/line-chart.spec.json');
    const spec = JSON.parse(readFileSync(fixturePath, 'utf8')) as NormalizedVizSpec;
    // Guard the premise — if the fixture stops carrying `curve` this test proves nothing.
    expect((spec.marks[0] as { options?: Record<string, unknown> }).options).toHaveProperty('curve');

    const compiled = toVegaLiteSpec(spec) as CompiledSpec & { mark?: Record<string, unknown> };
    const mark = compiled.layer ? (compiled.layer[0].mark ?? {}) : (compiled.mark ?? {});
    expect(Object.keys(mark)).not.toContain('curve');
    expect(validate(compiled)).toBe(true);
  });

  it('KEEP-GREEN: curve still reaches the ECharts adapter from the IR', () => {
    const fixturePath = path.resolve(repoRoot, 'examples/viz/line-chart.spec.json');
    const spec = JSON.parse(readFileSync(fixturePath, 'utf8')) as NormalizedVizSpec;
    const option = toEChartsOption(spec) as unknown as { series?: readonly { smooth?: boolean }[] };
    expect(option.series?.[0]?.smooth).toBe(true);
  });

  it('MarkDef really is a closed object in the pinned schema (the premise of this whole spec)', () => {
    const markDef = (schema as { definitions: Record<string, { additionalProperties?: boolean; properties?: object }> })
      .definitions.MarkDef;
    expect(markDef.additionalProperties).toBe(false);
    expect(Object.keys(markDef.properties ?? {})).not.toContain('id');
    expect(Object.keys(markDef.properties ?? {})).not.toContain('curve');
    // ...and DOES contain the genuine passthrough keys the filter must preserve.
    // s168 CORRECTION: `baseline` was on this list in s167, as evidence it was safe
    // passthrough. It is a real MarkDef property BY NAME and a `TextBaseline` by VALUE,
    // so OODS's `'zero'`/`'min'`/`0` were exactly the four invalid fixtures. Name-validity
    // is not value-validity, and this list only ever proved the former.
    for (const key of ['strokeWidth', 'opacity', 'fillOpacity', 'strokeDash', 'tension']) {
      expect(Object.keys(markDef.properties ?? {}), `${key} should be a real MarkDef prop`).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------------------
// s168 m02 — the corrective: allowlist + translation table, proved over the DECLARED
// surface (synthetic) and the COMMITTED corpus, not one of the two.
// ---------------------------------------------------------------------------------------

/** The declared surface itself, read at test time so a new trait option cannot arrive untested. */
const TRAIT_SCHEMA_DIR = path.resolve(repoRoot, 'schemas/traits');
// MarkGraph declares an ECharts edge-array placement, not a Vega-Lite mark vocabulary.
// Its closed placement shape is checked below; unknown mark schemas still fail discovery.
const PLACEMENT_ONLY_SCHEMAS = new Set(['mark-graph.parameters.schema.json']);
const TRAIT_OF_FILE: Record<string, string> = {
  'mark-area.parameters.schema.json': 'MarkArea',
  'mark-bar.parameters.schema.json': 'MarkBar',
  'mark-line.parameters.schema.json': 'MarkLine',
  'mark-point.parameters.schema.json': 'MarkPoint',
  'mark-rect.parameters.schema.json': 'MarkRect',
};

type DeclaredOption = { trait: string; key: string; value: unknown };

function declaredOptions(): DeclaredOption[] {
  const files = readdirSync(TRAIT_SCHEMA_DIR).filter((f) => /^mark-.*\.parameters\.schema\.json$/.test(f));
  const out: DeclaredOption[] = [];
  for (const file of files) {
    if (PLACEMENT_ONLY_SCHEMAS.has(file)) continue;
    const trait = TRAIT_OF_FILE[file];
    if (!trait) throw new Error(`Unmapped trait parameter schema ${file} — add it to TRAIT_OF_FILE`);
    const doc = JSON.parse(readFileSync(path.join(TRAIT_SCHEMA_DIR, file), 'utf8')) as {
      properties?: Record<string, { type?: string; enum?: unknown[] }>;
    };
    for (const [key, prop] of Object.entries(doc.properties ?? {})) {
      // A representative in-vocabulary value: the first enum member, else a typed sample.
      const value = prop.enum?.length
        ? prop.enum[0]
        : prop.type === 'number'
          ? 0.5
          : prop.type === 'boolean'
            ? true
            : 'sample';
      out.push({ trait, key, value });
    }
  }
  return out;
}

/** Build output, dependencies and workflow scratch — never fixture sources. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.claude', 'dist', 'build', 'coverage', 'storybook-static',
  '.next', '.turbo',
]);

interface WholeSpecFixture {
  readonly rel: string;
  readonly spec: NormalizedVizSpec;
}

function wholeSpecFixtures(): WholeSpecFixture[] {
  const collected: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.spec.json')) {
        collected.push(path.join(dir, entry.name));
      }
    }
  };
  walk(path.join(repoRoot, 'examples/viz'));

  return collected
    .map((abs) => ({
        rel: path.relative(repoRoot, abs),
        spec: JSON.parse(readFileSync(abs, 'utf8')) as NormalizedVizSpec,
      }))
    .filter(({ spec }) => spec.marks.some((mark) => mark.trait.startsWith('Mark')))
    .sort((left, right) => left.rel.localeCompare(right.rel));
}

const X = { field: 'cat', trait: 'EncodingPositionX', channel: 'x' };
const Y = { field: 'val', trait: 'EncodingPositionY', channel: 'y', scale: 'linear' };

function probeSpec(trait: string, options: Record<string, unknown>): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'probe',
    name: 'probe',
    data: { values: [{ cat: 'a', val: 1 }, { cat: 'b', val: 2 }] },
    marks: [{ trait, options, encodings: { x: X, y: Y } }],
    encoding: { x: X, y: Y },
    a11y: { description: 'probe' },
  } as unknown as NormalizedVizSpec;
}

function soleMarkDef(trait: string, options: Record<string, unknown>): Record<string, unknown> {
  const defs = markDefsOf(toVegaLiteSpec(probeSpec(trait, options)));
  expect(defs, `expected exactly one mark def for ${trait}`).toHaveLength(1);
  return defs[0];
}

describe('s168 m02 — allowlist + translation table (FF#22 corrective)', () => {
  it('the adapter’s STATIC allowlist still matches the installed vega-lite MarkDef', () => {
    // The split ruling: the adapter carries a static list so a vega-lite bump cannot
    // silently change runtime behaviour; THIS test derives the set from the schema, so a
    // bump fails here instead. Read the constant out of the source rather than exporting
    // it — the allowlist is an implementation detail, not part of the adapter's API.
    const source = readFileSync(
      path.resolve(repoRoot, 'packages/viz-core/src/adapters/vega-lite-adapter.ts'),
      'utf8',
    );
    const block = /const MARK_DEF_PROPERTIES: ReadonlySet<string> = new Set\(\[([\s\S]*?)\]\);/.exec(source);
    expect(block, 'MARK_DEF_PROPERTIES not found in the adapter').not.toBeNull();
    const staticList = [...(block![1].matchAll(/'([^']+)'/g))].map((m) => m[1]).sort();
    const schemaList = Object.keys(schema.definitions.MarkDef.properties).sort();
    expect(staticList).toEqual(schemaList);
  });

  // ── EVERY declared trait option gets a probe (synthetic coverage) ────────────────
  // The committed corpus exercises only 7 of these keys, so a fixture sweep alone cannot
  // reach the rest. Generated from the trait schemas, not hand-listed.
  const DECLARED = declaredOptions();

  it('classifies MarkGraph as a closed edge-array placement instead of a Vega-Lite mark option vocabulary', () => {
    const graph = JSON.parse(readFileSync(path.join(TRAIT_SCHEMA_DIR, 'mark-graph.parameters.schema.json'), 'utf8'));
    expect(Object.keys(graph.properties).sort()).toEqual(['chart', 'description', 'previewSvg', 'title']);
    expect(graph.additionalProperties).toBe(false);
    expect(graph.properties.chart.oneOf).toHaveLength(1);
    const declaration = graph.properties.chart.oneOf[0];
    expect(declaration.additionalProperties).toBe(false);
    expect(declaration.properties.chartType).toEqual({ const: 'force_graph' });
    expect(declaration.properties.source).toEqual({ const: 'edge-array' });
  });

  it('covers every declared trait option key', () => {
    expect(DECLARED.length).toBeGreaterThanOrEqual(17);
    expect(new Set(DECLARED.map((d) => d.trait))).toEqual(
      new Set(['MarkArea', 'MarkBar', 'MarkLine', 'MarkPoint', 'MarkRect']),
    );
  });

  for (const { trait, key, value } of DECLARED) {
    it(`${trait}.${key} emits a schema-valid mark def`, () => {
      const compiled = toVegaLiteSpec(probeSpec(trait, { [key]: value }));
      const errors = markDefErrors(compiled);
      expect(errors, `${trait}.${key}=${JSON.stringify(value)} produced:\n  ${errors.join('\n  ')}`).toEqual([]);
    });
  }

  // ── PASSTHROUGH SURVIVAL — the control that stops a degenerate fix ───────────────
  // Without this, `{type:'line'}` — strip everything but the mark type — satisfies every
  // other criterion in this file while silently dropping all styling.
  const PASSTHROUGH: Record<string, Record<string, unknown>> = {
    MarkArea: { opacity: 0.35, tension: 0.7 },
    MarkBar: { cornerRadius: 4 },
    MarkLine: { strokeWidth: 2.5, strokeDash: [4, 2] },
    MarkPoint: { strokeWidth: 1.5, opacity: 0.9, fillOpacity: 0.4, size: 42, shape: 'square' },
    MarkRect: { opacity: 0.4 },
  };

  for (const [trait, options] of Object.entries(PASSTHROUGH)) {
    it(`KEEP-GREEN: ${trait} passthrough survives WITH ITS VALUES`, () => {
      const def = soleMarkDef(trait, options);
      for (const [key, value] of Object.entries(options)) {
        expect(def[key], `${trait}.${key} was dropped or altered`).toEqual(value);
      }
      expect(markDefErrors(toVegaLiteSpec(probeSpec(trait, options)))).toEqual([]);
    });
  }

  // ── TRANSLATIONS ────────────────────────────────────────────────────────────────
  it('curve → interpolate, for every value in the declared vocabulary', () => {
    for (const curve of ['linear', 'monotone', 'step']) {
      const def = soleMarkDef('MarkLine', { curve });
      expect(def.interpolate).toBe(curve);
      expect(def).not.toHaveProperty('curve');
    }
  });

  it('curve outside MarkDef.interpolate’s vocabulary is dropped, not emitted', () => {
    const def = soleMarkDef('MarkLine', { curve: 'wobbly' });
    expect(def).not.toHaveProperty('interpolate');
    expect(def).not.toHaveProperty('curve');
  });

  /**
   * ── s169 m05: THREE MORE OODS KEYS THAT HAD AN EXACT TARGET AND WERE BEING DROPPED ──
   * `orientation`, `enableMarkers` and `join` are all in the 14-key not-a-MarkDef-property
   * list above, so the allowlist correctly refused to emit them — but each has an EXACT
   * Vega-Lite counterpart whose accepted values are the same set, verified against the
   * installed 6.4.1 schema. Dropping a declared, translatable intent is silent data loss,
   * so they are now translated on the same value-guarded pattern as `curve`.
   */
  it('orientation → orient, for every value in the declared vocabulary', () => {
    for (const orientation of ['vertical', 'horizontal']) {
      const def = soleMarkDef('MarkBar', { orientation });
      expect(def.orient).toBe(orientation);
      expect(def).not.toHaveProperty('orientation');
    }
  });

  it('orientation outside MarkDef.orient’s vocabulary is dropped, not emitted', () => {
    const def = soleMarkDef('MarkBar', { orientation: 'sideways' });
    expect(def).not.toHaveProperty('orient');
    expect(def).not.toHaveProperty('orientation');
  });

  it('join → strokeJoin, for every value in the declared vocabulary', () => {
    for (const join of ['miter', 'round', 'bevel']) {
      const def = soleMarkDef('MarkLine', { join });
      expect(def.strokeJoin).toBe(join);
      expect(def).not.toHaveProperty('join');
    }
  });

  it('join outside MarkDef.strokeJoin’s vocabulary is dropped, not emitted', () => {
    const def = soleMarkDef('MarkLine', { join: 'chamfered' });
    expect(def).not.toHaveProperty('strokeJoin');
    expect(def).not.toHaveProperty('join');
  });

  it('enableMarkers → point, for both booleans', () => {
    for (const enableMarkers of [true, false]) {
      const def = soleMarkDef('MarkLine', { enableMarkers });
      expect(def.point).toBe(enableMarkers);
      expect(def).not.toHaveProperty('enableMarkers');
    }
  });

  it('a NON-boolean enableMarkers is dropped, even though MarkDef.point would accept it', () => {
    // `MarkDef.point` also accepts an OverlayMarkDef object and the string 'transparent'.
    // The OODS key is declared `boolean`, so anything else arriving under it is a caller
    // error rather than a richer intent — smuggling it through would let an OODS key mean
    // something the OODS schema never allowed.
    for (const value of ['transparent', { size: 40 }, 1]) {
      const def = soleMarkDef('MarkLine', { enableMarkers: value });
      expect(def, `enableMarkers: ${JSON.stringify(value)}`).not.toHaveProperty('point');
      expect(def).not.toHaveProperty('enableMarkers');
    }
  });

  it('all three translations produce SCHEMA-VALID mark defs', () => {
    // The translation is only worth anything if what it emits actually validates.
    expect(markDefErrors(toVegaLiteSpec(probeSpec('MarkBar', { orientation: 'horizontal' })))).toEqual([]);
    expect(markDefErrors(toVegaLiteSpec(probeSpec('MarkLine', { join: 'bevel', enableMarkers: true })))).toEqual([]);
  });

  it('fill: solid|hollow → filled, and NO mark def ever carries the OODS vocabulary', () => {
    // `fill` is a real MarkDef property accepting any string as a Color, so ajv ACCEPTS
    // `fill:'hollow'`. The allowlist cannot catch it — this is the value control.
    expect(soleMarkDef('MarkPoint', { fill: 'solid' })).toMatchObject({ filled: true });
    expect(soleMarkDef('MarkPoint', { fill: 'hollow' })).toMatchObject({ filled: false });
    for (const value of ['solid', 'hollow']) {
      const def = soleMarkDef('MarkPoint', { fill: value });
      expect(def.fill).toBeUndefined();
    }
  });

  it('KEEP-GREEN: a genuine colour in fill still passes through', () => {
    expect(soleMarkDef('MarkPoint', { fill: '#ff0000' })).toMatchObject({ fill: '#ff0000' });
  });

  it('baseline → encoding scale.zero, in all THREE observed spellings', () => {
    // 'zero' and 'min' are declared by mark-area.parameters.schema.json; the NUMBER 0 is
    // declared nowhere and comes from the committed MarkBar fixtures — which is exactly
    // why a declared-surface-only derivation would have missed it.
    const cases: [string, unknown, boolean][] = [
      ['MarkArea', 'zero', true],
      ['MarkArea', 'min', false],
      ['MarkBar', 0, true],
    ];
    for (const [trait, baseline, expected] of cases) {
      const compiled = toVegaLiteSpec(probeSpec(trait, { baseline })) as {
        encoding?: Record<string, { scale?: { zero?: boolean } }>;
      };
      expect(compiled.encoding?.y?.scale?.zero, `${trait} baseline=${JSON.stringify(baseline)}`).toBe(expected);
      expect(markDefsOf(compiled)[0]).not.toHaveProperty('baseline');
    }
  });

  it('an unrecognised baseline is dropped rather than guessed at', () => {
    const compiled = toVegaLiteSpec(probeSpec('MarkArea', { baseline: 'alphabetic' })) as {
      encoding?: Record<string, { scale?: { zero?: boolean } }>;
    };
    expect(compiled.encoding?.y?.scale?.zero).toBeUndefined();
    expect(markDefsOf(compiled)[0]).not.toHaveProperty('baseline');
  });

  /**
   * ── s169 m05: THE `else x` BRANCH HAD NO CONTROL ──
   * `applyBaselineToEncoding` walks `['y', 'x']` and takes the first QUANTITATIVE
   * positional channel — the fallback to `x` is what makes a horizontal chart work. Every
   * baseline test above uses the default probe, where `y` IS quantitative, so all of them
   * pass on `['y']` alone: MEASURED, mutating the channel list to `['y']` reds NOTHING.
   *
   * This probe flips the channels — quantitative on `x`, nominal on `y` — so it can only
   * pass if the fallback runs. It also asserts the MERGE rather than just the value: a
   * pre-existing `scale` property on the same channel must survive, because `{...scale,
   * zero}` and `{zero}` are indistinguishable when the scale was empty.
   */
  it('baseline falls back to x when y is not quantitative, MERGING into any existing scale', () => {
    const flipped = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'flipped',
      name: 'flipped',
      data: { values: [{ cat: 'a', val: 1 }, { cat: 'b', val: 2 }] },
      marks: [
        {
          trait: 'MarkBar',
          options: { baseline: 'zero' },
          encodings: {
            x: { field: 'val', trait: 'EncodingPositionX', channel: 'x', scale: 'linear' },
            y: { field: 'cat', trait: 'EncodingPositionY', channel: 'y' },
          },
        },
      ],
      encoding: {
        x: { field: 'val', trait: 'EncodingPositionX', channel: 'x', scale: 'linear' },
        y: { field: 'cat', trait: 'EncodingPositionY', channel: 'y' },
      },
      a11y: { description: 'flipped' },
    } as unknown as NormalizedVizSpec;

    const compiled = toVegaLiteSpec(flipped) as {
      encoding?: Record<string, { type?: string; scale?: { zero?: boolean; type?: string } }>;
    };

    // The premise: this probe is only meaningful if the channels really are flipped.
    expect(compiled.encoding?.x?.type, 'probe premise: x must be quantitative').toBe('quantitative');
    expect(compiled.encoding?.y?.type).not.toBe('quantitative');

    expect(compiled.encoding?.x?.scale?.zero, 'the else-x fallback did not run').toBe(true);
    // MERGE, not replace — the pre-existing linear scale must still be there.
    expect(compiled.encoding?.x?.scale?.type, 'the existing scale was replaced, not merged').toBe('linear');
    // ...and the non-quantitative channel is left entirely alone.
    expect(compiled.encoding?.y?.scale?.zero).toBeUndefined();
  });

  // ── THE FILTER IS OUTPUT-ONLY ───────────────────────────────────────────────────
  it('KEEP-GREEN: translation never mutates the IR', () => {
    // AreaChart.tsx reads options.baseline, the ECharts adapter reads options.curve, and
    // the layered view reads options.title/id. A translation that deleted from the shared
    // options object would break all three.
    const spec = probeSpec('MarkArea', { curve: 'monotone', baseline: 'zero', fill: 'hollow' });
    const optionsBefore = structuredClone((spec.marks[0] as { options: Record<string, unknown> }).options);
    toVegaLiteSpec(spec);
    expect((spec.marks[0] as { options: Record<string, unknown> }).options).toEqual(optionsBefore);
  });

  // ── DISCRIMINATION: the control of the control ──────────────────────────────────
  it('re-injecting each of the 14 non-MarkDef keys turns the oracle RED at that key', () => {
    const compiled = toVegaLiteSpec(probeSpec('MarkLine', { strokeWidth: 2 })) as {
      mark: Record<string, unknown>;
    };
    expect(markDefErrors(compiled)).toEqual([]);

    const NON_MARKDEF_KEYS = [
      'areaStyle', 'bandPadding', 'curve', 'enableMarkers', 'id', 'itemStyle', 'join',
      'lineStyle', 'name', 'orientation', 'stack', 'stacking', 'symbolSize', 'title',
    ];
    for (const key of NON_MARKDEF_KEYS) {
      const mutated = structuredClone(compiled);
      mutated.mark[key] = 'x';
      const errors = markDefErrors(mutated);
      expect(errors.join(' '), `re-injecting ${key} did not turn the oracle red`).toContain(
        `"additionalProperty":"${key}"`,
      );
    }
  });

  // ── THE COMMITTED CORPUS ────────────────────────────────────────────────────────
  it('every committed mark-bearing fixture emits schema-valid mark defs', () => {
    // DEFINITION: a source `.json` file under the repo whose
    // TOP-LEVEL object has a `marks` array containing at least one entry whose `trait`
    // starts with "Mark". Generated outputs and root artifacts/ receipts are excluded.
    // s196 m07 measured 43 with receipts included: m05's retained timezone-bite input
    // duplicates running-total-area.spec.json. Evidence retention must not add a new
    // product fixture. Sprint 199 adds exactly waterfall and histogram: 44 examples.
    //
    // Walk source locations without a Git dependency, then require exact agreement with
    // the independent examples discovery used by the whole-spec oracle below. A new
    // source fixture still requires an explicit corpus reconciliation.
    const collected: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          if (dir === repoRoot && entry.name === 'artifacts') continue;
          walk(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.json')) {
          collected.push(path.join(dir, entry.name));
        }
      }
    };
    walk(repoRoot);

    const failures: string[] = [];
    const checked: string[] = [];
    for (const abs of collected) {
      const rel = path.relative(repoRoot, abs);
      let doc: { marks?: { trait?: unknown }[] };
      try {
        doc = JSON.parse(readFileSync(abs, 'utf8'));
      } catch {
        continue;
      }
      const isMarkBearing =
        Array.isArray(doc?.marks) &&
        doc.marks.some((m) => typeof m?.trait === 'string' && m.trait.startsWith('Mark'));
      if (!isMarkBearing) continue;
      checked.push(rel);
      let compiled: unknown;
      try {
        compiled = toVegaLiteSpec(doc as unknown as NormalizedVizSpec);
      } catch {
        // An adapter throw is a different defect class and is not this oracle's subject.
        continue;
      }
      const errors = markDefErrors(compiled);
      if (errors.length) failures.push(`${rel} :: ${errors.join(' ; ')}`);
    }

    expect(checked, 'the corpus definition stopped matching — re-derive it').toHaveLength(44);
    expect(checked).toEqual(expect.arrayContaining([
      'examples/viz/patterns-v2/waterfall.spec.json',
      'examples/viz/patterns-v2/histogram.spec.json',
    ]));
    expect(checked.sort()).toEqual(wholeSpecFixtures().map(({ rel }) => rel).sort());
    expect(failures, `schema-invalid mark defs:\n  ${failures.join('\n  ')}`).toEqual([]);
  }, 60_000);
});

describe('s217 m06 — whole-spec validity without exceptions', () => {
  it.each(wholeSpecFixtures())('$rel validates directly, without repair or annotation', ({ spec }) => {
    const compiled = toVegaLiteSpec(spec);
    const valid = validate(compiled);
    expect(valid, JSON.stringify(validate.errors)).toBe(true);
  });

  it('covers the complete 44-fixture product corpus', () => {
    expect(wholeSpecFixtures()).toHaveLength(44);
  });
});
