/**
 * s175 m01 — the governance gates must leave `packages/tokens/dist/tailwind/tokens.json` alone.
 *
 * ── THE MEASURED DEFECT (s174 review carry C1, memo §1a.1) ──
 * At `852be47` `scripts/gov/enforce.mjs`, `scripts/gov/triage.mjs` and
 * `scripts/state-assessment.mjs` each unconditionally `fs.unlink` the built tokens JSON,
 * print "Removed built token artifact …", swallow ENOENT and exit 0. The file is a BUILD
 * INPUT: `packages/tokens/dist/index.cjs` requires it, and `@oods/viz-core`'s tsup build
 * bundles `@oods/tokens`, so after any governance gate ran standalone, gate 4
 * (`pnpm --filter @oods/viz-core run build`) failed with
 * `Could not resolve "./tailwind/tokens.json"`. The rationale for the unlink died in
 * s169 m03 (`d0b66fd`): `tools/tokens-governance/index.ts` reads EVERY ref, HEAD
 * included, through git — no code path consumes the deletion. And because the path is
 * gitignored (`.gitignore:10` `dist/`), `git status --porcelain` could not see the casualty.
 *
 * ── WHY THE SCRIPTS ARE COPIED INTO A TEMP TREE ──
 * Each script derives `repoRoot` from its own file location (`enforce.mjs:8-10`) and has no
 * `--repoRoot` flag. Running the in-tree script would (a) make the stand-in file irrelevant —
 * the assertion would be vacuously green — and (b) at HEAD delete the REAL build input.
 * So the scripts are copied to `<tmp>/scripts/gov/`, the inputs are SYNTHESIZED into the
 * temp tree (a stand-in tokens.json, the namespace policy, two minimal brand reports — never
 * the gitignored `artifacts/` reports, absent in CI), and the real file's sha256 is asserted
 * unchanged after every subprocess run, so a wrong-root regression reds instead of destroying
 * the build input.
 *
 * ── WHY A SUBPROCESS ──
 * The property under test is a side effect of a process on the filesystem plus its exit code
 * and stdout. Neither script exports anything (m02 adds the seams); a subprocess is the only
 * honest observer. Precedent: tests/tools/stage1-dtcg-cli-containment.test.ts.
 */
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST_TOKENS_REL = join('packages', 'tokens', 'dist', 'tailwind', 'tokens.json');
const REAL_DIST_TOKENS = join(REPO_ROOT, DIST_TOKENS_REL);
const POLICY_REL = join('configs', 'policies', 'token-namespaces.json');
const GOVERNANCE_DIR_REL = join('artifacts', 'state', 'governance');

const SCRIPTS = ['scripts/gov/enforce.mjs', 'scripts/gov/triage.mjs', 'scripts/state-assessment.mjs'];

/** sha256 of the REAL build input, or the literal 'absent' when the tokens build has not run. */
function realDistTokensSha(): string {
  if (!existsSync(REAL_DIST_TOKENS)) {
    return 'absent';
  }
  return createHash('sha256').update(readFileSync(REAL_DIST_TOKENS)).digest('hex');
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run a copied script with PR_LABELS unset; never throws on a non-zero exit. */
async function runCopiedScript(scratchRoot: string, scriptRel: string): Promise<RunResult> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.PR_LABELS;
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [join(scratchRoot, scriptRel)], {
      cwd: scratchRoot,
      env,
      encoding: 'utf8',
    });
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

let scratchRoot: string;
let standInPath: string;
let realShaBefore: string;

beforeAll(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), 'gov-preserves-build-inputs-'));
  realShaBefore = realDistTokensSha();

  // The scripts under test, COPIED so their repoRoot resolves to the scratch tree.
  mkdirSync(join(scratchRoot, 'scripts', 'gov'), { recursive: true });
  for (const rel of ['scripts/gov/enforce.mjs', 'scripts/gov/triage.mjs']) {
    copyFileSync(join(REPO_ROOT, rel), join(scratchRoot, rel));
  }

  // Synthesized inputs. The stand-in's content is irrelevant — HEAD only ever unlinked it.
  standInPath = join(scratchRoot, DIST_TOKENS_REL);
  mkdirSync(join(scratchRoot, 'packages', 'tokens', 'dist', 'tailwind'), { recursive: true });

  mkdirSync(join(scratchRoot, 'configs', 'policies'), { recursive: true });
  copyFileSync(join(REPO_ROOT, POLICY_REL), join(scratchRoot, POLICY_REL));

  // Two minimal brand reports: enforce's <2-report floor (s174 m02) exits 1 otherwise.
  mkdirSync(join(scratchRoot, GOVERNANCE_DIR_REL), { recursive: true });
  for (const brand of ['A', 'B']) {
    writeFileSync(
      join(scratchRoot, GOVERNANCE_DIR_REL, `brand-${brand}.json`),
      JSON.stringify({ brand, summary: { highRisk: 0 }, requiresBreakingLabel: false }),
      'utf8',
    );
  }
});

