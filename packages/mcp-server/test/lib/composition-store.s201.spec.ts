import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachToVersion, isSafeCompositionId, isSafeVersion, latestVersion, listVersions, newCompositionId, nextVersion, readVersion, resolveCompositionsDir, versionPath, writeVersion, type CompositionVersion } from '../../src/lib/composition-store.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-composition-store-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', root); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); });
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(root, { recursive: true, force: true }); });

const record = (compositionId: string, version: number, parentVersion: number | null = null): CompositionVersion => ({
  recordVersion: '1', compositionId, version, parentVersion, operation: version === 1 ? 'compose' : 'recompose', createdAt: `2026-09-15T00:0${version}:00.000Z`, head: null,
  compose: { object: 'Subscription', context: 'card' }, schema: { version: '2026.02', screens: [] } as never, schemaHash: `sha256:${String(version).repeat(64).slice(0, 64)}`,
  brand: 'A', theme: 'light', slots: [{ slotName: 'header', selectedComponent: 'DetailHeader' }], artifacts: {}, measurements: {},
});

describe('composition store (s201-m02)', () => {
  it('lives beside the saved-schema store and round-trips a version byte for byte', async () => {
    const dir = resolveCompositionsDir();
    expect(dir).toBe(path.join(root, 'compositions'));
    const id = newCompositionId();
    expect(isSafeCompositionId(id)).toBe(true);
    const file = await writeVersion(dir, record(id, 1));
    expect(file).toBe(path.join(dir, id, 'versions', '1.json'));
    expect(await readVersion(dir, id, 1)).toEqual(record(id, 1));
    expect(await latestVersion(dir, id)).toBe(1);
    expect(await nextVersion(dir, id)).toEqual({ version: 2, parentVersion: 1 });
    await writeVersion(dir, record(id, 2, 1));
    expect(await nextVersion(dir, id, 1)).toEqual({ version: 3, parentVersion: 1 });
    expect((await listVersions(dir, id)).map(entry => [entry.version, entry.parentVersion, entry.operation, entry.artifacts])).toEqual([[1, null, 'compose', []], [2, 1, 'recompose', []]]);
  });

  it('never overwrites a written version, and attaches derived data without touching the schema', async () => {
    const dir = resolveCompositionsDir();
    const id = newCompositionId();
    await writeVersion(dir, record(id, 1));
    await expect(writeVersion(dir, { ...record(id, 1), schemaHash: 'sha256:' + 'b'.repeat(64) })).rejects.toThrow(/EEXIST/);
    const before = fs.readFileSync(versionPath(dir, id, 1), 'utf8');
    const attached = await attachToVersion(dir, id, 1, { model: { planName: 'x' }, artifacts: { react: { artifact: { framework: 'react', files: [], actions: [], contentHash: 'sha256:' + 'c'.repeat(64) } as never, generatedAt: '2026-09-15T00:00:00.000Z' } } });
    expect(attached.model).toEqual({ planName: 'x' });
    expect(Object.keys(attached.artifacts)).toEqual(['react']);
    expect(attached.schemaHash).toBe(record(id, 1).schemaHash);
    expect(JSON.parse(before).schema).toEqual(attached.schema);
    expect((await listVersions(dir, id))[0]!.artifacts).toEqual(['react']);
  });

  it('refuses unsafe ids, versions and paths with a typed error, and names what is missing', async () => {
    const dir = resolveCompositionsDir();
    for (const bad of ['../x', 'cmp-XYZ', 'cmp-0123456789ab/../..', 'cmp-0123456789abc', '', 'CMP-0123456789AB']) {
      expect(isSafeCompositionId(bad)).toBe(false);
      expect(() => versionPath(dir, bad, 1)).toThrow(expect.objectContaining({ opiCode: 'OODS-V203' }));
      await expect(readVersion(dir, bad, 1)).rejects.toMatchObject({ opiCode: 'OODS-V203' });
    }
    for (const bad of [0, -1, 1.5, Number.NaN, 2_000_000]) {
      expect(isSafeVersion(bad)).toBe(false);
      expect(() => versionPath(dir, 'cmp-0123456789ab', bad)).toThrow(expect.objectContaining({ opiCode: 'OODS-V203' }));
    }
    await expect(readVersion(dir, 'cmp-0123456789ab', 1)).rejects.toMatchObject({ opiCode: 'OODS-N022', details: { compositionId: 'cmp-0123456789ab', version: 1 } });
    await expect(listVersions(dir, 'cmp-0123456789ab')).rejects.toMatchObject({ opiCode: 'OODS-N022' });
    await writeVersion(dir, record('cmp-0123456789ab', 1));
    await expect(nextVersion(dir, 'cmp-0123456789ab', 7)).rejects.toMatchObject({ opiCode: 'OODS-N022', details: { version: 7 } });
    expect(fs.readdirSync(dir)).toEqual(['cmp-0123456789ab']);
  });
});
