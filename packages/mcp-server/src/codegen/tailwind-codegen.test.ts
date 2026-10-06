import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../schemas/generated.js';
import { emit as emitReact } from './react-emitter.js';
import { emit as emitVue } from './vue-emitter.js';
import {
  buildTailwindStaticClasses,
  buildTailwindVariantExpression,
  collectTailwindVariantDefinitions,
  joinUniqueClasses,
} from './tailwind-codegen-utils.js';
import type { UiElement } from '../schemas/generated.js';

// ── Fixtures ────────────────────────────────────────────────────────

const schemaFixture: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'screen-root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'stack-compact' },
      style: { spacingToken: 'inset-default' },
      children: [
        {
          id: 'primary-button',
          component: 'Button',
          props: {
            label: 'Save',
            intent: 'primary',
            size: 'sm',
            disabled: false,
          },
          bindings: {
            onClick: 'handleSave',
          },
        },
        {
          id: 'secondary-button',
          component: 'Button',
          props: {
            label: 'Cancel',
            intent: 'secondary',
            size: 'lg',
          },
        },
      ],
    },
  ],
};

const formSchemaFixture: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'form-root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'stack-default' },
      children: [
        {
          id: 'name-input',
          component: 'TextInput',
          props: {
            label: 'Name',
            placeholder: 'Enter name',
          },
          bindings: {
            onChange: 'handleNameChange',
          },
        },
        {
          id: 'email-input',
          component: 'Input',
          props: {
            label: 'Email',
            type: 'email',
          },
        },
        {
          id: 'submit-btn',
          component: 'Button',
          props: {
            label: 'Submit',
            intent: 'primary',
            size: 'md',
          },
          bindings: {
            onClick: 'handleSubmit',
          },
        },
      ],
    },
  ],
};

// ── React emitter with Tailwind ─────────────────────────────────────

describe('tailwind codegen — React emitter', () => {
  it('emits Tailwind classes and cva variants for React output', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'tailwind' });

    expect(result.status).toBe('ok');
    expect(result.code).toContain("import { cva } from 'class-variance-authority';");
    expect(result.code).toContain('const buttonVariants = cva(');
    expect(result.code).toContain("buttonVariants({ intent: 'primary', size: 'sm' })");
    expect(result.code).toContain('className=');
    expect(result.code).toContain('focus:ring-2');
    expect(result.code).toContain('disabled:opacity-50');
    expect(result.code).not.toContain('style={{');
  });

  it('produces className instead of style for interactive components', () => {
    const result = emitReact(formSchemaFixture, { typescript: true, styling: 'tailwind' });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('className=');
    expect(result.code).not.toContain('style={{');
  });

  it('includes interactive state classes for buttons', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'tailwind' });

    // Interactive components get focus/disabled states
    expect(result.code).toContain('focus:outline-none');
    expect(result.code).toContain('focus:ring-2');
    expect(result.code).toContain('disabled:opacity-50');
    expect(result.code).toContain('disabled:cursor-not-allowed');
  });

  it('includes hover state for intent-bearing components', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'tailwind' });

    // Buttons with intent get hover:bg-<intent>-hover
    expect(result.code).toContain('hover:');
  });

  it('uses .tsx extension when typescript is enabled', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'tailwind' });
    expect(result.fileExtension).toBe('.tsx');
  });

  it('collects cva imports when Tailwind variants are present', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'tailwind' });
    expect(result.imports).toContain('class-variance-authority');
  });
});

// ── Vue emitter with Tailwind ───────────────────────────────────────

