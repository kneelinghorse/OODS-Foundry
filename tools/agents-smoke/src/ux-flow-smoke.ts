import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type BridgeProcess = {
  child: ChildProcessWithoutNullStreams;
  port: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const ADAPTER_ENTRY = path.join(REPO_ROOT, 'packages', 'mcp-adapter', 'index.js');
const BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');
const REPORT_PATH = path.join(REPO_ROOT, 'cmos', 'reports', 's57-m08-smoke.md');

const TIMEOUT_MS = 20000;

function nowIso(): string {
  return new Date().toISOString();
}

function jsonRpcRequest(method: string, params: Record<string, unknown> = {}, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

function startAdapter() {
  const child = spawn(process.execPath, [ADAPTER_ENTRY], {
    cwd: path.dirname(ADAPTER_ENTRY),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TOOLSET: 'all' },
  });
  return child;
}

async function waitForAdapterReady(child: ChildProcessWithoutNullStreams) {
  return new Promise<void>((resolve, reject) => {
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

function createAdapterClient(child: ChildProcessWithoutNullStreams) {
  let seq = 0;
  let buffer = '';
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let parsed: any;
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

  const request = (method: string, params?: Record<string, unknown>) => {
    const id = ++seq;
    const payload = jsonRpcRequest(method, params ?? {}, id);
    return new Promise<any>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(payload, 'utf8');
    });
  };

  const callTool = async (name: string, args: Record<string, unknown>) => {
    const result = await request('tools/call', { name, arguments: args ?? {} });
    const text = result?.content?.[0]?.text ?? '';
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { result, parsed };
  };

  return { request, callTool };
}

async function runAdapterFlows() {
  const child = startAdapter();
  await waitForAdapterReady(child);

  const client = createAdapterClient(child);
  await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 's57-m08-smoke', version: '1.0.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const composeInput = {
    intent: 'Account detail view with tabs for Overview, Billing, Activity, Settings.',
    layout: 'detail',
    preferences: { tabCount: 4, tabLabels: ['Overview', 'Billing', 'Activity', 'Settings'] },
    options: { topN: 1 },
  };

  const compose = await client.callTool('design_compose', composeInput);
  const composeObj = compose.parsed && typeof compose.parsed === 'object' ? compose.parsed : {};

  const codegenDirect = await client.callTool('code_generate', {
    schema: composeObj.schema,
    framework: 'react',
    options: { styling: 'tokens', typescript: true },
  });

  const schemaRef = composeObj.schemaRef;
  const validate = await client.callTool('repl_validate', { mode: 'full', schemaRef });
  const render = await client.callTool('repl_render', { mode: 'full', schemaRef, apply: true });
  const codegenRef = await client.callTool('code_generate', { schemaRef, framework: 'react' });

  child.kill();

  return {
    composeStatus: composeObj.status,
    schemaRef: schemaRef ?? null,
    directCodeStatus: codegenDirect.parsed?.status,
    directCodeLength: codegenDirect.parsed?.code?.length ?? 0,
    validateStatus: validate.parsed?.status,
    renderStatus: render.parsed?.status,
    renderHtmlLength: render.parsed?.html?.length ?? 0,
    refCodeStatus: codegenRef.parsed?.status,
    refCodeLength: codegenRef.parsed?.code?.length ?? 0,
  };
}

async function startBridge(): Promise<BridgeProcess> {
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: BRIDGE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_BRIDGE_PORT: '0',
    },
  });
  child.stdout.setEncoding('utf8');

  return await new Promise<BridgeProcess>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for bridge startup')), TIMEOUT_MS);
    child.stdout.on('data', (chunk: string) => {
      const match = chunk.match(/\[mcp-bridge\] listening on :(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve({ child, port: Number(match[1]) });
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Bridge exited before startup (code=${String(code)})`));
    });
  });
}

async function stopBridge(proc: BridgeProcess) {
  proc.child.kill('SIGTERM');
  await once(proc.child, 'close');
}

async function runBridgeTool(port: number, tool: string, input: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

async function runBridgeFlows() {
  const bridge = await startBridge();
  try {
    const composeInput = {
      intent: 'Account detail view with tabs for Overview, Billing, Activity, Settings.',
      layout: 'detail',
      preferences: { tabCount: 4, tabLabels: ['Overview', 'Billing', 'Activity', 'Settings'] },
      options: { topN: 1 },
    };

    const compose = await runBridgeTool(bridge.port, 'design_compose', composeInput);
    const codegenDirect = await runBridgeTool(bridge.port, 'code_generate', {
      schema: compose.schema,
      framework: 'react',
      options: { styling: 'tokens', typescript: true },
    });

    const schemaRef = compose.schemaRef;
    const validate = await runBridgeTool(bridge.port, 'repl_validate', { mode: 'full', schemaRef });
    const render = await runBridgeTool(bridge.port, 'repl_render', { mode: 'full', schemaRef, apply: true });
    const codegenRef = await runBridgeTool(bridge.port, 'code_generate', { schemaRef, framework: 'react' });

    return {
      composeStatus: compose.status,
      schemaRef: schemaRef ?? null,
      directCodeStatus: codegenDirect.status,
      directCodeLength: codegenDirect.code?.length ?? 0,
      validateStatus: validate.status,
      renderStatus: render.status,
      renderHtmlLength: render.html?.length ?? 0,
      refCodeStatus: codegenRef.status,
      refCodeLength: codegenRef.code?.length ?? 0,
    };
  } finally {
    await stopBridge(bridge);
  }
}

function formatSection(title: string, data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([key, value]) => `- ${key}: ${String(value)}`);
  return [`### ${title}`, '', ...lines, ''].join('\n');
}

async function main() {
  const startedAt = nowIso();
  const adapter = await runAdapterFlows();
  const bridge = await runBridgeFlows();
  const finishedAt = nowIso();

  const content = [
    '# Sprint 57 UX Flow Smoke (Adapter + Bridge)',
    '',
    `- Started: ${startedAt}`,
    `- Finished: ${finishedAt}`,
    '',
    formatSection('Adapter Flow Results', adapter),
    formatSection('Bridge Flow Results', bridge),
    'Notes:',
    '- Adapter path uses stdio MCP adapter (packages/mcp-adapter).',
    '- Bridge path uses HTTP MCP bridge (packages/mcp-bridge).',
    '',
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, content, 'utf8');
  process.stdout.write(`Smoke report written to ${REPORT_PATH}\n`);
}

main().catch((error) => {
  process.stderr.write(`ux-flow-smoke failed: ${(error as Error).message}\n`);
  process.exit(1);
});
