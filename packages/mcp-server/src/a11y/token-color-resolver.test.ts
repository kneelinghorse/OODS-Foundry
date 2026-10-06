import { describe, expect, it } from 'vitest';

import {
  createTokenResolver,
  flattenDTCGLayers,
  toFlatTokenMap,
  tokenColorResolver,
} from './token-color-resolver.js';
import type { DTCGTokenData } from './token-color-resolver.js';

// ---------------------------------------------------------------------------
// Fixture: minimal DTCG layers mimicking the real oods-tokens artifact
// ---------------------------------------------------------------------------

function fixture(): DTCGTokenData {
  return {
    layers: {
      reference: {
        $schema: 'https://design-tokens.org/schema.json',
        ref: {
          color: {
            neutral: {
              50: { $type: 'color', $value: 'oklch(0.9913 0.0013 286.38)' },
              100: { $type: 'color', $value: 'oklch(0.9816 0.0017 247.84)' },
              200: { $type: 'color', $value: 'oklch(0.9417 0.0052 247.88)' },
              500: { $type: 'color', $value: 'oklch(0.6929 0.0198 269.00)' },
              700: { $type: 'color', $value: 'oklch(0.5109 0.0264 269.16)' },
              900: { $type: 'color', $value: 'oklch(0.313 0.0171 266.40)' },
            },
            primary: {
              500: { $type: 'color', $value: 'oklch(0.5631 0.1717 274.55)' },
              600: { $type: 'color', $value: 'oklch(0.4631 0.1867 274.55)' },
            },
            info: {
              700: { $type: 'color', $value: 'oklch(0.5466 0.1806 263.48)' },
              900: { $type: 'color', $value: 'oklch(0.3847 0.1344 263.74)' },
            },
          },
        },
      },
      theme: {
        $schema: 'https://design-tokens.org/schema.json',
        theme: {
          surface: {
            canvas: { $type: 'color', $value: '{ref.color.neutral.50}' },
            raised: { $type: 'color', $value: '{ref.color.neutral.100}' },
          },
          text: {
            primary: { $type: 'color', $value: '{ref.color.neutral.900}' },
            secondary: { $type: 'color', $value: '{ref.color.neutral.700}' },
            muted: { $type: 'color', $value: '{ref.color.neutral.500}' },
            accent: { $type: 'color', $value: '{ref.color.primary.600}' },
          },
          status: {
            info: {
              text: { $type: 'color', $value: '{ref.color.info.900}' },
              icon: { $type: 'color', $value: '{ref.color.info.700}' },
            },
          },
        },
      },
      system: {
        $schema: 'https://design-tokens.org/schema.json',
        sys: {
          surface: {
            canvas: { $type: 'color', $value: '{theme.surface.canvas}' },
            raised: { $type: 'color', $value: '{theme.surface.raised}' },
          },
          text: {
            primary: { $type: 'color', $value: '{theme.text.primary}' },
            secondary: { $type: 'color', $value: '{theme.text.secondary}' },
            muted: { $type: 'color', $value: '{theme.text.muted}' },
            accent: { $type: 'color', $value: '{theme.text.accent}' },
          },
          status: {
            info: {
              text: { $type: 'color', $value: '{theme.status.info.text}' },
              icon: { $type: 'color', $value: '{theme.status.info.icon}' },
            },
          },
        },
      },
      component: {},
      view: {},
    },
  };
}

// ---------------------------------------------------------------------------
// tokenColorResolver — single-shot resolution
// ---------------------------------------------------------------------------

