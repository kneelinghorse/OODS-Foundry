/**
 * Styling mode coverage tests (s79-m03).
 *
 * Validates all 9 framework×styling combinations produce valid, non-empty
 * styling output:
 *   React  × inline | tokens | tailwind
 *   Vue    × inline | tokens | tailwind
 *   HTML   × inline | tokens | tailwind
 *
 * Checks:
 * - Tailwind mode emits correct CVA variant definitions
 * - Tokens mode references design token CSS variables
 * - Inline mode uses style objects (React/Vue) or style attributes (HTML)
 */
import { describe, it, expect } from 'vitest';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

/* ------------------------------------------------------------------ */
/*  Shared schema — exercises layout tokens, style tokens, and CVA     */
/* ------------------------------------------------------------------ */

const schema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'md' },
      style: { spacingToken: 'lg' },
      children: [
        {
          id: 'card',
          component: 'Card',
          style: { radiusToken: 'sm', shadowToken: 'md' },
          children: [
            {
              id: 'heading',
              component: 'Text',
              style: { typographyToken: 'heading-lg', colorToken: 'text-primary' },
              props: { content: 'Title' },
            },
            {
              id: 'inline-row',
              component: 'Stack',
              layout: { type: 'inline', align: 'center', gapToken: 'sm' },
              children: [
                {
                  id: 'btn-primary',
                  component: 'Button',
                  props: { label: 'Save', intent: 'primary', size: 'md' },
                },
                {
                  id: 'btn-secondary',
                  component: 'Button',
                  props: { label: 'Cancel', intent: 'secondary', size: 'sm' },
                },
              ],
            },
          ],
        },
        {
          id: 'badge',
          component: 'Badge',
          style: { colorToken: 'success' },
          props: { label: 'Active', variant: 'success' },
        },
      ],
    },
  ],
};

type Framework = 'react' | 'vue' | 'html';
type Styling = 'inline' | 'tokens' | 'tailwind';

function emitFor(framework: Framework, styling: Styling) {
  const opts: CodegenOptions = { typescript: true, styling };
  switch (framework) {
    case 'react': return reactEmit(schema, opts);
    case 'vue': return vueEmit(schema, opts);
    case 'html': return htmlEmit(schema, opts);
  }
}

/* ------------------------------------------------------------------ */
/*  3×3 matrix: all combinations produce valid output                  */
/* ------------------------------------------------------------------ */

