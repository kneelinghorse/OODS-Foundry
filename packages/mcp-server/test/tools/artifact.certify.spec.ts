import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalize, sha256 } from '@oods/artifacts';
import { contrastRatio, normaliseColor } from '@oods/a11y-tools';
import {
  adaptChordToECharts,
  adaptGraphToECharts,
  adaptSankeyToECharts,
  adaptSunburstToECharts,
  adaptTreemapToECharts,
  buildVizSpecFromRows,
  resolveTokenToColor,
  toVegaLiteSpec,
  type HierarchyInput,
  type NetworkInput,
  type NormalizedVizSpec,
  type SankeyInput,
} from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { getDefinition } from '../../src/errors/registry.js';
import { handle } from '../../src/tools/artifact.certify.js';
import { reconstructEChartsCategoricalPalette } from '../../src/tools/certify-contrast.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';

// The wired output schema (m03) — every verdict below must AJV-validate against it,
// so the handler's real output stays contract-clean (mirrors the viz.render specs).
const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

// artifact.certify (sprint-136 m02) — the "certify" half of generate-AND-certify.
// An agent hands in a Forge NormalizedVizSpec IR and gets back a conformance verdict
// + a re-emit determinism proof + a contentHash. certify REUSES the same equivalence
// engine (validateVizEquivalenceRules) and determinism transform (toVegaLiteSpec ->
// canonicalize -> sha256) viz.render runs, so a Forge-generated spec certifies to the
// same hash it renders to. It is a READER of the IR (no scorer/recommender change, #110).
//
// Coverage-honest: certification is CARTESIAN-ONLY. The 8 ECharts-primary types are
// classified from the IR's first mark trait and returned coverage:'uncertified' /
// conformant:null — a distinct verdict, NOT a failure.

const certify = (spec: unknown) => handle({ spec });

