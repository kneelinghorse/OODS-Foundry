import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The stdio adapter speaks MCP Apps (s202-m02): the resources capability, the io.modelcontextprotocol/ui
 * negotiation read from the raw initialize request, _meta.ui.resourceUri on design_preview only when negotiated,
 * structuredContent beside the unchanged text, the versioned ui:// resources. Runs the real adapter against the
 * built server and bridge dist; a missing build (including the preview app) is a failure, not a skip.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const adapter = path.join(root, 'packages/mcp-adapter/index.js');
const UI_EXTENSION = 'io.modelcontextprotocol/ui';
const APP_MIME = 'text/html;profile=mcp-app';
const children: ChildProcessWithoutNullStreams[] = [];
const stores: string[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise(resolve => child.once('close', resolve)); }
  for (const dir of stores.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

class Rpc {
  readonly child: ChildProcessWithoutNullStreams;
  readonly stderr: string[] = [];
  readonly nonJson: string[] = [];
  private buffer = '';
  private next = 1;
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>();
  constructor(env: NodeJS.ProcessEnv) {
    this.child = spawn(process.execPath, [adapter], { cwd: path.dirname(adapter), env, stdio: ['pipe', 'pipe', 'pipe'] });
    children.push(this.child);
    this.child.stdout.setEncoding('utf8'); this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', chunk => this.stderr.push(String(chunk)));
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      let index: number;
      while ((index = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, index).trim(); this.buffer = this.buffer.slice(index + 1);
        if (!line) continue;
        let message: any;
        try { message = JSON.parse(line); } catch { this.nonJson.push(line); continue; }
        const waiting = this.pending.get(message.id);
        if (waiting) { this.pending.delete(message.id); message.error ? waiting.reject(message.error) : waiting.resolve(message.result); }
      }
    });
  }
  request(method: string, params: Record<string, unknown> = {}, timeoutMs = 180_000): Promise<any> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  notify(method: string, params: Record<string, unknown> = {}) { this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); }
  async initialize(capabilities: Record<string, unknown>) {
    const result = await this.request('initialize', { protocolVersion: '2025-06-18', capabilities, clientInfo: { name: 'adapter-mcp-apps-spec', version: '1' } });
    this.notify('notifications/initialized');
    return result;
  }
  receipt(): string { return this.stderr.join('').split('\n').find(line => line.includes('MCP Apps')) ?? ''; }
  exit(): Promise<{ code: number | null }> { return new Promise(resolve => { this.child.once('close', code => resolve({ code })); this.child.stdin.end(); }); }
}
const store = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-adapter-apps-')); stores.push(dir); return { ...process.env, MCP_SCHEMA_STORE_ROOT: dir, MCP_SCHEMA_STORE_DIR: 'schemas' }; };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('the stdio adapter speaks MCP Apps (s202-m02)', () => {
  it('keeps the Sprint 201 surface for a client that does not advertise the extension: 20 tools, no _meta.ui, the text result, and says so on stderr', async () => {
    for (const built of ['packages/mcp-server/dist/index.js', 'packages/mcp-bridge/dist/preview/standalone.js', 'packages/mcp-bridge/dist/preview-app/app.html']) expect(fs.existsSync(path.join(root, built)), `${built} must be built`).toBe(true);
    const rpc = new Rpc(store());
    const initialized = await rpc.initialize({});
    expect(initialized.serverInfo).toEqual({ name: 'oods-foundry-adapter', version: JSON.parse(fs.readFileSync(path.join(root, 'packages/mcp-adapter/package.json'), 'utf8')).version, title: 'OODS Foundry', websiteUrl: 'https://oods-foundry.com/', icons: [{ src: 'https://oods-foundry.com/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] }] });
    expect(initialized.capabilities).toEqual({ tools: {}, resources: {}, extensions: { [UI_EXTENSION]: {} } });
    const { tools } = await rpc.request('tools/list');
    expect(tools).toHaveLength(20);
    expect(tools.every((tool: { _meta?: unknown }) => tool._meta === undefined)).toBe(true);
    // The listed resource exists for every client; only the tool's pointer is negotiated.
    const { resources } = await rpc.request('resources/list');
    expect(resources.filter((resource: { mimeType: string }) => resource.mimeType === APP_MIME)).toHaveLength(1);
    expect(resources.filter((resource: { uri: string }) => resource.uri.startsWith('oods://schemas/'))).toHaveLength(20);
    expect(resources[0]).toMatchObject({ mimeType: APP_MIME, name: 'OODS Foundry design preview', title: 'OODS Foundry design preview' });
    expect(resources[0].uri).toMatch(/^ui:\/\/oods-forge\/preview\/[a-f0-9]{12}\/app\.html$/);
    const result = await rpc.request('tools/call', { name: 'design_preview', arguments: { object: 'Subscription', context: 'card' } });
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toMatchObject({ status: 'ok', action: 'render', version: 1 });
    // structuredContent carries the same result without resource URIs: nothing was offered.
    expect(result.structuredContent).toEqual(parsed);
    expect(result.structuredContent.resources).toBeUndefined();
    expect(rpc.receipt()).toMatch(/client adapter-mcp-apps-spec 1 .*not advertised.*kept as the text result/);
    expect(rpc.nonJson).toEqual([]);
    expect((await rpc.exit()).code).toBe(0);
  }, 240_000);

  it('offers the preview app to a client that advertised the extension: _meta.ui.resourceUri on design_preview, structuredContent with resource URIs, and readable ui:// resources', async () => {
    const rpc = new Rpc(store());
    await rpc.initialize({ extensions: { [UI_EXTENSION]: { mimeTypes: [APP_MIME] } } });
    const { tools } = await rpc.request('tools/list');
    expect(tools).toHaveLength(20);
    const preview = tools.find((tool: { name: string }) => tool.name === 'design_preview');
    const { resources } = await rpc.request('resources/list');
    const appUri: string = resources[0].uri;
    expect(preview._meta).toEqual({ ui: { resourceUri: appUri }, 'ui/resourceUri': appUri });
    expect(tools.filter((tool: { _meta?: unknown }) => tool._meta !== undefined)).toHaveLength(1);
    // The app resource: self-contained, no CSP of its own, its revision is its content hash.
    const app = await rpc.request('resources/read', { uri: appUri });
    expect(app.contents[0]).toMatchObject({ uri: appUri, mimeType: APP_MIME });
    const html: string = app.contents[0].text;
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/Content-Security-Policy/i);
    expect(html).not.toMatch(/\ssrc="https?:|\shref="https?:/);
    expect(appUri).toBe(`ui://oods-forge/preview/${sha256(html).slice(0, 12)}/app.html`);
    expect(html).toBe(fs.readFileSync(path.join(root, 'packages/mcp-bridge/dist/preview-app/app.html'), 'utf8'));
    // A stale revision (a host cache after an update) is refused with the reload advice, not served silently.
    await expect(rpc.request('resources/read', { uri: 'ui://oods-forge/preview/000000000000/app.html' })).rejects.toMatchObject({ code: -32602, message: expect.stringMatching(/Reload the MCP configuration/) });
    await expect(rpc.request('resources/read', { uri: 'ui://oods-forge/elsewhere' })).rejects.toMatchObject({ code: -32602 });
    // The tool result: the text is what every client gets; structuredContent adds the resource URIs.
    const result = await rpc.request('tools/call', { name: 'design_preview', arguments: { object: 'Subscription', context: 'detail' } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.previews.map((entry: { framework: string }) => entry.framework)).toEqual(['react', 'vue']);
    const { resources: offered, ...rest } = result.structuredContent;
    expect(rest).toEqual(parsed);
    const base = `ui://oods-forge/compositions/${parsed.compositionId}/${parsed.version}/`;
    expect(offered).toEqual({ app: appUri, record: `${base}record.json`, versions: `ui://oods-forge/compositions/${parsed.compositionId}/versions.json`, modules: { react: `${base}react.js?brand=A&theme=light`, vue: `${base}vue.js?brand=A&theme=light` }, styles: { react: `${base}react.css?brand=A&theme=light`, vue: `${base}vue.css?brand=A&theme=light` },
      // s213-m04: the token build's brands and CSS, read live (the app carries neither).
      tokens: 'ui://oods-forge/tokens.json' });
    // The version record and the lineage list are readable too: what the app needs to mount and to show lineage.
    const record = await rpc.request('resources/read', { uri: offered.record });
    expect(record.contents[0]).toMatchObject({ uri: offered.record, mimeType: 'application/json' });
    expect(JSON.parse(record.contents[0].text)).toMatchObject({ compositionId: parsed.compositionId, version: 1, artifacts: { react: {}, vue: {} } });
    const versions = await rpc.request('resources/read', { uri: offered.versions });
    expect(JSON.parse(versions.contents[0].text)).toMatchObject({ compositionId: parsed.compositionId, versions: [{ version: 1 }] });
    // The compiled module resource is the iife the app injects as an inline script; the styles are the artifact's own.
    const module = await rpc.request('resources/read', { uri: offered.modules.react });
    expect(module.contents[0]).toMatchObject({ uri: offered.modules.react, mimeType: 'text/javascript' });
    // esbuild's dotted global: `var __oodsModules; (__oodsModules ||= {}).m_<hash> = (() => { … })();`
    expect(module.contents[0].text).toMatch(/^var __oodsModules;\s*\(__oodsModules \|\|= \{\}\)\.m_[a-f0-9]{16} = /);
    expect(module.contents[0].text).toContain('globalThis.__oodsRuntime');
    expect(module.contents[0].text).not.toMatch(/^import /m);
    const vue = await rpc.request('resources/read', { uri: `${base}vue.js` });
    expect(vue.contents[0].text).toMatch(/^var __oodsModules/);
    const styles = await rpc.request('resources/read', { uri: offered.styles.react });
    expect(styles.contents[0]).toMatchObject({ mimeType: 'text/css', text: '' });
    // s213-m04: the adapter checks a brand's shape only; the host refuses a brand the token build does not carry, naming them.
    await expect(rpc.request('resources/read', { uri: `${base}react.js?brand=C` })).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('brand must be one of A, B (the token build\'s brands); "C" is not built.') });
    await expect(rpc.request('resources/read', { uri: `ui://oods-forge/compositions/cmp-ffffffffffff/1/react.js` })).rejects.toMatchObject({ code: -32602 });
    expect(rpc.receipt()).toMatch(/negotiated \(mimeTypes \["text\/html;profile=mcp-app"\]\).*offered on design_preview/);
    expect(rpc.nonJson).toEqual([]);
    expect((await rpc.exit()).code).toBe(0);
  }, 240_000);

  it('OODS_MCP_APPS_UI=1 offers the app to a client that did not advertise the extension, and says so', async () => {
    const rpc = new Rpc({ ...store(), OODS_MCP_APPS_UI: '1' });
    await rpc.initialize({});
    const { tools } = await rpc.request('tools/list');
    const preview = tools.find((tool: { name: string }) => tool.name === 'design_preview');
    expect(preview._meta?.ui?.resourceUri).toMatch(/^ui:\/\/oods-forge\/preview\//);
    expect(rpc.receipt()).toMatch(/OODS_MCP_APPS_UI=1 forces the preview app/);
    expect((await rpc.exit()).code).toBe(0);
  }, 120_000);
});
