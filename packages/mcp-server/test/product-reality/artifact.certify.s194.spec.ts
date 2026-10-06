import { expect, it } from 'vitest';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { wire, retain } from '../helpers/wire-boundary.js';

it('certifies the actual data-bound SVG and rejects HTML at the advertised wire boundary', async () => {
  const input = wire('viz.render', 'input', { chartType: 'bar', rows: [{ region: 'North', revenue: 10 }, { region: 'South', revenue: 20 }], encodings: { x: 'region', y: 'revenue' }, output: { svg: true, includeNormalizedSpec: true } });
  const rendered = wire('viz.render', 'output', await render(input as any));
  const positive = wire('artifact.certify', 'output', await certify(wire('artifact.certify', 'input', { spec: rendered.normalizedSpec }) as any));
  expect(positive.status).toBe('ok');
  expect(positive.coverage).toBe('certified');
  expect(positive.conformant).toBe(true);
  expect(positive.pillars).toEqual({ a11yEquivalence: 'pass', determinism: 'pass', contrast: 'pass', accuracy: 'pass' });
  expect(positive.determinism?.renderHash).toBe(rendered.svgHash);
  const negative = wire('artifact.certify', 'output', await certify(wire('artifact.certify', 'input', { spec: { html: '<div>Not a chart</div>' } }) as any));
  expect(negative.status).toBe('error');
  expect(negative.errors?.map(item => item.code)).toEqual(['OODS-V126']);
  retain('artifact.certify', { rendered, positive, negative });
});
