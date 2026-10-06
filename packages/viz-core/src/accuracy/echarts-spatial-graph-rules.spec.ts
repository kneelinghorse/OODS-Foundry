import { describe, expect, it } from 'vitest';
import { buildBubbleSeries } from '../adapters/spatial/echarts-bubble-adapter.js';
import { buildFlowLineSeries } from '../adapters/spatial/echarts-flow-line-adapter.js';
import type { SizeScaleType, SpatialSpec, SymbolLayer, RouteLayer } from '../spec/spatial.js';
import { ECHARTS_ACCURACY_RULES, evaluateEChartsAccuracyRules, echartsAccuracyRulesFor } from './echarts-index.js';
import type { EChartsAccuracyChartType, EChartsAccuracyOperand } from './echarts-types.js';

type Row = Record<string, unknown>;
const bubble = (rows: Row[]) => ({ longitudeField: 'lng', latitudeField: 'lat', sizeField: 'size', rows });
const flow = (rows: Row[]) => ({
  originLongitudeField: 'x1', originLatitudeField: 'y1', destinationLongitudeField: 'x2', destinationLatitudeField: 'y2',
  strengthField: 'strength', rows,
});
const point = (size: unknown, lng: unknown = 1, lat: unknown = 2): Row => ({ lng, lat, size });
const route = (strength: unknown = 1): Row => ({ x1: 1, y1: 2, x2: 3, y2: 4, strength });
const network = (links: unknown[]) => ({ nodes: [{ id: 'A' }, { id: 'B' }], links });
const edge = (source = 'A', target = 'B') => ({ source, target, value: 1 });
const check = (code: string, chartType: EChartsAccuracyChartType, branchData: unknown) =>
  ECHARTS_ACCURACY_RULES.find((rule) => rule.code === code)!.evaluate({ chartType, branchData });

describe.each([
  ['OODS-V168', 'bubble_map', bubble, point, 'sizeField', 'size'],
  ['OODS-V171', 'flow_map', flow, route, 'strengthField', 'strength'],
] as const)('%s finite non-negative encoded magnitude', (code, chartType, branch, row, fieldKey, valueKey) => {
  it.each([-1, Number.NaN, Infinity, -Infinity, 'Infinity', 'not a number', null])('rejects authored %s instead of accepting renderer fallback', (bad) => {
    expect(check(code, chartType, branch([row(bad)]))).toMatchObject({ evaluated: true, message: expect.stringContaining('artifact.certify') });
  });
  it.each([0, 1, '1', '1.5units'])('accepts renderer-resolved finite magnitude %s', (good) => {
    expect(check(code, chartType, branch([row(good)]))).toEqual({ evaluated: true });
  });
  it('is unresolved for absent fields, absent rows, missing cells and malformed rows', () => {
    const noCell = row(1); delete noCell[valueKey];
    const noField: Row = branch([row(1)]); delete noField[fieldKey];
    for (const input of [null, {}, noField, branch([]), branch([noCell]), { ...branch([row(1)]), rows: [null] }]) {
      expect(check(code, chartType, input)).toMatchObject({ evaluated: false, note: expect.stringContaining('not evaluated') });
    }
  });
  it('a known violation still fires when another row is unresolved', () => {
    const noCell = row(1); delete noCell[valueKey];
    expect(check(code, chartType, branch([noCell, row(-1)]))).toMatchObject({ evaluated: true, message: expect.any(String) });
  });
});

function drawnBubbles(rows: Row[], scale: SizeScaleType = 'area'): EChartsAccuracyOperand {
  const layer: SymbolLayer = { type: 'symbol', encoding: { longitude: { field: 'lng' }, latitude: { field: 'lat' }, size: { field: 'size', scale } } };
  const spec: SpatialSpec = { id: 'accuracy-bubbles', type: 'spatial', data: { values: [] }, layers: [layer], a11y: { description: 'Magnitude is encoded by area.' } };
  return { chartType: 'bubble_map', branchData: bubble(rows), option: { series: [buildBubbleSeries(spec, layer, rows, undefined).series] } };
}
const areaRule = (operand: EChartsAccuracyOperand) => ECHARTS_ACCURACY_RULES.find((rule) => rule.code === 'OODS-V169')!.evaluate(operand);

