import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import {
  assertBundleSourceMatches, createRuntimeToolset, isRuntimeProductPath, releaseCellProvenance,
  type BundleRuntimeConfiguration,
} from '../../../../scripts/product-reality/s196-bundle-runtime.js';
import { packFoundationPackages } from '../../../../scripts/product-reality/s182-m04-consumer-harness.mjs';

let root: string;
const write = async (relative: string, contents: string) => {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, contents);
};
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-bundle-harness-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

async function committedFixture() {
  git('init', '-q');
  await write('packages/mcp-server/src/émission.ts', 'export const value = 1;\n');
  await write('docs/report.md', 'First receipt.\n');
  git('add', '.');
  git('-c', 'user.name=Harness Test', '-c', 'user.email=harness@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture');
  return git('rev-parse', 'HEAD');
}

async function fakeAdapter(responses: Record<string, unknown>): Promise<BundleRuntimeConfiguration> {
  await write('packages/mcp-adapter/package.json', '{"type":"module"}');
  await write('packages/mcp-adapter/responses.json', JSON.stringify(responses));
  await write('packages/mcp-adapter/index.js', `
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
const responses = JSON.parse(readFileSync(new URL('./responses.json', import.meta.url), 'utf8'));
createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  const result = message.method === 'initialize' ? { protocolVersion: '2024-11-05' }
    : { content: [{ type: 'text', text: JSON.stringify(responses[message.params.name]) }] };
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\\n');
});
process.on('SIGTERM', () => process.exit(0));
`);
  return { bundleDirectory: root, archivePath: path.join(root, 'fixture.tar.gz'), bundleHead: 'a'.repeat(40), archiveSha256: 'b'.repeat(64), timezone: process.env.TZ ?? 'UTC' };
}

