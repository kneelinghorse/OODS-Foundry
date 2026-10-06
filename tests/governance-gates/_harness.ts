/**
 * s175 m02 — shared fixture helpers for the governance-gate controls (memo §1b).
 *
 * Not a test file (no `.test.ts` suffix). Everything here exists for hermeticity: every
 * control drives the real scripts with a STUB executable as `pnpmCmd` / `nodeCmd` (never the
 * real pnpm / tsx / git diff — CI has no brand reports and no such refs) and a mkdtemp
 * `repoRoot`, so a run can neither consult nor move the tracked `diagnostics.json`,
 * `artifacts/state/performance.json` or the gitignored build input
 * `packages/tokens/dist/tailwind/tokens.json`.
 *
 * `GOV_SCRIPTS_ROOT` is the RED-first seam (memo §1b.7): the tests read the three scripts from
 * the repo by default; pointing the variable at a byte-identical pre-m02 COPY under a scratch
 * root runs the very same assertions against the old, unguarded, export-less modules — which
 * is how every RED in the closeout record was taken, never by running the old CLI in-tree.
 */
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const SCRIPTS_ROOT = process.env.GOV_SCRIPTS_ROOT
  ? resolve(process.env.GOV_SCRIPTS_ROOT)
  : REPO_ROOT;

export const STATE_ASSESSMENT = join(SCRIPTS_ROOT, 'scripts', 'state-assessment.mjs');
export const ENFORCE = join(SCRIPTS_ROOT, 'scripts', 'gov', 'enforce.mjs');
export const TRIAGE = join(SCRIPTS_ROOT, 'scripts', 'gov', 'triage.mjs');

/** The tracked / build-input files that a vitest run of this directory MUST NOT move. */
export const REAL_DIAGNOSTICS = join(REPO_ROOT, 'diagnostics.json');
export const REAL_PERFORMANCE = join(REPO_ROOT, 'artifacts', 'state', 'performance.json');
export const REAL_DIST_TOKENS = join(REPO_ROOT, 'packages', 'tokens', 'dist', 'tailwind', 'tokens.json');
export const GUARDED_FILES = [REAL_DIAGNOSTICS, REAL_PERFORMANCE, REAL_DIST_TOKENS] as const;

export const FAIL_CLOSED_LINE = 'could not complete a check it was given the inputs for.';
export const SKIP_NOTE_NOTHING_DIFFED =
  'Token governance diff SKIPPED: no TOKEN_GOV_BASE_REF was supplied and no brand report was produced — nothing was diffed. This is a SKIP, not a clean result.';
export const SKIP_NOTE_FELL_BACK = (bases: string) =>
  `Token governance measured NO PR DELTA: no TOKEN_GOV_BASE_REF was supplied, so tokens-governance fell back to its own default base (${bases}). Supply the ref to diff an actual change set.`;

/** sha256 of a file, or the literal 'absent'. */
export function sha256(file: string): string {
  if (!existsSync(file)) return 'absent';
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function snapshotGuardedFiles(): Record<string, string> {
  return Object.fromEntries(GUARDED_FILES.map((file) => [file, sha256(file)]));
}

/** A scratch "repo root": artifacts/state exists, diagnostics.json is an empty object. */
export function makeScratchRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), `${prefix}-`));
  mkdirSync(join(root, 'artifacts', 'state'), { recursive: true });
  mkdirSync(join(root, 'bin'), { recursive: true });
  writeFileSync(join(root, 'diagnostics.json'), '{}\n', 'utf8');
  return root;
}

/** Write an executable stub and return its absolute path. */
export function writeStub(root: string, name: string, body: string): string {
  const file = join(root, 'bin', name);
  writeFileSync(file, body, 'utf8');
  chmodSync(file, 0o755);
  return file;
}

/** pnpm stand-in for a diff that cannot be satisfied: exits 1 and writes nothing. */
export const STUB_PNPM_FAIL = '#!/bin/sh\nexit 1\n';

/** node / pnpm stand-in that does nothing and exits 0 (the purity audit seam). */
export const STUB_NOOP = '#!/bin/sh\nexit 0\n';

/**
 * pnpm stand-in for a diff that succeeds: writes a minimal `{brand, baseRef, summary}` report
 * to the `--json` path. `baseRef` echoes `--base` when one was given, otherwise the
 * tools-governance default (`origin/OODS-pro`) — mirroring the real CLI's own fallback so
 * the "measured NO PR DELTA" variant of the named SKIP can be exercised.
 */
export const STUB_PNPM_REPORT = `#!/bin/sh
out=""; brand=""; base=""
while [ $# -gt 0 ]; do
  case "$1" in
    --json) out="$2"; shift ;;
    --brand) brand="$2"; shift ;;
    --base) base="$2"; shift ;;
  esac
  shift
done
[ -z "$base" ] && base="origin/OODS-pro"
if [ -n "$out" ]; then
  printf '{"brand":"%s","baseRef":"%s","summary":{"highRisk":0,"mediumRisk":0,"lowRisk":0},"requiresBreakingLabel":false}\\n' "$brand" "$base" > "$out"
fi
exit 0
`;

/** Import one of the scripts by absolute path (the copy seam needs a file URL). */
export function importScript<T = Record<string, unknown>>(file: string): Promise<T> {
  return import(pathToFileURL(file).href) as Promise<T>;
}

/** Build the `context` the check runners receive, rooted at a scratch tree. */
export function makeContext(
  root: string,
  overrides: { pnpmCmd: string; nodeCmd: string; env: NodeJS.ProcessEnv },
) {
  const artifactsRoot = join(root, 'artifacts', 'state');
  return {
    repoRoot: root,
    artifactsRoot,
    screenshotsRoot: join(artifactsRoot, 'screenshots'),
    pnpmCmd: overrides.pnpmCmd,
    nodeCmd: overrides.nodeCmd,
    env: overrides.env,
    options: { vrMode: 'auto' },
    memo: { storybookReady: false },
  };
}
