/**
 * The reference host (Sprint 202 m02): Chromium renders an MCP App resource from the real stdio adapter under the
 * spec's default CSP, in the double iframe (host page and sandbox page on two 127.0.0.1 origins), with the SDK's
 * app-bridge 1.7.5 as the host side. tools/call and resources/read from the app reach the adapter through a JSON-RPC
 * relay over stdio. Every conversation act the app performs is recorded; console errors and securitypolicyviolation
 * events are counted. This is the local gate for the conversation surface; a real host run is Derek's.
 *
 *   pnpm exec tsx scripts/product-reality/s202-reference-host.ts [--out artifacts/product-reality/sprint-202/m02/reference-host]
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Frame, type Page } from 'playwright';

export type Json = Record<string, unknown>;
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const ADAPTER = path.join(ROOT, 'packages/mcp-adapter/index.js');
export const UI_EXTENSION = 'io.modelcontextprotocol/ui';
export const APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const MCP_PROTOCOL_VERSION = '2025-06-18';
/** The default CSP the specification applies when the resource declares none. */
export const DEFAULT_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'";

/** The CSP header for the sandbox page: the default, widened only by the domains a resource declared. */
export function cspHeader(csp?: { connectDomains?: string[]; resourceDomains?: string[]; frameDomains?: string[]; baseUriDomains?: string[] }): string {
  if (!csp) return DEFAULT_CSP;
  const list = (domains?: string[]) => (domains ?? []).map(domain => domain.trim()).filter(Boolean).join(' ');
  const resources = list(csp.resourceDomains);
  const frames = list(csp.frameDomains);
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline'${resources ? ` ${resources}` : ''}`,
    `style-src 'self' 'unsafe-inline'${resources ? ` ${resources}` : ''}`,
    `img-src 'self' data:${resources ? ` ${resources}` : ''}`,
    `font-src 'self' data:${resources ? ` ${resources}` : ''}`,
    `media-src 'self' data:${resources ? ` ${resources}` : ''}`,
    `connect-src ${list(csp.connectDomains) || "'none'"}`,
    `frame-src ${frames || "'none'"}`,
    `base-uri ${list(csp.baseUriDomains) || "'none'"}`,
  ].join('; ');
}

/** A JSON-RPC client over the adapter's stdio; stdout must carry JSON-RPC only. */
export class AdapterRpc {
  readonly child: ChildProcessWithoutNullStreams;
  readonly stderr: string[] = [];
  readonly nonJson: string[] = [];
  private buffer = '';
  private next = 1;
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  constructor(env: NodeJS.ProcessEnv, adapter = ADAPTER) {
    this.child = spawn(process.execPath, [adapter], { cwd: path.dirname(adapter), env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
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
        if (waiting) { this.pending.delete(message.id); message.error ? waiting.reject(Object.assign(new Error(JSON.stringify(message.error)), { rpcError: message.error })) : waiting.resolve(message.result); }
      }
    });
    this.child.on('exit', () => { for (const waiting of this.pending.values()) waiting.reject(new Error('adapter exited')); this.pending.clear(); });
  }
  request(method: string, params: Json = {}, timeoutMs = 180_000): Promise<any> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  notify(method: string, params: Json = {}) { this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); }
  /** The adapter's stderr lines naming the client and the negotiation (the receipt a real host session leaves). */
  negotiationReceipt(): string | undefined { return this.stderr.join('').split('\n').find(line => line.includes('MCP Apps')); }
  async close(): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    if (this.child.exitCode !== null) return { code: this.child.exitCode, signal: null };
    return new Promise(resolve => { const timer = setTimeout(() => this.child.kill('SIGKILL'), 5_000); this.child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); }); this.child.stdin.end(); });
  }
}

const serve = (html: string, headers: Record<string, string> = {}) => new Promise<{ server: http.Server; url: string }>(resolve => {
  const server = http.createServer((request, reply) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/' && url.pathname !== '/index.html' && url.pathname !== '/sandbox.html' && url.pathname !== '/host.html') { reply.writeHead(404); reply.end(); return; }
    const extra: Record<string, string> = { ...headers };
    if (headers['Content-Security-Policy'] !== undefined && url.searchParams.get('csp')) extra['Content-Security-Policy'] = cspHeader(JSON.parse(url.searchParams.get('csp')!));
    reply.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra });
    reply.end(html);
  });
  server.listen(0, '127.0.0.1', () => { const address = server.address() as { port: number }; resolve({ server, url: `http://127.0.0.1:${address.port}` }); });
});

