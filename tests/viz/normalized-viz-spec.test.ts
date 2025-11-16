import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertNormalizedVizSpec,
  NormalizedVizSpecError,
  validateNormalizedVizSpec,
} from '../../src/viz/spec/normalized-viz-spec.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const EXAMPLES_DIR = path.join(ROOT, 'examples', 'viz');

function loadSpec(name: string): NormalizedVizSpec {
  const raw = readFileSync(path.join(EXAMPLES_DIR, `${name}.spec.json`), 'utf8');
  return JSON.parse(raw) as NormalizedVizSpec;
}

describe('Normalized Viz Spec validation', () => {
  it('accepts the curated bar chart example', () => {
    const spec = loadSpec('bar-chart');
    const result = validateNormalizedVizSpec(spec);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('coerces valid specs via assertion helper', () => {
    const spec = loadSpec('scatter-chart');
    const normalized = assertNormalizedVizSpec(spec);

    expect(normalized.name).toBe('Conversion Rate vs. Response Time');
    expect(normalized.portability?.fallbackType).toBe('table');
  });

  it('accepts specs that declare LayoutFacet metadata', () => {
    const spec = loadSpec('facet-layout');
    const result = validateNormalizedVizSpec(spec);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(spec.layout?.trait).toBe('LayoutFacet');
    expect(spec.layout?.sharedScales?.x).toBe('shared');
  });

  it('reports missing accessibility description', () => {
    const spec = loadSpec('line-chart');
    const invalid = {
      ...spec,
      a11y: {
        ...spec.a11y,
        description: '',
      },
    } satisfies NormalizedVizSpec;

    expect(() => assertNormalizedVizSpec(invalid)).toThrow(NormalizedVizSpecError);

    const validation = validateNormalizedVizSpec(invalid);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toMatchObject({
      path: '/a11y/description',
    });
  });

  it('validates interaction definitions', () => {
    const spec = loadSpec('bar-chart');
    const invalid = {
      ...spec,
      interactions: [
        {
          ...spec.interactions?.[0],
          select: {
            type: 'point',
            on: 'hover',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- intentionally invalid for validation test
            fields: [] as unknown,
          },
        },
      ],
    } as unknown as NormalizedVizSpec;

    expect(() => assertNormalizedVizSpec(invalid)).toThrow(NormalizedVizSpecError);

    const result = validateNormalizedVizSpec(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.path).toBe('/interactions/0/select/fields');
  });

  it('rejects layout entries missing facet dimensions', () => {
    const spec = loadSpec('facet-layout');
    const invalid = {
      ...spec,
      layout: {
        trait: 'LayoutFacet',
        wrap: 'row',
      },
    } as unknown as NormalizedVizSpec;

    expect(() => assertNormalizedVizSpec(invalid)).toThrow(NormalizedVizSpecError);

    const result = validateNormalizedVizSpec(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.path).toBe('/layout');
  });
});
