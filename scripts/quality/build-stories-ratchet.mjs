#!/usr/bin/env node
// s174 m04 — the build:stories EXACT-PIN ratchet.
//
// `pnpm build:stories` (tsc -p tsconfig.stories.json, noEmit) is the ONLY type lens over
// stories/** and apps/explorer/**, and it had zero automated consumers: nothing ran it, so its
// error count drifted for months and the real explorer errors inside it were invisible-to-green.
//
// EXACT PIN, not a ceiling. The script reds when the count EXCEEDS the pin (a regression) AND
// when it DROPS below it (with a "lower the pin to N" message). A ceiling would let headroom
// accumulate silently — someone fixes 40 errors, nobody lowers the number, and 40 new ones can
// land later without a red. With an exact pin the number only ever moves down, and every move
// is a commit somebody wrote.
//
// STATED LIMITATION, accepted: an EQUAL-COUNT swap is undetectable here. Fix one error, add
// another, and the count is unchanged and this passes. That is inherent to counting; the
// ratchet's job is to stop drift in aggregate, not to identify individual errors.
//
// Usage:
//   node scripts/quality/build-stories-ratchet.mjs           # gate (CI)
//   node scripts/quality/build-stories-ratchet.mjs --print   # measure only, exit 0

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PIN_PATH = path.join(repoRoot, 'configs', 'quality', 'build-stories-error-pin.json');
const ERROR_LINE = /error TS\d+/;

function measure() {
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsc', '--project', 'tsconfig.stories.json', '--pretty', 'false'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  if (result.error) {
    throw result.error;
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const lines = output.split('\n').filter((line) => ERROR_LINE.test(line));
  return { count: lines.length, output, lines, status: result.status, signal: result.signal };
}

const printOnly = process.argv.includes('--print');
const pin = JSON.parse(readFileSync(PIN_PATH, 'utf8'));
const expected = Number(pin.errors);

if (!Number.isInteger(expected) || expected < 0) {
  console.error(`build-stories ratchet: ${path.relative(repoRoot, PIN_PATH)} has no valid integer "errors" pin.`);
  process.exit(1);
}

const { count, lines, output, status, signal } = measure();

// A zero diagnostic count is only evidence of a clean build when tsc itself succeeded.
// Without this guard a crashed/mis-invoked compiler at pin 0 would be reported as GREEN.
if (status !== 0 && lines.length === 0) {
  const termination = status === null ? `signal ${signal ?? 'unknown'}` : `status ${status}`;
  console.error(
    `build-stories ratchet: tsc exited with ${termination} but produced no parseable TypeScript diagnostics; ` +
      'refusing to treat the run as zero errors.',
  );
  const detail = output.trim();
  if (detail) {
    console.error(detail);
  }
  process.exit(1);
}

if (printOnly) {
  console.log(`build:stories errors = ${count} (pin ${expected})`);
  process.exit(0);
}

if (count > expected) {
  console.error(`build:stories REGRESSED: ${count} type errors, pin is ${expected} (+${count - expected}).`);
  console.error('New errors are somewhere in the list below. Fix them, or — if the growth is deliberate —');
  console.error(`raise "errors" in ${path.relative(repoRoot, PIN_PATH)} in the same commit and say why.`);
  console.error('');
  console.error(lines.slice(0, 40).join('\n'));
  if (lines.length > 40) {
    console.error(`... and ${lines.length - 40} more`);
  }
  process.exit(1);
}

if (count < expected) {
  console.error(`build:stories IMPROVED: ${count} type errors, pin is still ${expected} (-${expected - count}).`);
  console.error(`Lower the pin to ${count} in ${path.relative(repoRoot, PIN_PATH)} and commit it.`);
  console.error('This is a RED on purpose: unrecorded headroom is how a ratchet quietly stops ratcheting.');
  process.exit(1);
}

console.log(`build:stories holds at the pin: ${count} type errors.`);