let hostBundle: Promise<string> | undefined;
/** The host page: the SDK's app-bridge and the host logic, bundled once per process from reference-host/host.ts. */
export function hostPageHtml(): Promise<string> {
  hostBundle ??= (async () => {
    const require = createRequire(path.join(ROOT, 'packages/mcp-bridge/package.json'));
    const esbuild = require('esbuild') as typeof import('esbuild');
    const result = await esbuild.build({ entryPoints: [path.join(here, 'reference-host/host.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', logLevel: 'silent', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' } });
    const script = result.outputFiles[0]!.text;
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>OODS reference host</title><style>html,body{margin:0;background:#f4f4f5;font:14px system-ui,sans-serif}#host{padding:16px}</style></head><body><div id="host"></div><script>${script}</script></body></html>`;
  })();
  return hostBundle;
}

export interface RenderedApp {
  tool: Json;
  resourceUri: string;
  resource: { mimeType: string; text: string; _meta?: Json };
  result: Json;
  appFrame: Frame;
  sandboxFrame: Frame;
}

export interface ReferenceHostOptions {
  /** Environment for the adapter (store root and dir, PATH…); defaults to this process' with a fresh temporary store. */
  adapterEnv?: NodeJS.ProcessEnv;
  /** Advertise the extension in initialize (default true); false proves the fallback path. */
  negotiate?: boolean;
  hostContext?: Json;
  browser?: Browser;
  headless?: boolean;
}

/** One reference host: an adapter over stdio, the two origins, a page, and the records every act leaves. */
export class ReferenceHost {
  readonly events: Json[] = [];
  readonly consoleErrors: Array<{ text: string; url: string }> = [];
  readonly pageErrors: string[] = [];
  readonly cspViolations: Json[] = [];
  readonly hostContext: Json;
  initialized: Json | null = null;
  private readonly ownsBrowser: boolean;
  private constructor(readonly rpc: AdapterRpc, readonly hostServer: http.Server, readonly hostUrl: string, readonly sandboxServer: http.Server, readonly sandboxUrl: string, readonly browser: Browser, readonly page: Page, readonly negotiate: boolean, hostContext: Json, ownsBrowser: boolean, readonly storeRoot: string | null) {
    this.hostContext = hostContext; this.ownsBrowser = ownsBrowser;
  }

  static async open(options: ReferenceHostOptions = {}): Promise<ReferenceHost> {
    const storeRoot = options.adapterEnv ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'oods-reference-host-'));
    const env = options.adapterEnv ?? { ...process.env, MCP_SCHEMA_STORE_ROOT: storeRoot!, MCP_SCHEMA_STORE_DIR: 'schemas' };
    const rpc = new AdapterRpc(env);
    const host = await serve(await hostPageHtml());
    const sandboxHtml = fs.readFileSync(path.join(here, 'reference-host/sandbox.html'), 'utf8');
    const sandbox = await serve(sandboxHtml, { 'Content-Security-Policy': DEFAULT_CSP });
    const browser = options.browser ?? await chromium.launch({ headless: options.headless ?? true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, locale: 'en-US', timezoneId: 'UTC' });
    const hostContext: Json = { theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'], containerDimensions: { width: 900, maxHeight: 700 }, locale: 'en-US', timeZone: 'UTC', platform: 'web', ...(options.hostContext ?? {}) };
    const instance = new ReferenceHost(rpc, host.server, host.url, sandbox.server, sandbox.url, browser, page, options.negotiate ?? true, hostContext, !options.browser, storeRoot);
    page.on('console', message => { if (message.type() === 'error') instance.consoleErrors.push({ text: message.text(), url: message.location().url }); });
    page.on('pageerror', error => instance.pageErrors.push(error.message));
    await page.exposeFunction('__mcp', (method: string, params: Json) => rpc.request(method, params));
    await page.exposeFunction('__record', (event: Json) => { if (event.kind === 'csp-violation') instance.cspViolations.push(event); instance.events.push(event); });
    await page.goto(`${host.url}/host.html`, { waitUntil: 'load' });
    instance.initialized = await rpc.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: instance.negotiate ? { extensions: { [UI_EXTENSION]: { mimeTypes: [APP_MIME_TYPE] } } } : {},
      clientInfo: { name: 'oods-reference-host', version: '0.1.0' },
    });
    rpc.notify('notifications/initialized');
    return instance;
  }

  listTools(): Promise<{ tools: Json[] }> { return this.rpc.request('tools/list', {}); }
  listResources(): Promise<{ resources: Json[] }> { return this.rpc.request('resources/list', {}); }
  readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; _meta?: Json }> }> { return this.rpc.request('resources/read', { uri }); }
  callTool(name: string, args: Json): Promise<Json> { return this.rpc.request('tools/call', { name, arguments: args }); }

  /** What the tool definition points at, or undefined when the adapter kept the text result (not negotiated). */
  static resourceUriOf(tool: Json): string | undefined {
    const meta = tool._meta as { ui?: { resourceUri?: string }; 'ui/resourceUri'?: string } | undefined;
    return meta?.ui?.resourceUri ?? meta?.['ui/resourceUri'];
  }

  /** Render a tool's app: list, read the resource, call the tool, hand everything to the host page, wait for the app. */
  async render(name: string, args: Json, options: { width?: number; height?: number } = {}): Promise<RenderedApp> {
    const { tools } = await this.listTools();
    const tool = tools.find(entry => entry.name === name);
    assert(tool, `tools/list has no ${name}`);
    const resourceUri = ReferenceHost.resourceUriOf(tool);
    assert(resourceUri, `${name} carries no _meta.ui.resourceUri: the adapter did not offer the preview app (extension ${this.negotiate ? 'advertised' : 'not advertised'})`);
    const read = await this.readResource(resourceUri);
    const content = read.contents[0];
    assert(content?.text !== undefined, `resources/read ${resourceUri} returned no text`);
    assert.equal(content.mimeType, APP_MIME_TYPE, `resources/read ${resourceUri} mime type`);
    const result = await this.callTool(name, args);
    const csp = (content._meta as { ui?: { csp?: Json } } | undefined)?.ui?.csp;
    await this.page.evaluate(input => (window as unknown as ReferenceHostPage).__referenceHost.render(input), { sandboxUrl: `${this.sandboxUrl}/sandbox.html`, html: content.text, ...(csp ? { csp } : {}), tool, toolInput: args, toolResult: result, hostContext: this.hostContext, width: options.width, height: options.height });
    const sandboxFrame = this.page.frames().find(frame => frame.url().startsWith(this.sandboxUrl));
    assert(sandboxFrame, 'the sandbox frame');
    const appFrame = this.page.frames().find(frame => frame.parentFrame() === sandboxFrame);
    assert(appFrame, 'the app frame inside the sandbox');
    return { tool, resourceUri, resource: { mimeType: content.mimeType!, text: content.text, _meta: content._meta }, result, appFrame, sandboxFrame };
  }

  setHostContext(context: Json): Promise<void> { this.hostContext && Object.assign(this.hostContext, context); return this.page.evaluate(value => (window as unknown as ReferenceHostPage).__referenceHost.setHostContext(value), context); }

  async close(): Promise<void> {
    const exit = await this.rpc.close();
    await this.page.close().catch(() => undefined);
    if (this.ownsBrowser) await this.browser.close();
    await new Promise<void>(resolve => this.hostServer.close(() => resolve()));
    await new Promise<void>(resolve => this.sandboxServer.close(() => resolve()));
    if (this.storeRoot) fs.rmSync(this.storeRoot, { recursive: true, force: true });
    void exit;
  }
}

