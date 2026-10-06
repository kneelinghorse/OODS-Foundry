/**
 * s57-m05 adapter parity guards — code.generate React/Vue outputs
 *
 * Run manually:
 *   node packages/mcp-adapter/test-s57-m05.js
 */

import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADAPTER_ENTRY = path.join(__dirname, 'index.js');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'test', 'fixtures', 'ui');
const BASIC_SCHEMA = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'basic-mix.ui-schema.json'), 'utf8'));

const TIMEOUT_MS = 20000;

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

function jsonRpcRequest(method, params = {}, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

function startAdapter() {
  const child = spawn(process.execPath, [ADAPTER_ENTRY], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TOOLSET: 'all' },
  });
  return child;
}

async function waitForAdapterReady(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Adapter startup timeout')), TIMEOUT_MS);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('[oods-mcp-adapter]')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Adapter exited with code ${code}`));
    });
  });
}

function createClient(child) {
  let seq = 0;
  let buffer = '';
  const pending = new Map();

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.id == null) continue;
      const handler = pending.get(parsed.id);
      if (!handler) continue;
      pending.delete(parsed.id);
      if (parsed.error) handler.reject(parsed.error);
      else handler.resolve(parsed.result);
    }
  });

  const request = (method, params) => {
    const id = ++seq;
    const payload = jsonRpcRequest(method, params, id);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(payload, 'utf8');
    });
  };

  const callTool = async (name, args) => {
    const result = await request('tools/call', { name, arguments: args ?? {} });
    const text = result?.content?.[0]?.text ?? '';
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { result, text, parsed };
  };

  return { request, callTool };
}

function collectComponents(screens) {
  const components = new Set();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop();
    components.add(node.component);
    if (node.children) stack.push(...node.children);
  }
  return components;
}

function countNodes(screens) {
  let count = 0;
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop();
    count += 1;
    if (node.children) stack.push(...node.children);
  }
  return count;
}

async function run() {
  console.log('s57-m05 adapter parity guards\n');

  const child = startAdapter();
  await waitForAdapterReady(child);

  const client = createClient(child);

  await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 's57-m05-guards', version: '1.0.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const options = { styling: 'inline', typescript: true };
  const react = await client.callTool('code_generate', {
    schema: BASIC_SCHEMA,
    framework: 'react',
    options,
  });
  const vue = await client.callTool('code_generate', {
    schema: BASIC_SCHEMA,
    framework: 'vue',
    options,
  });

  const reactObj = react.parsed && typeof react.parsed === 'object' ? react.parsed : {};
  const vueObj = vue.parsed && typeof vue.parsed === 'object' ? vue.parsed : {};

  const components = collectComponents(BASIC_SCHEMA.screens);
  const nodeCount = countNodes(BASIC_SCHEMA.screens);

  test('code.generate React returns ok + meta counts', () => {
    assert.equal(reactObj.status, 'ok');
    assert.equal(reactObj.meta?.componentCount, components.size);
    assert.equal(reactObj.meta?.nodeCount, nodeCount);
  });

  test('code.generate Vue returns ok + meta counts', () => {
    assert.equal(vueObj.status, 'ok');
    assert.equal(vueObj.meta?.componentCount, components.size);
    assert.equal(vueObj.meta?.nodeCount, nodeCount);
  });

  test('React output has no triple braces', () => {
    assert.ok(
      !String(reactObj.code || '').includes('style={{{'),
      'Found style={{{ in generated React output'
    );
  });

  test('React and Vue outputs cover all components', () => {
    for (const component of components) {
      assert.ok(String(reactObj.code || '').includes(`<${component}`), `React missing <${component}`);
      assert.ok(String(vueObj.code || '').includes(`<${component}`), `Vue missing <${component}`);
    }
  });

  test('React and Vue outputs import real target packages and shared CSS', () => {
    assert.ok(String(reactObj.code || '').includes("from '@oods/components-react'"));
    assert.ok(String(vueObj.code || '').includes("from '@oods/components-vue'"));
    assert.ok(String(reactObj.code || '').includes("import '@oods/component-styles/css'"));
    assert.ok(String(vueObj.code || '').includes("import '@oods/component-styles/css'"));
    assert.ok(!String(reactObj.code || '').includes("from '@oods/components'"));
    assert.ok(!String(vueObj.code || '').includes("from '@oods/components'"));
  });

  test('legacy content props are normalized before adapter output', () => {
    assert.ok(String(reactObj.code || '').includes('content="Save"'));
    assert.ok(String(vueObj.code || '').includes('content="Save"'));
  });

  test('Vue output includes template + script blocks', () => {
    assert.ok(String(vueObj.code || '').includes('<template>'), 'Missing <template> block');
    assert.ok(String(vueObj.code || '').includes('<script setup'), 'Missing <script setup> block');
  });

  child.kill();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Guard test error:', err);
  process.exit(1);
});
