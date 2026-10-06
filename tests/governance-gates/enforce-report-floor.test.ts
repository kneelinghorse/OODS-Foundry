/**
 * s175 m02 — U3: enforce.mjs's <2-report floor (memo §1b, s174 m02's fix for the vacuous gate).
 *
 * The label check lives INSIDE the per-report loop, so zero reports (or one) used to mean the
 * loop never ran and enforcement "passed" having examined nothing. s174 m02 added the floor;
 * m02 extracts it into `assertReportFloor(reports, governanceDir)` → error string | null and
 * pins it two ways:
 *   - the pure function over 0 / 1 / 2 reports;
 *   - a subprocess of the REAL `enforce.mjs --governanceDir <empty>` asserting exit 1 AND that
 *     stderr carries `Expected 2 brand governance reports (A and B)` — the exit code alone is
 *     satisfied by any throw (memo §1b.6).
 * Mutant M3 (`reports.length < EXPECTED_BRAND_REPORTS` → `< 0`) reds both.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { ENFORCE, REAL_DIST_TOKENS, SCRIPTS_ROOT, importScript, sha256 } from './_harness';

const execFileAsync = promisify(execFile);

interface EnforceModule {
  assertReportFloor: (reports: Array<{ brand?: string }>, governanceDir: string) => string | null;
  loadGovernanceReports: (directory: string) => Promise<Array<{ file: string; brand: string; data: unknown }>>;
  resolveLabels: (explicit: string[]) => string[];
}

let mod: EnforceModule;
let emptyDir: string;
let distTokensBefore: string;

beforeAll(async () => {
  distTokensBefore = sha256(REAL_DIST_TOKENS);
  mod = await importScript<EnforceModule>(ENFORCE);
  emptyDir = mkdtempSync(join(tmpdir(), 'gov-empty-governance-'));
});

afterAll(() => {
  rmSync(emptyDir, { recursive: true, force: true });
  expect(sha256(REAL_DIST_TOKENS), 'the built tokens JSON moved under the floor control').toBe(distTokensBefore);
});

describe('assertReportFloor (U3, s175 m02)', () => {
  it('0 reports → the floor error naming the directory and "found 0"', () => {
    const message = mod.assertReportFloor([], 'artifacts/state/governance');
    expect(message).toBe(
      'Expected 2 brand governance reports (A and B) in artifacts/state/governance; found 0. Enforcement over a missing report is a silent pass, so this is an error, not a warning.',
    );
  });

  it('1 report → the floor error listing the brand that IS present', () => {
    const message = mod.assertReportFloor([{ brand: 'A' }], 'artifacts/state/governance');
    expect(message).toContain('Expected 2 brand governance reports (A and B)');
    expect(message).toContain('found 1 (A)');
  });

  it('2 reports → null (the floor is satisfied; the per-report checks take over)', () => {
    expect(mod.assertReportFloor([{ brand: 'A' }, { brand: 'B' }], 'artifacts/state/governance')).toBeNull();
  });

  it('loadGovernanceReports over a missing directory is [] (the input the floor exists for)', async () => {
    expect(await mod.loadGovernanceReports(join(emptyDir, 'does-not-exist'))).toEqual([]);
    expect(await mod.loadGovernanceReports(emptyDir)).toEqual([]);
  });

  it('resolveLabels lower-cases explicit labels and ignores PR_LABELS when explicit ones are given', () => {
    expect(mod.resolveLabels(['Token-Change:Breaking', ' x '])).toEqual(['token-change:breaking', ' x ']);
  });
});

describe('the real enforce.mjs over an empty governance directory (subprocess)', () => {
  it('exits 1 AND names the floor on stderr', async () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.PR_LABELS;

    let code = 0;
    let stderr = '';
    let stdout = '';
    try {
      ({ stdout, stderr } = await execFileAsync(process.execPath, [ENFORCE, '--governanceDir', emptyDir], {
        cwd: SCRIPTS_ROOT,
        env,
        encoding: 'utf8',
      }));
    } catch (error) {
      const err = error as { code?: number | string; stdout?: string; stderr?: string };
      code = typeof err.code === 'number' ? err.code : -1;
      stdout = err.stdout ?? '';
      stderr = err.stderr ?? '';
    }

    expect(stderr, 'the floor message must reach stderr — exit 1 alone is satisfied by any throw').toContain(
      'Expected 2 brand governance reports (A and B)',
    );
    expect(stderr).toContain('found 0');
    expect(stdout).not.toContain('Token governance enforcement passed');
    expect(code).toBe(1);
  });
});
