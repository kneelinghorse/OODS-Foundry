import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handle as generate } from '../../src/tools/code.generate.js';
import { deriveConsumerModel } from '../../src/codegen/preview-model.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import type { UiSchema } from '../../src/schemas/generated.js';
const root = path.resolve(import.meta.dirname, '../../../..');
beforeEach(() => { vi.stubEnv('MCP_MAPPINGS_PATH', path.join(root, '.tmp/s214-no-app-mappings.json')); vi.stubEnv('OODS_PREVIEW_HOST_URL', ''); });
afterEach(() => vi.unstubAllEnvs());
const schema: UiSchema = { version: '2026.09', screens: [{ id: 'title', component: 'Text', props: { content: 'Example record' } }] };
it.each(['react', 'vue'] as const)('delivers a %s app with its own install/build configuration and an unchanged component default', async framework => {
  const ordinary = await generate({ schema, framework });
  expect(ordinary.artifact!.files.some(file => file.path === 'package.json')).toBe(false);
  const result = await generate({ schema, framework, options: { output: 'application' } } as any);
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  const files = new Map(result.artifact!.files.map(file => [file.path, file.contents]));
  for (const name of ['package.json', 'index.html', 'vite.config.mjs', 'tsconfig.json', 'README.md']) expect(files.has(name), name).toBe(true);
  expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
  // s220-m03: npm is the only install path (#2463b). The app's package.json pins every package, so the steps are npm's.
  expect(result.install!.steps).toEqual(['npm install', 'npm run build']);
  expect(files.get('README.md')).toContain('Run `npm install`');
  expect(JSON.stringify(result.install) + files.get('README.md')).not.toMatch(/npm pack|oods-packages/);
  expect(JSON.parse(files.get('package.json')!).scripts.build).toContain('vite build');
});
it('does not silently pretend untyped output is a typed React application', async () => {
  for (const request of [{ framework: 'react', options: { typescript: false } }]) {
    const result = await generate({ ...request, schema, options: { ...request.options, output: 'application' } } as any);
    expect(result.status).toBe('error'); expect(result.errors?.[0]?.message).toMatch(/application/i);
  }
});
it('all five package allowlists retain the legal notice and the packages are explicitly publishable for the public release', () => {
  for (const name of ['tokens', 'components-react', 'components-vue', 'component-styles', 'component-contracts']) {
    const dir = path.join(root, 'packages', name), manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(manifest.private, name).toBeUndefined(); expect(manifest.publishConfig, name).toEqual({ access: 'public' }); expect(manifest.files, name).toContain('NOTICE');
    for (const file of ['LICENSE', 'NOTICE', 'README.md']) expect(fs.existsSync(path.join(dir, file)), name + '/' + file).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain('workspace:');
  }
});
it('uses authored examples before fallback copy, and shows readable samples without harness vocabulary', () => {
  const model = deriveConsumerModel({ ...schema, objectSchema: { name: { type: 'string', required: true, examples: ['Lakeside'] }, city: { type: 'string', required: true }, email: { type: 'email', required: true }, status: { type: 'string', required: true, enum: ['planned', 'active'], examples: ['active'] } } });
  expect(model.name).toBe('Lakeside'); expect(model.status).toBe('active');
  expect(JSON.stringify(model)).not.toMatch(/consumer|example\.test/i);
});

it('does not turn a closed warehouse into an opened event or overwrite authored lifecycle examples', async () => {
  const { workflowSampleRecords } = await import('../../src/codegen/workflow-data-emitter.js');
  const fields = { status: { type: 'string', required: true, enum: ['planned', 'active', 'closed'], examples: ['closed'] }, last_event: { type: 'string', required: true, enum: ['opened', 'restocked', 'closed'], examples: ['closed'] }, created_at: { type: 'datetime', required: true, examples: ['2025-01-01T00:00:00Z'] }, state_history: { type: 'array', required: false } };
  const record = workflowSampleRecords({ ...schema, objectSchema: fields })[0]!;
  expect(record).toMatchObject({ status: 'closed', last_event: 'closed', created_at: '2025-01-01T00:00:00Z' });
  const fallback = workflowSampleRecords({ ...schema, objectSchema: { ...fields, status: { ...fields.status, examples: undefined } } })[0]!;
  expect(fallback).toMatchObject({ status: 'planned', last_event: 'closed' });
});

