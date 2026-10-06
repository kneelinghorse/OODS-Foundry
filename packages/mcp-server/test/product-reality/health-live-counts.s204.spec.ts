import { describe, expect, it } from 'vitest';
import { handle as health } from '../../src/tools/health.js';
import { listObjects } from '../../src/objects/object-loader.js';
import { listTraits } from '../../src/objects/trait-loader.js';
import { liveComponentNames } from '../../src/lib/live-registry.js';

/**
 * s204-m02 (e): `health` reported traits and components from the newest
 * `artifacts/structured-data/oods-components-*.json` snapshot — frozen on 2026-09-14 — while only its
 * object count was computed live. So the delivered bridge and the frozen bundle both advertised 46
 * traits where the registry held 47, and nothing in the output said which numbers could move and
 * which could not. An advertised count that cannot move is worse than no count (learning #657).
 *
 * The fix does not pretend every count can be live: components have no loader to count them from, so
 * that one stays frozen and SAYS so. What these tests hold is that the output is honest about which
 * is which, and that anything claiming to be live actually tracks the registry.
 */
describe('s204-m02 (e) — health says where each registry count came from', () => {
  it('reports a source for every count it advertises', async () => {
    const result = await health();
    expect(Object.keys(result.registry.countsFrom).sort()).toEqual(['components', 'objects', 'traits']);
    for (const [name, source] of Object.entries(result.registry.countsFrom)) {
      expect(['live', 'snapshot', 'unavailable'], `${name} claims an unknown source`).toContain(source);
    }
  });

  it('agrees with the registry on every count it calls live', async () => {
    // The defect in one assertion: a count labelled `live` must equal what the loader returns right
    // now. Before the fix the trait count was 46 against a registry holding 47, and no reader could
    // tell, because the number carried no provenance at all.
    const result = await health();
    const liveTruth: Record<string, number> = { components: liveComponentNames().length, traits: listTraits().length, objects: listObjects().length };
    for (const [name, source] of Object.entries(result.registry.countsFrom)) {
      if (source !== 'live') continue;
      expect(liveTruth[name], `health calls ${name} live but nothing here can check it`).toBeTypeOf('number');
      expect(result.registry[name as 'traits' | 'objects']).toBe(liveTruth[name]);
    }
  });

  it('counts traits live, which is the count that was wrong', async () => {
    const result = await health();
    expect(result.registry.countsFrom.traits).toBe('live');
    expect(result.registry.traits).toBe(listTraits().length);
  });

  it('carries lastSync for the counts that are still frozen, so the number has a date', async () => {
    // A frozen count is acceptable only while the reader can see how old it is.
    const result = await health();
    const frozen = Object.entries(result.registry.countsFrom).filter(([, source]) => source === 'snapshot');
    if (frozen.length === 0) return;
    expect(result.registry.lastSync).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
