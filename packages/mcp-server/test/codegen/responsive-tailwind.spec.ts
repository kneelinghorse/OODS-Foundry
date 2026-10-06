/**
 * Tests for responsive Tailwind variant generation (s80-m05).
 *
 * Validates:
 * 1. CVA variant definitions include responsive size variants (sm:, md:, lg:)
 * 2. Grid/sidebar layouts emit responsive column classes
 * 3. Inline layouts emit responsive flex-direction classes
 * 4. Responsive patterns applied consistently across React and Vue emitters
 * 5. Existing non-responsive behavior preserved (inline/tokens styling)
 */
import { describe, it, expect } from 'vitest';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import {
  responsiveLayoutClasses,
  collectTailwindVariantDefinitions,
} from '../../src/codegen/tailwind-codegen-utils.js';
import type { UiSchema, UiElement } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const tailwindOpts: CodegenOptions = { typescript: true, styling: 'tailwind' };
const tokenOpts: CodegenOptions = { typescript: true, styling: 'tokens' };
const inlineOpts: CodegenOptions = { typescript: true, styling: 'inline' };

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const gridSchema: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'grid-root',
    component: 'Stack',
    layout: { type: 'grid', gapToken: 'md' },
    children: [
      { id: 'card-1', component: 'Card', props: { label: 'A' } },
      { id: 'card-2', component: 'Card', props: { label: 'B' } },
      { id: 'card-3', component: 'Card', props: { label: 'C' } },
      { id: 'card-4', component: 'Card', props: { label: 'D' } },
    ],
  }],
};

const sidebarSchema: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'layout-root',
    component: 'Stack',
    layout: { type: 'sidebar' },
    children: [
      { id: 'main', component: 'Card', children: [
        { id: 'text', component: 'Text', props: { content: 'Main' } },
      ]},
      { id: 'aside', component: 'Badge', props: { label: 'Side' } },
    ],
  }],
};

const inlineSchema: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'row-root',
    component: 'Stack',
    layout: { type: 'inline', align: 'center' },
    children: [
      { id: 'btn-1', component: 'Button', props: { label: 'Save' } },
      { id: 'btn-2', component: 'Button', props: { label: 'Cancel' } },
    ],
  }],
};

const stackSchema: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'stack-root',
    component: 'Stack',
    layout: { type: 'stack' },
    children: [
      { id: 'text-1', component: 'Text', props: { content: 'Hello' } },
    ],
  }],
};

const cvaSchema: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'cva-root',
    component: 'Stack',
    layout: { type: 'stack' },
    children: [
      { id: 'btn-sm', component: 'Button', props: { label: 'Small', size: 'sm' } },
      { id: 'btn-lg', component: 'Button', props: { label: 'Large', size: 'lg' } },
    ],
  }],
};

/* ------------------------------------------------------------------ */
/*  responsiveLayoutClasses() unit tests                               */
/* ------------------------------------------------------------------ */

