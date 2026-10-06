import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Frame } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReferenceHost, type RenderedApp } from '../../../../scripts/product-reality/s202-reference-host.js';

/**
 * The preview inside the conversation (s202-m03). In the reference host (Chromium, the double iframe on two 127.0.0.1
 * origins, the spec's default CSP, the SDK's app-bridge, the real adapter over stdio) design_preview mounts the running
 * generated app in the inner frame, React and Vue, with the component counts and names and the canvas and text colours
 * of the Sprint 201 browser page for the same version and scope. Brand and theme switches re-mount in the same document,
 * the placed chart rendered for the scope through design_preview and the scope's tokens on the whole app; the panel shows
 * lineage and the stored measurements with unrun scopes named. The host's theme is the initial theme and the container's
 * width is the app's width. No console error, no CSP violation.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
type AppState = {
  connected: boolean; mounted: boolean; mounts: number; pending: string | null; errors: string[];
  framework: string; brand: string; theme: string; themeSource: string; width: string | number; appWidth: number; containerWidth: number | null; displayMode: string;
  components: number; componentNames: string[]; generatedFor: { brand: string; theme: string; chartScoped: boolean };
  module: { uri: string; key: string; registers: boolean; workflow: boolean } | null;
  toolCalls: Array<{ arguments: Record<string, unknown>; ok: boolean; code?: string }>;
  result: { compositionId: string; version: number } | null;
};
type Surface = { canvas: string; text: string };
/** The app's state without the version record and lineage list it keeps (large, and read from the DOM where it matters). */
const appState = (frame: Frame): Promise<AppState> => frame.evaluate(() => {
  const { record: _record, versions: _versions, ...rest } = (window as unknown as { __oodsPreviewApp: Record<string, unknown> }).__oodsPreviewApp;
  return rest;
}) as unknown as Promise<AppState>;
/** The running app's surface: the frame's canvas and text colour, resolved from the mounted scope's tokens. */
const appSurface = (frame: Frame): Promise<Surface> => frame.evaluate(() => {
  const style = getComputedStyle(document.querySelector('[data-oods-app-frame]')!);
  return { canvas: style.backgroundColor, text: style.color };
});
/** Until the app has mounted again and nothing is pending; an error in the view ends the wait and fails the test. */
async function mountedAfter(frame: Frame, previous: number): Promise<AppState> {
  await frame.waitForFunction(count => {
    const state = (window as unknown as { __oodsPreviewApp?: { errors: string[]; mounts: number; pending: string | null } }).__oodsPreviewApp;
    return Boolean(state) && (state!.errors.length > 0 || (state!.mounts > count && state!.pending === null));
  }, previous, { timeout: 240_000 });
  const state = await appState(frame);
  expect(state.errors).toEqual([]);
  return state;
}
/** The Sprint 201 browser page for the same version and scope, once mounted and measured (its axe result is stored before the next act). */
async function browserPage(host: ReferenceHost, appUrl: string, scope: { framework: string; brand: string; theme: string }): Promise<{ components: number; componentNames: string[] } & Surface> {
  const url = new URL(appUrl);
  for (const [key, value] of Object.entries(scope)) url.searchParams.set(key, value);
  const page = await host.browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(url.href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.oodsPreviewMounted === 'true' && document.documentElement.dataset.oodsAxeRuns === '1', undefined, { timeout: 120_000 });
    const observed = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('[data-oods-component]'));
      const body = getComputedStyle(document.body);
      return { components: nodes.length, componentNames: [...new Set(nodes.map(node => node.getAttribute('data-oods-component') ?? ''))].sort(), canvas: body.backgroundColor, text: body.color };
    });
    expect(errors).toEqual([]);
    return observed;
  } finally { await page.close(); }
}
const appUrlOf = (rendered: RenderedApp) => (rendered.result as { structuredContent: { previews: Array<{ appUrl: string }> } }).structuredContent.previews[0]!.appUrl;

