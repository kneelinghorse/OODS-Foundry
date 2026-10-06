import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const adapterDirectory = path.dirname(fileURLToPath(import.meta.url));

function rpcClient(child) {
  let sequence = 0;
  let buffer = '';
  const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      const response = JSON.parse(line);
      const request = pending.get(response.id);
      if (!request) continue;
      pending.delete(response.id);
      clearTimeout(request.timer);
      if (response.error) request.reject(response.error);
      else request.resolve(response.result);
    }
  });
  return (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`No response for ${method}`));
    }, 5_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

test('s196 adapter 0.3 preserves native error fields through the actual tools/call transport', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s196-adapter-'));
  const adapterRoot = path.join(temporary, 'packages/mcp-adapter');
  const nativeDist = path.join(temporary, 'packages/mcp-server/dist');
  fs.mkdirSync(adapterRoot, { recursive: true });
  // s211-m03: the adapter reads its product name from product.json at start, so the copy carries it too.
  for (const file of ['index.js', 'node-floor.js', 'sanitize-schema.js', 'advertised-schema.js', 'tool-surface.json', 'mcp-apps.js', 'product.json', 'package.json']) {
    fs.copyFileSync(path.join(adapterDirectory, file), path.join(adapterRoot, file));
  }
  fs.symlinkSync(path.join(adapterDirectory, 'node_modules'), path.join(adapterRoot, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(adapterRoot, 'tool-descriptions.json'), '{}');
  for (const name of ['tools', 'security', 'schemas']) fs.mkdirSync(path.join(nativeDist, name), { recursive: true });
  fs.writeFileSync(path.join(nativeDist, 'tools/registry.json'), JSON.stringify({ auto: ['design.preview'], onDemand: [] }));
  fs.writeFileSync(path.join(nativeDist, 'security/policy.json'), '{"rules":[]}');
  fs.writeFileSync(path.join(nativeDist, 'schemas/generic.input.json'), '{"type":"object"}');
  fs.writeFileSync(path.join(temporary, 'packages/mcp-server/package.json'), '{"type":"module"}');
  // A native fixture controls the error operand; the real adapter and SDK handle
  // process framing and tools/call. This isolates field loss from handler behavior.
  fs.writeFileSync(path.join(nativeDist, 'index.js'), `
    import readline from 'node:readline';
    const lines = readline.createInterface({ input: process.stdin });
    lines.on('line', line => {
      const request = JSON.parse(line);
      const payload = request.input.error === undefined ? { result: request.input.result } : { error: request.input.error };
      process.stdout.write(JSON.stringify({ id: request.id, ...payload }) + '\\n');
    });
  `);
  const child = spawn(process.execPath, [path.join(adapterRoot, 'index.js')], {
    cwd: adapterRoot, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, OODS_NODE_PATH: process.execPath, MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: '' },
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  // s211-m03: an adapter that dies at start closes before the finally below runs; waiting on 'close' then hung this
  // test for two hours instead of failing it.
  let hasClosed = false;
  child.once('close', () => { hasClosed = true; });
  try {
    const request = rpcClient(child);
    const initialized = await request('initialize', {
      protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 's196-native-errors', version: '1.0.0' },
    });
    assert.equal(initialized.serverInfo.version, '0.4.2');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const call = argumentsValue => request('tools/call', { name: 'design_preview', arguments: argumentsValue });

    await t.test('current native ToolError retains code, nested details, incident id and promotes retryable/data', async () => {
      const native = {
        code: 'OODS-N019', message: 'Design loop server not running', incidentId: 'fixture-incident',
        details: { category: 'not_found', retryable: true, context: { command: 'pnpm design:loop serve', cwd: '/runtime' } },
      };
      const response = await call({ error: native });
      assert.equal(response.isError, true);
      assert.deepEqual(JSON.parse(response.content[0].text), {
        error: { ...native, retryable: true, data: native.details.context },
      });
      assert.equal(response.structuredContent, undefined);
    });

    await t.test('top-level retryable and data are preserved without replacing them with nested fields', async () => {
      const native = { code: 'OODS-N020', message: 'brand.apply: canonical source unavailable', retryable: false,
        data: { tool: 'brand.apply', dependency: 'canonical-brand-source' }, details: { retryable: true, context: { wrong: true } }, extra: ['retained'] };
      const response = await call({ error: native });
      assert.deepEqual(JSON.parse(response.content[0].text), { error: native });
      assert.equal(response.isError, true);
    });

    await t.test('explicit null data survives without silently falling back to details', async () => {
      const native = { code: 'OODS-N011', message: 'tokens.build output unavailable', retryable: false, data: null, details: { context: { wrong: true } } };
      assert.deepEqual(JSON.parse((await call({ error: native })).content[0].text), { error: native });
    });

    await t.test('legacy error strings retain actionable text without inventing a code', async () => {
      const response = await call({ error: 'legacy failure' });
      assert.equal(response.isError, true);
      assert.equal(response.content[0].text, 'Tool design_preview failed: legacy failure');
    });

    await t.test('native dependency errors containing ENOENT do not acquire misleading host build guidance', async () => {
      const native = { code: 'OODS-N020', message: 'brand.apply source unavailable (ENOENT)', retryable: false, data: { dependency: 'canonical-brand-source' } };
      const response = await call({ error: native });
      assert.deepEqual(JSON.parse(response.content[0].text), { error: native });
      assert.doesNotMatch(response.content[0].text, /To fix|mcp-server run build/);
    });

    await t.test('successful tool values and unregistered tool failures preserve their existing contracts', async () => {
      const value = { status: 'ok', artifacts: ['result.svg'] };
      const response = await call({ result: value });
      assert.equal(response.isError, undefined);
      assert.deepEqual(JSON.parse(response.content[0].text), value);
      const unknown = await request('tools/call', { name: 'missing_tool', arguments: {} });
      assert.equal(unknown.isError, true);
      assert.equal(unknown.content[0].text, 'Unknown tool: missing_tool');
    });
  } finally {
    const closed = hasClosed ? Promise.resolve() : once(child, 'close');
    child.stdin.end();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3_000);
    await closed;
    clearTimeout(timeout);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  assert.equal(child.exitCode, 0, stderr);
});
