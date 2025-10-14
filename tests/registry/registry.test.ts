import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { ObjectRegistry } from '../../src/registry/registry.ts';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'object-registry-'));
}

function writeObjectFile(dir: string, filename: string, contents: string): string {
  const filePath = join(dir, filename);
  writeFileSync(filePath, contents, 'utf8');
  return filePath;
}

describe('ObjectRegistry', () => {
  it('loads definitions and indexes lookups, traits, tags, and domains', async () => {
    const dir = createTempDir();

    try {
      writeObjectFile(
        dir,
        'alpha.object.yaml',
        `
object:
  name: Alpha
  domain: core
  tags:
    - Core
    - Featured
traits:
  - name: Searchable
  - name: Auditable
    alias: Audit
`
      );

      writeObjectFile(
        dir,
        'beta.object.yaml',
        `
object:
  name: Beta
  domain: core
  tags:
    - Core
    - Experimental
traits:
  - name: Searchable
  - name: Reportable
`
      );

      const registry = new ObjectRegistry({
        roots: [dir],
        watch: false,
        pollingIntervalMs: 25,
      });

      try {
        await registry.waitUntilReady();
        expect(registry.size).toBe(2);

        const alpha = registry.getByName('Alpha');
        expect(alpha).toBeDefined();
        expect(alpha?.tags).toContain('Core');
        expect(alpha?.tags).toContain('Featured');
        expect(alpha?.traits).toContain('Searchable');
        expect(alpha?.traits).toContain('Auditable');
        expect(alpha?.traits).toContain('Audit');
        expect(alpha?.domains).toContain('core');

        const beta = registry.getByName('Beta');
        expect(beta).toBeDefined();
        expect(beta?.traits).toContain('Reportable');

        const searchable = registry.searchByTrait('Searchable');
        expect(searchable.map((record) => record.name)).toEqual(['Alpha', 'Beta']);

        const audit = registry.searchByTrait('Audit');
        expect(audit).toHaveLength(1);
        expect(audit[0].name).toBe('Alpha');

        const featured = registry.filterByTags(['Featured']);
        expect(featured).toHaveLength(1);
        expect(featured[0].name).toBe('Alpha');

        const coreDomain = registry.filterByDomains(['core']);
        expect(coreDomain).toHaveLength(2);

        const query = registry.query({
          traits: ['Searchable'],
          tags: ['Core'],
          domains: ['core'],
        });
        expect(query).toHaveLength(2);
      } finally {
        registry.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('watches the filesystem and updates indexes on changes', async () => {
    const dir = createTempDir();

    const targetPath = writeObjectFile(
      dir,
      'gamma.object.yaml',
      `
object:
  name: Gamma
  domain: analytics
  tags:
    - Analytics
traits:
  - name: Searchable
`
    );

    const registry = new ObjectRegistry({
      roots: [dir],
      watch: true,
      pollingIntervalMs: 40,
    });

    try {
      await registry.waitUntilReady();
      expect(registry.size).toBe(1);

      const updatePromise = once(registry, 'updated');
      writeObjectFile(
        dir,
        'gamma.object.yaml',
        `
object:
  name: Gamma
  domain: analytics
  tags:
    - Analytics
    - Dashboard
traits:
  - name: Searchable
  - name: Visualizable
`
      );
      const [updatedRecord] = await updatePromise;
      expect(updatedRecord.tags).toContain('Dashboard');
      expect(updatedRecord.traits).toContain('Visualizable');

      const addPromise = once(registry, 'added');
      const deltaPath = writeObjectFile(
        dir,
        'delta.object.yaml',
        `
object:
  name: Delta
  domain: analytics
traits:
  - name: Discoverable
`
      );

      const [addedRecord] = await addPromise;
      expect(addedRecord.name).toBe('Delta');
      expect(registry.size).toBe(2);

      const removePromise = once(registry, 'removed');
      rmSync(deltaPath);
      const [removedRecord] = await removePromise;
      expect(removedRecord.name).toBe('Delta');
      expect(registry.size).toBe(1);
      expect(registry.getByName('Delta')).toBeUndefined();
      expect(existsSync(deltaPath)).toBe(false);
    } finally {
      registry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tracks parse errors and recovers when files are fixed', async () => {
    const dir = createTempDir();
    const brokenPath = writeObjectFile(
      dir,
      'broken.object.yaml',
      `
object:
  name: Broken
`
    );

    const registry = new ObjectRegistry({
      roots: [dir],
      watch: true,
      pollingIntervalMs: 35,
    });

    try {
      await registry.waitUntilReady();
      expect(registry.size).toBe(0);
      const diagnostics = registry.getDiagnosticsForPath(brokenPath);
      expect(diagnostics).toBeDefined();
      expect(diagnostics?.[0]?.type).toBe('parse_error');

      const addedPromise = once(registry, 'added');
      writeObjectFile(
        dir,
        'broken.object.yaml',
        `
object:
  name: Healed
  tags:
    - Resolved
traits:
  - name: Searchable
`
      );

      const [addedRecord] = await addedPromise;
      expect(addedRecord.name).toBe('Healed');
      expect(registry.size).toBe(1);

      const resolvedDiagnostics = registry.getDiagnosticsForPath(brokenPath);
      expect(resolvedDiagnostics).toBeUndefined();
    } finally {
      registry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