it.each(['react', 'vue'] as const)('closes %s team dependencies in the runnable app manifest as well as its component', async framework => {
  const { handle: create } = await import('../../src/tools/map.create.js');
  const mappingFile = process.env.MCP_MAPPINGS_PATH!;
  try {
    const mapping = await create({ apply: true, externalSystem: 'screen-app', externalComponent: 'Button', oodsTraits: ['Stateful'], substitution: { component: 'Button', [framework]: { package: '@team/buttons', export: 'TeamButton', version: '1.0.0' } } });
    expect(mapping.status).toBe('ok');
    const result = await generate({ framework, schema: { version: '2026.09', screens: [{ id: 'button', component: 'Button', props: { content: 'Save' } }] }, options: { output: 'application' } });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(JSON.parse(result.artifact!.files.find(file => file.path === 'package.json')!.contents).dependencies['@team/buttons']).toBe('1.0.0');
    expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
    expect(result.componentContracts?.[0]?.component).toBe('Button');
  } finally { fs.rmSync(mappingFile, { force: true }); }
});

it.each(['react', 'vue'] as const)('sets the shadcn dark class for %s application documents, and never for light or hc', async framework => {
  for (const theme of ['dark', 'light', 'hc'] as const) {
    const result = await generate({ schema, framework, options: { output: 'application', theme } });
    expect(result.status).toBe('ok');
    const html = result.artifact!.files.find(file => file.path === 'index.html')!.contents;
    expect(html.includes('class="dark"')).toBe(theme === 'dark');
    expect(html).toContain(`data-theme="${theme}"`);
    const css = result.artifact!.files.find(file => file.path === 'src/app.css')!.contents;
    expect(css).toContain('[data-theme="dark"] { color-scheme: dark; }');
    expect(css).toContain('[data-theme="light"], [data-theme="hc"] { color-scheme: light; }');
  }
});

// The screen contributes its own 24px inset. At 390px, the old additional 24px
// application gutter shrank the 302px native chart and its axis labels to 294px.
it.each(['react', 'vue'] as const)('keeps room for native chart text in the %s phone application shell', async framework => {
  const result = await generate({ schema, framework, options: { output: 'application' } });
  expect(result.status).toBe('ok');
  const css = result.artifact!.files.find(file => file.path === 'src/app.css')!.contents;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 600 });
      await page.setContent(`<style>${css}</style><main class="screen-app"><main style="padding:24px"><figure style="margin:0"></figure></main></main>`);
      const figureWidth = await page.locator('figure').evaluate(node => node.getBoundingClientRect().width);
      if (width === 390) expect(figureWidth).toBeGreaterThanOrEqual(302);
      else expect(figureWidth).toBe(928); // Preserve the existing desktop shell.
    }
  } finally { await browser.close(); }
});

it('keeps the first and last payment dates inside the phone SVG without dropping payments', async () => {
  const { handle: render } = await import('../../src/tools/viz.render.js');
  const dates = ['Jan 15', 'Feb 15', 'Mar 15', 'Apr 15', 'May 17', 'Jun 15', 'Jul 15', 'Aug 15', 'Aug 16', 'Aug 19', 'Sep 15'];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    for (const theme of ['light', 'dark', 'hc'] as const) {
      const result = await render({ chartType: 'bar', theme,
        rows: dates.map((date, index) => ({ payment: `${date}, 2026`, amount: index === 9 ? -19 : 19 })) as any,
        encodings: { x: { field: 'payment', type: 'ordinal', sort: 'none', title: 'Payment date' }, y: { field: 'amount', aggregate: 'sum', currency: 'EUR', title: 'Amount' } },
        output: { svg: true, width: 292, height: 240, titlePlacement: 'figure' } });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      await page.setContent(result.svg!);
      const measured = await page.evaluate(() => {
        const svg = document.querySelector('svg')!, bounds = svg.getBoundingClientRect();
        const axis = [...svg.querySelectorAll('[aria-roledescription="axis"]')].find(node => node.getAttribute('aria-label')?.startsWith('X-axis'))!;
        return { bars: svg.querySelectorAll('[aria-roledescription="bar"]').length,
          labels: [...axis.querySelectorAll('.role-axis-label text')].filter(node => getComputedStyle(node).opacity !== '0').map(node => {
            const box = node.getBoundingClientRect();
            const lines = [...node.querySelectorAll('tspan')].map(line => line.textContent);
            return { text: lines.length ? lines.join(', ') : node.textContent, left: box.left - bounds.left, right: bounds.right - box.right };
          }) };
      });
      expect(measured.bars).toBe(11);
      expect(measured.labels.map(label => label.text)).toEqual(expect.arrayContaining(['Jan 15, 2026', 'Sep 15, 2026']));
      for (const label of measured.labels) {
        expect(label.left, `${theme}: ${label.text} left edge`).toBeGreaterThanOrEqual(-0.5);
        expect(label.right, `${theme}: ${label.text} right edge`).toBeGreaterThanOrEqual(-0.5);
      }
    }
  } finally { await browser.close(); }
});
