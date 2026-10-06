// s166 m02 (FF#22, Forge-Demos info_push 001bf9ba): order:['MarkPoint','MarkPoint','MarkPoint']
// fails uniqueItems — and that rejection is CORRECT, not a schema gap. applyLayerOrdering
// matches order entries against a Map<layerKey, layer>, and a Map collapses duplicate keys,
// so duplicate trait names in `order` can never address distinct layers no matter what the
// schema admits. The supported way to order repeated same-trait marks ALREADY exists:
// inferLayerKey prefers mark.options.id over mark.trait. This spec is the positive proof
// the amended schema description now documents — repeated same-trait marks with distinct
// ids ARE orderable — plus the declaration-order fallback and the duplicate rejection,
// pinned at the schema boundary so a silent uniqueItems relaxation fails HERE.
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { validateNormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

// Three SAME-trait MarkPoint layers, each addressable via a distinct options.id and
// identifiable in the compiled output by its distinct y field.
function tripleMarkPointSpec(layout?: Record<string, unknown>): NormalizedVizSpec {
  const x = { field: 'month', trait: 'EncodingPositionX', channel: 'x' };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'ff22-id-keying',
    name: 'Plan vs actual vs target',
    data: {
      values: [
        { month: 'Jan', baseline: 10, actual: 12, target: 15 },
        { month: 'Feb', baseline: 11, actual: 14, target: 15 },
      ],
    },
    marks: [
      {
        trait: 'MarkPoint',
        options: { id: 'baseline' },
        encodings: { x, y: { field: 'baseline', trait: 'EncodingPositionY', channel: 'y' } },
      },
      {
        trait: 'MarkPoint',
        options: { id: 'actual' },
        encodings: { x, y: { field: 'actual', trait: 'EncodingPositionY', channel: 'y' } },
      },
      {
        trait: 'MarkPoint',
        options: { id: 'target' },
        encodings: { x, y: { field: 'target', trait: 'EncodingPositionY', channel: 'y' } },
      },
    ],
    encoding: {
      x,
      y: { field: 'baseline', trait: 'EncodingPositionY', channel: 'y' },
    },
    ...(layout ? { layout } : {}),
    a11y: { description: 'Three point layers: baseline, actual, and target by month.' },
  } as unknown as NormalizedVizSpec;
}

function layerYFields(spec: NormalizedVizSpec): string[] {
  const compiled = toVegaLiteSpec(spec) as unknown as {
    layer?: readonly { encoding?: { y?: { field?: string } } }[];
  };
  return (compiled.layer ?? []).map((layer) => layer.encoding?.y?.field ?? '');
}

describe('vega-lite-adapter — s166 m02 LayoutLayer.order id-keying (FF#22)', () => {
  it('orders repeated same-trait marks via distinct options.id (the documented pattern)', () => {
    // s170 m04 (#1126): this fixture USED to order ['target','baseline','actual'] over the
    // declaration [baseline, actual, target] and expect ['target','baseline','actual'] — which
    // a FIRST-ENTRY-ONLY implementation (honour order[0], then fall back to declaration order)
    // produces byte-identically. The test was therefore degenerate: it could not tell the real
    // implementation from a much weaker one.
    //
    // ['actual','target','baseline'] discriminates. Declaration is [baseline, actual, target]:
    //   full ordering        → ['actual','target','baseline']  (every entry honoured, in list order)
    //   first-entry-only     → ['actual','baseline','target']  ('actual' pulled up, rest declaration order)
    const spec = tripleMarkPointSpec({
      trait: 'LayoutLayer',
      order: ['actual', 'target', 'baseline'],
    });
    // Paint order follows the id list, bottom first — three same-trait layers ARE
    // orderable today because inferLayerKey prefers options.id over the trait name.
    expect(layerYFields(spec)).toEqual(['actual', 'target', 'baseline']);
    // ...and it is NOT what a first-entry-only implementation would emit. Asserted explicitly so
    // the discrimination is a property of the test, not a fact about it someone has to notice.
    expect(layerYFields(spec)).not.toEqual(['actual', 'baseline', 'target']);
  });

  it('every order entry is honoured, not just the first (the #1126 discriminating case)', () => {
    // The same divergence stated as its own claim: reversing the declaration order end-to-end is
    // only reachable if EVERY entry is matched. First-entry-only cannot produce this.
    const spec = tripleMarkPointSpec({
      trait: 'LayoutLayer',
      order: ['target', 'actual', 'baseline'],
    });
    expect(layerYFields(spec)).toEqual(['target', 'actual', 'baseline']);
  });

  it('id-keyed order lists are schema-VALID (the documented pattern passes the boundary)', () => {
    const result = validateNormalizedVizSpec(
      tripleMarkPointSpec({ trait: 'LayoutLayer', order: ['target', 'baseline', 'actual'] })
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('keep-green: marks omitted from the order keep declaration order, rendering on top', () => {
    const spec = tripleMarkPointSpec({ trait: 'LayoutLayer', order: ['target'] });
    // 'target' is pulled to the bottom; 'baseline' and 'actual' keep declaration order after it.
    expect(layerYFields(spec)).toEqual(['target', 'baseline', 'actual']);
  });

  it('keep-green: no layout at all preserves declaration order', () => {
    expect(layerYFields(tripleMarkPointSpec())).toEqual(['baseline', 'actual', 'target']);
  });

  it('REJECTS duplicate order entries at the schema boundary (uniqueItems is intentional)', () => {
    const result = validateNormalizedVizSpec(
      tripleMarkPointSpec({
        trait: 'LayoutLayer',
        order: ['MarkPoint', 'MarkPoint', 'MarkPoint'],
      })
    );
    // The FF#22 report's exact shape. Duplicate keys can never address distinct layers
    // (the Map matcher collapses them), so admitting duplicates would validate specs
    // that silently do not do what they say. Relaxing uniqueItems fails HERE.
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path.includes('/layout/order'))).toBe(true);
  });
});
