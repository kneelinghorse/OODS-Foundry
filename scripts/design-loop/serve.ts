import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser } from 'playwright';
import { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as generate } from '../../packages/mcp-server/src/tools/code.generate.js';
import { validateGeneratedArtifact } from '../../packages/mcp-server/src/codegen/artifact-envelope.js';
import { isKnownBrand } from '../../packages/mcp-server/src/lib/brand-registry.js';
import { packFoundationPackages } from '../product-reality/s182-m04-consumer-harness.mjs';
import { ensureConsumerRollup } from '../product-reality/consumer-rollup.mjs';
import { prepareManifest, commandResult, requireGreen, isolatedNpmEnvironment, assertInstalledIsolation, resolveImports, launchProofBrowser, type PackedPackageRecord } from '../product-reality/s184-m06-live-consumers.js';
import { DEFAULT_PORT, DEFAULT_STATE, outputDirectory, relativeFile, validateReceipt, writeJson, type CaptureRequest, type Framework } from './common.js';
import { applySteps, observeView } from './observe.js';

interface LoopVite {
  close(): Promise<void>;
  listen(): Promise<unknown>;
  moduleGraph: { invalidateAll(): void };
  transformRequest(url: string): Promise<unknown>;
}
interface Consumer { framework: Framework; root: string; port: number; vite: LoopVite; packages: Array<Record<string, unknown>>; isolation: Record<string, unknown> }
export function consumerEntries(framework: Framework, request: CaptureRequest): Record<string, string> {
  const files = Object.fromEntries(request.artifact.files.map(file => [file.path, file.contents]));
  if (files['package.json']) return files; // Workflow carries its own untouched mount and wiring.
  const theme = request.theme ?? 'light', brand = request.brand ?? 'A';
  assert(['light', 'dark'].includes(theme) && isKnownBrand(brand), 'Unsupported theme or brand.');
  const page = request.artifact.files[0]!.path;
  const model = JSON.stringify(request.model);
  // Standalone pages require action operands. Observe calls without inventing workflow state.
  const actions = `{${request.artifact.actions.map(action => `${JSON.stringify(action.name)}: (...args: unknown[]) => window.dispatchEvent(new CustomEvent('oods-design-loop-action', { detail: { name: ${JSON.stringify(action.name)}, args } }))`).join(',')}}`;
  return { ...files,
    'index.html': '<!doctype html><html lang="en" data-theme="' + theme + '" data-brand="' + brand + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body data-theme="' + theme + '" data-brand="' + brand + '" style="color-scheme:' + theme + ';margin:0;background:var(--sys-surface-canvas);color:var(--sys-text-primary)"><div id="app"></div><script type="module" src="/src/main.' + (framework === 'react' ? 'tsx' : 'ts') + '"></script></body></html>',
    [framework === 'react' ? 'src/main.tsx' : 'src/main.ts']: framework === 'react'
      ? `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { GeneratedUI as Page } from './${path.basename(page)}';\nconst actions = ${actions};\ncreateRoot(document.getElementById('app')!).render(<Page {...${model}} actions={actions} />);\n`
      : `import { createApp } from 'vue';\nimport Page from './${path.basename(page)}';\nconst actions = ${actions};\ncreateApp(Page, { ...${model}, actions }).mount('#app');\n`,
  };
}

