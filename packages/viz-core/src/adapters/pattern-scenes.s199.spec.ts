import { evaluateAccuracyRules } from '../accuracy/index.js';
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { translatePattern } from '../patterns/translate-pattern.js';

const scene = (name: string) => {
  const result = translatePattern(`pattern:viz:${name}`);
  if (result.status !== 'scene') throw new Error(result.status);
  return result.spec;
};
describe('authored scene geometry and default selection (s199)', () => {
  it('declares each selection once on the first layer, preventing duplicate Vega signals', () => {
    const source = scene('layered-line-area'), compiled = toVegaLiteSpec(source) as any;
    expect(compiled.params).toBeUndefined();
    expect(compiled.layer[0].params.map((param: any) => param.name)).toEqual(source.interactions!.map(row => row.id));
    expect(compiled.layer.slice(1).every((layer: any) => layer.params === undefined)).toBe(true);
  });
  it('wraps the sparkline metrics into three bounded columns without duplicating the same facet field', () => {
    const source = scene('sparkline-grid'), compiled = toVegaLiteSpec(source) as any;
    if (source.layout?.trait !== 'LayoutFacet') throw new Error('Expected facets');
    expect(compiled.columns).toBe(3);
    expect(new Set(compiled.data.values.map((row: any) => row[compiled.facet.field])).size).toBe(12);
    expect(compiled.spec.width * 3 + source.layout!.gap! * 2).toBe(source.config!.layout!.width);
    expect(compiled.spec.height * 4 + source.layout!.gap! * 3).toBe(source.config!.layout!.height);
    expect(compiled.config.axisX.labelOverlap).toBe(true);
    expect(compiled.facet.row).toBeUndefined();
    expect(compiled.facet.column).toBeUndefined();
    expect(compiled.spec.encoding.color).toBeUndefined();
  });
  it('limits the actual panel data when maxPanels is smaller than the two-field facet population', () => {
    const source = scene('facet-small-multiples-line');
    if (source.layout?.trait !== 'LayoutFacet') throw new Error('Expected facets');
    source.layout.maxPanels = 2;
    const compiled = toVegaLiteSpec(source) as any;
    expect(new Set(compiled.data.values.map((row: any) => row[compiled.facet.field])).size).toBe(2);
    expect(compiled.columns).toBe(2);
    expect(compiled.spec.width).toBeLessThan(source.config!.layout!.width!);
  });
  it('keeps distinct facet tuples separate even when their joined labels collide', () => {
    const source = scene('facet-small-multiples-line');
    source.data.values = [{ region: 'A / B', segment: 'C', week: 'W1', value: 1 }, { region: 'A', segment: 'B / C', week: 'W1', value: 2 }];
    const compiled = toVegaLiteSpec(source) as any;
    expect(new Set(compiled.data.values.map((row: any) => row[compiled.facet.field])).size).toBe(2);
  });
  it('keeps histogram columns vertical with a zero count baseline and both bin boundaries', () => {
    const compiled = toVegaLiteSpec(scene('histogram')) as any;
    expect(compiled.mark.orient).toBe('vertical');
    expect(compiled.encoding.y.scale.zero).toBe(true);
    expect(compiled.encoding.x.field).toBe('binStart');
    expect(compiled.encoding.x2.field).toBe('binEnd');
  });
  it('makes the histogram bin-start axis explicit in the existing V150 coverage', () => {
    const source = scene('histogram'), compiled = toVegaLiteSpec(source) as any;
    expect(evaluateAccuracyRules(source, compiled).findings).toEqual([]);
    compiled.encoding.x.scale.zero = false;
    expect(evaluateAccuracyRules(source, compiled).findings).toContainEqual(expect.objectContaining({ code: 'OODS-V150', message: expect.stringContaining('x axis') }));
  });
  it('does not paint every mark as selected when a visual selection is empty', () => {
    const source = scene('multi-series-line');
    source.interactions = [{ id: 'hover', select: { type: 'point', on: 'hover', fields: ['month'] }, rule: { bindTo: 'visual', property: 'opacity', condition: { value: 1 }, else: { value: 0.4 } } }];
    const compiled = toVegaLiteSpec(source) as any;
    expect(compiled.encoding.opacity.condition.empty).toBe(false);
  });
});
