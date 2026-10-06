/**
 * s213-m01 (Sprint 212 carry, builder packet 1): the runtime sweep runs unattended.
 *
 * Sprint 212's sweep died four times on browser stalls and was finally paused by hand at 213 of 356 cells: it had four
 * fixed workers, no way to stop without killing cells mid-proof, no progress anyone could read while it ran, and a
 * one-connection browser server that deadlocked when a cell held its browser and asked for a second one for its chart
 * proof (learning #721). These controls give it:
 *  - a bounded number of cell workers, chosen by the operator;
 *  - a stop that drains: running cells finish and write their receipts, no new cell starts, and the run records exactly
 *    what completed and what never ran (a STOP file in the receipt root, or SIGINT/SIGTERM; a second signal hard-stops);
 *  - browser capacity sized for nested proofs: every cell may hold two connections at once, so a declared server cap
 *    below twice the workers is refused before anything starts;
 *  - an owned pinned browser container that is removed on every exit, stopped, crashed or complete;
 *  - no resumption: a stopped or partial run is final, and it can never be promoted into the runtime registry or
 *    combined with another run.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { validateRuntimeLedger, type RuntimeCell, type RuntimeLedger } from '../../packages/mcp-server/src/lib/runtime-ledger.js';

/** The outer browser a cell mounts in, and the nested one its chart-theme proof opens while the outer is still held. */
export const BROWSER_CONNECTIONS_PER_CELL = 2;
export const MAX_WORKERS = 8;

export function requiredBrowserClients(workers: number): number {
  return workers * BROWSER_CONNECTIONS_PER_CELL;
}

/** Refuse a worker count the browser server cannot serve: one held connection plus one nested request per cell. */
export function assertBrowserCapacity(workers: number, declaredMaxClients: number | undefined): void {
  assert(Number.isInteger(workers) && workers >= 1 && workers <= MAX_WORKERS, `Workers must be an integer from 1 to ${MAX_WORKERS}; received ${workers}.`);
  if (declaredMaxClients === undefined) return;
  assert(declaredMaxClients >= requiredBrowserClients(workers),
    `The browser server admits ${declaredMaxClients} client(s), but ${workers} worker(s) can hold ${requiredBrowserClients(workers)} at once `
    + '(each cell keeps its browser while its chart proof opens another). A lower cap deadlocks the nested proof (learning #721); '
    + 'lower --workers or raise the server cap.');
}

export interface SweepProgress {
  head: string; runId: string; workers: number; total: number;
  started: number; completed: number; pass: number; typedGap: number; fail: number;
  running: string[]; unstarted: number;
  stop: { requested: boolean; reason: string | null; at: string | null };
  updatedAt: string;
}

/** Reads a stop request: a signal the controller received, or a STOP file the operator created in the receipt root. */
export class StopController {
  private reason: string | null = null;
  private at: string | null = null;
  private signals = 0;
  private readonly handlers: Array<[NodeJS.Signals, () => void]> = [];
  constructor(private readonly stopFile: string, private readonly onHardStop: () => void = () => process.exit(130)) {}

  request(reason: string): void {
    if (this.reason) return;
    this.reason = reason;
    this.at = new Date().toISOString();
  }

  /** The reason a stop was requested, or null. Creating the STOP file requests one. */
  requested(): string | null {
    if (!this.reason && fs.existsSync(this.stopFile)) this.request(`stop file ${path.basename(this.stopFile)}`);
    return this.reason;
  }

  state(): SweepProgress['stop'] {
    return { requested: this.requested() !== null, reason: this.reason, at: this.at };
  }

  /** First SIGINT/SIGTERM drains; a second forces the exit (the owned browser is still reaped by its exit hook). */
  listen(): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => {
        this.signals += 1;
        if (this.signals > 1) this.onHardStop();
        else this.request(signal);
      };
      process.on(signal, handler);
      this.handlers.push([signal, handler]);
    }
  }

  close(): void {
    for (const [signal, handler] of this.handlers) process.off(signal, handler);
  }
}

export interface QueueResult<Input, Output> {
  results: Output[];
  unstarted: Input[];
  stoppedBy: string | null;
}

/**
 * Run each input through `run` with at most `workers` in flight. Once a stop is requested no further input starts; the
 * ones already running finish. Nothing is retried and every result is kept, in completion order.
 */
