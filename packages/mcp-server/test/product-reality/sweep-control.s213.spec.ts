import { vi } from 'vitest';

// Starts real Playwright servers and one real container; each is bounded and torn down by the test.
vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';
import { BROWSER_IMAGE, CONTEXTS, FRAMEWORKS, OBJECTS, contextsForObject, summarize, supportsWorkflow, validateRuntimeLedger, type RuntimeCell } from '../../src/lib/runtime-ledger.js';
import { StopController, assertBrowserCapacity, crashedCell, promotionIssues, requiredBrowserClients, runQueue, startOwnedBrowser, type SweepLedger } from '../../../../scripts/product-reality/sweep-control.js';

/**
 * Sprint 213 m01, Sprint 212 builder packet 1: the runtime sweep must run unattended and never report more than it proved.
 * Sprint 212 lost four full attempts to browser stalls, then paused by hand at 213 of 356 cells, and one attempt
 * deadlocked because a cell held its browser while its chart proof asked for a second one from a one-client server
 * (learning #721). These tests hold, against real servers where it matters:
 *  - no more cells run at once than the operator allows;
 *  - a stop starts nothing new, lets running cells finish, and leaves an exact account of what never ran;
 *  - the browser cap must cover two connections per worker, because one is not enough: the nested request waits forever;
 *  - an owned browser container is removed when the run exits, even when it is stopped by a signal;
 *  - a stopped, partial, crashed or combined run can never replace the runtime registry.
 */
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const playwrightCore = path.join(root, 'node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const children: ChildProcess[] = [];
/** An ignored scratch folder inside the repository (packages/components-react/.cache is gitignored). */
const scratch = () => { const directory = path.join(root, 'packages/components-react/.cache'); fs.mkdirSync(directory, { recursive: true }); return directory; };
afterEach(() => { for (const child of children.splice(0)) child.kill('SIGKILL'); });

const freePort = () => new Promise<number>(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const { port } = server.address() as net.AddressInfo; server.close(() => resolve(port)); }); });
async function playwrightServer(maxClients: number) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(playwrightCore, 'cli.js'), 'run-server', '--host', '127.0.0.1', '--port', String(port), '--max-clients', String(maxClients)], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Playwright server did not start')), 30_000);
    child.stdout!.on('data', chunk => { if (String(chunk).includes('Listening on')) { clearTimeout(timer); resolve(); } });
  });
  return `ws://127.0.0.1:${port}/`;
}
const within = <T>(promise: Promise<T>, ms: number) => Promise.race([promise.then(value => ({ settled: true as const, value })), new Promise<{ settled: false }>(resolve => setTimeout(() => resolve({ settled: false }), ms))]);

