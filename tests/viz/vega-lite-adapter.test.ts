import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec, VegaLiteAdapterError } from '../../src/viz/adapters/vega-lite-adapter.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const EXAMPLES_DIR = path.join(ROOT, 'examples', 'viz');

function loadSpec(name: string): NormalizedVizSpec {
  const raw = readFileSync(path.join(EXAMPLES_DIR, `${name}.spec.json`), 'utf8');
  return JSON.parse(raw) as NormalizedVizSpec;
}

describe('Vega-Lite adapter', () => {
  it('translates the curated bar chart spec', () => {
    const spec = loadSpec('bar-chart');
    const result = toVegaLiteSpec(spec);

    expect(result.$schema).toContain('vega-lite');
    expect(result.mark).toMatchObject({ type: 'bar' });
    expect(result.encoding?.x).toMatchObject({
      field: 'region',
      type: 'ordinal',
      sort: 'ascending',
      title: 'Region',
    });
    expect(result.encoding?.y).toMatchObject({
      field: 'mrr',
      type: 'quantitative',
      aggregate: 'sum',
    });
    expect(result.encoding?.fillOpacity).toMatchObject({
      condition: { param: 'region-highlight', value: 1 },
      value: 0.35,
    });
    expect(result.encoding?.tooltip).toEqual([{ field: 'region' }, { field: 'mrr' }]);
    expect(result.width).toBe(480);
    expect(result.height).toBe(320);
    expect(result.description).toBe(spec.a11y.description);
    expect(result.usermeta?.oods?.theme).toBe('brand-a');
    expect(result.params?.[0]).toMatchObject({
      name: 'region-highlight',
      select: { type: 'point', on: 'hover' },
    });
  });

  it('injects filter transforms from interaction definitions', () => {
    const spec = loadSpec('bar-chart');
    const interactive: NormalizedVizSpec = {
      ...spec,
      interactions: [
        {
          id: 'range-filter',
          select: { type: 'interval', on: 'drag', encodings: ['x'] },
          rule: { bindTo: 'filter' },
        },
      ],
    };

    const result = toVegaLiteSpec(interactive);
    expect(result.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ filter: { param: 'range-filter' } })])
    );
  });

  it('binds zoom interactions to Vega-Lite scales', () => {
    const spec = loadSpec('line-chart');
    const interactive: NormalizedVizSpec = {
      ...spec,
      interactions: [
        {
          id: 'zoom-all',
          select: { type: 'interval', on: 'wheel', encodings: ['x'], bind: 'scales' },
          rule: { bindTo: 'zoom' },
        },
      ],
    };

    const result = toVegaLiteSpec(interactive);
    expect(result.params?.[0]).toMatchObject({
      name: 'zoom-all',
      select: { bind: 'scales' },
    });
  });

  it('generates calculate transforms for field-format instructions', () => {
    const spec = loadSpec('line-chart');
    const result = toVegaLiteSpec(spec);

    expect(result.transform?.[0]).toMatchObject({
      calculate: 'timeParse(datum["month"], "%Y-%m")',
      as: 'month',
    });
    expect(result.encoding?.x).toMatchObject({ type: 'temporal' });
  });

  it('creates a layered spec when multiple marks are defined', () => {
    const spec = loadSpec('scatter-chart');
    const layeredSpec: NormalizedVizSpec = {
      ...spec,
      marks: [
        spec.marks[0],
        {
          trait: 'MarkLine',
          encodings: {
            x: spec.encoding.x,
            y: spec.encoding.y,
          },
        },
      ],
    };

    const result = toVegaLiteSpec(layeredSpec);
    expect(Array.isArray(result.layer)).toBe(true);
    expect(result.layer).toHaveLength(2);
    expect(result.layer?.[1]).toMatchObject({ mark: { type: 'line' } });
  });

  it('maps average aggregates to Vega-Lite mean operations', () => {
    const spec: NormalizedVizSpec = {
      $schema: 'https://oods.dev/viz-spec/v1',
      id: 'avg-example',
      name: 'Average Example',
      data: {
        values: [{ category: 'A', value: 10 }],
      },
      marks: [
        {
          trait: 'MarkPoint',
        },
      ],
      encoding: {
        x: { field: 'category', trait: 'EncodingPositionX', channel: 'x' },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'average',
        },
      },
      a11y: {
        description: 'Average test',
      },
    };

    const result = toVegaLiteSpec(spec);
    expect(result.encoding?.y).toMatchObject({ aggregate: 'mean' });
  });

  it('treats y-position without quantitative hints as ordinal', () => {
    const spec: NormalizedVizSpec = {
      $schema: 'https://oods.dev/viz-spec/v1',
      id: 'horizontal-bars',
      name: 'Horizontal Bars',
      data: {
        values: [
          { rep: 'Alex', bookings: 200000 },
          { rep: 'Jordan', bookings: 320000 },
        ],
      },
      marks: [
        {
          trait: 'MarkBar',
          encodings: {
            y: { field: 'rep', trait: 'EncodingPositionY', channel: 'y', sort: 'descending' },
            x: {
              field: 'bookings',
              trait: 'EncodingPositionX',
              channel: 'x',
              aggregate: 'sum',
              scale: 'linear',
            },
          },
        },
      ],
      encoding: {
        y: { field: 'rep', trait: 'EncodingPositionY', channel: 'y', sort: 'descending' },
        x: {
          field: 'bookings',
          trait: 'EncodingPositionX',
          channel: 'x',
          aggregate: 'sum',
          scale: 'linear',
        },
      },
      a11y: {
        description: 'Horizontal example',
      },
    };

    const result = toVegaLiteSpec(spec);

    expect(result.encoding?.y).toMatchObject({ type: 'ordinal' });
  });

  it('throws for unsupported mark traits', () => {
    const spec = loadSpec('bar-chart');
    const invalidSpec: NormalizedVizSpec = {
      ...spec,
      marks: [{ ...spec.marks[0], trait: 'MarkUnknown' }],
    };

    expect(() => toVegaLiteSpec(invalidSpec)).toThrow(VegaLiteAdapterError);
  });
});
