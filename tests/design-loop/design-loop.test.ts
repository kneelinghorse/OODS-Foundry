import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildGeneratedArtifact } from '../../packages/mcp-server/src/codegen/artifact-envelope.js';
import { consumerEntries } from '../../scripts/design-loop/serve.js';
import { compareReceipts, diff } from '../../scripts/design-loop/diff.js';
import { outputDirectory, relativeFile, validateReceipt, type CaptureRequest } from '../../scripts/design-loop/common.js';
import { render } from '../../scripts/design-loop/render.js';
import { applySteps, observeGraphicsAccessibility } from '../../scripts/design-loop/observe.js';
import type { Page } from 'playwright';
import { status } from '../../scripts/design-loop/status.js';

const temporary: string[] = [];
async function temp() { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-loop-spec-')); temporary.push(directory); return directory; }
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(temporary.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });
const hash = `sha256:${'a'.repeat(64)}`;
function receipt() {
  return { version: '1.0', framework: 'react', compose: { object: 'Subscription', context: 'list' }, schemaHash: hash, artifactContentHash: hash,
    sourceHead: 'a'.repeat(40), files: [{ path: 'src/GeneratedUI.tsx', contentHash: hash }], model: {}, steps: [], clock: '2026-09-08T12:00:00.000Z', locale: 'en-US', timezone: 'UTC',
    packages: [{ name: '@oods/components-react', version: '1.0.0', sha256: hash, installSpec: 'file:./tarballs/react.tgz' }],
    views: [{ width: 390, accessibility: '- main\n  - textbox "Search":\n', screenshot: '390.png', screenshotHash: hash, dump: '390.a11y.txt',
      measurements: { viewportWidth: 390, documentWidth: 390, elementCount: 12, overflow: [], glyphWraps: [] }, values: [], regions: [{ id: 'list-toolbar', component: 'Stack', text: 'Search' }] }],
    errors: [], timings: { composeMs: 5, generateMs: 6, captureMs: 7 }, output: '/tmp/receipt', consumer: { root: '/tmp/consumer', port: 4478, pid: 10 } };
}

