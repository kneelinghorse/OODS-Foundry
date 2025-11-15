import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadDtcgTokens } from '../../src/tooling/tokens/dtcg.js';
import {
  collectVizScaleCollections,
  validateVizScaleCollections,
  type VizScaleCheck,
} from '../../scripts/tokens/validate-viz-scales.js';

const VIZ_SCALE_FILE = path.resolve(process.cwd(), 'packages/tokens/src/viz-scales.json');

function findFailures(results: readonly VizScaleCheck[]): VizScaleCheck[] {
  return results.filter((result) => !result.ok);
}

describe('viz token scales', () => {
  it('satisfy sequential and diverging guardrails', async () => {
    const tokens = await loadDtcgTokens(VIZ_SCALE_FILE);
    const collections = collectVizScaleCollections(tokens);
    expect(collections.sequential).toHaveLength(9);
    expect(collections.diverging).toHaveLength(11);

    const results = validateVizScaleCollections(collections);
    const failures = findFailures(results);
    expect(failures).toHaveLength(0);

    const sequentialComparisons = results.filter((result) => result.scope.startsWith('sequential/step'));
    expect(sequentialComparisons).toHaveLength(8);
  });

  it('flags invalid categorical aliases', async () => {
    const tokens = await loadDtcgTokens(VIZ_SCALE_FILE);
    const collections = collectVizScaleCollections(tokens);

    const results = validateVizScaleCollections({
      ...collections,
      categorical: [
        ...collections.categorical,
        {
          ...collections.categorical[0],
          path: ['viz', 'scale', 'categorical', 'invalid'],
          value: 'rgb(0, 0, 0)',
        },
      ],
    });

    const invalidResult = results.find((result) => result.scope === 'categorical/invalid');
    expect(invalidResult?.ok).toBe(false);
  });
});
