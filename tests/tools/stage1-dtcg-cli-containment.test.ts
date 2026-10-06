/**
 * s169 m05 — the Stage1 DTCG CLI cannot write outside `--out`.
 *
 * ── THE MEASURED DEFECT ──
 * `--name` is interpolated straight into three output filenames, and nothing constrained
 * it. Confirmed BY EXECUTION at s168's tip, not by reading:
 *
 *   tsx tools/stage1-dtcg/cli.ts in.json --out <dir> --name '../../escaped'
 *
 * wrote `/tmp/escaped.base.json` and `/tmp/escaped.coverage.json` — two directories ABOVE
 * the `--out` the caller named — exited 0, and printed the escaped paths in its own success
 * output as though they were the requested ones.
 *
 * ── WHY THE TEST DRIVES THE REAL CLI AS A SUBPROCESS ──
 * The guard's whole job is to change an EXIT CODE and prevent a FILE from appearing. Both
 * are properties of the process, not of a function, and the sink is a top-level side effect
 * in a script with no exported entry point. Asserting on a subprocess is the only way to
 * assert on what actually happens.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CLI = join(REPO_ROOT, 'tools/stage1-dtcg/cli.ts');
const CLI_TEST_TIMEOUT = 120_000;

/** The smallest input the adapter accepts — this suite is about the writer, not the mapper. */
const INPUT_DOC = {
  kind: 'fig_local_tokens',
  version: '1.0.0',
  generated_at: '2026-01-01T00:00:00Z',
  source: { file_label: 'containment-probe', fig_version: 1 },
  tokens: [],
};

let workspace: string;
let inputPath: string;

/** Run the CLI, returning its exit code (never throwing on a non-zero exit). */
function runCli(outDir: string, name: string): number {
  try {
    execFileSync('pnpm', ['exec', 'tsx', CLI, inputPath, '--out', outDir, '--name', name], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return 0;
  } catch (error) {
    return typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : -1;
  }
}

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'stage1-containment-'));
  inputPath = join(workspace, 'in.tokens.json');
  writeFileSync(inputPath, JSON.stringify(INPUT_DOC), 'utf8');
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('stage1-dtcg CLI --out containment (s169 m05)', () => {
  it('the ORIGINAL escape is rejected with exit 2 and writes nothing outside --out', () => {
    const outDir = join(workspace, 'nested', 'out');
    // `../../escaped` from <workspace>/nested/out lands in <workspace> — inside the temp
    // dir, so the test can positively assert the file is absent rather than merely hoping.
    const escapeTarget = join(workspace, 'escaped.base.json');

    expect(runCli(outDir, '../../escaped')).toBe(2);
    expect(existsSync(escapeTarget), 'the CLI wrote outside --out').toBe(false);
    expect(readdirSync(outDir)).toEqual([]);
  }, CLI_TEST_TIMEOUT);

  it('rejects every ESCAPING --name shape, not just the one that was reported', () => {
    const outDir = join(workspace, 'shapes');
    // `a/b` is here because it does not traverse upward at all — it merely writes into a
    // SUBdirectory, which the CLI does not create, so it would fail confusingly at write
    // time rather than clearly at the boundary.
    for (const name of ['../sneak', 'a/b', '../../../etc/passwd']) {
      expect(runCli(outDir, name), `--name ${JSON.stringify(name)}`).toBe(2);
    }
  }, CLI_TEST_TIMEOUT);

  it('a LEADING SLASH is not an escape, and the guard correctly allows it', () => {
    // Worth pinning because the intuition is wrong: `path.join(outDir, '/absolute.base.json')`
    // treats the leading slash as an ordinary separator and yields
    // `<outDir>/absolute.base.json`. It is contained, so rejecting it would be a false
    // positive — and a guard that rejects safe inputs teaches callers to work around it.
    const outDir = join(workspace, 'leading-slash');
    expect(runCli(outDir, '/absolute')).toBe(0);
    expect(readdirSync(outDir).sort()).toEqual(['absolute.base.json', 'absolute.coverage.json']);
  }, CLI_TEST_TIMEOUT);

  it('a legitimate --name still writes all its files, in --out', () => {
    // Control of the control: a guard that rejected everything would pass the tests above
    // while breaking the tool.
    const outDir = join(workspace, 'happy');
    expect(runCli(outDir, 'pt-tokens')).toBe(0);
    expect(readdirSync(outDir).sort()).toEqual(['pt-tokens.base.json', 'pt-tokens.coverage.json']);
  }, CLI_TEST_TIMEOUT);

  it('a --name that traverses but RESOLVES back inside --out is allowed', () => {
    // The rule is about where the bytes land, not about the spelling of the argument.
    const outDir = join(workspace, 'round-trip');
    expect(runCli(outDir, 'sub/../ok')).toBe(0);
    expect(readdirSync(outDir).sort()).toEqual(['ok.base.json', 'ok.coverage.json']);
  }, CLI_TEST_TIMEOUT);
});
