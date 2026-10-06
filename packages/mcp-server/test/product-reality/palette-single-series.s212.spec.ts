import { describe, expect, it } from 'vitest';
import { resolveSingleSeriesColor, toVegaLiteSpec, type NormalizedVizSpec } from '@oods/viz-core';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { evaluateContrastPillar } from '../../src/tools/certify-contrast.js';

const rows = [{ period: 'Jan', value: 12 }, { period: 'Feb', value: 18 }, { period: 'Mar', value: 15 }];
const encodings = { x: { field: 'period', type: 'ordinal' }, y: { field: 'value', type: 'quantitative' } } as const;
describe('public single-series paint and certification agree (s212)', () => {
  for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark', 'hc'] as const) {
    it(`${brand}/${theme}: bar/line/area/scatter draw the shared token and certify those exact bytes`, async () => {
      for (const chartType of ['bar', 'line', 'area', 'scatter'] as const) {
        const out = await render({ chartType, rows, encodings, brand, theme, output: { svg: true, includeNormalizedSpec: true } });
        expect(out.status).toBe('ok');
        const spec = out.normalizedSpec as NormalizedVizSpec;
        const paint = resolveSingleSeriesColor(spec, { brand, theme });
        expect(paint).toBeTruthy();
        expect(out.svg).toContain(paint);
        const grade = await certify({ spec, brand, theme });
        expect(grade.conformant).toBe(true);
        expect(grade.determinism?.renderHash).toBe(out.svgHash);
        expect(grade.pillars?.contrast).toBe(theme === 'hc' ? 'exempt' : 'pass');
        if (theme === 'hc') expect(grade.contrastResults?.[0]?.reason).toBe('forced-colors');
        else expect(grade.contrastResults?.[0]).toMatchObject({ measured: true, evidence: 'render' });
      }
    });
  }
  it('fails actual low-contrast paint for new and legacy overrides, while malformed overrides retain a graded default', async () => {
    const out = await render({ chartType: 'bar', rows, encodings, output: { includeNormalizedSpec: true } });
    const spec = out.normalizedSpec as NormalizedVizSpec;
    for (const token of ['--oods-viz-mark-single', '--oods-viz-scale-categorical-01']) {
      const poisoned = { ...spec, config: { ...spec.config, tokens: { [token]: '#FCFCFD' } } };
      expect((await evaluateContrastPillar(poisoned, toVegaLiteSpec(poisoned))).contrast).toBe('fail');
    }
    const malformed = { ...spec, config: { ...spec.config, tokens: { '--oods-viz-mark-single': 'invalid' } } };
    expect((await evaluateContrastPillar(malformed, toVegaLiteSpec(malformed))).contrast).toBe('pass');
  });
});
