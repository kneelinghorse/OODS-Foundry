// chord-adapter unit spec (sprint-120 m01). Verifies the FRESH native-chord
// adapter: a series.type:'chord' ring (coordinateSystem:'none') with name-keyed
// arcs, value-weighted ribbons matched by name, a per-arc palette, and a STRING
// tooltip template that survives JSON transport. Auto-globbed by the viz-core
// vitest config (test/**), so it runs under the viz-determinism CI gate.

import { describe, expect, it } from 'vitest';
import { adaptChordToECharts, type NormalizedVizSpec, type SankeyInput } from '@oods/viz-core';

function spec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'viz:chord',
    name: 'Trade corridors',
    data: { values: [] },
    marks: [{ trait: 'MarkChord' }],
    encoding: {},
    a11y: { description: 'Chord of regional trade corridors.' },
    ...overrides,
  } as NormalizedVizSpec;
}

// A three-arc ring with ribbons that reference existing arc names by name.
const TRADE: SankeyInput = {
  nodes: [{ name: 'AMER' }, { name: 'EMEA' }, { name: 'APAC' }],
  links: [
    { source: 'AMER', target: 'EMEA', value: 42 },
    { source: 'EMEA', target: 'APAC', value: 31 },
    { source: 'APAC', target: 'AMER', value: 25 },
  ],
};

const seriesOf = (option: unknown): Record<string, any> =>
  (option as Record<string, any>).series[0];

describe('adaptChordToECharts', () => {
  it('emits a native series.type:"chord" on its own ring (coordinateSystem:"none")', () => {
    const series = seriesOf(adaptChordToECharts(spec(), TRADE));
    expect(series.type).toBe('chord');
    expect(series.coordinateSystem).toBe('none');
    // It is NOT a graph clone: no force layout / roam / draggable / categories[].
    expect(series.layout).toBeUndefined();
    expect(series.roam).toBeUndefined();
    expect(series.categories).toBeUndefined();
    // Ring geometry carries the native chord defaults.
    expect(series.startAngle).toBe(90);
    expect(series.padAngle).toBe(3);
    expect(series.label.position).toBe('outside');
  });

  it('keys ring arcs by NAME and paints each from the categorical palette', () => {
    const series = seriesOf(adaptChordToECharts(spec(), TRADE));
    expect(series.nodes).toHaveLength(3);
    expect(series.nodes.map((n: { name: string }) => n.name)).toEqual(['AMER', 'EMEA', 'APAC']);
    // Each arc gets a resolved colour string (a chord node IS its own category).
    for (const node of series.nodes) {
      expect(typeof node.itemStyle.color).toBe('string');
      expect(node.itemStyle.color.length).toBeGreaterThan(0);
    }
    // Distinct arcs get distinct palette entries (deterministic per-index colouring).
    const colors = series.nodes.map((n: { itemStyle: { color: string } }) => n.itemStyle.color);
    expect(new Set(colors).size).toBe(3);
  });

  it('a ribbon whose endpoints match arc names SURVIVES with its unprecomputed value (= width)', () => {
    const series = seriesOf(adaptChordToECharts(spec(), TRADE));
    expect(series.links).toHaveLength(3);
    // Matched-by-name: the ribbon carries the SAME name strings the arcs use, and the
    // value (which natively drives ribbon width) is passed through, NOT precomputed.
    expect(series.links[0]).toEqual({ source: 'AMER', target: 'EMEA', value: 42 });
    const names = new Set(series.nodes.map((n: { name: string }) => n.name));
    for (const link of series.links) {
      expect(names.has(link.source)).toBe(true);
      expect(names.has(link.target)).toBe(true);
      expect(typeof link.value).toBe('number');
      // No precomputed width field — ECharts sizes the ribbon from value at render.
      expect(link.width).toBeUndefined();
    }
  });

  it('tooltip.formatter is a STRING template (survives JSON transport — no dropped closure)', () => {
    const option = adaptChordToECharts(spec(), TRADE) as Record<string, any>;
    expect(typeof option.tooltip.formatter).toBe('string');
    // The whole option round-trips through JSON with the formatter intact (a function
    // would vanish here — the regression this asserts against).
    const roundTripped = JSON.parse(JSON.stringify(option));
    expect(roundTripped.tooltip.formatter).toBe(option.tooltip.formatter);
    expect(roundTripped.series[0].type).toBe('chord');
  });

  it('honours spec.layout / link overrides (ring angle + ribbon curveness)', () => {
    const series = seriesOf(
      adaptChordToECharts(
        spec({
          ...({ layout: { startAngle: 0, padAngle: 6, clockwise: false } } as Partial<NormalizedVizSpec>),
          ...({ encoding: { link: { curveness: 0.1 } } } as Partial<NormalizedVizSpec>),
        }),
        TRADE,
      ),
    );
    expect(series.startAngle).toBe(0);
    expect(series.padAngle).toBe(6);
    expect(series.clockwise).toBe(false);
    expect(series.lineStyle.curveness).toBe(0.1);
  });

  it('is deterministic: same (spec, input) -> byte-identical option', () => {
    const a = JSON.stringify(JSON.parse(JSON.stringify(adaptChordToECharts(spec(), TRADE))));
    const b = JSON.stringify(JSON.parse(JSON.stringify(adaptChordToECharts(spec(), TRADE))));
    expect(a).toBe(b);
  });
});
