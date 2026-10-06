import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec, type NormalizedVizSpec } from '@oods/viz-core';
import { evaluateContrastPillar } from '../../src/tools/certify-contrast.js';

// certify contrast pillar engine (s137 m02; s138 m03 rendered-reality; s139 m02 grade the
// emitted bytes; s176 m01 grade the RENDER) — the 3-role contrast verdict over the paints
// the compiled chart actually renders. As of s176 the engine renders the compiled spec
// through @oods/viz-render and grades the SERIES-TO-PAINT ASSIGNMENT read off the SVG,
// duplicates retained — so a recycled palette (consumed cardinality > baked range) fails
// as a ΔE00=0 role-A pair, which the pre-s176 compiled-bytes read (sliced to the distinct
// palette) could never contain. Unit classification (series vs exempt vs chrome) still
// comes from the COMPILED spec, before any render logic (D5). These tests exercise the
// engine directly (the handler owns IR validation); each compiles the fixture via
// toVegaLiteSpec, renders, and grades — the 2-arg call shape, async since s176 — pinning
// the memo §3/§3a tri-state mapping:
//   role-C mark-vs-canvas WCAG 3:1 fail  -> 'fail'
//   role-A categorical CIEDE2000 min-over-CVD  <2 fail (a recycled pair is 0) /
//     2-10 pass+warn / >=10 pass
//   role-B (no baked palette: gradient OR divergence) -> 'exempt'

type ColorInput = { field?: string; type?: string; scale?: string; trait?: string; range?: string[] };

/**
 * Minimal NormalizedVizSpec-shaped input carrying only the fields the engine + the
 * toVegaLiteSpec compile read. x/y encodings + a11y.description are REQUIRED (s139): the
 * engine compiles the spec, and toVegaLiteSpec throws without an encoding or an
 * a11y.description. A `color` opt adds a color channel; otherwise the chart is
 * single-series and the adapter bakes categorical-01 as mark.color. Default data is ONE
 * row (s176): the engine grades what the chart RENDERS, so a graded fixture must render
 * at least one mark — an empty sample renders nothing and is honestly 'unchecked' (the
 * explicit empty-sample test below).
 */
function mk(opts: {
  color?: ColorInput;
  values?: Array<Record<string, unknown>>;
  tokens?: Record<string, string | number>;
}): NormalizedVizSpec {
  const spec: Record<string, unknown> = {
    marks: [{ trait: 'MarkBar' }],
    encoding: {
      x: { field: 'x', trait: 'EncodingX' },
      y: { field: 'y', trait: 'EncodingY' },
      ...(opts.color
        ? { color: { field: opts.color.field ?? 'series', trait: 'EncodingColor', ...opts.color } }
        : {}),
    },
    data: { values: opts.values ?? [{ x: 'q', y: 1 }] },
    a11y: { description: 'contrast engine fixture' },
  };
  if (opts.tokens) spec.config = { tokens: opts.tokens };
  return spec as unknown as NormalizedVizSpec;
}

/** Compile the fixture, render it, and grade the assignment — the 2-arg call shape,
 * async/render-fed since s176. */
const grade = (spec: NormalizedVizSpec) => evaluateContrastPillar(spec, toVegaLiteSpec(spec));

const seriesRows = (labels: string[]) => labels.map((s) => ({ x: 'q', y: 1, series: s }));

describe('certify-contrast — role-C (WCAG mark-vs-canvas) + default palette', () => {
  it('a single-series chart (no color encoding) -> pass on categorical-01 (baked mark.color, rendered) vs the canvas', async () => {
    const out = await grade(mk({}));
    expect(out.contrast).toBe('pass');
    // The render-backed caveat (s176 m01 reword) — no longer the baked-bytes one.
    expect(out.contrastNote).toContain('series-to-paint assignment of the rendered chart');
  });

  it('the revised six-slot palette clears Role-C and the Role-A clean threshold (s195)', async () => {
    // s195 moves only slot05 hue by -0.08 degrees: actual min ΔE00 is 10.01756.
    const out = await grade(
      mk({ color: { field: 'series', type: 'nominal' }, values: seriesRows(['a', 'b', 'c', 'd', 'e', 'f']) }),
    );
    expect(out.contrast).toBe('pass');
    expect(out.contrastNote).not.toContain('below 3:1');
    expect(out.contrastNote).not.toContain('Distinguishability caution');
  });

  it('the prior below-target palette still emits a caution when explicitly supplied', async () => {
    const prior = ['#416CD9', '#3E44BE', '#279669', '#B58525', '#CA4948', '#993B00'];
    const out = await grade(mk({
      color: { field: 'series', type: 'nominal' },
      values: seriesRows(['a', 'b', 'c', 'd', 'e', 'f']),
      tokens: Object.fromEntries(prior.map((paint, index) => [`--oods-viz-scale-categorical-0${index + 1}`, paint])),
    }));
    expect(out.contrast).toBe('pass');
    expect(out.contrastNote).toContain('Distinguishability caution');
    expect(out.contrastNote).toContain('9.88');
  });

  it('a near-white config.tokens override on the consumed slot -> role-C fail (WCAG-normative path)', async () => {
    // #F8F8F8 baked into mark.color vs the ~#FCFCFD canvas is < 3:1 — the mark is
    // invisible on the panel. Single-series: the override rides categorical-01 -> mark.color,
    // and the rendered bar carries exactly that paint.
    const out = await grade(mk({ tokens: { '--oods-viz-scale-categorical-01': '#F8F8F8' } }));
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('Role-C');
  });
});

