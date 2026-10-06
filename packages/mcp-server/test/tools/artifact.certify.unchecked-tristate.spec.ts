// s175 m04 (#781) — the contrast pillar's tri-state at the HANDLER level:
//   'ungradeable'  = grading was ATTEMPTED on a colour-bearing unit and failed for a reason
//                    outside the spec (here: an unresolvable canvas token) -> pulls conformant
//                    false;
//   'unchecked'    = nothing was gradeable (an author-decorative mark colour is a neutral skip,
//                    so no colour-bearing unit was identified) -> conformant stays a11y-driven
//                    (the s139 lock, decisions #1040/#1042 [B]).
// The two flavours differ in the PILLAR VALUE, not only in the note. Payloads are the memo
// §1d.8 spec INLINE (the same bytes the live :4466 re-POST uses), never a fixture import.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalize, sha256 } from '@oods/artifacts';
import { toVegaLiteSpec, type NormalizedVizSpec } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { handle } from '../../src/tools/artifact.certify.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

// Memo §1d.8, verbatim: a conformant cartesian bar whose canvas token is poisoned with a
// non-colour. The adapter bakes categorical-01 as mark.color (CASE 2), so a colour-bearing
// unit IS identified; the grader then cannot resolve the canvas it must grade against.
const POISONED_CANVAS_SPEC = {
  $schema: 'https://oods-foundry.com/viz-spec/v1',
  id: 'viz:bar',
  name: 'Bar chart',
  data: {
    values: [
      { region: 'North', quarter: 'Q1', revenue: 100 },
      { region: 'South', quarter: 'Q1', revenue: 120 },
      { region: 'East', quarter: 'Q1', revenue: 90 },
    ],
  },
  marks: [{ trait: 'MarkBar' }],
  encoding: {
    x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', type: 'nominal', title: 'Region' },
    y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', aggregate: 'sum', title: 'Revenue' },
  },
  a11y: { description: 'Bar chart of sum of revenue by region.', ariaLabel: 'Bar chart of Revenue by Region' },
  portability: { tableColumnOrder: ['region', 'revenue', 'quarter'] },
  config: { tokens: { '--oods-sys-surface-canvas': 'not-a-color' } },
} as const;

// The decorative variant (memo §1d.8): the same spec with an author mark colour and no
// config.tokens. CASE 2 skips a non-OODS mark.color as decorative chrome -> no colour-bearing
// unit -> nothing to grade.
const DECORATIVE_SPEC = (() => {
  const { config: _config, ...rest } = POISONED_CANVAS_SPEC;
  return { ...rest, marks: [{ trait: 'MarkBar', options: { color: '#000000' } }] };
})();

// Decorative AND poisoned: the canvas is never consulted on the decorative path, so the
// poison must not move the verdict.
const DECORATIVE_POISONED_SPEC = { ...DECORATIVE_SPEC, config: POISONED_CANVAS_SPEC.config };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const certify = (spec: unknown) => handle({ spec: clone(spec) } as never);
// The hash certify must report: the untouched toVegaLiteSpec compile, canonicalized —
// computed here, never pasted as a literal.
const expectedHash = (spec: unknown) =>
  sha256(canonicalize(toVegaLiteSpec(clone(spec) as NormalizedVizSpec)));

describe("artifact.certify — contrast tri-state: 'ungradeable' (tried and failed) vs 'unchecked' (nothing to grade)", () => {
  describe('poisoned canvas — grading was attempted on a colour-bearing unit and could not resolve the canvas', () => {
    it("pillars.contrast is 'ungradeable' (not 'unchecked') on the certified path", async () => {
      const out = await certify(POISONED_CANVAS_SPEC);
      expect(out.status).toBe('ok');
      expect(out.coverage).toBe('certified');
      expect(out.pillars?.contrast).toBe('ungradeable');
    });

    it('conformant is false — a tried-and-failed grade pulls the fold', async () => {
      const out = await certify(POISONED_CANVAS_SPEC);
      expect(out.conformant).toBe(false);
    });

    it('the other pillars are untouched, the note names the unresolved canvas, contentHash is the untouched compile hash, AJV-valid', async () => {
      const out = await certify(POISONED_CANVAS_SPEC);
      expect(out.pillars?.a11yEquivalence).toBe('pass');
      expect(out.pillars?.determinism).toBe('pass');
      expect(out.pillars?.accuracy).toBe('pass');
      expect(out.findings).toEqual([]);
      expect(out.contrastNote).toContain('Could not resolve');
      expect(out.determinism?.stable).toBe(true);
      expect(out.determinism?.contentHash).toBe(expectedHash(POISONED_CANVAS_SPEC));
      expect(validateOutput(out)).toBe(true);
    });
  });

  describe('author-decorative mark colour — nothing to grade (the s139 lock, must not move)', () => {
    it("pillars.contrast is 'unchecked' and conformant stays true (a11y-driven)", async () => {
      const out = await certify(DECORATIVE_SPEC);
      expect(out.status).toBe('ok');
      expect(out.coverage).toBe('certified');
      expect(out.pillars?.contrast).toBe('unchecked');
      // s176 m01 — the ONLY declared tristate movement: the 'unchecked' note text widened
      // to the render-backed wording (nothing gradeable RENDERED). Every other assertion
      // in this file is a byte-level non-mover.
      expect(out.contrastNote).toContain('No gradeable OODS series paint');
      expect(out.conformant).toBe(true);
      expect(out.determinism?.contentHash).toBe(expectedHash(DECORATIVE_SPEC));
      expect(validateOutput(out)).toBe(true);
    });

    it('decorative + poisoned canvas → the verdict is UNCHANGED (the canvas is never consulted)', async () => {
      const plain = await certify(DECORATIVE_SPEC);
      const poisoned = await certify(DECORATIVE_POISONED_SPEC);
      expect(poisoned.pillars).toEqual(plain.pillars);
      expect(poisoned.conformant).toBe(plain.conformant);
      expect(poisoned.contrastNote).toBe(plain.contrastNote);
      expect(poisoned.findings).toEqual(plain.findings);
      expect(poisoned.notes ?? []).toEqual(plain.notes ?? []);
      expect(poisoned.pillars?.contrast).toBe('unchecked');
      expect(poisoned.conformant).toBe(true);
      // The hash is the untouched compile either way (config.tokens rides the compiled spec).
      expect(poisoned.determinism?.contentHash).toBe(expectedHash(DECORATIVE_POISONED_SPEC));
      expect(validateOutput(poisoned)).toBe(true);
    });
  });

  it('the two flavours differ in the PILLAR VALUE itself — a reader never has to parse the note to tell them apart', async () => {
    const tried = await certify(POISONED_CANVAS_SPEC);
    const nothing = await certify(DECORATIVE_SPEC);
    expect(tried.pillars?.contrast).not.toBe(nothing.pillars?.contrast);
    expect(tried.conformant).not.toBe(nothing.conformant);
  });
});