async function capture(consumer: Consumer, browser: Browser, request: CaptureRequest) {
  const started = performance.now();
  assert.equal(request.framework, consumer.framework);
  assert.deepEqual(validateGeneratedArtifact(request.artifact), []);
  const output = await outputDirectory(request.output);
  const sourceFiles = consumerEntries(consumer.framework, request);
  for (const file of Object.keys(sourceFiles)) relativeFile(consumer.root, file);
  assertInstalledIsolation(consumer.root, consumer.framework, consumer.packages, sourceFiles);
  resolveImports(consumer.root, sourceFiles);
  // Only our generated source tree is replaced. Installed tarballs and Vite config persist.
  await fs.rm(path.join(consumer.root, 'src'), { recursive: true, force: true });
  for (const [file, contents] of Object.entries(sourceFiles)) {
    if (file === 'package.json' || file.startsWith('vite.config.')) continue;
    const destination = relativeFile(consumer.root, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, contents);
  }
  consumer.vite.moduleGraph.invalidateAll();
  await consumer.vite.transformRequest(`/src/main.${consumer.framework === 'react' ? 'tsx' : 'ts'}`);
  await fs.mkdir(output, { recursive: true });
  await writeJson(path.join(output, 'artifact.json'), request.artifact);
  const page = await browser.newPage({ viewport: { width: request.widths[0], height: 1000 }, locale: 'en-US', timezoneId: 'UTC' });
  const errors: Array<{ type: string; text: string }> = [];
  page.on('pageerror', error => errors.push({ type: 'page', text: error.message }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', text: message.text() }); });
  try {
    await page.clock.setFixedTime(new Date('2026-09-08T12:00:00.000Z'));
    await page.goto(`http://127.0.0.1:${consumer.port}`, { waitUntil: 'networkidle' });
    await page.locator('[data-oods-component]').first().waitFor({ timeout: 8000 });
    if (sourceFiles['package.json']) await page.locator('[data-oods-workflow][data-ui-state="success"]').waitFor();
    await applySteps(page, request.steps, Date.parse('2026-09-08T12:00:00.000Z'));
    const views = [];
    for (const width of request.widths) views.push(await observeView(page, width, output));
    const receipt = {
      version: '1.1', theme: request.theme, brand: request.brand, framework: consumer.framework, compose: request.compose,
      schemaHash: request.schemaHash, artifactContentHash: request.artifact.contentHash,
      files: request.artifact.files.map(({ path, contentHash }) => ({ path, contentHash })),
      sourceHead: request.sourceHead, model: request.model, steps: request.steps,
      clock: new Date(Date.parse('2026-09-08T12:00:00.000Z') + request.steps.length).toISOString(), clockStepMs: 1, locale: 'en-US', timezone: 'UTC',
      packages: consumer.packages, views, errors,
      timings: { ...request.timings, captureMs: performance.now() - started },
      output, consumer: { root: consumer.root, port: consumer.port, pid: process.pid },
    };
    await validateReceipt(receipt);
    await writeJson(path.join(output, 'receipt.json'), receipt);
    return receipt;
  } catch (error) {
    await writeJson(path.join(output, 'failure.json'), { schemaHash: request.schemaHash, artifactContentHash: request.artifact.contentHash, errors, message: error instanceof Error ? error.message : String(error), accessibility: await page.locator('body').ariaSnapshot().catch(() => '') });
    throw error;
  } finally { await page.close(); }
}

export async function serve({ port = DEFAULT_PORT, state = DEFAULT_STATE } = {}) {
  const started = performance.now();
  const consumers: Consumer[] = [];
  let browser: Browser | undefined;
  let ready = false, busy = false;
  const server = http.createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    try {
      if (request.headers.origin) throw new Error('Browser-origin requests are not accepted by the local controller.');
      if (request.method === 'GET' && request.url === '/status') {
        response.statusCode = ready ? 200 : 503;
        response.end(JSON.stringify({ running: ready, pid: process.pid, port, state, startupMs: ready ? startupMs : null, consumers: consumers.map(({ vite: _vite, ...record }) => record) }));
        return;
      }
      if (request.method !== 'POST' || request.url !== '/render' || !ready) throw new Error('Design loop is not ready for rendering.');
      if (busy) { response.statusCode = 409; response.end(JSON.stringify({ error: 'A render is already in progress.' })); return; }
      busy = true;
      try {
        const chunks: Buffer[] = []; let bytes = 0;
        for await (const chunk of request) { bytes += chunk.length; if (bytes > 10_000_000) throw new Error('Render request exceeds 10 MB.'); chunks.push(chunk); }
        const input = JSON.parse(Buffer.concat(chunks).toString()) as CaptureRequest;
        const consumer = consumers.find(value => value.framework === input.framework);
        if (!consumer) throw new Error('Unsupported framework.');
        response.end(JSON.stringify(await capture(consumer, browser!, input)));
      } finally { busy = false; }
    } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
  });
  let startupMs = 0;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const close = async () => { ready = false; await Promise.all(consumers.map(consumer => consumer.vite.close())); await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve())); };
  try {
    await fs.mkdir(state, { recursive: true });
    const packRun = await fs.mkdtemp(path.join(state, 'packages-'));
    const tarballs = await packFoundationPackages(packRun) as PackedPackageRecord[];
    const composition = await compose({ object: 'Subscription', context: 'workflow' });
    assert.equal(composition.status, 'ok');
    for (const framework of ['react', 'vue'] as const) {
      const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), `oods-design-loop-${framework}-`)));
      const generated = await generate({ schema: composition.schema, framework, profile: 'build' });
      assert.equal(generated.status, 'ok');
      const prepared = await prepareManifest(framework, generated.artifact!, tarballs, root);
      await writeJson(path.join(root, 'package.json'), prepared.manifest);
      const userConfig = path.join(root, 'empty-user.npmrc'), globalConfig = path.join(root, 'empty-global.npmrc');
      await Promise.all([userConfig, globalConfig, path.join(root, '.npmrc')].map(file => fs.writeFile(file, '')));
      const environment = isolatedNpmEnvironment(root, userConfig, globalConfig);
      const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--userconfig', userConfig];
      const install = commandResult('npm', installArgs, root, { environment, scrubNpmCredentials: true });
      await writeJson(path.join(state, `${framework}-install.json`), install);
      requireGreen(install, `${framework} exact tarball install`);
      await writeJson(path.join(state, `${framework}-rollup.json`), await ensureConsumerRollup(root, async extraArgs => {
        const retry = commandResult('npm', [...installArgs, ...extraArgs], root, { environment, scrubNpmCredentials: true });
        await writeJson(path.join(state, `${framework}-install-optional-retry.json`), retry);
        requireGreen(retry, `${framework} optional native package reinstall`);
      }));
      const isolation = assertInstalledIsolation(root, framework, prepared.localTarballs, {});
      const viteConfig = framework === 'vue' ? "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()] };\n" : 'export default {};\n';
      await fs.writeFile(path.join(root, 'vite.config.mjs'), viteConfig);
      const require = createRequire(path.join(root, 'package.json'));
      const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
      const vite = await createServer({ root, configFile: path.join(root, 'vite.config.mjs'), server: { host: '127.0.0.1', port: port + consumers.length + 1, strictPort: true }, logLevel: 'error' }) as LoopVite;
      await vite.listen();
      consumers.push({ framework, root, port: port + consumers.length + 1, vite, packages: prepared.localTarballs, isolation });
    }
    browser = await launchProofBrowser();
    startupMs = performance.now() - started; ready = true;
    await writeJson(path.join(state, 'serve.json'), { port, pid: process.pid, startupMs, consumers: consumers.map(({ vite: _vite, ...record }) => record) });
    return { port, startupMs, close };
  } catch (error) { await close(); throw error; }
}
