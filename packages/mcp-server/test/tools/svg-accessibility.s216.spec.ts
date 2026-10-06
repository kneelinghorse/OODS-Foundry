import { describe, expect, it } from 'vitest';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { SALES, CASES } from '../../src/tools/__fixtures__/cartesian-render.js';
import { ECHARTS_OPERAND_CASES, HIERARCHY_BRANCH, renderInputFor } from './s172-echarts-operands.js';

const inputs = [
  ...CASES.map(({ chartType, encodings }) => ({ chartType, rows: [...SALES], encodings })),
  ...ECHARTS_OPERAND_CASES.map(renderInputFor),
];
describe('a standalone chart communicates its name and description without the surrounding page', () => {
  it.each(inputs)('$chartType carries accessible SVG metadata in its actual returned bytes', async input => {
    const result = await render({ ...input, output: { svg: true } } as any);
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(result.svg).toMatch(/^<svg\b[^>]*\brole="img"/);
    expect(result.svg).toMatch(/<title>[^<]+<\/title>/);
    expect(result.svg).toMatch(/<desc>[^<]+<\/desc>/);
    expect(result.svg).toMatch(/^<svg\b[^>]*\baria-description="[^"]+"/);
  });

  it('the default treemap supplies an accessible name to the same IR that certification grades', async () => {
    const rendered = await render({ chartType: 'treemap', hierarchy: HIERARCHY_BRANCH, output: { includeNormalizedSpec: true } });
    const result = await certify({ spec: rendered.normalizedSpec as any, data: { hierarchy: HIERARCHY_BRANCH } });
    expect(result.pillars.a11yEquivalence).toBe('pass');
    expect(result.findings?.filter(finding => finding.code === 'OODS-A11Y-R-09')).toEqual([]);
  });
});
