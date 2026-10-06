import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as catalog } from '../../src/tools/catalog.list.js';
import {
  OBJECTS, contextsForObject, supportsWorkflow, FRAMEWORKS, BROWSER_IMAGE,
  readRuntimeSummary, summarize, clearRuntimeLedgerMemo, type RuntimeLedger,
} from '../../src/lib/runtime-ledger.js';

/**
 * s204-m01. The Sprint 203 review found contracts/viz-recipes.s190 stopping at its own 60s ceiling
 * where Sprint 202 measured 26.4s for the same fixed 88 compositions. The cause was not the
 * registry's contents but the cost of reading it: `design.compose` loads its catalog through
 * `catalog.list`, which read AND revalidated the ~3.8 MB, 310-cell runtime ledger on every single
 * call. 88 compositions meant 88 full ledger reads — measured at 496 ms per composition, 47% of the
 * census wall. The gate did not need a larger number; it needed the ledger read once.
 *
 * These specs hold that property, because it is the one that decays as Phase E keeps adding objects:
 * the ledger grows with the registry, so a per-call read makes every composing gate quadratic in
 * registry size. Read-once keeps it linear.
 */

const temporary: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  clearRuntimeLedgerMemo();
  temporary.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
});

function ledgerFixture(head = 'measured-head'): RuntimeLedger {
  const rows = OBJECTS.flatMap(object => [
    ...contextsForObject(object),
    ...(supportsWorkflow(object) ? ['workflow' as const] : []),
  ].flatMap(context => FRAMEWORKS.map(framework => ({
    object, context, framework, head, runId: 'current-run', status: 'pass' as const,
    components: ['Stack'], artifactHash: 'sha256:artifact', report: `${object}/${context}/${framework}.json`,
    gates: [
      'generation', 'fresh-exact-tarball-install', 'strict-typecheck', 'production-build',
      'mount', 'accessibility-tree', 'screenshots', 'context-states',
      ...(context === 'workflow' ? ['server-render', 'hydration', 'shared-css-resolution', 'interaction-evidence'] : []),
    ].map(name => ({
      name, status: 'pass' as const,
      ...(name === 'context-states' && context === 'workflow'
        ? { detail: { observations: ['list', 'detail', 'form', 'timeline'].flatMap(screen => ['loading', 'empty', 'error', 'success'].map(state => ({ screen, state }))) } }
        : {}),
    })),
  }))));
  return {
    schemaVersion: '1.0.0', head, runId: 'current-run', historicalReceiptsUnioned: false,
    packCount: 1, browserImage: BROWSER_IMAGE, rows, summary: summarize(rows),
  };
}

function installLedger(ledger: RuntimeLedger): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s204-ledger-'));
  temporary.push(dir);
  const file = path.join(dir, 'runtime-cells.v1.json');
  fs.writeFileSync(file, JSON.stringify(ledger));
  vi.stubEnv('MCP_RUNTIME_CELLS_PATH', file);
  clearRuntimeLedgerMemo();
  return file;
}

describe('the runtime ledger is read once, not once per composition (s204 m01)', () => {
  it('repeated summaries read and revalidate the ledger exactly once', () => {
    const file = installLedger(ledgerFixture());
    const readFileSync = vi.spyOn(fs, 'readFileSync');
    const first = readRuntimeSummary();
    for (let index = 0; index < 20; index += 1) expect(readRuntimeSummary()).toEqual(first);
    const ledgerReads = readFileSync.mock.calls.filter(([target]) => String(target) === file);
    expect(ledgerReads).toHaveLength(1);
  });

  it('a composition does not pay a ledger read per call', async () => {
    const file = installLedger(ledgerFixture());
    await compose({ object: 'Usage', context: 'detail' });
    const readFileSync = vi.spyOn(fs, 'readFileSync');
    for (const context of ['detail', 'list', 'form', 'timeline'] as const) {
      const result = await compose({ object: 'Usage', context });
      expect(result.status).toBe('ok');
    }
    expect(readFileSync.mock.calls.filter(([target]) => String(target) === file)).toHaveLength(0);
  });

  it('the memo returns a copy, so a caller cannot corrupt the next reader', () => {
    installLedger(ledgerFixture());
    const first = readRuntimeSummary();
    (first as { pass: number }).pass = -1;
    expect(readRuntimeSummary().pass).toBe(200);
  });

  it('a rewritten ledger is re-read, and an invalid one still throws on every call', async () => {
    installLedger(ledgerFixture());
    expect(readRuntimeSummary()).toMatchObject({ cells: 200, pass: 200, head: 'measured-head' });

    const rejected = ledgerFixture();
    rejected.rows[0]!.status = 'fail';
    installLedger(rejected);
    // Not once: a memoized rejection must reject every caller, or catalog.list would serve a ratio
    // the ledger does not support after the first failure.
    expect(() => readRuntimeSummary()).toThrow(/Runtime ledger rejected/);
    expect(() => readRuntimeSummary()).toThrow(/Runtime ledger rejected/);
    const listed = await catalog({ detail: 'summary' }); // s211-m01: the scope ruling is in summary and full, not brief
    expect(listed.obligationScope?.runtimeEvidence).toContain('runtime proof is unavailable');

    installLedger(ledgerFixture('a-later-head'));
    expect(readRuntimeSummary().head).toBe('a-later-head');
  });
});