/** What the host page exposes to the harness. Typed locally: reference-host/host.ts declares Window.__referenceHost for its own bundle, and one program cannot hold two shapes. */
type ReferenceHostPage = { __referenceHost: { render: (input: unknown) => Promise<void>; setHostContext: (context: unknown) => void } };

// CLI: the m02 receipts — the minimal resource rendered from the adapter with the extension negotiated, and the fallback without it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf('--out');
  const out = path.resolve(ROOT, outIndex >= 0 ? process.argv[outIndex + 1]! : 'artifacts/product-reality/sprint-202/m02/reference-host');
  fs.mkdirSync(out, { recursive: true });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const receipts: Json = { head, dirty: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().length > 0, defaultCsp: DEFAULT_CSP };
  const negotiated = await ReferenceHost.open({ negotiate: true });
  try {
    const rendered = await negotiated.render('design_preview', { object: 'Subscription', context: 'detail' });
    await rendered.appFrame.waitForFunction(() => (window as unknown as { __oodsPreviewApp?: { connected: boolean; result: unknown; module: unknown } }).__oodsPreviewApp?.connected === true, undefined, { timeout: 60_000 });
    await rendered.appFrame.waitForFunction(() => Boolean((window as unknown as { __oodsPreviewApp?: { module: unknown; errors: string[] } }).__oodsPreviewApp?.module) || ((window as unknown as { __oodsPreviewApp?: { errors: string[] } }).__oodsPreviewApp?.errors.length ?? 0) > 0, undefined, { timeout: 120_000 });
    const app = await rendered.appFrame.evaluate(() => (window as unknown as { __oodsPreviewApp: Json }).__oodsPreviewApp);
    await negotiated.page.screenshot({ path: path.join(out, 'negotiated.png'), fullPage: true });
    receipts.negotiated = {
      initialize: negotiated.initialized, resourceUri: rendered.resourceUri, resource: { mimeType: rendered.resource.mimeType, bytes: Buffer.byteLength(rendered.resource.text), declaresCsp: /Content-Security-Policy/i.test(rendered.resource.text) },
      toolMeta: rendered.tool._meta, structuredContent: (rendered.result as { structuredContent?: Json }).structuredContent ? Object.keys((rendered.result as { structuredContent: Json }).structuredContent) : null,
      app: { connected: app.connected, hostContext: app.hostContext, result: app.result && { compositionId: (app.result as Json).compositionId, version: (app.result as Json).version, resources: (app.result as Json).resources }, module: app.module, errors: app.errors },
      events: negotiated.events.map(event => event.kind), consoleErrors: negotiated.consoleErrors, pageErrors: negotiated.pageErrors, cspViolations: negotiated.cspViolations, stderr: negotiated.rpc.negotiationReceipt(), stdoutNonJson: negotiated.rpc.nonJson,
    };
    assert.deepEqual(negotiated.consoleErrors, [], 'console errors'); assert.deepEqual(negotiated.pageErrors, [], 'page errors'); assert.deepEqual(negotiated.cspViolations, [], 'CSP violations'); assert.deepEqual(negotiated.rpc.nonJson, [], 'stdout carried non-JSON');
    assert.equal(app.connected, true); assert(app.module, `the app read no module: ${JSON.stringify(app.errors)}`);
  } finally { await negotiated.close(); }
  const plain = await ReferenceHost.open({ negotiate: false });
  try {
    const { tools } = await plain.listTools();
    const tool = tools.find(entry => entry.name === 'design_preview')!;
    let refused: string | null = null;
    try { await plain.render('design_preview', { object: 'Subscription', context: 'card' }); } catch (error) { refused = error instanceof Error ? error.message : String(error); }
    receipts.notNegotiated = { initialize: plain.initialized, toolMeta: tool._meta ?? null, tools: tools.length, refused, stderr: plain.rpc.negotiationReceipt() };
    assert.equal(tool._meta, undefined, 'a client that did not advertise the extension must not see _meta.ui'); assert(refused && /did not offer/.test(refused), 'the harness must fail when the extension is not negotiated');
  } finally { await plain.close(); }
  fs.writeFileSync(path.join(out, 'reference-host.json'), JSON.stringify(receipts, null, 2) + '\n');
  console.log(JSON.stringify({ out: path.relative(ROOT, out), negotiated: { resourceUri: (receipts.negotiated as Json).resourceUri, consoleErrors: 0, cspViolations: 0 }, notNegotiated: { toolMeta: null } }));
}
