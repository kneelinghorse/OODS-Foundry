import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerPreviewHost } from './host.js';
import { parseAxeResult, renderMeasurementPanel, withAxeResult, type AxeResult } from './measurements.js';
import { readVersion, type CompositionVersion, type PreviewArtifact } from './store.js';
import { previewTokens } from './tokens.js';

const runtimeDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dist/preview-runtime');
const directories: string[] = [];
const servers: FastifyInstance[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const ID = 'cmp-0123456789ab';
type Fixture = { compose: CompositionVersion['compose']; brand: CompositionVersion['brand']; theme: CompositionVersion['theme']; schema: unknown; model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const raw = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8')) as Fixture;
const version = (measurements: Record<string, unknown> = {}, frameworks: Array<'react' | 'vue'> = ['react', 'vue']): CompositionVersion => ({
  recordVersion: '1', compositionId: ID, version: 1, parentVersion: null, operation: 'compose', createdAt: '2026-09-15T00:00:00.000Z', head: null,
  compose: raw.compose, schema: raw.schema, schemaHash: 'sha256:' + 'a'.repeat(64), brand: 'A', theme: 'light', slots: [], model: raw.model,
  artifacts: Object.fromEntries(frameworks.map(framework => [framework, { artifact: raw.frameworks[framework].artifact, generatedAt: '2026-09-15T00:00:00.000Z' }])), measurements,
});
const axe = (framework: 'react' | 'vue', brand: 'A' | 'B', theme: 'light' | 'dark' | 'hc', violations = 0): AxeResult => ({ engine: { name: 'axe-core', version: '4.11.0' }, ranAt: '2026-09-15T00:01:00.000Z', url: `/preview/${ID}/1/app`, framework, brand, theme, violations: Array.from({ length: violations }, (_, index) => ({ id: `rule-${index}`, impact: 'serious', help: 'Help', helpUrl: 'https://example.test', tags: ['wcag2a'], nodes: 2, targets: ['#app'] })), passes: 12, incomplete: 1, inapplicable: 40 });
const validation = { profile: 'build', defaulted: false, rationale: 'r', axes: {}, checks: [{ name: 'schema-structure', status: 'pass' }, { name: 'component-registry', status: 'pass' }], notChecked: ['rendered-evidence', 'accessibility-evidence'], evidence: {} };
const chart = (conformant: boolean | null) => ({ path: 'src/charts/payment-001.svg', chartType: 'area', source: 'payment-events', name: 'Payment amounts', theme: 'light', brand: 'A', contentHash: 'sha256:' + 'b'.repeat(64), svgHash: 'sha256:' + 'c'.repeat(64), certification: { status: 'ok', coverage: 'certified', conformant, pillars: { accuracy: { status: 'pass' }, a11yEquivalence: { status: 'pass' }, contrast: { status: 'pass' }, determinism: { status: 'pass' } }, findings: [], determinism: null, accuracySummary: null, notes: [], contrastNote: null }, certifiedAt: '2026-09-15T00:00:30.000Z' });

describe('measurement panel (s201-m04): what was measured, and what was not', () => {
  it('names every measurement the version does not carry as not run, and nothing else', () => {
    const html = renderMeasurementPanel(version(), ['A', 'B']);
    expect(html).toContain('data-oods-not-measured="validation:react"');
    expect(html).toContain('data-oods-not-measured="validation:vue"');
    expect(html).toContain('data-oods-not-measured="charts"');
    for (const framework of ['react', 'vue']) for (const scope of ['A/light', 'A/dark', 'A/hc', 'B/light', 'B/dark', 'B/hc']) expect(html).toContain(`data-oods-not-measured="axe:${framework}:${scope}"`);
    expect(html).toContain('data-oods-not-measured-count="15"');
    expect(html).not.toContain('data-oods-measured="');
    // s211-m02: the scopes not measured share one line per framework, each still named and marked.
    expect(html.match(/<li data-oods-not-run="axe:(?:react|vue)">/g)).toHaveLength(2);
    expect(html).toContain('<strong>react</strong> not measured yet in <span data-oods-not-measured="axe:react:A/light">A/light</span>, ');
  });

  it('shows the generation receipt, every placed chart certification and axe per scope exactly as stored', () => {
    const record = withAxeResult(withAxeResult(version({ validation: { react: validation }, charts: [chart(true), { ...chart(null), path: 'src/charts/payment-002.svg' }] }), axe('react', 'A', 'light')), axe('react', 'A', 'dark', 2));
    const html = renderMeasurementPanel(record, ['A', 'B']);
    expect(html).toContain('data-oods-measured="validation:react"');
    expect(html).toContain('2 checks ran (schema-structure, component-registry)');
    expect(html).toContain('2 not checked (rendered-evidence, accessibility-evidence)');
    expect(html).toContain('data-oods-not-measured="validation:vue"');
    expect(html).toContain('data-oods-measured="chart:src/charts/payment-001.svg"');
    expect(html).toContain('<strong>conformant</strong>');
    expect(html).toContain('data-oods-measured="chart:src/charts/payment-002.svg"');
    expect(html).toContain('not on the certified path (conformant null)');
    expect(html).toContain('data-oods-measured="axe:react:A/light"');
    expect(html).toContain('0 violations (none)');
    expect(html).toContain('data-oods-measured="axe:react:A/dark"');
    expect(html).toContain('2 violations (<code>rule-0</code> (serious, 2 nodes), <code>rule-1</code> (serious, 2 nodes))');
    expect(html).toContain('data-oods-not-measured="axe:react:A/hc"');
    expect(html).toContain('data-oods-not-measured="axe:vue:A/light"');
    expect(html).toContain('data-oods-not-measured-count="11"');
    expect(renderMeasurementPanel(version({ charts: [] }), ['A', 'B'])).toContain('No chart is placed on this version; nothing to certify.');
  });

  it('accepts only a well-formed axe result', () => {
    // s213-m04: a result's brand is one the token build carries; the host passes that check in.
    const { isBrand } = previewTokens();
    expect(parseAxeResult(axe('vue', 'B', 'hc'), isBrand)).toMatchObject({ framework: 'vue', brand: 'B', theme: 'hc', passes: 12 });
    expect(parseAxeResult({ ...axe('vue', 'B', 'hc'), brand: 'Z' }, isBrand)).toBeUndefined();
    expect(parseAxeResult({ ...axe('vue', 'B', 'hc'), theme: 'sepia' }, isBrand)).toBeUndefined();
    expect(parseAxeResult({ ...axe('vue', 'B', 'hc'), engine: {} }, isBrand)).toBeUndefined();
    expect(parseAxeResult({ ...axe('vue', 'B', 'hc'), passes: -1 }, isBrand)).toBeUndefined();
    expect(parseAxeResult('nope', isBrand)).toBeUndefined();
  });

  it('stores what the running page posts, per framework and scope, without touching the schema, and serves the panel and the JSON', async () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), 'oods-measure-')), 'compositions'); directories.push(path.dirname(dir));
    const record = version({ validation: { react: validation }, charts: [chart(true)] }, ['react']);
    const folder = path.join(dir, ID, 'versions'); mkdirSync(folder, { recursive: true }); writeFileSync(path.join(folder, '1.json'), JSON.stringify(record));
    const server = Fastify(); servers.push(server);
    await registerPreviewHost(server, { compositionsDir: dir, runtimeDir });
    const light = await server.inject({ method: 'POST', url: `/preview/${ID}/1/measurements/axe`, payload: axe('react', 'A', 'light') });
    expect(light.statusCode).toBe(200);
    expect(light.json()).toEqual({ stored: true, compositionId: ID, version: 1, framework: 'react', scope: 'A/light', violations: 0, passes: 12 });
    const dark = await server.inject({ method: 'POST', url: `/preview/${ID}/1/measurements/axe`, payload: axe('react', 'A', 'dark', 1) });
    expect(dark.statusCode).toBe(200);
    const stored = readVersion(dir, ID, 1)!;
    expect(stored.schemaHash).toBe(record.schemaHash);
    expect(stored.measurements.validation).toEqual({ react: validation });
    expect(stored.measurements.charts).toEqual([chart(true)]);
    expect((stored.measurements.axe as any).react['A/light']).toEqual(axe('react', 'A', 'light'));
    expect((stored.measurements.axe as any).react['A/dark']).toEqual(axe('react', 'A', 'dark', 1));
    expect((await server.inject(`/preview/${ID}/1/measurements.json`)).json()).toEqual(stored.measurements);
    const panel = await server.inject(`/preview/${ID}/1/measurements`);
    expect(panel.body).toContain('data-oods-measured="axe:react:A/light"');
    expect(panel.body).toContain('data-oods-measured="axe:react:A/dark"');
    expect(panel.body).toContain('data-oods-not-measured="axe:react:B/light"');
    expect((await server.inject(`/preview/${ID}/1`)).body).toContain('data-oods-measured="axe:react:A/dark"');
    expect((await server.inject(`/preview/${ID}/1/app`)).body).toContain('/preview/runtime/axe.js');
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/1/measurements/axe`, payload: axe('vue', 'A', 'light') })).statusCode).toBe(409);
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/1/measurements/axe`, payload: { framework: 'react' } })).statusCode).toBe(400);
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/2/measurements/axe`, payload: axe('react', 'A', 'light') })).statusCode).toBe(404);
  });

  it('a runtime built without axe leaves the page without an axe run and the panel says so', async () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), 'oods-measure-')), 'compositions'); directories.push(path.dirname(dir));
    const noAxe = mkdtempSync(path.join(tmpdir(), 'oods-runtime-noaxe-')); directories.push(noAxe);
    const manifest = JSON.parse(readFileSync(path.join(runtimeDir, 'manifest.json'), 'utf8'));
    delete manifest.files['axe.js']; delete manifest.importMap['axe-core']; delete manifest.axe;
    for (const file of Object.keys(manifest.files)) writeFileSync(path.join(noAxe, file), readFileSync(path.join(runtimeDir, file)));
    writeFileSync(path.join(noAxe, 'manifest.json'), JSON.stringify(manifest));
    const record = version({}, ['react']);
    const folder = path.join(dir, ID, 'versions'); mkdirSync(folder, { recursive: true }); writeFileSync(path.join(folder, '1.json'), JSON.stringify(record));
    const server = Fastify(); servers.push(server);
    await registerPreviewHost(server, { compositionsDir: dir, runtimeDir: noAxe });
    const app = (await server.inject(`/preview/${ID}/1/app`)).body;
    expect(app).toContain('const axeUrl = null;');
    expect(app).not.toContain('/preview/runtime/axe.js');
    expect((await server.inject(`/preview/${ID}/1`)).body).toContain('data-oods-not-measured="axe:react:A/light"');
  });
});

it('s214: preserves unmet and unmeasured team obligations without turning package text into markup', () => {
  const report = { framework: 'react', component: 'Button', source: { package: '<script>team</script>', version: '1', export: 'Button' }, summary: { met: 1, unmet: 1, 'not-checked': 1 }, obligations: [
    { id: 'role', status: 'unmet', reason: 'Missing <button>' },
    { id: 'token:text', status: 'not-checked', reason: 'No color measurement ran.' },
  ] };
  const html = renderMeasurementPanel(version({ componentContracts: { react: [report] } }), ['A', 'B']);
  expect(html).toContain('1 met, 1 unmet, 1 not checked');
  expect(html).toContain('Warning:'); expect(html).toContain('Generation remains available.');
  expect(html).toContain('Missing &lt;button&gt;'); expect(html).toContain('No color measurement ran.');
  expect(html).not.toContain('<script>team</script>');
});

it('names the shadcn hc palette limitation only for mapped records', () => {
  const record = structuredClone(version());
  expect(renderMeasurementPanel(record, ['A'])).not.toContain('data-oods-theme-limit');
  record.artifacts.react!.artifact.substitutions = [{ source: { shadcn: { module: '@/components/oods/card', closureHash: 'sha256:' + 'a'.repeat(64) } } }];
  expect(renderMeasurementPanel(record, ['A'])).toContain('shadcn has no high-contrast theme');
});
