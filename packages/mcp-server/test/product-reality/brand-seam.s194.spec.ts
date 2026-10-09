import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as intake } from '../../src/tools/brand.read.js';
import { handle as apply } from '../../src/tools/brand.apply.js';
import { handle as tokens } from '../../src/tools/tokens.build.js';
import { handle as fidelity } from '../../src/tools/fidelity.preview.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { getAjv } from '../../src/lib/ajv.js';
import { refreshTokenBundle } from '../../src/lib/token-build.js';
import { resetTokensCssCache } from '../../src/render/document.js';
import { ToolError } from '../../src/errors/tool-error.js';
import type { VizRenderInput } from '../../src/schemas/generated.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const require = createRequire(path.join(root, 'package.json'));
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s194-brand-'));
const tokenRoot = path.join(temp, 'tokens');
const sourceFile = path.join(tokenRoot, 'src/tokens/brands/B/dark.json');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const read = (file: string) => fs.readFileSync(file, 'utf8');
const originalRoot = process.env.MCP_BRAND_SOURCE_ROOT;
const canonicalBefore = read(path.join(root, 'packages/tokens/src/tokens/brands/B/dark.json'));
const schemas = new Map<string, ReturnType<ReturnType<typeof getAjv>['compile']>>();
function wire(name: string, direction: 'input' | 'output', value: unknown): void {
  const key = name + '.' + direction;
  if (!schemas.has(key)) {
    const schemaName = name === 'tokens.build' && direction === 'output' ? 'generic.output' : key;
    const schema = JSON.parse(read(path.join(root, 'packages/mcp-server/src/schemas', schemaName + '.json')));
    schemas.set(key, (schema.$id ? getAjv().getSchema(schema.$id) : undefined) ?? getAjv().compile(schema));
  }
  const validate = schemas.get(key)!;
  expect(validate(JSON.parse(JSON.stringify(value))), JSON.stringify(validate.errors)).toBe(true);
}
const colorDocument = (value: string) => ({ text: { primary: { $type: 'color', $value: value } } });
beforeAll(() => {
  fs.mkdirSync(tokenRoot);
  for (const name of ['src', 'scripts', 'dist', 'style-dictionary.config.cjs', 'package.json']) {
    fs.cpSync(path.join(root, 'packages/tokens', name), path.join(tokenRoot, name), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(tokenRoot, 'node_modules'), 'dir');
  process.env.MCP_BRAND_SOURCE_ROOT = tokenRoot;
});
afterAll(async () => {
  if (originalRoot === undefined) delete process.env.MCP_BRAND_SOURCE_ROOT;
  else process.env.MCP_BRAND_SOURCE_ROOT = originalRoot;
  await refreshTokenBundle();
  resetTokensCssCache();
  expect(read(path.join(root, 'packages/tokens/src/tokens/brands/B/dark.json'))).toBe(canonicalBefore);
  fs.rmSync(temp, { recursive: true, force: true });
});

describe('s194 brand seam crosses real tool and browser boundaries', () => {
  it('a validated brand change moves source, chart SVG, generated app CSS and a governed component in B/dark', async () => {
    // s213-m05: brand.intake validates brand B with the change (the brand contrast rules included) before it is applied.
    const templateInput = { action: 'template' as const, from: { brand: 'B' } };
    wire('brand.read', 'input', templateInput);
    const template = await intake(templateInput) as any;
    wire('brand.read', 'output', template);
    template.documents.dark.text.primary.$value = '#ffddee';
    const validateInput = { action: 'validate' as const, documents: template.documents };
    wire('brand.read', 'input', validateInput);
    const accepted = await intake(validateInput) as any;
    wire('brand.read', 'output', accepted);
    expect(accepted.issues).toEqual([]);
    const input = validateInput;
    const applyInput = { brand: 'B', strategy: 'alias' as const, delta: { dark: { color: { brand: { B: colorDocument('#ffddee') } } } }, apply: false };
    wire('brand.apply', 'input', applyInput);
    const beforeSource = fs.readFileSync(sourceFile);
    const dryRun = await apply(applyInput);
    wire('brand.apply', 'output', dryRun);
    expect(dryRun.receipt).toMatchObject({ sourceWritten: false, sourceFiles: [], build: null, changes: [{ theme: 'dark', slot: 'text.primary', after: '#ffddee' }] });
    expect(dryRun.receipt.validation.valid).toBe(true);
    expect(fs.readFileSync(sourceFile)).toEqual(beforeSource);

    const samples = JSON.parse(read(path.join(root, 'packages/component-contracts/fixtures/viz-preview-samples.v1.json')));
    const chartInput = { ...samples.samples.VizLinePreview.input, theme: 'dark', brand: 'B' } as VizRenderInput;
    wire('viz.render', 'input', chartInput);
    const beforeChart = await render(chartInput);
    wire('viz.render', 'output', beforeChart);
    expect(beforeChart.status, JSON.stringify(beforeChart.errors)).toBe('ok');
    const compositionInput = { object: 'Subscription', context: 'workflow' as const };
    wire('design.compose', 'input', compositionInput);
    const composition = await compose(compositionInput);
    wire('design.compose', 'output', composition);
    expect(composition.status).toBe('ok');
    const schemaBytes = JSON.stringify(composition.schema);
    const generationInput = { schema: composition.schema!, framework: 'react' as const, profile: 'build' as const, options: { theme: 'dark' as const, brand: 'B' as const } };
    wire('code.generate', 'input', generationInput);
    const appRoot = path.join(temp, 'app');
    fs.mkdirSync(appRoot);
    // The canonical in-repo TMPDIR has another checkout above it. Resolve this
    // consumer against the measured worktree so React hooks share one runtime.
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(appRoot, 'node_modules'), 'dir');
    const buildApp = async () => {
      const generated = await generate(generationInput);
      wire('code.generate', 'output', generated);
      expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
      for (const file of generated.artifact!.files) {
        const dest = path.join(appRoot, file.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, file.contents);
      }
      expect(read(path.join(appRoot, 'index.html'))).toContain('data-theme="dark" data-brand="B"');
      const bundled = await esbuild.build({ entryPoints: [path.join(appRoot, 'src/main.tsx')], outfile: path.join(appRoot, 'bundle.js'),
        bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent',
        nodePaths: [path.join(root, 'node_modules'), path.join(root, 'packages/mcp-server/node_modules'), path.join(root, 'packages/components-react/node_modules')],
        alias: { '@oods/tokens/css': path.join(tokenRoot, 'dist/css/tokens.css') },
        // s221-m02: the token CSS names DM Sans's files beside it; the browser bundle carries them as data.
        loader: { '.svg': 'dataurl', '.woff2': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' },
      });
      const reactEntries = Object.keys(bundled.metafile.inputs).filter(file => /[/\\]node_modules[/\\]react[/\\]index\.js$/.test(file));
      expect(reactEntries.map(file => fs.realpathSync(path.resolve(file)))).toEqual([fs.realpathSync(require.resolve('react'))]);
      // The actual generated package import must resolve to the rebuilt token copy.
      expect(Object.keys(bundled.metafile.inputs).some(file => fs.realpathSync(path.resolve(file)) === fs.realpathSync(path.join(tokenRoot, 'dist/css/tokens.css'))), JSON.stringify(Object.keys(bundled.metafile.inputs).filter(file => file.endsWith('.css')))).toBe(true);
      return hash(read(path.join(appRoot, 'bundle.css')));
    };
    const beforeCss = await buildApp();
    const server = createServer((request, response) => {
      const url = new URL(request.url!, 'http://localhost');
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const target = path.resolve(appRoot, file);
      if (!target.startsWith(appRoot + path.sep) || !fs.existsSync(target)) { response.writeHead(404).end(); return; }
      let contents = read(target);
      if (file === 'index.html') contents = contents.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, '<link rel="stylesheet" href="/bundle.css"><script defer src="/bundle.js"></script>');
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
      response.setHeader('Cache-Control', 'no-store');
      response.end(contents);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
    const probe = async () => {
      await page.goto(origin);
      await page.waitForSelector('[data-ui-state="success"] [data-oods-component="Text"]').catch(async (error: Error) => {
        throw new Error(`${error.message}\nBrowser errors: ${JSON.stringify(errors)}\nBody: ${await page.locator('body').innerText()}`);
      });
      return page.evaluate(() => ({
        brand: document.documentElement.dataset.brand, theme: document.documentElement.dataset.theme,
        heading: getComputedStyle(document.querySelector('h1')!).color,
        component: getComputedStyle(document.querySelector('[data-oods-component="Text"]')!).color,
        token: getComputedStyle(document.documentElement).getPropertyValue('--sys-text-primary').trim(),
      }));
    };
    try {
      const beforePixels = await probe();
      const appliedInput = { ...applyInput, apply: true };
      wire('brand.apply', 'input', appliedInput);
      const applied = await apply(appliedInput);
      wire('brand.apply', 'output', applied);
      const afterSource = fs.readFileSync(sourceFile);
      expect(applied.receipt.sourceFiles).toEqual([{ path: sourceFile, sha256Before: hash(beforeSource), sha256After: hash(afterSource), bytesBefore: beforeSource.length, bytesAfter: afterSource.length }]);
      expect(applied.receipt.sourceWritten).toBe(true);
      expect(applied.receipt.build?.exitCode).toBe(0);
      expect(applied.receipt.build?.commands).toHaveLength(2);
      for (const command of applied.receipt.build!.commands) { expect(command.exitCode).toBe(0); expect(typeof command.stdout).toBe('string'); expect(typeof command.stderr).toBe('string'); }
      expect(applied.receipt.build!.commands[0].stdout.length).toBeGreaterThan(0);
      const afterChart = await render(chartInput);
      wire('viz.render', 'output', afterChart);
      expect(afterChart.status).toBe('ok');
      expect(afterChart.svgHash).not.toBe(beforeChart.svgHash);
      expect(afterChart.svg).toMatch(/#ffddee|rgb\(255, 221, 238\)/i);
      const afterCss = await buildApp();
      expect(afterCss).not.toBe(beforeCss);
      const afterPixels = await probe();
      expect(afterPixels).toMatchObject({ brand: 'B', theme: 'dark', heading: 'rgb(255, 221, 238)', component: 'rgb(255, 221, 238)' });
      expect(afterPixels.heading).not.toBe(beforePixels.heading);
      expect(afterPixels.component).not.toBe(beforePixels.component);
      expect(errors).toEqual([]);
      expect(JSON.stringify(composition.schema)).toBe(schemaBytes);
      const scopedInput = { brand: 'B', theme: 'dark' as const, apply: true };
      wire('tokens.build', 'input', scopedInput);
      const scoped = await tokens(scopedInput);
      wire('tokens.build', 'output', scoped);
      const payload = JSON.parse(read(scoped.artifacts.find(file => file.endsWith('tokens.dark.json'))!));
      expect(payload.cssVariables['--oods-sys-text-primary']).toBe('#ffddee');
      expect(payload.meta).toEqual({ brand: 'B', theme: 'dark', scope: 'requested' });
      const a = await tokens({ brand: 'A', theme: 'light', apply: true });
      const defaultPayload = JSON.parse(read(a.artifacts.find(file => file.endsWith('tokens.light.json'))!));
      expect(defaultPayload.cssVariables['--oods-sys-text-primary']).not.toBe(payload.cssVariables['--oods-sys-text-primary']);
      if (process.env.S194_BRAND_RECEIPTS) {
        const dest = path.resolve(process.env.S194_BRAND_RECEIPTS);
        fs.mkdirSync(dest, { recursive: true });
        for (const [name, bytes] of [['before.svg', beforeChart.svg!], ['after.svg', afterChart.svg!]]) fs.writeFileSync(path.join(dest, name), bytes);
        fs.writeFileSync(path.join(dest, 'brand-boundary.json'), JSON.stringify({ input, accepted, receipt: applied.receipt, beforePixels, afterPixels, beforeCss, afterCss, beforeSvgHash: beforeChart.svgHash, afterSvgHash: afterChart.svgHash, schemaUnchanged: true, pageErrors: errors }, null, 2) + '\n');
        await page.screenshot({ path: path.join(dest, 'generated-app-B-dark.png'), fullPage: true });
      }
    } finally {
      await browser.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }, 180_000);

  it('a value the build could not resolve is refused before any source write (s213-m05)', async () => {
    // Before s213-m05 this delta reached the source and failed the build (OODS-S019, source writes left in place).
    const input = { brand: 'B', strategy: 'alias' as const, apply: true, delta: { dark: { color: { brand: { B: colorDocument('{missing.token.reference}') } } } } };
    wire('brand.apply', 'input', input);
    const before = fs.readFileSync(sourceFile);
    let failure: ToolError | undefined;
    try { await apply(input); } catch (error) { failure = error as ToolError; }
    expect(failure).toBeInstanceOf(ToolError);
    expect(failure!.opiCode).toBe('OODS-V216');
    expect((failure!.details as any).validation.issues).toEqual([expect.objectContaining({ rule: 'value-not-colour', theme: 'dark', slot: 'text.primary' })]);
    expect(fs.readFileSync(sourceFile)).toEqual(before);
  });

  it('build failure is typed, contains captured output and explicitly leaves hashed source writes', async () => {
    // A valid change whose build fails for another reason: a broken token file elsewhere in the package.
    const broken = path.join(tokenRoot, 'src/tokens/base/zz-broken.json');
    fs.writeFileSync(broken, '{ not json');
    const input = { brand: 'B', strategy: 'alias' as const, apply: true, delta: { dark: { color: { brand: { B: colorDocument('#fff0f5') } } } } };
    wire('brand.apply', 'input', input);
    let failure: ToolError | undefined;
    try { await apply(input); } catch (error) { failure = error as ToolError; } finally { fs.rmSync(broken); }
    expect(failure).toBeInstanceOf(ToolError);
    expect(failure!.opiCode).toBe('OODS-S019');
    const { receipt } = failure!.details as any;
    expect(receipt.build.exitCode).toBe(1);
    expect(receipt.sourceWritten).toBe(true);
    expect(receipt.sourceFiles[0].sha256After).toBe(hash(read(sourceFile)));
    expect(read(sourceFile)).toContain('#fff0f5');
    const tail = receipt.build.commands.map((command: any) => command.stdout + command.stderr).join('\n').split('\n').slice(-40).join('\n');
    expect(failure!.message).toBe('Token build failed (exit 1); source writes remain in place.\n' + tail);
  }, 120_000);
  it('fidelity uses built canonical brands, deprecates aliases and rejects unknown brands', async () => {
    for (const brand of ['A', 'B', 'brand-a', 'brand-b', 'unknown']) {
      const input = { fixture: 'user', fidelityKind: 'branded-mockup' as const, options: { brandOverlay: brand } };
      wire('fidelity.preview', 'input', input);
      const result = await fidelity(input);
      wire('fidelity.preview', 'output', result);
      expect(result.status).toBe(brand === 'unknown' ? 'error' : brand.startsWith('brand-') ? 'warning' : 'ok');
      if (brand === 'unknown') expect(result.errors?.some(error => error.code === 'OODS-BM-002')).toBe(true);
      else expect(result.html).toContain('data-resolved-brand="' + (brand === 'A' || brand === 'brand-a' ? 'A' : 'B') + '"');
      if (brand.startsWith('brand-')) expect(result.warnings.some(warning => warning.code === 'OODS-BM-004')).toBe(true);
    }
  });
  it('invalid token scopes fail even for direct callers', async () => {
    await expect(tokens({ brand: 'unknown' })).rejects.toMatchObject({ opiCode: 'OODS-V001' });
  });
});
