import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { inspectComponentPackages } from '../../../mcp-bridge/src/preview/component-packages.js';
import { loadEsbuild } from '../../../mcp-bridge/src/preview/runtime.js';
import { handle as preview } from '../../src/tools/design.preview.js';
import { handle as createMapping } from '../../src/tools/map.create.js';
import { readVersion, resolveCompositionsDir, listVersions } from '../../src/lib/composition-store.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { getAjv } from '../../src/lib/ajv.js';
import mappingSchema from '../../src/schemas/component-mapping.schema.json' with { type: 'json' };
import outputSchema from '../../src/schemas/design.preview.output.json' with { type: 'json' };
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
let folder: string, team: string, server: FastifyInstance, url: string;
beforeEach(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 's214-component-preview-'));
  team = path.join(folder, 'team');
  fs.cpSync(path.join(root, 'tests/fixtures/team-components'), team, { recursive: true, filter: file => !file.split(path.sep).includes('node_modules') });
  // s221-m01: the fixture's dist/ is never committed and nothing built it for this suite; build the copy's JavaScript as
  // its build.mjs does, with the esbuild the preview host compiles with. Nothing on this path reads declarations.
  await (await loadEsbuild()).build({ absWorkingDir: team, entryPoints: ['src/react.tsx', 'src/vue.ts'], outdir: 'dist', bundle: true, format: 'esm', platform: 'browser', external: ['react', 'vue'], logLevel: 'silent' });
  vi.stubEnv('MCP_SCHEMA_STORE_ROOT', folder); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas');
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(folder, 'mappings.json'));
  for (const mapping of JSON.parse(fs.readFileSync(path.join(team, 'mappings.json'), 'utf8'))) {
    mapping.substitution.react.localPath = team; mapping.substitution.vue.localPath = team;
    expect(await createMapping(mapping)).toMatchObject({ status: 'ok' });
  }
  server = Fastify();
  await registerPreviewHost(server, { compositionsDir: resolveCompositionsDir(), runtimeDir: path.join(root, 'packages/mcp-bridge/dist/preview-runtime') });
  url = await server.listen({ port: 0, host: '127.0.0.1' });
});
afterEach(async () => { await server?.close(); vi.unstubAllEnvs(); fs.rmSync(folder, { recursive: true, force: true }); });
const open = (input: Parameters<typeof preview>[0]) => preview(input, { previewHostUrl: url });

