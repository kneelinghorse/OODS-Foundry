/**
 * s55-m01 contract tests — adapter import and dependency fixes
 *
 * Validates all six success criteria for the mission:
 * 1. Standard MCP SDK imports (no pathToFileURL hack)
 * 2. zod listed in package.json dependencies
 * 3. process.execPath replaced with OODS_NODE_PATH env var fallback
 * 4. Node version check logs warning if < 20
 * 5. pnpm install resolves all adapter dependencies
 * 6. Adapter resolves imports from its own directory (outside-monorepo proxy)
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_SRC = readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const PKG = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log('s55-m01 contract tests\n');

// ── Criterion 1: Standard imports, no pathToFileURL hack ─────────────

test('Uses standard SDK import (Server or McpServer) — no pathToFileURL hack', () => {
  const hasStdImport =
    INDEX_SRC.includes("from '@modelcontextprotocol/sdk/server/mcp.js'") ||
    INDEX_SRC.includes("from '@modelcontextprotocol/sdk/server/index.js'");
  assert.ok(hasStdImport, 'Expected standard import from @modelcontextprotocol/sdk/server/');
});

test('Uses standard StdioServerTransport import', () => {
  assert.ok(
    INDEX_SRC.includes("from '@modelcontextprotocol/sdk/server/stdio.js'"),
    'Expected static import of StdioServerTransport from @modelcontextprotocol/sdk/server/stdio.js'
  );
});

test('No pathToFileURL hack for SDK imports', () => {
  assert.ok(
    !INDEX_SRC.includes('pathToFileURL'),
    'pathToFileURL should be removed from index.js'
  );
});

test('No dynamic import() for SDK modules', () => {
  const sdkDynamic = INDEX_SRC.match(/await\s+import\(.*modelcontextprotocol/);
  assert.ok(!sdkDynamic, 'Should not use dynamic import() for MCP SDK');
});

// ── Criterion 2: zod in package.json dependencies ────────────────────

test('zod is a direct dependency in package.json', () => {
  assert.ok(PKG.dependencies.zod, 'zod should be listed in dependencies');
});

test('zod version is compatible with SDK (^3.23.8+)', () => {
  const ver = PKG.dependencies.zod;
  assert.ok(ver.includes('3.2'), `Expected zod ^3.23+, got ${ver}`);
});

test('zod is resolvable (available for use)', async () => {
  const mod = await import('zod');
  assert.ok(typeof mod.z === 'object', 'zod should resolve from adapter deps');
});

// ── Criterion 3: OODS_NODE_PATH env var fallback ─────────────────────

test('process.execPath replaced with OODS_NODE_PATH fallback', () => {
  assert.ok(
    INDEX_SRC.includes('OODS_NODE_PATH'),
    'Expected OODS_NODE_PATH env var usage'
  );
});

test('OODS_NODE_PATH falls back to process.execPath', () => {
  assert.ok(
    INDEX_SRC.includes("process.env.OODS_NODE_PATH || process.execPath"),
    'Expected OODS_NODE_PATH || process.execPath pattern'
  );
});

test('No bare process.execPath in spawn call', () => {
  const lines = INDEX_SRC.split('\n');
  const spawnLines = lines.filter(l => l.includes('spawn(') && l.includes('execPath'));
  // The only spawn should use the nodeBin variable, not process.execPath directly
  for (const line of spawnLines) {
    assert.ok(
      !line.includes('process.execPath'),
      `spawn() should use nodeBin variable, not process.execPath directly: ${line.trim()}`
    );
  }
});

// ── Criterion 4: Node version check ──────────────────────────────────

// s206-m03 replaced the Sprint 55 warning with a refusal: below the runtime floor the adapter stops before anything
// else loads, with one plain sentence (test-s206-node-floor.js runs it).
test('Node floor module is the first import of index.js', () => {
  const firstImport = INDEX_SRC.split('\n').find(line => line.startsWith('import '));
  assert.equal(firstImport, "import './node-floor.js';", 'node-floor.js must be imported before anything else');
});

test('Floor comes from engines.node and matches the runtime floor', () => {
  assert.equal(PKG.engines.node, '>=22.0.0', 'The adapter must declare the runtime Node floor it enforces');
});

test('Below the floor the adapter refuses on stderr', () => {
  const floorSrc = readFileSync(path.join(__dirname, 'node-floor.js'), 'utf8');
  assert.ok(floorSrc.includes('process.versions.node'), 'Expected a check of process.versions.node');
  assert.ok(/console\.error\(/.test(floorSrc) && floorSrc.includes('process.exit(1)'), 'Expected a refusal on stderr with exit code 1');
});

// ── Criterion 5: Dependency resolution ───────────────────────────────

test('@modelcontextprotocol/sdk is a direct dependency', () => {
  assert.ok(
    PKG.dependencies['@modelcontextprotocol/sdk'],
    'MCP SDK should be a direct dependency'
  );
});

test('package.json type is module (ESM)', () => {
  assert.equal(PKG.type, 'module', 'Package should be type: module for ESM');
});

test('engines.node requires >= 22', () => {
  assert.ok(PKG.engines?.node, 'engines.node should be specified');
  // s220-m02: the floor is read as a version, not a substring; the runtime's token build needs Node 22.
  const major = Number(/^>=\s*(\d+)\./.exec(PKG.engines.node)?.[1]);
  assert.ok(major >= 22, `Expected engines.node >= 22, got ${PKG.engines.node}`);
});

// ── Criterion 6: Import resolution (outside monorepo proxy) ──────────

test('McpServer resolves from adapter node_modules', async () => {
  const mod = await import('@modelcontextprotocol/sdk/server/mcp.js');
  assert.ok(typeof mod.McpServer === 'function', 'McpServer should be a constructor');
});

test('StdioServerTransport resolves from adapter node_modules', async () => {
  const mod = await import('@modelcontextprotocol/sdk/server/stdio.js');
  assert.ok(typeof mod.StdioServerTransport === 'function', 'StdioServerTransport should be a constructor');
});

test('zod resolves from adapter node_modules', async () => {
  const mod = await import('zod');
  assert.ok(typeof mod.z === 'object', 'z should be an object');
  assert.ok(typeof mod.z.object === 'function', 'z.object should be a function');
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
