import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prunePackageDists, shippedTrackedFiles } from './assemble.mjs';
import { RUNTIME_PACKAGES, treeDigest } from './manifest.mjs';
import { buildSbomLiteFromLock } from './sbom-lite.mjs';

test('the runtime excludes repository integration definitions and READMEs even if passed to its file selector', () => {
  const kept = ['objects/core/User.object.yaml', 'objects/capture/Run.object.yaml', 'objects/capture/README.md', 'domains/saas-billing/objects/Invoice.object.yaml'];
  const removed = ['research', 'delivery', 'intelligence'].flatMap(domain => [
    `repository-objects/${domain}/Example.object.yaml`, `repository-objects/${domain}/README.md`,
    `objects/${domain}/Example.object.yaml`, `objects/${domain}/README.md`,
  ]);
  assert.deepEqual(shippedTrackedFiles([...kept, ...removed]), kept);
});

test('the production closure resolves pnpm aliases and measures its count without admitting unverified dependencies', () => {
  const importers = Object.fromEntries(RUNTIME_PACKAGES.map(name => [`packages/${name}`, {}]));
  importers['packages/mcp-bridge'] = { dependencies: { cli: { version: '1.0.0' } } };
  const lock = {
    lockfileVersion: '9.0', importers,
    packages: {
      'cli@1.0.0': { resolution: { integrity: 'sha512-Y2xp' } },
      'string-width@4.2.3': { resolution: { integrity: 'sha512-d2lkdGg=' } },
    },
    snapshots: {
      'cli@1.0.0': { dependencies: { 'string-width-cjs': 'string-width@4.2.3' }, optionalDependencies: { absent: '1.0.0' } },
      'string-width@4.2.3': {},
    },
  };
  const sbom = buildSbomLiteFromLock(lock);
  assert.equal(sbom.summary.packageCount, 2);
  assert.equal(sbom.summary.integrityCount, 2);
  assert.deepEqual(sbom.packages.map(row => row.id), ['cli@1.0.0', 'string-width@4.2.3']);
  lock.snapshots['cli@1.0.0'].dependencies['string-width-cjs'] = 'npm:string-width@4.2.3';
  assert.deepEqual(buildSbomLiteFromLock(lock).packages, sbom.packages);
  assert.throws(() => buildSbomLiteFromLock(lock, { expectedCount: 3 }), /count must be 3/);
  delete lock.packages['string-width@4.2.3'].resolution.integrity;
  assert.throws(() => buildSbomLiteFromLock(lock), /integrity missing/);
});

test('portable pruning keeps consumable declarations and token TS output while removing source and test artifacts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-runtime-pruner-'));
  try {
    for (const name of RUNTIME_PACKAGES.filter(name => name !== 'mcp-adapter')) {
      await fs.mkdir(path.join(root, 'packages', name, 'dist'), { recursive: true });
    }
    const dist = path.join(root, 'packages/tokens/dist');
    const files = ['index.js', 'index.d.ts', 'ts/tokens.ts', 'source.ts', 'index.js.map', 'code.test.js', 'code.spec.ts', '__tests__/fixture.js', 'tools/__fixtures__/data.json'];
    for (const file of files) {
      await fs.mkdir(path.dirname(path.join(dist, file)), { recursive: true });
      await fs.writeFile(path.join(dist, file), file);
    }
    await prunePackageDists(root, { fixtures: true });
    for (const file of ['index.js', 'index.d.ts', 'ts/tokens.ts']) assert.equal(await fs.readFile(path.join(dist, file), 'utf8'), file);
    for (const file of files.slice(3)) await assert.rejects(fs.stat(path.join(dist, file)), { code: 'ENOENT' });
    const before = await treeDigest(root);
    await fs.appendFile(path.join(dist, 'index.js'), '// changed shipped bytes');
    assert.notEqual((await treeDigest(root)).sha256, before.sha256, 'a shipped-byte mutation must invalidate the payload digest');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