describe('OODS-V169 measures public bubble areas from the built option', () => {
  it.each([[0, 1, 4], [874, 646], [4], [0, 0], [4, 4], [0.3, 0.1 + 0.2], [1e-12, 4e-12], [1e12, 4e12]])('preserves magnitude ratios for %j', (...values) => {
    expect(areaRule(drawnBubbles(values.map((value, index) => point(value, index))))).toEqual({ evaluated: true });
  });
  it.each(['linear', 'sqrt'] as const)('mutation: reverting the actual adapter to %s and its minimum anchor/floor fires V169', (scale) => {
    const rows = [point(1), point(2.5, 3), point(4, 5)];
    expect(areaRule(drawnBubbles(rows, scale))).toMatchObject({ evaluated: true, message: expect.stringContaining('drawn symbol diameters') });
    expect(areaRule(drawnBubbles(rows))).toEqual({ evaluated: true });
  });
  it('pins zero area, proportional areas and the maximum diameter from actual emitted numbers', () => {
    const operand = drawnBubbles([point(0), point(1, 3), point(4, 5)]);
    const data = (operand.option as any).series[0].data;
    expect(data.map((item: any) => item.symbolSize)).toEqual([0, 14, 28]);
    data[1].symbolSize = 6;
    expect(areaRule(operand)).toHaveProperty('message');
  });
  it('a zero-only domain cannot draw a nonzero magnitude', () => {
    const operand = drawnBubbles([point(0)]);
    (operand.option as any).series[0].data[0].symbolSize = 17;
    expect(areaRule(operand)).toHaveProperty('message');
  });
  it('requires data, the built option, row correspondence and numeric circular diameters', () => {
    const valid = drawnBubbles([point(1), point(4, 3)]);
    for (const operand of [{ ...valid, option: undefined }, { ...valid, branchData: {} }, { ...valid, option: { series: [] } }]) {
      expect(areaRule(operand)).toMatchObject({ evaluated: false, note: expect.any(String) });
    }
    for (const mutation of [
      (data: any[]) => { data.pop(); },
      (data: any[]) => { data.reverse(); },
      (data: any[]) => { delete data[0].symbolSize; },
      (data: any[]) => { data[0].symbolSize = [14, 28]; },
      (data: any[]) => { data[0].symbolSize = () => 14; },
    ]) {
      const operand = JSON.parse(JSON.stringify(valid)) as EChartsAccuracyOperand;
      mutation((operand.option as any).series[0].data);
      expect(areaRule(operand)).toMatchObject({ evaluated: false, note: expect.any(String) });
    }
    for (const rows of [[], [point(-1)], [point(undefined)]]) expect(areaRule(drawnBubbles(rows))).toHaveProperty('evaluated', false);
  });
});

