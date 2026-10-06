import { describe, expect, it } from 'vitest';

import { FOUNDATION_V1_SHOWCASE_SCHEMA } from '../../test/product-reality/foundation-fixture.s182.js';
import type { UiSchema } from '../schemas/generated.js';
import { handle as generateCode } from '../tools/code.generate.js';
import type { CodegenFramework } from './types.js';
import { preflightTargetContracts } from './target-contracts.js';

function schema(component: string, props: Record<string, unknown>): UiSchema {
  return {
    version: '1.0',
    screens: [{ id: `${component.toLowerCase()}-node`, component, props }],
  };
}

function fieldBoundSchema(
  component: string,
  field: string,
  objectSchema?: NonNullable<UiSchema['objectSchema']>,
): UiSchema {
  const props: Record<string, unknown> = {
    ...(component === 'Tabs'
      ? { items: [{ id: 'details', label: 'Details', panel: 'Details panel' }] }
      : {}),
    field,
  };
  return {
    version: '1.0',
    ...(objectSchema ? { objectSchema } : {}),
    screens: [{ id: `${component.toLowerCase()}-node`, component, props }],
  };
}

function messages(
  component: string,
  props: Record<string, unknown>,
  framework: CodegenFramework = 'react',
): string[] {
  return preflightTargetContracts(schema(component, props), framework)
    .issues
    .map((issue) => issue.message);
}