export async function runQueue<Input, Output>(options: {
  inputs: readonly Input[];
  workers: number;
  run: (input: Input) => Promise<Output>;
  stop: () => string | null;
  onStart?: (input: Input) => void;
  onFinish?: (input: Input, output: Output) => void;
}): Promise<QueueResult<Input, Output>> {
  assert(options.workers >= 1, 'At least one worker is required.');
  const results: Output[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(options.workers, Math.max(1, options.inputs.length)) }, async () => {
    while (cursor < options.inputs.length && !options.stop()) {
      const input = options.inputs[cursor++]!;
      options.onStart?.(input);
      const output = await options.run(input);
      results.push(output);
      options.onFinish?.(input, output);
    }
  }));
  return { results, unstarted: options.inputs.slice(cursor), stoppedBy: options.stop() };
}

/** A worker process that died is a failed cell with its evidence, never a silently missing one. */
export function crashedCell(input: Pick<RuntimeCell, 'object' | 'context' | 'framework'>, head: string, runId: string, exitCode: number, log: string): RuntimeCell {
  return { ...input, head, runId, status: 'fail', artifactHash: null, components: [], report: log,
    gates: [{ name: 'worker', status: 'fail', reason: `Cell worker exited with code ${exitCode}; see ${log}` }] };
}

/** A run is partial when it stopped or any declared cell did not run; the ledger says so and says what is missing. */
export type SweepLedger = RuntimeLedger & { partial?: { stoppedBy: string | null; unrun: string[] } };

/** Why a run's ledger may not replace the runtime registry: it must be complete, current and a single run. */
export function promotionIssues(ledger: SweepLedger, workflows: boolean): string[] {
  const issues = ledger.partial ? [`the run is partial (${ledger.partial.stoppedBy ? `stopped by ${ledger.partial.stoppedBy}` : 'not every cell ran'}; ${ledger.partial.unrun.length} cell(s) unrun)`] : [];
  return [...issues, ...validateRuntimeLedger(ledger, workflows)];
}

export interface CommandRunner {
  (command: string, args: readonly string[]): { status: number | null; stdout: string; stderr: string };
}
export const runCommand: CommandRunner = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

export interface OwnedBrowser {
  name: string; endpoint: string; maxClients: number; image: string;
  /** Removes the container; idempotent. Returns the removal receipt. */
  reap(reason: string): OwnedBrowserReceipt;
}
export interface OwnedBrowserReceipt { name: string; image: string; maxClients: number; reason: string; removed: boolean; stillPresent: boolean; at: string; detail: string }

/**
 * Start the pinned Linux browser as a container this run owns, with a client cap sized for nested proofs, and remove it
 * when the process exits for any reason. The Playwright server is the repository's own playwright-core, mounted
 * read-only, so the image needs no network and the server matches the pinned browser build.
 */
export function startOwnedBrowser(options: { name: string; image: string; maxClients: number; playwrightCore: string; receiptPath: string; run?: CommandRunner }): OwnedBrowser {
  const run = options.run ?? runCommand;
  const started = run('docker', ['run', '-d', '--name', options.name, '--init', '--ipc=host', '-p', '127.0.0.1::3000',
    '--mount', `type=bind,source=${options.playwrightCore},target=/tools/playwright-core,readonly`,
    options.image, 'node', '/tools/playwright-core/cli.js', 'run-server', '--host', '0.0.0.0', '--port', '3000', '--max-clients', String(options.maxClients)]);
  assert.equal(started.status, 0, `Owned browser did not start: ${started.stderr}`);
  let receipt: OwnedBrowserReceipt | undefined;
  const reap = (reason: string): OwnedBrowserReceipt => {
    if (receipt) return receipt;
    const removed = run('docker', ['rm', '-f', options.name]);
    const inspect = run('docker', ['inspect', options.name]);
    receipt = { name: options.name, image: options.image, maxClients: options.maxClients, reason, removed: removed.status === 0, stillPresent: inspect.status === 0, at: new Date().toISOString(), detail: (removed.stdout + removed.stderr).trim() };
    fs.mkdirSync(path.dirname(options.receiptPath), { recursive: true });
    fs.writeFileSync(options.receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  };
  process.once('exit', () => { reap('process exit'); });
  const port = run('docker', ['port', options.name, '3000/tcp']);
  const host = /127\.0\.0\.1:(\d+)/.exec(port.stdout)?.[1];
  if (port.status !== 0 || !host) { reap('no published port'); assert.fail(`Owned browser published no port: ${port.stderr}`); }
  return { name: options.name, endpoint: `ws://127.0.0.1:${host}/`, maxClients: options.maxClients, image: options.image, reap };
}
