#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const MISSION_ID = 'B16.6';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const DIAGNOSTICS_PATH = path.resolve(process.cwd(), 'diagnostics.json');

async function run() {
  const startedAt = performance.now();
  try {
    await runCommand(['exec', 'tsx', 'scripts/pkg/compat.ts']);
    const durationMs = Math.round(performance.now() - startedAt);
    await updateDiagnostics({
      mission: MISSION_ID,
      runAt: new Date().toISOString(),
      status: 'passed',
      durationMs,
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const exitCode = typeof error.exitCode === 'number' ? error.exitCode : 1;
    const message = error instanceof Error ? error.message : String(error);
    await updateDiagnostics({
      mission: MISSION_ID,
      runAt: new Date().toISOString(),
      status: 'failed',
      durationMs,
      error: message,
      exitCode,
    });
    process.exitCode = exitCode;
  }
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(PNPM_CMD, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`Command "${[PNPM_CMD, ...args].join(' ')}" exited with code ${code}`);
        error.exitCode = typeof code === 'number' ? code : 1;
        reject(error);
      }
    });
  });
}

async function updateDiagnostics(entry) {
  const diagnostics = await loadDiagnostics();
  diagnostics.helpers = diagnostics.helpers ?? {};
  const current = diagnostics.helpers.pkgCompat ?? {};
  const history = Array.isArray(current.history) ? current.history.slice(0, 9) : [];

  const record = {
    mission: entry.mission,
    runAt: entry.runAt,
    status: entry.status,
    durationMs: entry.durationMs,
    exitCode: entry.exitCode ?? null,
    notes: entry.error ? [entry.error] : undefined,
  };

  history.unshift(record);

  const runs = (current.totals?.runs ?? 0) + 1;
  const pass = (current.totals?.pass ?? 0) + (entry.status === 'passed' ? 1 : 0);
  const fail = (current.totals?.fail ?? 0) + (entry.status === 'failed' ? 1 : 0);

  diagnostics.helpers.pkgCompat = {
    totals: { runs, pass, fail },
    lastRun: record,
    history,
  };

  await fs.writeFile(DIAGNOSTICS_PATH, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
}

async function loadDiagnostics() {
  try {
    const raw = await fs.readFile(DIAGNOSTICS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

run().catch((error) => {
  console.error('pkg:compat helper failed', error);
  process.exitCode = error?.exitCode ?? 1;
});
