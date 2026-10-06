/**
 * s175 m02 — the subprocess exit control for `scripts/state-assessment.mjs` (memo §1b.6).
 *
 * `deriveProcessExit` (unit-tested in state-assessment-tokens-red-paths.test.ts) decides the
 * verdict; `main()` is what carries it into `process.exitCode`. Mutant M2 — deleting that one
 * assignment — leaves every unit test green while CI stays green on a fail-closed run, which
 * is exactly the s173-era vacuity. Only a real process can observe the exit code, so this
 * file spawns `node --input-type=module -e <driver>`: the driver imports `main()` and calls it
 * with `['--tokens']` and an overrides object rooted at a mkdtemp tree, stub executables as
 * `pnpmCmd` / `nodeCmd`, and `env` carrying only `TOKEN_GOV_BASE_REF`. No new CLI flag was
 * added — the injectable context IS the seam.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  FAIL_CLOSED_LINE,
  REAL_DIAGNOSTICS,
  REAL_PERFORMANCE,
  STATE_ASSESSMENT,
  STUB_NOOP,
  STUB_PNPM_FAIL,
  STUB_PNPM_REPORT,
  makeScratchRoot,
  sha256,
  writeStub,
} from './_harness';

const execFileAsync = promisify(execFile);

const DRIVER = `
const mod = await import(process.env.GOV_DRIVER_SCRIPT);
if (typeof mod.main !== 'function') {
  console.error('state-assessment.mjs does not export main (typeof ' + typeof mod.main + ')');
  process.exit(3);
}
await mod.main(['--tokens'], JSON.parse(process.env.GOV_DRIVER_OVERRIDES));
`;

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runDriver(root: string, overrides: Record<string, unknown>): Promise<RunResult> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.PR_LABELS;
  delete env.TOKEN_GOV_BASE_REF;
  delete env.TOKEN_GOV_HEAD_REF;
  env.GOV_DRIVER_SCRIPT = pathToFileURL(STATE_ASSESSMENT).href;
  env.GOV_DRIVER_OVERRIDES = JSON.stringify(overrides);
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--input-type=module', '-e', DRIVER],
      { cwd: root, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const err = error as { code?: number | string; stdout?: string; stderr?: string };
    return {
      code: typeof err.code === 'number' ? err.code : -1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

let root: string;
let pnpmFail: string;
let pnpmReport: string;
let nodeNoop: string;
let realBefore: Record<string, string>;

beforeAll(() => {
  realBefore = { diagnostics: sha256(REAL_DIAGNOSTICS), performance: sha256(REAL_PERFORMANCE) };
});

beforeEach(() => {
  root = makeScratchRoot('gov-exit');
  pnpmFail = writeStub(root, 'pnpm-fail', STUB_PNPM_FAIL);
  pnpmReport = writeStub(root, 'pnpm-report', STUB_PNPM_REPORT);
  nodeNoop = writeStub(root, 'node-noop', STUB_NOOP);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

afterAll(() => {
  expect(sha256(REAL_DIAGNOSTICS), 'the tracked diagnostics.json moved under the subprocess control').toBe(realBefore.diagnostics);
  expect(sha256(REAL_PERFORMANCE), 'the tracked performance.json moved under the subprocess control').toBe(realBefore.performance);
});

describe('state-assessment.mjs main() carries deriveProcessExit into the process exit (s175 m02)', () => {
  it('a base ref the diff cannot satisfy → exit 1 and the FAIL-CLOSED line on stderr', async () => {
    const result = await runDriver(root, {
      repoRoot: root,
      pnpmCmd: pnpmFail,
      nodeCmd: nodeNoop,
      env: { TOKEN_GOV_BASE_REF: 'no-such-ref-zzz' },
    });

    expect(result.stderr, 'the driver must find an exported main()').not.toContain('does not export main');
    expect(result.stdout).toContain('Overall status: RED');
    expect(result.stderr).toContain(`FAIL-CLOSED: tokens ${FAIL_CLOSED_LINE}`);
    // The assertion mutant M2 reds: the verdict was printed but never carried into the exit.
    expect(result.code, 'a fail-closed run must exit nonzero').toBe(1);
  });

  it('a resolvable stub ref → exit 0, a GREEN overall status, both brand reports under the scratch root', async () => {
    const result = await runDriver(root, {
      repoRoot: root,
      pnpmCmd: pnpmReport,
      nodeCmd: nodeNoop,
      env: { TOKEN_GOV_BASE_REF: 'stub-base' },
    });

    expect(result.stderr).not.toContain('does not export main');
    expect(result.stderr).not.toContain('FAIL-CLOSED');
    expect(result.stdout).toContain('Overall status: GREEN');
    expect(result.code).toBe(0);
    for (const brand of ['A', 'B']) {
      const report = join(root, 'artifacts', 'state', 'governance', `brand-${brand}.json`);
      expect(existsSync(report), `${report} written`).toBe(true);
      expect(JSON.parse(readFileSync(report, 'utf8')).baseRef).toBe('stub-base');
    }
    // Everything the run wrote landed under the injected repoRoot.
    expect(existsSync(join(root, 'artifacts', 'state', 'assessment.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, 'diagnostics.json'), 'utf8')).tokens.governance.totals.runs).toBe(1);
  });
});
