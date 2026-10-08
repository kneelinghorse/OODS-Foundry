import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareManifest, type PackedPackageRecord } from '../../../../scripts/product-reality/s184-m06-live-consumers.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });

async function prepare(artifactVersion: string, packedVersion: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-s233-consumer-version-'));
  roots.push(root);
  const names = ['tokens', 'component-contracts', 'component-styles', 'components-react'];
  const tarballs: PackedPackageRecord[] = [];
  for (const name of names) {
    // This unit exercises the manifest boundary; live consumers separately unpack,
    // install, resolve and run the real submitted tarballs in isolated applications.
    const bytes = Buffer.from(`fixture: ${name}@${packedVersion}`);
    const tarballPath = path.join(root, `${name}.tgz`);
    await fs.writeFile(tarballPath, bytes);
    tarballs.push({ name: `@oods/${name}`, version: packedVersion, directory: root, tarballPath,
      artifactPath: tarballPath, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), manifest: {} });
  }
  const artifact = { dependencies: [{ name: '@oods/components-react', version: artifactVersion, kind: 'dependency' }] } as GeneratedArtifact;
  const original = JSON.stringify(artifact);
  const result = await prepareManifest('react', artifact, tarballs, root);
  expect(JSON.stringify(artifact)).toBe(original);
  return result;
}

describe('the unchanged generated artifact is tested against this release', () => {
  it.each(['0.7.0', '0.8.0', '0.9.0', '0.10.0', '0.10.1', '0.10.2'])('records the intentional 0.6.2 to %s compatibility proof without rewriting the artifact', async version => {
    const result = await prepare('0.6.2', version);
    expect(result.localTarballs.find(row => row.name === '@oods/components-react')).toMatchObject({ version, artifactVersion: '0.6.2' });
    expect(result.manifest.dependencies).toMatchObject({ '@oods/components-react': 'file:./tarballs/components-react.tgz' });
  });
  it('still accepts exact matching artifact and submitted versions', async () => {
    expect((await prepare('0.7.0', '0.7.0')).localTarballs).toHaveLength(4);
  });
  it.each([['0.6.1', '0.7.0'], ['0.6.2', '0.11.0'], ['0.7.0', '0.6.2']])('rejects the unapproved %s to %s pair', async (artifactVersion, packedVersion) => {
    await expect(prepare(artifactVersion, packedVersion)).rejects.toThrow(`artifact declares ${artifactVersion} but the submitted tarball is ${packedVersion}`);
  });
  it('rejects a range even when it could resolve to the submitted version', async () => {
    await expect(prepare('^0.7.0', '0.7.0')).rejects.toThrow('does not use an exact semantic version');
  });
});
