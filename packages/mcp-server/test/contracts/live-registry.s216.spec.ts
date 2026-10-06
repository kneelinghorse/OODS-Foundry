import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle as fetchData, computeStructuredDataEtag } from '../../src/tools/structuredData.fetch.js';
import { handle as snapshot } from '../../src/tools/registry.snapshot.js';
import { handle as catalog } from '../../src/tools/catalog.list.js';
import { handle as register } from '../../src/tools/object.register.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 's216-live-registry-'));
  vi.stubEnv('OODS_OBJECTS_DIR', path.join(dir, 'objects'));
  vi.stubEnv('OODS_TRAITS_DIR', path.join(dir, 'traits'));
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(dir, 'mappings.json'));
  clearObjectCache(); clearTraitCache();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); clearObjectCache(); clearTraitCache(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('registry tools discover definitions that this process actually uses', () => {
  it('keeps independently authored primitive discovery contexts alongside live trait usages', async () => {
    const result = await fetchData({ dataset: 'components' });
    const text = result.payload?.components?.find((component: any) => component.id === 'Text');
    expect(text.contexts, 'Text remains available to form/list composers even when its traits use detail/card').toEqual(['card', 'detail', 'form', 'list', 'timeline']);
    expect(text.tags).toContain('typography');
  });

  it('sees an object registered after the first call in all three tools', async () => {
    const before = await fetchData({ dataset: 'components' });
    await register({ yaml: JSON.stringify({ object: { name: 'TeamMemo', version: '1.0.0', domain: 'team', description: 'A team memo.' }, traits: [{ name: 'Labelled' }], schema: {}, metadata: { supportedContexts: ['detail'] } }) });
    const data = await fetchData({ dataset: 'components', ifNoneMatch: before.etag });
    expect(data.matched, 'registration changes the content addressed by the live ETag').toBe(false);
    expect(data.payload?.objects).toContainEqual(expect.objectContaining({ name: 'TeamMemo', source: expect.stringContaining('TeamMemo.object.yaml') }));
    expect((await snapshot({})).objects.TeamMemo).toMatchObject({ domain: 'team' });
    expect((await catalog({}) as any).registry).toMatchObject({ source: 'live-registry', objects: expect.arrayContaining(['TeamMemo']) });
    expect(data.meta?.source).toBe('live-registry');
  });

  it('projects a newly registered trait and its component usages without refreshing an export', async () => {
    const yaml = fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/team-definitions/Stockable.trait.yaml'), 'utf8');
    await register({ yaml });
    const data = await fetchData({ dataset: 'components' });
    expect(data.payload?.traits).toContainEqual(expect.objectContaining({ name: 'Stockable', source: expect.stringContaining('Stockable.trait.yaml') }));
    expect((await snapshot({})).traits.Stockable.category).toBe('inventory');
    const listed = await catalog({ trait: 'Stockable', detail: 'full' });
    expect(listed.registry.traits).toContain('Stockable');
    expect(listed.components.map(component => component.name).sort()).toEqual(['StatusBadge', 'Text']);
  });

  it('serves the one shipped Subscription and reports no duplicate (s220-m01, audit F12)', async () => {
    const result = await snapshot({}) as any;
    expect(result.objects.Subscription.source).toBe('objects/core/Subscription.object.yaml');
    expect(result.registry.issues.filter((issue: { kind: string }) => issue.kind === 'duplicate')).toEqual([]);
    expect(result).not.toHaveProperty('preferred_terms');
    expect(result).not.toHaveProperty('disambiguation_decisions');
    expect(result).not.toHaveProperty('capabilities');
  });

  it('computes the same tokens ETag from identical payloads through current and versioned paths', async () => {
    const current = await fetchData({ dataset: 'tokens' });
    const versioned = await fetchData({ dataset: 'tokens', version: current.version! });
    expect(versioned.payload).toEqual(current.payload);
    expect(current.etag).toBe(computeStructuredDataEtag(current.payload));
    expect(versioned.etag).toBe(current.etag);
  });

  it('warns about a stale manifest hash and does not let it match the wrong payload', async () => {
    const read = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file: any, ...args: any[]) => {
      const result = (read as any)(file, ...args);
      if (String(file).endsWith('/structured-data/manifest.json')) {
        const doc = JSON.parse(String(result));
        doc.artifacts.find((row: any) => row.name === 'tokens').etag = '0'.repeat(64);
        return JSON.stringify(doc);
      }
      return result;
    }) as any);
    const result = await fetchData({ dataset: 'tokens', ifNoneMatch: '0'.repeat(64) });
    expect(result.matched).toBe(false);
    expect(result.warnings).toContainEqual(expect.stringContaining('Manifest ETag mismatch'));
  });

  it('names a malformed manifest as a typed error, instead of pretending no dataset exists', async () => {
    const read = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file: any, ...args: any[]) => String(file).endsWith('/structured-data/manifest.json') ? '{invalid' : (read as any)(file, ...args)) as any);
    await expect(fetchData({ dataset: 'components' })).rejects.toMatchObject({ opiCode: 'OODS-S005', message: expect.stringContaining('manifest') });
  });
});