describe('mapped package preview identity (s214-m03)', () => {
  it('bundles both team frameworks while keeping Forge and framework globals, with valid hash-bound provenance', async () => {
    const mappingCheck = getAjv().compile(mappingSchema);
    expect(mappingCheck(JSON.parse(fs.readFileSync(path.join(folder, 'mappings.json'), 'utf8'))), JSON.stringify(mappingCheck.errors)).toBe(true);
    const result = await open({ object: 'Subscription', context: 'detail', framework: 'both' });
    const validate = getAjv().compile(outputSchema); expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    const record = await readVersion(resolveCompositionsDir(), result.compositionId, result.version);
    expect(record.componentPackages).toHaveLength(2);
    for (const entry of result.previews) {
      const artifact = record.artifacts[entry.framework]!.artifact;
      expect(validateGeneratedArtifact(artifact)).toEqual([]);
      expect(artifact.substitutions?.every(item => item.packageContentHash?.startsWith('sha256:'))).toBe(true);
      const esm = await (await fetch(entry.moduleUrl)).text();
      expect(esm).toContain('data-team-component');
      expect(esm).not.toMatch(/from ["']@forge-test/);
      const iife = await (await fetch(`${entry.moduleUrl}&format=iife`)).text();
      expect(iife).toContain('__oodsRuntime'); expect(iife).not.toContain('does not provide @forge-test');
    }
    expect(fs.readdirSync(path.join(resolveCompositionsDir(), result.compositionId, 'modules'))).toHaveLength(4);
  }, 120_000);

  it('records changed package bytes as a new version and preserves both original modules after removal and a cache restart', async () => {
    const first = await open({ object: 'Subscription', context: 'detail', framework: 'react' });
    const before = await (await fetch(first.previews[0]!.moduleUrl)).text();
    const oldRecord = await readVersion(resolveCompositionsDir(), first.compositionId, first.version);
    const entry = path.join(team, 'dist/react.js');
    fs.appendFileSync(entry, '\nconsole.log("s214-new-package-payload");\n');
    await expect(open({ compositionId: first.compositionId, framework: 'react', contextItems: [{ source: 'CMOS' } as never] })).rejects.toMatchObject({ opiCode: 'OODS-V206' });
    expect(await listVersions(resolveCompositionsDir(), first.compositionId)).toHaveLength(1);
    const second = await open({ compositionId: first.compositionId, framework: 'react' });
    expect(second).toMatchObject({ version: 2, parentVersion: 1, operation: 'recompose' });
    expect(second.previews[0]!.artifactContentHash).not.toBe(first.previews[0]!.artifactContentHash);
    expect(await (await fetch(second.previews[0]!.moduleUrl)).text()).toContain('s214-new-package-payload');
    expect(await readVersion(resolveCompositionsDir(), first.compositionId, 1)).toEqual(oldRecord);
    fs.rmSync(team, { recursive: true });
    vi.resetModules();
    const { compileArtifact } = await import('../../../mcp-bridge/src/preview/compile.js');
    for (const format of ['esm', 'iife'] as const) {
      const stored = await compileArtifact(oldRecord.artifacts.react!.artifact, { format, componentPackages: oldRecord.componentPackages, cacheDirectory: path.join(resolveCompositionsDir(), first.compositionId, 'modules') });
      expect(stored.code).not.toContain('s214-new-package-payload');
      if (format === 'esm') expect(stored.code).toBe(before);
    }
    const explicit = await open({ compositionId: first.compositionId, version: 1, framework: 'react' });
    expect(explicit.version).toBe(1);
    expect(await (await fetch(explicit.previews[0]!.moduleUrl)).text()).toBe(before);
  }, 120_000);

  it('does not create a new version for unchanged packages; adding a framework uses a new version', async () => {
    const first = await open({ object: 'Subscription', context: 'detail', framework: 'react' });
    expect((await open({ compositionId: first.compositionId, framework: 'react' })).version).toBe(1);
    await expect(open({ compositionId: first.compositionId, version: 1, framework: 'vue' })).rejects.toMatchObject({ opiCode: 'OODS-V217' });
    expect((await open({ compositionId: first.compositionId, framework: 'both' })).version).toBe(2);
  }, 120_000);

  it('names a missing package with a typed error before claiming a preview', async () => {
    fs.rmSync(team, { recursive: true });
    await expect(open({ object: 'Subscription', context: 'detail' })).rejects.toMatchObject({ opiCode: 'OODS-V217', message: expect.stringContaining('@forge-test/team-components') });
  });

  it('names an unbuildable package with a typed error rather than returning a blank preview', async () => {
    fs.writeFileSync(path.join(team, 'dist/react.js'), 'this is not valid JavaScript {{{');
    await expect(open({ object: 'Subscription', context: 'detail', framework: 'react' })).rejects.toMatchObject({ opiCode: 'OODS-V217', message: expect.stringContaining('@forge-test/team-components') });
  });

  it('bundles a local package with a main entry and no exports map', async () => {
    const manifestFile = path.join(team, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    delete manifest.exports; manifest.main = 'dist/react.js'; fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    const mappingFile = path.join(folder, 'mappings.json');
    const mappings = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    for (const mapping of mappings.mappings) mapping.substitution.react.package = '@forge-test/team-components';
    fs.writeFileSync(mappingFile, JSON.stringify(mappings));
    const result = await open({ object: 'Subscription', context: 'detail', framework: 'react' });
    expect(await (await fetch(result.previews[0]!.moduleUrl)).text()).toContain('data-team-component');
  });

  it('resolves an installed package with no localPath and refuses a mismatched version pin', () => {
    const installed = path.join(folder, 'node_modules/@forge-test/team-components'); fs.mkdirSync(path.dirname(installed), { recursive: true }); fs.renameSync(team, installed);
    const request = { framework: 'react' as const, specifier: '@forge-test/team-components/react', version: '1.0.0' };
    // s224 review: the inspection reports the package's real directory, and macOS's temp folder is a symlink (/var →
    // /private/var), so the expectation is resolved the same way.
    expect(inspectComponentPackages([request], folder)[0]).toMatchObject({ name: '@forge-test/team-components', version: '1.0.0', directory: fs.realpathSync(installed), contentHash: expect.stringMatching(/^sha256:/) });
    expect(() => inspectComponentPackages([{ ...request, version: '2.0.0' }], folder)).toThrow(/expected.*2.0.0.*found.*1.0.0/);
  });
});
