import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fault = vi.hoisted(() => ({ mode: '' }));
vi.mock('@oods/viz-core', async importOriginal => {
  const actual = await importOriginal<any>();
  return { ...actual,
    evaluateEChartsAccuracyRules: (...args: unknown[]) => {
      if (fault.mode === 'accuracy') throw new Error('injected accuracy evaluator fault');
      if (fault.mode === 'zero-rules') return { rulesEvaluated: 0, findings: [], notes: ['No rule operand resolved.'] };
      return actual.evaluateEChartsAccuracyRules(...args);
    },
    validateVizEquivalenceRulesForContext: (context: any) => {
      if (fault.mode === 'a11y') throw new Error('injected a11y evaluator fault');
      if (fault.mode === 'incomplete') return [];
      if (fault.mode === 'warning-rule-fault') context = { ...context, spec: new Proxy(context.spec, { get(target, property) { if (property === 'portability') throw new Error('injected column-order evaluation fault'); return target[property]; } }) };
      return actual.validateVizEquivalenceRulesForContext(context);
    },
  };
});

import * as renderer from '@oods/viz-render';
import * as contrast from '../../src/tools/certify-echarts-render-contrast.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from '../tools/s172-echarts-operands.js';
import { wire } from '../helpers/wire-boundary.js';

const counts: Record<string, number> = { treemap: 2, sunburst: 2, sankey: 3, chord: 1, force_graph: 1, choropleth: 1, bubble_map: 3, flow_map: 2 };
async function inputFor(chartType: string) {
  const operand = ECHARTS_OPERAND_CASES.find(item => item.chartType === chartType)!;
  const rendered = wire('viz.render', 'output', await render(wire('viz.render', 'input', renderInputFor(operand)) as never));
  expect(rendered.status).toBe('ok');
  return wire('artifact.certify', 'input', { spec: rendered.normalizedSpec!, data: { [operand.branch]: structuredClone(operand.branchData) } }) as any;
}
async function grade(input: any) { return wire('artifact.certify', 'output', await certify(wire('artifact.certify', 'input', input))); }
function retain(name: string, value: unknown) {
  if (!process.env.S195_CERTIFY_RECEIPTS) return;
  fs.mkdirSync(process.env.S195_CERTIFY_RECEIPTS, { recursive: true });
  fs.writeFileSync(path.join(process.env.S195_CERTIFY_RECEIPTS, name + '.json'), JSON.stringify(value, null, 2) + '\n');
}
afterEach(() => { fault.mode = ''; vi.restoreAllMocks(); });

