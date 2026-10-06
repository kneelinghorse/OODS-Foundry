// s176 m04 (#1250) — the tokens-governance ENTRY GUARD fires through a SYMLINK.
//
// The package bin table maps `tokens-governance` to tools/tokens-governance/index.ts, and
// a bin shim is a symlink: invoked through one, process.argv[1] carries the SYMLINK path.
// The s169 guard compared lexically-resolved paths, so a symlinked invocation silently
// no-opped — the CLI produced nothing and exited 0 (decision #1506's carried edge). The
// s176 fix realpath-resolves both sides before comparing.
//
// The control invokes the CLI with NO ARGS — the usage surface: parseArgs throws the
// Usage line, main() catches, prints it to stderr and sets exit code 1. Seeing that
// output through a symlink PROVES main() ran; the sha equality proves the usage surface
// is byte-identical through both invocation paths (the guard changed WHO runs, never
// WHAT runs).

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(ROOT, 'tools/tokens-governance/index.ts');

// The symlink carries an .mts name so the loader treats it as ESM regardless of the
// temp dir having no package.json (the same gotcha the viz-render probes hit).
const linkDir = mkdtempSync(path.join(tmpdir(), 'oods-gov-guard-'));
const linkPath = path.join(linkDir, 'tokens-governance-link.mts');
symlinkSync(CLI, linkPath);

afterAll(() => {
  rmSync(linkDir, { recursive: true, force: true });
});

async function invokeNoArgs(target: string): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await run('pnpm', ['exec', 'tsx', target], { cwd: ROOT });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: typeof e.code === 'number' ? e.code : -1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

describe('tokens-governance entry guard (s176 m04 realpath fold, #1250)', () => {
  it('direct invocation runs main(): the usage surface prints and the exit code is 1', async () => {
    const direct = await invokeNoArgs(CLI);
    expect(direct.output).toContain('Usage: tokens-governance diff');
    expect(direct.code).toBe(1);
  }, 60_000);

  it('SYMLINKED invocation runs main() too — the pre-s176 guard silently no-opped here — and its usage surface is byte-identical to the direct one', async () => {
    const [direct, symlinked] = await Promise.all([invokeNoArgs(CLI), invokeNoArgs(linkPath)]);
    // The control's teeth: pre-fix the symlinked run produced NO output at exit 0.
    expect(symlinked.output).toContain('Usage: tokens-governance diff');
    expect(symlinked.code).toBe(1);
    // "--help sha unchanged": the help/usage surface is the same bytes either way.
    expect(sha(symlinked.output)).toBe(sha(direct.output));
  }, 60_000);
});
