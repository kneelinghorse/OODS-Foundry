import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Let the installed Rollup choose its native package (including libc/ABI).
// A fresh process prevents a successful earlier import from hiding missing files.
const PROBE = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const local = require('node:module').createRequire(path.join(process.cwd(), 'package.json'));
let rollupDirectory;
try {
  rollupDirectory = fs.realpathSync(path.dirname(local.resolve('rollup/package.json')));
  const modules = fs.realpathSync(path.join(process.cwd(), 'node_modules')) + path.sep;
  if (!rollupDirectory.startsWith(modules)) throw new Error('Rollup resolved outside the isolated consumer');
  local('rollup');
  process.stdout.write(JSON.stringify({ ok: true }));
} catch (error) {
  let missingPackage;
  for (let cause = error; cause; cause = cause.cause) {
    if (cause.code !== 'MODULE_NOT_FOUND') continue;
    missingPackage = /^Cannot find module '(@rollup\/rollup-[a-z0-9-]+)'/.exec(cause.message)?.[1];
    if (missingPackage) break;
  }
  process.stdout.write(JSON.stringify({ ok: false, rollupDirectory, missingPackage, message: error.message }));
}
`;

function probe(consumerRoot) {
  const environment = { ...process.env };
  delete environment.NODE_PATH;
  delete environment.NODE_OPTIONS;
  const result = spawnSync(process.execPath, ['-e', PROBE], {
    cwd: consumerRoot, env: environment, encoding: 'utf8', timeout: 30_000,
  });
  if (result.status !== 0) throw new Error(`Consumer Rollup probe failed: ${result.error?.message ?? result.stderr}`);
  return JSON.parse(result.stdout);
}

/** Verify native Rollup after npm install, recovering only a missing optional binding. */
export async function ensureConsumerRollup(consumerRoot, reinstall) {
  const initial = probe(consumerRoot);
  if (initial.ok) return { retried: false };
  if (!initial.missingPackage) throw new Error(`Consumer Rollup failed: ${initial.message}`);

  const modules = path.join(consumerRoot, 'node_modules');
  fs.rmSync(path.join(modules, '.package-lock.json'), { force: true });
  fs.rmSync(initial.rollupDirectory, { recursive: true, force: true });
  // Remove native siblings alongside this Rollup, preserving all other packages.
  const scope = path.join(path.dirname(initial.rollupDirectory), '@rollup');
  if (fs.existsSync(scope)) {
    for (const entry of fs.readdirSync(scope)) {
      if (entry.startsWith('rollup-')) fs.rmSync(path.join(scope, entry), { recursive: true, force: true });
    }
  }
  try {
    await reinstall(['--include=optional']);
    const retried = probe(consumerRoot);
    if (!retried.ok) throw new Error(retried.message);
  } catch (error) {
    throw new Error(`Consumer is missing a working ${initial.missingPackage} after one --include=optional reinstall: ${error.message}`, { cause: error });
  }
  return { retried: true, missingPackage: initial.missingPackage };
}
