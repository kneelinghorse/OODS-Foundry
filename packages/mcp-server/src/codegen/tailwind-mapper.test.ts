import { describe, expect, it } from 'vitest';
import { createVariants, inlineStyleToTailwind, mapTokenToTailwind } from './tailwind-mapper.js';

describe('tailwind-mapper', () => {
  // ── mapTokenToTailwind: color tokens ──────────────────────────────

  describe('mapTokenToTailwind — color category', () => {
    it('maps theme.text tokens to text-* classes', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text')).toEqual(['text-primary']);
    });

    it('maps theme.surface tokens to bg-* classes', () => {
      expect(mapTokenToTailwind('theme.surface.canvas', 'bg')).toEqual(['bg-canvas']);
    });

    it('maps theme.border tokens to border-* classes', () => {
      expect(mapTokenToTailwind('theme.border.subtle', 'border')).toEqual(['border-subtle']);
    });
  });

  // ── mapTokenToTailwind: spacing tokens ────────────────────────────

  describe('mapTokenToTailwind — spacing category', () => {
    it('maps ref.space.inset.default to padding scale', () => {
      expect(mapTokenToTailwind('ref.space.inset.default', 'p')).toEqual(['p-6']);
    });

    it('maps spacing tokens to margin utilities', () => {
      // spacing tokens resolve through the scale map
      const result = mapTokenToTailwind('ref.space.inset.default', 'm');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatch(/^m-/);
    });

    it('maps gap tokens correctly', () => {
      const result = mapTokenToTailwind('ref.space.stack.compact', 'gap');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatch(/^gap-/);
    });
  });

  // ── mapTokenToTailwind: typography tokens ─────────────────────────

  describe('mapTokenToTailwind — typography category', () => {
    it('maps font-size tokens to text-size classes', () => {
      expect(mapTokenToTailwind('sys.text.scale.body.sm.font-size', 'text')).toEqual(['text-sm']);
    });
  });

  // ── mapTokenToTailwind: border-radius tokens ─────────────────────

  describe('mapTokenToTailwind — border-radius category', () => {
    it('maps ref.border.radius.md to rounded class', () => {
      expect(mapTokenToTailwind('ref.border.radius.md', 'rounded')).toEqual(['rounded-2xl']);
    });
  });

  // ── mapTokenToTailwind: shadow tokens ─────────────────────────────

  describe('mapTokenToTailwind — shadow category', () => {
    it('maps shadow elevation tokens to shadow classes', () => {
      expect(mapTokenToTailwind('theme.shadow.elevation.card.color', 'shadow')).toEqual(['shadow-md']);
    });
  });

  // ── mapTokenToTailwind: opacity tokens ────────────────────────────

  describe('mapTokenToTailwind — opacity category', () => {
    it('maps opacity tokens to opacity classes', () => {
      expect(mapTokenToTailwind('overlay.backdrop.opacity', 'opacity')).toEqual(['opacity-50']);
    });
  });

  // ── mapTokenToTailwind: interactive state prefixes ────────────────

  describe('mapTokenToTailwind — state prefixes', () => {
    it('generates hover and focus state prefixes', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text', { states: ['hover', 'focus'] })).toEqual([
        'text-primary',
        'hover:text-primary',
        'focus:text-primary',
      ]);
    });

    it('generates disabled state prefix', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text', { states: ['disabled'] })).toEqual([
        'text-primary',
        'disabled:text-primary',
      ]);
    });

    it('generates focus-visible state prefix', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text', { states: ['focus-visible'] })).toEqual([
        'text-primary',
        'focus-visible:text-primary',
      ]);
    });

    it('generates active state prefix', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text', { states: ['active'] })).toEqual([
        'text-primary',
        'active:text-primary',
      ]);
    });

    it('generates all supported states together', () => {
      const result = mapTokenToTailwind('theme.text.primary', 'text', {
        states: ['hover', 'focus', 'focus-visible', 'disabled', 'active'],
      });

      expect(result).toEqual([
        'text-primary',
        'hover:text-primary',
        'focus:text-primary',
        'focus-visible:text-primary',
        'disabled:text-primary',
        'active:text-primary',
      ]);
    });

    it('excludes base class when includeBase is false', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text', {
        states: ['hover'],
        includeBase: false,
      })).toEqual([
        'hover:text-primary',
      ]);
    });

    it('returns only base class when states is empty', () => {
      expect(mapTokenToTailwind('theme.text.primary', 'text', { states: [] })).toEqual([
        'text-primary',
      ]);
    });

    it('filters out unsupported state names', () => {
      const result = mapTokenToTailwind('theme.text.primary', 'text', {
        states: ['hover', 'invalid-state' as any],
      });
      // 'invalid-state' is filtered out, only hover remains
      expect(result).toEqual([
        'text-primary',
        'hover:text-primary',
      ]);
    });
  });

  // ── mapTokenToTailwind: fallback to arbitrary values ──────────────

  describe('mapTokenToTailwind — fallback / arbitrary values', () => {
    it('falls back to arbitrary value class for unmapped tokens', () => {
      expect(mapTokenToTailwind('sys.color.never-seen-before', 'text')).toEqual([
        'text-[var(--sys-color-never-seen-before)]',
      ]);
    });

    it('falls back with CSS var for unknown bg tokens', () => {
      expect(mapTokenToTailwind('sys.color.mystery', 'bg')).toEqual([
        'bg-[var(--sys-color-mystery)]',
      ]);
    });

    it('handles curly-brace token references', () => {
      const result = mapTokenToTailwind('{sys.color.unknown}', 'text');
      expect(result.length).toBe(1);
      expect(result[0]).toMatch(/^text-\[var\(--/);
    });
  });

  // ── inlineStyleToTailwind ─────────────────────────────────────────

  describe('inlineStyleToTailwind', () => {
    it.each(['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty'])(
      'ignores inherited style-map key %s',
      (property) => {
        expect(inlineStyleToTailwind({ [property]: 'red' })).toBe('');
      },
    );

    it('converts a full inline style object to Tailwind classes', () => {
      const classes = inlineStyleToTailwind({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 'var(--ref-space-stack-compact)',
        color: 'var(--theme-text-primary)',
        padding: 'var(--ref-space-inset-default)',
        borderRadius: 'var(--ref-border-radius-md)',
        opacity: '0.5',
      });

      expect(classes.split(' ')).toEqual([
        'flex',
        'flex-col',
        'justify-between',
        'gap-3',
        'text-primary',
        'p-6',
        'rounded-2xl',
        'opacity-50',
      ]);
    });

    it('maps display property values', () => {
      expect(inlineStyleToTailwind({ display: 'flex' })).toBe('flex');
      expect(inlineStyleToTailwind({ display: 'grid' })).toBe('grid');
      expect(inlineStyleToTailwind({ display: 'block' })).toBe('block');
      expect(inlineStyleToTailwind({ display: 'inline-flex' })).toBe('inline-flex');
    });

    it('maps flexDirection property', () => {
      expect(inlineStyleToTailwind({ flexDirection: 'row' })).toBe('flex-row');
      expect(inlineStyleToTailwind({ flexDirection: 'column' })).toBe('flex-col');
      expect(inlineStyleToTailwind({ flexDirection: 'row-reverse' })).toBe('flex-row-reverse');
      expect(inlineStyleToTailwind({ flexDirection: 'column-reverse' })).toBe('flex-col-reverse');
    });

    it('maps justifyContent values', () => {
      expect(inlineStyleToTailwind({ justifyContent: 'center' })).toBe('justify-center');
      expect(inlineStyleToTailwind({ justifyContent: 'space-between' })).toBe('justify-between');
      expect(inlineStyleToTailwind({ justifyContent: 'space-around' })).toBe('justify-around');
      expect(inlineStyleToTailwind({ justifyContent: 'flex-start' })).toBe('justify-start');
    });

    it('maps alignItems values', () => {
      expect(inlineStyleToTailwind({ alignItems: 'center' })).toBe('items-center');
      expect(inlineStyleToTailwind({ alignItems: 'stretch' })).toBe('items-stretch');
      expect(inlineStyleToTailwind({ alignItems: 'baseline' })).toBe('items-baseline');
    });

    it('maps literal pixel values to spacing scale', () => {
      expect(inlineStyleToTailwind({ padding: '16px' })).toBe('p-4');
      expect(inlineStyleToTailwind({ margin: '8px' })).toBe('m-2');
      expect(inlineStyleToTailwind({ gap: '24px' })).toBe('gap-6');
    });

    it('maps rem values to spacing scale', () => {
      expect(inlineStyleToTailwind({ padding: '1rem' })).toBe('p-4');
    });

    it('falls back to arbitrary class for unknown values', () => {
      expect(inlineStyleToTailwind({
        backgroundColor: 'var(--custom-unknown-token)',
      })).toBe('bg-[var(--custom-unknown-token)]');
    });

    it('handles grid template columns with arbitrary values', () => {
      const result = inlineStyleToTailwind({ gridTemplateColumns: '1fr 2fr' });
      expect(result).toContain('grid-cols-[');
    });

    it('handles empty style objects', () => {
      expect(inlineStyleToTailwind({})).toBe('');
    });

    it('skips empty string values', () => {
      expect(inlineStyleToTailwind({ color: '', padding: '' })).toBe('');
    });

    it('handles kebab-case CSS properties', () => {
      const result = inlineStyleToTailwind({ 'flex-direction': 'column' } as any);
      expect(result).toBe('flex-col');
    });

    it('deduplicates classes', () => {
      // Two properties that could map to the same class
      const result = inlineStyleToTailwind({
        display: 'flex',
      });
      const parts = result.split(' ');
      const unique = [...new Set(parts)];
      expect(parts).toEqual(unique);
    });
  });

  // ── createVariants ────────────────────────────────────────────────

  describe('createVariants', () => {
    it('creates a cva variant definition with multiple variants', () => {
      const definition = createVariants('Button', {
        intent: {
          primary: ['bg-primary', 'text-white'],
          secondary: 'bg-secondary text-white',
        },
        size: {
          sm: 'px-2 py-1',
          lg: ['px-4', 'py-2'],
        },
      }, 'inline-flex items-center');

      expect(definition).toContain('const buttonVariants = cva(');
      expect(definition).toContain('"intent"');
      expect(definition).toContain('"primary": "bg-primary text-white"');
      expect(definition).toContain('"secondary": "bg-secondary text-white"');
      expect(definition).toContain('"sm": "px-2 py-1"');
      expect(definition).toContain('"lg": "px-4 py-2"');
      expect(definition).toContain("'inline-flex items-center'");
    });

    it('creates cva definition with empty base', () => {
      const definition = createVariants('Card', {
        variant: {
          outlined: 'border border-gray-300',
          filled: 'bg-gray-100',
        },
      });

      expect(definition).toContain('const cardVariants = cva(');
      expect(definition).toContain("''");
    });

    it('creates cva definition with array base', () => {
      const definition = createVariants('Badge', {
        tone: {
          success: 'bg-green-100 text-green-800',
          warning: 'bg-yellow-100 text-yellow-800',
        },
      }, ['inline-flex', 'rounded-full', 'px-2']);

      expect(definition).toContain('const badgeVariants = cva(');
      expect(definition).toContain("'inline-flex rounded-full px-2'");
    });

    it('normalizes component names to camelCase variable names', () => {
      expect(createVariants('Icon Button', { size: { sm: 'text-sm' } }))
        .toContain('const iconButtonVariants = cva(');

      expect(createVariants('text-input', { size: { sm: 'text-sm' } }))
        .toContain('const textInputVariants = cva(');
    });

    it('normalizes array variant values by joining with space', () => {
      const definition = createVariants('Btn', {
        intent: {
          primary: ['bg-primary', 'text-white', 'hover:bg-primary-dark'],
        },
      });

      expect(definition).toContain('"primary": "bg-primary text-white hover:bg-primary-dark"');
    });

    it('handles single-option variants', () => {
      const definition = createVariants('Tag', {
        kind: {
          default: 'bg-gray-100 text-gray-800',
        },
      });

      expect(definition).toContain('"kind"');
      expect(definition).toContain('"default": "bg-gray-100 text-gray-800"');
    });
  });
});