describe('the preview app mounts the running generated app inside the conversation (s202-m03)', () => {
  let host: ReferenceHost;
  let rendered: RenderedApp;
  beforeAll(async () => {
    expect(fs.existsSync(path.join(root, 'packages/mcp-bridge/dist/preview-app/app.html')), 'the preview app must be built').toBe(true);
    host = await ReferenceHost.open({ negotiate: true, hostContext: { theme: 'light', containerDimensions: { width: 900, maxHeight: 700 } } });
    rendered = await host.render('design_preview', { object: 'Subscription', context: 'detail' }, { width: 900, height: 700 });
  }, 300_000);
  afterAll(async () => { await host?.close(); });

  it('mounts the running React app, then the running Vue app, in the inner frame as the browser page shows them, no console error and no CSP violation', async () => {
    const react = await mountedAfter(rendered.appFrame, 0);
    expect(react).toMatchObject({ connected: true, mounted: true, framework: 'react', brand: 'A', theme: 'light', themeSource: 'host', generatedFor: { brand: 'A', theme: 'light', chartScoped: true } });
    expect(react.module).toMatchObject({ registers: true, workflow: false });
    expect(react.components).toBeGreaterThan(5);
    // The component tree lives in the app document inside the sandbox, under the frame the app mounts into.
    expect(await rendered.appFrame.evaluate(() => document.querySelectorAll('[data-oods-app-frame] > #app [data-oods-component]').length)).toBe(react.components);
    expect({ components: react.components, componentNames: react.componentNames, ...(await appSurface(rendered.appFrame)) }).toEqual(await browserPage(host, appUrlOf(rendered), { framework: 'react', brand: 'A', theme: 'light' }));

    await rendered.appFrame.click('button[data-control="framework"][data-value="vue"]');
    const vue = await mountedAfter(rendered.appFrame, react.mounts);
    expect(vue).toMatchObject({ framework: 'vue', brand: 'A', theme: 'light', mounts: react.mounts + 1 });
    expect(vue.module!.key).not.toBe(react.module!.key);
    expect({ components: vue.components, componentNames: vue.componentNames, ...(await appSurface(rendered.appFrame)) }).toEqual(await browserPage(host, appUrlOf(rendered), { framework: 'vue', brand: 'A', theme: 'light' }));
    // Both modules, the record and the lineage came through the host; the version already carried both frameworks for A/light, so no tool was called.
    const reads = host.events.filter(event => event.kind === 'resources/read').map(event => String(event.uri));
    for (const pattern of [/\/react\.js\?brand=A&theme=light$/, /\/vue\.js\?brand=A&theme=light$/, /\/1\/record\.json$/, /\/versions\.json$/]) expect(reads.some(uri => pattern.test(uri)), String(pattern)).toBe(true);
    expect(vue.toolCalls).toEqual([]);
    expect(host.cspViolations).toEqual([]);
    expect(host.consoleErrors).toEqual([]);
    expect(host.pageErrors).toEqual([]);
  }, 300_000);

  it('switches brand and theme in the same document: the placed chart is rendered for the scope through design_preview, the scope\'s tokens reach the whole app, and the panel shows lineage and the stored measurements with unrun scopes named', async () => {
    const before = await appState(rendered.appFrame);
    const beforeSurface = await appSurface(rendered.appFrame);
    await rendered.appFrame.evaluate(() => { (window as unknown as { __sameDocument: boolean }).__sameDocument = true; });
    await rendered.appFrame.click('button[data-control="brand"][data-value="B"]');
    const brandB = await mountedAfter(rendered.appFrame, before.mounts);
    await rendered.appFrame.click('button[data-control="theme"][data-value="dark"]');
    const dark = await mountedAfter(rendered.appFrame, brandB.mounts);
    expect(dark).toMatchObject({ framework: before.framework, brand: 'B', theme: 'dark', themeSource: 'switch', generatedFor: { brand: 'B', theme: 'dark', chartScoped: true }, mounts: before.mounts + 2 });
    expect(await rendered.appFrame.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
    const { compositionId, version } = dark.result!;
    expect(dark.toolCalls.filter(call => call.ok).map(call => call.arguments)).toEqual(expect.arrayContaining([{ compositionId, version, framework: before.framework, preferences: { brand: 'B', theme: 'dark' } }]));
    expect(host.events.filter(event => event.kind === 'tools/call').length).toBeGreaterThanOrEqual(2);
    const view = await rendered.appFrame.evaluate(() => {
      const frame = document.querySelector<HTMLElement>('[data-oods-app-frame]')!;
      const measurements = document.querySelector<HTMLElement>('[data-oods-measurements]');
      return {
        frame: { theme: frame.dataset.theme, brand: frame.dataset.brand },
        document: { theme: document.documentElement.dataset.theme, brand: document.documentElement.dataset.brand },
        lineage: document.querySelector('[data-oods-lineage]')?.textContent ?? '',
        current: document.querySelector('[data-oods-versions] li[aria-current="true"]')?.textContent ?? '',
        measurements: measurements?.dataset.oodsMeasurements ?? null,
        notMeasuredCount: Number(measurements?.dataset.oodsNotMeasuredCount ?? 0),
        unrunAxe: Array.from(document.querySelectorAll('[data-oods-not-measured^="axe:"]')).map(node => node.getAttribute('data-oods-not-measured')),
        chartScope: document.querySelector('[data-oods-chart-scope="B/dark"]') !== null,
      };
    });
    expect(view.frame).toEqual({ theme: 'dark', brand: 'B' });
    expect(view.document).toEqual({ theme: 'dark', brand: 'B' });
    expect(view.lineage).toContain(compositionId);
    expect(view.lineage).toContain('none (first version)');
    expect(view.current).toMatch(/^v1 · /);
    expect(view.measurements).toBe(`${compositionId}@${version}`);
    expect(view.chartScope).toBe(true);
    expect(view.notMeasuredCount).toBeGreaterThan(0);
    expect(view.unrunAxe).toEqual(expect.arrayContaining([`axe:${before.framework}:B/dark`]));
    // Not only the chart: the app's canvas and text change with the scope, and match the browser page for B/dark.
    const darkSurface = await appSurface(rendered.appFrame);
    expect(darkSurface.canvas).not.toBe(beforeSurface.canvas);
    expect(darkSurface.text).not.toBe(beforeSurface.text);
    expect({ components: dark.components, componentNames: dark.componentNames, ...darkSurface }).toEqual(await browserPage(host, appUrlOf(rendered), { framework: before.framework, brand: 'B', theme: 'dark' }));
    expect(host.cspViolations).toEqual([]);
    expect(host.consoleErrors).toEqual([]);
    expect(host.pageErrors).toEqual([]);
  }, 600_000);
});

describe('the host shapes the first view (s202-m03)', () => {
  it('the host\'s dark theme is the initial theme and the container\'s width the app\'s width; a width the container cannot show asks for fullscreen', async () => {
    const host = await ReferenceHost.open({ negotiate: true, hostContext: { theme: 'dark', containerDimensions: { width: 760, maxHeight: 700 } } });
    try {
      const rendered = await host.render('design_preview', { object: 'Subscription', context: 'detail', framework: 'react' }, { width: 760, height: 700 });
      const first = await mountedAfter(rendered.appFrame, 0);
      expect(first).toMatchObject({ framework: 'react', brand: 'A', theme: 'dark', themeSource: 'host', generatedFor: { brand: 'A', theme: 'dark', chartScoped: true }, width: 'fit', containerWidth: 760, appWidth: 760 });
      // The version was composed for A/light; the host's dark theme had design_preview render the placed chart for A/dark first.
      expect(first.toolCalls).toEqual([expect.objectContaining({ ok: true, arguments: expect.objectContaining({ framework: 'react', preferences: { brand: 'A', theme: 'dark' } }) })]);
      // The dark theme is on the whole running app, as the browser page shows A/dark.
      expect({ components: first.components, componentNames: first.componentNames, ...(await appSurface(rendered.appFrame)) }).toEqual(await browserPage(host, appUrlOf(rendered), { framework: 'react', brand: 'A', theme: 'dark' }));
      await rendered.appFrame.click('button[data-control="width"][data-value="390"]');
      await rendered.appFrame.waitForFunction(() => (window as unknown as { __oodsPreviewApp: { appWidth: number } }).__oodsPreviewApp.appWidth === 390);
      await rendered.appFrame.click('button[data-control="width"][data-value="1440"]');
      await rendered.appFrame.waitForFunction(() => (window as unknown as { __oodsPreviewApp: { displayMode: string } }).__oodsPreviewApp.displayMode === 'fullscreen', undefined, { timeout: 30_000 });
      expect(await appState(rendered.appFrame)).toMatchObject({ width: 1440, appWidth: 1440, displayMode: 'fullscreen' });
      await rendered.appFrame.click('button[data-control="width"][data-value="fit"]');
      await rendered.appFrame.waitForFunction(() => (window as unknown as { __oodsPreviewApp: { displayMode: string } }).__oodsPreviewApp.displayMode === 'inline', undefined, { timeout: 30_000 });
      expect(host.events.filter(event => event.kind === 'ui/request-display-mode').map(event => (event.params as { mode: string }).mode)).toEqual(['fullscreen', 'inline']);
      expect(host.cspViolations).toEqual([]);
      expect(host.consoleErrors).toEqual([]);
      expect(host.pageErrors).toEqual([]);
    } finally { await host.close(); }
  }, 300_000);
});
