import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateFacetTables } from '../../../src/viz/a11y/facet-table-generator.js';
import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const SPEC_PATH = path.join(ROOT, 'examples', 'viz', 'facet-layout.spec.json');

function loadSpec(): NormalizedVizSpec {
  const raw = readFileSync(SPEC_PATH, 'utf8');
  return JSON.parse(raw) as NormalizedVizSpec;
}

describe('generateFacetTables', () => {
  it('groups rows by facet layout fields', () => {
    const spec = loadSpec();
    const result = generateFacetTables(spec);

    expect(result.status).toBe('ready');
    expect(result.groups).toHaveLength(4);
    expect(result.layout.rowField).toBe('region');
    expect(result.layout.columnField).toBe('segment');
    expect(result.groups[0]?.rows.length).toBeGreaterThan(0);
  });

  it('honors maxPanels limit', () => {
    const spec = loadSpec();
    spec.layout = {
      ...spec.layout!,
      maxPanels: 2,
    };
    const result = generateFacetTables(spec);

    expect(result.status).toBe('ready');
    expect(result.groups).toHaveLength(2);
  });

  it('returns unavailable when layout metadata is missing', () => {
    const spec = loadSpec();
    // @ts-expect-error -- testing fallback when layout is omitted
    delete spec.layout;
    const result = generateFacetTables(spec);

    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('missing-layout');
  });

  it('respects table fallback disable flag', () => {
    const spec = loadSpec();
    spec.a11y.tableFallback = { enabled: false };
    const result = generateFacetTables(spec);

    expect(result.status).toBe('disabled');
    expect(result.reason).toBe('table-disabled');
  });
});
