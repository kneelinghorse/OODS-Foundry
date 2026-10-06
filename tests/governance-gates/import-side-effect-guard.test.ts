/**
 * s175 m02 — the import-side-effect guard (memo §1b.6, last bullet).
 *
 * Before m02 each of the three governance scripts ran its CLI at import: state-assessment.mjs
 * via a bare top-level `await main()` (every check, empty argv, writes the TRACKED
 * `diagnostics.json`, spawns storybook/pnpm), enforce.mjs and triage.mjs via `main().catch(...)`.
 * That is why none of them had a unit test. This file imports each module inside vitest and
 * asserts that NOTHING ran: no CLI output, the exports are present, and the three files a
 * suite run must not move (`diagnostics.json`, `artifacts/state/performance.json`, the
 * gitignored build input `packages/tokens/dist/tailwind/tokens.json`) are byte-identical.
 *
 * RED at the pre-m02 copy: the CLI output is observed and `main` is not exported.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

import {
  ENFORCE,
  REAL_DIST_TOKENS,
  STATE_ASSESSMENT,
  TRIAGE,
  importScript,
  snapshotGuardedFiles,
} from './_harness';

const CLI_OUTPUT = /Overall status|State assessment|Token governance enforcement|enforce failed|Triage complete|triage failed|No governance reports found|Removed built token artifact/;

let captured: string[];
let spies: Array<ReturnType<typeof vi.spyOn>>;

beforeEach(() => {
  captured = [];
  const capture = (...args: unknown[]) => {
    captured.push(args.map(String).join(' '));
  };
  spies = (['log', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(capture),
  );
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
});

describe('importing a governance script runs no CLI (s175 m02)', () => {
  it('scripts/state-assessment.mjs: exports main/runTokenGovernanceCheck/deriveProcessExit; no check ran; nothing tracked moved', async () => {
    const before = snapshotGuardedFiles();
    const mod = await importScript(STATE_ASSESSMENT);

    expect(typeof mod.main, 'main must be exported').toBe('function');
    expect(typeof mod.runTokenGovernanceCheck).toBe('function');
    expect(typeof mod.deriveProcessExit).toBe('function');
    expect(captured.filter((line) => CLI_OUTPUT.test(line)), 'CLI output observed on import').toEqual([]);
    expect(snapshotGuardedFiles()).toEqual(before);
    expect(existsSync(REAL_DIST_TOKENS)).toBe(true);
  });

  it('scripts/gov/enforce.mjs: exports assertReportFloor/loadGovernanceReports/resolveLabels; no enforcement ran', async () => {
    const before = snapshotGuardedFiles();
    const mod = await importScript(ENFORCE);

    expect(typeof mod.assertReportFloor).toBe('function');
    expect(typeof mod.loadGovernanceReports).toBe('function');
    expect(typeof mod.resolveLabels).toBe('function');
    expect(captured.filter((line) => CLI_OUTPUT.test(line)), 'CLI output observed on import').toEqual([]);
    expect(snapshotGuardedFiles()).toEqual(before);
  });

  it('scripts/gov/triage.mjs: exports resolveBaseRef; no triage ran', async () => {
    const before = snapshotGuardedFiles();
    const mod = await importScript(TRIAGE);

    expect(typeof mod.resolveBaseRef).toBe('function');
    expect(captured.filter((line) => CLI_OUTPUT.test(line)), 'CLI output observed on import').toEqual([]);
    expect(snapshotGuardedFiles()).toEqual(before);
  });
});
