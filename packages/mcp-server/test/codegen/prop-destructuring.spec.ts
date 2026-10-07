/**
 * Prop destructuring/binding tests (s74-m03).
 *
 * Verifies that all three emitters generate code where object field
 * props are properly destructured/declared so the output compiles
 * without manual repair.
 */
import { describe, it, expect } from 'vitest';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import type { UiSchema, FieldSchemaEntry } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const objectSchema: Record<string, FieldSchemaEntry> = {
  name: { type: 'string', required: true, description: 'Product name' },
  price: { type: 'number', required: true, description: 'Price in cents' },
  inventory_status: {
    type: 'string',
    required: true,
    description: 'Inventory status',
    enum: ['in_stock', 'low_stock', 'backorder'],
  },
  sku: { type: 'string', required: true, description: 'SKU code' },
  is_active: { type: 'boolean', required: false, description: 'Whether active' },
};

const schema: UiSchema = {
  version: '2026.02',
  objectSchema,
  screens: [{
    id: 'screen',
    component: 'Stack',
    children: [
      { id: 'name-text', component: 'Text', props: { field: 'name' } },
      { id: 'price-display', component: 'Text', props: { field: 'price' } },
      { id: 'status-badge', component: 'StatusBadge', props: { field: 'inventory_status' } },
      { id: 'sku-input', component: 'Input', props: { field: 'sku' } },
      { id: 'active-toggle', component: 'Toggle', props: { field: 'is_active' } },
    ],
  }],
};

const tsTokensOpts: CodegenOptions = { typescript: true, styling: 'tokens' };
const tsTailwindOpts: CodegenOptions = { typescript: true, styling: 'tailwind' };

/* ------------------------------------------------------------------ */
/*  React emitter                                                      */
/* ------------------------------------------------------------------ */

describe('React emitter — prop destructuring', () => {
  it('destructures all objectSchema fields in component function', () => {
    const result = reactEmit(schema, tsTokensOpts);
    expect(result.status).toBe('ok');

    // All camelCase field names should appear in the destructuring
    expect(result.code).toContain('inventoryStatus');
    expect(result.code).toContain('isActive');
    expect(result.code).toContain('name');
    expect(result.code).toContain('price');
    expect(result.code).toContain('sku');

    // Should destructure in the function params (not just in PageProps)
    expect(result.code).toMatch(/= \(\{[^}]*name[^}]*\}\) =>/);
  });

  it('generates PageProps interface with typed fields', () => {
    const result = reactEmit(schema, tsTokensOpts);
    expect(result.code).toContain('export interface PageProps');
    expect(result.code).toContain('name: string');
    expect(result.code).toContain('price: number');
    // Enum type should be a union
    expect(result.code).toContain("'in_stock' | 'low_stock' | 'backorder'");
    expect(result.code).toContain('isActive?: boolean');
  });

  it('JSX references field variables that are destructured from props', () => {
    const result = reactEmit(schema, tsTokensOpts);
    // Destructured numeric values meet Text's string child contract.
    expect(result.code).toContain('{name}');
    expect(result.code).toContain("{String(price ?? '')}");
  });

  it('omits destructuring when no objectSchema', () => {
    const plainSchema: UiSchema = {
      version: '2026.02',
      screens: [{ id: 'root', component: 'Box' }],
    };
    const result = reactEmit(plainSchema, tsTokensOpts);
    expect(result.code).toContain('= () => {');
  });
});

/* ------------------------------------------------------------------ */
/*  Vue emitter                                                        */
/* ------------------------------------------------------------------ */

describe('Vue emitter — prop binding', () => {
  it('generates ref() bindings for form schemas (Input/Toggle present)', () => {
    const result = vueEmit(schema, tsTailwindOpts);
    expect(result.status).toBe('ok');

    // Form schemas use ref() reactivity instead of defineProps
    expect(result.code).toContain("import { ref } from 'vue'");
    expect(result.code).toContain('ref<');
    expect(result.code).toContain('inventoryStatus');
    expect(result.code).toContain('name');
  });

  it('generates defineProps for display-only schemas', () => {
    const displaySchema: UiSchema = {
      version: '2026.02',
      objectSchema,
      screens: [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'name-text', component: 'Text', props: { field: 'name' } },
          { id: 'price-display', component: 'Text', props: { field: 'price' } },
          { id: 'status-badge', component: 'StatusBadge', props: { field: 'inventory_status' } },
        ],
      }],
    };
    const result = vueEmit(displaySchema, tsTailwindOpts);
    expect(result.code).toContain('interface Props');
    expect(result.code).toContain('name: string');
    expect(result.code).toContain('price: number');
  });

  it('template uses field references', () => {
    const result = vueEmit(schema, tsTailwindOpts);
    // Vue template: {{ name }} for children content
    expect(result.code).toContain('{{ name }}');
  });
});

/* ------------------------------------------------------------------ */
/*  HTML emitter                                                       */
/* ------------------------------------------------------------------ */

describe('HTML emitter — bound sample values', () => {
  it('renders bound sample values for field-bound components', () => {
    const result = htmlEmit(schema, tsTokensOpts);
    expect(result.status).toBe('ok');

    // Resolved values replace legacy placeholder markers.
    expect(result.code).not.toContain('data-bind="name"');
    expect(result.code).not.toContain('data-bind="price"');
    expect(result.code).not.toContain('data-bind="status:inventoryStatus"');
  });

  it('has neither bracket placeholders nor raw template vars', () => {
    const result = htmlEmit(schema, tsTokensOpts);
    // Bracket placeholders cannot masquerade as record values.
    expect(result.code).not.toContain('[name]');
    expect(result.code).not.toContain('[price]');
    // No raw {{...}} template vars
    expect(result.code).not.toContain('{{name}}');
    expect(result.code).not.toContain('{{price}}');
  });
});
