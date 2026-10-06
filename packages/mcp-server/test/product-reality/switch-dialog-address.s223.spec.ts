/**
 * s223-m02 (#2527 rulings 12, 13a, 13b and 13i): what a person does with generated screens, in a browser.
 *
 * - React and Vue: the generated workflow's form reads the record's boolean into the Switch; a click, or Space, turns it
 *   over; Save stores it; the detail and the form read the saved value back. The preview host serves the app with a
 *   runtime built here from the packages' current builds, so a stale runtime cannot pass for the code under test.
 * - React and Vue: the same for a SegmentedControl's segment and a Combobox's pick (typed to filter, then Enter).
 * - React and Vue: a User workflow saves an address typed into the form, and its detail's address panel reads it back.
 *   Sprint 222's freeze attempt 1 caught this failing (#2521); the single-screen binding must not bring it back.
 * - HTML: the static switch turns over on a click (on it or on its label), on Space and on Enter, once each, and its
 *   hidden form value and a change event follow it. A static Dialog's close control closes it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { compileArtifact } from '../../../mcp-bridge/src/preview/compile.js';
import { loadPreviewRuntime } from '../../../mcp-bridge/src/preview/runtime.js';
import { emit as emitReact } from '../../src/codegen/react-emitter.js';
import { emit as emitVue } from '../../src/codegen/vue-emitter.js';
import type { UiElement } from '../../src/schemas/generated.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as preview } from '../../src/tools/design.preview.js';
import { renderDocument } from '../../src/render/document.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright');
type Page = { goto(url: string): Promise<unknown>; waitForFunction(fn: () => boolean, arg?: unknown, options?: { timeout: number }): Promise<unknown>; waitForSelector(selector: string, options?: { timeout: number }): Promise<unknown>; locator(selector: string, options?: { hasText?: string }): any; getByRole(role: string, options?: { name?: string; exact?: boolean }): any; getByText(text: string, options?: { exact?: boolean }): any; getByLabel(text: string, options?: { exact?: boolean }): any; keyboard: { press(key: string): Promise<void> }; evaluate<T>(fn: () => T): Promise<T>; on(event: string, listener: (error: Error) => void): void; close(): Promise<void> };

let home: string;
let server: FastifyInstance;
let hostUrl = '';
let runtimeDir = '';
let browser: { newPage(): Promise<Page>; close(): Promise<void> };

beforeAll(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s223-switch-browser-'));
  fs.mkdirSync(path.join(home, 'objects'));
  fs.copyFileSync(path.join(root, 'packages/mcp-server/test/fixtures/team-definitions/AlertRule.object.yaml'), path.join(home, 'objects/AlertRule.object.yaml'));
  // NotificationRoute with the composer's Selects; its test applies the two asks to the form as the composer does.
  fs.writeFileSync(path.join(home, 'objects/NotificationRoute.object.yaml'), fs.readFileSync(path.join(root, 'packages/mcp-server/test/fixtures/team-definitions/NotificationRoute.object.yaml'), 'utf8')
    .replace('    ui_hints:\n      component: SegmentedControl\n', '').replace('    ui_hints:\n      component: Combobox\n', ''));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  process.env.MCP_SCHEMA_STORE_DIR = 'schemas';
  clearObjectCache();
  runtimeDir = path.join(home, 'preview-runtime');
  const built = spawnSync(process.execPath, [path.join(root, 'packages/mcp-bridge/scripts/build-preview-runtime.mjs'), '--out', runtimeDir], { encoding: 'utf8' });
  expect(built.status, built.stderr).toBe(0);
  server = Fastify();
  await registerPreviewHost(server, { compositionsDir: resolveCompositionsDir(), runtimeDir, runTool: (_tool: string, input: unknown) => preview(input as never, { previewHostUrl: hostUrl }) } as never);
  await server.listen({ port: 0, host: '127.0.0.1' });
  hostUrl = `http://127.0.0.1:${(server.server.address() as { port: number }).port}`;
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  delete process.env.OODS_OBJECTS_DIR;
  delete process.env.MCP_SCHEMA_STORE_ROOT;
  delete process.env.MCP_SCHEMA_STORE_DIR;
  clearObjectCache();
  fs.rmSync(home, { recursive: true, force: true });
});

const open = async (url: string) => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.goto(url);
  return { page, errors };
};

describe('a generated workflow form keeps and saves its Switch (s223-m02)', () => {
  it.each(['react', 'vue'] as const)('%s reads the record\'s boolean, turns it over on a click and on Space, and saves each', async framework => {
    const result = await preview({ object: 'AlertRule', context: 'workflow', framework } as never, { previewHostUrl: hostUrl }) as { status: string; previews?: Array<{ appUrl: string }>; errors?: unknown };
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const { page, errors } = await open(result.previews![0]!.appUrl);
    try {
      await page.waitForFunction(() => document.documentElement.dataset.oodsPreviewMounted === 'true', undefined, { timeout: 30_000 });
      const go = async (screen: 'detail' | 'form') => {
        await page.locator('nav[aria-label="Workflow screens"] button', { hasText: screen === 'form' ? 'Edit' : 'Detail' }).click();
        await page.waitForSelector(`[data-screen="${screen}"][data-ui-state="success"]`, { timeout: 15_000 });
      };
      const enabledRow = async () => (await page.locator('.workflow-content').innerText()).match(/Enabled\s+(Yes|No)/)?.[1];
      await go('detail');
      const stored = await enabledRow();
      expect(['Yes', 'No']).toContain(stored);
      await go('form');
      const control = page.getByRole('switch', { name: 'Enabled' });
      // The form starts from the record.
      expect(await control.getAttribute('aria-checked')).toBe(stored === 'Yes' ? 'true' : 'false');
      await control.click();
      expect(await control.getAttribute('aria-checked')).toBe(stored === 'Yes' ? 'false' : 'true');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForSelector('[data-screen="detail"][data-ui-state="success"]', { timeout: 15_000 });
      expect(await enabledRow()).toBe(stored === 'Yes' ? 'No' : 'Yes');
      // The saved value comes back into the form, and the keyboard turns it over again.
      await go('form');
      expect(await control.getAttribute('aria-checked')).toBe(stored === 'Yes' ? 'false' : 'true');
      await control.focus();
      await page.keyboard.press('Space');
      expect(await control.getAttribute('aria-checked')).toBe(stored === 'Yes' ? 'true' : 'false');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForSelector('[data-screen="detail"][data-ui-state="success"]', { timeout: 15_000 });
      expect(await enabledRow()).toBe(stored);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  }, 180_000);
});

/**
 * A generated workflow app on its own page, compiled as the preview host compiles one (its runtime import map, the token
 * and component styles). design.preview generates through code.generate, which refuses SegmentedControl and Combobox
 * until the structured-data registry and the capability ledger list them (the lead's refresh), so their app is emitted
 * and compiled here directly.
 */
