import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { recipeProblems } from '@oods/tokens/recipe';
import { handle } from '../../src/tools/brand.intake.js';
import { handle as readHandle } from '../../src/tools/brand.read.js';
import { deriveBrand } from '../../src/lib/brand-derive.js';
import { getAjv } from '../../src/lib/ajv.js';
import { refreshTokenBundle } from '../../src/lib/token-build.js';
import { resetTokensCssCache } from '../../src/render/document.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(root, `tests/fixtures/team-tokens/${name}.tokens.json`), 'utf8'));
const validators = ['input', 'output'].map(direction => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, `packages/mcp-server/src/schemas/brand.read.${direction}.json`), 'utf8'));
  return getAjv().getSchema(schema.$id) ?? getAjv().compile(schema);
});
const work = fs.mkdtempSync(path.join(os.tmpdir(), 's228-derive-'));
const originalBrands = process.env.OODS_BRANDS_DIR;
afterAll(async () => {
  if (originalBrands === undefined) delete process.env.OODS_BRANDS_DIR;
  else process.env.OODS_BRANDS_DIR = originalBrands;
  await refreshTokenBundle(); resetTokensCssCache();
  fs.rmSync(work, { recursive: true, force: true });
});

describe('s228: a team can inspect where each recipe value came from before creating a brand', () => {
  it.each([
    ['rgba(37, 99, 235, 1)', '#2563eb'],
    ['rgb(37 99 235 / 1)', '#2563eb'],
    ['hsl(220 83% 53% / 100%)', 'hsl(220 83% 53%)'],
    ['oklch(0.55 0.2 262 / 1)', 'oklch(0.55 0.2 262)'],
  ])('s229: %s keeps the opaque source hue rather than becoming a missing accent', (explicit, opaque) => {
    const read = (value: string) => deriveBrand({ accent: { $type: 'color', $value: value } });
    const result = read(explicit);
    expect(result.recipe.accentHue).toBe(read(opaque).recipe.accentHue);
    expect(result.recipe.accentHue).toBeGreaterThan(262 - 0.000001);
    expect(Math.abs(result.recipe.accentHue! - read('#2563eb').recipe.accentHue!)).toBeLessThan(1);
    expect(result.warnings).toEqual([]);
    const transparent = read('rgba(37, 99, 235, 0.5)');
    expect(transparent.recipe).not.toHaveProperty('accentHue');
    expect(transparent.warnings.join(' ')).toContain('transparent');
  });

  it.each([[355, 358, 3, 6], [6, 3, 358, 355], [-5, -2, 363, 366]])('s229: neutral hues %j stay near the red boundary', (...hues) => {
    const result = deriveBrand({ neutral: { $type: 'color', ...Object.fromEntries(hues.map((hue, index) => [index, { $value: `oklch(0.5 0.02 ${hue})` }])) } });
    expect(result.recipe.neutralHue).toBeCloseTo(0.5, 6);
    expect(result.recipe.neutralChroma).toBe(0.02);
    expect(result.provenance.neutralHue.rule).toContain('Circular median');
  });

  it('accepts the complete fixture through the wire, writes nothing at derive, and create grades and builds that recipe', async () => {
    process.env.OODS_BRANDS_DIR = path.join(work, 'brands');
    const input = { action: 'derive' as const, tokens: fixture('complete') };
    const before = JSON.stringify(input);
    expect(validators[0](input), JSON.stringify(validators[0].errors)).toBe(true);
    const result = await readHandle(input);
    expect(validators[1](result), JSON.stringify(validators[1].errors)).toBe(true);
    expect(result.action).toBe('derive');
    if (result.action !== 'derive') throw new Error('derive response expected');
    expect(JSON.stringify(input)).toBe(before);
    expect(fs.existsSync(process.env.OODS_BRANDS_DIR!)).toBe(false);
    expect(result.gaps).toEqual([]);
    // Exact 0.4.6 recipe: wrap handling must not change an ordinary team's existing brand.
    expect(result.recipe).toEqual({ neutralHue: 145, neutralChroma: 0.015, accentHue: 145, primary: 'accent', radius: 8, font: 'Inter', fontMono: 'JetBrains Mono', status: { success: { hue: 145 }, warning: { hue: 85 }, critical: { hue: 25 }, info: { hue: 240 } } });
    expect(recipeProblems(result.recipe)).toEqual([]);
    for (const field of ['neutralHue', 'neutralChroma', 'accentHue', 'primary', 'radius', 'font', 'fontMono', 'status.success.hue', 'status.warning.hue', 'status.critical.hue', 'status.info.hue']) {
      expect(result.provenance[field].sources.length, field).toBeGreaterThan(0);
      expect(result.provenance[field].rule.length, field).toBeGreaterThan(10);
    }
    const created = await handle({ action: 'create', brand_id: 'Meadow', recipe: result.recipe });
    expect(created.action).toBe('create');
    if (created.action !== 'create') throw new Error('create response expected');
    expect(created.created).toBe(true);
    expect(created.report.valid).toBe(true);
    for (const theme of ['base', 'dark', 'hc'] as const) {
      expect(created.report.contrast[theme]).toMatchObject({ failed: 0, ungraded: 0, passed: theme === 'hc' ? 83 : 84, charts: { passed: 7, failed: 0 } });
      expect(fs.existsSync(path.join(process.env.OODS_BRANDS_DIR!, 'Meadow', `${theme}.json`))).toBe(true);
    }
  }, 120_000);

  it('leaves required gaps absent instead of supplying plausible defaults', () => {
    const result = deriveBrand(fixture('gaps'));
    expect(result.gaps.map(gap => gap.field)).toEqual(['neutralHue', 'neutralChroma', 'radius']);
    for (const field of ['neutralHue', 'neutralChroma', 'radius']) expect(result.recipe).not.toHaveProperty(field);
    expect(result.gaps.every(gap => gap.reason && Array.isArray(gap.candidates))).toBe(true);
    const empty = deriveBrand({});
    expect(empty.recipe).toEqual({ primary: 'neutral' });
    expect(empty.gaps.map(gap => gap.field)).toContain('accentHue');
    expect(empty.provenance.primary.rule).toContain('remains a gap');
  });

  it('honours hints and resolves alias chains, retaining raw and resolved evidence', () => {
    const tokens = fixture('complete');
    tokens.color.alternate = { $value: '{color.selected}' };
    tokens.untyped = { $value: '{color.alternate}' };
    const aliased = deriveBrand(tokens, { accent: 'untyped' });
    expect(aliased.recipe.accentHue).toBe(145);
    expect(aliased.provenance.accentHue.sources[0]).toMatchObject({ path: 'untyped', value: '{color.alternate}' });
    const result = deriveBrand(tokens, { accent: 'color.alternate', radius: 'radius.sm', font: 'font.mono' });
    expect(result.recipe).toMatchObject({ accentHue: 145, radius: 4, font: 'JetBrains Mono' });
    expect(result.provenance.accentHue.sources).toEqual([{ path: 'color.alternate', value: '{color.selected}', resolvedValue: 'oklch(0.56 0.15 145)' }]);
    expect(result.provenance.radius.sources[0].path).toBe('radius.sm');
    const wrong = deriveBrand(tokens, { accent: 'absent', radius: 'font.sans' });
    expect(wrong.recipe).not.toHaveProperty('accentHue');
    expect(wrong.recipe).not.toHaveProperty('radius');
    expect(wrong.gaps.find(gap => gap.field === 'accentHue')?.candidates).toEqual(['absent']);
  });

  it('reports cycles and missing aliases without hanging or treating them as colours', () => {
    const result = deriveBrand({ color: { $type: 'color', brand: { $value: '{color.primary}' }, primary: { $value: '{color.brand}' }, gray: { $value: '{missing}' } } });
    expect(result.gaps.map(gap => gap.field)).toEqual(expect.arrayContaining(['accentHue', 'neutralHue', 'neutralChroma']));
    expect(result.warnings.join(' ')).toContain('alias cycle');
    expect(result.warnings.join(' ')).toContain('is missing');
  });

  it('reads DTCG colour objects, rejects transparent colours, and reports radius clamps', () => {
    const tokens = fixture('complete');
    tokens.color.brand['500'].$value = { colorSpace: 'oklch', components: [0.5, 0.12, 210] };
    tokens.radius.md.$value = { value: 2, unit: 'rem' };
    const result = deriveBrand(tokens, { radius: 'radius.md' });
    expect(result.recipe.accentHue).toBe(210);
    expect(result.recipe.radius).toBe(16);
    expect(result.warnings.join(' ')).toContain('clamped');
    tokens.color.brand['500'].$value.alpha = 0.5;
    const invalid = deriveBrand(tokens, { accent: 'color.brand.500' });
    expect(invalid.recipe).not.toHaveProperty('accentHue');
    expect(invalid.warnings.join(' ')).toContain('transparent');
  });

  it('does not invent a hue for achromatic input and keeps high chroma out of neutral inference', () => {
    const result = deriveBrand({ gray: { $type: 'color', $value: 'oklch(0.5 0 none)' } });
    expect(result.recipe.neutralChroma).toBe(0);
    expect(result.recipe).not.toHaveProperty('neutralHue');
    const high = deriveBrand(fixture('complete'), { neutral: 'color.brand.500' });
    expect(high.recipe).not.toHaveProperty('neutralHue');
    expect(high.recipe).not.toHaveProperty('neutralChroma');
  });
});
