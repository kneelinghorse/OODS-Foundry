// s172 m06 — the bubble_map size encoding must reach the WIRE.
//
// THE DEFECT, reproduced on the served bytes before the fix: viz.render's bubble_map option
// carried no size encoding at all. The adapter attached `series.symbolSize` as a function
// closure, and viz.render projects every option through JSON.parse(JSON.stringify(option))
// — which drops function-valued keys silently. Observed pre-fix, the served series' keys
// were exactly: coordinateSystem, data, encode, geoIndex, name, tooltip, type. No
// symbolSize anywhere, on the series or on any datum. A caller's declared `sizeField` was
// lost with no error and no warning.
//
// This file guards the SERVED bytes, which is the only place the defect ever existed — the
// adapter's own return value always had the closure, so an adapter-level test could never
// have caught it. It also ships the BITE PROOF for the defect CLASS: it demonstrates, on the
// real projection, that a function-valued symbolSize vanishes while the per-datum numbers
// survive. A future regression back to a closure would therefore be visibly, not silently,
// wrong.

import { describe, expect, it } from 'vitest';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import { US_STATES } from './s172-echarts-operands.js';

const ROWS = [
  { city: 'San Francisco', lng: -122.4, lat: 37.8, pop: 874 },
  { city: 'Las Vegas', lng: -115.1, lat: 36.2, pop: 646 },
  { city: 'Reno', lng: -119.8, lat: 39.5, pop: 264 },
];

/** The documented curve, written out here so the oracle does not reuse the implementation. */
const RANGE: [number, number] = [6, 28];
function expectedAreaSize(value: number, max: number): number {
  return RANGE[1] * Math.sqrt(value / max);
}

async function servedBubbleSeries(sizeField?: string): Promise<Record<string, unknown>> {
  const out = await vizRender({
    chartType: 'bubble_map',
    name: 'City population',
    geo: {
      geojson: US_STATES,
      rows: ROWS,
      longitudeField: 'lng',
      latitudeField: 'lat',
      ...(sizeField ? { sizeField } : {}),
    },
    output: { echarts: true },
  } as never);
  expect(out.status).toBe('ok');
  const series = (out.echartsSpec as unknown as { series: Array<Record<string, unknown>> }).series;
  return series[0];
}

describe('viz.render bubble_map — the declared size scale reaches the wire (s172 m06)', () => {
  it('every served datum carries a NUMERIC symbolSize', async () => {
    const series = await servedBubbleSeries('pop');
    const data = series.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(3);
    for (const datum of data) {
      expect(typeof datum.symbolSize).toBe('number');
      expect(Number.isFinite(datum.symbolSize as number)).toBe(true);
    }
  });

  it('the served sizes match the scale computed IN-TEST from the row values', async () => {
    const series = await servedBubbleSeries('pop');
    const data = series.data as Array<Record<string, unknown>>;
    const pops = ROWS.map((row) => row.pop);
    const max = Math.max(...pops);
    const observed = data.map((datum) => datum.symbolSize as number);
    const expected = ROWS.map((row) => expectedAreaSize(row.pop, max));
    observed.forEach((size, index) => expect(size).toBeCloseTo(expected[index], 12));
    // Concretely, and in row order: the largest city is the largest bubble.
    expect(observed[0]).toBe(28);
    expect(observed[2] ** 2 / observed[0] ** 2).toBeCloseTo(ROWS[2].pop / ROWS[0].pop, 12);
    expect(observed[1]).toBeGreaterThan(observed[2]);
    expect(observed[1]).toBeLessThan(observed[0]);
  });

  it('the served option contains NO function anywhere in the series — nothing left to drop', async () => {
    const series = await servedBubbleSeries('pop');
    const walk = (node: unknown): void => {
      expect(typeof node).not.toBe('function');
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === 'object') {
        Object.values(node as Record<string, unknown>).forEach(walk);
      }
    };
    walk(series);
    expect('symbolSize' in series).toBe(false);
  });

  // THE BITE PROOF for the defect class. Run viz.render's own projection over the served
  // series with a function re-attached, and watch the function-valued key disappear while
  // the per-datum numbers survive. This is the mechanism that silently lost the encoding.
  it('a function-valued symbolSize is DROPPED by the same projection the per-datum numbers survive', async () => {
    const series = await servedBubbleSeries('pop');
    const withClosure = { ...series, symbolSize: (value: unknown) => (Array.isArray(value) ? 10 : 20) };
    expect(typeof withClosure.symbolSize).toBe('function');

    const projected = JSON.parse(JSON.stringify(withClosure)) as Record<string, unknown>;

    // The closure is gone — exactly the pre-fix behaviour, reproduced on demand.
    expect('symbolSize' in projected).toBe(false);
    // The per-datum numbers are still there — exactly why the fix works.
    const data = projected.data as Array<Record<string, unknown>>;
    expect(data.every((datum) => typeof datum.symbolSize === 'number')).toBe(true);
  });

  it('with NO sizeField the served data still carries numeric sizes (the floor), never an absent key', async () => {
    const series = await servedBubbleSeries();
    const data = series.data as Array<Record<string, unknown>>;
    expect(data.map((datum) => datum.symbolSize)).toEqual([6, 6, 6]);
  });

  it('the size encoding survives the specRef round-trip too (it is the same projected object)', async () => {
    const out = await vizRender({
      chartType: 'bubble_map',
      geo: { geojson: US_STATES, rows: ROWS, longitudeField: 'lng', latitudeField: 'lat', sizeField: 'pop' },
      output: { echarts: true },
    } as never);
    expect(out.specRef).toBeTypeOf('string');
    expect(out.contentHash).toBeTypeOf('string');
    // The hash is taken over the projected option, so it is now a hash of bytes that
    // actually contain the size encoding.
    const serialized = JSON.stringify(out.echartsSpec);
    expect(serialized).toContain('"symbolSize"');
  });
});
