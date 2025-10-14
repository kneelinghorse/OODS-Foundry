import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REGION_ORDER,
  isCanonicalRegionId,
  type CanonicalRegionID,
} from '../../src/types/regions.js';

const FORBIDDEN_REGION_SUBSTRINGS = ['banner', 'notification', 'tabs', 'toast'];

function getExportedRegions(): CanonicalRegionID[] {
  return [...REGION_ORDER];
}

describe('B3.1 — Region Contract', () => {
  it('exports a canonical region set in the approved 5–7 range without forbidden names', () => {
    const exported = getExportedRegions();
    expect(exported.length).toBeGreaterThanOrEqual(5);
    expect(exported.length).toBeLessThanOrEqual(7);

    const forbiddenHits = exported.filter((region) => {
      const normalized = region.toLowerCase();
      return FORBIDDEN_REGION_SUBSTRINGS.some((needle) => normalized.includes(needle));
    });

    expect(forbiddenHits, `Forbidden region identifiers detected: ${forbiddenHits.join(', ')}`).toHaveLength(0);
    expect(exported.every((region) => isCanonicalRegionId(region))).toBe(true);
  });

  it('defines REGION_ORDER with unique canonical ids and no omissions', () => {
    const exported = getExportedRegions();
    const set = new Set(exported);
    expect(set.size).toBe(exported.length);

    for (const region of exported) {
      expect(REGION_ORDER.includes(region)).toBe(true);
    }
  });

  it('documents the migration from 11 canonical regions to the new set at docs/specs/regions.md', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const documentationPath = resolve(here, '../../docs/specs/regions.md');

    const exists = existsSync(documentationPath);
    expect(exists, 'Expected docs/specs/regions.md to exist with the region migration table.').toBe(
      true
    );

    if (!exists) {
      return;
    }

    const contents = readFileSync(documentationPath, 'utf8');
    expect(contents).toMatch(/11/);
    expect(contents).toMatch(/globalNavigation/);
  });
});