describe('responsiveLayoutClasses — unit', () => {
  it('returns responsive grid classes for grid layout', () => {
    const result = responsiveLayoutClasses({ type: 'grid' });
    expect(result).toContain('grid-cols-1');
    expect(result).toContain('md:grid-cols-2');
    expect(result).toContain('lg:grid-cols-4');
  });

  it('returns responsive sidebar classes for sidebar layout', () => {
    const result = responsiveLayoutClasses({ type: 'sidebar' });
    expect(result).toContain('grid-cols-1');
    expect(result).toContain('md:grid-cols-');
  });

  it('returns responsive flex classes for inline layout', () => {
    const result = responsiveLayoutClasses({ type: 'inline' });
    expect(result).toContain('flex-col');
    expect(result).toContain('sm:flex-row');
  });

  it('returns empty string for stack layout', () => {
    const result = responsiveLayoutClasses({ type: 'stack' });
    expect(result).toBe('');
  });

  it('returns empty string for undefined layout', () => {
    expect(responsiveLayoutClasses(undefined)).toBe('');
    expect(responsiveLayoutClasses({})).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/*  CVA responsive size variants                                       */
/* ------------------------------------------------------------------ */

describe('CVA — responsive size variants', () => {
  it('generates CVA with responsive size classes', () => {
    const defs = collectTailwindVariantDefinitions(cvaSchema.screens);
    const buttonDef = defs.get('Button');
    expect(buttonDef).toBeDefined();
    expect(buttonDef!.definition).toContain('cva(');
    // Should include responsive breakpoint prefixes for size
    expect(buttonDef!.definition).toContain('sm:');
  });

  it('sm size variant includes sm: breakpoint prefix', () => {
    const defs = collectTailwindVariantDefinitions(cvaSchema.screens);
    const def = defs.get('Button')!;
    expect(def.definition).toContain('sm:text-sm');
  });

  it('lg size variant includes lg: breakpoint prefix', () => {
    const defs = collectTailwindVariantDefinitions(cvaSchema.screens);
    const def = defs.get('Button')!;
    expect(def.definition).toContain('lg:text-lg');
  });
});

/* ------------------------------------------------------------------ */
/*  React emitter — responsive layout classes                          */
/* ------------------------------------------------------------------ */

describe('React emitter — responsive grid layout', () => {
  it('emits responsive grid-cols classes in Tailwind mode', () => {
    const result = reactEmit(gridSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('grid-cols-1');
    expect(result.code).toContain('md:grid-cols-2');
    expect(result.code).toContain('lg:grid-cols-4');
  });

  it('does NOT emit responsive classes in tokens mode', () => {
    const result = reactEmit(gridSchema, tokenOpts);
    expect(result.status).toBe('ok');
    expect(result.code).not.toContain('grid-cols-1');
    expect(result.code).not.toContain('md:grid-cols-2');
  });

  it('emits responsive sidebar classes in Tailwind mode', () => {
    const result = reactEmit(sidebarSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('md:grid-cols-');
  });

  it('emits responsive inline flex classes in Tailwind mode', () => {
    const result = reactEmit(inlineSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('flex-col');
    expect(result.code).toContain('sm:flex-row');
  });

  it('does NOT emit responsive classes for stack layout', () => {
    const result = reactEmit(stackSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).not.toContain('md:');
    expect(result.code).not.toContain('lg:');
    expect(result.code).not.toContain('sm:');
  });
});

/* ------------------------------------------------------------------ */
/*  Vue emitter — responsive layout classes                            */
/* ------------------------------------------------------------------ */

describe('Vue emitter — responsive grid layout', () => {
  it('emits responsive grid-cols classes in Tailwind mode', () => {
    const result = vueEmit(gridSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('grid-cols-1');
    expect(result.code).toContain('md:grid-cols-2');
    expect(result.code).toContain('lg:grid-cols-4');
  });

  it('does NOT emit responsive classes in inline mode', () => {
    const result = vueEmit(gridSchema, inlineOpts);
    expect(result.status).toBe('ok');
    expect(result.code).not.toContain('grid-cols-1');
    expect(result.code).not.toContain('md:grid-cols-2');
  });

  it('emits responsive sidebar classes in Tailwind mode', () => {
    const result = vueEmit(sidebarSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('md:grid-cols-');
  });

  it('emits responsive inline flex classes in Tailwind mode', () => {
    const result = vueEmit(inlineSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('flex-col');
    expect(result.code).toContain('sm:flex-row');
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-framework parity — responsive classes                        */
/* ------------------------------------------------------------------ */

describe('cross-framework — responsive parity', () => {
  it('React and Vue both contain identical responsive grid classes', () => {
    const react = reactEmit(gridSchema, tailwindOpts);
    const vue = vueEmit(gridSchema, tailwindOpts);

    for (const cls of ['grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4']) {
      expect(react.code).toContain(cls);
      expect(vue.code).toContain(cls);
    }
  });

  it('React and Vue both contain responsive inline classes', () => {
    const react = reactEmit(inlineSchema, tailwindOpts);
    const vue = vueEmit(inlineSchema, tailwindOpts);

    expect(react.code).toContain('flex-col');
    expect(vue.code).toContain('flex-col');
    expect(react.code).toContain('sm:flex-row');
    expect(vue.code).toContain('sm:flex-row');
  });

  it('HTML emitter still works without responsive classes (uses inline styles)', () => {
    const result = htmlEmit(gridSchema, tailwindOpts);
    expect(result.status).toBe('ok');
    expect(result.code).not.toContain('grid-cols-1');
  });
});
