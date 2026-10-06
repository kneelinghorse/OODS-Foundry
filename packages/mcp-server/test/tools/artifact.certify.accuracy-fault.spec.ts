// s171 m05a — certified-path accuracy engine-fault degradation (s170 review LOW carry,
// lifted from the proven scratchpad/s171-accuracy-fault-prototype).
// Exercises the previously-unexecuted catch in artifact.certify.ts (accuracy pillar
// try/catch) through the REAL handler, by partial-mocking @oods/viz-core so ONLY
// evaluateAccuracyRules throws; every other export stays actual. This lives in its OWN
// file because vi.mock is file-wide — the existing 72-test certify spec must never run
// under a mocked viz-core.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// A steerable fault switch, hoisted above the mock factory. The disarmed control test
// proves the mock is the ONLY difference between 'unchecked' and 'pass' (bite proof).
const accuracyFault = vi.hoisted(() => ({ armed: true }));

vi.mock('@oods/viz-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const realEvaluate = actual.evaluateAccuracyRules as (...args: unknown[]) => unknown;
  return {
    ...actual,
    evaluateAccuracyRules: (...args: unknown[]) => {
      if (accuracyFault.armed) {
        throw new Error('synthetic accuracy-engine fault (s171 m05a)');
      }
      return realEvaluate(...args);
    },
  };
});

import { buildVizSpecFromRows } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { handle } from '../../src/tools/artifact.certify.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

// Mirrors the fixture at test/tools/artifact.certify.spec.ts — a conformant cartesian
// bar IR whose baseline verdict is conformant:true with zero findings.
const ROWS3 = [
  { region: 'North', quarter: 'Q1', revenue: 100 },
  { region: 'South', quarter: 'Q1', revenue: 120 },
  { region: 'East', quarter: 'Q1', revenue: 90 },
];
const buildSpec = () =>
  buildVizSpecFromRows({
    rows: ROWS3,
    chartType: 'bar',
    encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } } as never,
  }).spec;

// Verbatim, including the interpolated real ACCURACY_RULES.length — "4 rules were
// offered." is a DELIBERATE scope tripwire: a fifth accuracy rule changes this string
// and must consciously update this test. (s175 m04: the pillar word is 'ungradeable'.)
const FAULT_NOTE =
  'The accuracy rules could not be evaluated for this spec; the pillar is reported ungradeable rather than passed. 4 rules were offered.';

describe('artifact.certify — certified-path accuracy engine fault (s170 review LOW carry)', () => {
  it("an accuracy-engine throw degrades the pillar to 'ungradeable' with the offered-rules note; the verdict stays ok/certified and 'ungradeable' pulls conformant false (s175 m04, #781)", async () => {
    accuracyFault.armed = true;
    const out = await handle({ spec: buildSpec() });

    // The fault NEVER escalates to status:error — the outer V127/V129 catch is not reached.
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');

    // The catch's degradation: pillar ungradeable ("tried and failed", never the
    // nothing-to-grade 'unchecked'), no accuracySummary (assignment sits after the
    // throwing call), no OODS-V15x findings.
    expect(out.pillars?.accuracy).toBe('ungradeable');
    expect(out.accuracySummary).toBeUndefined();
    expect(out.findings).toEqual([]);

    // The note the catch writes lands in notes[] — verbatim.
    expect(out.notes).toEqual([FAULT_NOTE]);

    // The OTHER pillars are untouched: the fault is isolated to accuracy.
    expect(out.pillars?.a11yEquivalence).toBe('pass');
    expect(out.pillars?.determinism).toBe('pass');
    expect(out.determinism?.stable).toBe(true);
    expect(out.determinism?.contentHash).toBeTypeOf('string');

    // The fold (s175 m04, #781 closed): 'ungradeable' pulls conformant false exactly as
    // 'fail' does — deliberate parity with contrast's 'ungradeable'.
    expect(out.conformant).toBe(false);

    // Contract-clean: the degraded verdict still AJV-validates against the wired schema.
    expect(validateOutput(out)).toBe(true);
  });

  it("disarmed control — the SAME spec through the SAME import graph grades accuracy:'pass' with an accuracySummary and no fault note (the forced throw is the only difference)", async () => {
    accuracyFault.armed = false;
    try {
      const out = await handle({ spec: buildSpec() });
      expect(out.status).toBe('ok');
      expect(out.coverage).toBe('certified');
      expect(out.pillars?.accuracy).toBe('pass');
      expect(out.accuracySummary).toBeDefined();
      expect(out.notes ?? []).not.toContain(FAULT_NOTE);
      expect(out.conformant).toBe(true);
      expect(validateOutput(out)).toBe(true);
    } finally {
      accuracyFault.armed = true;
    }
  });

  it('contentHash is BYTE-IDENTICAL armed vs disarmed — the pure-reader invariant as a checked fact', async () => {
    accuracyFault.armed = true;
    const armed = await handle({ spec: buildSpec() });
    accuracyFault.armed = false;
    let disarmed;
    try {
      disarmed = await handle({ spec: buildSpec() });
    } finally {
      accuracyFault.armed = true;
    }
    expect(armed.determinism?.contentHash).toBeTypeOf('string');
    expect(armed.determinism?.contentHash).toBe(disarmed.determinism?.contentHash);
  });
});