describe('Design-loop observations remain evidence rather than repaired output', () => {
  it('seeds standalone lists from the workflow policy with truthful counts and preserves explicit empty input', async () => {
    const requests: CaptureRequest[] = [];
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
      if (options.body) requests.push(JSON.parse(String(options.body)));
      return new Response(JSON.stringify(options.body ? receipt() : { running: true }));
    });
    const output = await temp();
    await render({ compose: { object: 'Subscription', context: 'list' }, framework: 'react', output });
    const model = requests[0]!.model;
    const rows = model.rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(9);
    expect(model.collectionQuery).toEqual({ page: 1, pageSize: 10, total: rows.length });
    expect(new Set(rows.map(row => row.subscriptionId)).size).toBe(rows.length);
    expect(rows.every(row => !row.isArchived && / Plan$/.test(String(row.planName)))).toBe(true);
    // s213-m01 (finding 1): the list shows its rows in the order its sort control states, Name A–Z. The other screens
    // show the same seeded record they always did, which is no longer the list's third row, so it is found by its id.
    const names = rows.map(row => String(row.planName));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const context of ['form', 'detail', 'timeline'] as const) {
      await render({ compose: { object: 'Subscription', context }, framework: 'react', output });
      const shown = rows.find(row => row.subscriptionId === requests.at(-1)!.model.subscriptionId);
      expect(shown, `${context}: the record it shows is one of the list's`).toBeDefined();
      expect(requests.at(-1)!.model.planName).toBe(shown!.planName);
      expect(requests.at(-1)!.model.amount).toBe(shown!.amount);
      expect(requests.at(-1)!.model.cancellationRequestedAt).toBeUndefined();
      expect(requests.at(-1)!.model.archivedAt).toBeUndefined();
      if (context === 'timeline') expect((requests.at(-1)!.model.events as Array<{ title: string }>).some(event => event.title === 'Last payment')).toBe(true);
    }
    await render({ compose: { object: 'Subscription', context: 'list' }, framework: 'react', output, model: { rows: [], collectionQuery: { total: 0 }, uiState: 'empty' } });
    expect(requests.at(-1)!.model.rows).toEqual([]);
    expect(requests.at(-1)!.model.collectionQuery).toEqual({ total: 0 });
    await render({ compose: { object: 'Mission', context: 'detail' }, framework: 'react', output, model: { cancellationRequestedAt: '2026-09-08T11:00:00Z' } });
    expect(requests.at(-1)!.model.cancellationRequestedAt).toBe('2026-09-08T11:00:00Z');
  });
  it('retains actual browser graphics descendants instead of guessing from authored DOM roles', async () => {
    const replies: Record<string, unknown> = {
      'DOM.getDocument': { root: { nodeId: 1 } }, 'DOM.querySelector': { nodeId: 2 },
      'DOM.describeNode': { node: { backendNodeId: 22 } },
      'Accessibility.getFullAXTree': { nodes: [
        { nodeId: 'figure', backendDOMNodeId: 22, role: { value: 'image' }, name: { value: 'Payments' }, childIds: ['chart'] },
        { nodeId: 'chart', role: { value: 'graphics-object' }, name: { value: 'Amounts' }, childIds: [] },
      ] },
    };
    const page = { locator: () => ({ count: async () => 1 }), context: () => ({ newCDPSession: async () => ({ send: async (method: string) => replies[method], detach: async () => {} }) }) } as unknown as Page;
    expect(await observeGraphicsAccessibility(page)).toContain('- image "Payments"\n  - graphics-object "Amounts"');
    replies['Accessibility.getFullAXTree'] = { nodes: [] };
    await expect(observeGraphicsAccessibility(page)).rejects.toThrow('absent');
  });
  it('advances deterministic event time so a change after mounting is newer than its listeners', async () => {
    const times: number[] = [];
    const start = Date.parse('2026-09-08T12:00:00Z');
    let attached = start;
    let saved = '';
    const page = { clock: { setFixedTime: async (date: Date) => { times.push(date.getTime()); } }, locator: () => ({
      click: async () => { attached = times.at(-1)!; },
      selectOption: async (value: string) => { if (times.at(-1)! > attached) saved = value; }, count: async () => 0,
    }) } as unknown as Page;
    await applySteps(page, [{ action: 'click', selector: 'Edit' }, { action: 'select', selector: 'Interval', value: 'yearly' }], start);
    expect(saved).toBe('yearly');
    expect(times).toEqual([start + 1, start + 2]);
  });
  it('requires hashes, errors and measurements instead of accepting an incomplete green receipt', async () => {
    await expect(validateReceipt(receipt())).resolves.toBeUndefined();
    for (const key of ['errors', 'schemaHash', 'views']) {
      const broken: any = receipt(); delete broken[key];
      await expect(validateReceipt(broken)).rejects.toThrow('Invalid design-loop receipt');
    }
    const broken = receipt(); broken.views[0]!.measurements.viewportWidth = '390' as any;
    await expect(validateReceipt(broken)).rejects.toThrow('Invalid design-loop receipt');
  });
  it('treats unchanged observations as identical across output locations and timings', () => {
    const before = receipt(), after = receipt(); after.output = '/tmp/elsewhere'; after.timings.captureMs = 400; after.views[0]!.screenshotHash = `sha256:${'b'.repeat(64)}`;
    expect(compareReceipts(before, after)).toEqual({ differenceCount: 0, differences: [] });
  });
  it('names toolbar mutations and detects both deleted source files and browser errors', () => {
    const before = receipt(), after = receipt(); after.views[0]!.regions[0]!.text = 'Search Billing summary'; after.files = [];
    (after.errors as any[]).push({ type: 'page', text: 'Render failed' });
    const delta = compareReceipts(before, after);
    expect(delta.differences.map(row => row.field)).toEqual(['errors', 'files.src/GeneratedUI.tsx', 'views.390.regions']);
    expect(JSON.stringify(delta)).toContain('list-toolbar');
    expect(JSON.stringify(delta)).toContain('Render failed');
  });
  it('does not let generated paths or symlinked outputs reach canonical inputs', async () => {
    for (const name of ['../outside.ts', '/absolute.ts', 'src/../../bad.ts', '..\\bad.ts']) expect(() => relativeFile('/tmp/consumer', name)).toThrow();
    const directory = await temp(); const store = path.join(directory, '.oods', 'schemas'); await fs.mkdir(store, { recursive: true });
    await fs.symlink(store, path.join(directory, 'alias'));
    await expect(outputDirectory(path.join(directory, 'alias', 'receipt'))).rejects.toThrow('saved store');
    await expect(outputDirectory(path.join(directory, 'artifacts', 'structured-data', 'receipt'))).rejects.toThrow('structured-data');
    await expect(outputDirectory(path.join(directory, 'receipts'))).resolves.toBe(path.join(await fs.realpath(directory), 'receipts'));
  });
  it.each(['react', 'vue'] as const)('mounts %s standalone artifacts without altering generated bytes', framework => {
    const extension = framework === 'react' ? '.tsx' : '.vue';
    const artifact = buildGeneratedArtifact({ framework, imports: [], code: 'generated contents', fileExtension: extension });
    const request = { artifact, model: { amount: 1999 } } as CaptureRequest;
    const files = consumerEntries(framework, request);
    expect(files[artifact.files[0]!.path]).toBe('generated contents');
    if (framework === 'react') expect(files['src/main.tsx']).toContain('import { GeneratedUI as Page }');
    expect(files[framework === 'react' ? 'src/main.tsx' : 'src/main.ts']).toContain('1999');
    expect(Object.values(files).join('\n')).not.toContain('workflow-records');
  });
  it('uses the workflow application exactly as generated with no parallel consumer wiring', () => {
    const artifact = buildGeneratedArtifact({ framework: 'react', imports: [], files: [{ path: 'package.json', contents: '{"private":true}' }, { path: 'src/App.tsx', contents: 'the generated app' }] });
    expect(consumerEntries('react', { artifact } as CaptureRequest)).toEqual(Object.fromEntries(artifact.files.map(file => [file.path, file.contents])));
  });
  it('reports a stopped server before creating partial render output', async () => {
    const output = path.join(await temp(), 'output');
    expect(await status(1)).toMatchObject({ running: false });
    await expect(render({ compose: { object: 'Subscription', context: 'list' }, output, port: 1 })).rejects.toThrow();
    expect(await fs.stat(output).then(() => true, () => false)).toBe(false);
  });
  it('writes a validated machine and human diff into the requested directory', async () => {
    const directory = await temp(); const before = path.join(directory, 'before.json'), after = path.join(directory, 'after.json');
    await fs.writeFile(before, JSON.stringify(receipt())); await fs.writeFile(after, JSON.stringify(receipt()));
    const output = path.join(directory, 'diff'); expect((await diff(before, after, output)).differenceCount).toBe(0);
    expect(await fs.readFile(path.join(output, 'diff.md'), 'utf8')).toContain('0 differences.');
  });
});

