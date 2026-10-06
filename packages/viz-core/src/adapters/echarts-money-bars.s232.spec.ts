import { describe, expect, it } from 'vitest';
import * as echarts from 'echarts';
import payment from '../../test/fixtures/s232-payment.json';
import { toEChartsOption } from './echarts-adapter.js';
import { selectVizRenderer } from './renderer-selector.js';
import { currencyNumberLocale } from './vega-lite-adapter.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

const paymentSpec = () => structuredClone(payment) as unknown as NormalizedVizSpec;
const axisFormat = (spec: NormalizedVizSpec, channel: 'x' | 'y' = 'y') => (toEChartsOption(spec)[`${channel}Axis`] as any).axisLabel.formatter as (value: unknown) => string;
const tooltip = (spec: NormalizedVizSpec, data: Record<string, unknown>) => (toEChartsOption(spec).tooltip!.formatter as (params: unknown) => string)({ data });
function layout(spec: NormalizedVizSpec, width = 1440) {
  const option = toEChartsOption(spec);
  const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width, height: 320 });
  try {
    chart.setOption({ ...option, animation: false } as echarts.EChartsOption);
    return { svg: chart.renderToSVGString(), bar: (chart as any).getModel().getSeriesByIndex(0).getData().getItemLayout(0) };
  } finally { chart.dispose(); }
}

