/**
 * s223-m01 (#2527 rulings 2 and 3), fixed at the producer:
 *
 * 1. Bars have a sane width. Placed charts are drawn 720, 360 and 1120 wide with `autosize: fit`, so a chart of one or
 *    a few categories drew one bar across most of the plot (Invoice's single line item was a 585px bar at 720). A bar on
 *    a band axis is now at most 48px thick and centred in its band; a chart of many categories, whose bands are already
 *    narrower, draws the same bars. MarkBar's `bandPadding` option, dropped as a key MarkDef does not have, is the band
 *    scale's inner padding.
 * 2. Money in a chart is money. A binding's label `format` and `currency` reach the axis and Vega's number locale, so
 *    "$" prints € or £, and they ride the normalized spec, so artifact.certify's replay compiles the same spec.
 */
import { describe, expect, it } from 'vitest';
import { BAR_MAX_THICKNESS, CURRENCY_FORMAT, currencyNumberLocale, toVegaLiteSpec, VegaLiteAdapterError } from './vega-lite-adapter.js';
import { buildVizSpecFromRows } from '../builder/spec-builder.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

type Compiled = Record<string, any>;
const scope = { theme: 'light', brand: 'A' } as const;
const plans = [{ plan: 'Starter', seats: 12 }, { plan: 'Team', seats: 40 }, { plan: 'Business', seats: 75 }];
const bar = (encodings: Record<string, unknown>, rows: Array<Record<string, unknown>> = plans) =>
  buildVizSpecFromRows({ rows, chartType: 'bar', encodings: encodings as never }).spec;
const markOf = (compiled: Compiled): Compiled => compiled.mark ?? compiled.spec?.mark ?? compiled.layer?.[0]?.mark;
const encodingOf = (compiled: Compiled): Compiled => compiled.encoding ?? compiled.spec?.encoding ?? compiled.layer?.[0]?.encoding;
const cap = (channel: 'x' | 'y') => ({ expr: `min(${BAR_MAX_THICKNESS}, bandwidth('${channel}'))` });

