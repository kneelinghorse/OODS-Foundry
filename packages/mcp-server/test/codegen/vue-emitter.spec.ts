/**
 * Contract tests for the Vue SFC emitter (s63-m03).
 *
 * Validates:
 * 1. Basic SFC output structure (template + script + optional style)
 * 2. Typed defineProps from objectSchema when present
 * 3. Field type mapping consistent with React emitter
 * 4. Required vs optional field handling
 * 5. Enum fields generate union literal types
 * 6. Backward compatibility — no objectSchema = empty defineProps skeleton
 */
import { describe, it, expect } from 'vitest';
import { emit } from '../../src/codegen/vue-emitter.js';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const defaultOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

function makeSchema(...screens: UiElement[]): UiSchema {
  return { version: '1.0', screens };
}

function makeSchemaWithObjectSchema(
  objectSchema: Record<string, FieldSchemaEntry>,
  ...screens: UiElement[]
): UiSchema {
  return { version: '1.0', screens, objectSchema };
}

describe('vue-emitter — basic output', () => {
  it('generates valid Vue 3 SFC structure', () => {
    const schema = makeSchema({ id: 'root', component: 'Box' });
    const result = emit(schema, defaultOpts);
    expect(result.status).toBe('ok');
    expect(result.framework).toBe('vue');
    expect(result.fileExtension).toBe('.vue');
    expect(result.code).toContain('<template>');
    expect(result.code).toContain('</template>');
    expect(result.code).toContain('<script setup lang="ts">');
    expect(result.code).toContain('</script>');
  });

  it('includes component imports', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Card',
      children: [{ id: 'btn', component: 'Button' }],
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain("import { Button, Card } from '@oods/components-vue';");
  });
});

describe('vue-emitter — typed defineProps (s63-m03)', () => {
  it('generates typed Props interface and defineProps when objectSchema present', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        name: { type: 'string', required: true, description: 'User name' },
        age: { type: 'integer', required: false, description: 'User age' },
      },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('interface Props');
    expect(result.code).toContain('name: string;');
    expect(result.code).toContain('age?: number;');
    expect(result.code).toContain('defineProps<Props>();');
  });

  it('maps field types to TypeScript types correctly', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        id: { type: 'string', required: true },
        count: { type: 'integer', required: true },
        price: { type: 'number', required: true },
        active: { type: 'boolean', required: true },
        created_at: { type: 'datetime', required: true },
        email: { type: 'email', required: false },
      },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('id: string;');
    expect(result.code).toContain('count: number;');
    expect(result.code).toContain('price: number;');
    expect(result.code).toContain('active: boolean;');
    expect(result.code).toContain('createdAt: string;');
    expect(result.code).toContain('email?: string;');
  });

  it('generates union literal type for enum fields', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        status: {
          type: 'string',
          required: true,
          enum: ['active', 'paused', 'terminated'],
        },
      },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain("status: 'active' | 'paused' | 'terminated';");
  });

  it('marks required fields as non-optional and optional fields with ?', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        required_field: { type: 'string', required: true },
        optional_field: { type: 'string', required: false },
      },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('requiredField: string;');
    expect(result.code).toContain('optionalField?: string;');
  });

  it('includes JSDoc comments for fields with descriptions', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        name: { type: 'string', required: true, description: 'User display name' },
      },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('/** User display name */');
  });

  it('converts snake_case field names to camelCase', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        first_name: { type: 'string', required: true },
        last_login_at: { type: 'datetime', required: false },
      },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('firstName: string;');
    expect(result.code).toContain('lastLoginAt?: string;');
  });

  it('without objectSchema, defineProps remains empty skeleton', () => {
    const schema = makeSchema({ id: 'root', component: 'Box' });
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('defineProps<{');
    expect(result.code).toContain('// Props can be extended here');
    expect(result.code).not.toContain('interface Props');
  });

  it('does not generate typed Props when typescript=false', () => {
    const schema = makeSchemaWithObjectSchema(
      { name: { type: 'string', required: true } },
      { id: 'root', component: 'Box' },
    );
    const result = emit(schema, { typescript: false, styling: 'tokens' });
    expect(result.code).not.toContain('interface Props');
    expect(result.code).not.toContain('defineProps');
  });

  it('valid Vue 3 Composition API output structure', () => {
    const schema = makeSchemaWithObjectSchema(
      {
        name: { type: 'string', required: true },
        status: { type: 'string', required: true, enum: ['active', 'inactive'] },
      },
      { id: 'root', component: 'Card' },
    );
    const result = emit(schema, defaultOpts);
    // Verify SFC block ordering: template → script → style
    const templateIdx = result.code.indexOf('<template>');
    const scriptIdx = result.code.indexOf('<script setup');
    expect(templateIdx).toBeLessThan(scriptIdx);
    // Script block should have Props interface before defineProps
    const propsIdx = result.code.indexOf('interface Props');
    const defineIdx = result.code.indexOf('defineProps<Props>()');
    expect(propsIdx).toBeLessThan(defineIdx);
  });
});

