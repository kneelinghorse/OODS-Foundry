/**
 * s175 m02 — U1 / U2 / U1b: the token-governance red paths of `scripts/state-assessment.mjs`
 * get their first automated controls (memo §1b, s174 review carry C3, next-step #1229).
 *
 * ── WHY THESE DID NOT EXIST ──
 * Until m02 the script exported nothing and ran its CLI at import (a bare top-level
 * `await main()`), so the one-line mutants below were invisible: flip `failClosed = true` to
 * `false` and the job stays GREEN while the rationale still prints "FAILED CLOSED" (the
 * s173-era vacuity in one line). The s169 shape (`tools/tokens-governance/index.ts`) — an
 * entry guard plus exports IN PLACE, no file split — is what makes a unit control possible.
 *
 * ── WHAT EACH TEST PINS ──
 *   U1   a supplied base ref the diff cannot satisfy → `failClosed = true`, RED, no report.
 *   U2   no base ref → the NAMED skip, both variants. Pinned: the note text,
 *        `metrics.measuredPrDelta = false`, `metrics.baseRefSuppliedByCaller = false` —
 *        NOT the GREEN (memo §1b.7: a later decision to colour skips YELLOW must not red a
 *        control meant to catch silence).
 *   disc the SAME failing diff, two contexts differing only in `env.TOKEN_GOV_BASE_REF`:
 *        fail-closed with the ref, named skip without it. This is the discriminator that
 *        proves the env seam is read from the injected context, not `process.env`.
 *   U1b  `deriveProcessExit`: findings-RED → 0, fail-closed → 1 + the FAIL-CLOSED line
 *        (decision #1418's contract: a RED from real findings is the gate WORKING and CI reads
 *        it from enforce.mjs; only a fail-closed condition is a nonzero process exit).
 *
 * Hermetic: stub executables as pnpmCmd/nodeCmd, a mkdtemp repoRoot — the real
 * `diagnostics.json` is hashed before and after and must not move.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  FAIL_CLOSED_LINE,
  REAL_DIAGNOSTICS,
  SKIP_NOTE_FELL_BACK,
  SKIP_NOTE_NOTHING_DIFFED,
  STATE_ASSESSMENT,
  STUB_NOOP,
  STUB_PNPM_FAIL,
  STUB_PNPM_REPORT,
  importScript,
  makeContext,
  makeScratchRoot,
  sha256,
  writeStub,
} from './_harness';

interface CheckResult {
  id: string;
  status: string;
  failClosed?: boolean;
  rationale: string[];
  evidence: Array<{ label: string; path: string }>;
  metrics: {
    baseRef: string | null;
    baseRefSuppliedByCaller: boolean;
    measuredPrDelta: boolean;
  };
}

interface StateAssessmentModule {
  runTokenGovernanceCheck: (context: ReturnType<typeof makeContext>) => Promise<CheckResult>;
  deriveProcessExit: (checkResults: Array<Partial<CheckResult>>) => { code: 0 | 1; message: string | null };
}

let mod: StateAssessmentModule;
let root: string;
let pnpmFail: string;
let pnpmReport: string;
let nodeNoop: string;
let realDiagnosticsBefore: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  realDiagnosticsBefore = sha256(REAL_DIAGNOSTICS);
  mod = await importScript<StateAssessmentModule>(STATE_ASSESSMENT);
});

beforeEach(() => {
  root = makeScratchRoot('gov-red-paths');
  pnpmFail = writeStub(root, 'pnpm-fail', STUB_PNPM_FAIL);
  pnpmReport = writeStub(root, 'pnpm-report', STUB_PNPM_REPORT);
  nodeNoop = writeStub(root, 'node-noop', STUB_NOOP);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  rmSync(root, { recursive: true, force: true });
});

afterAll(() => {
  expect(sha256(REAL_DIAGNOSTICS), 'the tracked diagnostics.json moved under a unit test').toBe(realDiagnosticsBefore);
});

function scratchGovernanceRuns(): number | undefined {
  const raw = readFileSync(join(root, 'diagnostics.json'), 'utf8');
  return JSON.parse(raw)?.tokens?.governance?.totals?.runs;
}

describe('runTokenGovernanceCheck — the red paths (s175 m02, C3)', () => {
  it('U1 fail-closed: a supplied base ref the diff cannot satisfy → failClosed=true, RED, no report', async () => {
    const result = await mod.runTokenGovernanceCheck(
      makeContext(root, { pnpmCmd: pnpmFail, nodeCmd: nodeNoop, env: { TOKEN_GOV_BASE_REF: 'no-such-ref-zzz' } }),
    );

    expect(result.id).toBe('tokens');
    // The flag main() turns into the nonzero exit — the assertion mutant M1 reds.
    expect(result.failClosed, 'failClosed must be TRUE when refs were given and no report came back').toBe(true);
    expect(result.status).toBe('RED');
    expect(result.rationale).toEqual(
      expect.arrayContaining([
        'Token governance FAILED CLOSED for brand A: diff exited 1 and wrote no report against base no-such-ref-zzz.',
        'Token governance FAILED CLOSED for brand B: diff exited 1 and wrote no report against base no-such-ref-zzz.',
      ]),
    );
    expect(result.evidence).toEqual([]);
    expect(result.metrics.baseRefSuppliedByCaller).toBe(true);
    expect(result.metrics.measuredPrDelta).toBe(true);
    expect(result.metrics.baseRef).toBe('no-such-ref-zzz');
    expect(existsSync(join(root, 'artifacts', 'state', 'governance', 'brand-A.json'))).toBe(false);
    // The diagnostics write went to the injected root, not the repo.
    expect(scratchGovernanceRuns()).toBe(1);
  });

  it('U1 positive control: a supplied ref the diff satisfies → failClosed=false, both reports, measuredPrDelta=true', async () => {
    const result = await mod.runTokenGovernanceCheck(
      makeContext(root, { pnpmCmd: pnpmReport, nodeCmd: nodeNoop, env: { TOKEN_GOV_BASE_REF: 'stub-base' } }),
    );

    expect(result.failClosed).toBe(false);
    expect(result.status).toBe('GREEN');
    expect(result.evidence.map((entry) => entry.label)).toEqual([
      'Governance diff (brand A)',
      'Governance diff (brand B)',
    ]);
    expect(result.metrics.baseRef).toBe('stub-base');
    expect(result.metrics.baseRefSuppliedByCaller).toBe(true);
    expect(result.metrics.measuredPrDelta).toBe(true);
    expect(result.rationale).toContain(
      'No high-risk token changes, leaks, or CSS literals detected against base stub-base.',
    );
  });

  it('U2 named SKIP, variant "nothing was diffed": no ref and no report → the SKIP note, measuredPrDelta=false', async () => {
    const result = await mod.runTokenGovernanceCheck(
      makeContext(root, { pnpmCmd: pnpmFail, nodeCmd: nodeNoop, env: {} }),
    );

    expect(result.failClosed, 'no ref was supplied — this is a skip, never a fail-closed').toBe(false);
    expect(result.rationale).toContain(SKIP_NOTE_NOTHING_DIFFED);
    expect(warnSpy).toHaveBeenCalledWith(`[tokens] ${SKIP_NOTE_NOTHING_DIFFED}`);
    expect(result.metrics.measuredPrDelta).toBe(false);
    expect(result.metrics.baseRefSuppliedByCaller).toBe(false);
    expect(result.metrics.baseRef).toBeNull();
    // Deliberately NOT pinned: result.status (memo §1b.7).
  });

  it('U2 named SKIP, variant "measured NO PR DELTA": no ref but the tool fell back → the fell-back note naming the base', async () => {
    const result = await mod.runTokenGovernanceCheck(
      makeContext(root, { pnpmCmd: pnpmReport, nodeCmd: nodeNoop, env: {} }),
    );

    expect(result.failClosed).toBe(false);
    expect(result.rationale).toContain(SKIP_NOTE_FELL_BACK('origin/OODS-pro'));
    expect(warnSpy).toHaveBeenCalledWith(`[tokens] ${SKIP_NOTE_FELL_BACK('origin/OODS-pro')}`);
    expect(result.metrics.measuredPrDelta).toBe(false);
    expect(result.metrics.baseRefSuppliedByCaller).toBe(false);
    expect(result.metrics.baseRef).toBe('origin/OODS-pro');
    expect(result.evidence).toHaveLength(2);
  });

  it('discriminator: the SAME failing diff is fail-closed with a ref and a named skip without one — only env.TOKEN_GOV_BASE_REF differs', async () => {
    const withRef = await mod.runTokenGovernanceCheck(
      makeContext(root, { pnpmCmd: pnpmFail, nodeCmd: nodeNoop, env: { TOKEN_GOV_BASE_REF: 'no-such-ref-zzz' } }),
    );
    const withoutRef = await mod.runTokenGovernanceCheck(
      makeContext(root, { pnpmCmd: pnpmFail, nodeCmd: nodeNoop, env: {} }),
    );

    expect(withRef.failClosed).toBe(true);
    expect(withoutRef.failClosed).toBe(false);
    expect(withRef.status).toBe('RED');
    expect(withRef.metrics.measuredPrDelta).toBe(true);
    expect(withoutRef.metrics.measuredPrDelta).toBe(false);
    expect(withoutRef.rationale).toContain(SKIP_NOTE_NOTHING_DIFFED);
    expect(withRef.rationale).not.toContain(SKIP_NOTE_NOTHING_DIFFED);
  });

  it('the env seam is the injected context, not process.env (a stray TOKEN_GOV_BASE_REF in the parent cannot turn a skip into a fail-closed)', async () => {
    const previous = process.env.TOKEN_GOV_BASE_REF;
    process.env.TOKEN_GOV_BASE_REF = 'no-such-ref-zzz';
    try {
      const result = await mod.runTokenGovernanceCheck(
        makeContext(root, { pnpmCmd: pnpmFail, nodeCmd: nodeNoop, env: {} }),
      );
      expect(result.failClosed).toBe(false);
      expect(result.metrics.baseRefSuppliedByCaller).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.TOKEN_GOV_BASE_REF;
      else process.env.TOKEN_GOV_BASE_REF = previous;
    }
  });
});

describe('deriveProcessExit — the one flag main() turns into a nonzero exit (U1b, #1418)', () => {
  it('no checks → 0 and no message', () => {
    expect(mod.deriveProcessExit([])).toEqual({ code: 0, message: null });
  });

  it('a RED from real findings (failClosed=false) → 0: the gate WORKING reports through enforce.mjs, not the exit code', () => {
    expect(
      mod.deriveProcessExit([{ id: 'tokens', status: 'RED', failClosed: false }]),
    ).toEqual({ code: 0, message: null });
  });

  it('an UNKNOWN from an execution error without failClosed → 0', () => {
    expect(mod.deriveProcessExit([{ id: 'tokens', status: 'UNKNOWN' }])).toEqual({ code: 0, message: null });
  });

  it('a fail-closed check → 1 and the FAIL-CLOSED line naming the check', () => {
    const verdict = mod.deriveProcessExit([{ id: 'tokens', status: 'RED', failClosed: true }]);
    expect(verdict.code).toBe(1);
    expect(verdict.message).toBe(`\nFAIL-CLOSED: tokens ${FAIL_CLOSED_LINE}`);
  });

  it('several fail-closed checks → 1 and every id named, in order', () => {
    const verdict = mod.deriveProcessExit([
      { id: 'storybook', status: 'GREEN' },
      { id: 'tokens', status: 'RED', failClosed: true },
      { id: 'a11y', status: 'RED', failClosed: true },
    ]);
    expect(verdict).toEqual({ code: 1, message: `\nFAIL-CLOSED: tokens, a11y ${FAIL_CLOSED_LINE}` });
  });
});
