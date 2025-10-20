#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const skip = new Set();
const passthrough = [];

for (const arg of args) {
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (arg.startsWith('--skip=')) {
    const [, list] = arg.split('=');
    if (list) {
      for (const item of list.split(',')) {
        skip.add(item.trim());
      }
    }
  } else if (arg.startsWith('--skip-')) {
    skip.add(arg.replace('--skip-', '').trim());
  } else {
    passthrough.push(arg);
  }
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const tasks = [
  { id: 'lint', label: 'Lint', command: ['lint'] },
  { id: 'types', label: 'Type checks', command: ['typecheck'] },
  { id: 'unit', label: 'Unit tests', command: ['test:unit'] },
  { id: 'a11y', label: 'Accessibility contract', command: ['a11y:check'] },
  { id: 'vr', label: 'Visual regression (dry run)' }
];

const results = [];

(async () => {
  for (const task of tasks) {
    if (skip.has(task.id)) {
      results.push({ ...task, status: 'skipped' });
      continue;
    }

    const start = performance.now();

    try {
      const meta =
        task.id === 'vr'
          ? await runVisualRegression()
          : await runCommand(task.command).then(() => ({}));

      const duration = performance.now() - start;
      results.push({ ...task, status: 'ok', duration, ...meta });
    } catch (error) {
      const duration = performance.now() - start;
      results.push({ ...task, status: 'failed', duration, error });
      printSummary(results);
      process.exit(error.exitCode ?? 1);
    }
  }

  printSummary(results);
})().catch((error) => {
  console.error('\nUnexpected failure in local PR check script.');
  console.error(error);
  process.exit(1);
});

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const proc = spawn(pnpmCmd, ['run', ...command, ...passthrough], { stdio: 'inherit' });

    proc.on('error', (error) => reject(error));

    proc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`Command "${command.join(' ')}" exited with code ${code ?? signal}`);
        err.exitCode = typeof code === 'number' ? code : 1;
        reject(err);
      }
    });
  });
}

async function runVisualRegression() {
  const hasChromaticToken = Boolean(process.env.CHROMATIC_PROJECT_TOKEN);

  if (hasChromaticToken) {
    try {
      await runCommand(['chromatic:dry-run']);
      return { meta: 'chromatic:dry-run' };
    } catch (error) {
      console.warn('Chromatic dry run failed — attempting local smoke harness instead.');
    }
  } else {
    console.log('CHROMATIC_PROJECT_TOKEN not set — using local VRT smoke harness.');
  }

  await runCommand(['vrt:lightdark', '--ci']);
  return { meta: 'vrt:lightdark --ci' };
}

function printSummary(items) {
  console.log('\nLocal PR check summary');
  console.log('----------------------');

  for (const item of items) {
    const duration = item.duration ? formatDuration(item.duration) : '';

    if (item.status === 'skipped') {
      console.log(`- ${item.label}: skipped`);
    } else if (item.status === 'ok') {
      const meta = item.meta ? ` (${item.meta})` : '';
      console.log(`- ${item.label}: pass ${duration}${meta}`);
    } else {
      console.log(`- ${item.label}: failed ${duration}`);
      if (item.error) {
        console.log(`  ↳ ${item.error.message}`);
      }
    }
  }
}

function formatDuration(ms) {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `(${seconds.toFixed(1)}s)`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `(${minutes}m ${remainder.toFixed(0)}s)`;
}

function printHelp() {
  console.log(`Usage: pnpm local:pr-check [options]

Runs lint, type checks, unit tests, accessibility checks, and a visual-regression dry run.
Stops at the first failure and exits non-zero.

Options:
  --skip=<list>      Comma-separated list of steps to skip (lint,types,unit,a11y,vr)
  --skip-lint        Skip linting (shorthand)
  --skip-types       Skip type checks
  --skip-unit        Skip unit tests
  --skip-a11y        Skip accessibility contract
  --skip-vr          Skip visual regression dry run
  -h, --help         Show this help text

Environment:
  CHROMATIC_PROJECT_TOKEN   When set, runs chromatic:dry-run. Falls back to vrt:lightdark otherwise.
`);
}