describe('vue-emitter — propSchema default value wiring (s63-m02)', () => {
  it('does not redeclare schema field names already declared via defineProps or ref()', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [
        {
          id: 'root',
          component: 'StatusBadge',
          props: { status: 'active', priority: 3 },
        },
      ],
      objectSchema: {
        status: { type: 'string', required: true, enum: ['active', 'paused', 'terminated'] },
        priority: { type: 'integer', required: false },
      },
    };
    const result = emit(schema, defaultOpts);
    // These are declared via defineProps or ref() — must NOT be redeclared as const
    expect(result.code).not.toContain("const status = 'active';");
    expect(result.code).not.toContain('const priority = 3;');
    // But the props should still appear on the template element
    expect(result.code).toContain('status="active"');
  });

  it('does not redeclare boolean schema fields as const', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [
        {
          id: 'root',
          component: 'Toggle',
          props: { active: true },
        },
      ],
      objectSchema: {
        active: { type: 'boolean', required: true },
      },
    };
    const result = emit(schema, defaultOpts);
    // 'active' is declared via ref() — must not be redeclared
    expect(result.code).not.toContain('const active = true;');
  });

  it('does not redeclare schema fields in script setup', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [
        {
          id: 'root',
          component: 'Card',
          props: { name: 'Default' },
        },
      ],
      objectSchema: {
        name: { type: 'string', required: true },
      },
    };
    const result = emit(schema, defaultOpts);
    // 'name' is a UI-reserved prop name AND a schema field — no const redeclaration
    expect(result.code).not.toContain("const name = 'Default';");
  });

  it('does not emit prop defaults without objectSchema', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Card',
      props: { name: 'Default' },
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).not.toContain("const name = 'Default';");
  });

  it('does not redeclare schema fields from nested children', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [
        {
          id: 'root',
          component: 'Page',
          children: [
            {
              id: 'badge',
              component: 'StatusBadge',
              props: { status: 'paused' },
            },
          ],
        },
      ],
      objectSchema: {
        status: { type: 'string', required: true, enum: ['active', 'paused'] },
      },
    };
    const result = emit(schema, defaultOpts);
    // 'status' is a UI-reserved name AND a schema field — must not be redeclared
    expect(result.code).not.toContain("const status = 'paused';");
  });

  it('ignores element props that do not match objectSchema fields', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [
        {
          id: 'root',
          component: 'Card',
          props: { label: 'Hello', status: 'active' },
        },
      ],
      objectSchema: {
        status: { type: 'string', required: true },
      },
    };
    const result = emit(schema, defaultOpts);
    // 'label' is not in objectSchema and is a UI-reserved name — no default
    expect(result.code).not.toContain("const label = 'Hello';");
    // 'status' is a schema field AND a UI-reserved name — no const redeclaration
    expect(result.code).not.toContain("const status = 'active';");
  });
});