describe('the runtime sweep runs unattended (s213-m01)', () => {
  it('runs no more cells at once than its workers, and keeps every result', async () => {
    let inFlight = 0, peak = 0;
    const result = await runQueue({ inputs: Array.from({ length: 12 }, (_, index) => index), workers: 3, stop: () => null,
      run: async (input: number) => { inFlight += 1; peak = Math.max(peak, inFlight); await new Promise(resolve => setTimeout(resolve, 15)); inFlight -= 1; return input * 2; } });
    expect(peak).toBe(3);
    expect(result.results.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, index) => index * 2));
    expect(result.unstarted).toEqual([]);
    expect(result.stoppedBy).toBeNull();
  });

  it('drains on stop: running cells finish, nothing new starts, and the unrun cells are named', async () => {
    const started: number[] = [], finished: number[] = [];
    let stop: string | null = null;
    const result = await runQueue({ inputs: Array.from({ length: 10 }, (_, index) => index), workers: 2, stop: () => stop,
      onStart: input => { started.push(input); if (started.length === 3) stop = 'SIGTERM'; },
      run: async (input: number) => { await new Promise(resolve => setTimeout(resolve, 20)); finished.push(input); return input; } });
    expect(started).toEqual([0, 1, 2]);
    expect(finished.sort()).toEqual([0, 1, 2]);
    expect(result.results.sort()).toEqual([0, 1, 2]);
    expect(result.unstarted).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(result.stoppedBy).toBe('SIGTERM');
  });

  it('takes a stop from a STOP file in the receipt root, or a signal, and hard-stops on the second signal', () => {
    const directory = fs.mkdtempSync(path.join(scratch(), 's213-stop-'));
    try {
      const file = path.join(directory, 'STOP');
      let hard = 0;
      const control = new StopController(file, () => { hard += 1; });
      expect(control.requested()).toBeNull();
      fs.writeFileSync(file, '');
      expect(control.requested()).toBe('stop file STOP');
      const signalled = new StopController(path.join(directory, 'absent'), () => { hard += 1; });
      signalled.listen();
      try {
        process.emit('SIGTERM');
        expect(signalled.state()).toMatchObject({ requested: true, reason: 'SIGTERM' });
        expect(hard).toBe(0);
        process.emit('SIGTERM');
        expect(hard).toBe(1);
      } finally { signalled.close(); }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('reproduces the one-client deadlock (#721) on a real Playwright server, and needs two clients per worker', async () => {
    const single = await playwrightServer(1);
    const outer = await chromium.connect(single);
    // The cell still holds its browser; its chart proof asks for another. A one-client server queues that request
    // until the first closes, which it never does while the cell waits on the proof.
    const nested = chromium.connect(single);
    const waited = await within(nested, 4_000);
    expect(waited.settled).toBe(false);
    await outer.close();
    const released = await within(nested, 30_000);
    expect(released.settled).toBe(true);
    if (released.settled) await released.value.close();
    const double = await playwrightServer(requiredBrowserClients(1));
    const first = await chromium.connect(double);
    const second = await within(chromium.connect(double), 30_000);
    expect(second.settled).toBe(true);
    if (second.settled) await second.value.close();
    await first.close();
    expect(() => assertBrowserCapacity(1, 1)).toThrow(/learning #721/);
    expect(() => assertBrowserCapacity(4, 7)).toThrow(/8 at once/);
    expect(() => assertBrowserCapacity(4, 8)).not.toThrow();
    expect(() => assertBrowserCapacity(0, undefined)).toThrow(/from 1 to 8/);
  });

  it('removes an owned browser container when a stopped run exits on the second signal', async () => {
    expect(spawnSync('docker', ['version'], { encoding: 'utf8' }).status, 'the sweep needs Docker for its pinned browser').toBe(0);
    const directory = fs.mkdtempSync(path.join(scratch(), 's213-owned-'));
    const name = `forge-s213-owned-test-${process.pid}`;
    const receipt = path.join(directory, 'owned-browser.json');
    const script = path.join(directory, 'owner.mts');
    fs.writeFileSync(script, `import { StopController, startOwnedBrowser } from ${JSON.stringify(path.join(root, 'scripts/product-reality/sweep-control.ts'))};
const browser = startOwnedBrowser({ name: ${JSON.stringify(name)}, image: ${JSON.stringify(BROWSER_IMAGE)}, maxClients: 2, playwrightCore: ${JSON.stringify(playwrightCore)}, receiptPath: ${JSON.stringify(receipt)} });
new StopController(${JSON.stringify(path.join(directory, 'STOP'))}).listen();
console.log('ready ' + browser.endpoint);
setInterval(() => {}, 1000);
`);
    try {
      const owner = spawn(process.execPath, ['--import', 'tsx', script], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      children.push(owner);
      const endpoint = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('owned browser did not start')), 90_000);
        owner.stdout!.on('data', chunk => { const match = /ready (\S+)/.exec(String(chunk)); if (match) { clearTimeout(timer); resolve(match[1]!); } });
        owner.stderr!.on('data', chunk => process.stderr.write(chunk));
      });
      expect(spawnSync('docker', ['inspect', name]).status).toBe(0);
      let connected = false;
      for (let attempt = 0; attempt < 30 && !connected; attempt += 1) {
        try { const browser = await chromium.connect(endpoint); expect(browser.version()).toBe('141.0.7390.37'); await browser.close(); connected = true; }
        catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
      }
      expect(connected, 'the owned server serves the pinned Chromium').toBe(true);
      const exited = new Promise<number | null>(resolve => owner.on('exit', code => resolve(code)));
      owner.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 300));
      owner.kill('SIGTERM');
      expect(await exited).toBe(130);
      expect(spawnSync('docker', ['inspect', name]).status, 'the container is gone').not.toBe(0);
      expect(JSON.parse(fs.readFileSync(receipt, 'utf8'))).toMatchObject({ name, removed: true, stillPresent: false, reason: 'process exit', maxClients: 2 });
    } finally {
      spawnSync('docker', ['rm', '-f', name]);
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never promotes a stopped, partial, crashed or combined run into the registry', () => {
    const head = 'a'.repeat(40), runId = 'run-1';
    const gates = (context: string) => ['generation', 'fresh-exact-tarball-install', 'strict-typecheck', 'production-build', 'mount', 'accessibility-tree', 'screenshots', 'context-states',
      ...(context === 'workflow' ? ['server-render', 'hydration', 'shared-css-resolution', 'interaction-evidence'] : [])]
      .map(name => ({ name, status: 'pass' as const, ...(name === 'context-states' && context === 'workflow' ? { detail: { observations: ['list', 'detail', 'form', 'timeline'].flatMap(screen => ['loading', 'empty', 'error', 'success'].map(state => ({ screen, state }))) } } : {}) }));
    const rows: RuntimeCell[] = OBJECTS.flatMap(object => [...contextsForObject(object), ...(supportsWorkflow(object) ? ['workflow' as const] : [])]
      .flatMap(context => FRAMEWORKS.map(framework => ({ object, context, framework, head, runId, status: 'pass' as const, gates: gates(context), artifactHash: `sha256:${object}`, components: [], report: 'receipt.json' }))));
    const complete: SweepLedger = { schemaVersion: '1.0.0', head, runId, historicalReceiptsUnioned: false, packCount: 1, browserImage: BROWSER_IMAGE, rows, summary: summarize(rows) };
    expect(rows.length).toBeGreaterThan(CONTEXTS.length * FRAMEWORKS.length);
    expect(promotionIssues(complete, true)).toEqual([]);
    // Stop within the current population: both the missing cells and the stop must refuse promotion.
    const stoppedAfter = Math.floor(rows.length / 2);
    const kept = rows.slice(0, stoppedAfter);
    const stopped: SweepLedger = { ...complete, rows: kept, summary: summarize(kept), partial: { stoppedBy: 'SIGTERM', unrun: rows.slice(stoppedAfter).map(row => `${row.object}/${row.context}/${row.framework}`) } };
    expect(promotionIssues(stopped, true)).toEqual(expect.arrayContaining([expect.stringContaining('the run is partial (stopped by SIGTERM'), expect.stringContaining('population must contain exactly')]));
    // Even a ledger with every cell is refused while it carries the partial record.
    expect(promotionIssues({ ...complete, partial: { stoppedBy: null, unrun: [] } }, true)[0]).toContain('the run is partial');
    // A crashed worker is a failed cell with its log, never a missing one.
    const crash = crashedCell(rows[0]!, head, runId, 1, 'cells/Article/card/react/process.log');
    const crashed = { ...complete, rows: [crash, ...rows.slice(1)], summary: summarize([crash, ...rows.slice(1)]) };
    expect(validateRuntimeLedger(crashed, true)).toContain('Article/card/react failed');
    // Combining the paused run with a later one is a union of runs, whatever the rows say.
    const later = rows.slice(stoppedAfter).map(row => ({ ...row, runId: 'run-2' }));
    const union = { ...complete, rows: [...kept, ...later], summary: summarize([...kept, ...later]) };
    expect(promotionIssues(union, true)).toContain('historical or mixed-run receipts are forbidden');
  });

  it('builds the owned container with a reaper, the pinned image, the repository Playwright and the nested-proof cap', () => {
    const calls: string[][] = [];
    const browser = startOwnedBrowser({ name: 'owned', image: BROWSER_IMAGE, maxClients: 8, playwrightCore, receiptPath: path.join(scratch(), 's213-fake/owned.json'),
      run: (command, args) => { calls.push([command, ...args]); return args[0] === 'port' ? { status: 0, stdout: '127.0.0.1:49152\n', stderr: '' } : args[0] === 'inspect' ? { status: 1, stdout: '', stderr: 'No such object' } : { status: 0, stdout: '', stderr: '' }; } });
    try {
      expect(browser.endpoint).toBe('ws://127.0.0.1:49152/');
      const [docker, ...runArgs] = calls[0]!;
      expect(docker).toBe('docker');
      expect(runArgs).toEqual(expect.arrayContaining(['--init', BROWSER_IMAGE, '--max-clients', '8', `type=bind,source=${playwrightCore},target=/tools/playwright-core,readonly`]));
      expect(browser.reap('complete')).toMatchObject({ removed: true, stillPresent: false, reason: 'complete' });
      expect(browser.reap('again').reason).toBe('complete');
      expect(calls.filter(call => call[1] === 'rm')).toHaveLength(1);
    } finally { fs.rmSync(path.join(scratch(), 's213-fake'), { recursive: true, force: true }); }
  });
});