describe('tailwind codegen — Vue emitter', () => {
  it('emits Tailwind class bindings and cva variants for Vue output', () => {
    const result = emitVue(schemaFixture, { typescript: true, styling: 'tailwind' });

    expect(result.status).toBe('ok');
    expect(result.code).toContain("import { cva } from 'class-variance-authority';");
    expect(result.code).toContain('const buttonVariants = cva(');
    expect(result.code).toContain("buttonVariants({ intent: 'primary', size: 'sm' })");
    expect(result.code).toContain(':class=');
    expect(result.code).toContain('focus:ring-2');
    expect(result.code).toContain('disabled:opacity-50');
    expect(result.code).not.toContain('style="display:');
  });

  it('produces class attributes instead of style for Vue output', () => {
    const result = emitVue(formSchemaFixture, { typescript: true, styling: 'tailwind' });

    expect(result.status).toBe('ok');
    // Vue emitter uses static class= for simple cases, :class= for variant expressions
    expect(result.code).toContain('class=');
    expect(result.code).not.toContain('style="display:');
  });

  it('includes interactive state classes in Vue template', () => {
    const result = emitVue(schemaFixture, { typescript: true, styling: 'tailwind' });

    expect(result.code).toContain('focus:outline-none');
    expect(result.code).toContain('disabled:cursor-not-allowed');
  });

  it('uses .vue extension', () => {
    const result = emitVue(schemaFixture, { typescript: true, styling: 'tailwind' });
    expect(result.fileExtension).toBe('.vue');
  });

  it('includes script setup block with TypeScript', () => {
    const result = emitVue(schemaFixture, { typescript: true, styling: 'tailwind' });
    expect(result.code).toContain('<script setup');
  });
});

// ── Backward compatibility: styling=tokens ──────────────────────────

describe('tailwind codegen — backward compatibility', () => {
  it('keeps tokens styling as default behavior for React', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'tokens' });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('style={{');
    expect(result.code).not.toContain('className=');
  });

  it('keeps tokens styling as default behavior for Vue', () => {
    const result = emitVue(schemaFixture, { typescript: true, styling: 'tokens' });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('style="display: flex;');
    expect(result.code).not.toContain(':class=');
  });

  it('does not import cva when styling is tokens', () => {
    const reactResult = emitReact(schemaFixture, { typescript: true, styling: 'tokens' });
    const vueResult = emitVue(schemaFixture, { typescript: true, styling: 'tokens' });

    expect(reactResult.code).not.toContain('class-variance-authority');
    expect(vueResult.code).not.toContain('class-variance-authority');
  });

  it('React inline styling unchanged from before Sprint 65', () => {
    const result = emitReact(schemaFixture, { typescript: true, styling: 'inline' });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('style={{');
  });
});

// ── tailwind-codegen-utils unit tests ───────────────────────────────

