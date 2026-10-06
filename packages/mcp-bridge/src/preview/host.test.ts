import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { artifactEntry, compileArtifact } from './compile.js';
import { registerPreviewHost } from './host.js';
import { defaultRuntimeDirectory, loadPreviewRuntime, resolveEsbuildPlatform } from './runtime.js';
import { resolveCompositionsDir, type CompositionVersion, type PreviewArtifact } from './store.js';
import { previewTokens } from './tokens.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const runtimeDir = path.join(packageRoot, 'dist/preview-runtime');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const directories: string[] = [];
const servers: FastifyInstance[] = [];
const temp = () => { const dir = mkdtempSync(path.join(tmpdir(), 'oods-preview-host-')); directories.push(dir); return dir; };
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Fixture = { compose: CompositionVersion['compose']; brand: CompositionVersion['brand']; theme: CompositionVersion['theme']; schema: unknown; model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const ID = 'cmp-0123456789ab';
function fixture(name: 'subscription-card' | 'subscription-list', overrides: Partial<CompositionVersion> = {}): CompositionVersion {
  const raw = JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8')) as Fixture;
  const schemaHash = `sha256:${sha256(JSON.stringify(raw.schema))}`;
  return {
    recordVersion: '1', compositionId: ID, version: 1, parentVersion: null, operation: 'compose', createdAt: '2026-09-15T00:00:00.000Z', head: 'a'.repeat(40),
    compose: raw.compose, schema: raw.schema, schemaHash, brand: raw.brand, theme: raw.theme, slots: [], model: raw.model,
    artifacts: { react: { artifact: raw.frameworks.react.artifact, generatedAt: '2026-09-15T00:00:00.000Z' }, vue: { artifact: raw.frameworks.vue.artifact, generatedAt: '2026-09-15T00:00:00.000Z' } },
    measurements: {}, ...overrides,
  };
}
function store(...records: CompositionVersion[]): string {
  const dir = path.join(temp(), 'compositions');
  for (const record of records) {
    const folder = path.join(dir, record.compositionId, 'versions');
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, `${record.version}.json`), JSON.stringify(record));
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}
async function host(compositionsDir: string) {
  const server = Fastify();
  servers.push(server);
  const status = await registerPreviewHost(server, { compositionsDir, runtimeDir });
  return { server, status };
}
const bareImports = (code: string) => [...code.matchAll(/from\s*"([^"]+)"/g)].map(match => match[1]!).filter(specifier => !specifier.startsWith('.'));

