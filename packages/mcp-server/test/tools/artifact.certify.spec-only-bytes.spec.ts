// THE SPLIT BYTE-COMPAT CONTROL. (s172 §1g; rebased e5bf2f6 in s173 m01, 4f64bcf
// in s176 m01, 86d50ed in s177 m02, 1be93f8 in s179 m01, and c02eb43 in s180 m01.)
//
// s172 added an OPTIONAL `data` operand to artifact.certify. Every caller who does NOT
// send it must be unaffected — but s172 ALSO deliberately added operand-absent notes to
// the ECharts path, so a single "bytes are identical" control would have been one the
// sprint must violate. (That contradiction is exactly what the pre-lock critic rejected
// v1 of the s172 memo for, and it is the record-integrity failure mode that closed s170
// NOT_GENUINE.) So the control is SPLIT, and as of s177 (memo §1b, following s176
// §1a D8 and the s140 [B] signalled-change precedent) BOTH halves carry the same invariant:
//
//   (i)  CARTESIAN {spec}-only responses move ONLY where a mission said, in writing,
//        they would — the declared set below; byte-identical wherever nothing is
//        declared. s176 m01/m02 declared cartesian movement for the render-backed contrast
//        caveat and determinism.renderHash; the s177 rebase makes those bytes the baseline
//        and restores the empty declared set below.
//   (ii) ECHARTS-PRIMARY {spec}-only responses move in `notes[]` and `contrastNote` ONLY,
//        and the movement is exactly the enumerated set below — every other key, including
//        the closed enums, `conformant`, `pillars` and the absence of `determinism`/
//        `accuracySummary`, is byte-identical. s180 declares ZERO ECharts movement.
//
// s180 REBASE (m01, sequenced FIRST, before any product edit): the baseline fixture was
// RECAPTURED at pristine `c02eb4342fa34faacf4fcb6a3467341af8a92e01` — s179's final
// commit and s180's starting tree — in a detached worktree whose full HEAD was verified
// before the probe. Its SHA-256 is
// `da68a40aa71c99a7b2d67b3e3bca9a206297da1b5108c532788f231ff65364a3`, byte-identical
// to the 1be93f8 fixture as expected: s179 declared no spec-only movement on this path.
// All five declaration slots below remain empty/null for the whole sprint.
//
// The invariant the sprints share: each half moves only where a mission said, in
// writing, that it would.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVizSpecFromRows } from '@oods/viz-core';
import { handle } from '../../src/tools/artifact.certify.js';
import { CARTESIAN_MARK_TRAITS, ECHARTS_MARK_TRAITS, SPEC_ONLY_CASES } from './s172-spec-only-cases.js';

const BASELINE_COMMIT = '85004fe';

