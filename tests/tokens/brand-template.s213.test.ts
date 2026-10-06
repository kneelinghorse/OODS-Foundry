/**
 * s213-m05 — the brand template the token build writes (`dist/brand-template.json`, scripts/brand-template.cjs).
 *
 * brand.intake hands a team this template and checks what the team fills in against it, from the source checkout and
 * from the npm package alike, so it has to be complete and say what each slot is for. These tests hold that: every slot
 * of every theme has a meaning taken from the design system (not the generator's provenance note), no slot is fixed now
 * that the build scopes every brand's chart colours to it (s222-m02), and the build refuses a preset that sets a slot a
 * brand does not have, or a slot nobody has described, instead of shipping a template that misleads.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { buildBrandTemplate } = require('../../packages/tokens/scripts/brand-template.cjs') as {
  buildBrandTemplate: (root?: string) => {
    themes: Record<'base' | 'dark' | 'hc', { label: string; slots: Array<{ slot: string; type: string; meaning: string }> }>;
    fixed: Array<{ theme: string; slot: string; value: string; reason: string }>;
    systemColours: string[];
    presets: Array<{ id: string; themes: Record<string, string>; values: Record<string, string> }>;
    brandId: { pattern: string; rule: string };
  };
};

const TOKENS_PKG = path.resolve(__dirname, '..', '..', 'packages', 'tokens');

/** A copy of the token package's sources, to break one thing in. */
function sandbox(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-brand-template-'));
  fs.cpSync(path.join(TOKENS_PKG, 'src'), path.join(root, 'src'), { recursive: true });
  return root;
}

describe('s213-m05 brand template', () => {
  const template = buildBrandTemplate();

  it('lists every slot of brand A in each theme, each with a meaning from the design system', () => {
    // s222-m01 (#2502 rulings 3, 7 and 11): 69 colours in each theme, and in the light file the brand's radius (5
    // dimensions) and font (2 family lists). s222-m02 (ruling 12): the 27 chart slots in every theme, light included,
    // because each brand's charts now take its own recipe's palette (the light file carried one chart slot until then).
    expect(Object.fromEntries(Object.entries(template.themes).map(([theme, entry]) => [theme, entry.slots.length]))).toEqual({ base: 103, dark: 96, hc: 96 });
    for (const [theme, { slots }] of Object.entries(template.themes)) {
      for (const { slot, type, meaning } of slots) {
        expect(type, `${theme}.${slot}`).toBe(slot.startsWith('radius.') ? 'dimension' : slot.startsWith('font.') ? 'fontFamily' : 'color');
        // The brand files' own descriptions say where a value came from ("generated from palette/seeds.json"), not what it is for.
        expect(meaning, `${theme}.${slot}`).not.toMatch(/generated from|generate-palette/);
        expect(meaning.length, `${theme}.${slot}`).toBeGreaterThan(10);
      }
    }
    expect(template.themes.base.slots.find(entry => entry.slot === 'surface.canvas')?.meaning).toBe('Primary application canvas.');
    expect(template.themes.dark.slots.find(entry => entry.slot === 'viz.scale.sequential.03')?.meaning).toBe('Step 3 of 9 of the ordered scale (01 is the low end).');
  });

  it('fixes no slot, because each brand now sets its own light chart colours (s222-m02, #2502 ruling 12)', () => {
    const baseA = JSON.parse(fs.readFileSync(path.join(TOKENS_PKG, 'src/tokens/brands/A/base.json'), 'utf8'));
    const baseB = JSON.parse(fs.readFileSync(path.join(TOKENS_PKG, 'src/tokens/brands/B/base.json'), 'utf8'));
    // Until s222 a light chart colour had to be the same in every brand (every base loads in every scope), so the
    // template fixed it; the build now loads a scope's own base last, and the shipped brands' light charts differ.
    expect(template.fixed).toEqual([]);
    expect(baseA.viz.scale.categorical['01'].$value).not.toBe(baseB.viz.scale.categorical['01'].$value);
    expect(template.themes.base.slots.filter(entry => entry.slot.startsWith('viz.'))).toHaveLength(27);
  });

  it('carries the three presets, each saying which themes it starts from', () => {
    expect(template.presets.map(preset => [preset.id, preset.themes, Object.keys(preset.values).length])).toEqual([
      // s222-m01: each preset is one recipe's 69 colour roles (seeds.json presets), not a hand-picked handful.
      // s224-m01 (#2542 ruling 5): and its 27 chart colours, from the same recipe on its own canvas. Without them a preset's
      // charts were brand A's for the same theme name, and dark-minimal's light theme (a dark canvas) drew 1.74:1 marks.
      ['corporate-blue', { base: 'base' }, 96],
      ['dark-minimal', { base: 'dark', dark: 'dark' }, 96],
      ['startup-warm', { base: 'base' }, 96],
    ]);
    const chartSlots = template.themes.base.slots.map(entry => entry.slot).filter(slot => slot.startsWith('viz.')).sort();
    for (const preset of template.presets) {
      expect(Object.keys(preset.values).filter(slot => slot.startsWith('viz.')).sort(), preset.id).toEqual(chartSlots);
    }
    expect(template.systemColours).toContain('Canvas');
    expect(new RegExp(template.brandId.pattern).test('AcmeCorp')).toBe(false);
  });

  it('refuses a preset that sets a slot a brand does not have, naming it, and admits a light chart slot', () => {
    const root = sandbox();
    try {
      const file = path.join(root, 'src/presets/broken.json');
      fs.writeFileSync(file, JSON.stringify({
        $extensions: { ods: { preset: { themes: { base: 'base' } } } },
        surface: { sparkle: { $type: 'color', $value: '#ffffff' } },
        viz: { scale: { categorical: { '05': { $type: 'color', $value: '#ff0000' } } } },
      }));
      expect(() => buildBrandTemplate(root)).toThrow(/preset src\/presets\/broken\.json:\n {2}- surface\.sparkle is not a brand slot$/);
      fs.writeFileSync(file, JSON.stringify({
        $extensions: { ods: { preset: { themes: { base: 'base' } } } },
        viz: { scale: { categorical: { '05': { $type: 'color', $value: '#ff0000' } } } },
      }));
      expect(buildBrandTemplate(root).presets.find(preset => preset.id === 'broken')?.values).toEqual({ 'viz.scale.categorical.05': '#ff0000' });
      fs.writeFileSync(file, JSON.stringify({ surface: { canvas: { $type: 'color', $value: '#ffffff' } } }));
      expect(() => buildBrandTemplate(root)).toThrow(/\$extensions\.ods\.preset\.themes is missing/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a slot nobody has described, so a new slot arrives with its meaning', () => {
    const root = sandbox();
    try {
      const file = path.join(root, 'src/tokens/brands/A/dark.json');
      const dark = JSON.parse(fs.readFileSync(file, 'utf8'));
      dark.color.brand.A.surface.glow = { $type: 'color', $value: '#ffffff' };
      fs.writeFileSync(file, JSON.stringify(dark));
      expect(() => buildBrandTemplate(root)).toThrow(/no meaning for slot surface\.glow/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