describe('Sprint 183 target prop value contracts', () => {
  it.each(['react', 'vue'] as const)(
    'keeps the complete foundation-v1 %s fixture inside the shared value contract',
    (framework) => {
      expect(preflightTargetContracts(FOUNDATION_V1_SHOWCASE_SCHEMA, framework).issues).toEqual([]);
    },
  );

  it.each(['react', 'vue'] as const)(
    'blocks a %s build when a canonical boolean prop is encoded as a string',
    async (framework) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: schema('Button', { content: 'Save', disabled: 'not-a-boolean' }),
      });

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.validationReceipt.checks).toContain('props-contract');
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'OODS-V007',
          nodeId: 'button-node',
          component: 'Button',
          message: expect.stringMatching(/disabled.*boolean.*string/i),
        }),
      ]));
    },
  );

  it.each(['react', 'vue'] as const)(
    'blocks a %s build when a cross-target required prop is absent',
    async (framework) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: schema('Tabs', {}),
      });

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.validationReceipt.checks).toContain('props-contract');
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'OODS-V007',
          nodeId: 'tabs-node',
          component: 'Tabs',
          message: expect.stringMatching(/required prop.*items.*missing/i),
        }),
      ]));
    },
  );

  it('accepts representative scalar and string-or-number values', () => {
    expect(messages('Button', {
      content: 7,
      disabled: false,
      size: 'md',
      type: 'button',
    })).toEqual([]);
    expect(messages('DatePicker', {
      id: 'renewal',
      label: 'Renewal',
      defaultValue: '2026-09-30',
      step: 1,
    })).toEqual([]);
    expect(messages('Textarea', {
      id: 'notes',
      label: 'Notes',
      rows: 4,
    })).toEqual([]);
  });

  it('validates nested option, table, tab, and field-validation shapes', () => {
    expect(messages('Select', {
      id: 'plan',
      label: 'Plan',
      options: [{ value: 'pro', label: 'Pro', disabled: false }],
      validation: { state: 'success', message: 'Plan is available.' },
    })).toEqual([]);
    expect(messages('Table', {
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ id: 'row-1', name: 'Northwind', metadata: { active: true } }],
      density: 'compact',
    })).toEqual([]);
    expect(messages('Tabs', {
      items: [{ id: 'details', label: 'Details', panel: 2, isDisabled: false }],
    })).toEqual([]);

    expect(messages('Select', {
      id: 'plan',
      label: 'Plan',
      options: [{ value: 'pro', label: 3 }],
    }).join('\n')).toMatch(/options.*array/i);
    expect(messages('Table', {
      columns: [{ key: 'name', label: 'Name' }],
      rows: { id: 'row-1', name: 'Northwind' },
    }).join('\n')).toMatch(/rows.*string ids/i);
    expect(messages('Tabs', {
      items: [{ id: 'details', label: 'Details', panel: 'Panel', disabled: 'false' }],
    }).join('\n')).toMatch(/items.*disabled/i);
    expect(messages('Input', {
      id: 'email',
      label: 'Email',
      validation: { state: 'info', message: 'Checking.' },
    }).join('\n')).toMatch(/validation.*error.*warning.*success/i);
  });

  it('enforces shared enum and union members rather than accepting arbitrary strings', () => {
    expect(messages('Grid', { columns: 'auto-fit', gap: 'md' })).toEqual([]);
    expect(messages('Grid', { columns: 3, gap: '1rem' })).toEqual([]);
    expect(messages('Card', { as: 'section', elevated: true })).toEqual([]);
    expect(messages('Text', { content: 'Heading', as: 'h2', weight: 'semibold' })).toEqual([]);

    expect(messages('Grid', { columns: 'three' }).join('\n')).toMatch(/columns.*auto-fit/i);
    expect(messages('Button', { size: 'xl' }).join('\n')).toMatch(/size.*sm.*md.*lg/i);
    expect(messages('Card', { as: 'main' }).join('\n')).toMatch(/as.*section/i);
    expect(messages('Table', { density: 'default' }).join('\n')).toMatch(/density.*compact/i);
  });

  it('types cross-target extensions and generic schema/DOM attributes', () => {
    expect(messages('Input', {
      id: 'email',
      label: 'Email',
      name: 'email',
      'aria-hidden': false,
      'data-order': 2,
    })).toEqual([]);

    const invalid = messages('Input', {
      id: 'email',
      field: false,
      label: 'Email',
      name: ['email'],
      'aria-label': { text: 'Email' },
      'data-order': ['second'],
    });
    expect(invalid).toHaveLength(4);
    expect(invalid.join('\n')).toMatch(/aria-label.*received object/i);
    expect(invalid.join('\n')).toMatch(/data-order.*received array/i);
    expect(invalid.join('\n')).toMatch(/field.*string.*boolean/i);
    expect(invalid.join('\n')).toMatch(/name.*string.*array/i);
  });

  it('blocks compile-invalid ARIA values before emitting a build artifact', async () => {
    const result = await generateCode({
      framework: 'react',
      profile: 'build',
      schema: schema('Button', { content: 'Save', 'aria-label': false }),
    });

    expect(result.status).toBe('error');
    expect(result.artifact).toBeUndefined();
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'OODS-V007',
        message: expect.stringMatching(/aria-label.*string.*boolean/i),
      }),
    ]));
  });

  it('does not add Input-only type or placeholder props to a field-bound Select', async () => {
    const result = await generateCode({
      framework: 'react',
      profile: 'build',
      schema: {
        version: '1.0',
        objectSchema: {
          email: {
            type: 'email',
            required: false,
            description: 'Choose an address.',
            enum: ['a@example.com', 'b@example.com'],
          },
        },
        screens: [{ id: 'email-select', component: 'Select', props: { field: 'email' } }],
      },
    });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(result.code).not.toMatch(/<Select[^>]*\s(?:type|placeholder)=/);
    expect(result.code).toContain('options=');
  });

  it.each(
    (['react', 'vue', 'html'] as const).flatMap((framework) => (
      (['build', 'release'] as const).flatMap((profile) => [
        [framework, profile, 'an absent objectSchema', undefined] as const,
        [
          framework,
          profile,
          'an objectSchema that does not declare the referenced field',
          { present: { type: 'string', required: true } },
        ] as const,
      ])
    )),
  )(
    'blocks %s %s output before emission when props.field targets %s',
    async (framework, profile, _case, objectSchema) => {
      const result = await generateCode({
        framework,
        profile,
        schema: fieldBoundSchema('Input', 'missing', objectSchema),
      });

      // A dangling field directive is not harmless metadata: emitting it would
      // silently turn a requested data binding into static target code.
      expect(result.status).toBe('error');
      expect(result.code).toBe('');
      expect(result.artifact).toBeUndefined();
      expect(result.validationReceipt.checks).toContain('props-contract');
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'OODS-V007',
          nodeId: 'input-node',
          component: 'Input',
          message: expect.stringMatching(/field "missing".*does not exist in objectSchema/i),
        }),
      ]));
    },
  );

  it.each(
    (['react', 'vue', 'html'] as const).flatMap((framework) => (
      (['build', 'release'] as const).flatMap((profile) => (
        (['toString', 'constructor'] as const).map((fieldName) => [
          framework,
          profile,
          fieldName,
        ] as const)
      ))
    )),
  )(
    'blocks %s %s when field %s exists only on the object prototype',
    async (framework, profile, fieldName) => {
      const result = await generateCode({
        framework,
        profile,
        schema: fieldBoundSchema('Input', fieldName, {
          present: { type: 'string', required: true },
        }),
      });

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'OODS-V007',
          message: expect.stringMatching(/does not exist in objectSchema/i),
        }),
      ]));
    },
  );

  it.each([
    ['react', 'Input', 'boolean'],
    ['vue', 'Input', 'number'],
    ['react', 'Select', 'object'],
    ['vue', 'Select', 'integer'],
    ['react', 'Textarea', 'boolean'],
    ['vue', 'Textarea', 'number'],
    ['react', 'DatePicker', 'boolean'],
    ['vue', 'DatePicker', 'number'],
    ['react', 'Checkbox', 'string'],
    ['vue', 'Checkbox', 'integer'],
  ] as const)(
    'blocks a %s %s build when the %s field cannot type-check at its generated prop',
    async (framework, component, fieldType) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: fieldBoundSchema(component, 'value', {
          value: { type: fieldType, required: true },
        }),
      });

      // These pairs produce an invalid target assignment (for example,
      // boolean -> React Input.value or number -> Vue Input.modelValue), so
      // accepting them would defer a deterministic compiler failure to users.
      expect(result.status).toBe('error');
      expect(result.code).toBe('');
      expect(result.artifact).toBeUndefined();
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'OODS-V007',
          nodeId: `${component.toLowerCase()}-node`,
          component,
          message: expect.stringMatching(
            new RegExp(`field "value".*${fieldType === 'integer' ? 'number' : fieldType}.*${framework} target`, 'i'),
          ),
        }),
      ]));
    },
  );

  it.each([
    ['react', 'Input', 'number'],
    ['vue', 'Input', 'email'],
    ['react', 'Select', 'integer'],
    ['react', 'Select', 'boolean'],
    ['vue', 'Select', 'string'],
    ['vue', 'Select', 'boolean'],
    ['react', 'Textarea', 'number'],
    ['vue', 'Textarea', 'string'],
    ['react', 'DatePicker', 'number'],
    ['vue', 'DatePicker', 'date'],
    ['react', 'Checkbox', 'boolean'],
    ['vue', 'Checkbox', 'boolean'],
  ] as const)(
    'emits a %s %s build when its %s field is assignable to the generated target prop',
    async (framework, component, fieldType) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: fieldBoundSchema(component, 'value', {
          value: { type: fieldType, required: true },
        }),
      });

      // Keep the negative matrix honest: the gate must reject incompatible
      // assignments without collapsing all field-bound generation to errors.
      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.artifact).toEqual(expect.objectContaining({ framework }));
      expect(result.errors).toBeUndefined();
    },
  );

  it.each(['react', 'vue', 'html'] as const)(
    'blocks a %s Tabs field binding because no target emitter represents it',
    async (framework) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: fieldBoundSchema('Tabs', 'selected', {
          selected: { type: 'string', required: true },
        }),
      });

      // Tabs selection is driven by items/defaultSelectedId today. Treating a
      // generic field directive as selectedId would claim a binding the emitter
      // currently discards, even though the source field itself is a string.
      expect(result.status).toBe('error');
      expect(result.code).toBe('');
      expect(result.artifact).toBeUndefined();
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'OODS-V007',
          nodeId: 'tabs-node',
          component: 'Tabs',
          message: expect.stringMatching(/field "selected".*cannot be represented.*discard/i),
        }),
      ]));
    },
  );

  it('reports multiple invalid prop values in deterministic prop-name order', () => {
    expect(messages('Button', {
      type: 'link',
      size: 'xl',
      disabled: 'false',
    })).toEqual([
      'Prop "disabled" on Button must be a boolean; received string.',
      // s222-m02 (#2502 ruling 9): a button also has the 24px xs size.
      'Prop "size" on Button must be "xs" or "sm" or "md" or "lg"; received string.',
      'Prop "type" on Button must be "button" or "submit" or "reset"; received string.',
    ]);
  });

  // s223-m02 (#2527 ruling 10): a SegmentedControl offers two to five of Select's options at the four control sizes, and
  // React's public props require options, as they require a Tabs' items.
  it('holds a SegmentedControl to two to five options at the control sizes', () => {
    const options = [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly', disabled: true }];
    const base = { id: 'period', label: 'Billing period' };
    expect(messages('SegmentedControl', { ...base, options, value: 'monthly', defaultValue: 'yearly', name: 'period', size: 'xs', disabled: false })).toEqual([]);
    expect(messages('SegmentedControl', { ...base, options: options.slice(0, 1) }).join('\n')).toMatch(/options.*2 to 5/);
    expect(messages('SegmentedControl', { ...base, options: [...options, ...options, ...options] }).join('\n')).toMatch(/options.*2 to 5/);
    expect(messages('SegmentedControl', { ...base, options: [{ value: 'monthly', label: 1 }, options[1]] }).join('\n')).toMatch(/options.*2 to 5/);
    expect(messages('SegmentedControl', { ...base, options, size: 'xl' }).join('\n')).toMatch(/size.*"xs" or "sm" or "md" or "lg"/);
    expect(messages('SegmentedControl', base).join('\n')).toMatch(/Required prop "options"/);
  });
});