async function serveWorkflow(framework: 'react' | 'vue', files: Array<{ path: string; contents: string }>) {
  const runtime = loadPreviewRuntime(runtimeDir);
  const artifact = { framework, actions: [], files: files.map(file => ({ ...file, contentHash: '' })), contentHash: `sha256:${createHash('sha256').update(JSON.stringify(files)).digest('hex')}` };
  const compiled = await compileArtifact(artifact as never, { format: 'esm', runtimeImports: Object.keys(runtime.manifest.importMap) });
  const imports = Object.fromEntries(Object.entries(runtime.manifest.importMap).map(([specifier, file]) => [specifier, `/runtime/${file}`]));
  const page = `<!doctype html><html lang="en" data-theme="light" data-brand="A"><head><meta charset="utf-8"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/runtime/${runtime.manifest.styles}"><script type="importmap">${JSON.stringify({ imports })}</script></head><body data-theme="light" data-brand="A"><div id="app"></div><script type="module" src="/app.js"></script></body></html>`;
  const app = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost').pathname;
    const send = (type: string, body: string | Buffer) => { response.setHeader('Content-Type', type); response.end(body); };
    if (url === '/') return send('text/html', page);
    if (url === '/app.js') return send('text/javascript', compiled.code);
    if (url === '/tokens.css') return send('text/css', fs.readFileSync(path.join(root, 'packages/tokens/dist/css/tokens.css')));
    const file = path.resolve(runtime.directory, url.replace(/^\/runtime\//, ''));
    if (url.startsWith('/runtime/') && file.startsWith(runtime.directory + path.sep) && fs.existsSync(file)) return send(file.endsWith('.css') ? 'text/css' : 'text/javascript', fs.readFileSync(file));
    response.writeHead(404).end();
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { url: `http://127.0.0.1:${(app.address() as { port: number }).port}/`, close: () => new Promise(resolve => app.close(resolve)) };
}

describe('a generated workflow saves a SegmentedControl\'s and a Combobox\'s choices (s223-m02)', () => {
  it.each(['react', 'vue'] as const)('%s checks a segment and picks an option by typing, saves both, and reads them back', async framework => {
    const composition = await compose({ object: 'NotificationRoute', context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
    expect(composition.status, JSON.stringify(composition.errors)).toBe('ok');
    const walk = (node: UiElement): void => {
      // As the composer places them for the fields that ask (test/codegen/field-controls.s223.spec.ts).
      if (node.component === 'Select' && node.props?.field === 'severity') { node.component = 'SegmentedControl'; delete node.props.help; }
      if (node.component === 'Select' && node.props?.field === 'channel') node.component = 'Combobox';
      node.children?.forEach(walk);
    };
    walk(composition.schema.screens.find(screen => screen.id === 'form-screen')!);
    const emitted = (framework === 'react' ? emitReact : emitVue)(composition.schema, { typescript: true, styling: 'tokens' }) as { status: string; files?: Array<{ path: string; contents: string }>; errors?: unknown };
    expect(emitted.status, JSON.stringify(emitted.errors)).toBe('ok');
    const served = await serveWorkflow(framework, emitted.files!);
    const { page, errors } = await open(served.url);
    try {
      await page.waitForSelector('[data-screen="list"][data-ui-state="success"]', { timeout: 30_000 });
      const go = async (screen: 'detail' | 'form') => {
        await page.locator('nav[aria-label="Workflow screens"] button', { hasText: screen === 'form' ? 'Edit' : 'Detail' }).click();
        await page.waitForSelector(`[data-screen="${screen}"][data-ui-state="success"]`, { timeout: 15_000 });
      };
      await go('form');
      const high = page.getByRole('radio', { name: 'High' });
      const channel = page.getByRole('combobox', { name: 'Channel' });
      await high.check();
      expect(await high.isChecked()).toBe(true);
      // Typing filters the list (and is not the value); Down makes the match active and Enter picks it.
      await channel.click();
      await channel.fill('pag');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      expect(await channel.inputValue()).toBe('Pagerduty');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForSelector('[data-screen="detail"][data-ui-state="success"]', { timeout: 15_000 });
      const detail = await page.locator('.workflow-content').innerText();
      expect(detail).toMatch(/Severity\s+High/);
      expect(detail).toMatch(/Channel\s+Pagerduty/);
      await go('form');
      expect(await page.getByRole('radio', { name: 'High' }).isChecked()).toBe(true);
      expect(await page.getByRole('combobox', { name: 'Channel' }).inputValue()).toBe('Pagerduty');
      expect(errors).toEqual([]);
    } finally { await page.close(); await served.close(); }
  }, 180_000);
});

describe('a User workflow saves an address and its detail reads it back (s223-m02, #2521)', () => {
  it.each(['react', 'vue'] as const)('%s lists the saved address in the detail\'s address panel', async framework => {
    const result = await preview({ object: 'User', context: 'workflow', framework } as never, { previewHostUrl: hostUrl }) as { status: string; previews?: Array<{ appUrl: string }>; errors?: unknown };
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const { page, errors } = await open(result.previews![0]!.appUrl);
    try {
      await page.waitForFunction(() => document.documentElement.dataset.oodsPreviewMounted === 'true', undefined, { timeout: 30_000 });
      const go = async (screen: 'detail' | 'form') => {
        await page.locator('nav[aria-label="Workflow screens"] button', { hasText: screen === 'form' ? 'Edit' : 'Detail' }).click();
        await page.waitForSelector(`[data-screen="${screen}"][data-ui-state="success"]`, { timeout: 15_000 });
      };
      const summary = () => page.locator('[data-oods-component="AddressCollectionPanel"] [data-panel-summary]').innerText();
      await go('detail');
      // The authored sample users have no address: the panel says so instead of standing as a bare heading.
      expect(await summary()).toBe('None recorded');
      await go('form');
      for (const [label, value] of [['Street', '8 Lake Road'], ['City', 'Madison'], ['Region', 'WI'], ['Postal Code', '53703']]) {
        await page.getByLabel(label, { exact: true }).fill(value);
      }
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForSelector('[data-screen="detail"][data-ui-state="success"]', { timeout: 15_000 });
      // Saved under the role the record names as its default (default_address_role).
      expect(await summary()).toMatch(/^[a-z_]+, 8 Lake Road, Madison, WI, 53703$/);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  }, 180_000);
});

describe('a static HTML page\'s Switch and Dialog work without a framework (s223-m02)', () => {
  it('turns the switch over on a click, its label, Space and Enter, once each, with its form value and a change event', async () => {
    const composition = await compose({ object: 'AlertRule', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const html = await generate({ schema: composition.schema, framework: 'html', profile: 'build' } as never) as { status: string; code: string; errors?: unknown };
    expect(html.status, JSON.stringify(html.errors)).toBe('ok');
    const file = path.join(home, 'alert-rule-form.html');
    fs.writeFileSync(file, html.code);
    const { page, errors } = await open(pathToFileURL(file).href);
    try {
      await page.evaluate(() => { const counts = { changes: 0 }; (window as unknown as { counts: typeof counts }).counts = counts; document.addEventListener('change', event => { if ((event.target as HTMLInputElement).name === 'enabled') counts.changes += 1; }); });
      const control = page.getByRole('switch', { name: 'Enabled' });
      const value = page.locator('input[type="hidden"][name="enabled"]');
      const changes = () => page.evaluate(() => (window as unknown as { counts: { changes: number } }).counts.changes);
      // The shown record is enabled.
      expect(await control.getAttribute('aria-checked')).toBe('true');
      expect(await value.inputValue()).toBe('true');
      await control.click();
      expect([await control.getAttribute('aria-checked'), await value.inputValue(), await changes()]).toEqual(['false', 'false', 1]);
      await page.locator('label.oods-switch__label').click();
      expect([await control.getAttribute('aria-checked'), await value.inputValue(), await changes()]).toEqual(['true', 'true', 2]);
      await control.focus();
      await page.keyboard.press('Space');
      expect([await control.getAttribute('aria-checked'), await value.inputValue(), await changes()]).toEqual(['false', 'false', 3]);
      await page.keyboard.press('Enter');
      expect([await control.getAttribute('aria-checked'), await value.inputValue(), await changes()]).toEqual(['true', 'true', 4]);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  }, 120_000);

  it('closes a static Dialog from its close control', async () => {
    const screenHtml = renderTree({ version: '2026.02', screens: [{ id: 'confirm', component: 'Dialog', props: { title: 'Archive workspace', description: 'Members lose access until the workspace is restored.', open: true, actions: ['Cancel', { label: 'Archive workspace', intent: 'destructive' }] }, children: [{ id: 'confirm-body', component: 'Text', props: { text: 'Invoices and subscriptions stay in the archive for 30 days.' } }] }] } as UiSchema);
    const file = path.join(home, 'dialog.html');
    fs.writeFileSync(file, renderDocument({ screenHtml, theme: 'light', brand: 'A' }));
    const { page, errors } = await open(pathToFileURL(file).href);
    try {
      const shown = () => page.evaluate(() => (document.querySelector('dialog') as HTMLDialogElement).open);
      expect(await shown()).toBe(true);
      await page.getByRole('button', { name: 'Close' }).click();
      expect(await shown()).toBe(false);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  }, 60_000);
});