describe('vue-emitter — typed action protocol (s183-m02)', () => {
  it('emits screen bindings as required domain actions with generated action controls', () => {
    const schema = makeSchema({
      id: 'form-root',
      component: 'Form',
      bindings: { onSubmit: 'handleSubmit', onChange: 'handleChange' },
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('handleSubmit: () => void;');
    expect(result.code).toContain('handleChange: () => void;');
    expect(result.code).toContain('/* @oods-domain-binding handleSubmit */');
    expect(result.code).toContain('actions.handleSubmit();');
    expect(result.code).toContain('data-oods-screen-actions="form-root"');
    expect(result.code).toContain('data-oods-action="handleSubmit"');
    // s211-m02: screen actions are the design system's Button, which emits activate.
    expect(result.code).toContain('@activate="handleSubmit()"');
    expect(result.code).toContain('>Submit</Button>');
    expect(result.code).not.toMatch(/TODO|=>\s*\{\s*\}/);
  });

  it('keeps semantic screen bindings off component events while rendering controls', () => {
    const schema = makeSchema({
      id: 'form-root',
      component: 'Form',
      bindings: { onSubmit: 'handleSubmit' },
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).not.toContain('@submit="handleSubmit"');
    expect(result.code).toContain('data-oods-action="handleSubmit"');
    expect(result.code).toContain('@activate="handleSubmit()"');
    expect(result.actions).toEqual([{
      name: 'handleSubmit',
      parameters: [],
      sources: [{ nodeId: 'form-root', component: 'Form', event: 'onSubmit' }],
    }]);
  });

  it('declares typed list context actions', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'ListView',
      bindings: { onRowClick: 'handleRowClick', onSort: 'handleSort' },
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('handleRowClick: (rowId: string) => void;');
    expect(result.code).toContain('handleSort: (column: string) => void;');
    // s221-m01: as React since s216-m05 (#2412), Vue invents no operand for an action that needs the application's input.
    expect(result.code).not.toMatch(/@activate="handleRowClick\(/);
    expect(result.code).not.toMatch(/@activate="handleSort\(/);
    expect(result.code).toContain('disabled title="This action needs input from your application."');
  });

  it('declares detail context actions', () => {
    const schema = makeSchema({
      id: 'detail-root',
      component: 'DetailView',
      bindings: { onEdit: 'handleEdit', onDelete: 'handleDelete' },
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('handleEdit: () => void;');
    expect(result.code).toContain('handleDelete: () => void;');
  });

  it('runtime requirements are checked inside script setup', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Form',
      bindings: { onSubmit: 'handleSubmit' },
    });
    const result = emit(schema, defaultOpts);
    const scriptStart = result.code.indexOf('<script setup');
    const guardIdx = result.code.indexOf("typeof actions.handleSubmit !== 'function'");
    const scriptEnd = result.code.indexOf('</script>');
    expect(guardIdx).toBeGreaterThan(scriptStart);
    expect(guardIdx).toBeLessThan(scriptEnd);
  });

  it('collects bindings from nested children', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Form',
      bindings: { onSubmit: 'handleSubmit' },
      children: [
        {
          id: 'field',
          component: 'Input',
          bindings: { onChange: 'handleFieldChange' },
        },
      ],
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).toContain('handleSubmit: () => void;');
    expect(result.code).toContain('const handleFieldChange');
  });

  it('no handler stubs when no bindings present', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Box',
    });
    const result = emit(schema, defaultOpts);
    expect(result.code).not.toContain('const handle');
  });

  it('emits a runtime-required checked JSDoc contract when typescript=false', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Form',
      bindings: { onSubmit: 'handleSubmit' },
    });
    const result = emit(schema, { typescript: false, styling: 'tokens' });
    expect(result.code).toContain('@typedef {{ handleSubmit: () => void }} GeneratedUIActions');
    expect(result.code).toContain("typeof actions.handleSubmit !== 'function'");
    expect(result.code).not.toContain(': Event');
  });
});

describe('vue-emitter — interactive Tailwind guard (s71-m05)', () => {
  const tailwindOpts: CodegenOptions = { typescript: true, styling: 'tailwind' };

  it('non-interactive elements (Stack, Card, Text) have no hover/focus/disabled classes', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Stack',
      children: [
        { id: 'card', component: 'Card', props: { variant: 'primary' } },
        { id: 'text', component: 'Text', props: { intent: 'info' } },
      ],
    });
    const result = emit(schema, tailwindOpts);
    // Extract class attributes for non-interactive elements
    const lines = result.code.split('\n');
    for (const line of lines) {
      if (line.includes('data-oods-component="Stack"') ||
          line.includes('data-oods-component="Card"') ||
          line.includes('data-oods-component="Text"')) {
        expect(line).not.toContain('hover:');
        expect(line).not.toContain('focus:');
        expect(line).not.toContain('disabled:');
      }
    }
  });

  it('interactive elements (Button, Input, Select) retain hover/focus/disabled classes', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Stack',
      children: [
        { id: 'btn', component: 'Button', props: { variant: 'primary' } },
        { id: 'inp', component: 'Input', props: { name: 'email' } },
        { id: 'sel', component: 'Select', props: { name: 'role' } },
      ],
    });
    const result = emit(schema, tailwindOpts);
    const lines = result.code.split('\n');
    for (const line of lines) {
      if (line.includes('data-oods-component="Button"')) {
        expect(line).toContain('hover:');
        expect(line).toContain('focus:');
        expect(line).toContain('disabled:');
      }
    }
  });

  it('Tabs container has no interactive utilities', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Tabs',
      props: { tabs: [{ id: 'a', label: 'A' }] },
    });
    const result = emit(schema, tailwindOpts);
    const lines = result.code.split('\n');
    for (const line of lines) {
      if (line.includes('data-oods-component="Tabs"')) {
        expect(line).not.toContain('hover:');
        expect(line).not.toContain('focus:');
        expect(line).not.toContain('disabled:');
      }
    }
  });

  it('unsupported bindings do not make arbitrary elements interactive', () => {
    const schema = makeSchema({
      id: 'root',
      component: 'Box',
      bindings: { onClick: 'handleClick' },
    });
    const result = emit(schema, tailwindOpts);
    const lines = result.code.split('\n');
    for (const line of lines) {
      if (line.includes('data-oods-component="Box"')) {
        expect(line).not.toContain('focus:');
      }
    }
  });
});