describe('tailwind-codegen-utils', () => {
  describe('joinUniqueClasses', () => {
    it('deduplicates class names across chunks', () => {
      expect(joinUniqueClasses('bg-primary text-white', 'text-white hover:bg-primary'))
        .toBe('bg-primary text-white hover:bg-primary');
    });

    it('preserves insertion order', () => {
      expect(joinUniqueClasses('a b c', 'd e')).toBe('a b c d e');
    });

    it('handles null and undefined chunks', () => {
      expect(joinUniqueClasses('a', null, undefined, 'b')).toBe('a b');
    });

    it('handles empty strings', () => {
      expect(joinUniqueClasses('', 'a', '')).toBe('a');
    });
  });

  describe('buildTailwindStaticClasses', () => {
    it('includes interactive state classes for interactive components', () => {
      const node: UiElement = {
        id: 'test-btn',
        component: 'Button',
        props: { intent: 'primary' },
        bindings: { onClick: 'handleClick' },
      };

      const result = buildTailwindStaticClasses(node, {});
      expect(result).toContain('focus:ring-2');
      expect(result).toContain('disabled:opacity-50');
      expect(result).toContain('hover:bg-primary-hover');
    });

    it('excludes interactive state classes for non-interactive components', () => {
      const node: UiElement = {
        id: 'test-card',
        component: 'Card',
      };

      const result = buildTailwindStaticClasses(node, {});
      expect(result).not.toContain('focus:ring-2');
      expect(result).not.toContain('disabled:opacity-50');
    });

    it('does not make a structural node interactive solely because it declares a domain action', () => {
      const node: UiElement = {
        id: 'detail-root',
        component: 'Stack',
        bindings: { onEdit: 'handleEdit', onDelete: 'handleDelete' },
      };

      const result = buildTailwindStaticClasses(node, {});
      expect(result).not.toContain('focus:ring-2');
      expect(result).not.toContain('disabled:opacity-50');
      expect(result).not.toContain('hover:opacity-90');
    });

    it('includes variant fallback classes for intent props', () => {
      const node: UiElement = {
        id: 'test-btn',
        component: 'Button',
        props: { intent: 'primary', size: 'lg' },
      };

      const result = buildTailwindStaticClasses(node, {});
      expect(result).toContain('bg-primary');
      expect(result).toContain('text-white');
      expect(result).toContain('text-base');
    });

    it('respects includeInteractiveStates=false', () => {
      const node: UiElement = {
        id: 'test-btn',
        component: 'Button',
        bindings: { onClick: 'handleClick' },
      };

      const result = buildTailwindStaticClasses(node, {}, { includeInteractiveStates: false });
      expect(result).not.toContain('focus:ring-2');
      expect(result).not.toContain('disabled:opacity-50');
    });

    it('respects includeVariantFallback=false', () => {
      const node: UiElement = {
        id: 'test-card',
        component: 'Card',
        props: { intent: 'primary' },
      };

      // Non-interactive component with variant fallback disabled — no intent classes emitted
      const result = buildTailwindStaticClasses(node, {}, {
        includeVariantFallback: false,
        includeInteractiveStates: false,
      });
      expect(result).not.toContain('bg-primary');
    });
  });

  describe('collectTailwindVariantDefinitions', () => {
    it('collects variants from components with 2+ distinct values', () => {
      const screens: UiElement[] = [
        {
          id: 'root',
          component: 'Stack',
          children: [
            {
              id: 'btn-1',
              component: 'Button',
              props: { intent: 'primary', size: 'sm' },
            },
            {
              id: 'btn-2',
              component: 'Button',
              props: { intent: 'secondary', size: 'lg' },
            },
          ],
        },
      ];

      const defs = collectTailwindVariantDefinitions(screens);
      expect(defs.has('Button')).toBe(true);

      const buttonDef = defs.get('Button')!;
      expect(buttonDef.variableName).toBe('buttonVariants');
      expect(buttonDef.variantProps).toContain('intent');
      expect(buttonDef.variantProps).toContain('size');
      expect(buttonDef.definition).toContain('const buttonVariants = cva(');
    });

    it('skips components with only one variant value', () => {
      const screens: UiElement[] = [
        {
          id: 'root',
          component: 'Stack',
          children: [
            {
              id: 'btn-1',
              component: 'Button',
              props: { intent: 'primary' },
            },
            {
              id: 'btn-2',
              component: 'Button',
              props: { intent: 'primary' },
            },
          ],
        },
      ];

      const defs = collectTailwindVariantDefinitions(screens);
      // Only one distinct intent value, no variant definition
      expect(defs.has('Button')).toBe(false);
    });

    it('returns empty map when no variant props are present', () => {
      const screens: UiElement[] = [
        {
          id: 'root',
          component: 'Stack',
          children: [
            { id: 'text-1', component: 'Text' },
            { id: 'text-2', component: 'Text' },
          ],
        },
      ];

      const defs = collectTailwindVariantDefinitions(screens);
      expect(defs.size).toBe(0);
    });
  });

  describe('buildTailwindVariantExpression', () => {
    it('builds variant expression with props', () => {
      const node: UiElement = {
        id: 'btn',
        component: 'Button',
        props: { intent: 'primary', size: 'sm' },
      };

      const definition = {
        variableName: 'buttonVariants',
        definition: 'const buttonVariants = cva(...)',
        variantProps: ['intent', 'size'],
      };

      const result = buildTailwindVariantExpression(node, definition);
      expect(result).toBe("buttonVariants({ intent: 'primary', size: 'sm' })");
    });

    it('returns null when no definition provided', () => {
      const node: UiElement = { id: 'btn', component: 'Button' };
      expect(buildTailwindVariantExpression(node)).toBeNull();
    });

    it('returns null when node has no matching variant props', () => {
      const node: UiElement = {
        id: 'btn',
        component: 'Button',
        props: { label: 'Click' },
      };

      const definition = {
        variableName: 'buttonVariants',
        definition: 'const buttonVariants = cva(...)',
        variantProps: ['intent', 'size'],
      };

      expect(buildTailwindVariantExpression(node, definition)).toBeNull();
    });
  });
});