describe('artifact.certify declared ECharts operand profile (s195-m04)', () => {
  it.each(ECHARTS_OPERAND_CASES.map(item => item.chartType))('%s grades the actual operand and preserves native warnings and named N/A rules', async chartType => {
    const input = await inputFor(chartType);
    const result = await grade(input);
    expect(result.status).toBe('ok');
    expect(result.coverage).toBe('certified');
    expect(result.pillars?.a11yEquivalence).toBe('pass');
    expect(result.pillars?.determinism).toBe('pass');
    expect(result.accuracySummary?.rulesEvaluated).toBe(counts[chartType]);
    expect(result.findings?.filter(item => item.code.startsWith('OODS-A11Y-'))).toEqual([expect.objectContaining({ code: 'OODS-A11Y-R-14', severity: 'warn' })]);
    expect(result.a11yNotApplicable!.length).toBeGreaterThan(0);
    expect(result.a11yNotApplicable!.every(item => item.preconditionAbsent.length > 0)).toBe(true);
    // The public bubble option now preserves magnitude by area, measured by V169.
    expect(result.conformant).toBe(true);
    expect(result.findings?.some(item => item.code === 'OODS-V169')).toBe(false);
    const specOnly = await grade({ spec: input.spec });
    expect(specOnly).toMatchObject({ coverage: 'uncertified', conformant: null, pillars: { a11yEquivalence: 'unchecked', determinism: 'unchecked', accuracy: 'unchecked' } });
    expect(specOnly).not.toHaveProperty('determinism');
    expect(specOnly).not.toHaveProperty('accuracySummary');
    expect(specOnly).not.toHaveProperty('a11yNotApplicable');
    expect(specOnly.notes?.[0]).toContain('Without the `data` operand');
    retain(chartType, { input, result, specOnly });
  });

  it.each([true, false])('constant bubble sizes can conform with geometry present: %s, without hiding the option-only limitation', async geometry => {
    const input = await inputFor('bubble_map');
    for (const row of input.data.geo.rows) row[input.data.geo.sizeField] = 100;
    if (!geometry) delete input.data.geo.geojson;
    const result = await grade(input);
    expect(result).toMatchObject({ coverage: 'certified', conformant: true,
      pillars: { a11yEquivalence: 'pass', determinism: 'pass', contrast: 'exempt', accuracy: 'pass' },
      accuracySummary: { rulesEvaluated: 3, failing: 0 } });
    expect(result.findings?.some(item => item.code === 'OODS-V169')).toBe(false);
    if (geometry) expect(result.determinism?.renderHash).toMatch(/^[a-f0-9]{64}$/);
    else {
      expect(result.determinism).not.toHaveProperty('renderHash');
      expect(result.notes?.some(note => note.includes('option') && note.includes('geometry'))).toBe(true);
    }
    retain(geometry ? 'bubble-positive' : 'bubble-option-only', { input, result });
  });

  it('error-severity a11y failures fail conformance while retaining their exact findings', async () => {
    const input = await inputFor('sankey');
    delete input.spec.name;
    delete input.spec.a11y.ariaLabel;
    input.spec.a11y.description = 'short';
    const result = await grade(input);
    expect(result).toMatchObject({ coverage: 'certified', conformant: false, pillars: { a11yEquivalence: 'fail', determinism: 'pass', accuracy: 'pass' } });
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OODS-A11Y-R-08', severity: 'error' }), expect.objectContaining({ code: 'OODS-A11Y-R-09', severity: 'error' })]));
    retain('a11y-fail', { input, result });
  });

  it('a real accuracy finding fails the folded gate without erasing the a11y pass', async () => {
    const input = await inputFor('treemap');
    input.data.hierarchy.data.value = 150;
    const result = await grade(input);
    expect(result).toMatchObject({ coverage: 'certified', conformant: false, pillars: { a11yEquivalence: 'pass', accuracy: 'fail' } });
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OODS-V155', severity: 'error' })]));
    retain('accuracy-fail', { input, result });
  });

  it.each(['a11y', 'incomplete', 'warning-rule-fault', 'accuracy', 'zero-rules'])('%s cannot become a passing profile', async mode => {
    const input = await inputFor('sankey');
    const control = await grade(input);
    expect(control.conformant).toBe(true);
    fault.mode = mode;
    const result = await grade(input);
    expect(result.status).toBe('ok');
    expect(result.coverage).toBe('certified');
    expect(result.conformant).toBe(false);
    if (mode === 'accuracy') expect(result.pillars?.accuracy).toBe('ungradeable');
    else if (mode === 'zero-rules') expect(result.pillars?.accuracy).toBe('unchecked');
    else expect(result.pillars?.a11yEquivalence).toBe('fail');
    if (mode === 'a11y' || mode === 'incomplete') {
      expect(result).not.toHaveProperty('a11yNotApplicable');
      expect(result.findings?.filter(item => item.code.startsWith('OODS-A11Y-'))).toEqual([]);
    }
    if (mode === 'warning-rule-fault') expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'warn', message: expect.stringContaining('Rule execution failed') })]));
    retain(mode, { input, control, result });
  });

  it.each(['contrast-fail', 'contrast-fault', 'render-fault', 'unstable-render'])('%s keeps coverage but prevents conformance', async mode => {
    const input = await inputFor('sankey');
    const control = await grade(input);
    expect(control.conformant).toBe(true);
    if (mode === 'contrast-fail') vi.spyOn(contrast, 'evaluateEChartsRenderContrast').mockReturnValue({ contrast: 'fail', contrastNote: 'injected failing paint measurement' } as never);
    else if (mode === 'contrast-fault') vi.spyOn(contrast, 'evaluateEChartsRenderContrast').mockImplementation(() => { throw new Error('injected contrast fault'); });
    else if (mode === 'render-fault') vi.spyOn(renderer, 'renderEChartsToSvg').mockRejectedValue(new Error('injected render fault'));
    else {
      const original = renderer.renderEChartsToSvg; let calls = 0;
      vi.spyOn(renderer, 'renderEChartsToSvg').mockImplementation(async (...args) => (await original(...args)) + `<!-- independent-render-${calls++} -->`);
    }
    const result = await grade(input);
    expect(result).toMatchObject({ status: 'ok', coverage: 'certified', conformant: false });
    if (mode.startsWith('contrast')) expect(result.pillars?.contrast).toBe(mode === 'contrast-fail' ? 'fail' : 'ungradeable');
    else expect(result.pillars?.determinism).toBe('fail');
    retain(mode, { input, control, result });
  });
});
