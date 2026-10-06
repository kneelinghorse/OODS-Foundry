import { describe, expect, it } from 'vitest';
import tokensBundle from '@oods/tokens';
import {
  analyzeVizSpec,
  assertNormalizedVizSpec,
  createColorIntensityMapper,
  NormalizedVizSpecError,
  suggestPatterns,
  toVegaLiteSpec,
  validateNormalizedVizSpec,
  type NormalizedVizSpec,
  type SchemaIntent,
} from '@oods/viz-core';

// These tests import through the package barrel (resolved to src/ via the
// vitest alias in vitest.config.ts). They verify the headless beachhead works
// end-to-end without any React/DOM/renderer runtime — the whole point of the
// Phase-0 "reconnect": a NormalizedVizSpec validates and compiles to a real
// data-bound Vega-Lite spec for bar/line/area/scatter/heatmap.

function beachheadSpec(
  markTrait: string,
  extraEncoding: Record<string, unknown> = {},
): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: `beachhead-${markTrait}`,
    name: `Beachhead ${markTrait}`,
    data: {
      values: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 15 },
      ],
    },
    marks: [{ trait: markTrait }],
    encoding: {
      x: { field: 'category', trait: 'EncodingPositionX', channel: 'x' },
      y: { field: 'value', trait: 'EncodingPositionY', channel: 'y', aggregate: 'sum' },
      ...extraEncoding,
    },
    a11y: { description: `A ${markTrait} chart of total value by category.` },
  } as NormalizedVizSpec;
}

describe('@oods/viz-core — NormalizedVizSpec validation', () => {
  it('accepts a minimal well-formed spec', () => {
    const result = validateNormalizedVizSpec(beachheadSpec('MarkBar'));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a spec with an empty accessibility description (the AJV trap)', () => {
    const invalid = { ...beachheadSpec('MarkBar'), a11y: { description: '' } } as NormalizedVizSpec;

    const result = validateNormalizedVizSpec(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ path: '/a11y/description' });
    expect(() => assertNormalizedVizSpec(invalid)).toThrow(NormalizedVizSpecError);
  });
});

describe('@oods/viz-core — Vega-Lite compilation of the 5 beachhead chart types', () => {
  const cases: ReadonlyArray<readonly [string, string, Record<string, unknown>]> = [
    ['MarkBar', 'bar', {}],
    ['MarkLine', 'line', {}],
    ['MarkArea', 'area', {}],
    ['MarkPoint', 'point', {}],
    // heatmap = rect mark with a quantitative colour channel
    ['MarkRect', 'rect', { color: { field: 'value', trait: 'EncodingColor', channel: 'color' } }],
  ];

  it.each(cases)('compiles %s into a data-bound %s Vega-Lite spec', (trait, markType, extra) => {
    const spec = beachheadSpec(trait, extra);

    // valid IR ...
    expect(validateNormalizedVizSpec(spec).valid).toBe(true);

    // ... and a genuine, renderable Vega-Lite spec (not the field-names-only placeholder)
    const vl = toVegaLiteSpec(spec);
    expect(vl.$schema).toContain('vega-lite');
    expect(vl.mark).toMatchObject({ type: markType });
    expect(vl.encoding?.x).toMatchObject({ field: 'category' });
    expect(vl.encoding?.y).toMatchObject({ field: 'value' });
    // accessibility description flows through into the rendered spec
    expect(vl.description).toBe(spec.a11y.description);
  });
});

describe('@oods/viz-core — chart recommender', () => {
  it('ranks grouped-bar highest for a grouped comparison intent', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      goal: 'comparison',
      requiresGrouping: true,
    };

    const [top] = suggestPatterns(schema, { limit: 1 });
    // grouped-bar and detail-overview-bar are otherwise score-identical (their
    // only difference, concatPreferred, is unweighted); m03's perceptualRank
    // (grouped-bar=1 < detail-overview-bar=2) is the canonical nudge that puts
    // grouped-bar on top before the alphabetical tie-break would pick the other.
    expect(top.pattern.id).toBe('grouped-bar');
    expect(top.score).toBeGreaterThan(0);
  });

  it('is deterministic — identical input yields identical ranking', () => {
    const schema: SchemaIntent = { measures: 3, dimensions: 1, temporals: 1, goal: 'trend', multiMetrics: true };
    const first = suggestPatterns(schema, { limit: 5 }).map((s) => s.pattern.id);
    const second = suggestPatterns(schema, { limit: 5 }).map((s) => s.pattern.id);
    expect(second).toEqual(first);
  });
});

describe('@oods/viz-core — @oods/tokens default-import-of-CJS interop', () => {
  // Guards the documented build pitfall: a broken dual-build default-import would
  // silently degrade tokensBundle.cssVariables to {} (color-intensity-mapper.ts:4
  // does `?? {}`), and the engine would emit token references with no resolved
  // fallback colours. Assert the map is genuinely populated and flows into the
  // mapper's resolved output.
  it('default-imports a bundle with a non-empty cssVariables map (not silently {})', () => {
    expect(tokensBundle).toBeTruthy();
    const cssVariables = (tokensBundle as { cssVariables?: Record<string, string> }).cssVariables ?? {};
    expect(Object.keys(cssVariables).length).toBeGreaterThan(0);
  });

  it('resolves real colour values through the token map (interop reached viz-core)', () => {
    const mapper = createColorIntensityMapper({ stops: 5 });
    expect(mapper.cssColors()).toHaveLength(5);
    // With a populated token map at least one stop resolves to a concrete colour
    // (rgb/oklch/hex) rather than only a bare `var(--token)` reference.
    const resolved = mapper.resolvedColors();
    expect(resolved).toHaveLength(5);
    expect(resolved.some((c) => /rgb\(|oklch\(|^#/.test(c))).toBe(true);
  });
});

describe('@oods/viz-core — accessibility data analysis (headless)', () => {
  it('extracts dimension/measure fields and row count from a spec', () => {
    const analysis = analyzeVizSpec(beachheadSpec('MarkBar'));
    expect(analysis.rowCount).toBe(3);
    expect(analysis.dimensionField).toBe('category');
    expect(analysis.measureField).toBe('value');
  });
});
