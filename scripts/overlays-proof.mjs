#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const MISSION_ID = 'B16.6';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const DIAGNOSTICS_PATH = path.resolve(process.cwd(), 'diagnostics.json');

const tasks = [
  {
    id: 'overlay-manager-e2e',
    label: 'Overlay manager interaction suite',
    command: ['vitest', 'run', 'tests/a11y/overlays/manager.test.tsx'],
    description: 'Exercises focus, inert outside, and escape routes via jsdom-driven interactions.',
  },
  {
    id: 'overlay-components-axe',
    label: 'Overlay components axe suite',
    command: [
      'vitest',
      'run',
      'tests/a11y/components.dialog.a11y.test.tsx',
      'tests/a11y/components.sheet.a11y.test.tsx',
      'tests/a11y/components.popover.test.tsx',
      'tests/a11y/components.tooltip.test.tsx',
    ],
    description: 'Runs axe smoke checks across dialog, sheet, popover, and tooltip.',
  },
];

async function run() {
  const results = [];
  let overallStatus = 'passed';

  for (const task of tasks) {
    const startedAt = performance.now();
    try {
      await runCommand(task.command);
      const durationMs = performance.now() - startedAt;
      results.push({
        id: task.id,
        label: task.label,
        status: 'passed',
        durationMs,
      });
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      const exitCode = typeof error.exitCode === 'number' ? error.exitCode : 1;
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        id: task.id,
        label: task.label,
        status: 'failed',
        durationMs,
        exitCode,
        error: message,
      });
      overallStatus = 'failed';
      await updateDiagnostics(results, overallStatus, message);
      process.exitCode = exitCode;
      return;
    }
  }

  await updateDiagnostics(results, overallStatus);
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(PNPM_CMD, ['exec', ...args], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`Command "${[PNPM_CMD, 'exec', ...args].join(' ')}" exited with code ${code}`);
        error.exitCode = typeof code === 'number' ? code : 1;
        reject(error);
      }
    });
  });
}

async function updateDiagnostics(results, status, failureMessage = null) {
  const runAt = new Date().toISOString();
  const totalDuration = Math.round(
    results.reduce((sum, item) => sum + (typeof item.durationMs === 'number' ? item.durationMs : 0), 0)
  );

  const entry = {
    mission: MISSION_ID,
    runAt,
    status,
    durationMs: totalDuration,
    tasks: results.map((item) => ({
      id: item.id,
      status: item.status,
      durationMs: Math.round(item.durationMs),
      exitCode: item.exitCode ?? null,
    })),
    notes: failureMessage ? [failureMessage] : undefined,
  };

  const diagnostics = await loadDiagnostics();
  diagnostics.helpers = diagnostics.helpers ?? {};

  const current = diagnostics.helpers.overlaysProof ?? {};
  const history = Array.isArray(current.history) ? current.history.slice(0, 9) : [];
  history.unshift(entry);

  const runs = (current.totals?.runs ?? 0) + 1;
  const pass = (current.totals?.pass ?? 0) + (status === 'passed' ? 1 : 0);
  const fail = (current.totals?.fail ?? 0) + (status === 'failed' ? 1 : 0);

  diagnostics.helpers.overlaysProof = {
    totals: { runs, pass, fail },
    lastRun: entry,
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
  console.error('overlays:proof failed', error);
  process.exitCode = error?.exitCode ?? 1;
});