describe('preview host runtime', () => {
  it('refuses to register without the prebuilt runtime, and never serves a partial one', async () => {
    const empty = temp();
    expect(() => loadPreviewRuntime(empty)).toThrow(/Preview host runtime is missing/);
    await expect(registerPreviewHost(Fastify(), { compositionsDir: temp(), runtimeDir: empty })).rejects.toThrow(/runtime is missing/);
    const partial = temp();
    const manifest = JSON.parse(readFileSync(path.join(runtimeDir, 'manifest.json'), 'utf8'));
    writeFileSync(path.join(partial, 'manifest.json'), JSON.stringify(manifest));
    expect(() => loadPreviewRuntime(partial)).toThrow(/runtime file is missing/);
  });

  it('ships one React, one Vue and the foundation packages as shared ES modules with the styles', () => {
    const runtime = loadPreviewRuntime(runtimeDir);
    expect(defaultRuntimeDirectory()).toBe(runtimeDir);
    expect(runtime.manifest).toMatchObject({ version: 1, esbuild: '0.25.10', styles: 'styles.css' });
    expect(Object.keys(runtime.manifest.importMap).sort()).toEqual(['@oods/component-contracts', '@oods/component-styles', '@oods/components-react', '@oods/components-react/status', '@oods/components-react/table', '@oods/components-vue', 'axe-core', 'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'vue']);
    expect(runtime.manifest.axe).toBe('4.11.0');
    expect(readFileSync(path.join(runtimeDir, 'axe.js'), 'utf8')).toMatch(/axe-core/);
    for (const [file, meta] of Object.entries(runtime.manifest.files)) {
      const bytes = readFileSync(path.join(runtimeDir, file));
      expect(bytes.length, file).toBe(meta.bytes);
      expect(sha256(bytes), file).toBe(meta.sha256);
    }
    // Named exports survive the CommonJS boundary: the generated code imports Fragment and createRoot by name.
    expect(readFileSync(path.join(runtimeDir, runtime.manifest.importMap['react/jsx-runtime']!), 'utf8')).toMatch(/Fragment/);
    expect(readFileSync(path.join(runtimeDir, runtime.manifest.importMap['react-dom/client']!), 'utf8')).toMatch(/createRoot/);
    const styles = readFileSync(path.join(runtimeDir, runtime.manifest.styles), 'utf8');
    // s213-m04: the runtime styles are the component CSS only. The token values, every brand and theme scope, come from
    // the token build's tokens.css, which the host serves beside them (brands.s213.test.ts), so a brand built after the
    // bridge still has its colours.
    expect(styles).toContain('var(--sys-surface-canvas');
    expect(styles).not.toMatch(/--sys-surface-canvas:/);
    const tokens = readFileSync(path.join(previewTokens().root, 'dist/css/tokens.css'), 'utf8');
    for (const brand of previewTokens().brands()) for (const theme of ['light', 'dark', 'hc']) expect(tokens).toMatch(new RegExp(`\\[data-brand=["']?${brand}["']?\\]\\[data-theme=["']?${theme}["']?\\]`));
  });

  it('resolves the shipped esbuild binary for this platform and names the unsupported ones', () => {
    expect(resolveEsbuildPlatform()).toMatchObject({ supported: true, os: process.platform, arch: process.arch });
    expect(resolveEsbuildPlatform({}, 'win32-x64')).toMatchObject({ supported: false, os: 'win32', arch: 'x64' });
    expect(resolveEsbuildPlatform({}, 'win32-x64').reason).toMatch(/darwin-arm64, darwin-x64, linux-x64, linux-arm64/);
    // s206-m03: why it cannot compile decides what the tester is told to do (design.preview words the next step).
    expect(resolveEsbuildPlatform({}, 'freebsd-x64')).toEqual({ supported: false, os: 'freebsd', arch: 'x64', gap: 'unshipped',
      reason: 'no esbuild binary is shipped for freebsd-x64; the preview compiles on darwin-arm64, darwin-x64, linux-x64, linux-arm64' });
    expect(resolveEsbuildPlatform()).not.toHaveProperty('gap');
  });
});

describe('preview host routes', () => {
  it('reports its store, runtime and platform on /preview/status', async () => {
    const compositionsDir = store();
    const { server, status } = await host(compositionsDir);
    const response = await server.inject('/preview/status');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(status);
    expect(status).toMatchObject({ running: true, base: '/preview', compositionsDir, runtime: { files: 20, esbuild: '0.25.10' }, platform: { supported: true } });
  });

  it.each(['subscription-card', 'subscription-list'] as const)('compiles and serves the generated React and Vue %s artifacts of a version as one ESM module each', async (name) => {
    const record = fixture(name);
    const { server } = await host(store(record));
    const runtime = loadPreviewRuntime(runtimeDir).manifest;
    for (const framework of ['react', 'vue'] as const) {
      const artifact = record.artifacts[framework]!.artifact;
      expect(artifactEntry(artifact)).toBe(framework === 'react' ? 'src/GeneratedUI.tsx' : 'src/GeneratedUI.vue');
      const app = await server.inject(`/preview/${ID}/1/app?framework=${framework}`);
      expect(app.statusCode).toBe(200);
      expect(app.headers['content-type']).toMatch(/text\/html/);
      const html = app.body;
      expect(html).toContain('<script type="importmap">');
      expect(html).toContain('"react":"/preview/runtime/react.js"');
      expect(html).toContain('<link rel="stylesheet" href="/preview/runtime/styles.css">');
      expect(html).toContain('<html lang="en" class="dark" data-theme="dark" data-brand="B">');
      expect(html).toContain(`data-oods-preview="${ID}" data-oods-preview-version="1"`);
      expect(html).toContain(`/preview/${ID}/1/module.js?framework=${framework}`);
      expect(html).toContain(framework === 'react' ? 'root = createRoot(document.getElementById' : "app.mount('#app')");
      expect(html).toContain("event.data.type === 'oods-preview-scope'");
      for (const action of artifact.actions) expect(html).toContain(`${JSON.stringify(action.name)}: (...args) => { document.getElementById('oods-action-notice').textContent`);
      expect(html).toContain(JSON.stringify(record.model).slice(0, 40));

      const module = await server.inject(`/preview/${ID}/1/module.js?framework=${framework}`);
      expect(module.statusCode, module.body.slice(0, 500)).toBe(200);
      expect(module.headers['content-type']).toMatch(/text\/javascript/);
      expect(module.headers['x-oods-artifact-hash']).toBe(artifact.contentHash);
      expect(module.headers['x-oods-compiled-sha256']).toBe(sha256(module.body));
      expect(module.body).toMatch(framework === 'react' ? /export\s*\{[^}]*GeneratedUI/ : /export\s*\{[^}]*as default/);
      expect(module.body).not.toContain('@oods/component-styles/css');
      expect(module.body).not.toMatch(/<template>|lang="ts"/);
      const imports = bareImports(module.body);
      expect(imports.length).toBeGreaterThan(0);
      for (const specifier of imports) expect(runtime.importMap, `${specifier} must be in the import map`).toHaveProperty([specifier]);
      expect(imports).toContain(framework === 'react' ? '@oods/components-react' : '@oods/components-vue');
      for (const component of new Set([...artifact.files[0]!.contents.matchAll(/data-oods-component="([A-Za-z]+)"/g)].map(match => match[1]!))) expect(module.body).toContain(component);
      expect((await server.inject(`/preview/${ID}/1/module.js?framework=${framework}`)).body).toBe(module.body);
    }
    const stored = await server.inject(`/preview/${ID}/1/record.json`);
    expect(stored.json()).toEqual(record);
  });

  it('opens one URL per version with its lineage, and the same URL answers the same after the host restarts', async () => {
    const first = fixture('subscription-card');
    const second = fixture('subscription-list', { version: 2, parentVersion: 1, operation: 'recompose', createdAt: '2026-09-15T01:00:00.000Z' });
    const compositionsDir = store(first, second);
    let { server } = await host(compositionsDir);
    const page = await server.inject(`/preview/${ID}/2?framework=vue`);
    expect(page.statusCode).toBe(200);
    const html = page.body;
    expect(html).toContain('data-oods-lineage="true"');
    expect(html).toContain(`<code>${ID}</code>`);
    expect(html).toContain('<strong>2</strong> of 2');
    expect(html).toContain(`<a href="/preview/${ID}/1?framework=vue&brand=B&theme=dark">version 1</a>`);
    expect(html).toContain('<code>recompose</code>');
    expect(html).toContain(`<code>${'a'.repeat(40)}</code>`);
    expect(html).toContain(`<code>${second.schemaHash.slice(7, 19)}</code>`);
    expect(html).toContain('<li aria-current="true"><strong>v2</strong> · recompose ← v1</li>');
    expect(html).toContain(`<a href="/preview/${ID}/1?framework=vue&brand=B&theme=dark">v1</a> · compose`);
    expect(html).toContain(`<iframe data-oods-app="true" src="/preview/${ID}/2/app?framework=vue&brand=B&theme=dark"`);
    for (const control of ['framework', 'brand', 'theme', 'width']) expect(html).toContain(`data-oods-controls="${control}"`);
    expect(html).toContain('<button type="button" data-control="theme" data-value="dark" aria-pressed="true">dark</button>');
    // s211-m02: a preview link opens at the width of the window; 1440 is a choice.
    expect(html).toContain('<button type="button" data-control="width" data-value="fit" aria-pressed="true">fit</button>');
    expect(html).toContain('<button type="button" data-control="width" data-value="1440" aria-pressed="false">1440</button>');
    expect(html).toContain("postMessage({ type: 'oods-preview-scope', brand: state.brand, theme: state.theme }, '*')");
    const versionOne = await server.inject(`/preview/${ID}/1`);
    expect(versionOne.body).toContain('none (first version)');
    expect(versionOne.body).toContain('<strong>1</strong> of 2');
    const versions = await server.inject(`/preview/${ID}/versions.json`);
    // s202-m04: versions.json also names the standing acceptance, null until a version is accepted.
    expect(versions.json()).toEqual({ compositionId: ID, versions: [
      { version: 1, parentVersion: null, operation: 'compose', createdAt: first.createdAt, schemaHash: first.schemaHash, head: first.head, artifacts: ['react', 'vue'] },
      { version: 2, parentVersion: 1, operation: 'recompose', createdAt: second.createdAt, schemaHash: second.schemaHash, head: second.head, artifacts: ['react', 'vue'] },
    ], accepted: null });
    const latest = await server.inject(`/preview/${ID}?framework=react`);
    expect(latest.statusCode).toBe(302);
    expect(latest.headers.location).toBe(`/preview/${ID}/2?framework=react`);
    // Durable: a fresh host over the same directory answers the same bytes for the same URL.
    await server.close(); servers.splice(0);
    ({ server } = await host(compositionsDir));
    expect((await server.inject(`/preview/${ID}/2?framework=vue`)).body).toBe(html);
    expect((await server.inject(`/preview/${ID}/2/module.js?framework=vue`)).statusCode).toBe(200);
  });

  it('re-mounts with the requested brand, theme and width without touching the artifact', async () => {
    const record = fixture('subscription-card');
    const { server } = await host(store(record));
    const shell = (await server.inject(`/preview/${ID}/1?framework=vue&brand=A&theme=hc&width=390`)).body;
    expect(shell).toContain('<html lang="en" data-theme="hc" data-brand="A">');
    expect(shell).toContain(`src="/preview/${ID}/1/app?framework=vue&brand=A&theme=hc"`);
    expect(shell).toContain('style="width:390px"');
    expect(shell).toContain('<button type="button" data-control="width" data-value="390" aria-pressed="true">390</button>');
    const free = (await server.inject(`/preview/${ID}/1?width=free`)).body;
    expect(free).toContain('data-value="free" aria-pressed="true"');
    expect(free).toContain('data-control="width-input">');
    const app = (await server.inject(`/preview/${ID}/1/app?framework=vue&brand=A&theme=hc`)).body;
    expect(app).toContain('<html lang="en" data-theme="hc" data-brand="A">');
    expect(app).toContain('<body data-theme="hc" data-brand="A" style="color-scheme:light">');
    // Without a placed chart the same artifact mounts in every scope: generatedFor is the requested scope, not chart-scoped.
    expect(app).toContain('"generatedFor":{"brand":"A","theme":"hc","chartScoped":false}');
    expect((await server.inject(`/preview/${ID}/1?brand=C`)).statusCode).toBe(400);
    expect((await server.inject(`/preview/${ID}/1?theme=sepia`)).statusCode).toBe(400);
    expect((await server.inject(`/preview/${ID}/1?width=10`)).statusCode).toBe(400);
  });

  it('answers scope.json for a version without a placed chart with the requested scope, and serves a scoped generation for one that has it (s202-m01)', async () => {
    const record = fixture('subscription-card');
    const { server } = await host(store(record));
    const plain = (await server.inject(`/preview/${ID}/1/scope.json?framework=react&brand=A&theme=hc`)).json();
    expect(plain).toMatchObject({ compositionId: ID, version: 1, framework: 'react', brand: 'A', theme: 'hc', available: true, chartScoped: false, generatedFor: { brand: 'A', theme: 'hc', chartScoped: false }, moduleUrl: `/preview/${ID}/1/module.js?framework=react&brand=A&theme=hc`, artifactContentHash: record.artifacts.react!.artifact.contentHash, charts: [] });
    // A version whose screen places a chart: its SVG was rendered for the version's own scope; another scope needs its own generation.
    const screen = (record.schema as { screens: Array<Record<string, unknown> & { children?: unknown[] }> }).screens[0]!;
    const schema = { ...(record.schema as object), screens: [{ ...screen, children: [...(screen.children ?? []), { id: 've-chart-1', component: 'VizAreaPreview', chart: { chartType: 'area', source: 'record-array', dataField: 'rows', encodings: {} }, props: { title: 'Payment amounts' } }] }] };
    const scoped: PreviewArtifact = { ...record.artifacts.react!.artifact, contentHash: `sha256:${'1'.repeat(64)}` };
    const other = record.brand === 'A' ? 'B' : 'A';
    const key = `${other}/${record.theme}`;
    const charts = [{ path: 'src/charts/payment-001.svg', brand: other, theme: record.theme, certification: { conformant: true } }];
    const { server: chartHost } = await host(store({ ...record, schema, scopes: { [key]: { artifacts: { react: { artifact: scoped, generatedAt: record.createdAt } }, charts } } }));
    const own = await chartHost.inject(`/preview/${ID}/1/module.js?framework=react&brand=${record.brand}&theme=${record.theme}`);
    expect(own.statusCode).toBe(200);
    expect(own.headers['x-oods-generated-for']).toBe(`${record.brand}/${record.theme}`);
    expect(own.headers['x-oods-artifact-hash']).toBe(record.artifacts.react!.artifact.contentHash);
    const switched = await chartHost.inject(`/preview/${ID}/1/module.js?framework=react&brand=${other}&theme=${record.theme}`);
    expect(switched.statusCode).toBe(200);
    expect(switched.headers['x-oods-generated-for']).toBe(key);
    expect(switched.headers['x-oods-artifact-hash']).toBe(scoped.contentHash);
    const info = (await chartHost.inject(`/preview/${ID}/1/scope.json?framework=react&brand=${other}&theme=${record.theme}`)).json();
    expect(info).toMatchObject({ available: true, chartScoped: true, generatedFor: { brand: other, theme: record.theme, chartScoped: true }, artifactContentHash: scoped.contentHash, charts });
    // The version's own scope answers its own certification; a scope nobody generated is typed unavailable without a native runner.
    const ownInfo = (await chartHost.inject(`/preview/${ID}/1/scope.json?framework=react&brand=${record.brand}&theme=${record.theme}`)).json();
    expect(ownInfo).toMatchObject({ available: true, generatedFor: { brand: record.brand, theme: record.theme, chartScoped: true }, artifactContentHash: record.artifacts.react!.artifact.contentHash, charts: null });
    const missing = (await chartHost.inject(`/preview/${ID}/1/scope.json?framework=react&brand=${other}&theme=hc`)).json();
    expect(missing).toMatchObject({ available: false, chartScoped: true, generatedFor: { brand: record.brand, theme: record.theme, chartScoped: true } });
    expect(missing.reason).toMatch(/no native server/);
    expect((await chartHost.inject(`/preview/${ID}/1/scope.json?framework=vue&brand=${other}&theme=${record.theme}`)).json()).toMatchObject({ available: false, framework: 'vue' });
    const app = (await chartHost.inject(`/preview/${ID}/1/app?framework=react&brand=${other}&theme=${record.theme}`)).body;
    expect(app).toContain(`"generatedFor":{"brand":"${other}","theme":"${record.theme}","chartScoped":true}`);
    expect(app).toContain(`"artifactContentHash":"${scoped.contentHash}"`);
    expect(app).toContain(`/preview/${ID}/1/module.js?framework=react&brand=${other}&theme=${record.theme}`);
    expect(app).toContain('/scope.json');
  });

  it('serves the runtime files the page links with their manifest digests', async () => {
    const { server } = await host(store());
    const runtime = loadPreviewRuntime(runtimeDir).manifest;
    for (const file of [runtime.importMap['react']!, runtime.importMap['vue']!, runtime.styles]) {
      const response = await server.inject(`/preview/runtime/${file}`);
      expect(response.statusCode, file).toBe(200);
      expect(sha256(response.rawPayload), file).toBe(runtime.files[file]!.sha256);
    }
    expect((await server.inject('/preview/runtime/missing.js')).statusCode).toBe(404);
  });

  it('fails the module request, not the page, when a generated artifact does not compile', async () => {
    const record = fixture('subscription-card');
    const broken: PreviewArtifact = { ...record.artifacts.react!.artifact, contentHash: `sha256:${'f'.repeat(64)}`, files: [{ path: 'src/GeneratedUI.tsx', contents: 'export const GeneratedUI = () => <div>;\n', contentHash: `sha256:${'e'.repeat(64)}` }] };
    const { server } = await host(store({ ...record, artifacts: { react: { artifact: broken, generatedAt: record.createdAt } } }));
    const module = await server.inject(`/preview/${ID}/1/module.js?framework=react`);
    expect(module.statusCode).toBe(422);
    expect(module.body).toMatch(/react artifact failed to compile/);
    expect(module.body).toMatch(/src\/GeneratedUI\.tsx:\d+: /);
    await expect(compileArtifact(broken)).rejects.toThrow(/failed to compile/);
    const vue = await server.inject(`/preview/${ID}/1/module.js?framework=vue`);
    expect(vue.statusCode).toBe(404);
    expect(vue.body).toMatch(/generated for react, not vue/);
    expect((await server.inject(`/preview/${ID}/1?framework=react`)).statusCode).toBe(200);
  });

  it('refuses unsafe ids, versions and paths, and names a missing composition or version', async () => {
    const { server } = await host(store(fixture('subscription-card')));
    expect((await server.inject('/preview/not-an-id/1')).statusCode).toBe(400);
    expect((await server.inject('/preview/CMP-0123456789AB/1')).statusCode).toBe(400);
    expect((await server.inject(`/preview/${ID}/0`)).statusCode).toBe(400);
    expect((await server.inject(`/preview/${ID}/1.5`)).statusCode).toBe(400);
    expect((await server.inject(`/preview/${ID}/2`)).statusCode).toBe(404);
    expect((await server.inject('/preview/cmp-ffffffffffff/1')).statusCode).toBe(404);
    expect((await server.inject('/preview/cmp-ffffffffffff')).statusCode).toBe(404);
    expect((await server.inject('/preview/cmp-ffffffffffff/versions.json')).statusCode).toBe(404);
    expect((await server.inject(`/preview/${ID}/1/files/..%2F..%2Fetc%2Fpasswd`)).statusCode).toBe(404);
  });

  it('reads compositions from beside the saved-schema store under the same environment the server uses', () => {
    const serverCwd = path.join(temp(), 'packages/mcp-server');
    expect(resolveCompositionsDir(serverCwd, {})).toBe(path.join(serverCwd, '.oods/compositions'));
    expect(resolveCompositionsDir(serverCwd, { MCP_SCHEMA_STORE_ROOT: '/tmp/root', MCP_SCHEMA_STORE_DIR: 'schemas' })).toBe(path.resolve('/tmp/root/compositions'));
    expect(resolveCompositionsDir(serverCwd, { MCP_SCHEMA_STORE_DIR: '/var/store/saved' })).toBe(path.resolve('/var/store/compositions'));
  });
});
