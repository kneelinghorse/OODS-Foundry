/**
 * s213-m04: the preview's brands and token CSS come from the token build, read when they change.
 *
 * Before this mission the brand switch offered A and B from a list in code, the host refused any other brand, and the
 * token CSS was copied into the preview runtime when the bridge was built, so a brand built afterwards had no switch
 * and no colours until the bridge was rebuilt. These tests pin the replacement: the switch, the scope check, the
 * axe record and the stylesheet all follow the token build's brands.json and tokens.css, including after a change.
 */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from './host.js';
import { defaultTokenPackageRoot } from './tokens.js';
import { activeTokenPackageRoot } from '../runtime-paths.js';
import type { CompositionVersion } from './store.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const runtimeDir = path.join(packageRoot, 'dist/preview-runtime');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const directories: string[] = [];
const servers: FastifyInstance[] = [];
const temp = () => { const dir = mkdtempSync(path.join(tmpdir(), 'oods-preview-brands-')); directories.push(dir); return dir; };
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ID = 'cmp-0123456789ab';
function record(): CompositionVersion {
  const raw = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8'));
  return {
    recordVersion: '1', compositionId: ID, version: 1, parentVersion: null, operation: 'compose', createdAt: '2026-09-15T00:00:00.000Z', head: 'a'.repeat(40),
    compose: raw.compose, schema: raw.schema, schemaHash: `sha256:${sha256(JSON.stringify(raw.schema))}`, brand: raw.brand, theme: raw.theme, slots: [], model: raw.model,
    artifacts: { react: { artifact: raw.frameworks.react.artifact, generatedAt: '2026-09-15T00:00:00.000Z' }, vue: { artifact: raw.frameworks.vue.artifact, generatedAt: '2026-09-15T00:00:00.000Z' } },
    measurements: {},
  } as CompositionVersion;
}
/** A token package root holding the shipped build's brands.json and tokens.css. */
function tokenRoot(): string {
  const root = temp();
  mkdirSync(path.join(root, 'dist/css'), { recursive: true });
  cpSync(path.join(defaultTokenPackageRoot(), 'dist/brands.json'), path.join(root, 'dist/brands.json'));
  cpSync(path.join(defaultTokenPackageRoot(), 'dist/css/tokens.css'), path.join(root, 'dist/css/tokens.css'));
  return root;
}
async function host(tokensRoot: string | (() => string)) {
  const dir = path.join(temp(), 'compositions');
  mkdirSync(path.join(dir, ID, 'versions'), { recursive: true });
  writeFileSync(path.join(dir, ID, 'versions', '1.json'), JSON.stringify(record()));
  const server = Fastify();
  servers.push(server);
  await registerPreviewHost(server, { compositionsDir: dir, runtimeDir, tokensRoot });
  return server;
}
const brandButtons = (html: string) => [...html.matchAll(/data-control="brand" data-value="([^"]+)"/g)].map(match => match[1]);

describe('s213-m04: the preview follows the token build', () => {
  it('the runtime styles carry no token values: the page links the token build\'s own stylesheet first', async () => {
    const styles = readFileSync(path.join(runtimeDir, 'styles.css'), 'utf8');
    expect(styles).not.toMatch(/--sys-[a-z0-9-]+:/);
    expect(styles).not.toMatch(/--ref-[a-z0-9-]+:/);
    const server = await host(tokenRoot());
    const page = (await server.inject({ method: 'GET', url: `/preview/${ID}/1?framework=react` })).body;
    const app = (await server.inject({ method: 'GET', url: `/preview/${ID}/1/app?framework=react` })).body;
    for (const html of [page, app]) {
      const tokens = html.indexOf('href="/preview/tokens.css"');
      expect(tokens, 'the token stylesheet is linked').toBeGreaterThan(0);
      expect(tokens, 'before the runtime styles').toBeLessThan(html.indexOf('href="/preview/runtime/styles.css"'));
    }
  });

  it('offers, accepts and records the brands the token build carries, and refuses others by naming them', async () => {
    const root = tokenRoot();
    const server = await host(root);
    expect(brandButtons((await server.inject({ method: 'GET', url: `/preview/${ID}/1?framework=react` })).body)).toEqual(['A', 'B']);
    const refused = await server.inject({ method: 'GET', url: `/preview/${ID}/1/app?framework=react&brand=C` });
    expect(refused.statusCode).toBe(400);
    expect(refused.body).toBe('brand must be one of A, B (the token build\'s brands); "C" is not built.');

    // The token build adds brand C while the host runs: no restart, no rebuild of the bridge.
    const built = JSON.parse(readFileSync(path.join(root, 'dist/brands.json'), 'utf8'));
    writeFileSync(path.join(root, 'dist/brands.json'), JSON.stringify({ ...built, brands: [...built.brands, 'C'] }));
    writeFileSync(path.join(root, 'dist/css/tokens.css'), `${readFileSync(path.join(root, 'dist/css/tokens.css'), 'utf8')}\n[data-brand='C'][data-theme='light'] { --theme-surface-canvas: oklch(0.98 0.02 150); }\n`);
    expect(brandButtons((await server.inject({ method: 'GET', url: `/preview/${ID}/1?framework=react&brand=C` })).body)).toEqual(['A', 'B', 'C']);
    const app = await server.inject({ method: 'GET', url: `/preview/${ID}/1/app?framework=react&brand=C` });
    expect(app.statusCode).toBe(200);
    expect(app.body).toContain('data-brand="C"');
    expect(app.body).toContain('"brands":["A","B","C"]');
    const compare = (await server.inject({ method: 'GET', url: `/compare/${ID}@1/${ID}@1?framework=react&brand=C` })).body;
    expect(compare).toContain('data-control="brand" data-value="C" aria-pressed="true"');

    const css = await server.inject({ method: 'GET', url: '/preview/tokens.css' });
    expect(css.headers['x-oods-brands']).toBe('A,B,C');
    expect(css.body).toContain("[data-brand='C'][data-theme='light']");
    const json = JSON.parse((await server.inject({ method: 'GET', url: '/preview/tokens.json' })).body);
    expect(json.brands).toEqual(['A', 'B', 'C']);
    expect(json.sha256).toBe(sha256(json.css));

    const axe = { engine: { name: 'axe-core', version: '4' }, framework: 'react', theme: 'light', violations: [], passes: 1, incomplete: 0, inapplicable: 0 };
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/1/measurements/axe`, payload: { ...axe, brand: 'C' } })).statusCode).toBe(200);
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/1/measurements/axe`, payload: { ...axe, brand: 'Z' } })).statusCode).toBe(400);
  });
});