describe('a bar is at most 48px thick (s223-m01, #2527 ruling 3)', () => {
  it('caps a vertical bar on its band x, and a horizontal bar on its band y', () => {
    expect(markOf(toVegaLiteSpec(bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' } }), scope))).toMatchObject({ type: 'bar', width: cap('x') });
    const horizontal = markOf(toVegaLiteSpec(bar({ x: { field: 'seats', aggregate: 'sum' }, y: 'plan' }), scope));
    expect(horizontal).toMatchObject({ type: 'bar', height: cap('y') });
    expect(horizontal).not.toHaveProperty('width');
  });

  it('leaves a bar with no bands alone: a temporal, binned, point-scaled or quantitative axis has bandwidth 0', () => {
    const months = [{ at: '2026-01-01', total: 3 }, { at: '2026-02-01', total: 5 }];
    for (const spec of [
      bar({ x: { field: 'at', scale: 'temporal' }, y: { field: 'total', aggregate: 'sum' } }, months),
      bar({ x: { field: 'at', timeUnit: 'month' }, y: { field: 'total', aggregate: 'sum' } }, months),
      bar({ x: { field: 'plan', scale: 'point' }, y: { field: 'seats', aggregate: 'sum' } }),
      bar({ x: { field: 'seats', scale: 'linear' }, y: { field: 'seats', scale: 'linear' } }),
    ]) {
      const mark = markOf(toVegaLiteSpec(spec, scope));
      expect(mark).not.toHaveProperty('width');
      expect(mark).not.toHaveProperty('height');
    }
    const binned = bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' } });
    binned.encoding.x = { ...binned.encoding.x!, bin: true };
    expect(markOf(toVegaLiteSpec(binned, scope))).not.toHaveProperty('width');
  });

  it('reads only a band scale Vega names after its channel: shared in a layer or facet, never in a concat or when independent', () => {
    const base = bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' }, color: 'plan' });
    const withLayout = (layout: NormalizedVizSpec['layout']) => ({ ...base, layout }) as NormalizedVizSpec;
    // A facet or a layer shares its x scale by default, and Vega-Lite names it 'x'.
    expect(markOf(toVegaLiteSpec(withLayout({ trait: 'LayoutFacet', columns: { field: 'plan' } }), scope))).toMatchObject({ width: cap('x') });
    expect(markOf(toVegaLiteSpec(withLayout({ trait: 'LayoutLayer' }), scope))).toMatchObject({ width: cap('x') });
    // An independent x is renamed per child (child_x, layer_0_x) and a concat's per section (concat_0_x): bandwidth('x')
    // would be 0 there and erase the bars, so those keep Vega-Lite's own thickness.
    for (const layout of [
      { trait: 'LayoutFacet', columns: { field: 'plan' }, sharedScales: { x: 'independent' } },
      { trait: 'LayoutLayer', sharedScales: { x: 'independent' } },
      { trait: 'LayoutConcat', sections: [{ id: 'a' }, { id: 'b' }] },
    ] as Array<NormalizedVizSpec['layout']>) {
      const compiled = toVegaLiteSpec(withLayout(layout), scope) as Compiled;
      const marks = [compiled.mark, compiled.spec?.mark, ...(compiled.layer ?? []).map((layer: Compiled) => layer.mark), ...(compiled.hconcat ?? []).map((section: Compiled) => section.mark)].filter(Boolean);
      expect(marks.length, JSON.stringify(layout)).toBeGreaterThan(0);
      for (const mark of marks) expect(mark, JSON.stringify(layout)).not.toHaveProperty('width');
    }
  });

  it('keeps a thickness the spec already sets: its own width or size, or a size encoding', () => {
    for (const options of [{ width: 20 }, { size: 12 }]) {
      const spec = bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' } });
      spec.marks[0] = { ...spec.marks[0]!, options };
      expect(markOf(toVegaLiteSpec(spec, scope))).toMatchObject(options.width ? { width: 20 } : { size: 12 });
    }
    expect(markOf(toVegaLiteSpec(bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' }, size: 'seats' }), scope))).not.toHaveProperty('width');
  });

  it('honours MarkBar bandPadding as the band scale\'s paddingInner, never as a mark key', () => {
    const padded = bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' } });
    padded.marks[0] = { ...padded.marks[0]!, options: { bandPadding: 0.3 } };
    const compiled = toVegaLiteSpec(padded, scope) as Compiled;
    expect(encodingOf(compiled).x.scale).toMatchObject({ paddingInner: 0.3 });
    expect(markOf(compiled)).not.toHaveProperty('bandPadding');
    expect(markOf(compiled)).toMatchObject({ width: cap('x') });
    // Outside the band's 0-1 range it is dropped rather than guessed at.
    padded.marks[0] = { ...padded.marks[0]!, options: { bandPadding: 1.2 } };
    expect(encodingOf(toVegaLiteSpec(padded, scope) as Compiled).x.scale?.paddingInner).toBeUndefined();
  });
});

describe('money in a chart is money (s223-m01, #2527 ruling 2)', () => {
  it('carries a binding\'s format and currency into the normalized spec, upper-casing the code', () => {
    const spec = bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum', format: '$,.2f', currency: 'eur' } });
    expect(spec.encoding.y).toMatchObject({ format: '$,.2f', currency: 'EUR' });
  });

  it('formats the axis and gives Vega the currency\'s symbol, so "$" prints €', () => {
    const compiled = toVegaLiteSpec(bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum', format: '$,.2f', currency: 'EUR' } }), scope) as Compiled;
    expect(encodingOf(compiled).y.axis).toEqual({ format: '$,.2f' });
    expect(compiled.config.locale).toEqual({ number: { decimal: '.', thousands: ',', grouping: [3], currency: ['€', ''] } });
  });

  it('reads a currency without a format as "$,f", whose precision follows the tick step', () => {
    expect(CURRENCY_FORMAT).toBe('$,f');
    const compiled = toVegaLiteSpec(bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum', currency: 'GBP' } }), scope) as Compiled;
    expect(encodingOf(compiled).y.axis).toEqual({ format: '$,f' });
    expect(compiled.config.locale.number.currency).toEqual(['£', '']);
  });

  it('leaves a chart with no format or currency as it was: no axis format, no locale', () => {
    const compiled = toVegaLiteSpec(bar({ x: 'plan', y: { field: 'seats', aggregate: 'sum' } }), scope) as Compiled;
    expect(encodingOf(compiled).y).not.toHaveProperty('axis');
    expect(compiled.config).not.toHaveProperty('locale');
  });

  it('puts a declared format on a temporal axis in place of the day-tick label expression, and on a legend', () => {
    const months = [{ at: '2026-01-01', total: 3, plan: 'Team' }, { at: '2026-02-01', total: 5, plan: 'Business' }];
    const temporal = toVegaLiteSpec(buildVizSpecFromRows({ rows: months, chartType: 'line', encodings: { x: { field: 'at', scale: 'temporal', format: '%b %Y' }, y: 'total' } }).spec, scope) as Compiled;
    expect(encodingOf(temporal).x.axis).toEqual({ format: '%b %Y' });
    const legend = toVegaLiteSpec(buildVizSpecFromRows({ rows: months, chartType: 'scatter', encodings: { x: 'at', y: 'total', size: { field: 'total', format: ',.0f' } } }).spec, scope) as Compiled;
    expect(encodingOf(legend).size.legend).toMatchObject({ format: ',.0f' });
  });

  it('refuses two currencies in one chart: the number locale is the chart\'s', () => {
    const spec = buildVizSpecFromRows({ rows: [{ a: 1, b: 2, c: 'x' }], chartType: 'scatter', encodings: { x: { field: 'a', currency: 'USD' }, y: { field: 'b', currency: 'EUR' } } }).spec;
    expect(() => toVegaLiteSpec(spec, scope)).toThrow(VegaLiteAdapterError);
    expect(() => toVegaLiteSpec(spec, scope)).toThrow('USD and EUR');
  });

  it('takes each currency\'s symbol as the record view prints money (Intl en-US)', () => {
    const symbol = (code: string) => currencyNumberLocale(code).currency;
    expect(symbol('USD')).toEqual(['$', '']);
    expect(symbol('EUR')).toEqual(['€', '']);
    expect(symbol('GBP')).toEqual(['£', '']);
    expect(symbol('JPY')).toEqual(['¥', '']);
    for (const code of ['USD', 'EUR', 'GBP', 'JPY']) {
      const printed = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(12000);
      expect(printed.startsWith(symbol(code)[0]), code).toBe(true);
    }
    expect(() => currencyNumberLocale('EURO')).toThrow(VegaLiteAdapterError);
  });
});
