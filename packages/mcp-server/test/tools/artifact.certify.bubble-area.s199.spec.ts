import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const mutation = vi.hoisted(() => ({ scale: '' }));
vi.mock('@oods/viz-core', async importOriginal => {
  const actual = await importOriginal<any>();
  return { ...actual, adaptBubbleToECharts: (spec: any, ...rest: any[]) => {
    const input = structuredClone(spec);
    if (mutation.scale) input.layers[0].encoding.size.scale = mutation.scale;
    return actual.adaptBubbleToECharts(input, ...rest);
  } };
});
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from './s172-echarts-operands.js';
import { wire } from '../helpers/wire-boundary.js';
afterEach(() => { mutation.scale = ''; });

describe('s199 bubble area contract at both JSON wire boundaries', () => {
  it.each(['area', 'linear', 'sqrt'])('%s: actual adapter scale reaches the drawn-size rule', async scale => {
    mutation.scale = scale === 'area' ? '' : scale;
    const operand = structuredClone(ECHARTS_OPERAND_CASES.find(item => item.chartType === 'bubble_map')!);
    const request = wire('viz.render', 'input', { ...renderInputFor(operand), output: { svg: true, includeNormalizedSpec: true } });
    const drawn = wire('viz.render', 'output', await render(request as never));
    expect(drawn.status).toBe('ok');
    const grade = wire('artifact.certify', 'output', await certify(wire('artifact.certify', 'input', {
      spec: drawn.normalizedSpec!, data: { geo: operand.branchData },
    }) as never));
    expect(grade.accuracySummary).toEqual({ rulesEvaluated: 3, failing: scale === 'area' ? 0 : 1 });
    expect(grade.findings?.some(item => item.code === 'OODS-V169')).toBe(scale !== 'area');
    expect(grade.conformant).toBe(scale === 'area');
    expect(grade.determinism?.renderHash).toBe(drawn.svgHash);
    if (process.env.S199_AREA_RECEIPTS) {
      mkdirSync(process.env.S199_AREA_RECEIPTS, { recursive: true });
      writeFileSync(path.join(process.env.S199_AREA_RECEIPTS, scale + '.json'), JSON.stringify({ request, drawn, grade }, null, 2) + '\n');
    }
  });
});
