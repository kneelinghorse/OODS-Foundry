import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const ADAPTER_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADAPTER_ENTRY = path.join(ADAPTER_DIR, 'index.js');

function createClient(child) {
  let sequence = 0;
  let buffer = '';
  const pending = new Map();

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!line) continue;
      const response = JSON.parse(line);
      const request = pending.get(response.id);
      if (!request) continue;
      pending.delete(response.id);
      clearTimeout(request.timer);
      if (response.error) request.reject(response.error);
      else request.resolve(response.result);
    }
  });

  return {
    request(method, params) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }, 15_000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, 'utf8');
      });
    },
  };
}

function killAdapterTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
      return;
    } catch {
      // Fall through to the direct-child kill when no process group exists.
    }
  }
  child.kill('SIGKILL');
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      killAdapterTree(child);
      reject(new Error(`Adapter remained alive ${timeoutMs}ms after stdin EOF`));
    }, timeoutMs);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

test('stdin EOF after a native health call closes the child and exits cleanly', async () => {
  const child = spawn(process.execPath, [ADAPTER_ENTRY], {
    cwd: ADAPTER_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      MCP_HEALTH_PORT: '0',
      OODS_OTLP_ENDPOINT: '',
    },
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  try {
    const client = createClient(child);
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 's181-lifecycle-test', version: '1.0.0' },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`, 'utf8');

    const healthResponse = await client.request('tools/call', {
      name: 'health',
      arguments: {},
    });
    const health = JSON.parse(healthResponse.content[0].text);
    assert.match(health.status, /^(?:ok|degraded)$/);

    child.stdin.end();
    const exited = await waitForExit(child, 3_000);
    assert.deepEqual(exited, { code: 0, signal: null });
  } finally {
    killAdapterTree(child);
  }

  assert.match(stderr, /\[oods-mcp-adapter] v\d+\.\d+\.\d+/);
});
