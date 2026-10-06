import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readSemanticKeySets, semanticKeyChanges } from '../../scripts/tokens/semantic-key-contract.js';

const baseline = async () => JSON.parse(await readFile('tests/tokens/fixtures/semantic-keys.s197.json', 'utf8')) as Record<string, string[]>;
/** s222-m01 (#2502): the names the 0.4.0 design reset added (the new colour roles, the brand's radius and font). */
const baseline222 = async () => JSON.parse(await readFile('tests/tokens/fixtures/semantic-keys.s222.json', 'utf8')) as Record<string, string[]>;

describe('semantic token names frozen for consumer re-pins', () => {
  it('pins every theme, both brands in base/dark/hc, aliases, and viz at the base', async () => {
    const before = await baseline();
    const now = await readSemanticKeySets(process.cwd());
    // No name a consumer pinned since Sprint 197 has been removed or renamed: every change is an addition. s212-m03 added
    // viz.mark.single; s222-m01 added the recipe roles and the theme shape file (theme.radius, theme.font).
    expect(semanticKeyChanges(before, now).filter((change) => !change.startsWith('Added ') && change !== 'File added/removed: packages/tokens/src/tokens/themes/theme0/shape.json')).toEqual([]);
    // And nothing has been added or removed since the s222 epoch was reviewed.
    expect(semanticKeyChanges(await baseline222(), now)).toEqual([]);
    for (const brand of ['A', 'B']) for (const mode of ['base', 'dark', 'hc']) {
      expect(before[`packages/tokens/src/tokens/brands/${brand}/${mode}.json`].length).toBeGreaterThan(0);
    }
  });
  it.each(['add', 'remove', 'rename'])('rejects a synthetic semantic key %s', async (action) => {
    const before = await baseline(); const after = structuredClone(before);
    const file = 'packages/tokens/src/tokens/brands/A/dark.json';
    if (action !== 'add') after[file].shift();
    if (action !== 'remove') after[file].push('color.brand.A.surface.newCanvas');
    expect(semanticKeyChanges(before, after).length).toBeGreaterThan(0);
  });
  it('permits declared dark/HC overrides of existing viz names but rejects new names or deleted overrides', async () => {
    const before = await baseline(); const after = structuredClone(before);
    const file = 'packages/tokens/src/tokens/brands/A/dark.json';
    after[file].push('viz.scale.sequential.01');
    expect(semanticKeyChanges(before, after)).toEqual([]);
    after[file].push('viz.scale.sequential.10');
    expect(semanticKeyChanges(before, after)).toHaveLength(1);
    after[file] = after[file].filter((key) => key !== 'viz.scale.categorical.06');
    expect(semanticKeyChanges(before, after)).toHaveLength(2);
  });
});