describe('tokenColorResolver', () => {
  it('resolves a semantic token (sys.text.primary) to hex', () => {
    const hex = tokenColorResolver('sys.text.primary', fixture());
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('resolves a reference token directly (no aliasing)', () => {
    const hex = tokenColorResolver('ref.color.neutral.900', fixture());
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('resolves a theme-level token (one-hop alias)', () => {
    const hex = tokenColorResolver('theme.text.primary', fixture());
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('produces consistent results across alias depths', () => {
    const data = fixture();
    const ref = tokenColorResolver('ref.color.neutral.900', data);
    const theme = tokenColorResolver('theme.text.primary', data);
    const sys = tokenColorResolver('sys.text.primary', data);
    expect(ref).toBe(theme);
    expect(theme).toBe(sys);
  });

  it('throws for a missing token', () => {
    expect(() => tokenColorResolver('sys.nonexistent.token', fixture())).toThrow(
      /not found in token data/,
    );
  });

  it('throws for a broken alias chain', () => {
    const data = fixture();
    // Point a token at a non-existent target
    (data.layers.system as any).sys.text.broken = {
      $type: 'color',
      $value: '{theme.text.doesnotexist}',
    };
    expect(() => tokenColorResolver('sys.text.broken', data)).toThrow(/not found in token data/);
    expect(() => tokenColorResolver('sys.text.broken', data)).toThrow(/Resolution chain/);
  });

  it('resolves deeply nested status tokens', () => {
    const hex = tokenColorResolver('sys.status.info.text', fixture());
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// Alias chain handling
// ---------------------------------------------------------------------------

describe('alias chain handling', () => {
  it('resolves a 3-hop chain: system → theme → reference', () => {
    const data = fixture();
    const resolver = createTokenResolver(data);
    const result = resolver.resolveWithChain('sys.text.primary');

    expect(result.chain).toEqual([
      'sys.text.primary',
      'theme.text.primary',
      'ref.color.neutral.900',
    ]);
    expect(result.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('resolves a 1-hop chain: theme → reference', () => {
    const resolver = createTokenResolver(fixture());
    const result = resolver.resolveWithChain('theme.surface.canvas');

    expect(result.chain).toEqual(['theme.surface.canvas', 'ref.color.neutral.50']);
    expect(result.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('resolves a 0-hop chain: reference with raw value', () => {
    const resolver = createTokenResolver(fixture());
    const result = resolver.resolveWithChain('ref.color.neutral.900');

    expect(result.chain).toEqual(['ref.color.neutral.900']);
  });

  it('detects circular aliases', () => {
    const data: DTCGTokenData = {
      layers: {
        reference: {},
        theme: {
          a: { $type: 'color', $value: '{b}' },
          b: { $type: 'color', $value: '{a}' },
        },
        system: {},
        component: {},
        view: {},
      },
    };

    expect(() => tokenColorResolver('a', data)).toThrow(/exceeded maximum depth/);
  });
});

// ---------------------------------------------------------------------------
// flattenDTCGLayers
// ---------------------------------------------------------------------------

describe('flattenDTCGLayers', () => {
  it('flattens all layers into a single map', () => {
    const flat = flattenDTCGLayers(fixture());
    expect(flat.has('ref.color.neutral.900')).toBe(true);
    expect(flat.has('theme.text.primary')).toBe(true);
    expect(flat.has('sys.text.primary')).toBe(true);
  });

  it('skips $schema keys', () => {
    const flat = flattenDTCGLayers(fixture());
    const keys = [...flat.keys()];
    expect(keys.some((k) => k.includes('$schema'))).toBe(false);
  });

  it('preserves raw alias values (does not resolve)', () => {
    const flat = flattenDTCGLayers(fixture());
    expect(flat.get('sys.text.primary')).toBe('{theme.text.primary}');
    expect(flat.get('theme.text.primary')).toBe('{ref.color.neutral.900}');
  });

  it('handles empty layers gracefully', () => {
    const data: DTCGTokenData = {
      layers: {
        reference: {},
        theme: {},
        system: {},
        component: {},
        view: {},
      },
    };
    const flat = flattenDTCGLayers(data);
    expect(flat.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createTokenResolver — batch resolution
// ---------------------------------------------------------------------------

describe('createTokenResolver', () => {
  it('resolves multiple tokens from the same batch resolver', () => {
    const resolver = createTokenResolver(fixture());

    const primary = resolver.resolve('sys.text.primary');
    const canvas = resolver.resolve('sys.surface.canvas');
    const accent = resolver.resolve('sys.text.accent');

    expect(primary).toMatch(/^#[0-9A-F]{6}$/);
    expect(canvas).toMatch(/^#[0-9A-F]{6}$/);
    expect(accent).toMatch(/^#[0-9A-F]{6}$/);
    // Primary text and canvas background should be different colours
    expect(primary).not.toBe(canvas);
  });

  it('exposes flatMap for advanced consumers', () => {
    const resolver = createTokenResolver(fixture());
    expect(resolver.flatMap).toBeInstanceOf(Map);
    expect(resolver.flatMap.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// toFlatTokenMap — bridge to @oods/a11y-tools FlatTokenMap format
// ---------------------------------------------------------------------------

describe('toFlatTokenMap', () => {
  it('converts dot-paths to dash-separated keys', () => {
    const flat = flattenDTCGLayers(fixture());
    const map = toFlatTokenMap(flat);

    expect(map['sys-text-primary']).toBeDefined();
    expect(map['ref-color-neutral-900']).toBeDefined();
  });

  it('generates correct CSS variable names with prefix', () => {
    const flat = flattenDTCGLayers(fixture());
    const map = toFlatTokenMap(flat, 'oods');

    expect(map['sys-text-primary']?.cssVariable).toBe('--oods-sys-text-primary');
    expect(map['ref-color-neutral-50']?.cssVariable).toBe('--oods-ref-color-neutral-50');
  });

  it('uses custom prefix', () => {
    const flat = flattenDTCGLayers(fixture());
    const map = toFlatTokenMap(flat, 'custom');

    expect(map['sys-text-primary']?.cssVariable).toBe('--custom-sys-text-primary');
  });

  it('resolves alias chains so values are concrete colour strings', () => {
    const flat = flattenDTCGLayers(fixture());
    const map = toFlatTokenMap(flat);

    // sys.text.primary aliases to theme.text.primary → ref.color.neutral.900 → oklch(...)
    expect(map['sys-text-primary']?.value).toContain('oklch');
    expect(map['ref-color-neutral-900']?.value).toContain('oklch');
  });
});

// ---------------------------------------------------------------------------
// Missing-token fallback behaviour
// ---------------------------------------------------------------------------

describe('missing token fallback', () => {
  it('error message includes the token name', () => {
    expect(() => tokenColorResolver('does.not.exist', fixture())).toThrow('does.not.exist');
  });

  it('error message includes resolution chain when alias target is missing', () => {
    const data = fixture();
    (data.layers.system as any).sys.broken = {
      nested: {
        deep: { $type: 'color', $value: '{theme.missing.path}' },
      },
    };
    expect(() => tokenColorResolver('sys.broken.nested.deep', data)).toThrow(
      /Resolution chain:.*sys\.broken\.nested\.deep/,
    );
  });

  it('throws when token value is not a valid colour', () => {
    const data: DTCGTokenData = {
      layers: {
        reference: {
          bad: { $type: 'dimension', $value: '16px' },
        },
        theme: {},
        system: {},
        component: {},
        view: {},
      },
    };
    expect(() => tokenColorResolver('bad', data)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration: real structured data artifact shape
// ---------------------------------------------------------------------------

describe('structured data artifact integration', () => {
  it('handles reference tokens that alias other reference tokens', () => {
    const data: DTCGTokenData = {
      layers: {
        reference: {
          ref: {
            color: {
              primary: {
                100: { $type: 'color', $value: 'oklch(0.9563 0.0277 225.69)' },
              },
              accent: {
                100: { $type: 'color', $value: '{ref.color.primary.100}' },
              },
            },
          },
        },
        theme: {},
        system: {},
        component: {},
        view: {},
      },
    };

    const primary = tokenColorResolver('ref.color.primary.100', data);
    const accent = tokenColorResolver('ref.color.accent.100', data);
    expect(primary).toBe(accent);
  });

  it('resolves hex colour values directly', () => {
    const data: DTCGTokenData = {
      layers: {
        reference: {
          token: { $type: 'color', $value: '#FF5500' },
        },
        theme: {},
        system: {},
        component: {},
        view: {},
      },
    };

    expect(tokenColorResolver('token', data)).toBe('#FF5500');
  });
});
