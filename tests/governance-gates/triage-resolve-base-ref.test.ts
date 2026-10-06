/**
 * s175 m02 — U4: `triage.mjs resolveBaseRef` (memo §1b.2 R4, the --apply-only path).
 *
 * The throw `Unable to resolve base ref from "<ref>"` fires only when the ref, `origin/<ref>`
 * AND the hard fallback `origin/OODS-pro` all fail to verify. Against the real repo that
 * fallback MASKS a bad ref (it resolves to `origin/OODS-pro`); against a fresh `git init` the
 * throw is reachable. Both facts are pinned here, in a mkdtemp repository, through the
 * injected `cwd` — which is itself under test: were `cwd` ignored, `runGit` would ask the real
 * repo, where `origin/OODS-pro` exists, and the "rejects" test could not red.
 *
 * Mutant M4 (throw → `return candidates.at(-1)`) reds the first test. The fallback semantics
 * themselves are NOT chartered (#1480) — the masking is documented, not changed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TRIAGE, importScript } from './_harness';

interface TriageModule {
  resolveBaseRef: (ref: string, options?: { cwd?: string }) => Promise<string>;
}

const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.invalid',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.invalid',
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

let mod: TriageModule;
let repo: string;

beforeAll(async () => {
  mod = await importScript<TriageModule>(TRIAGE);
  repo = mkdtempSync(join(tmpdir(), 'gov-triage-resolve-'));
  git(repo, 'init', '-q');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('resolveBaseRef (U4, s175 m02)', () => {
  it('a bad ref in a repo WITHOUT origin/OODS-pro rejects with the named error (the throw is reachable; cwd is honoured)', async () => {
    await expect(mod.resolveBaseRef('no-such-ref-zzz', { cwd: repo })).rejects.toThrow(
      /Unable to resolve base ref from "no-such-ref-zzz"/,
    );
  });

  it("'HEAD' resolves to 'HEAD' (the first candidate that verifies wins, unchanged)", async () => {
    await expect(mod.resolveBaseRef('HEAD', { cwd: repo })).resolves.toBe('HEAD');
  });

  it('the masking, documented: once refs/remotes/origin/OODS-pro exists a bad ref resolves to origin/OODS-pro', async () => {
    git(repo, 'update-ref', 'refs/remotes/origin/OODS-pro', 'HEAD');
    await expect(mod.resolveBaseRef('no-such-ref-zzz', { cwd: repo })).resolves.toBe('origin/OODS-pro');
  });
});
