import { expect, it } from 'vitest';
import payment from '../../test/fixtures/s232-payment.json';
import { toEChartsOption } from './echarts-adapter.js';
import { restoreEChartsFormats } from './echarts-format.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

it.each(['EUR', 'GBP', 'CHF'])('restores %s axis and tooltip values after JSON without changing the reply', currency => {
  const spec = structuredClone(payment) as unknown as NormalizedVizSpec;
  spec.encoding.y = { ...spec.encoding.y!, currency, format: '$,.2f' };
  spec.encoding.x = { ...spec.encoding.x!, type: 'temporal', format: '%b %d, %Y' };
  const original: any = toEChartsOption(spec);
  const wire = JSON.parse(JSON.stringify(original));
  const before = JSON.stringify(wire);
  const restored = restoreEChartsFormats(wire);
  for (const channel of ['xAxis', 'yAxis']) {
    const value = channel === 'xAxis' ? '2026-08-19T00:00:00Z' : -1234.5;
    expect(restored[channel].axisLabel.formatter(value)).toBe(original[channel].axisLabel.formatter(value));
  }
  const params = { data: { payment: '2026-08-19T00:00:00Z', amount: -1234.5 } };
  expect(restored.tooltip.formatter(params)).toBe(original.tooltip.formatter(params));
  expect(JSON.stringify(wire)).toBe(before);
  expect(wire.yAxis.axisLabel.formatter).toBeUndefined();
});

it('keeps tooltip data escaped and honors explicit locale independently of the browser', () => {
  const descriptor = { version: 1, field: 'money', format: '$,.2f', currency: 'EUR', locale: { decimal: ',', thousands: '.', grouping: [3], currency: ['', ' €'] } };
  const result = restoreEChartsFormats({ yAxis: [{ axisLabel: { __oodsFormat: descriptor } }], tooltip: { __oodsFormat: { version: 1, fields: [descriptor, { ...descriptor, field: 'name', format: undefined }] } } });
  expect((result.yAxis[0].axisLabel as any).formatter(-1234.5)).toBe('−1.234,50 €');
  const text = (result.tooltip as any).formatter({ data: { money: -1234.5, name: '<img onerror=bad>' } });
  expect(text).toContain('−1.234,50 €');
  expect(text).toContain('&lt;img onerror=bad&gt;');
  expect(text).not.toContain('<img');
});