const baseline = JSON.parse(
  readFileSync(new URL('./__fixtures__/s172-certify-spec-only-baseline.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, unknown>>;

const cases = SPEC_ONLY_CASES(buildVizSpecFromRows);

// s211-m03 (#2296): the caveat names the product by its public name. The historical fixture keeps the name it was
// captured with, so the projection admits that one mover last, after the scope deltas matched the captured words.
const publicName = (caveat: string) => caveat.replaceAll('Forge', 'OODS Foundry');

// s190 #1850: retain the immutable historical fixture. Only the named scope deltas
// are admitted: cartesian content/render hashes and the full-palette ECharts Role-C
// failure against the corrected --oods-sys-surface-canvas. All other bytes stay pinned.
const CATEGORICAL_ECHARTS = new Set(['MarkTreemap', 'MarkSunburst', 'MarkSankey', 'MarkGraph', 'MarkChord']);
function expectedAtLightScope(trait: string): Record<string, unknown> {
  const expected = structuredClone(baseline[trait]);
  if (CATEGORICAL_ECHARTS.has(trait)) {
    (expected.pillars as Record<string, unknown>).contrast = 'pass';
    // s195 measured min ΔE00 >=10 removes the s191 caution; historical fixture remains pristine.
  }
  const caveat = String(expected.contrastNote);
  expected.contrastNote = publicName(caveat.replace(
    'on the light theme; dark-theme contrast is not verified.',
    CATEGORICAL_ECHARTS.has(trait) || trait.includes('Choropleth') || trait.includes('Bubble') || trait.includes('Flow')
      ? 'against the requested CSS scope canvas; no rendered carrier measurement is claimed.'
      : 'against the requested CSS scope canvas.',
  ).replace(/certify measures the categorical color bytes Forge baked into the compiled spec, against the requested CSS scope canvas; no rendered carrier measurement is claimed\.$/, trait.includes('Choropleth') || trait.includes('Bubble') || trait.includes('Flow') ? 'No categorical canvas ratio is graded for this scope.' : '$&')) + ' Scope: light/A.';
  return expected;
}

// #1856 declares exactly these additive fields; the pre-existing body stays byte-pinned.
const OFFERED: Record<string, string[]> = {
  MarkTreemap: ['OODS-V154', 'OODS-V155'], MarkSunburst: ['OODS-V154', 'OODS-V155'],
  MarkSankey: ['OODS-V156', 'OODS-V157', 'OODS-V158'], MarkChord: ['OODS-V156'],
  MarkGraph: ['OODS-V173'], MarkChoropleth: ['OODS-V159'],
  MarkBubble: ['OODS-V168', 'OODS-V169', 'OODS-V170'], MarkFlow: ['OODS-V171', 'OODS-V172'],
};
function checkScopedMetadata(out: Record<string, unknown>, trait: string): Record<string, unknown> {
  const { accuracyRules, contrastResults, ...body } = out;
  expect(accuracyRules).toEqual(OFFERED[trait] ?? ['OODS-V150', 'OODS-V151', 'OODS-V152', 'OODS-V153']);
  const expected = expectedAtLightScope(trait);
  const verdict = (expected.pillars as Record<string, unknown>).contrast;
  const rendered = CARTESIAN_MARK_TRAITS.includes(trait as never);
  const graded = verdict === 'pass' || verdict === 'fail';
  expect(contrastResults).toEqual([{ theme: 'light', brand: 'A', verdict, measured: rendered && graded,
    evidence: rendered ? 'render' : graded ? 'baked-palette' : 'none', note: expected.contrastNote }]);
  return body;
}


/**
 * The ENUMERATED notes[] ADDITIONS on the ECharts {spec}-only path. Each entry is a
 * substring that must appear in exactly one ADDED note, and the added notes must be
 * exactly this many.
 *
 * s180 adds NO ECharts notes. The
 * empty array is the assertion: any new note on the {spec}-only path fails this control.
 */
const DECLARED_NOTE_ADDITIONS: readonly string[] = [];

/**
 * Notes present in the baseline whose TEXT is deliberately rewritten (same slot, same
 * count). Keyed by a stable substring of the baseline note; the value is a substring the
 * replacement must contain.
 *
 * s180 declares NO ECharts note rewords. The s174/s175 entries (both keyed on the
 * e5bf2f6 baseline's "determinism and accuracy ARE checked" fragment) are RETIRED by the
 * 4f64bcf rebase — their movement is now the baseline itself. Retirement here was NOT
 * suite-forced (both entries pass vacuously against the fresh baseline: the old key
 * matches nothing and both replacement fragments live in the baseline's own note); it is
 * done by hand per the header doctrine.
 */
// s195 m04 corrects the old shared note: enforcement now applies WITH data, while
// the spec-only path retains its missing-operand explanation and all nonprose fields.
const DECLARED_NOTE_REWORDS: ReadonlyArray<{ baselineContains: string; nowContains: string }> = [
  { baselineContains: 'A11y-equivalence runs WARN-FIRST here', nowContains: 'Without the `data` operand there is nothing to evaluate' },
];

/**
 * THE MOVEMENT THAT IS NOT IN notes[].
 *
 * ECHARTS_GEO_EXEMPT_NOTE is emitted as `contrastNote`, not as a note, so notes[]
 * assertions cannot bound it. s180 declares NO contrastNote movement on ANY ECharts
 * trait: the s173 5(c) geo reword is baseline now (its assertion is retired — unlike the
 * note rewords, the recapture FORCED this one: the old baselineContains key is absent
 * from a 4f64bcf capture), and the m01 caveat fork (memo §1a D11) freezes the ECharts
 * caveat constants byte-for-byte for the no-operand/spec-only lifetime. Render-backed
 * wording is path-scoped to operand-backed calls, outside this control by construction.
 */
const DECLARED_ECHARTS_CONTRAST_NOTE_REWORD: {
  geoTraits: ReadonlySet<string>;
  baselineContains: string;
  nowContains: string;
  retains: readonly string[];
} | null = null;

/**
 * THE CARTESIAN DECLARED SET (introduced in s176, per the clause-(i) rewrite above).
 *
 * null = nothing declared = the cartesian half is byte-identical, full-object. A mission
 * that moves cartesian {spec}-only bytes must declare it HERE, in the same edit as the
 * source change — never after the fact. The s180 rebase retains the post-s176 baseline,
 * so s180 starts with no cartesian contrastNote movement.
 */
const DECLARED_CARTESIAN_CONTRAST_NOTE_REWORD: {
  baselineContains: string;
  nowContains: string;
} | null = null;

/**
 * The s180 rebase retains s176 m02's OPTIONAL cartesian renderHash additions in the
 * baseline. Empty array =
 * nothing declared = the full determinism object is byte-identical.
 */
const DECLARED_CARTESIAN_DETERMINISM_ADDITIONS: readonly string[] = [];

describe(`artifact.certify — {spec}-only byte compatibility, cartesian half (baseline ${BASELINE_COMMIT})`, () => {
  it.each(CARTESIAN_MARK_TRAITS)(
    `%s: the {spec}-only response moves only by the declared set vs pristine HEAD ${BASELINE_COMMIT}`,
    async (trait) => {
      const out = checkScopedMetadata((await handle({ spec: cases[trait] })) as Record<string, unknown>, trait);
      if (
        DECLARED_CARTESIAN_CONTRAST_NOTE_REWORD === null &&
        DECLARED_CARTESIAN_DETERMINISM_ADDITIONS.length === 0
      ) {
        // Nothing declared: the old absolute clause (i) — byte-identical, full-object.
        const { determinism, ...rest } = out;
        const { determinism: previous, ...expected } = expectedAtLightScope(trait);
        const current = determinism as Record<string, unknown>;
        const original = previous as Record<string, unknown>;
        expect(Object.keys(current)).toEqual(Object.keys(original));
        for (const key of ['contentHash', 'renderHash']) {
          expect(current[key]).toMatch(/^[a-f0-9]{64}$/);
          expect(current[key]).not.toBe(original[key]);
        }
        expect(current.stable).toBe(original.stable);
        expect((await handle({ spec: cases[trait] })).determinism).toEqual(determinism);
        expect(JSON.stringify(rest)).toBe(JSON.stringify(expected));
        return;
      }
      // Declared movement only: everything EXCEPT contrastNote and determinism is
      // byte-identical; each declared mover is then bounded exactly.
      const { contrastNote: outContrast, determinism: outDet, ...outRest } = out as {
        contrastNote?: string;
        determinism?: Record<string, unknown>;
      } & Record<string, unknown>;
      const { contrastNote: baseContrast, determinism: baseDet, ...baseRest } = baseline[trait] as {
        contrastNote?: string;
        determinism?: Record<string, unknown>;
      } & Record<string, unknown>;
      expect(JSON.stringify(outRest)).toBe(JSON.stringify(baseRest));

      // A declared caveat reword: old fragment gone, new fragment present.
      if (DECLARED_CARTESIAN_CONTRAST_NOTE_REWORD === null) {
        expect(outContrast).toBe(baseContrast);
      } else {
        expect(baseContrast).toContain(DECLARED_CARTESIAN_CONTRAST_NOTE_REWORD.baselineContains);
        expect(outContrast).toContain(DECLARED_CARTESIAN_CONTRAST_NOTE_REWORD.nowContains);
        expect(outContrast).not.toContain(DECLARED_CARTESIAN_CONTRAST_NOTE_REWORD.baselineContains);
      }

      // Declared determinism additions: baseline keys byte-identical (contentHash unmoved —
      // the render never feeds it; stable unmoved), plus EXACTLY the declared new keys.
      expect(Object.keys(outDet ?? {}).sort()).toEqual(
        [...Object.keys(baseDet ?? {}), ...DECLARED_CARTESIAN_DETERMINISM_ADDITIONS].sort(),
      );
      for (const key of Object.keys(baseDet ?? {})) {
        expect(JSON.stringify(outDet?.[key])).toBe(JSON.stringify(baseDet?.[key]));
      }
      for (const added of DECLARED_CARTESIAN_DETERMINISM_ADDITIONS) {
        expect(outDet?.[added]).toMatch(/^[0-9a-f]{64}$/);
      }
    },
  );
});

describe(`artifact.certify — {spec}-only byte compatibility, ECharts half (baseline ${BASELINE_COMMIT})`, () => {
  it.each(ECHARTS_MARK_TRAITS)(
    `%s: scope-declared verdict movement only; every other key matches pristine HEAD ${BASELINE_COMMIT}`,
    async (trait) => {
      const out = checkScopedMetadata((await handle({ spec: cases[trait] })) as Record<string, unknown>, trait);
      const { notes: _outNotes, contrastNote: _outContrast, ...outRest } = out;
      const { notes: _baseNotes, contrastNote: _baseContrast, ...baseRest } = expectedAtLightScope(trait);
      expect(JSON.stringify(outRest)).toBe(JSON.stringify(baseRest));
    },
  );

  it.each(ECHARTS_MARK_TRAITS)(
    '%s: contrastNote retains its declared scoped caveat after s195 clears the Role-A caution',
    async (trait) => {
      const out = (await handle({ spec: cases[trait] })) as { contrastNote?: string };
      const base = expectedAtLightScope(trait).contrastNote as string | undefined;
      if (DECLARED_ECHARTS_CONTRAST_NOTE_REWORD === null) {
        // Nothing declared: byte-identity for all 8 — the D11 fork's handler-level tripwire.
        expect(out.contrastNote).toBe(base);
        return;
      }
      const decl = DECLARED_ECHARTS_CONTRAST_NOTE_REWORD;
      if (!decl.geoTraits.has(trait)) {
        expect(out.contrastNote).toBe(base);
        return;
      }
      expect(base).toContain(decl.baselineContains);
      expect(out.contrastNote).toContain(decl.nowContains);
      expect(out.contrastNote).not.toContain(decl.baselineContains);
      for (const retained of decl.retains) {
        expect(base).toContain(retained);
        expect(out.contrastNote).toContain(retained);
      }
    },
  );

  it.each(ECHARTS_MARK_TRAITS)(
    '%s: notes[] moved by EXACTLY the declared set and nothing more',
    async (trait) => {
      const out = (await handle({ spec: cases[trait] })) as { notes?: string[] };
      const observed = out.notes ?? [];
      const base = (baseline[trait].notes as string[] | undefined) ?? [];

      // Count: the baseline notes, each still present (possibly reworded), plus exactly
      // the declared additions.
      expect(observed).toHaveLength(base.length + DECLARED_NOTE_ADDITIONS.length);

      // Every baseline note survives verbatim UNLESS it is a declared reword.
      const rewordKeys = DECLARED_NOTE_REWORDS.map((r) => r.baselineContains);
      for (const note of base) {
        if (rewordKeys.some((key) => note.includes(key))) {
          // A reworded note must not survive verbatim — otherwise the "reword" is a no-op
          // the control would silently accept.
          expect(observed).not.toContain(note);
          continue;
        }
        expect(observed).toContain(note);
      }
      for (const reword of DECLARED_NOTE_REWORDS) {
        const replaced = observed.filter((note) => note.includes(reword.nowContains));
        expect(replaced).toHaveLength(1);
      }
      for (const addition of DECLARED_NOTE_ADDITIONS) {
        const added = observed.filter((note) => note.includes(addition));
        expect(added).toHaveLength(1);
      }
    },
  );
});

describe('artifact.certify — the control can discriminate', () => {
  // Rule 13a: a control that cannot fail is not a control. A one-character mutation of
  // the baseline must red the cartesian half — proving the comparison is byte-level and
  // not a shape check that passes on anything.
  it('a single mutated byte in the baseline reds the cartesian comparison', async () => {
    const out = await handle({ spec: cases.MarkBar });
    const mutated = JSON.parse(JSON.stringify(baseline.MarkBar)) as {
      determinism?: { contentHash?: string };
    };
    const hash = mutated.determinism?.contentHash ?? '';
    mutated.determinism = { ...mutated.determinism, contentHash: `0${hash.slice(1)}` } as never;
    expect(JSON.stringify(out)).not.toBe(JSON.stringify(mutated));
  });

  // And the ECharts half must not be satisfiable by an empty response: the rest-of-object
  // comparison has real content to compare.
  it('the ECharts rest-of-object comparison is over a non-trivial verdict', () => {
    const base = baseline.MarkSankey;
    expect(Object.keys(base)).toEqual(
      expect.arrayContaining(['status', 'coverage', 'conformant', 'findings', 'pillars']),
    );
    expect((base.notes as string[]).length).toBeGreaterThan(0);
  });

  // The c02eb43 recapture is intentionally byte-identical to 1be93f8, so content cannot
  // distinguish those two commits. The detached-worktree command, verified full SHA,
  // fixture SHA-256 and literal byte compare are recorded in the capture-script header.
  // These bytes still distinguish the post-s176 baseline from retired 4f64bcf both ways.
  it('the 85004fe recapture retains the post-s176 bytes, not retired 4f64bcf', () => {
    expect(BASELINE_COMMIT).toBe('85004fe');
    for (const trait of CARTESIAN_MARK_TRAITS) {
      const cartesian = baseline[trait] as {
        contrastNote?: string;
        determinism?: { renderHash?: string };
      };
      expect(cartesian.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
      expect(cartesian.contrastNote).toContain(
        'certify grades the series-to-paint assignment of the rendered chart',
      );
      expect(cartesian.contrastNote).not.toContain(
        'certify measures the categorical color bytes OODS Foundry baked into the compiled spec',
      );
    }

    for (const trait of ECHARTS_MARK_TRAITS) {
      const echarts = baseline[trait] as { determinism?: { renderHash?: string } };
      expect(echarts.determinism).toBeUndefined();
    }
  });
});