describe('OODS-V170 bubble coordinate conflicts', () => {
  it('fires for overlapping conflicting sizes; one changed coordinate or equal value is clean', () => {
    expect(check('OODS-V170', 'bubble_map', bubble([point(1), point(2)]))).toHaveProperty('message');
    expect(check('OODS-V170', 'bubble_map', bubble([point(1), point(2, 3)]))).toEqual({ evaluated: true });
    expect(check('OODS-V170', 'bubble_map', bubble([point(1), point(1)]))).toEqual({ evaluated: true });
  });
  it('binds numeric coordinates after renderer parseFloat coercion, including signed zero', () => {
    expect(check('OODS-V170', 'bubble_map', bubble([point(1, '1deg', '-0'), point(2, 1, 0)]))).toHaveProperty('message');
  });
  it('ignores unused region join keys and unencoded row fields', () => {
    const input = { ...bubble([{ ...point(1), region: 'same', label: 'a' }, { ...point(1, 3), region: 'same', label: 'b' }]), join: { dataKey: 'region', featureProperty: 'region' }, valueField: 'label' };
    expect(check('OODS-V170', 'bubble_map', input)).toEqual({ evaluated: true });
    input.rows[1] = { ...point(1), region: 'same', label: 'b' };
    expect(check('OODS-V170', 'bubble_map', input)).toEqual({ evaluated: true });
  });
  it('checks categorical colors by the strings used by the ordinal palette', () => {
    const input = { ...bubble([{ ...point(1), group: 'one' }, { ...point(1), group: 'two' }]), colorField: 'group', colorScale: 'ordinal' };
    expect(check('OODS-V170', 'bubble_map', input)).toHaveProperty('message');
    expect(check('OODS-V170', 'bubble_map', { ...input, rows: [{ ...point(1), group: 1 }, { ...point(1), group: '1' }] })).toEqual({ evaluated: true });
  });
  it('checks continuous color values and relative tolerance, including numeric string equivalence', () => {
    const input = { ...bubble([{ ...point(1), metric: 100 }, { ...point(1), metric: 100 + 5e-8 }]), colorField: 'metric' };
    expect(check('OODS-V170', 'bubble_map', input)).toEqual({ evaluated: true });
    expect(check('OODS-V170', 'bubble_map', { ...input, rows: [{ ...point(1), metric: '100' }, { ...point(1), metric: 100 + 5e-7 }] })).toHaveProperty('message');
    expect(check('OODS-V170', 'bubble_map', bubble([point(0.1 + 0.2), point('0.3')]))).toEqual({ evaluated: true });
  });
  it('missing coordinates or duplicate-point encoded cells cannot become passes', () => {
    for (const input of [{}, bubble([point(1, '')]), bubble([point(1), point(undefined)]), bubble([point(1), point(null)])]) {
      expect(check('OODS-V170', 'bubble_map', input)).toMatchObject({ evaluated: false, note: expect.any(String) });
    }
    expect(check('OODS-V170', 'bubble_map', bubble([point(1), point(2), point(1, '')]))).toHaveProperty('message');
  });
});

describe('OODS-V172 duplicate directed geographic routes', () => {
  it('repeated ordered coordinates fail; reciprocal routes and single self-loops remain valid', () => {
    expect(check('OODS-V172', 'flow_map', flow([route(), route()]))).toHaveProperty('message');
    expect(check('OODS-V172', 'flow_map', flow([route(), { x1: 3, y1: 4, x2: 1, y2: 2, strength: 1 }]))).toEqual({ evaluated: true });
    expect(check('OODS-V172', 'flow_map', flow([{ x1: 1, y1: 2, x2: 1, y2: 2 }]))).toEqual({ evaluated: true });
  });
  it('duplicate identity is independent of labels/strength and follows numeric coercion', () => {
    expect(check('OODS-V172', 'flow_map', flow([route(1), { ...route(2), x1: '1degree', name: 'different' }]))).toHaveProperty('message');
    expect(check('OODS-V172', 'flow_map', flow([route(), { ...route(), y2: 5 }]))).toEqual({ evaluated: true });
  });
  it('unresolved endpoints or malformed rows never count as a clean duplicate scan', () => {
    for (const input of [{}, flow([]), flow([{ ...route(), x1: '' }]), { ...flow([route()]), originLongitudeField: undefined }]) {
      expect(check('OODS-V172', 'flow_map', input)).toMatchObject({ evaluated: false, note: expect.any(String) });
    }
  });
  it('pins both spatial adapters coercion against the rule assumptions', () => {
    const layer: RouteLayer = { type: 'route', encoding: { start: { field: 'x1', longitude: 'x1', latitude: 'y1' }, end: { field: 'x2', longitude: 'x2', latitude: 'y2' }, strokeWidth: { field: 'strength' } } };
    const spec: SpatialSpec = { id: 'accuracy-flows', type: 'spatial', data: { values: [] }, layers: [layer], a11y: { description: 'A directed flow.' } };
    const data = buildFlowLineSeries(spec, layer, [{ ...route('2units'), x1: '1deg' }], undefined).series.data as unknown as Array<{ coords: number[][]; value: number }>;
    expect(data[0]).toMatchObject({ coords: [[1, 2], [3, 4]], value: 2 });
    const symbol: SymbolLayer = { type: 'symbol', encoding: { longitude: { field: 'lng' }, latitude: { field: 'lat' }, size: { field: 'size' } } };
    const bubbles = buildBubbleSeries({ ...spec, layers: [symbol] }, symbol, [point('2units', '1deg', 2)], undefined).series.data as unknown as Array<{ value: number[] }>;
    expect(bubbles[0].value.slice(0, 3)).toEqual([1, 2, 2]);
  });
});

