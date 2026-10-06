import { describe, expect, it, vi } from 'vitest';
import { toEChartsOption } from './echarts-adapter.js';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { generateHierarchyTooltip } from './echarts/hierarchy-utils.js';
import { adaptSankeyToECharts } from './echarts/sankey-adapter.js';
import type { NormalizedVizSpec, TraitBinding } from '../spec/normalized-viz-spec.js';

function temporalSpec(binding: Partial<TraitBinding> = { type: 'temporal' }): NormalizedVizSpec {
  return {
    data: { values: [{ date: '2026-03-08T07:30:00Z', value: 3, group: 'A' }, { date: '2026-11-01T06:30:00Z', value: 7, group: 'B' }] },
    marks: [{ trait: 'MarkLine' }],
    encoding: { x: { field: 'date', trait: 'EncodingPositionX', ...binding }, y: { field: 'value', trait: 'EncodingPositionY', type: 'quantitative' } },
    a11y: { description: 'Values spanning US daylight-saving boundaries.' },
  };
}

function encoding(spec: NormalizedVizSpec): Record<string, Record<string, unknown>> {
  const result = toVegaLiteSpec(spec);
  return ('encoding' in result ? result.encoding : result.layer[0]!.encoding) as Record<string, Record<string, unknown>>;
}

describe('temporal adapters select UTC by construction (s196 m05)', () => {
  it.each([{ type: 'temporal' }, { scale: 'temporal' }, { timeUnit: 'month' }] as const)(
    'pins inferred and explicit temporal binding %j without relying on process TZ', binding => {
      const spec = temporalSpec(binding);
      expect(encoding(spec).x).toMatchObject({ type: 'temporal', scale: { type: 'utc' } });
      expect(toEChartsOption(spec)).toMatchObject({ useUTC: true, xAxis: { type: 'time' } });
    },
  );

  it.each([
    ['year', 'utcyear'], ['quarter', 'utcquarter'], ['month', 'utcmonth'], ['week', 'utcweek'],
    ['day', 'utcday'], ['hour', 'utchours'], ['minute', 'utcminutes'], ['second', 'utcseconds'],
  ] as const)('maps normalized %s to the valid Vega UTC bucket %s', (timeUnit, expected) => {
    expect(encoding(temporalSpec({ timeUnit })).x).toMatchObject({ timeUnit: expected, scale: { type: 'utc' } });
  });

  it('pins a temporal Y axis and mark-local bindings, including layout projections', () => {
    const spec = temporalSpec();
    spec.encoding = {};
    spec.marks[0].encodings = { x: { field: 'value', trait: 'EncodingPositionX', type: 'quantitative' }, y: { field: 'date', trait: 'EncodingPositionY', type: 'temporal' } };
    expect(toEChartsOption(spec)).toMatchObject({ useUTC: true, yAxis: { type: 'time' } });
    expect(encoding(spec).y.scale).toEqual({ type: 'utc' });
    spec.layout = { trait: 'LayoutFacet', columns: { field: 'group' } };
    const faceted = toEChartsOption(spec);
    expect(faceted.useUTC).toBe(true);
    expect(faceted.yAxis).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'time' })]));
  });

  it('leaves categorical and quantitative output free of temporal options', () => {
    const spec = temporalSpec({ type: 'nominal', scale: 'band' });
    expect(toEChartsOption(spec)).not.toHaveProperty('useUTC');
    // s224-m01 (#2542 ruling 3): a line over a nominal x keeps its rows' order (sort: null), a categorical option.
    expect(encoding(spec).x).toEqual({ field: 'date', type: 'nominal', scale: { type: 'band' }, sort: null });
    expect(encoding(spec).y).toEqual({ field: 'value', type: 'quantitative' });
  });

  it('parses adapter-owned date formats in UTC without rewriting caller-authored expressions', () => {
    const spec = temporalSpec();
    spec.transforms = [
      { type: 'calculate', params: { field: 'date', format: '%Y-%m', as: 'parsed' } },
      { type: 'calculate', params: { calculate: 'datum.value * 2', as: 'twice' } },
    ];
    expect(toVegaLiteSpec(spec).transform).toEqual([
      { calculate: 'utcParse(datum["date"], "%Y-%m")', as: 'parsed' },
      { calculate: 'datum.value * 2', as: 'twice' },
    ]);
  });
});

describe('ECharts numeric tooltips do not inherit host locale', () => {
  it('formats hierarchy and small Sankey values in en-US even under a hostile default locale', () => {
    const original = Number.prototype.toLocaleString;
    const calls = vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (this: number, locales, options) {
      return original.call(this, locales ?? 'de-DE', options);
    });
    try {
      const hierarchy = generateHierarchyTooltip(temporalSpec(), 'treemap').formatter as (params: unknown) => string;
      expect(hierarchy({ name: 'Total', value: 1234.5 })).toContain('Value: 1,234.5');
      const sankey = adaptSankeyToECharts(temporalSpec(), { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 12.5 }] });
      const tooltip = (sankey.tooltip as { formatter: (params: unknown) => string }).formatter;
      expect(tooltip({ name: 'A', value: 12.5 })).toContain('Total: 12.5');
      expect(calls.mock.calls).toEqual([['en-US'], ['en-US']]);
      expect(tooltip({ name: 'A', value: 1234 })).toContain('Total: 1.2K');
      expect(tooltip({ name: 'A', value: 1234567 })).toContain('Total: 1.2M');
      expect(hierarchy({ name: 'Missing', value: null })).toContain('Value: n/a');
    } finally {
      calls.mockRestore();
    }
  });
});