describe('certify-contrast — role-A (categorical distinguishability, min-over-CVD)', () => {
  it('a chromatic-but-near-identical config.tokens override -> fail on role-A ΔE (<2), even though role-C + the F2 chroma floor pass', async () => {
    // Three near-identical muted blues: each has REAL chroma (~0.10, above the s146 F2 gray
    // floor) and passes role-C (~4.5:1), so the failure is PURELY categorical
    // indistinguishability (min-pairwise ΔE00-over-CVD < 2) — the role-A ΔE path, kept
    // distinct from the F2 chroma-floor path (which greys hit first). Baked into scale.range;
    // the three consumed series render the three blues, which is what is graded.
    // (Pre-s146 this used pure greys, but F2 now catches those on the chroma floor before
    // the ΔE check — see the chroma-floor block below.)
    const out = await grade(
      mk({
        color: { field: 'series', type: 'nominal' },
        values: seriesRows(['a', 'b', 'c']),
        tokens: {
          '--oods-viz-scale-categorical-01': '#6A6FB0',
          '--oods-viz-scale-categorical-02': '#6B70B1',
          '--oods-viz-scale-categorical-03': '#6C71B2',
        },
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('CIEDE2000'); // the ΔE-distance message, NOT the chroma floor
  });
});

describe('certify-contrast — role-A chroma floor (s146 F2 "reads-as-gray" guardrail)', () => {
  it('a low-chroma (reads-as-gray) config.tokens override -> fail on the chroma floor, before the ΔE check', async () => {
    // Three near-gray overrides (OKLCH chroma ~0, below the 0.03 floor): each passes role-C
    // vs the canvas, but a gray "palette" is not a real categorical scale, so F2 fails it
    // BEFORE the ΔE distinguishability check. F2's honest value: silent on the default palette,
    // teeth on a bad override (same posture as the s137 low-contrast override fail path).
    const out = await grade(
      mk({
        color: { field: 'series', type: 'nominal' },
        values: seriesRows(['a', 'b', 'c']),
        tokens: {
          '--oods-viz-scale-categorical-01': '#777777',
          '--oods-viz-scale-categorical-02': '#7A7A7A',
          '--oods-viz-scale-categorical-03': '#808080',
        },
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('chroma');
    expect(out.contrastNote).toContain('reads as gray');
  });

  it('the re-chromatized default palette is ABOVE the chroma floor -> the guardrail fires on nothing (zero-flip)', async () => {
    // Explicit neutral canvas isolates the chroma-floor rule from scoped light/A Role C.
    // Every s146 F1 slot is chroma >= 0.045 (the co-designed margin above the 0.03 floor), so
    // F2 never fires on the DEFAULT palette — a permanent zero-flip guardrail. The verdict is
    // the clean role-A pass, unchanged by F2. s222-m02: the recipe palette's chroma floor is 0.05, and the isolating
    // canvas is white (brand A's since m01), on which the recipe holds every slot to 3:1.
    const out = await grade(
      mk({ color: { field: 'series', type: 'nominal' }, values: seriesRows(['a', 'b', 'c', 'd', 'e', 'f']), tokens: { '--oods-sys-surface-canvas': '#FFFFFF' } }),
    );
    expect(out.contrast).toBe('pass');
    expect(out.contrastNote).not.toContain('chroma-floor');
  });
});

// ── s147 F5: certify grades an EXPLICIT agent color range BY CONSTRUCTION ──────────────
// The range regression adds encodings.color.range (hex[]) that the m02 adapter bakes into
// scale.range INSTEAD OF the OODS palette. certify grades the paints that range renders
// exactly as it grades the default palette's — so it grades an agent-supplied range with
// ZERO certify source edits (#110). This is the Fork B "honest-fail" proof: a gray/
// low-contrast "absent" slot in a presence scale truthfully fails, guiding the agent to a
// chromatic one.
//
// CRITIC AMENDMENT 4 (restated for the render, s176): each pin uses 2 DISTINCT-value rows
// so BOTH range slots actually render and role-A grades both — the engine grades the
// rendered assignment, so a binary range whose sample rows all carry one value renders
// (and grades) only color[0] and could PASS even with a bad second slot.
describe('certify-contrast — F5 explicit agent color range (sprint-147, honest-fail, no certify edit)', () => {
  it('a chromatic 2-color agent range -> PASS (certify grades the supplied range, not the OODS palette)', async () => {
    const out = await grade(
      mk({
        color: { field: 'series', type: 'nominal', range: ['#1F6FEB', '#D1242F'] },
        values: seriesRows(['present', 'absent']),
      }),
    );
    expect(out.contrast).toBe('pass');
  });

  it('a GRAY 2-color agent range -> contrast FAIL on the chroma floor (Fork B: a gray "absent" slot reads as gray)', async () => {
    // The presence-scale condition: a 2-color presence scale that uses gray for "absent"
    // truthfully fails — certify catches it with zero presence-exemption built.
    const out = await grade(
      mk({
        color: { field: 'series', type: 'nominal', range: ['#1F6FEB', '#808080'] },
        values: seriesRows(['present', 'absent']),
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('chroma');
    expect(out.contrastNote).toContain('reads as gray');
  });

  it('a low-contrast-vs-canvas 2-color agent range -> role-C FAIL (a near-white "absent" slot is invisible on the panel)', async () => {
    const out = await grade(
      mk({
        color: { field: 'series', type: 'nominal', range: ['#1F6FEB', '#F6F6F6'] },
        values: seriesRows(['present', 'absent']),
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('Role-C');
  });

  it('under-cardinality caveat (critic amendment 4): 1 distinct value masks the gray-absent fail -> PASS on color[0] only', async () => {
    // Same gray range as the fail case above, but every row carries the SAME value, so the
    // chart renders only color[0] and only that paint is graded. This is render-accurate BY
    // CONSTRUCTION now (the graded object IS the rendered assignment) but documents that
    // real-world under-cardinality can hide a gray "absent" slot — the honest-fail is not
    // over-claimed.
    const out = await grade(
      mk({
        color: { field: 'series', type: 'nominal', range: ['#1F6FEB', '#808080'] },
        values: seriesRows(['present', 'present']),
      }),
    );
    expect(out.contrast).toBe('pass');
  });
});

describe('certify-contrast — a missing categorical bake cannot claim the gradient exemption', () => {
  it.each(['nominal', 'ordinal'])('fails a compiled %s color channel when its actual palette range is removed', async (type) => {
    const spec = mk({ color: { field: 'series', type }, values: seriesRows(['a', 'b']) });
    const compiled = structuredClone(toVegaLiteSpec(spec));
    const unit = compiled as any;
    expect(unit.encoding.color.scale.range).toHaveLength(6);
    delete unit.encoding.color.scale.range;
    const out = await evaluateContrastPillar(spec, compiled);
    expect(out.contrast).toBe('fail');
    expect(out.contrastMeasured).toBe(false);
    expect(out.contrastNote).toContain('Categorical color encoding is missing its baked palette');
    expect(out.contrastNote).toContain('No categorical canvas ratio is graded');
  });

  it('a passing sibling or decorative fallback cannot hide the missing categorical bake', async () => {
    const spec = mkMulti({ marks: [
      { trait: 'MarkBar', color: { field: 'series', type: 'nominal' } },
      { trait: 'MarkPoint', color: { field: 'series', type: 'nominal' } },
    ], values: seriesRows(['a', 'b']) });
    const compiled = toVegaLiteSpec(spec) as any;
    const missing = compiled.layer[1];
    delete missing.encoding.color.scale.range;
    missing.mark = { ...missing.mark, color: '#eeeeee' };
    const out = await evaluateContrastPillar(spec, compiled);
    expect(out.contrast).toBe('fail');
    expect(out.contrastMeasured).toBe(false);
    expect(out.contrastNote).toContain('Categorical color encoding is missing its baked palette');
    expect(out.contrastNote).toContain('No categorical canvas ratio is graded for the missing-palette unit.');
  });
});

describe('certify-contrast — continuous/default color without a palette is WCAG-exempt', () => {
  it('a quantitative color encoding (baked NO range) -> exempt (gradient essential exception)', async () => {
    const out = await grade(mk({ color: { field: 'value', type: 'quantitative' } }));
    expect(out.contrast).toBe('exempt');
    expect(out.contrastNote).toContain('exception');
  });

  it('a linear-scaled color encoding -> exempt', async () => {
    const out = await grade(mk({ color: { field: 'value', scale: 'linear' } }));
    expect(out.contrast).toBe('exempt');
  });

  it('a divergence binding (color trait EncodingDetail, compiled quantitative, no baked range) -> exempt, NEVER a false pass', async () => {
    // The reborn-hollow case (s138 review): the bake gate leaves this quantitative, so the
    // compiled spec bakes no range — the unit classifies 'exempt' from the COMPILED spec,
    // before any render logic (s176 D5), dissolving the old false 'pass' from the deleted
    // grade-side classifier.
    const out = await grade(mk({ color: { field: 'series', trait: 'EncodingDetail', type: undefined } }));
    expect(out.contrast).toBe('exempt');
  });
});

describe('certify-contrast — honesty + determinism', () => {
  it("an unresolvable canvas (non-color override on the canvas token) -> 'ungradeable' (tried and failed), never 'unchecked' and never a silent pass", async () => {
    // The palette always resolves (the six OODS tokens are always available), so the
    // tried-and-failed path is reached via an unresolvable CANVAS reference: a colour-
    // bearing unit was identified and rendered, grading was attempted, the canvas could
    // not be resolved (s175 m04, #781 — was 'unchecked' before).
    const out = await grade(mk({ tokens: { '--oods-sys-surface-canvas': 'not-a-color' } }));
    expect(out.contrast).toBe('ungradeable');
    expect(out.contrastNote).toContain('Could not resolve');
  });

  it('a non-color override on a palette slot is IGNORED — the slot renders the OODS default, which certify grades (rendered-reality)', async () => {
    // Under s138 the adapter bakes the OODS default when an override is not a color, so
    // the chart still renders a real color and certify grades exactly that (categorical-01
    // baked into mark.color, rendered, vs the canvas -> pass) — never a silent 'unchecked'.
    const out = await grade(mk({ tokens: { '--oods-viz-scale-categorical-01': 'not-a-color' } }));
    expect(out.contrast).toBe('pass');
  });

  it('is a pure function of the IR — identical verdict across repeated calls (the render is deterministic)', async () => {
    const spec = mk({ color: { field: 'series', type: 'nominal' }, values: seriesRows(['a', 'b', 'c']) });
    const a = await grade(spec);
    const b = await grade(spec);
    expect(a).toEqual(b);
  });
});

// ── s140 [A] multi-mark UNION grading ─────────────────────────────────────────────────
// The engine walks EVERY rendered unit (all layers, the facet spec, every concat
// section) and combines them worst-verdict (fail>unchecked>pass>exempt). This closes the
// s139-review C1 false-'pass' (a poisoned non-first layer masked by a passing first
// layer) + the companion color-mark-not-first false-'unchecked'. Author decorative
// mark.color (a reference/annotation line ≠ the OODS categorical-01 slot) is a NEUTRAL
// skip, never a contrast fail (the Derek CASE-2 fork "grade OODS series colors only").

type MultiMarkInput = { trait: string; color?: ColorInput; optionColor?: string };

/**
 * A multi-mark / faceted / concat NormalizedVizSpec-shaped fixture. `optionColor`
 * becomes mark.options.color (author decoration); `color` becomes that mark's OWN
 * encodings.color (so only that layer carries it). Enough fields for toVegaLiteSpec to
 * compile + the engine to render and grade.
 */
function mkMulti(opts: {
  marks: MultiMarkInput[];
  values?: Array<Record<string, unknown>>;
  tokens?: Record<string, string | number>;
  layout?: Record<string, unknown>;
}): NormalizedVizSpec {
  const spec: Record<string, unknown> = {
    marks: opts.marks.map((m) => ({
      trait: m.trait,
      ...(m.optionColor ? { options: { color: m.optionColor } } : {}),
      ...(m.color
        ? { encodings: { color: { field: m.color.field ?? 'region', trait: 'EncodingColor', ...m.color } } }
        : {}),
    })),
    encoding: {
      x: { field: 'x', trait: 'EncodingX' },
      y: { field: 'y', trait: 'EncodingY' },
    },
    data: { values: opts.values ?? [] },
    a11y: { description: 'multi-mark contrast fixture' },
    ...(opts.layout ? { layout: opts.layout } : {}),
  };
  if (opts.tokens) spec.config = { tokens: opts.tokens };
  return spec as unknown as NormalizedVizSpec;
}

const regionRows = (labels: string[]) => labels.map((r) => ({ x: 'q', y: 1, region: r, value: 1 }));

describe('certify-contrast — s140 multi-mark union grading', () => {
  it('C1 repro: a passing decorative mark.color on the first layer + a role-C-failing color palette on a later layer -> fail (was a false pass)', async () => {
    // marks[0] = a black reference line (options.color '#000000', passes role-C on its
    // own); marks[1] = a color-encoded points layer whose baked scale.range is poisoned
    // near-white by a config.tokens override (< 3:1 vs the canvas). Pre-s140 the engine
    // read ONLY layer[0] (the line) and returned 'pass', masking the real role-C failure.
    // Now it grades BOTH units and the point layer's role-C fail wins the union.
    const out = await grade(
      mkMulti({
        marks: [
          { trait: 'MarkLine', optionColor: '#000000' },
          { trait: 'MarkPoint', color: { field: 'region', type: 'nominal' } },
        ],
        values: regionRows(['n', 's', 'e']),
        tokens: {
          '--oods-viz-scale-categorical-01': '#F8F8F8',
          '--oods-viz-scale-categorical-02': '#F6F6F6',
          '--oods-viz-scale-categorical-03': '#F4F4F4',
        },
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('Role-C');
  });

  it('companion regression: the color-bearing mark is NOT the first layer -> pass (was a false unchecked)', async () => {
    // marks[0] is a colorless line (CASE 4 -> neutral skip, not 'unchecked'); marks[1]
    // carries the default OODS palette (role-C pass, role-A a clean >=10 pass post-s146). Pre-s140
    // the engine read layer[0] (colorless) and returned 'unchecked'; now the colorless
    // unit is skipped and the color-encoded sibling drives the verdict.
    const out = await grade(
      mkMulti({
        marks: [
          { trait: 'MarkLine' },
          { trait: 'MarkPoint', color: { field: 'region', type: 'nominal' } },
        ],
        values: regionRows(['n', 's', 'e']),
      }),
    );
    expect(out.contrast).toBe('pass');
  });

  it('a faint author annotation line + a passing color-encoded data layer -> pass (the decoration is skipped, not failed)', async () => {
    // A grey reference line (options.color '#CCCCCC' ≠ the OODS categorical-01 slot) is
    // chrome, so the CASE-2 fork skips it; only the OODS-palette data layer is graded.
    const out = await grade(
      mkMulti({
        marks: [
          { trait: 'MarkLine', optionColor: '#CCCCCC' },
          { trait: 'MarkPoint', color: { field: 'region', type: 'nominal' } },
        ],
        values: regionRows(['n', 's', 'e']),
      }),
    );
    expect(out.contrast).toBe('pass');
  });

  it('a gradient (exempt) layer + a categorical (pass) layer -> pass — a graded categorical dominates a gradient', async () => {
    const out = await grade(
      mkMulti({
        marks: [
          { trait: 'MarkLine', color: { field: 'value', type: 'quantitative' } },
          { trait: 'MarkPoint', color: { field: 'region', type: 'nominal' } },
        ],
        values: regionRows(['n', 's', 'e']),
      }),
    );
    expect(out.contrast).toBe('pass');
  });

  it('facet-of-layer: the walker descends facet.spec.layer and grades every unit', async () => {
    // A faceted 2-mark chart compiles to {facet, spec:{layer:[bar(color), line(colorless)]}}.
    // The colored bar is graded (pass), the colorless line is skipped — proving the walker
    // reaches units nested under the facet spec's layer array, not just the top level.
    const out = await grade(
      mkMulti({
        marks: [
          { trait: 'MarkBar', color: { field: 'region', type: 'nominal' } },
          { trait: 'MarkLine' },
        ],
        values: regionRows(['n', 's', 'e']),
        layout: { trait: 'LayoutFacet', columns: { field: 'region' } },
      }),
    );
    expect(out.contrast).toBe('pass');
  });

  it('concat: the walker grades every section (both hconcat units), not just the first', async () => {
    // A 2-section horizontal concat clones the color-encoded primitive into each section;
    // both units carry the default OODS palette -> both grade -> union pass (no crash,
    // every section reached).
    const out = await grade(
      mkMulti({
        marks: [{ trait: 'MarkBar', color: { field: 'region', type: 'nominal' } }],
        values: regionRows(['n', 's', 'e']),
        layout: {
          trait: 'LayoutConcat',
          direction: 'horizontal',
          sections: [{ id: 'left' }, { id: 'right' }],
        },
      }),
    );
    expect(out.contrast).toBe('pass');
  });
});

// ── s176 m01: the RENDERED SERIES-TO-PAINT ASSIGNMENT is the graded object ────────────
// The engine-level half of the §0 ten-series proof (the handler-level RED-first spec is
// artifact.certify.ten-series-collision.spec.ts). What these pin: duplicates are
// RETAINED (a recycled pair is ΔE00=0 -> the existing role-A fail floor, D3), the
// pre-s176 cardinality slice is DEAD (slots beyond 6 are graded, D4/D8), an author
// decoration in a palette hex cannot fake a collision (D2's rejected multiset reading),
// and an empty sample is honestly 'unchecked' (D6 — nothing rendered, nothing graded).
describe('certify-contrast — s176 render-backed assignment grading', () => {
  it('ten series over the six-slot default palette -> role-A ΔE00=0 fail (the recycled assignment reaches the grader)', async () => {
    const out = await grade(
      mk({
        // Isolate recycled assignments from the light/A slot-04 canvas failure. s222-m02: on white, brand A's canvas since
        // m01, where the recipe holds every slot to 3:1 (on #FCFCFD slots 02 and 06 fall under it).
        tokens: { '--oods-sys-surface-canvas': '#FFFFFF' },
        color: { field: 'series', type: 'nominal' },
        values: seriesRows(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']),
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('Role-A fail: min-pairwise CIEDE2000');
    expect(out.contrastNote).toContain('= 0.00 < 2');
  });

  it('an agent range LONGER than 6 slots is fully graded — the dead slice no longer caps at 6 (D8 coverage expansion)', async () => {
    // 8 distinct series over an 8-hex agent range whose EIGHTH slot is near-white: the
    // pre-s176 slice graded min(8, min(8, 6)) = 6 slots, so slot 8 was invisible and the
    // chart passed. Render-backed, all 8 rendered paints are graded and the near-white
    // eighth fails role-C — the note names its positional token, proving the grade
    // reached past the old cap.
    const out = await grade(
      mk({
        color: {
          field: 'series',
          type: 'nominal',
          range: ['#1F6FEB', '#D1242F', '#279669', '#B78827', '#8250DF', '#0FB5BA', '#993B00', '#F6F6F6'],
        },
        values: seriesRows(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
      }),
    );
    expect(out.contrast).toBe('fail');
    expect(out.contrastNote).toContain('Role-C');
    expect(out.contrastNote).toContain('--oods-viz-scale-categorical-08');
  });

  it('an author decoration painted in a PALETTE hex cannot fake a ΔE00=0 collision (D2 — the rejected multiset reading)', async () => {
    // marks[0] = an annotation line whose options.color IS the default categorical-02 hex
    // (#3E44BE). Under a raw per-mark paint multiset that duplicate would read as a
    // recycled pair (ΔE00=0 -> fail). It must not: the decoration is not the slot-1 color,
    // so the CASE-2 fork skips it, and duplicates can only arise from consumed cardinality
    // exceeding the rendered paints — three series over three slots has none.
    const out = await grade(
      mkMulti({
        marks: [
          { trait: 'MarkLine', optionColor: '#3E44BE' },
          { trait: 'MarkPoint', color: { field: 'region', type: 'nominal' } },
        ],
        values: regionRows(['n', 's', 'e']),
      }),
    );
    expect(out.contrast).toBe('pass');
    expect(out.contrastNote).not.toContain('= 0.00');
  });

  it("an empty sample renders no marks -> 'unchecked' (a series unit with nothing rendered is not graded, D6)", async () => {
    // A color-bearing single-series unit whose data is empty renders an empty mark group:
    // no series paint exists in the SVG, so there is nothing to grade — honest
    // 'unchecked' with the reworded no-gradeable-paint note, never a silent 'pass' read
    // off bytes the chart did not render.
    const out = await grade(mk({ values: [] }));
    expect(out.contrast).toBe('unchecked');
    expect(out.contrastNote).toContain('No gradeable OODS series paint');
  });
});