describe('OODS-V173 public graph relationship multiplicity', () => {
  it('repeated directed edges fail even when their values differ', () => {
    expect(check('OODS-V173', 'force_graph', network([edge(), { ...edge(), value: 2 }]))).toHaveProperty('message');
    expect(check('OODS-V173', 'force_graph', network([edge()]))).toEqual({ evaluated: true });
  });
  it('reciprocal edges, one self-loop and a declared empty link list are legitimate', () => {
    for (const links of [[edge(), edge('B', 'A')], [edge('A', 'A')], []]) {
      expect(check('OODS-V173', 'force_graph', network(links))).toEqual({ evaluated: true });
    }
  });
  it('does not invent collisions in endpoint names containing separators', () => {
    expect(check('OODS-V173', 'force_graph', network([edge('A-B', 'C'), edge('A', 'B-C')]))).toEqual({ evaluated: true });
  });
  it('unresolved link lists/endpoints are unevaluated; known duplicates still fire in partial data', () => {
    for (const input of [null, {}, network([null]), network([{ source: 'A' }])]) {
      expect(check('OODS-V173', 'force_graph', input)).toMatchObject({ evaluated: false, note: expect.any(String) });
    }
    expect(check('OODS-V173', 'force_graph', network([edge(), edge(), null]))).toHaveProperty('message');
  });
  it('does not claim unencoded negative graph weights drive line width', () => {
    expect(check('OODS-V173', 'force_graph', network([{ ...edge(), value: -5 }]))).toEqual({ evaluated: true });
  });
});

describe('s195 accuracy mutation discriminators and purity', () => {
  const red: Array<[string, EChartsAccuracyOperand]> = [
    ['OODS-V168', { chartType: 'bubble_map', branchData: bubble([point(-1)]) }],
    ['OODS-V169', drawnBubbles([point(1), point(4, 3)], 'linear')],
    ['OODS-V170', { chartType: 'bubble_map', branchData: bubble([point(1), point(2)]) }],
    ['OODS-V171', { chartType: 'flow_map', branchData: flow([route(-1)]) }],
    ['OODS-V172', { chartType: 'flow_map', branchData: flow([route(), route()]) }],
    ['OODS-V173', { chartType: 'force_graph', branchData: network([edge(), edge()]) }],
  ];
  it.each(red)('%s predicate replacement removes exactly its finding', (code, operand) => {
    const baseline = evaluateEChartsAccuracyRules(operand);
    expect(baseline.findings.map((finding) => finding.code)).toContain(code);
    const mutant = echartsAccuracyRulesFor(operand.chartType).map((rule) => rule.code === code ? { ...rule, evaluate: () => ({ evaluated: true }) } : rule);
    expect(evaluateEChartsAccuracyRules(operand, mutant).findings).toEqual(baseline.findings.filter((finding) => finding.code !== code));
  });
  it.each(red)('%s is repeatable and does not mutate data', (_code, operand) => {
    const before = JSON.stringify(operand);
    expect(evaluateEChartsAccuracyRules(operand)).toEqual(evaluateEChartsAccuracyRules(operand));
    expect(JSON.stringify(operand)).toBe(before);
  });
});