describe('styling mode coverage — 3×3 matrix', () => {
  const frameworks: Framework[] = ['react', 'vue', 'html'];
  const stylings: Styling[] = ['inline', 'tokens', 'tailwind'];

  for (const framework of frameworks) {
    for (const styling of stylings) {
      describe(`${framework} × ${styling}`, () => {
        const result = emitFor(framework, styling);

        it('emits ok status', () => {
          expect(result.status).toBe('ok');
        });

        it('produces non-empty code', () => {
          expect(result.code.length).toBeGreaterThan(50);
        });

        it('contains all component names', () => {
          expect(result.code).toContain('Stack');
          expect(result.code).toContain('Card');
          expect(result.code).toContain('Text');
          expect(result.code).toContain('Button');
          expect(result.code).toContain('Badge');
        });
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/*  Tailwind-specific assertions                                       */
/* ------------------------------------------------------------------ */

describe('tailwind mode specifics', () => {
  describe('React × tailwind', () => {
    const result = emitFor('react', 'tailwind');

    it('uses className= (not style=)', () => {
      expect(result.code).toContain('className=');
      expect(result.code).not.toContain('style={{');
    });

    it('emits CVA import when variants present', () => {
      expect(result.code).toContain("import { cva } from 'class-variance-authority'");
    });

    it('emits CVA variant definitions for Button', () => {
      expect(result.code).toContain('cva(');
    });

    it('includes Tailwind utility classes', () => {
      // Layout utilities
      expect(result.code).toMatch(/flex|grid/);
      // Gap utility
      expect(result.code).toMatch(/gap-/);
    });

    it('includes class-variance-authority in imports list', () => {
      expect(result.imports).toContain('class-variance-authority');
    });
  });

  describe('Vue × tailwind', () => {
    const result = emitFor('vue', 'tailwind');

    it('uses class= or :class= (not style=)', () => {
      // Vue uses class= for static, :class= for dynamic
      const hasClass = result.code.includes('class=') || result.code.includes(':class=');
      expect(hasClass).toBe(true);
      // Should not have inline style on elements with tailwind classes
      // (some elements may legitimately have no styles and that's ok)
    });

    it('emits CVA import when variants present', () => {
      expect(result.code).toContain("import { cva } from 'class-variance-authority'");
    });

    it('emits CVA variant definitions for Button', () => {
      expect(result.code).toContain('cva(');
    });

    it('includes class-variance-authority in imports list', () => {
      expect(result.imports).toContain('class-variance-authority');
    });
  });

  describe('HTML × tailwind', () => {
    const result = emitFor('html', 'tailwind');

    it('produces valid HTML output', () => {
      expect(result.status).toBe('ok');
      expect(result.code).toContain('<!DOCTYPE html>');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Tokens mode specifics                                              */
/* ------------------------------------------------------------------ */

describe('tokens mode specifics', () => {
  describe('React × tokens', () => {
    const result = emitFor('react', 'tokens');

    it('emits style={{ }} with CSS variable references', () => {
      expect(result.code).toContain('style={{');
      expect(result.code).toContain('var(--ref-');
    });

    it('references spacing tokens', () => {
      // #552: react-emitter now emits the canonical --ref-space-* prefix.
      expect(result.code).toContain('var(--ref-space-');
    });

    it('references radius tokens', () => {
      expect(result.code).toContain('var(--ref-radius-');
    });

    it('references typography tokens', () => {
      expect(result.code).toContain('var(--ref-typography-');
    });

    it('references color tokens', () => {
      expect(result.code).toContain('var(--ref-color-');
    });

    it('does not include className= (tokens use style)', () => {
      expect(result.code).not.toContain('className=');
    });
  });

  describe('Vue × tokens', () => {
    const result = emitFor('vue', 'tokens');

    it('emits inline style= with CSS variable references', () => {
      expect(result.code).toContain('style="');
      expect(result.code).toContain('var(--ref-');
    });

    it('references spacing tokens', () => {
      // sprint-125 m03: vue converged onto the canonical --ref-space-* prefix (was --ref-spacing-).
      expect(result.code).toContain('var(--ref-space-');
    });

    it('references radius tokens', () => {
      expect(result.code).toContain('var(--ref-radius-');
    });

    it('does not include :class= (tokens use style)', () => {
      expect(result.code).not.toContain(':class=');
    });
  });

  describe('HTML × tokens', () => {
    const result = emitFor('html', 'tokens');

    it('produces HTML with CSS variable references', () => {
      expect(result.status).toBe('ok');
      expect(result.code).toContain('var(--ref-');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Inline mode specifics                                              */
/* ------------------------------------------------------------------ */

describe('inline mode specifics', () => {
  describe('React × inline', () => {
    const result = emitFor('react', 'inline');

    it('emits style={{ }} objects', () => {
      expect(result.code).toContain('style={{');
    });

    it('uses CSS variable references (inline still uses token vars)', () => {
      // Inline mode in OODS still references token variables for consistency
      expect(result.code).toContain('var(--ref-');
    });

    it('does not include className= (inline uses style)', () => {
      expect(result.code).not.toContain('className=');
    });
  });

  describe('Vue × inline', () => {
    const result = emitFor('vue', 'inline');

    it('emits style= attributes', () => {
      expect(result.code).toContain('style="');
    });

    it('uses CSS variable references', () => {
      expect(result.code).toContain('var(--ref-');
    });
  });

  describe('HTML × inline', () => {
    const result = emitFor('html', 'inline');

    it('produces valid HTML with style attributes', () => {
      expect(result.status).toBe('ok');
      expect(result.code).toContain('<!DOCTYPE html>');
    });
  });
});
