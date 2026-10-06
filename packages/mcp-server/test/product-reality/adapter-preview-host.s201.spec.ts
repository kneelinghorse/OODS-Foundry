import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The stdio adapter starts the preview host lazily for design.preview, reports its port in the
 * tool result, keeps stdout for JSON-RPC, and stops the host when it stops. Runs the real adapter
 * against the built server and bridge dist; a missing build is a failure, not a skip.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const adapter = path.join(root, 'packages/mcp-adapter/index.js');
const children: ChildProcessWithoutNullStreams[] = [];
const stores: string[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise(resolve => child.once('close', resolve)); }
  for (const dir of stores.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

class Rpc {
  readonly child: ChildProcessWithoutNullStreams;
  readonly stderr: string[] = [];
  private buffer = '';
  private next = 1;
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  constructor(env: NodeJS.ProcessEnv) {
    this.child = spawn(process.execPath, [adapter], { cwd: path.dirname(adapter), env, stdio: ['pipe', 'pipe', 'pipe'] });
    children.push(this.child);
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', chunk => this.stderr.push(String(chunk)));
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      let index: number;
      while ((index = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, index).trim(); this.buffer = this.buffer.slice(index + 1);
        if (!line) continue;
        // Every stdout line is JSON-RPC: the preview host must never write here.
        const message = JSON.parse(line);
        const waiting = this.pending.get(message.id);
        if (waiting) { this.pending.delete(message.id); message.error ? waiting.reject(new Error(JSON.stringify(message.error))) : waiting.resolve(message.result); }
      }
    });
  }
  request(method: string, params: Record<string, unknown> = {}, timeoutMs = 120_000): Promise<any> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  notify(method: string, params: Record<string, unknown> = {}) { this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); }
  async call(name: string, args: Record<string, unknown>) {
    const result = await this.request('tools/call', { name, arguments: args });
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  }
  exit(): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    return new Promise(resolve => { this.child.once('close', (code, signal) => resolve({ code, signal })); this.child.stdin.end(); });
  }
}

const portClosed = (port: number) => new Promise<boolean>(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port });
  socket.once('connect', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(true));
});

describe('the stdio adapter hosts the running-app preview (s201-m01)', () => {
  it('starts the host only when design_preview is called, reports its port, keeps stdout for JSON-RPC and stops it with the adapter', async () => {
    for (const built of ['packages/mcp-server/dist/index.js', 'packages/mcp-bridge/dist/preview/standalone.js', 'packages/mcp-bridge/dist/preview-runtime/manifest.json']) {
      expect(fs.existsSync(path.join(root, built)), `${built} must be built`).toBe(true);
    }
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-adapter-preview-'));
    stores.push(store);
    const env: NodeJS.ProcessEnv = { ...process.env, MCP_SCHEMA_STORE_ROOT: store, MCP_SCHEMA_STORE_DIR: 'schemas' };
    delete env.OODS_PREVIEW_HOST_URL;
    const rpc = new Rpc(env);
    const initialized = await rpc.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 's201-adapter-spec', version: '0.0.0' } });
    expect(initialized.serverInfo).toEqual({ name: 'oods-foundry-adapter', version: '0.7.0' });
    rpc.notify('notifications/initialized');
    const listed = await rpc.request('tools/list', {});
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain('design_preview');
    expect(listed.tools).toHaveLength(19);
    // s229: clients must receive the new source forms through the real adapter, not only native AJV.
    expect(JSON.stringify(listed.tools.find((tool: any) => tool.name === 'component_map').inputSchema)).toContain('shadcn');
    expect(JSON.stringify(listed.tools.find((tool: any) => tool.name === 'brand_create').inputSchema)).toContain('cssPath');
    const health = await rpc.call('health_check', {});
    expect(health.status).toBe('ok');
    // Lazy: nothing about a preview host has happened yet.
    expect(rpc.stderr.join('')).not.toContain('preview host started');
    expect(fs.existsSync(path.join(store, 'compositions'))).toBe(false);

    const preview = await rpc.call('design_preview', { object: 'Subscription', context: 'card', framework: 'react' });
    expect(preview.status).toBe('ok');
    expect(Number.isInteger(preview.host.port) && preview.host.port > 0).toBe(true);
    expect(preview.host.url).toBe(`http://127.0.0.1:${preview.host.port}`);
    expect(preview.compositionId).toMatch(/^cmp-[a-f0-9]{12}$/);
    expect(preview.previewUrl).toBe(`${preview.host.url}/preview/${preview.compositionId}/1?framework=react&brand=A&theme=light`);
    expect(preview.host.compositionsDir).toBe(path.join(store, 'compositions'));
    expect(rpc.stderr.join('')).toContain(`preview host started on ${preview.host.url}`);
    const page = await fetch(preview.previewUrl);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('data-oods-lineage="true"');
    const app = await fetch(preview.previews[0].appUrl);
    expect(await app.text()).toContain(`data-oods-preview="${preview.compositionId}" data-oods-preview-version="1"`);
    const status = await (await fetch(`${preview.host.url}/preview/status`)).json();
    expect(status).toMatchObject({ running: true, compositionsDir: path.join(store, 'compositions'), platform: { supported: true } });

    // A second call reuses the same host.
    const again = await rpc.call('design_preview', { compositionId: preview.compositionId, framework: 'vue' });
    expect(again.host.port).toBe(preview.host.port);
    expect(again.version).toBe(1);
    expect(rpc.stderr.join('').match(/preview host started/g)).toHaveLength(1);

    const exit = await rpc.exit();
    expect(exit.code).toBe(0);
    expect(await portClosed(preview.host.port)).toBe(true);
  }, 180_000);
});
