/** Execute the first-change guide verbatim; the edit comes from its printed YAML. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { load, dump } from 'js-yaml';
import { chromium, type Browser } from 'playwright';

const sha = (bytes: string | Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export const FIRST_CHANGE_PREVIEW_INTERVAL_MS = 7_000;
export const FIRST_CHANGE_SCREENS = ['warehouse-detail', 'coldroom-detail', 'warehouse-list', 'subscription-detail'] as const;
export function firstChangeSteps(markdown: string) {
  return [...markdown.matchAll(/<!-- first-change: ([\w-]+) ([\w_]+) -->\s*```json\s*([\s\S]*?)```/g)]
    .map(([, id, tool, json]) => ({ id: id!, tool: tool!, input: JSON.parse(json!) }));
}
export function firstChangeEditBlocks(markdown: string): Record<string, string> {
  const blocks = [...markdown.matchAll(/<!-- first-change-edit: ([\w-]+) -->\s*```yaml\s*([\s\S]*?)```/g)];
  assert.deepEqual(blocks.map(([, key]) => key), ['version', 'schema', 'detail'], 'the guide must print every part of the edit once');
  return Object.fromEntries(blocks.map(([, key, yaml]) => [key!, yaml!.trimEnd()]));
}
export function editedStockable(source: string, markdown: string) {
  const blocks = firstChangeEditBlocks(markdown);
  const trait: any = load(source);
  Object.assign(trait.trait, load(blocks.version) as object);
  Object.assign(trait.schema, load(blocks.schema) as object);
  trait.view_extensions.detail.push(...load(blocks.detail) as any[]);
  return dump(trait, { lineWidth: -1, noRefs: true });
}

type Client = { callTool(name: string, input: any): Promise<any> };
type Version = { compositionId: string; version: number; schemaHash: string; schemaRef: string };
export async function runFirstChange({ client, packageRoot, workDir, out, environment }: {
  client: Client; packageRoot: string; workDir: string; out: string; environment: NodeJS.ProcessEnv;
}) {
  fs.mkdirSync(out, { recursive: true });
  const inputDir = path.join(workDir, 'first-change-inputs');
  assert(!fs.existsSync(inputDir), 'the first change starts with a fresh input folder');
  fs.cpSync(path.join(packageRoot, 'quickstart'), inputDir, { recursive: true });
  const markdown = fs.readFileSync(path.join(packageRoot, 'QUICKSTART.md'), 'utf8');
  const steps = firstChangeSteps(markdown), editBlocks = firstChangeEditBlocks(markdown);
  assert.equal(steps.length, 23, 'the public first run states its exact call count');
  assert.equal(steps.filter(step => step.tool === 'design_preview').length, 6, 'the public first run keeps six preview calls');
  assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
  const originalTrait = fs.readFileSync(path.join(inputDir, 'Stockable.trait.yaml'), 'utf8');
  const editedTrait = editedStockable(originalTrait, markdown);
  const write = (name: string, value: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
  fs.writeFileSync(path.join(inputDir, 'Stockable.original.trait.yaml'), originalTrait);
  fs.writeFileSync(path.join(inputDir, 'Stockable.edited.trait.yaml'), editedTrait);
  const values: Record<string, any> = {
    '<Stockable.trait.yaml>': originalTrait, '<Stockable.edited.trait.yaml>': editedTrait,
    '<Warehouse.object.yaml>': fs.readFileSync(path.join(inputDir, 'Warehouse.object.yaml'), 'utf8'),
    '<ColdRoom.object.yaml>': fs.readFileSync(path.join(inputDir, 'ColdRoom.object.yaml'), 'utf8'),
  };
  const replace = (value: any): any => {
    if (typeof value === 'string' && /^<[^>]+>$/.test(value)) { assert(Object.hasOwn(values, value), `Missing first-change value ${value}`); return values[value]; }
    if (Array.isArray(value)) return value.map(replace);
    return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)])) : value;
  };
  const results: Record<string, any> = {}, versions: Record<string, Record<number, Version>> = {};
  const urls: { previews: Record<string, Record<number, { appUrl: string; url: string }>>; compares: Record<string, string> } = { previews: {}, compares: {} };
  const calls: Array<{ id: string; tool: string; input: any; startedAt: string; durationMs: number }> = [];
  const receipt: any = { status: 'running', builderSelfCertified: false, node: process.version, markdownSha256: sha(markdown), home: environment.HOME, callCount: 0, previewCallCount: 0,
    previewIntervalMs: FIRST_CHANGE_PREVIEW_INTERVAL_MS, originalTraitSha256: sha(originalTrait), editedTraitSha256: sha(editedTrait), editBlocks, steps: [] };
  let lastPreview = 0;
  try {
    for (const step of steps) {
      const input = replace(step.input);
      if (step.tool === 'design_preview') {
        while (Date.now() - lastPreview < FIRST_CHANGE_PREVIEW_INTERVAL_MS) {
          await new Promise(resolve => setTimeout(resolve, FIRST_CHANGE_PREVIEW_INTERVAL_MS - (Date.now() - lastPreview)));
        }
      }
      write(`${step.id}.input.json`, input);
      const started = Date.now();
      if (step.tool === 'design_preview') lastPreview = started;
      const result = await client.callTool(step.tool, input);
      calls.push({ id: step.id, tool: step.tool, input, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started });
      results[step.id] = result; write(`${step.id}.output.json`, result);
      if (step.tool === 'object_register') assert.equal(result.status, input.overwrite ? 'updated' : 'created', JSON.stringify(result));
      else assert.equal(result.status, 'ok', JSON.stringify(result));
      const screenVersion = /^(.*)-v([123])$/.exec(step.id);
      if (step.tool === 'design_compose' && screenVersion) {
        const screen = screenVersion[1]!, version = Number(screenVersion[2]);
        assert.equal(result.version, version);
        values[`<${screen}>`] = result.compositionId;
        (versions[screen] ??= {})[version] = { compositionId: result.compositionId, version, schemaRef: result.schemaRef, schemaHash: sha(JSON.stringify(result.schema)) };
        if (version === 3) assert.equal(versions[screen][3]!.schemaHash, versions[screen][1]!.schemaHash, `${screen} must return to its original schema`);
      }
      if (input.action === 'compare') {
        const screen = step.id.replace(/-compare$/, '');
        urls.compares[screen] = result.compareUrl;
        for (const ref of [result.left, result.right]) {
          const key = FIRST_CHANGE_SCREENS.find(key => versions[key]?.[1]?.compositionId === ref.compositionId)!;
          assert.equal(ref.schemaHash, versions[key][ref.version]!.schemaHash, 'compare hash must match the independently hashed composed schema');
          const base = `${result.host.url}/preview/${ref.compositionId}/${ref.version}`;
          (urls.previews[key] ??= {})[ref.version] = { appUrl: `${base}/app?framework=react`, url: `${base}?framework=react` };
        }
        if (['warehouse-detail', 'coldroom-detail'].includes(screen)) {
          assert.equal(result.identical, false);
          assert(result.diff.differences.some((row: any) => JSON.stringify(row).includes('last_counted_at')));
        } else if (screen === 'warehouse-list') {
          assert.equal(result.identical, false);
          for (const category of ['regions', 'slots', 'nodes', 'props', 'fieldOrder']) assert.equal(result.diff.summary[category], 0, `list ${category} must stay unchanged`);
          assert.equal(result.diff.summary.definition, 1);
          assert.deepEqual(result.diff.differences.filter((row: any) => row.category === 'definition').map((row: any) => row.field), ['objectSchema.last_counted_at']);
        } else {
          assert.equal(result.identical, true, `${screen} must be identical`);
          assert.equal(result.left.schemaHash, result.right.schemaHash);
        }
      }
      receipt.callCount = calls.length; receipt.previewCallCount = calls.filter(call => call.tool === 'design_preview').length;
      receipt.steps.push({ id: step.id, tool: step.tool, status: 'pass', inputSha256: sha(JSON.stringify(input)), outputSha256: sha(JSON.stringify(result)) });
      write('receipt.json', receipt);
    }
    receipt.status = 'pass'; receipt.versions = versions; receipt.urls = urls;
    write('calls.json', calls); write('versions.json', versions); write('urls.json', urls); write('edit-blocks.json', editBlocks);
    return { receipt, results, inputDir, calls, versions, urls, editBlocks, originalTrait, editedTrait };
  } catch (error) { receipt.status = 'fail'; receipt.error = String(error); throw error; }
  finally { write('receipt.json', receipt); }
}

/** Browser evidence adds no tool calls: compare prepares the existing versions. */
export async function captureFirstChange(run: Awaited<ReturnType<typeof runFirstChange>>, browser: Browser, out: string) {
  fs.mkdirSync(out, { recursive: true });
  const screens: any[] = [];
  for (const key of FIRST_CHANGE_SCREENS) for (const version of [1, 2]) for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1080 } });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      const response = await page.goto(run.urls.previews[key]![version]!.appUrl);
      assert.equal(response?.status(), 200);
      await page.waitForSelector('html[data-oods-preview-mounted="true"]');
      const text = await page.locator('body').innerText();
      if (key.endsWith('detail') && key !== 'subscription-detail') {
        assert.equal(text.includes('Last counted at'), version === 2);
        assert(!text.includes('Not recorded'), `${key} v${version}: sample values must be authored`);
      }
      if (key === 'coldroom-detail') assert(text.includes('Target temperature (°C)'));
      if (key === 'warehouse-list') assert(!text.includes('Last counted at'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow < 2, `${key}/${width}: overflow ${overflow}`); assert.deepEqual(errors, []);
      const file = `${key}-v${version}-${width}.png`, png = await page.screenshot({ path: path.join(out, file), fullPage: true });
      screens.push({ key, version, width, file, sha256: sha(png), text, overflow, errors });
    } finally { await page.close(); }
  }
  for (const key of FIRST_CHANGE_SCREENS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    try {
      const url = new URL(run.urls.compares[key]!); url.searchParams.set('width', '390');
      const response = await page.goto(url.href); assert.equal(response?.status(), 200);
      await page.waitForFunction(() => Number(document.documentElement.dataset.oodsAppsMounted) >= 2, undefined, { timeout: 60_000 });
      const text = await page.locator('body').innerText();
      if (key !== 'subscription-detail') { assert(text.includes('Definition')); assert(text.includes('objectSchema.last_counted_at')); }
      const file = `${key}-compare-1440.png`, png = await page.screenshot({ path: path.join(out, file), fullPage: true });
      screens.push({ key, kind: 'compare', width: 1440, paneWidth: 390, file, sha256: sha(png), text });
    } finally { await page.close(); }
  }
  fs.writeFileSync(path.join(out, 'screens.json'), JSON.stringify(screens, null, 2) + '\n');
  return screens;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd(), workDir = fs.mkdtempSync(path.join(root, '.tmp/s227-first-change-'));
  const out = path.join(root, 'artifacts/product-reality/sprint-227/m02/source');
  fs.mkdirSync(path.join(root, '.tmp/s227-tmp'), { recursive: true });
  const environment = { ...process.env, HOME: path.join(workDir, 'home'), TMPDIR: fs.realpathSync(path.join(root, '.tmp/s227-tmp')), npm_config_cache: path.join(workDir, 'npm-cache'),
    MCP_SCHEMA_STORE_ROOT: path.join(workDir, 'store'), MCP_SCHEMA_STORE_DIR: 'schemas', MCP_MAPPINGS_PATH: path.join(workDir, 'mappings.json'),
    OODS_OBJECTS_DIR: path.join(workDir, 'objects'), OODS_TRAITS_DIR: path.join(workDir, 'traits'), OODS_BRANDS_DIR: path.join(workDir, 'brands'),
    OODS_PLAYWRIGHT_WS_ENDPOINT: '', OODS_CONTRACT_BROWSER_EXECUTABLE: path.join(workDir, 'absent-contract-browser') };
  for (const folder of [environment.HOME, environment.OODS_OBJECTS_DIR, environment.OODS_TRAITS_DIR]) fs.mkdirSync(folder, { recursive: true });
  Object.assign(process.env, environment);
  const { handle: object } = await import('../../packages/mcp-server/src/tools/object.js');
  const { handle: register } = await import('../../packages/mcp-server/src/tools/object.write.js');
  const { handle: compose } = await import('../../packages/mcp-server/src/tools/design.compose.js');
  const { handle: preview } = await import('../../packages/mcp-server/src/tools/design.preview.js');
  const { registerPreviewHost } = await import('../../packages/mcp-bridge/src/preview/host.js');
  const { resolveCompositionsDir } = await import('../../packages/mcp-server/src/lib/composition-store.js');
  const Fastify = createRequire(path.join(root, 'packages/mcp-bridge/package.json'))('fastify');
  const server = Fastify();
  await registerPreviewHost(server, { compositionsDir: resolveCompositionsDir(), runtimeDir: path.join(root, 'packages/mcp-bridge/dist/preview-runtime') });
  await server.listen({ port: 0, host: '127.0.0.1' });
  const host = `http://127.0.0.1:${server.server.address().port}`;
  const client = { callTool: async (name: string, input: any) => name === 'object_register' ? register(input) : ['object', 'object_registry'].includes(name) ? object(input) : name === 'design_compose' ? compose(input) : preview(input, { previewHostUrl: host }) };
  const browser = await chromium.launch({ headless: true });
  try {
    const run = await runFirstChange({ client, packageRoot: path.join(root, 'packages/foundry'), workDir, out, environment });
    await captureFirstChange(run, browser, path.join(out, 'screens'));
    // ColdRoom list is a separate specimen check, outside the 23-call first run.
    const list: any = await preview({ object: 'ColdRoom', context: 'list', framework: 'react' }, { previewHostUrl: host });
    const screens = [];
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1080 } });
      try {
        await page.goto(list.previews[0].appUrl); await page.waitForSelector('html[data-oods-preview-mounted="true"]');
        const text = await page.locator('body').innerText(); assert(text.includes('Dairy Room')); assert(!text.includes('Not recorded'));
        const file = `coldroom-list-${width}.png`; await page.screenshot({ path: path.join(out, 'screens', file), fullPage: true });
        screens.push({ width, file, text });
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(out, 'coldroom-list.json'), JSON.stringify({ scope: 'separate specimen proof; one additional preview outside the first run', result: list, screens }, null, 2) + '\n');
  } finally { await browser.close(); await server.close(); }
}