describe('s213-m06: the preview follows the server to a team brand build', () => {
  // The server builds a team's brands under OODS_BRANDS_DIR/.build and names the build in active.json
  // (packages/mcp-server/src/lib/user-brands.ts); the host, a separate process, must follow it without a restart, and
  // must not use a build when no team brand is left or the build is gone.
  afterEach(() => { vi.unstubAllEnvs(); });

  it('reads the active team build once one exists, and the shipped tokens otherwise', async () => {
    const shipped = tokenRoot();
    const brands = temp();
    vi.stubEnv('OODS_BRANDS_DIR', brands);
    const server = await host(() => activeTokenPackageRoot(shipped));
    expect(activeTokenPackageRoot(shipped)).toBe(shipped);
    expect(brandButtons((await server.inject({ method: 'GET', url: `/preview/${ID}/1?framework=react` })).body)).toEqual(['A', 'B']);

    // The server creates Harbor: the team folder, its build and the pointer.
    mkdirSync(path.join(brands, 'Harbor'));
    const build = path.join(brands, '.build', 'abc-def');
    mkdirSync(path.join(build, 'dist/css'), { recursive: true });
    const built = JSON.parse(readFileSync(path.join(shipped, 'dist/brands.json'), 'utf8'));
    writeFileSync(path.join(build, 'dist/brands.json'), JSON.stringify({ ...built, brands: [...built.brands, 'Harbor'] }));
    writeFileSync(path.join(build, 'dist/css/tokens.css'), `${readFileSync(path.join(shipped, 'dist/css/tokens.css'), 'utf8')}\n[data-brand='Harbor'][data-theme='light'] { --theme-surface-canvas: oklch(0.975 0.012 205); }\n`);
    writeFileSync(path.join(brands, '.build', 'active.json'), JSON.stringify({ root: build }));
    expect(activeTokenPackageRoot(shipped)).toBe(build);
    expect(brandButtons((await server.inject({ method: 'GET', url: `/preview/${ID}/1?framework=react&brand=Harbor` })).body)).toEqual(['A', 'B', 'Harbor']);
    expect((await server.inject({ method: 'GET', url: '/preview/tokens.css' })).body).toContain("[data-brand='Harbor'][data-theme='light']");

    // No team brand left, or no build: the shipped tokens again.
    rmSync(path.join(brands, 'Harbor'), { recursive: true });
    expect(activeTokenPackageRoot(shipped)).toBe(shipped);
    expect(brandButtons((await server.inject({ method: 'GET', url: `/preview/${ID}/1?framework=react` })).body)).toEqual(['A', 'B']);
    mkdirSync(path.join(brands, 'Harbor'));
    rmSync(build, { recursive: true });
    expect(activeTokenPackageRoot(shipped)).toBe(shipped);
  });
});

it('s217 flags stored chart paint after the token build changes, preserving the generated identity', async () => {
  const root = tokenRoot();
  const dir = path.join(temp(), 'compositions');
  mkdirSync(path.join(dir, ID, 'versions'), { recursive: true });
  const saved = record();
  const tokenBuildHash = sha256(readFileSync(path.join(root, 'dist/css/tokens.css')));
  for (const entry of Object.values(saved.artifacts)) entry!.tokenBuildHash = tokenBuildHash;
  (saved.schema as any).screens[0].children ??= [];
  (saved.schema as any).screens[0].children.push({ id: 'chart', component: 'VizAreaPreview', chart: { source: 'payment-events' } });
  writeFileSync(path.join(dir, ID, 'versions', '1.json'), JSON.stringify(saved));
  const server = Fastify(); servers.push(server);
  await registerPreviewHost(server, { compositionsDir: dir, runtimeDir, tokensRoot: root });
  const url = `/preview/${ID}/1/scope.json?framework=react`;
  expect((await server.inject(url)).json().staleTokens).toBe(false);
  const css = path.join(root, 'dist/css/tokens.css');
  writeFileSync(css, readFileSync(css, 'utf8') + '\n/* a new token build */\n');
  const changed = (await server.inject(url)).json();
  expect(changed.staleTokens).toBe(true);
  expect(changed.tokenBuildHash).toBe(tokenBuildHash);
  const page = (await server.inject(`/preview/${ID}/1/app?framework=react`)).body;
  expect(page).toContain('id="oods-token-build-notice" role="status">The token build changed');
});