describe('s232 ECharts payment money and category bars', () => {
  it('renders the actual Subscription EUR operand with money ticks and a formatted refund tooltip', () => {
    const spec = paymentSpec();
    expect(selectVizRenderer(spec, { preferred: 'echarts' })).toMatchObject({ renderer: 'echarts', reason: 'user-preference' });
    expect(spec.data.values).toHaveLength(11);
    expect(spec.data.values!.some(row => row.amount === -19)).toBe(true);
    const rendered = layout(spec);
    expect(rendered.svg).toContain('€20');
    expect(rendered.svg).toContain('−€20');
    expect(tooltip(spec, { payment: 'Aug 19, 2026', amount: -19 })).toContain('amount: </span>');
    expect(tooltip(spec, { payment: 'Aug 19, 2026', amount: -19 })).toContain('−€19');
    expect(rendered.bar.width).toBeLessThanOrEqual(48);
    // The JSON wire has always omitted formatter callbacks. Do not confuse an in-process option with transport parity.
    expect(JSON.parse(JSON.stringify(toEChartsOption(spec))).yAxis.axisLabel).not.toHaveProperty('formatter');
  });

  it.each(['USD', 'EUR', 'GBP', 'CHF'])('keeps explicit precision and the shared %s locale in axis and tooltip labels', currency => {
    const spec = paymentSpec();
    spec.encoding.y = { ...spec.encoding.y!, currency, format: '$,.2f' };
    const [prefix, suffix] = currencyNumberLocale(currency).currency;
    expect(axisFormat(spec)(12000)).toBe(`${prefix}12,000.00${suffix}`);
    expect(axisFormat(spec)(-19.5)).toBe(`−${prefix}19.50${suffix}`);
    expect(tooltip(spec, { amount: -19.5 })).toContain(`−${prefix}19.50${suffix}`);
    expect(axisFormat(spec)(0)).toBe(`${prefix}0.00${suffix}`);
  });

  it('honors declared non-currency formats, implicit currency and sub-unit tick distinctions', () => {
    const percent = paymentSpec();
    percent.encoding.y = { ...percent.encoding.y!, currency: undefined, format: '.1%' };
    expect(axisFormat(percent)(0.025)).toBe('2.5%');
    expect(tooltip(percent, { amount: 0.025 })).toContain('2.5%');
    const implicit = paymentSpec();
    implicit.encoding.y = { ...implicit.encoding.y!, format: undefined };
    const labels = [0, 0.02, 0.04, 0.06].map(axisFormat(implicit));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(['€0', '€0.02', '€0.04', '€0.06']);
  });

  it('formats temporal bindings in UTC and formats declared tooltip interaction fields', () => {
    const spec = paymentSpec();
    spec.encoding.x = { ...spec.encoding.x!, type: 'temporal', format: '%b %d, %Y' };
    expect(axisFormat(spec, 'x')('2026-08-19T00:00:00Z')).toBe('Aug 19, 2026');
    spec.interactions = [{ id: 'tip', select: { type: 'point' }, rule: { bindTo: 'tooltip', fields: ['payment', 'amount'] } }] as any;
    expect(tooltip(spec, { payment: '2026-08-19T00:00:00Z', amount: -19 })).toContain('Aug 19, 2026');
    expect(tooltip(spec, { payment: '2026-08-19T00:00:00Z', amount: -19 })).toContain('−€19');
  });

  it('keeps every axis-hover series and each mark-local field and precision across named datasets', () => {
    const spec = paymentSpec();
    spec.datasets = { forecast: [{ payment: 'Aug 19, 2026', forecastAmount: 25.125 }] };
    spec.marks = [
      { trait: 'MarkBar', options: { name: 'Paid' } },
      { trait: 'MarkLine', from: 'forecast', options: { name: 'Forecast' }, encodings: {
        y: { ...spec.encoding.y!, field: 'forecastAmount', format: '$,.2f' },
      } },
    ];
    const option = toEChartsOption(spec);
    const formatted = (option.tooltip!.formatter as (params: unknown) => string)([
      { seriesIndex: 0, seriesName: 'Paid', data: { payment: 'Aug 19, 2026', amount: -19 } },
      { seriesIndex: 1, seriesName: 'Forecast', data: { payment: 'Aug 19, 2026', forecastAmount: 25.125 } },
    ]);
    expect(formatted).toContain('Paid');
    expect(formatted).toContain('Forecast');
    expect(formatted).toContain('−€19');
    expect(formatted).toContain('€25.13');
    expect(formatted).not.toContain('—');
    expect(formatted.match(/oods-viz-tooltip__content/g)).toHaveLength(2);
    // This different dataset uses the same field name with its own precision: the other mark must not override it.
    spec.marks[1]!.encodings!.y = { ...spec.encoding.y!, format: '$,.2f' };
    const sameField = (toEChartsOption(spec).tooltip!.formatter as (params: unknown) => string)([
      { seriesIndex: 0, data: { payment: 'Aug 19, 2026', amount: -19 } },
      { seriesIndex: 1, data: { payment: 'Aug 19, 2026', amount: 25.125 } },
    ]);
    expect(sameField).toContain('−€19</span>');
    expect(sameField).toContain('€25.13</span>');
    // Facets repeat the base series in panel order; a later panel keeps its mark's formatter.
    const repeatedPanel = (toEChartsOption(spec).tooltip!.formatter as (params: unknown) => string)([
      { seriesIndex: 2, data: { payment: 'Aug 19, 2026', amount: -19 } },
      { seriesIndex: 3, data: { payment: 'Aug 19, 2026', amount: 25.125 } },
    ]);
    expect(repeatedPanel).toBe(sameField);
  });

  it('keeps authored item-tooltip fields and treats user fields, values and series names as text', () => {
    const spec = paymentSpec();
    const hostile = '<img src=x onerror="alert(1)">';
    spec.encoding.x = { ...spec.encoding.x!, field: hostile };
    const axis = toEChartsOption(spec).tooltip!.formatter as (params: unknown) => string;
    const formatted = axis([{ seriesIndex: 0, seriesName: hostile, data: { [hostile]: hostile, amount: 19 } }, { seriesIndex: 0, seriesName: 'Safe', data: { [hostile]: 'safe', amount: 20 } }]);
    expect(formatted).not.toContain('<img');
    expect(formatted).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    spec.interactions = [{ id: 'tip', select: { type: 'point' }, rule: { bindTo: 'tooltip', fields: ['amount', 'missing'] } }] as any;
    const item = toEChartsOption(spec).tooltip!.formatter as (params: unknown) => string;
    expect(item({ data: { [hostile]: hostile, amount: 19 } })).toContain('€19');
    expect(item({ data: { amount: 19 } })).toContain('missing: </span><span class="oods-viz-tooltip__value">—');
    expect(item({ data: { [hostile]: hostile, amount: 19 } })).not.toContain('&lt;img');
  });

  it('does not let unformatted color or size reuse erase a money field tooltip formatter', () => {
    const spec = paymentSpec();
    spec.encoding.color = { field: 'amount', trait: 'EncodingColor', type: 'quantitative' };
    spec.encoding.size = { field: 'amount', trait: 'EncodingSize', type: 'quantitative' };
    expect(tooltip(spec, { payment: 'Aug 19, 2026', amount: -19 })).toContain('−€19');
    spec.interactions = [{ id: 'tip', select: { type: 'point' }, rule: { bindTo: 'tooltip', fields: ['amount'] } }] as any;
    expect(tooltip(spec, { amount: -19 })).toContain('−€19');
    // A later channel which explicitly requests a format can still choose it.
    spec.encoding.size = { ...spec.encoding.size, format: '$,.2f' };
    expect(tooltip(spec, { amount: -19 })).toContain('−€19.00');
  });

  it('rejects conflicting currencies instead of silently choosing the wrong money symbol', () => {
    const spec = paymentSpec();
    spec.marks = [{ trait: 'MarkBar', encodings: { y: { ...spec.encoding.y!, currency: 'USD' } } }];
    expect(() => toEChartsOption(spec)).toThrow('A chart formats one currency');
    spec.marks = [{ trait: 'MarkBar' }];
    spec.encoding.y = { ...spec.encoding.y!, currency: 'not-currency' };
    expect(() => toEChartsOption(spec)).toThrow('ISO 4217');
  });

  it.each([1440, 390])('caps one wide category at 48 pixels at viewport %i without widening crowded bands', width => {
    const wide = paymentSpec();
    wide.data = { values: [{ payment: 'Annual payment', amount: 12000 }] };
    expect(layout(wide, width).bar.width).toBe(48);
    const crowded = paymentSpec();
    crowded.data = { values: Array.from({ length: 100 }, (_, i) => ({ payment: `Payment ${i}`, amount: 19 })) };
    expect(layout(crowded, width).bar.width).toBeLessThan(48);
  });

  it('caps horizontal category bars by height', () => {
    const spec = paymentSpec();
    spec.encoding = { x: { ...spec.encoding.y!, channel: 'x' }, y: { ...spec.encoding.x!, channel: 'y' } };
    spec.data = { values: [{ payment: 'Annual payment', amount: 12000 }] };
    expect(layout(spec).bar.height).toBe(48);
  });

  it.each([
    ['time', { type: 'temporal' }], ['number', { type: 'quantitative' }],
    ['binned', { bin: true }], ['time-unit', { timeUnit: 'month' }], ['point', { scale: 'point' }],
  ])('does not cap %s axes that have no band width', (_name, overrides) => {
    const spec = paymentSpec();
    spec.encoding.x = { ...spec.encoding.x!, ...overrides } as any;
    expect(toEChartsOption(spec).series[0]).not.toHaveProperty('barMaxWidth');
  });

  it.each([
    ['concat', { trait: 'LayoutConcat', direction: 'horizontal', sections: [] }],
    ['independent', { trait: 'LayoutFacet', sharedScales: { x: 'independent' } }],
  ])('preserves the Vega %s layout exclusion', (_name, layout) => {
    const spec = paymentSpec(); spec.layout = layout as any;
    expect(toEChartsOption(spec).series[0]).not.toHaveProperty('barMaxWidth');
  });

  it.each([{ width: 20 }, { size: 20 }, { orient: 'horizontal' }])('keeps authored bar thickness and orientation %j', options => {
    const spec = paymentSpec(); spec.marks = [{ trait: 'MarkBar', options } as any];
    expect(toEChartsOption(spec).series[0]).not.toHaveProperty('barMaxWidth');
  });

  it('formats mark-local bindings while leaving plain, unformatted options unchanged', () => {
    const spec = paymentSpec();
    spec.marks = [{ trait: 'MarkBar', encodings: spec.encoding }]; spec.encoding = {};
    expect(axisFormat(spec)(19)).toBe('€19');
    expect(tooltip(spec, { amount: 19 })).toContain('€19');
    const plain = paymentSpec(); plain.encoding.color = undefined; plain.encoding.y = { ...plain.encoding.y!, currency: undefined, format: undefined };
    expect((toEChartsOption(plain).yAxis as any).axisLabel).toBeUndefined();
    expect(toEChartsOption(plain).tooltip).toEqual({ trigger: 'axis', axisPointer: { type: 'shadow' } });
  });
});