describe('release bundle harness boundaries', () => {
  it('distinguishes executable product inputs from later documentation and proof receipts', () => {
    for (const file of ['packages/mcp-server/src/tools/code.generate.ts', 'packages/components-vue/src/index.ts', 'packages/components-react/evidence/react-readiness.v1.json', 'packages/tokens/package.json', 'objects/core/User.object.yaml', 'artifacts/structured-data/manifest.json']) {
      expect(isRuntimeProductPath(file), file).toBe(true);
    }
    for (const file of ['docs/runtime/portable-runtime.md', 'packages/mcp-server/registry/release-cells.v1.json', 'packages/mcp-server/src/codegen/example.test.ts', 'artifacts/product-reality/sprint-196/m03/receipt.json']) {
      expect(isRuntimeProductPath(file), file).toBe(false);
    }
  });

  it('allows a documentation successor while pinning the recorded bundle commit', async () => {
    const head = await committedFixture();
    await write('docs/report.md', 'A later receipt.\n');
    git('add', '.');
    git('-c', 'user.name=Harness Test', '-c', 'user.email=harness@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Docs follow-up');
    expect(git('rev-parse', 'HEAD')).not.toBe(head);
    expect(assertBundleSourceMatches(root, head)).toMatchObject({ sourceHead: head, productSourcesMatch: true, ignoredChangedPaths: ['docs/report.md'] });
  });

  it('rejects changed non-ASCII source paths and new untracked product files', async () => {
    const head = await committedFixture();
    await write('packages/mcp-server/src/émission.ts', 'export const value = 2;\n');
    expect(() => assertBundleSourceMatches(root, head)).toThrow(/émission\.ts/);
    git('checkout', '--', 'packages/mcp-server/src/émission.ts');
    await write('packages/mcp-server/src/untracked.ts', 'export const value = 3;\n');
    expect(() => assertBundleSourceMatches(root, head)).toThrow(/untracked\.ts/);
  });

  it('packs the five source-free bundle packages once without running their retained prepack scripts', async () => {
    const names = ['tokens', 'component-contracts', 'component-styles', 'components-react', 'components-vue'];
    for (const name of names) {
      await write(`packages/${name}/package.json`, JSON.stringify({ name: `@oods/${name}`, version: '0.1.0', files: ['dist'], scripts: { prepack: 'node -e "process.exit(79)"' } }));
      await write(`packages/${name}/dist/index.js`, `export const identity = '${name}';\n`);
      await write(`packages/${name}/dist/index.d.ts`, 'export declare const identity: string;\n');
    }
    const output = path.join(root, 'proof');
    await fs.mkdir(output);
    const records = await packFoundationPackages(output, { packageSourceRoot: root, ignoreScripts: true }) as Array<{ name: string; tarballPath: string }>;
    expect(records.map(record => record.name)).toEqual(names.map(name => `@oods/${name}`));
    for (const record of records) {
      const members = execFileSync('tar', ['-tzf', record.tarballPath], { encoding: 'utf8' });
      expect(members).toContain('package/dist/index.d.ts');
      expect(members).not.toContain('/src/');
      const name = record.name.slice('@oods/'.length);
      expect(await fs.readFile(path.join(root, `packages/${name}/dist/index.js`), 'utf8')).toBe(`export const identity = '${name}';\n`);
    }
    await expect(packFoundationPackages(output, { packageSourceRoot: root, ignoreScripts: true })).rejects.toThrow(/Refusing to overwrite evidence directory/);
  }, 60_000);

  it('compares adapter-generated artifacts with real host output and records clean termination', async () => {
    const request = { object: 'User', context: 'card' as const };
    const composition = await compose(request);
    const input = { schema: composition.schema, framework: 'react' as const, profile: 'build' as const };
    const generated = await generate(input);
    expect(generated.status).toBe('ok');
    const config = await fakeAdapter({ design_compose: composition, code_generate: generated });
    const output = path.join(root, 'parity');
    const tools = await createRuntimeToolset(output, config);
    try {
      expect((await tools.compose(request)).schema).toEqual(composition.schema);
      const result = await tools.generate(input);
      expect(tools.comparisons).toMatchObject([{ framework: 'react', bundleHead: config.bundleHead, hashEqualToHost: true, hostArtifactHash: result.artifact!.contentHash }]);
      const row = releaseCellProvenance({ object: 'User', context: 'card', framework: 'react', head: config.bundleHead, runId: 'one-sweep', status: 'pass', gates: [], artifactHash: result.artifact!.contentHash, components: [], report: 'receipt.json' }, tools);
      expect(row).toMatchObject({ bundleHead: config.bundleHead, archiveSha256: config.archiveSha256, hashEqualToHost: true, hostArtifactHash: row.artifactHash });
    } finally { await tools.close(); }
    expect(JSON.parse(await fs.readFile(path.join(output, 'adapter-lifecycle.json'), 'utf8'))).toMatchObject({ forcedKill: false, code: 0 });
  });

  it('retains both generated outputs before rejecting a different bundle artifact', async () => {
    const composition = await compose({ object: 'User', context: 'card' });
    const input = { schema: composition.schema, framework: 'vue' as const, profile: 'build' as const };
    const generated = await generate(input);
    expect(generated.status).toBe('ok');
    generated.artifact!.contentHash = `sha256:${'0'.repeat(64)}`;
    const config = await fakeAdapter({ code_generate: generated });
    const output = path.join(root, 'parity');
    const tools = await createRuntimeToolset(output, config);
    try {
      await expect(tools.generate(input)).rejects.toThrow(/artifact differs from the host/);
      const [comparison] = tools.comparisons;
      expect(comparison!.hashEqualToHost).toBe(false);
      expect(comparison!.hostArtifactHash).not.toBe(comparison!.bundleArtifactHash);
      for (const file of [comparison!.hostResponse, comparison!.bundleResponse, 'generation-comparisons.json']) {
        expect((await fs.stat(path.join(output, file))).size).toBeGreaterThan(0);
      }
    } finally { await tools.close(); }
  });
});
