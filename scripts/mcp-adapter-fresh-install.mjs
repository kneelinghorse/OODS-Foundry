#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const ADAPTER_DIR = path.join(REPO_ROOT, 'packages', 'mcp-adapter');
const SERVER_DIST = path.join(REPO_ROOT, 'packages', 'mcp-server', 'dist');
const SERVER_DIST_ENTRY = path.join(SERVER_DIST, 'index.js');

const KEEP_TEMP = ['1', 'true', 'yes'].includes(String(process.env.KEEP_FRESH_INSTALL).toLowerCase());

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'], ...options });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

function ensureFileExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

async function main() {
  ensureFileExists(
    SERVER_DIST_ENTRY,
    'MCP server dist is missing. Run "pnpm --filter @oods/mcp-server run build" first.'
  );
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oods-mcp-adapter-'));
  const nodeModulesRoot = path.join(tempRoot, 'node_modules');

  console.log(`Fresh install root: ${tempRoot}`);

  try {
    console.log('> npm init -y');
    await run('npm', ['init', '-y'], { cwd: tempRoot });

    console.log('> npm pack @oods/mcp-adapter');
    const packOut = await runCapture('npm', ['pack', '--silent', '--pack-destination', tempRoot], {
      cwd: ADAPTER_DIR,
    });
    const tarballName = packOut.trim().split('\n').filter(Boolean).pop();
    if (!tarballName) {
      throw new Error('npm pack did not return a tarball name.');
    }
    const tarballPath = path.join(tempRoot, tarballName);

    console.log('> npm install (clean dir)');
    await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', tarballPath], {
      cwd: tempRoot,
    });

    const tempServerRoots = [
      path.join(nodeModulesRoot, 'packages', 'mcp-server'),
      path.join(nodeModulesRoot, '@oods', 'mcp-server'),
    ];

    console.log('> stage mcp-server dist');
    for (const tempServerRoot of tempServerRoots) {
      await mkdir(tempServerRoot, { recursive: true });
      await cp(SERVER_DIST, path.join(tempServerRoot, 'dist'), { recursive: true });
    }

    const smokePath = path.join(nodeModulesRoot, '@oods', 'mcp-adapter', 'smoke-test.js');
    ensureFileExists(smokePath, 'Smoke test not found in adapter package.');

    console.log('> node smoke-test.js');
    await run('node', [smokePath], {
      cwd: tempRoot,
      env: { ...process.env },
    });

    console.log('\nFresh-install smoke test passed.');
  } finally {
    if (!KEEP_TEMP) {
      await rm(tempRoot, { recursive: true, force: true });
    } else {
      console.log(`KEEP_FRESH_INSTALL=1 set, preserved ${tempRoot}`);
    }
  }
}

main().catch((error) => {
  console.error(`Fresh-install smoke test failed: ${error.message}`);
  process.exit(1);
});
