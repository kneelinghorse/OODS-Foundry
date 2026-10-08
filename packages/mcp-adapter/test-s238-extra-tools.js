import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The README and every client list the on-demand tool as a11y_scan. Before 0.10.1 MCP_EXTRA_TOOLS took only the
// internal a11y.scan, so a user who wrote the listed name got nothing and no message. Both names must work, and a
// name that matches nothing must be reported rather than ignored.

const adapterDirectory = path.dirname(fileURLToPath(import.meta.url));

function adapterCopy(native = "process.stdin.resume();\n") {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s238-extras-'));
  const adapterRoot = path.join(temporary, 'packages/mcp-adapter');
  const nativeDist = path.join(temporary, 'packages/mcp-server/dist');
  fs.mkdirSync(adapterRoot, { recursive: true });
  for (const file of ['index.js', 'node-floor.js', 'sanitize-schema.js', 'advertised-schema.js', 'tool-surface.json', 'mcp-apps.js', 'product.json', 'package.json']) {
    fs.copyFileSync(path.join(adapterDirectory, file), path.join(adapterRoot, file));
  }
  fs.symlinkSync(path.join(adapterDirectory, 'node_modules'), path.join(adapterRoot, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(adapterRoot, 'tool-descriptions.json'), '{}');
  for (const name of ['tools', 'security', 'schemas']) fs.mkdirSync(path.join(nativeDist, name), { recursive: true });
  fs.writeFileSync(path.join(nativeDist, 'tools/registry.json'), JSON.stringify({ auto: ['health'], onDemand: ['a11y.scan'] }));
  fs.writeFileSync(path.join(nativeDist, 'security/policy.json'), '{"rules":[]}');
  fs.writeFileSync(path.join(nativeDist, 'schemas/generic.input.json'), '{"type":"object"}');
  fs.writeFileSync(path.join(temporary, 'packages/mcp-server/package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(nativeDist, 'index.js'), native);
  return { temporary, adapterRoot };
}

async function listedTools(extras, { native, call } = {}) {
  const { temporary, adapterRoot } = adapterCopy(native);
  const child = spawn(process.execPath, [path.join(adapterRoot, 'index.js')], {
    cwd: adapterRoot, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, OODS_NODE_PATH: process.execPath, MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: extras },
  });
  let stderr = '';
  let buffer = '';
  const responses = new Map();
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.trim()) { const message = JSON.parse(line); responses.get(message.id)?.(message); }
    }
  });
  const request = (id, method, params) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response for ${method}; stderr: ${stderr}`)), 10_000);
    responses.set(id, message => { clearTimeout(timer); resolve(message.result); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    const { serverInfo } = await request(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 's238-extras', version: '1.0.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const { tools } = await request(2, 'tools/list', {});
    const called = call ? await request(3, 'tools/call', call) : undefined;
    return { names: tools.map(tool => tool.name).sort(), stderr, serverInfo, called };
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test('MCP_EXTRA_TOOLS accepts the listed name a11y_scan', async () => {
  const { names } = await listedTools('a11y_scan');
  assert.deepEqual(names, ['a11y_scan', 'health_check']);
});

test('MCP_EXTRA_TOOLS still accepts the internal name a11y.scan, once', async () => {
  const { names } = await listedTools('a11y.scan,a11y_scan');
  assert.deepEqual(names, ['a11y_scan', 'health_check']);
});

test('MCP_EXTRA_TOOLS reports a name that matches no on-demand tool', async () => {
  const { names, stderr } = await listedTools('a11y_scanner');
  assert.deepEqual(names, ['health_check']);
  assert.match(stderr, /MCP_EXTRA_TOOLS: "a11y_scanner" is not an on-demand tool; on-demand tools: a11y_scan/);
});

test('serverInfo carries the product title, website and the square icon the registry entry declares', async () => {
  const { serverInfo } = await listedTools('');
  assert.equal(serverInfo.title, 'OODS Foundry');
  assert.equal(serverInfo.websiteUrl, 'https://oods-foundry.com/');
  assert.deepEqual(serverInfo.icons, [{ src: 'https://oods-foundry.com/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] }]);
});

// The native server sizes a reply only when the envelope says it goes to an MCP client; the HTTP bridge never sets it.
test('every MCP tool call tells the native server that its reply goes to an MCP client', async () => {
  const echo = "import readline from 'node:readline';\nreadline.createInterface({ input: process.stdin }).on('line', line => { const request = JSON.parse(line); process.stdout.write(JSON.stringify({ id: request.id, result: { context: request.context ?? null } }) + '\\n'); });\n";
  const { called } = await listedTools('', { native: echo, call: { name: 'health_check', arguments: {} } });
  assert.deepEqual(JSON.parse(called.content[0].text), { context: { sizedReply: true } });
});