// A 3-field cartesian dataset → the accessible table has 3 columns.
const ROWS3 = [
  { region: 'North', quarter: 'Q1', revenue: 100 },
  { region: 'South', quarter: 'Q1', revenue: 120 },
  { region: 'East', quarter: 'Q1', revenue: 90 },
];
const CARTESIAN_ENCODINGS = { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' as const } };
// A y encoding whose field is ABSENT from every row → A11Y-R-12 (error). The builder
// still produces a valid spec (it cannot invent data), so this is the reachable way to
// make certify report conformant:false on a cartesian IR.
const MISSING_FIELD_ENCODINGS = { x: { field: 'region' }, y: { field: 'nonexistent' } };

const buildSpec = (
  rows: Array<Record<string, unknown>>,
  encodings: Record<string, unknown> = CARTESIAN_ENCODINGS,
): NormalizedVizSpec => buildVizSpecFromRows({ rows, chartType: 'bar', encodings: encodings as never }).spec;

describe('artifact.certify — conformance verdict (cartesian)', () => {
  it('a conformant cartesian IR → certified, conformant:true, no findings, stable contentHash', async () => {
    const spec = buildSpec(ROWS3);
    const out = await certify(spec);
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');
    expect(out.conformant).toBe(true);
    expect(out.findings).toEqual([]);
    expect(out.determinism?.stable).toBe(true);
    expect(out.determinism?.contentHash).toBeTypeOf('string');
    expect(validateOutput(out)).toBe(true);
  });

  it('a non-conformant IR (encoding field absent from rows → R-12) → conformant:false + OODS-A11Y-R-12', async () => {
    const spec = buildSpec(ROWS3, MISSING_FIELD_ENCODINGS);
    const out = await certify(spec);
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');
    expect(out.conformant).toBe(false);
    // Per-rule code preserved verbatim (the intentional doubled A11Y literal) — NEVER
    // collapsed to OODS-V129 (which a thrown assertVizEquivalence would produce).
    const findings = out.findings ?? [];
    expect(findings.map((f) => f.code)).toContain('OODS-A11Y-R-12');
    expect(findings.find((f) => f.code === 'OODS-A11Y-R-12')?.severity).toBe('error');
    expect(validateOutput(out)).toBe(true);
  });
});

describe('artifact.certify — coverage-honest routing', () => {
  it('an ECharts-primary IR (MarkSankey) → uncertified, conformant:null, no determinism', async () => {
    const good = buildSpec(ROWS3);
    // Same valid IR with only the first mark trait flipped to an ECharts-primary type.
    const sankey = { ...good, marks: [{ ...good.marks[0], trait: 'MarkSankey' }] } as unknown;
    const out = await certify(sankey);
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('uncertified');
    expect(out.conformant).toBeNull();
    expect(out.findings).toEqual([]);
    expect(out.determinism).toBeUndefined();
    expect(out.notes?.[0]).toContain('MarkSankey');
    expect(validateOutput(out)).toBe(true);
  });
});

describe('artifact.certify — determinism (contentHash)', () => {
  it('same input → identical contentHash across two calls (pure verdict)', async () => {
    const spec = buildSpec(ROWS3);
    const a = await certify(spec);
    const b = await certify(spec);
    expect(a.determinism?.contentHash).toBeTypeOf('string');
    expect(a.determinism?.contentHash).toBe(b.determinism?.contentHash);
  });

  it('a one-field mutation → different contentHash', async () => {
    const a = await certify(buildSpec(ROWS3));
    const mutatedRows = [{ ...ROWS3[0], revenue: 999 }, ...ROWS3.slice(1)];
    const b = await certify(buildSpec(mutatedRows));
    expect(a.determinism?.contentHash).not.toBe(b.determinism?.contentHash);
  });
});

describe('artifact.certify — invalid input', () => {
  it('an invalid IR → structured error (status:error, OODS-V126), never a throw', async () => {
    const out = await certify({ not: 'a normalized viz spec' });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V126');
    expect(out.coverage).toBeUndefined();
    expect(out.determinism).toBeUndefined();
    expect(validateOutput(out)).toBe(true);
  });
});

// s137/s138/s140 — the per-pillar tri-state summary (pillars) + the RENDERED-REALITY
// contrast verdict. As of s140 [B] the folded `conformant` gate rolls up contrast: a
// contrast:'fail' pulls conformant false, while pillars.a11yEquivalence is DECOUPLED and
// mirrors ONLY the a11y-equivalence sub-result (so an a11y-passing / contrast-failing
// chart reports a11yEquivalence:'pass' with conformant:false). Under s138 the compiled
// cartesian spec carries the resolved OODS palette (scale.range for multi-series /
// mark.color for single-series), so a color-token override changes BOTH the contrast
// verdict AND the contentHash — certify grades the palette Forge actually renders.
describe('artifact.certify — contrast pillar (s137/s138/s140)', () => {
  // A multi-series IR: color=region gives 3 distinct categorical slots (cat-01..03).
  const buildMultiSeries = (tokens?: Record<string, string | number>): NormalizedVizSpec => {
    const built = buildVizSpecFromRows({
      rows: ROWS3,
      chartType: 'bar',
      encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' }, color: { field: 'region' } } as never,
    }).spec;
    return tokens ? ({ ...built, config: { ...built.config, tokens } } as NormalizedVizSpec) : built;
  };

  it('a default cartesian IR → pillars all pass + a rendered-contrast contrastNote', async () => {
    const out = await certify(buildSpec(ROWS3));
    expect(out.pillars).toEqual({ a11yEquivalence: 'pass', determinism: 'pass', contrast: 'pass', accuracy: 'pass' });
    // Render-backed caveat (s176 m01 reword) — no longer the baked-bytes one.
    expect(out.contrastNote).toContain('series-to-paint assignment of the rendered chart');
    expect(validateOutput(out)).toBe(true);
  });

  it('[B] the primary conformant-rollup lock — a low-contrast config.tokens override → contrast:fail PULLS conformant false, while a11yEquivalence stays DECOUPLED at pass', async () => {
    const greyTokens = {
      '--oods-viz-scale-categorical-01': '#777777',
      '--oods-viz-scale-categorical-02': '#7A7A7A',
      '--oods-viz-scale-categorical-03': '#808080',
    };
    const out = await certify(buildMultiSeries(greyTokens));
    // s140 [B] CONTRACT FLIP (was true pre-s140): contrast:'fail' now folds into the
    // headline gate an agent's if(conformant) reads, so it can no longer silently ship a
    // contrast-failing chart. This is the canonical monotonic-tightening flip.
    expect(out.conformant).toBe(false);
    // DECOUPLED: a11yEquivalence mirrors ONLY the a11y sub-result — the palette never
    // affects it — so it stays 'pass' even though conformant flipped to false.
    expect(out.pillars?.a11yEquivalence).toBe('pass');
    expect(out.pillars?.contrast).toBe('fail');
    expect(validateOutput(out)).toBe(true);

    // Rendered-reality (s138): the grey override is BAKED into the compiled scale.range,
    // so contrast:fail is a verdict about what Forge RENDERS — not a declared intent.
    const compiled = JSON.stringify(toVegaLiteSpec(buildMultiSeries(greyTokens)));
    expect(compiled).toContain('#777777');
  });

  it('[B] exempt keeps conformant a11y-driven — a divergence IR (contrast:exempt) stays conformant:true', async () => {
    // Only contrast==='fail' pulls conformant false; 'exempt' (a gradient / divergent
    // binding with no baked palette) leaves conformant a11y-driven, so a default-a11y
    // divergence IR stays conformant:true. Guards the s139 invariance lock below.
    const divergent = buildMultiSeries();
    (divergent.encoding as Record<string, unknown>).color = { field: 'region', trait: 'EncodingDetail' };
    const out = await certify(divergent);
    expect(out.pillars?.contrast).toBe('exempt');
    expect(out.pillars?.a11yEquivalence).toBe('pass');
    expect(out.conformant).toBe(true);
    expect(validateOutput(out)).toBe(true);
  });

  it('bakes the resolved OODS palette into the compiled cartesian spec (s138 rendered-reality — the inversion of the s137 colorless tripwire, and the planned #564 cartesian-color change)', () => {
    // s138 rendered-reality: the compiled Vega-Lite spec now CARRIES the resolved OODS
    // palette — scale.range including categorical-01 (#3E63DD since s222-m02: brand A's accent) for a multi-series
    // color channel. The contrast pillar therefore grades what Forge RENDERS, not a declared
    // intent. This is exactly the deliberate non-additive #564 cartesian-color change
    // (its golden regen is owned by m04). Hand-inverted from the s137 `not.toContain`.
    const compiled = JSON.stringify(toVegaLiteSpec(buildMultiSeries()));
    expect(compiled).toContain('"range"');
    expect(compiled).toContain('3E63DD'); // resolved categorical-01, baked into scale.range
    // Forge bakes an explicit hex range, NOT a Vega named 'scheme' — still absent.
    expect(compiled.toLowerCase()).not.toContain('scheme');
  });

  // s141 m02 — HAND-INVERTED tripwire (NOT a -u regen; mirrors s138 m03). Routing the 5
  // ECharts categorical types through the reconstructed-palette grader is exactly what
  // flips MarkSankey's contrast verdict, so the invert lands in m02 (the code change that
  // causes it), not m03. Design A: contrast 'unchecked' → 'pass'; a11yEquivalence +
  // determinism STAY 'unchecked' (still no Vega compile); coverage STAYS 'uncertified'.
  it('an ECharts-primary categorical IR (MarkSankey) → contrast graded (s191 light/A Role-C repair); a11yEquivalence + determinism STAY unchecked, coverage still uncertified', async () => {
    const good = buildSpec(ROWS3);
    const sankey = { ...good, marks: [{ ...good.marks[0], trait: 'MarkSankey' }] } as unknown;
    const out = await certify(sankey);
    expect(out.coverage).toBe('uncertified');
    expect(out.pillars).toEqual({ a11yEquivalence: 'unchecked', determinism: 'unchecked', contrast: 'pass', accuracy: 'unchecked' });
    expect(validateOutput(out)).toBe(true);
  });
});

// s137 m03 — the fall-through routing bug-fix (review #1004 item 2). A schema-valid IR
// whose first-mark trait is neither cartesian-Vega nor ECharts-primary USED to fall
// through to a Vega compile and return an opaque status:error OODS-V127, even though
// the tool advertises heatmap as certified. Fix = a positive cartesian allowlist +
// a MarkHeatmap->MarkRect alias. Three-way lock: certified / uncertified / honest.
describe('artifact.certify — fall-through routing (review #1004 item 2)', () => {
  const withTrait = (trait: string): unknown => {
    const good = buildSpec(ROWS3);
    return { ...good, marks: [{ ...good.marks[0], trait }] };
  };

  it('MarkBar → certified (a modeled cartesian-Vega trait)', async () => {
    const out = await certify(withTrait('MarkBar'));
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');
    expect(validateOutput(out)).toBe(true);
  });

  it('MarkTreemap → uncertified (ECharts-primary), never status:error', async () => {
    const out = await certify(withTrait('MarkTreemap'));
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('uncertified');
    expect(out.notes?.some((n) => n.includes('MarkTreemap'))).toBe(true);
    expect(validateOutput(out)).toBe(true);
  });

  it('MarkHeatmap → an HONEST certified verdict via the MarkRect alias — NOT the opaque V127 it used to be', async () => {
    const heatmap = await certify(withTrait('MarkHeatmap'));
    expect(heatmap.status).toBe('ok'); // regression: this was status:error OODS-V127
    expect(heatmap.coverage).toBe('certified');
    expect(heatmap.errors).toBeUndefined();
    // The alias truly normalizes to the canonical MarkRect: identical contentHash.
    const rect = await certify(withTrait('MarkRect'));
    expect(heatmap.determinism?.contentHash).toBe(rect.determinism?.contentHash);
    expect(validateOutput(heatmap)).toBe(true);
  });

  it('an unmodeled non-primary trait (MarkPie) → uncertified, never status:error V127', async () => {
    const out = await certify(withTrait('MarkPie'));
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('uncertified');
    expect(out.conformant).toBeNull();
    expect(out.errors).toBeUndefined();
    expect(validateOutput(out)).toBe(true);
  });
});

// s138 m03 — the render↔certify contentHash IDENTITY, now at the NEW baked value. Both
// viz.render and certify compile through the SAME toVegaLiteSpec (which now bakes the OODS
// palette), so feeding certify viz.render's OWN returned normalizedSpec must reproduce
// viz.render's contentHash byte-for-byte. This is the "generate AND certify" round-trip
// made concrete at the rendered-reality value — no test pinned it across the two tools before.
describe('artifact.certify — cross-tool contentHash identity with viz.render (s138 m03)', () => {
  const MULTI_ENCODINGS = {
    x: { field: 'quarter' },
    y: { field: 'revenue', aggregate: 'sum' as const },
    color: { field: 'region' },
  };

  it("viz.render.contentHash === certify.contentHash on viz.render's RETURNED normalizedSpec (multi-series, baked scale.range)", async () => {
    const rendered = await vizRender({
      rows: ROWS3,
      chartType: 'bar',
      encodings: MULTI_ENCODINGS,
      output: { includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    expect(rendered.contentHash).toBeTypeOf('string');
    expect(rendered.normalizedSpec).toBeDefined();

    // Feed certify viz.render's OWN returned IR — NOT a re-built one — so both hashes are
    // over the byte-identical baked toVegaLiteSpec output.
    const certified = await certify(rendered.normalizedSpec);
    expect(certified.status).toBe('ok');
    expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
  });

  it("single-series: viz.render.contentHash === certify.contentHash on the returned normalizedSpec (baked mark.color)", async () => {
    const rendered = await vizRender({
      rows: ROWS3,
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } },
      output: { includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    const certified = await certify(rendered.normalizedSpec);
    expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
  });

  it("F5 (s147): an explicit agent color range hashes in lockstep — viz.render.contentHash === certify.contentHash", async () => {
    // The range is baked into scale.range INSTEAD OF the palette (m02), and both tools
    // hash the same compiled toVegaLiteSpec bytes — so a ranged spec round-trips at its
    // OWN value, not the palette value. Pins that certify grades exactly what renders.
    const rendered = await vizRender({
      rows: ROWS3,
      chartType: 'bar',
      encodings: {
        x: { field: 'quarter' },
        y: { field: 'revenue', aggregate: 'sum' as const },
        color: { field: 'region', range: ['#1F6FEB', '#D1242F'] },
      },
      output: { includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    expect(rendered.normalizedSpec).toBeDefined();
    // The agent range reached the IR (builder allowlist copy) — guards the m02 hollow.
    expect((rendered.normalizedSpec as Record<string, any>).encoding?.color?.range).toEqual([
      '#1F6FEB',
      '#D1242F',
    ]);

    const certified = await certify(rendered.normalizedSpec);
    expect(certified.status).toBe('ok');
    expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
  });

  it("#853c (s149): a provably-failing gray agent range → certify HONEST-FAIL (conformant:false, contrast:'fail') on viz.render's own normalizedSpec", async () => {
    // The end-to-end honest-fail limb (s147 fork B): certify stays a PURE READER, so a
    // gray range that reads-as-gray on the #FCFCFD canvas truthfully FAILS the contrast
    // pillar. Pre-#853c the honest-fail was pinned only engine-level (hand-built IR) plus
    // a hash-only e2e — the vizRender→certify conformant:false limb was UNGUARDED against
    // a metadata-only-normalizedSpec refactor that could collapse the graded slot count
    // and silently pass a gray (#1120c). ROWS3 has 3 distinct regions so BOTH range slots
    // are graded (the fail is not masked by a distinctCount→1 cardinality collapse).
    // Confirm the graded mechanism: both grays are hardened <3:1 on the canvas (NOT
    // #888888 ≈3.1:1 which would sit above the role-C floor).
    expect(contrastRatio('#B8B8B8', '#FCFCFD')).toBeLessThan(3);
    expect(contrastRatio('#C0C0C0', '#FCFCFD')).toBeLessThan(3);

    const rendered = await vizRender({
      rows: ROWS3,
      chartType: 'bar',
      encodings: {
        x: { field: 'quarter' },
        y: { field: 'revenue', aggregate: 'sum' as const },
        color: { field: 'region', range: ['#B8B8B8', '#C0C0C0'] },
      },
      output: { includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    expect(rendered.normalizedSpec).toBeDefined();
    // The gray range reached the IR — so certify grades the RENDERED bytes, not an intent.
    expect((rendered.normalizedSpec as Record<string, any>).encoding?.color?.range).toEqual([
      '#B8B8B8',
      '#C0C0C0',
    ]);

    // Positive #110 witness: certify used purely as a READER truthfully fails the gray range.
    const certified = await certify(rendered.normalizedSpec);
    expect(certified.status).toBe('ok');
    expect(certified.pillars?.contrast).toBe('fail');
    expect(certified.conformant).toBe(false);
  });
});

// s139 m02/m03 — GRADE THE RENDERED BYTES (dissolve the classifier-mismatch false-pass).
// The reborn hollow (s138 review): a schema-valid but color-DIVERGENT binding — one the
// bake gate (vega-lite-adapter inferFieldType) leaves quantitative, so the compiled spec
// bakes NO scale.range/mark.color — used to return coverage:'certified' + conformant:true
// + contrast:'pass', because the OLD grade-side classifier re-classified the raw binding
// as categorical and re-resolved the 6-slot palette. s139 reads the emitted bytes instead:
// no baked OODS palette -> NEVER contrast:'pass'. These IRs are all schema-valid (they pass
// assertNormalizedVizSpec — a status:error here would mean the fixture, not the verdict, broke).
describe('artifact.certify — contrast grades the rendered bytes (s139)', () => {
  // A multi-series base (color=region → the bake fires for EncodingColor); swapping the
  // color binding is the ONLY change between the divergence cases and their twin.
  const multiBase = buildVizSpecFromRows({
    rows: ROWS3,
    chartType: 'bar',
    encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' }, color: { field: 'region' } } as never,
  }).spec;
  const withColor = (color: Record<string, unknown>): unknown => ({
    ...multiBase,
    encoding: { ...multiBase.encoding, color },
  });

  // Every binding the bake gate leaves quantitative → compiled bakes no palette → exempt.
  const DIVERGENCE_CASES: Array<[string, Record<string, unknown>]> = [
    ['EncodingDetail', { field: 'region', trait: 'EncodingDetail' }],
    ['EncodingColour (typo)', { field: 'region', trait: 'EncodingColour' }],
    ['bare Color', { field: 'region', trait: 'Color' }],
    ['EncodingDetail + timeUnit', { field: 'region', trait: 'EncodingDetail', timeUnit: 'year' }],
    ['EncodingDetail + aggregate', { field: 'region', trait: 'EncodingDetail', aggregate: 'count' }],
    ['EncodingSize on color', { field: 'region', trait: 'EncodingSize' }],
  ];

  it.each(DIVERGENCE_CASES)(
    'divergence lock — a %s color binding (compiled quantitative, no baked palette) → contrast:exempt, NEVER pass',
    async (_label, color) => {
      const out = await certify(withColor(color));
      expect(out.status).toBe('ok'); // schema-valid: the fixture certifies, it does not error
      expect(out.coverage).toBe('certified');
      // The governing rule: no baked OODS palette → contrast is never 'pass'.
      expect(out.pillars?.contrast).not.toBe('pass');
      expect(out.pillars?.contrast).toBe('exempt');
      expect(validateOutput(out)).toBe(true);
    },
  );

  it('legit categorical twin (EncodingColor, palette baked) → contrast:pass — unchanged', async () => {
    const out = await certify(withColor({ field: 'region', trait: 'EncodingColor' }));
    expect(out.pillars?.contrast).toBe('pass');
  });

  // INVARIANCE lock — s139 is contrast-OUTPUT-ONLY. Swapping EncodingColor→EncodingDetail
  // moves ONLY the contrast verdict (pass→exempt, because the rendered bytes differ). The
  // a11y-equivalence, determinism, and conformant verdicts read the color ENCODING/data —
  // never the palette — so they are IDENTICAL between the twin and its divergence sibling.
  // (contentHash necessarily DIFFERS: the compiled color bytes differ — that difference is
  // exactly WHY contrast differs; certified == rendered.)
  it('invariance — a divergence IR shares conformant/a11yEquivalence/determinism with its EncodingColor twin; only contrast moves', async () => {
    const twin = await certify(withColor({ field: 'region', trait: 'EncodingColor' }));
    const divergent = await certify(withColor({ field: 'region', trait: 'EncodingDetail' }));

    expect(divergent.conformant).toBe(twin.conformant);
    expect(divergent.pillars?.a11yEquivalence).toBe(twin.pillars?.a11yEquivalence);
    expect(divergent.pillars?.determinism).toBe(twin.pillars?.determinism);

    // The one intended difference — the contrast verdict.
    expect(twin.pillars?.contrast).toBe('pass');
    expect(divergent.pillars?.contrast).toBe('exempt');
    expect(divergent.pillars?.contrast).not.toBe(twin.pillars?.contrast);
  });

  // Contrast-output-only at the HASH level: certify's contentHash is EXACTLY the untouched
  // toVegaLiteSpec compile hash (the contrast pillar never feeds it). Pins #564-additive —
  // s139 moved no rendered byte, so the hash a divergence IR certifies to is the pure
  // compile hash, independent of the contrast verdict.
  it('contentHash is the untouched compile hash — the contrast pillar does not feed it', async () => {
    const divergentSpec = withColor({ field: 'region', trait: 'EncodingDetail' }) as NormalizedVizSpec;
    const out = await certify(divergentSpec);
    const compileHash = sha256(canonicalize(toVegaLiteSpec(divergentSpec)));
    expect(out.determinism?.contentHash).toBe(compileHash);
  });
});

// s141 m02 — ECharts-primary CATEGORICAL contrast. The 5 categorical types
// (treemap/sunburst/sankey/force_graph/chord) BAKE the fixed OODS 6-slot categorical
// palette into itemStyle on the live viz.render path, yet certify was silent about it
// (contrast:'unchecked' — the s137/s138 coverage-inversion). certify now RECONSTRUCTS that
// palette from the SAME shared token source the adapters use and grades it (role-C vs
// #FCFCFD + role-A min-pairwise ΔE00 over Machado CVD). Design A / additive: only
// pillars.contrast flips — coverage STAYS 'uncertified', conformant STAYS null,
// a11yEquivalence + determinism STAY 'unchecked', no contentHash. The verdict is a
// per-palette CONSTANT (data-independent) — a weaker claim than a cartesian 'pass'.
describe('artifact.certify — ECharts categorical contrast (s141 m02)', () => {
  const CATEGORICAL_TRAITS = ['MarkTreemap', 'MarkSunburst', 'MarkSankey', 'MarkGraph', 'MarkChord'];
  const withTrait = (trait: string): unknown => {
    const good = buildSpec(ROWS3);
    return { ...good, marks: [{ ...good.marks[0], trait }] };
  };

  it.each(CATEGORICAL_TRAITS)(
    '%s → contrast:pass (s191 light slot04 repair); coverage uncertified / conformant null / a11yEquivalence+determinism unchecked / no contentHash',
    async (trait) => {
      const out = await certify(withTrait(trait));
      expect(out.status).toBe('ok');
      // Design A — coverage + conformant + the non-contrast pillars are unchanged.
      expect(out.coverage).toBe('uncertified');
      expect(out.conformant).toBeNull();
      expect(out.determinism).toBeUndefined(); // no Vega compile → no determinism proof / hash
      expect(out.pillars?.a11yEquivalence).toBe('unchecked');
      expect(out.pillars?.determinism).toBe('unchecked');
      // The graded verdict — the repaired default palette passes Role C at light/A (s191).
      expect(out.pillars?.contrast).toBe('pass');
      // Mandatory caveats (memo §4): adjacency-ungraded + per-node data-color override.
      expect(out.contrastNote).toContain(
        'touching-mark/adjacency contrast not graded; relies on the separating stroke',
      );
      expect(out.contrastNote).toContain('Per-node data-color overrides are ungraded');
      // s195 measured hue revision gives ΔE00 10.01756: the caution is no longer warranted.
      expect(out.contrastNote).not.toContain('Distinguishability caution');
      // The pre-s141 "contrast not checked" note is dropped; only the a11y note remains.
      expect(out.notes?.some((n) => n.includes(trait))).toBe(true);
      expect(out.notes?.some((n) => /contrast is not checked/i.test(n))).toBe(false);
      expect(validateOutput(out)).toBe(true);
    },
  );

  it('the categorical grade is INPUT-INVARIANT — a config.tokens grey override does NOT move the verdict (the spec-only fallback excludes config.tokens; the grade is the fixed default palette, NOT resolveCategoricalPalette)', async () => {
    const base = buildSpec(ROWS3);
    const sankey = { ...base, marks: [{ ...base.marks[0], trait: 'MarkSankey' }] } as NormalizedVizSpec;
    const greyOverride = {
      ...sankey,
      config: {
        ...(sankey.config ?? {}),
        tokens: {
          '--oods-viz-scale-categorical-01': '#777777',
          '--oods-viz-scale-categorical-02': '#7A7A7A',
          '--oods-viz-scale-categorical-03': '#808080',
        },
      },
    } as NormalizedVizSpec;
    const a = await certify(sankey);
    const b = await certify(greyOverride);
    // Grading the FIXED default palette (memo §3b) means a config.tokens override the
    // ECharts render ignores must NOT change the verdict — certified == rendered.
    expect(a.pillars?.contrast).toBe('pass');
    expect(b.pillars?.contrast).toBe('pass');
    expect(b.contrastNote).toBe(a.contrastNote);
  });
});

// s141 m02 — the consistency-LOCK (memo §3d). The palette certify RECONSTRUCTS + grades
// must be byte-identical to what each of the 5 categorical adapters actually BAKES into
// its ECharts option (option.color), after normalizing both to hex (the adapters bake
// rgb() via convertOklchToRgb; certify's slots are hex). This pins `certified == rendered`
// against future drift — a non-clamping count, or a token falling to a FALLBACK_PALETTE —
// WITHOUT refactoring the adapters into a shared resolver (which would move itemStyle bytes
// → golden regen → violate #110). It invokes the REAL adapter entry points and reads the
// baked palette off the emitted option, so it locks the actual bake, not a replay of it.
describe('artifact.certify — ECharts categorical consistency lock (s141 m02)', () => {
  const CERTIFY_PALETTE = reconstructEChartsCategoricalPalette().map((s) => s.hex);

  const bakedHexes = (option: unknown): string[] => {
    const colors = (option as { color?: unknown }).color;
    if (!Array.isArray(colors)) throw new Error('adapter baked no color palette on option.color');
    return colors.map((c) => normaliseColor(String(c), 'baked'));
  };

  const SPEC = {
    id: 'viz:lock',
    name: 'Lock',
    data: { values: [] },
    marks: [],
    a11y: { description: 'consistency lock' },
  } as unknown as NormalizedVizSpec;
  const HIER: HierarchyInput = {
    type: 'adjacency_list',
    data: [
      { id: 'root', parentId: null, value: 0, name: 'R' },
      { id: 'a', parentId: 'root', value: 5, name: 'A' },
      { id: 'b', parentId: 'root', value: 3, name: 'B' },
    ],
  };
  const FLOW: SankeyInput = {
    nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    links: [
      { source: 'A', target: 'B', value: 10 },
      { source: 'B', target: 'C', value: 6 },
    ],
  };
  const NET: NetworkInput = {
    nodes: [
      { id: 'a', group: 'web', value: 9 },
      { id: 'b', group: 'api', value: 4 },
    ],
    links: [{ source: 'a', target: 'b', value: 3 }],
  };

  it('certify reconstructs the fixed default OODS 6-slot categorical palette', () => {
    // s197: six generated slots, qualified by the one attributed golden migration. s222-m02 (#2502 ruling 12): brand A's
    // recipe palette, the accent's step 9 first and then hues spread from it (sprint-222 golden ledger, epoch s222-m02).
    expect(CERTIFY_PALETTE).toEqual(['#3E63DD', '#B98E00', '#800883', '#0C7B2D', '#7B0008', '#00A3B3']);
  });

  // s197 preserves the Role-C floor against the generated neutral CSS light/A canvas.
  it('pins the light/A Role-C floor — every generated slot clears 3:1 (s197)', () => {
    // Derive the canvas from the SAME token the grader resolves — resolveSlotHex ->
    // resolveTokenToColor at certify-contrast.ts:407 (with no override this is exactly
    // normaliseColor(resolveTokenToColor('--oods-sys-surface-canvas'))). s142-review #2:
    // the old hardcoded '#FCFCFD' was DECOUPLED from the grader, so a --oods-sys-surface-canvas
    // retoken would silently re-baseline every ECharts categorical verdict without tripping
    // this floor guard. Deriving it makes the "a canvas-token tweak trips THIS test first"
    // claim actually true — a retoken now moves CANVAS here in lockstep with the grader.
    const canvasRaw = resolveTokenToColor('--oods-sys-surface-canvas');
    expect(canvasRaw, 'the --oods-sys-surface-canvas token must resolve').toBeTruthy();
    const CANVAS = normaliseColor(canvasRaw as string, 'canvas');
    // s222-m01 (#2502 ruling 4): the neutral-first canvas is white; pinned so a retoken is loud.
    expect(CANVAS).toBe('#FFFFFF');
    const ratios = reconstructEChartsCategoricalPalette().map((s) => ({
      ...s,
      ratio: contrastRatio(s.hex, CANVAS),
    }));
    expect(ratios.filter(({ ratio }) => ratio < 3).map(({ hex }) => hex)).toEqual([]);
    const min = ratios.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    // s222-m02: the recipe holds each slot to 3:1 on the canvas; the gold slot is the closest (3.03:1).
    expect(min.hex).toBe('#B98E00');
    expect(min.ratio).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['treemap', () => adaptTreemapToECharts(SPEC, HIER)],
    ['sunburst', () => adaptSunburstToECharts(SPEC, HIER)],
    ['sankey', () => adaptSankeyToECharts(SPEC, FLOW)],
    ['force_graph', () => adaptGraphToECharts(SPEC, NET)],
    ['chord', () => adaptChordToECharts(SPEC, FLOW)],
  ] as const)('%s bakes exactly certify’s grade palette (rgb→hex normalized)', (_label, build) => {
    expect(bakedHexes(build())).toEqual(CERTIFY_PALETTE);
  });
});

// s141 m03 — geo ECharts types. choropleth/flow_map/bubble_map render color as a
// SEQUENTIAL/CONTINUOUS scale (choropleth visualMap ramp, flow_map single-hue line,
// bubble_map default visualMap), so WCAG 1.4.11's gradient essential exception applies →
// contrast:'exempt' (role-B). Design A: coverage stays 'uncertified', conformant null,
// a11yEquivalence + determinism 'unchecked'. bubble_map's ORDINAL-categorical color branch
// is NOT graded — that range lives in the geo DATA branch, outside this metadata IR (Derek:
// exempt-all-geo, after the m01 claim that the IR exposes scale:'ordinal'/range was VERIFIED
// FALSE — the color TraitBinding schema forbids both, and a Forge bubble IR carries encoding:{}).
describe('artifact.certify — ECharts geo contrast (s141 m03)', () => {
  const GEO_TRAITS = ['MarkChoropleth', 'MarkFlow', 'MarkBubble'];
  const withTrait = (trait: string): unknown => {
    const good = buildSpec(ROWS3);
    return { ...good, marks: [{ ...good.marks[0], trait }] };
  };

  it.each(GEO_TRAITS)(
    '%s → contrast:exempt (WCAG role-B gradient exception); coverage uncertified / conformant null / a11yEquivalence+determinism unchecked / no contentHash',
    async (trait) => {
      const out = await certify(withTrait(trait));
      expect(out.status).toBe('ok');
      expect(out.coverage).toBe('uncertified');
      expect(out.conformant).toBeNull();
      expect(out.determinism).toBeUndefined(); // no Vega compile → no determinism proof / hash
      expect(out.pillars).toEqual({
        a11yEquivalence: 'unchecked',
        determinism: 'unchecked',
        contrast: 'exempt',
        accuracy: 'unchecked',
      });
      expect(out.contrastNote).toContain('WCAG 1.4.11 gradient essential exception');
      // The a11y note remains; the pre-s141 "contrast not checked" note is dropped.
      expect(out.notes?.some((n) => n.includes(trait))).toBe(true);
      expect(out.notes?.some((n) => /contrast is not checked/i.test(n))).toBe(false);
      expect(validateOutput(out)).toBe(true);
    },
  );

  // s172 m04 REWRITE of the s141 assertion, and the change is the POINT rather than a
  // maintenance edit. s141's note gave two reasons for not grading the ordinal-categorical
  // bubble_map colour: Derek's exempt-all-geo ruling, and the range being invisible to
  // certify (it lives in the geo DATA branch, outside the metadata IR). s172 m01 made that
  // branch an accepted operand, so the second reason is FALSE now. The verdict is unchanged
  // and correct; the note must rest on the ruling alone, and this test pins that it does —
  // including that the old invisibility wording is gone rather than merely supplemented.
  it('bubble_map exempt note rests on the exempt-all-geo RULING, not on invisibility — s172 made the range reachable', async () => {
    const out = await certify(withTrait('MarkBubble'));
    expect(out.pillars?.contrast).toBe('exempt');
    expect(out.contrastNote).toContain('exempt-all-geo RULING rather than invisibility');
    expect(out.contrastNote).toContain('would be a new scope decision, not a bug fix');
    expect(out.contrastNote).not.toContain('outside this metadata IR, so it is not graded here');
    // The WCAG rationale for the exemption itself is untouched.
    expect(out.contrastNote).toContain('WCAG 1.4.11 gradient essential exception');
  });
});

// s142 m02 — THE ROUND-TRIP HONESTY FLOOR (the proof the s141 suite structurally lacks).
// EVERY s141 ECharts certify test above hand-authors a NON-EMPTY encoding: `withTrait()`
// starts from buildSpec(ROWS3) (a cartesian bar IR whose encoding has x+y) and only swaps
// the mark trait. But viz.render EMITS every ECharts-primary normalizedSpec with
// `encoding: {}` (buildEChartsPrimarySpec, viz.render.ts:534). At HEAD cab623a certify's
// shared input schema required encoding minProperties:1, so assertNormalizedVizSpec REJECTED
// that real emitted IR with OODS-V126 BEFORE the ECharts routing that produces the verdict —
// certify errored on its OWN producer's output while the tool advertised a clean round-trip.
// s142 removed minProperties:1 from the EncodingMap base and re-imposed it ONLY for cartesian
// mark traits, so the emitted encoding:{} IR now VALIDATES and routes to its contrast verdict.
// These tests feed certify the ACTUAL viz.render-emitted normalizedSpec — not a hand-authored
// stand-in — so they exercise the real round-trip an agent runs (includeNormalizedSpec:true).
describe('artifact.certify — round-trip honesty floor: certify accepts viz.render-emitted ECharts encoding:{} IR (s142 m02)', () => {
  // A real geo FeatureCollection (mirrors the dashboard-a11y-equivalence fixture) so the
  // choropleth render path is genuinely exercised, not stubbed.
  const GEO_FC = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'West' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
      { type: 'Feature', properties: { name: 'East' }, geometry: { type: 'Polygon', coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]] } },
    ],
  };

  it("a REAL viz.render sankey → emitted normalizedSpec.encoding is {} + trait MarkSankey → certify returns contrast:'pass', status:ok (was OODS-V126 at HEAD)", async () => {
    const rendered = await vizRender({
      chartType: 'sankey',
      sankey: {
        nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        links: [{ source: 'A', target: 'B', value: 10 }, { source: 'B', target: 'C', value: 6 }],
      },
      output: { includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    expect(rendered.normalizedSpec).toBeDefined();
    // The LOAD-BEARING precondition: the emitted encoding is genuinely EMPTY — the exact shape
    // the pre-s142 schema (encoding minProperties:1) rejected. If viz.render ever starts
    // populating encoding, this assertion fires and the honesty proof must be re-derived.
    const emitted = rendered.normalizedSpec as unknown as { encoding: unknown; marks: Array<{ trait: string }> };
    expect(emitted.encoding).toEqual({});
    expect(emitted.marks[0]?.trait).toBe('MarkSankey');

    // Feed certify viz.render's OWN emitted IR. At HEAD this returned status:'error' V126.
    const certified = await certify(rendered.normalizedSpec);
    expect(certified.status).toBe('ok');
    expect(certified.errors).toBeUndefined();
    expect(certified.pillars?.contrast).toBe('pass');
    // Design A is preserved for the ECharts path — only contrast carries a verdict.
    expect(certified.coverage).toBe('uncertified');
    expect(certified.conformant).toBeNull();
    expect(validateOutput(certified)).toBe(true);
  });

  it("a REAL viz.render choropleth → emitted normalizedSpec.encoding is {} + trait MarkChoropleth → certify returns contrast:'exempt', status:ok (was OODS-V126 at HEAD)", async () => {
    const rendered = await vizRender({
      chartType: 'choropleth',
      geo: {
        geojson: GEO_FC,
        valueField: 'revenue',
        join: { dataKey: 'region', featureProperty: 'name' },
        rows: [{ region: 'West', revenue: 220 }, { region: 'East', revenue: 170 }],
      },
      output: { includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    expect(rendered.normalizedSpec).toBeDefined();
    const emitted = rendered.normalizedSpec as unknown as { encoding: unknown; marks: Array<{ trait: string }> };
    expect(emitted.encoding).toEqual({});
    expect(emitted.marks[0]?.trait).toBe('MarkChoropleth');

    const certified = await certify(rendered.normalizedSpec);
    expect(certified.status).toBe('ok');
    expect(certified.errors).toBeUndefined();
    expect(certified.pillars?.contrast).toBe('exempt');
    expect(certified.coverage).toBe('uncertified');
    expect(certified.conformant).toBeNull();
    expect(validateOutput(certified)).toBe(true);
  });

  // s143 m02 — EXTEND the round-trip proof from 2/8 to 8/8 (s142-review thoroughness-gap #3).
  // The two tests above pin sankey (categorical) + choropleth (geo); every ECharts-primary
  // type shares the SAME buildEChartsPrimarySpec that emits encoding:{} (viz.render.ts:534),
  // so the honesty floor generalizes — but s142 only pinned two, leaving latent silent-rot
  // if a future per-type emit path populated encoding for one of the other six. These close
  // the gap: treemap/sunburst/force_graph/chord (categorical → contrast:'pass') and
  // bubble_map/flow_map (geo → 'exempt'), each fed certify the REAL viz.render-emitted
  // normalizedSpec (encoding:{}). Fixtures mirror the network- + geo-fidelity golden suites
  // so the render genuinely succeeds, not a stub.
  const HIER = {
    type: 'adjacency_list',
    data: [
      { id: 'root', parentId: null, value: 0, name: 'R' },
      { id: 'a', parentId: 'root', value: 5, name: 'A' },
      { id: 'b', parentId: 'root', value: 3, name: 'B' },
    ],
  };
  const NET = {
    nodes: [
      { id: 'a', group: 'web', value: 9 },
      { id: 'b', group: 'api', value: 4 },
    ],
    links: [{ source: 'a', target: 'b', value: 3 }],
  };
  const CHORD = {
    nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    links: [
      { source: 'A', target: 'B', value: 10 },
      { source: 'B', target: 'C', value: 6 },
    ],
  };
  const BUBBLE_GEO = {
    geojson: GEO_FC,
    rows: [
      { city: 'W', lng: 1, lat: 1, pop: 100 },
      { city: 'E', lng: 3, lat: 1, pop: 60 },
    ],
    longitudeField: 'lng',
    latitudeField: 'lat',
    sizeField: 'pop',
  };
  const FLOW_GEO = {
    geojson: GEO_FC,
    rows: [{ oLng: 0.5, oLat: 0.5, dLng: 3.5, dLat: 1.5, volume: 12 }],
    originLongitudeField: 'oLng',
    originLatitudeField: 'oLat',
    destinationLongitudeField: 'dLng',
    destinationLatitudeField: 'dLat',
    strengthField: 'volume',
  };

  const ROUND_TRIP_CASES = [
    { type: 'treemap', input: { chartType: 'treemap', hierarchy: HIER }, trait: 'MarkTreemap', contrast: 'pass' },
    { type: 'sunburst', input: { chartType: 'sunburst', hierarchy: HIER }, trait: 'MarkSunburst', contrast: 'pass' },
    { type: 'force_graph', input: { chartType: 'force_graph', network: NET }, trait: 'MarkGraph', contrast: 'pass' },
    { type: 'chord', input: { chartType: 'chord', chord: CHORD }, trait: 'MarkChord', contrast: 'pass' },
    { type: 'bubble_map', input: { chartType: 'bubble_map', geo: BUBBLE_GEO }, trait: 'MarkBubble', contrast: 'exempt' },
    { type: 'flow_map', input: { chartType: 'flow_map', geo: FLOW_GEO }, trait: 'MarkFlow', contrast: 'exempt' },
  ] as const;

  it.each(ROUND_TRIP_CASES)(
    'a REAL viz.render $type → emitted normalizedSpec.encoding is {} + trait $trait → certify contrast:$contrast, status:ok (2/8→8/8, s143 m02)',
    async ({ input, trait, contrast }) => {
      const rendered = await vizRender({ ...input, output: { includeNormalizedSpec: true } } as never);
      expect(rendered.status).toBe('ok');
      expect(rendered.normalizedSpec).toBeDefined();
      const emitted = rendered.normalizedSpec as unknown as { encoding: unknown; marks: Array<{ trait: string }> };
      // The load-bearing precondition (same as the sankey/choropleth exemplars): the emitted
      // encoding is genuinely EMPTY. If a per-type emit path ever populates it, this fires here.
      expect(emitted.encoding).toEqual({});
      expect(emitted.marks[0]?.trait).toBe(trait);

      // Feed certify viz.render's OWN emitted IR — the real round-trip. Pre-s142 this was V126.
      const certified = await certify(rendered.normalizedSpec);
      expect(certified.status).toBe('ok');
      expect(certified.errors).toBeUndefined();
      expect(certified.pillars?.contrast).toBe(contrast);
      // Design A preserved for the ECharts path — only contrast carries a verdict.
      expect(certified.coverage).toBe('uncertified');
      expect(certified.conformant).toBeNull();
      expect(validateOutput(certified)).toBe(true);
    },
  );

  // FORK-2 GUARD (Derek: cartesian-SCOPED, not a blanket minProperties drop). The schema
  // relaxation is trait-scoped: an empty encoding is legal ONLY for a non-cartesian mark. A
  // hand-authored CARTESIAN IR with encoding:{} must STILL be rejected with OODS-V126 — the
  // guard the s142 mechanism re-imposes. This path was previously untested at the certify
  // boundary (the sole empty-encoding→V126 coverage was the upstream builder, in
  // viz-a11y-equivalence-emission.spec.ts). Same empty encoding as the ECharts specs above,
  // OPPOSITE verdict — keyed purely on the mark trait.
  // s143 m02 — extend the guard from MarkBar to ALL cartesian traits the schema if-enum
  // gates (MarkBar/MarkLine/MarkPoint/MarkArea/MarkRect) PLUS the MarkHeatmap alias m01
  // added to that enum. Each empty-encoding cartesian IR must reject with clean V126.
  // MarkHeatmap+empty is the exact case that used to slip past the schema and die at
  // toVegaLiteSpec with opaque V127 (s142-review #1) — now it rejects up front like the rest.
  const CARTESIAN_EMPTY_TRAITS = ['MarkBar', 'MarkLine', 'MarkPoint', 'MarkArea', 'MarkRect', 'MarkHeatmap'];
  it.each(CARTESIAN_EMPTY_TRAITS)(
    'a hand-authored CARTESIAN IR (%s) with encoding:{} is STILL rejected → status:error OODS-V126 (Fork-2 guard)',
    async (trait) => {
      const base = buildSpec(ROWS3);
      const empty = { ...base, marks: [{ ...base.marks[0], trait }], encoding: {} };
      const out = await certify(empty);
      expect(out.status).toBe('error');
      expect(out.errors?.[0]?.code).toBe('OODS-V126');
    },
  );

  it('the guard is minProperties (empty-only), not a blanket cartesian reject — the SAME IR WITH its encoding certifies', async () => {
    // Sanity twin: the SAME cartesian IR WITH its encoding certifies fine, proving the guard
    // is minProperties on encoding, not a blanket mark-trait reject.
    const withEncoding = await certify(buildSpec(ROWS3));
    expect(withEncoding.status).toBe('ok');
    expect(withEncoding.coverage).toBe('certified');
  });
});

// ============================================================================
// s170 m02 — THE ACCURACY PILLAR (#818, the fourth #977 pillar).
//
// The rules themselves are proven RED-first in packages/viz-core (accuracy-rules-s170.spec.ts,
// with per-rule mutation gates and a 42-fixture false-positive sweep). What is proven HERE is
// the WIRING: each rule's red, pushed through the REAL handler, must reach pillars.accuracy,
// findings[], conformant and the output SCHEMA — a rule that fires into a verdict no reader can
// see, or into an output AJV rejects, is not wired.
// ============================================================================

describe('artifact.certify — accuracy pillar (s170 m02)', () => {
  // Two rows per region under a sum → the aggregation genuinely MERGES rows, and the caller
  // description override erases the builder's synthesized "sum of" disclosure. This red is
  // reachable through Forge's OWN generation path, not only through hand-authored IR.
  const COLLAPSING = [
    { region: 'North', quarter: 'Q1', revenue: 60 },
    { region: 'North', quarter: 'Q2', revenue: 60 },
    { region: 'South', quarter: 'Q1', revenue: 70 },
    { region: 'South', quarter: 'Q2', revenue: 65 },
  ];
  const NO_DISCLOSURE = 'Revenue by region across the sales territories for the current fiscal period.';

  /** A schema-valid hand-authored IR — exactly certify's contract (an arbitrary-IR reader). */
  const handAuthored = (extra: Record<string, unknown>, markTrait = 'MarkBar'): unknown => {
    const x = { field: 'region', trait: 'EncodingPositionX', channel: 'x', title: 'Region' };
    const y = {
      field: 'revenue',
      trait: 'EncodingPositionY',
      channel: 'y',
      type: 'quantitative',
      title: 'Revenue',
      ...((extra.yScale ? { scale: extra.yScale } : {}) as Record<string, unknown>),
    };
    return {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 's170:certify:accuracy',
      name: 'Revenue by region',
      data: { values: ROWS3.map((row) => ({ ...row })) },
      marks: [
        { trait: markTrait, encodings: { x, y }, ...(extra.options ? { options: extra.options } : {}) },
        ...((extra.extraMarks as unknown[]) ?? []),
      ],
      encoding: { x, y },
      ...((extra.layout ? { layout: extra.layout } : {}) as Record<string, unknown>),
      a11y: { description: 'Revenue by region for the three sales territories in the current period.' },
    };
  };

  // One red per rule, each carrying the code the registry now registers.
  const RULE_REDS: Array<{ name: string; code: string; spec: () => unknown }> = [
    {
      name: 'R1 non-zero bar baseline',
      code: 'OODS-V150',
      spec: () => handAuthored({ options: { baseline: 'min' } }),
    },
    {
      name: 'R2 dual axis',
      code: 'OODS-V151',
      spec: () =>
        handAuthored({
          layout: { trait: 'LayoutLayer', sharedScales: { x: 'shared', y: 'independent' } },
          extraMarks: [
            {
              trait: 'MarkLine',
              encodings: {
                x: { field: 'region', trait: 'EncodingPositionX', channel: 'x' },
                y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative' },
              },
            },
          ],
        }),
    },
    {
      name: 'R3 area encodes linear',
      code: 'OODS-V152',
      spec: () => handAuthored({ yScale: 'log' }, 'MarkArea'),
    },
    {
      name: 'R4 aggregation hiding',
      code: 'OODS-V153',
      spec: () =>
        buildVizSpecFromRows({
          rows: COLLAPSING,
          chartType: 'bar',
          encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } } as never,
          description: NO_DISCLOSURE,
        }).spec,
    },
  ];

  it.each(RULE_REDS)(
    '$name → pillars.accuracy fail + $code in findings + conformant false + the FAIL path still validates',
    async ({ code, spec }) => {
      const out = await certify(spec());
      expect(out.status).toBe('ok');
      expect(out.coverage).toBe('certified');
      expect(out.pillars?.accuracy).toBe('fail');
      expect(out.findings?.map((f) => f.code)).toContain(code);
      expect(out.findings?.find((f) => f.code === code)?.severity).toBe('error');
      expect(out.conformant).toBe(false);
      expect(out.accuracySummary?.failing).toBeGreaterThanOrEqual(1);
      // The CLOSED $defs/finding shape must admit the new findings — a fail path that the
      // output schema rejects would brick every call that trips a rule.
      expect(validateOutput(out)).toBe(true);
    },
  );

  it('each red is keyed to its OWN rule — no red trips a rule it does not name', async () => {
    for (const { code, spec } of RULE_REDS) {
      const out = await certify(spec());
      const accuracyCodes = (out.findings ?? []).map((f) => f.code).filter((c) => /^OODS-V15\d$/.test(c));
      expect(accuracyCodes, code).toEqual([code]);
    }
  });

  it('every accuracy code a red emits is a REGISTERED code', async () => {
    for (const { code, spec } of RULE_REDS) {
      const out = await certify(spec());
      for (const finding of out.findings ?? []) {
        if (/^OODS-V15\d$/.test(finding.code)) {
          expect(getDefinition(finding.code), finding.code).toBeDefined();
        }
      }
    }
    // ...and all four are registered even before any of them fires.
    for (const code of ['OODS-V150', 'OODS-V151', 'OODS-V152', 'OODS-V153']) {
      expect(getDefinition(code)?.category).toBe('validation');
    }
  });

  it('a clean cartesian IR → accuracy pass with all four rules evaluated, and no accuracy findings', async () => {
    const out = await certify(buildSpec(ROWS3));
    expect(out.pillars?.accuracy).toBe('pass');
    expect(out.accuracySummary).toEqual({ rulesEvaluated: 4, failing: 0 });
    expect((out.findings ?? []).filter((f) => /^OODS-V15\d$/.test(f.code))).toEqual([]);
    expect(out.conformant).toBe(true);
    expect(validateOutput(out)).toBe(true);
  });

  it('the uncertified (ECharts-primary) path → accuracy unchecked, no accuracySummary, conformant still null', async () => {
    const good = buildSpec(ROWS3);
    const sankey = { ...good, marks: [{ ...good.marks[0], trait: 'MarkSankey' }] } as unknown;
    const out = await certify(sankey);
    expect(out.coverage).toBe('uncertified');
    expect(out.pillars?.accuracy).toBe('unchecked');
    expect(out.accuracySummary).toBeUndefined();
    expect(out.conformant).toBeNull();
    expect(validateOutput(out)).toBe(true);
  });

  it("'unchecked' (nothing to grade) does NOT pull the rollup — only 'fail' and 'ungradeable' do (s175 m04 closed #781)", async () => {
    // Stated as a test rather than only as a comment: a nothing-to-grade 'unchecked' accuracy
    // pillar does NOT pull conformant false, exactly as a nothing-to-grade 'unchecked' contrast
    // pillar does not. Since s175 m04 the tried-and-failed flavour is a DIFFERENT value,
    // 'ungradeable', and that one does pull (artifact.certify.unchecked-tristate.spec.ts,
    // the two fault specs). If this ever changes it should change on purpose.
    const good = buildSpec(ROWS3);
    const sankey = { ...good, marks: [{ ...good.marks[0], trait: 'MarkSankey' }] } as unknown;
    const uncertified = await certify(sankey);
    expect(uncertified.pillars?.accuracy).toBe('unchecked');
    expect(uncertified.conformant).toBeNull(); // uncertified makes no claim at all

    // On the CERTIFIED path, a rule that cannot resolve its operand is not counted and does
    // not fail the pillar — rulesEvaluated is what tells a reader coverage was incomplete.
    const urlData = {
      ...buildVizSpecFromRows({
        rows: COLLAPSING,
        chartType: 'bar',
        encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } } as never,
        description: NO_DISCLOSURE,
      }).spec,
      data: { url: 'https://example.test/revenue.json', format: 'json' as const },
    };
    const out = await certify(urlData);
    expect(out.pillars?.accuracy).toBe('pass');
    expect(out.accuracySummary).toEqual({ rulesEvaluated: 3, failing: 0 });
    expect(out.notes?.join(' ')).toContain('referenced by url');
    // The accuracy pillar contributed NOTHING to the verdict here: no OODS-V15x finding, and
    // R4 stayed silent because its collapse half was unevaluable — which is exactly what
    // rulesEvaluated:3 is for. (This spec is conformant:false for a PRE-EXISTING a11y reason
    // — url-referenced data means no inline values, so A11Y-R-03/R-04 error. Asserting
    // conformant:true here would have been asserting something untrue about a different
    // pillar; the accuracy claim is the one this test makes.)
    expect((out.findings ?? []).filter((f) => /^OODS-V15\d$/.test(f.code))).toEqual([]);
    expect(out.pillars?.a11yEquivalence).toBe('fail');
    expect(validateOutput(out)).toBe(true);
  });

  it('accuracy findings sit ALONGSIDE a11y findings, told apart by code — findings[] is no longer a11y-only', async () => {
    // MISSING_FIELD_ENCODINGS gives an A11Y-R-12 error; the description override + collapse
    // gives an accuracy error. One verdict, both families.
    const spec = buildVizSpecFromRows({
      rows: COLLAPSING,
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } } as never,
      description: NO_DISCLOSURE,
    }).spec;
    const both = {
      ...spec,
      a11y: { ...spec.a11y, description: 'Short.' },
    } as NormalizedVizSpec;
    const out = await certify(both);
    const codes = (out.findings ?? []).map((f) => f.code);
    expect(codes.some((c) => c.startsWith('OODS-A11Y-'))).toBe(true);
    expect(codes).toContain('OODS-V153');
    expect(out.pillars?.a11yEquivalence).toBe('fail');
    expect(out.pillars?.accuracy).toBe('fail');
    expect(validateOutput(out)).toBe(true);
  });

  it('HASH IDENTITY: evaluating the accuracy pillar does not move contentHash', async () => {
    // certify is a pure READER (#110). The evaluator receives the SAME compiled object the
    // hash is taken over, so if it mutated an operand the hash would move. Pinned against
    // the hash computed independently here, and across a firing and a non-firing spec.
    for (const built of [buildSpec(ROWS3), RULE_REDS[3].spec() as NormalizedVizSpec]) {
      const expected = sha256(canonicalize(toVegaLiteSpec(built)));
      const out = await certify(built);
      expect(out.determinism?.contentHash).toBe(expected);
      expect(out.determinism?.stable).toBe(true);
    }
  });

  it('is DETERMINISTIC: the same IR certifies to the same verdict twice', async () => {
    const spec = RULE_REDS[0].spec();
    expect(await certify(spec)).toEqual(await certify(spec));
  });
});
