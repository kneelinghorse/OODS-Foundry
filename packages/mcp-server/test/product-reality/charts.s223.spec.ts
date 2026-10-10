// s223-m01 (#2527 rulings 2, 3, 5 and 8): the charts a person reads on a detail screen or a dashboard, through the public
// handlers. Invoice's line-item chart read 1,000,000-ish minor units under "Amount (minor units)"; one or a few categories
// drew one bar across the plot; Usage's chart was "Example API-call usage"; a dashboard at 390 scrolled sideways.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as dashboard } from '../../src/tools/dashboard.render.js';
import { placedChartRequests, PLACED_CHART_WIDE_OUTPUT } from '../../src/codegen/chart-assets.js';
import { chartNodes } from '../../src/codegen/chart-declaration.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import type { UiSchema, VizRenderInput } from '../../src/schemas/generated.js';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const texts = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(match => match[1]!);
const barWidths = (svg: string) => [...svg.matchAll(/aria-roledescription="bar" d="M[-\d.e]+,[-\d.e]+h([-\d.e]+)v/g)].map(match => Number(match[1]));
async function records(object: string) {
  const detail = await compose({ object, context: 'detail', options: { transient: true } });
  const workflow = await compose({ object, context: 'workflow', options: { transient: true } });
  expect(detail.status).toBe('ok'); expect(workflow.status).toBe('ok');
  return { schema: detail.schema as UiSchema, records: workflowSampleRecords(workflow.schema as UiSchema) };
}
const placed = (schema: UiSchema, record: Record<string, unknown>) => placedChartRequests(schema, { theme: 'light' }, record)[0]!.request;
async function svg(request: VizRenderInput) {
  const out = await render(request);
  expect(out.status, JSON.stringify(out.errors)).toBe('ok');
  return out.svg!;
}

describe('money in a chart is money (#2527 ruling 2)', () => {
  it('plots Invoice line items in major units, the y axis in the invoice\'s own currency', async () => {
    const { schema, records: invoices } = await records('Invoice');
    const seen = new Set<string>();
    for (const record of invoices) {
      const request = placed(schema, record);
      const currency = String(record.currency).toUpperCase();
      seen.add(currency);
      const items = record.line_items as Array<{ amount_minor: number }>;
      expect((request.rows as Array<{ amount_minor: number }>).map(row => row.amount_minor)).toEqual(items.map(item => item.amount_minor / 100));
      expect(request.encodings!.y).toEqual({ field: 'amount_minor', aggregate: 'sum', title: 'Amount', currency, format: '$,f' });
      expect(request.description).toContain(`Amounts are in ${currency}.`);
      const drawn = await svg(request);
      const symbol = { USD: '$', GBP: '£', EUR: '€' }[currency]!;
      const ticks = texts(drawn).filter(text => /\d/.test(text) && !/plan|support/i.test(text));
      expect(ticks.length, `${record.invoice_number}`).toBeGreaterThan(1);
      for (const tick of ticks) expect(tick.replace('−', ''), `${record.invoice_number}: ${tick}`).toMatch(new RegExp(`^\\${symbol}[\\d,.]+$`));
      for (const words of [request.name, request.description, ...texts(drawn)]) expect(String(words)).not.toMatch(/minor units/i);
    }
    // The samples hold dollars, pounds and euros, so each symbol is exercised.
    expect([...seen].sort()).toEqual(['EUR', 'GBP', 'USD']);
  });

  it('gives Subscription\'s payment axis the record\'s currency', async () => {
    const { schema, records: subscriptions } = await records('Subscription');
    const record = subscriptions.find(candidate => candidate.subscription_id === 'sub_lindqvist_starter')!;
    const request = placed(schema, record);
    expect(request.encodings!.y).toMatchObject({ currency: 'EUR', format: '$,f', title: 'Amount' });
    const ticks = texts(await svg(request)).filter(text => /^[−-]?€/.test(text));
    expect(ticks).toEqual(['−€20', '−€10', '€0', '€10', '€20']);
  });

  it('never prints the same tick twice at a small range, and reads as money at a large one', async () => {
    const at = async (amounts: number[], currency: string) => texts(await svg({ chartType: 'bar', rows: amounts.map((amount, index) => ({ item: `Item ${index + 1}`, amount })), encodings: { x: 'item', y: { field: 'amount', aggregate: 'sum', currency } }, output: { svg: true, width: 720, height: 240 } } as VizRenderInput)).filter(text => /\d/.test(text) && !/Item/.test(text));
    const small = await at([0.4, 1.2], 'EUR');
    expect(new Set(small).size, small.join(' ')).toBe(small.length);
    expect(small).toContain('€1.2');
    const large = await at([10_800, 1_200], 'USD');
    expect(large).toContain('$10,000');
  });

  it('rides the normalized spec, so artifact.certify compiles and draws the same chart', async () => {
    const input = { chartType: 'bar', rows: [{ item: 'Team plan', amount: 49 }, { item: 'Seats', amount: 120 }], encodings: { x: 'item', y: { field: 'amount', aggregate: 'sum', currency: 'GBP' } }, output: { svg: true, includeNormalizedSpec: true } } as VizRenderInput;
    const rendered = await render(input);
    expect(rendered.status).toBe('ok');
    expect((rendered.normalizedSpec as any).encoding.y).toMatchObject({ currency: 'GBP' });
    expect((rendered.spec as any).config.locale.number.currency).toEqual(['£', '']);
    const certified = await certify({ spec: rendered.normalizedSpec as never });
    expect(certified.determinism).toMatchObject({ contentHash: rendered.contentHash, renderHash: rendered.svgHash, stable: true });
    expect(certified.conformant).toBe(true);
    expect(texts(rendered.svg!)).toContain('£100');
  });
});

describe('bars have a sane width (#2527 ruling 3)', () => {
  const bars = (count: number, width: number) => svg({ chartType: 'bar', rows: Array.from({ length: count }, (_, index) => ({ plan: `Plan ${index + 1}`, seats: 10 + index })), encodings: { x: 'plan', y: { field: 'seats', aggregate: 'sum' } }, output: { svg: true, titlePlacement: 'figure', width, height: 240 } } as VizRenderInput);
  it('draws one or a few categories at 48px, not across the plot', async () => {
    for (const [count, width] of [[1, 720], [1, 1120], [3, 1120]] as const) expect(barWidths(await bars(count, width))).toEqual(Array(count).fill(48));
  });
  it('keeps many categories as they were: their bands are already narrower than 48px', async () => {
    const drawn = barWidths(await bars(24, 1120));
    expect(drawn).toHaveLength(24);
    expect(new Set(drawn).size).toBe(1);
    expect(drawn[0]).toBeLessThan(48);
    expect(drawn[0]).toBeGreaterThan(30);
  });
  it('draws Invoice\'s one-line invoice as one 48px bar on the wide detail render (it was 945px)', async () => {
    const { schema, records: invoices } = await records('Invoice');
    const request = placed(schema, invoices.find(record => (record.line_items as unknown[]).length === 1)!);
    expect(request.output).not.toEqual(PLACED_CHART_WIDE_OUTPUT);
    expect(barWidths(await svg({ ...request, output: { ...PLACED_CHART_WIDE_OUTPUT } }))).toEqual([48]);
  });
});

describe('chart words describe the record (#2527 ruling 5)', () => {
  it('titles Usage\'s chart as the record\'s readings, its y axis with the record\'s unit label', async () => {
    const { schema, records: usage } = await records('Usage');
    const node = chartNodes(schema.screens)[0]!;
    expect(node.props).toMatchObject({ title: 'Usage readings', description: 'Readings recorded for this meter, by the time each was taken.' });
    for (const record of usage.slice(0, 3)) {
      const request = placed(schema, record);
      expect(request.encodings!.y).toEqual({ field: 'value', title: record.unit_label });
      expect(texts(await svg({ ...request, output: { ...request.output, width: 360, height: 180 } }))).toContain(String(record.unit_label));
    }
  });
  it('takes the declared title when a record has no unit label, and fails when there is neither', () => {
    const base = { version: '2026.02', objectSchema: { readings: { type: 'array' }, unit_label: { type: 'string' } }, screens: [{ id: 'chart', component: 'VizLinePreview', props: { title: 'Readings' }, chart: { chartType: 'line', source: 'record-array', dataField: 'readings', encodings: { x: 'at', y: { field: 'value', titleField: 'unit_label' } }, sampleRows: [{ at: '2026-09-01T00:00:00Z', value: 1 }] } }] } as unknown as UiSchema;
    const rows = [{ at: '2026-09-01T00:00:00Z', value: 1 }, { at: '2026-09-02T00:00:00Z', value: 2 }];
    expect(placedChartRequests(base, {}, { readings: rows, unit_label: 'Seats' })[0]!.request.encodings!.y).toEqual({ field: 'value', title: 'Seats' });
    expect(() => placedChartRequests(base, {}, { readings: rows, unit_label: '' })).toThrow("Chart axis title field 'unit_label' has no text");
    const titled = structuredClone(base); (titled.screens[0]!.chart as any).encodings.y.title = 'Count';
    expect(placedChartRequests(titled, {}, { readings: rows })[0]!.request.encodings!.y).toEqual({ field: 'value', title: 'Count' });
  });
  it('refuses money without its currency rather than guessing one', () => {
    const base = { version: '2026.02', objectSchema: { items: { type: 'array' }, currency: { type: 'string' } }, screens: [{ id: 'chart', component: 'VizMarkPreview', chart: { chartType: 'bar', source: 'record-array', dataField: 'items', encodings: { x: 'name', y: 'amount_minor' }, minorUnits: 100, currencyField: 'currency', sampleRows: [{ name: 'A', amount_minor: 100 }] } }] } as unknown as UiSchema;
    const items = [{ name: 'A', amount_minor: 1250 }];
    expect(placedChartRequests(base, {}, { items, currency: 'eur' })[0]!.request.rows).toEqual([{ name: 'A', amount_minor: 12.5 }]);
    expect(() => placedChartRequests(base, {}, { items, currency: '' })).toThrow("Chart currency field 'currency' requires an ISO 4217 code");
    const half = structuredClone(base); delete (half.screens[0]!.chart as any).minorUnits;
    expect(() => placedChartRequests(half, {}, { items, currency: 'EUR' })).toThrow('both minorUnits and currencyField');
  });
});

describe('a dashboard fits a phone (#2527 ruling 8)', () => {
  it('selects an authored chart size that fits its panel', async () => {
    const out = await dashboard({ schemaVersion: 'v0.1', datasets: [{ id: 'sales', rows: [{ region: 'West', revenue: 100 }, { region: 'East', revenue: 80 }] }], panels: [{ id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } } }], a11y: { description: 'Revenue by region.' }, output: { html: true } } as never);
    expect(out.status).toBe('ok');
    expect(out.html).toContain('container-type:inline-size');
    expect(out.html).toContain('@container(min-width:');
    // The kpi sparkline keeps its own sizing; the rule reaches only a chart panel's SVG. s224-m01 (#2542 ruling 4): a Vega
    // chart's phone render, in its own wrapper, precedes the span render the rule sizes.
    expect(out.html).toMatch(/<div class="oods-chart-size-0"><svg\b[^>]*viewBox=/);
    expect(sha(out.html!)).toBe(out.outputHtmlHash);
  });
});