// Re-seeded per test so each script's survival assertion stands on its own (a deletion by
// the previous script must not mask the next one as a fixture failure).
beforeEach(() => {
  writeFileSync(standInPath, JSON.stringify({ standIn: true, sprint: 's175-m01' }), 'utf8');
});

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

describe('governance gates preserve the built tokens JSON (s175 m01, C1)', () => {
  it('enforce.mjs leaves the stand-in tokens.json in place, passes, and never touches the real one', async () => {
    expect(existsSync(standInPath), 'fixture precondition: stand-in present').toBe(true);

    const result = await runCopiedScript(scratchRoot, 'scripts/gov/enforce.mjs');

    // (a) file survival — the assertion that REDs at 852be47.
    expect(existsSync(standInPath), 'enforce.mjs deleted packages/tokens/dist/tailwind/tokens.json').toBe(true);
    expect(result.stderr, 'enforce.mjs still announces a removal').not.toContain('Removed built token artifact');
    // (b) verdict unchanged.
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Token governance enforcement passed');
    // (c) the REAL build input is byte-identical (or still absent) after the subprocess.
    expect(realDistTokensSha()).toBe(realShaBefore);
  });

  it('triage.mjs (non --apply) leaves the stand-in tokens.json in place and completes', async () => {
    expect(existsSync(standInPath), 'fixture precondition: stand-in present').toBe(true);

    const result = await runCopiedScript(scratchRoot, 'scripts/gov/triage.mjs');

    expect(existsSync(standInPath), 'triage.mjs deleted packages/tokens/dist/tailwind/tokens.json').toBe(true);
    expect(result.stderr, 'triage.mjs still announces a removal').not.toContain('Removed built token artifact');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Triage complete');
    expect(realDistTokensSha()).toBe(realShaBefore);
  });

  /**
   * state-assessment.mjs runs its CLI at import and spawns pnpm/storybook with an empty argv,
   * so it cannot be driven as a subprocess here until m02 lands its entry guard + injectable
   * context. Until then a SOURCE guard covers all three scripts: no `unlink`/`rm` whose target
   * is a path built from the literal `tailwind`. m02's real control supersedes this.
   */
  it('no governance script unlinks a path built from the literal "tailwind" (source guard)', () => {
    for (const rel of SCRIPTS) {
      const source = readFileSync(join(REPO_ROOT, rel), 'utf8');
      const lines = source.split('\n');

      // Identifiers assigned on a line that spells the dist tokens path.
      const targetIdentifiers = new Set<string>();
      for (const line of lines) {
        if (!line.includes('tailwind')) continue;
        const match = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
        if (match) targetIdentifiers.add(match[1]);
      }

      const offending: string[] = [];
      lines.forEach((line, index) => {
        const deletes = /\b(?:unlink|unlinkSync|rm|rmSync)\s*\(/.test(line);
        if (!deletes) return;
        if (line.includes('tailwind')) {
          offending.push(`${rel}:${index + 1}: ${line.trim()}`);
          return;
        }
        for (const identifier of targetIdentifiers) {
          if (new RegExp(`\\b${identifier}\\b`).test(line)) {
            offending.push(`${rel}:${index + 1}: ${line.trim()} (target ${identifier} spells "tailwind")`);
          }
        }
      });

      expect(offending, `${rel} deletes the built tokens JSON`).toEqual([]);
    }
  });

  it('the real packages/tokens/dist/tailwind/tokens.json is unchanged after the whole file', () => {
    expect(realDistTokensSha()).toBe(realShaBefore);
  });
});