describe('theme receipts (s191)', () => {
  it('requires measured colors for version 1.1 while preserving version 1.0 readers', async () => {
    const updated: any = { ...receipt(), version: '1.1', theme: 'dark', brand: 'B' };
    await expect(validateReceipt(updated)).rejects.toThrow();
    updated.views[0].measurements.bodyBackground = 'oklch(0.18 0.008 265)';
    updated.views[0].measurements.chartCanvasFills = ['oklch(0.18 0.008 265)'];
    await expect(validateReceipt(updated)).resolves.toBeUndefined();
    const { verifyTheme } = await import('../../scripts/design-loop/common.js');
    expect(() => verifyTheme(updated)).not.toThrow();
    updated.views[0].measurements.chartCanvasFills = ['#FDF3DE'];
    expect(() => verifyTheme(updated)).toThrow('Chart canvas');
    updated.views[0].measurements.chartCanvasFills = [];
    updated.views[0].measurements.bodyBackground = 'rgb(255,255,255)';
    expect(() => verifyTheme(updated)).toThrow('Body background');
  });
  it.each(['react', 'vue'] as const)('selects the scope on %s standalone hosts', framework => {
    const artifact = buildGeneratedArtifact({ framework, imports: [], code: 'contents', fileExtension: framework === 'react' ? '.tsx' : '.vue' });
    const files = consumerEntries(framework, { artifact, model: {}, theme: 'dark', brand: 'B' } as CaptureRequest);
    expect(files['index.html']).toContain('data-theme="dark" data-brand="B"');
    expect(files['index.html']).toContain('background:var(--sys-surface-canvas)');
    expect(files['index.html']).toContain('color-scheme:dark');
  });
});
