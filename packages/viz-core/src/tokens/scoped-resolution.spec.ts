import { describe, expect, it } from 'vitest';
import tokensBundle from '@oods/tokens';
import { resolveTokenToColor, resolveTokenValue } from '../adapters/echarts/token-resolver.js';
import { resolveOodsVegaConfig } from './oods-vega-config.js';
import { resolveOodsEchartsChrome } from './oods-echarts-chrome.js';
import { toHex } from './categorical-palette.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

const spec: NormalizedVizSpec = {
  data: { values: [] }, encoding: {}, a11y: { description: 'Scoped chrome fixture.' },
  marks: [{ trait: 'MarkBar' }], config: {},
};

describe('scoped chrome follows CSS, with light/A as the default', () => {
  for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark'] as const) {
    it(`${brand}/${theme} uses one scoped source for both engines`, () => {
      const scope = { brand, theme };
      const raw = tokensBundle.cssVariablesByScope[brand][theme]['--oods-sys-surface-canvas'];
      expect(resolveTokenValue('--sys-surface-canvas', scope)).toBe(raw);
      const canvas = toHex(resolveTokenToColor('--sys-surface-canvas', scope)!);
      expect(resolveOodsVegaConfig(spec, scope).background).toBe(canvas);
      expect(resolveOodsEchartsChrome(spec, scope).background).toBe(canvas);
      expect(resolveOodsVegaConfig(spec, scope).title.color).toBe(resolveOodsEchartsChrome(spec, scope).title);
    });
  }
  it('omission equals explicit light/A and never inherits a previous call', () => {
    const light = resolveOodsVegaConfig(spec, { theme: 'light', brand: 'A' });
    expect(resolveOodsVegaConfig(spec, { theme: 'dark', brand: 'B' })).not.toEqual(light);
    expect(resolveOodsVegaConfig(spec)).toEqual(light);
    expect(resolveOodsEchartsChrome(spec)).toEqual(resolveOodsEchartsChrome(spec, { theme: 'light', brand: 'A' }));
    // A neutral palette can share the flat value; source selection is the contract.
    expect(resolveTokenValue('--oods-sys-surface-canvas')).toBe(tokensBundle.cssVariablesByScope.A.light['--oods-sys-surface-canvas']);
  });
  it('keeps agent chrome overrides ahead of the scope and leaves series surfaces alone', () => {
    const override = { ...spec, config: { tokens: { '--oods-sys-surface-canvas': '#abcdef' } } };
    for (const theme of ['light', 'dark'] as const) {
      expect(resolveOodsVegaConfig(override, { theme }).background).toBe('#ABCDEF');
      expect(resolveOodsEchartsChrome(override, { theme }).background).toBe('#ABCDEF');
      expect(resolveOodsVegaConfig(override, { theme })).not.toHaveProperty('mark');
      expect(resolveOodsVegaConfig(override, { theme })).not.toHaveProperty('range');
    }
  });
  it('emits HC system values verbatim through both chrome resolvers', () => {
    expect(resolveTokenValue('--sys-surface-canvas', { theme: 'hc' })).toBe('Canvas');
    expect(resolveOodsVegaConfig(spec, { theme: 'hc' })).toMatchObject({ background: 'Canvas', title: { color: 'CanvasText' } });
    expect(resolveOodsEchartsChrome(spec, { theme: 'hc' })).toMatchObject({ background: 'Canvas', title: 'CanvasText' });
  });
});
