import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import { handle as render } from './viz.render.js';
import { handle as certify } from './artifact.certify.js';
import { CASES, SALES } from './__fixtures__/cartesian-render.js';
import { SANKEY_BRANCH } from '../../test/tools/s172-echarts-operands.js';

const validateInput = getAjv().compile(JSON.parse(readFileSync(new URL('../schemas/artifact.certify.input.json', import.meta.url), 'utf8')));
const validateOutput = getAjv().compile(JSON.parse(readFileSync(new URL('../schemas/artifact.certify.output.json', import.meta.url), 'utf8')));

describe('certification describes the pixels at the requested scope', () => {
  it('default certification bytes equal explicit light/A, including after dark/B calls', async () => {
    const rendered = await render({ chartType: 'line', rows: [...SALES], encodings: CASES[1]!.encodings as never, output: { svg: true, includeNormalizedSpec: true } });
    const input = { spec: rendered.normalizedSpec! };
    const omitted = await certify(input);
    expect(JSON.stringify(await certify({ ...input, theme: 'light', brand: 'A' }))).toBe(JSON.stringify(omitted));
    for (const brand of ['A', 'B'] as const) {
      const light = await certify({ ...input, theme: 'light', brand });
      const dark = await certify({ ...input, theme: 'dark', brand });
      expect(light.contrastResults).toEqual([{ theme: 'light', brand, verdict: 'pass', measured: true, evidence: 'render', note: light.contrastNote }]);
      // s191 dark token overrides now clear Role-C; differing hashes still prove scope isolation.
      expect(dark.contrastResults).toEqual([{ theme: 'dark', brand, verdict: 'pass', measured: true, evidence: 'render', note: dark.contrastNote }]);
      expect(dark.conformant).toBe(true);
      expect(dark.contrastNote).toContain(`Scope: dark/${brand}.`);
      expect(dark.determinism?.renderHash).not.toBe(light.determinism?.renderHash);
      expect(validateOutput(dark), JSON.stringify(validateOutput.errors)).toBe(true);
    }
    expect(JSON.stringify(await certify(input))).toBe(JSON.stringify(omitted));
  });

  it('an ECharts canvas override is graded against the rendered background, while spec-only evidence stays reconstructed', async () => {
    const rendered = await render({ chartType: 'sankey', sankey: SANKEY_BRANCH, output: { includeNormalizedSpec: true } });
    const spec = { ...rendered.normalizedSpec!, config: { tokens: { '--oods-sys-surface-canvas': '#416CDA' } } };
    const backed = await certify({ spec, data: { sankey: SANKEY_BRANCH } });
    expect(backed.contrastResults?.[0]).toMatchObject({ verdict: 'fail', measured: true, evidence: 'render' });
    // The first carrier: s222-m02's brand A indigo (#2509) on the synthetic indigo canvas override, which is unchanged.
    expect(backed.contrastNote).toContain('#3E63DD');
    // The declared operand profile is evaluated even when rendered contrast fails.
    expect(backed.coverage).toBe('certified'); expect(backed.conformant).toBe(false);
    // #2411 (s216-m04, 8edb5e4b9): an unnamed input carries its chart type's default accessible name, so this unnamed
    // fixture no longer fails the missing-name rule; the rendered contrast still fails.
    expect(rendered.normalizedSpec!.a11y).toMatchObject({ ariaLabel: 'Sankey diagram' });
    expect(backed.pillars).toMatchObject({ a11yEquivalence: 'pass', contrast: 'fail', determinism: 'pass', accuracy: 'pass' });
    expect(backed.findings).not.toContainEqual(expect.objectContaining({ code: 'OODS-A11Y-R-09' }));
    expect(validateOutput(backed), JSON.stringify(validateOutput.errors)).toBe(true);
    const specOnly = await certify({ spec, theme: 'dark', brand: 'B' });
    expect(specOnly.contrastResults?.[0]).toMatchObject({ theme: 'dark', brand: 'B', measured: false, evidence: 'baked-palette' });
    expect(specOnly.coverage).toBe('uncertified'); expect(specOnly.conformant).toBeNull();
    expect(specOnly.determinism).toBeUndefined();
    expect(validateOutput(specOnly), JSON.stringify(validateOutput.errors)).toBe(true);
  });

  it.each(['A', 'B'] as const)('HC/%s is admitted with forced-colors contrast exemption and the other pillars still evaluated', async brand => {
    const rendered = await render({ chartType: 'area', rows: [...SALES], encodings: CASES[2]!.encodings as never, output: { includeNormalizedSpec: true } });
    const input = { spec: rendered.normalizedSpec!, theme: 'hc', brand };
    expect(validateInput(input), JSON.stringify(validateInput.errors)).toBe(true);
    const out = await certify({ ...input, theme: 'hc' });
    const light = await certify({ spec: input.spec, theme: 'light', brand });
    expect(out).toMatchObject({ status: 'ok', coverage: 'certified', conformant: true, pillars: { contrast: 'exempt', a11yEquivalence: 'pass', determinism: 'pass', accuracy: 'pass' }, determinism: { stable: true } });
    expect(out.contrastResults).toEqual([{ theme: 'hc', brand, verdict: 'exempt', measured: false, evidence: 'render', reason: 'forced-colors', note: out.contrastNote }]);
    expect(out.contrastNote).toContain('No numeric server-side contrast grade is claimed.');
    for (const pillar of ['a11yEquivalence', 'determinism', 'accuracy'] as const) expect(out.pillars?.[pillar]).toBe(light.pillars?.[pillar]);
    expect(out.accuracySummary).toEqual(light.accuracySummary);
    expect(out.determinism?.renderHash).not.toBe(light.determinism?.renderHash);
    expect(validateOutput(out), JSON.stringify(validateOutput.errors)).toBe(true);
  });

  it.each([{ theme: 'sepia' }, { brand: 'C' }])('rejects unsupported scope %j before creating measurement rows', async scope => {
    const rendered = await render({ chartType: 'area', rows: [...SALES], encodings: CASES[2]!.encodings as never, output: { includeNormalizedSpec: true } });
    const input = { spec: rendered.normalizedSpec!, ...scope };
    expect(validateInput(input)).toBe(false);
    const out = await certify(input as never);
    expect(out.status).toBe('error'); expect(out.contrastResults).toBeUndefined();
    expect(validateOutput(out)).toBe(true);
  });
});
