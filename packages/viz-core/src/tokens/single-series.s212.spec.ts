import { describe, expect, it } from 'vitest';
import { buildVizSpecFromRows } from '../builder/spec-builder.js';
import { toVegaLiteSpec } from '../adapters/vega-lite-adapter.js';
import { resolveTokenToColor } from '../adapters/echarts/token-resolver.js';
import { resolveCategoricalPalette, toHex } from './categorical-palette.js';

const input = { chartType: 'bar', rows: [{ x: 'One', y: 5, group: 'A' }, { x: 'Two', y: 8, group: 'B' }], encodings: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'quantitative' } } } as const;
const single = () => buildVizSpecFromRows(input as never).spec;
const color = (spec: ReturnType<typeof single>, scope = {}) => (toVegaLiteSpec(spec, scope) as any).mark.color;
// s212-m03 (#2327) gave a one-series chart its own governed token, viz.mark.single, apart from the categorical slots.
// s222-m02 (#2502 ruling 12): charts follow the brand, and the first series is the accent's solid (step 9), so the token's
// value is the first categorical slot's; the token itself, its overrides and the slots stay governed apart.
describe('single-series chart paint is the governed token, which is the brand accent', () => {
  for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark', 'hc'] as const) {
    it(`${brand}/${theme}: uses the governed single-series token without changing categorical slots`, () => {
      const spec = single(), scope = { brand, theme };
      const resolved = resolveTokenToColor('--oods-viz-mark-single', scope);
      expect(resolved).toBeDefined();
      expect(color(spec, scope)).toBe(theme === 'hc' ? 'CanvasText' : toHex(resolved!));
      if (theme !== 'hc') expect(color(spec, scope)).toBe(resolveCategoricalPalette(spec, scope)[0]);
      const multi = buildVizSpecFromRows({ ...input, encodings: { ...input.encodings, color: { field: 'group', type: 'nominal' } } } as never).spec;
      expect((toVegaLiteSpec(multi, scope) as any).encoding.color.scale.range).toEqual(resolveCategoricalPalette(multi, scope));
    });
  }
  it('preserves authored mark paint and explicit categorical ranges', () => {
    const spec = single();
    expect(color({ ...spec, marks: [{ ...spec.marks[0], options: { ...spec.marks[0].options, color: '#123456' } }] })).toBe('#123456');
    const multi = buildVizSpecFromRows({ ...input, encodings: { ...input.encodings, color: { field: 'group', type: 'nominal', range: ['#123456', '#ABCDEF'] } } } as never).spec;
    expect((toVegaLiteSpec(multi) as any).encoding.color.scale.range).toEqual(['#123456', '#ABCDEF']);
  });
  it('honors both the new semantic override and the previously supported slot-one override', () => {
    const spec = single();
    const config = (tokens: Record<string, string>) => ({ ...spec, config: { ...spec.config, tokens } });
    expect(color(config({ '--oods-viz-mark-single': '#123456' }))).toBe('#123456');
    expect(color(config({ '--oods-viz-scale-categorical-01': '#234567' }))).toBe('#234567');
    expect(color(config({ '--oods-viz-mark-single': '#123456', '--oods-viz-scale-categorical-01': '#234567' }))).toBe('#123456');
    expect(color(config({ '--oods-viz-mark-single': 'invalid' }))).toBe(color(spec));
  });
});
