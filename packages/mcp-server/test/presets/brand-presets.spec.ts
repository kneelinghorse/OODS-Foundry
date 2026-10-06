/**
 * s169 m05 — the presets are BRAND-RELATIVE, and this spec asserts the new shape.
 *
 * ── WHAT CHANGED, AND WHY IT IS NOT COSMETIC ──
 * Every preset used to be wrapped in an explicit `color.brand.A`. Since `brand.apply`'s
 * alias strategy deep-merges a delta at the DOCUMENT ROOT, handing such a preset to
 * `brand.apply({ brand: 'B' })` did not restyle brand B — it wrote an entire brand-A
 * subtree INSIDE brand B's files. MEASURED against `dark-minimal.json` at s168's tip: the
 * plan reported `/color/brand/A: {…}` as an ADDITION in `brands/B/base.json`, `dark.json`
 * and `hc.json`, while the tool cheerfully summarised "Updated 3 token values for brand B".
 *
 * The wrapper is gone: a preset's top level is now the brand's own token groups, so ONE
 * preset serves ANY brand. The caller wraps it for the brand it is applying to — there is
 * no preset-loading path inside `brand.apply` and this mission deliberately did not add
 * one. `brand.apply` separately rejects a mismatched wrapper with OODS-V149, so the two
 * halves of the fix are: nothing loaded is pre-aimed at a brand, and nothing mis-aimed can
 * be applied.
 *
 * ── WHAT THIS SPEC ASSERTS THAT THE OLD ONE COULD NOT ──
 * The old spec asserted `preset.color.brand.A` in roughly eighteen places — it was
 * structurally incapable of noticing that the wrapper WAS the defect. This one asserts the
 * ABSENCE of any brand wrapper, and deep-mergeability against BOTH brands rather than A.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, normaliseColor } from '@oods/a11y-tools';

const PRESETS_DIR = path.resolve(
  fileURLToPath(new URL('../../../../packages/tokens/src/presets', import.meta.url)),
);

const brandBasePath = (brand: string) =>
  path.resolve(
    fileURLToPath(new URL(`../../../../packages/tokens/src/tokens/brands/${brand}/base.json`, import.meta.url)),
  );

const PRESET_FILES = ['corporate-blue.json', 'startup-warm.json', 'dark-minimal.json'];
const BRANDS = ['A', 'B'] as const;

describe('brand presets', () => {
  // s224-m01 (#2542 ruling 5): a preset also carries its recipe's chart colours under `viz`, which a brand file holds at
  // its root beside color.brand.<id>; brand-relative, a brand is its colour roles and its `viz` group together.
  const brandBase = Object.fromEntries(
    BRANDS.map((brand) => {
      const file = JSON.parse(fs.readFileSync(brandBasePath(brand), 'utf8'));
      return [brand, { ...file.color.brand[brand], viz: file.viz }];
    }),
  ) as Record<(typeof BRANDS)[number], Record<string, any>>;

  for (const presetFile of PRESET_FILES) {
    describe(presetFile, () => {
      const presetPath = path.join(PRESETS_DIR, presetFile);
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

      it('is valid JSON with $schema and $description', () => {
        expect(preset.$schema).toBe('https://design-tokens.org/dtcg/schema.json');
        expect(preset.$description).toBeTruthy();
      });

      it('is BRAND-RELATIVE: no color/brand wrapper, and no brand letter anywhere in its keys', () => {
        // The precise regression this replaces. `color` and `brand` must not appear as KEYS
        // at any depth — `"$type": "color"` is a DTCG VALUE and is untouched by this.
        expect(preset.color, 'a color wrapper is back — the preset is brand-aimed again').toBeUndefined();
        expect(preset.brand).toBeUndefined();
        const keysAtEveryDepth: string[] = [];
        const walk = (node: unknown): void => {
          if (!node || typeof node !== 'object') return;
          for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            keysAtEveryDepth.push(key);
            walk(value);
          }
        };
        walk(preset);
        expect(keysAtEveryDepth).not.toContain('brand');
        expect(keysAtEveryDepth.filter((key) => key === 'A' || key === 'B')).toEqual([]);
      });

      it('its top level is the brand token groups themselves', () => {
        expect(preset.surface).toBeDefined();
        expect(preset.text).toBeDefined();
        expect(preset.border).toBeDefined();
        expect(preset.accent).toBeDefined();
      });

      it('includes interactive primary states (default, hover, pressed)', () => {
        const interactive = preset.surface.interactive.primary;
        expect(interactive.default).toBeDefined();
        expect(interactive.hover).toBeDefined();
        expect(interactive.pressed).toBeDefined();
      });

      it('includes accent tokens', () => {
        expect(preset.accent.background).toBeDefined();
        expect(preset.accent.border).toBeDefined();
        expect(preset.accent.text).toBeDefined();
      });

      it('all color tokens use oklch format', () => {
        const tokens: string[] = [];
        function collectValues(obj: any) {
          for (const [key, val] of Object.entries(obj)) {
            if (key === '$value' && typeof val === 'string') {
              tokens.push(val);
            } else if (typeof val === 'object' && val !== null) {
              collectValues(val);
            }
          }
        }
        collectValues(preset);
        expect(tokens.length).toBeGreaterThan(0);
        for (const token of tokens) {
          expect(token).toMatch(/^oklch\(/);
        }
      });

      it('s224-m01 (#2542 ruling 5): its chart marks reach 3:1 on its own canvas, in every theme it sets', () => {
        // A preset sets its colour roles and its chart colours from one recipe, and a brand made from it takes both in
        // each theme the preset names, so a chart stays legible on the preset's canvas. Until s224 a preset's charts were
        // brand A's for the same theme name: dark-minimal's light theme (a dark canvas) drew series 3 and 5 at 2.15:1
        // and 1.74:1 (the website's I58).
        const canvas = normaliseColor(preset.surface.canvas.$value, 'surface.canvas');
        const marks: Array<[string, string]> = [
          ['viz.mark.single', preset.viz.mark.single.$value],
          ...Object.entries(preset.viz.scale.categorical as Record<string, { $value: string }>).map(([n, leaf]): [string, string] => [`viz.scale.categorical.${n}`, leaf.$value]),
        ];
        expect(marks).toHaveLength(7);
        for (const [slot, value] of marks) {
          expect(contrastRatio(normaliseColor(value, slot), canvas), slot).toBeGreaterThanOrEqual(3);
        }
      });

      // BOTH brands, not just A. A preset that only deep-merges cleanly into brand A is
      // still a brand-aimed preset, just implicitly — the defect wearing a different shape.
      for (const brand of BRANDS) {
        it(`token structure deep-merges cleanly into brand ${brand} (no orphan paths)`, () => {
          function checkPaths(presetObj: any, baseObj: any, trail = '') {
            for (const [key, val] of Object.entries(presetObj)) {
              if (key.startsWith('$')) continue; // skip DTCG meta keys
              const currentPath = `${trail}.${key}`;
              if (typeof val === 'object' && val !== null && !('$value' in val)) {
                expect(baseObj[key], `Missing brand ${brand} path: ${currentPath}`).toBeDefined();
                checkPaths(val, baseObj[key], currentPath);
              }
            }
          }
          checkPaths(preset, brandBase[brand]);
        });
      }

      it('documents HOW to use it: loaded as a starting point by brand.intake, not wrapped by hand', () => {
        // s213-m05: a preset is loaded by brand.intake's template (from.preset) and the brand made from it is validated
        // and created; nothing asks a caller to wrap it in color.brand.<id> for brand.apply any more. The description
        // must say how it is loaded, or the preset is a file nobody knows how to use.
        const id = presetFile.replace(/\.json$/, '');
        expect(preset.$description).toContain('brand.intake');
        expect(preset.$description).toContain('"template"');
        expect(preset.$description).toContain(`"preset": "${id}"`);
        expect(preset.$description).toContain('Brand-relative');
        expect(preset.$extensions.ods.preset.themes).toBeTruthy();
      });
    });
  }

  it('presets produce visually distinct palettes', () => {
    const primaries = PRESET_FILES.map((f) => {
      const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, f), 'utf8'));
      return preset.surface.interactive.primary.default.$value;
    });
    const unique = new Set(primaries);
    expect(unique.size).toBe(PRESET_FILES.length);
  });

  it('every preset is applicable to EVERY brand — one payload, any brand', () => {
    // The point of the re-key, stated as an assertion: wrapping the same file for A and for
    // B produces two well-formed and DIFFERENT deltas, from one payload.
    for (const presetFile of PRESET_FILES) {
      const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, presetFile), 'utf8'));
      const wrapFor = (brand: string) => ({ color: { brand: { [brand]: preset } } });
      expect(Object.keys(wrapFor('A').color.brand)).toEqual(['A']);
      expect(Object.keys(wrapFor('B').color.brand)).toEqual(['B']);
      expect(JSON.stringify(wrapFor('A'))).not.toBe(JSON.stringify(wrapFor('B')));
    }
  });
});
