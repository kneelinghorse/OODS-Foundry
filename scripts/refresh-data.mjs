#!/usr/bin/env node
/**
 * Structured data refresh wrapper.
 *
 * Provides a stable entrypoint for adopters: `pnpm refresh:data`.
 * Delegates to `cmos/scripts/refresh_structured_data.py` with sensible defaults
 * and passthrough arguments.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const PYTHON_SCRIPT = path.join('cmos', 'scripts', 'refresh_structured_data.py');
const DEFAULT_ARTIFACT_DIR = path.join('artifacts', 'structured-data');

export function buildRefreshStructuredDataArgs(argv) {
  const passthrough = argv.slice();
  while (passthrough[0] === '--') {
    passthrough.shift();
  }

  const args = [PYTHON_SCRIPT];

  if (!hasFlag(passthrough, '--artifact-dir')) {
    args.push('--artifact-dir', DEFAULT_ARTIFACT_DIR);
  }

  if (!hasFlag(passthrough, '--version-tag')) {
    args.push('--version-tag', 'auto');
  }

  args.push(...passthrough);
  return args;
}

function hasFlag(argv, flag) {
  const prefix = `${flag}=`;
  return argv.some((arg) => arg === flag || arg.startsWith(prefix));
}

function resolvePython3() {
  const candidates = ['python3', 'python'];
  for (const candidate of candidates) {
    const check = spawnSync(
      candidate,
      ['-c', 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)'],
      { stdio: 'ignore' },
    );

    if (check.status === 0) {
      return candidate;
    }
  }

  return null;
}

export function runRefreshData(argv) {
  const python = resolvePython3();
  if (!python) {
    console.error(
      [
        'Python 3 is required to refresh structured data, but no Python 3 interpreter was found on PATH.',
        'Install Python 3 and ensure `python3` (or `python`) is available, then retry:',
        '  pnpm refresh:data',
      ].join('\n'),
    );
    return 1;
  }

  const args = buildRefreshStructuredDataArgs(argv);
  const result = spawnSync(python, args, { stdio: 'inherit', cwd: repoRoot });

  if (result.error) {
    console.error('Unable to run structured data refresh:', result.error);
    return 1;
  }

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(process.argv[1]) === path.resolve(__filename);
}

if (isMain()) {
  process.exit(runRefreshData(process.argv.slice(2)));
}
