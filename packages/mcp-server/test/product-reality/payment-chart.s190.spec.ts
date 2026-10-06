import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '@oods/artifacts';
import { billingDate } from '@oods/component-contracts';
import { resolveTokenToColor } from '@oods/viz-core';
import { toHex } from '../../../viz-core/src/tokens/categorical-palette.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import * as viz from '../../src/tools/viz.render.js';
import { chartNodes } from '../../src/codegen/chart-declaration.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import { typecheckWorkflow } from './workflow-typecheck.js';
import type { UiSchema } from '../../src/schemas/generated.js';

vi.setConfig({ testTimeout: 60_000 });
afterEach(() => vi.restoreAllMocks());

describe('Subscription payment chart is an actual public render', () => {
  it.each(['html', 'react', 'vue'] as const)('rejects an active SVG at the %s build boundary', async framework => {
    const result = await generate({ framework, profile: 'build', schema: { version: '2026.02', screens: [{ id: 'chart', component: 'VizAreaPreview', props: { svg: '<svg><script>bad()</script></svg>' } }] } });
    expect(result.status).toBe('error');
    expect(result.artifact).toBeUndefined();
    expect(JSON.stringify(result.errors)).toContain('self-contained');
  });
  it('declares one read-only detail projection without mark fields or controls in other contexts', async () => {
    for (const context of ['detail', 'list', 'form', 'timeline', 'card', 'inline'] as const) {
      const result = await compose({ object: 'Subscription', context });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      const charts = chartNodes(result.schema.screens);
      expect(charts).toHaveLength(context === 'detail' ? 1 : 0);
      expect(Object.keys(result.schema.objectSchema ?? {}).filter(field => field.startsWith('viz_'))).toEqual([]);
      // s220-m01 (#2461): one bar per recorded payment; an area over a steady price filled the plot as one block.
      if (context === 'detail') expect(charts[0]!.chart).toEqual({ chartType: 'bar', source: 'payment-events', dateFields: ['last_payment_at', 'next_payment_due_at'], amountField: 'amount', minorUnits: 100, currencyField: 'currency' });
    }
  });

  it.each(['react', 'vue'] as const)('emits repeatable, strictly typed %s workflow assets keyed by seed identity', async framework => {
    const rendered = vi.spyOn(viz, 'handle');
    const { schema } = await compose({ object: 'Subscription', context: 'workflow', preferences: { theme: 'dark', brand: 'B' } });
    expect(chartNodes(schema.screens)).toHaveLength(1);
    const first = await generate({ schema, framework, profile: 'build', options: { theme: 'dark', brand: 'B' } });
    expect(first.status, JSON.stringify(first.errors)).toBe('ok');
    // Sample records carry only their authored payment histories (#2412, #2413, 374a6eaec; authored in s219-m01, #2453,
    // 1cef5f597): a record with payments is rendered, one without gets the named empty state and no render. Every drawn
    // chart renders three times per record: the design size, the narrow size (Sprint 202 m01) and the wide size (s213-m01,
    // finding 5), in each of the light, dark and hc themes (s222-m02, F7), so it follows the page's theme: nine renders.
    const chart = chartNodes(schema.screens)[0]!.chart!;
    if (chart.source !== 'payment-events') throw new Error('Expected the payment projection');
    const records = workflowSampleRecords(schema);
    expect(records).toHaveLength(schema.workflow!.data.sampleCount);
    const paid = records.filter(record => Array.isArray(record.payment_history) && record.payment_history.length > 0);
    expect(paid.length).toBeGreaterThan(0);
    expect(rendered).toHaveBeenCalledTimes(paid.length * 9);
    // The generation theme's (dark) design-size render of each record: light, then dark, then hc, three sizes each.
    const requests = rendered.mock.calls.map(([input]) => input).filter((_, index) => index % 9 === 3);
    // s220-m01 (#2464): one bar per recorded payment of that record, in date order, in major currency units.
    for (const [index, record] of paid.entries()) {
      const payments = [...record.payment_history as Array<{ at: string; amount: number }>].sort((a, b) => a.at.localeCompare(b.at));
      expect(requests[index]).toMatchObject({ chartType: 'bar', name: 'Payment amounts', theme: 'dark', brand: 'B', rows: payments.map(payment => ({ payment: billingDate(payment.at), amount: payment.amount / chart.minorUnits })) });
    }
    const files = first.artifact!.files;
    const assets = files.filter(file => file.path.endsWith('.svg'));
    // The empty state paints in the text colour, so one set of its three sizes serves every theme.
    expect(assets).toHaveLength(paid.length * 9 + (records.length - paid.length) * 3);
    const empty = assets.filter(asset => asset.contents.includes('aria-label="No recorded payments"'));
    expect(empty).toHaveLength((records.length - paid.length) * 3);
    const canvas = (theme: 'light' | 'dark') => toHex(resolveTokenToColor('--sys-surface-canvas', { theme, brand: 'B' })!)!.toLowerCase();
    for (const asset of assets) {
      expect(asset.contentHash).toBe(`sha256:${sha256(asset.contents)}`);
      if (empty.includes(asset)) continue;
      expect(asset.contents).toContain('role="graphics-object"');
      // Each render is drawn on its own theme's canvas.
      expect(asset.contents.toLowerCase()).toContain(asset.path.includes('.hc.') ? 'fill="canvas"' : canvas(asset.path.includes('.dark.') ? 'dark' : 'light'));
    }
    const store = files.find(file => file.path === 'src/store.ts')!.contents;
    expect(store).toContain('svg: chartSvgByRecord[String(record[idField])]');
    expect(store).toContain('svgDark: chartSvgDarkByRecord[String(record[idField])]');
    expect(store).toContain('svgHcWide: chartSvgHcWideByRecord[String(record[idField])]');
    const screen = files.find(file => file.path.startsWith('src/screens/Detail.'))!.contents;
    expect(screen).toContain('svg?: string;');
    expect(screen).toContain('svg ??');
    expect(files.find(file => file.path === 'src/chart-assets.ts')!.contents).toContain(String(records[2]![schema.workflow!.data.idField]));
    const checked = typecheckWorkflow(first.artifact!);
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const second = await generate({ schema, framework, profile: 'build', options: { theme: 'dark', brand: 'B' } });
    expect(second.artifact).toEqual(first.artifact);
  });

  it.each(['html', 'react', 'vue'] as const)('single detail %s has a hashed seed asset and unchanged public SVG bytes', async framework => {
    const rendered = vi.spyOn(viz, 'handle');
    const { schema } = await compose({ object: 'Subscription', context: 'detail' });
    // HTML chart embedding is independently supported; full detail Tabs have an existing HTML normalization gate.
    if (framework === 'html') { const charts = chartNodes(schema.screens); schema.screens = [charts[0]!, ...charts.slice(1)]; }
    const result = await generate({ schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    // Three sizes in each of three themes (s222-m02, F7); the light design render is the design-path asset.
    expect(rendered).toHaveBeenCalledTimes(9);
    const publicOutput = await rendered.mock.results[0]!.value;
    const asset = result.artifact!.files.find(file => file.path === 'src/charts/payment-001.svg')!;
    expect(asset.contents).toBe(publicOutput.svg);
    if (framework === 'html') expect(result.code).toContain(asset.contents);
    else {
      expect(result.code).toContain('svg?: string;');
      const config = JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', skipLibCheck: true, esModuleInterop: true, lib: ['ES2022', 'DOM'], types: ['node'] }, include: ['src/**/*'] });
      const checked = typecheckWorkflow({ ...result.artifact!, files: [...result.artifact!.files, { path: 'tsconfig.json', contents: config, contentHash: `sha256:${sha256(config)}` }] });
      expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    }
    expect((await generate({ schema, framework, profile: 'build' })).artifact).toEqual(result.artifact);
  });

  it('fails loudly for missing fields or a public renderer failure, without a placeholder artifact', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'detail' });
    const broken = structuredClone(schema) as UiSchema;
    const chart = chartNodes(broken.screens)[0]!.chart!;
    if (chart.source !== 'payment-events') throw new Error('Expected the legacy payment projection');
    chart.amountField = 'nonexistent';
    const invalid = await generate({ schema: broken, framework: 'react', profile: 'build' });
    expect(invalid.status).toBe('error');
    expect(invalid.errors?.[0]?.message).toContain('nonexistent');
    vi.spyOn(viz, 'handle').mockResolvedValue({ status: 'error', errors: [{ code: 'OODS-V165', message: 'Injected render failure' }] } as Awaited<ReturnType<typeof viz.handle>>);
    const failed = await generate({ schema, framework: 'vue', profile: 'build' });
    expect(failed.status).toBe('error');
    expect(failed.artifact).toBeUndefined();
    expect(failed.errors?.[0]?.message).toContain('Injected render failure');
  });
});
