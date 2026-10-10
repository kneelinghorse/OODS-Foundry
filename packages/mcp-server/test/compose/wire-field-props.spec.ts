import { describe, expect, it } from 'vitest';
import { wireFieldProps } from '../../src/compose/object-slot-filler.js';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../../src/schemas/generated.js';

function makeSchema(screens: UiElement[], objectSchema?: Record<string, FieldSchemaEntry>): UiSchema {
  return {
    version: '2026.02',
    screens,
    ...(objectSchema ? { objectSchema } : {}),
  };
}

function findAllElements(schema: UiSchema, predicate: (el: UiElement) => boolean): UiElement[] {
  const found: UiElement[] = [];
  const walk = (el: UiElement) => {
    if (predicate(el)) found.push(el);
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return found;
}

describe('wireFieldProps', () => {
  it('sets props.field on leaf components matching objectSchema fields', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'name-text', component: 'Text' },
          { id: 'status-badge', component: 'StatusBadge' },
          { id: 'price-input', component: 'Input' },
        ],
      }],
      {
        name: { type: 'string', required: true, description: 'Product name' },
        status: { type: 'string', required: true, enum: ['active', 'inactive'] },
        price: { type: 'number', required: false },
      },
    );

    const bound = wireFieldProps(schema);

    expect(bound).toBe(3);

    const textEl = findAllElements(schema, (el) => el.component === 'Text')[0];
    expect(textEl.props?.field).toBe('name');

    const badgeEl = findAllElements(schema, (el) => el.component === 'StatusBadge')[0];
    expect(badgeEl.props?.field).toBe('status');

    const inputEl = findAllElements(schema, (el) => el.component === 'Input')[0];
    expect(inputEl.props?.field).toBe('price');
  });

  it('returns 0 when no objectSchema', () => {
    const schema = makeSchema([{
      id: 'screen',
      component: 'Text',
    }]);

    expect(wireFieldProps(schema)).toBe(0);
  });

  it('skips layout components (strategy=none)', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'grid', component: 'Grid' },
          { id: 'card', component: 'Card' },
        ],
      }],
      { name: { type: 'string', required: true } },
    );

    expect(wireFieldProps(schema)).toBe(0);
  });

  it('assigns each field to at most one component', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'text1', component: 'Text' },
          { id: 'text2', component: 'Text' },
        ],
      }],
      {
        name: { type: 'string', required: true },
      },
    );

    const bound = wireFieldProps(schema);
    expect(bound).toBe(1);

    const texts = findAllElements(schema, (el) => el.component === 'Text');
    const fieldsAssigned = texts.filter((el) => el.props?.field).length;
    expect(fieldsAssigned).toBe(1);
  });

  it('prioritizes required fields', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'text1', component: 'Text' },
        ],
      }],
      {
        optional_field: { type: 'string', required: false },
        required_field: { type: 'string', required: true },
      },
    );

    wireFieldProps(schema);

    const text = findAllElements(schema, (el) => el.component === 'Text')[0];
    expect(text.props?.field).toBe('required_field');
  });

  it('enum fields prefer status-prop and label-prop components', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'badge', component: 'StatusBadge' },
          { id: 'text', component: 'Text' },
        ],
      }],
      {
        status: { type: 'string', required: true, enum: ['active', 'paused', 'cancelled'] },
        name: { type: 'string', required: true },
      },
    );

    wireFieldProps(schema);

    const badge = findAllElements(schema, (el) => el.component === 'StatusBadge')[0];
    expect(badge.props?.field).toBe('status');

    const text = findAllElements(schema, (el) => el.component === 'Text')[0];
    expect(text.props?.field).toBe('name');
  });

  it('preserves existing props when adding field', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'badge', component: 'Badge', props: { tone: 'info' } },
        ],
      }],
      { label: { type: 'string', required: true } },
    );

    wireFieldProps(schema);

    const badge = findAllElements(schema, (el) => el.component === 'Badge')[0];
    expect(badge.props?.field).toBe('label');
    expect(badge.props?.tone).toBe('info');
  });

  it('turns enum values into Select option records while preserving explicitly authored choices', () => {
    const authoredOptions = [{ value: 'admin', label: 'Administrator', disabled: true }];
    const schema = makeSchema([{
      id: 'form',
      component: 'Stack',
      children: [
        { id: 'generated-role', component: 'Select', props: { field: 'role' } },
        { id: 'authored-role', component: 'Select', props: { field: 'role', options: authoredOptions } },
      ],
    }], {
      role: { type: 'string', required: true, enum: ['end_user', 'admin'] },
    });

    wireFieldProps(schema);

    const choices = findAllElements(schema, node => node.component === 'Select');
    // Select's runtime contract consumes labeled records, so a bare enum array
    // cannot become the options prop even though its values are valid strings.
    expect(choices[0].props?.options).toEqual([
      { value: 'end_user', label: 'End user' },
      { value: 'admin', label: 'Admin' },
    ]);
    expect(choices[1].props?.options).toEqual(authoredOptions);
  });

  it('sets email input type when binding an email field to Input', () => {
    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'email-input', component: 'Input' },
        ],
      }],
      {
        email: { type: 'email', required: true, description: 'Primary email' },
      },
    );

    wireFieldProps(schema);

    const input = findAllElements(schema, (el) => el.component === 'Input')[0];
    expect(input.props?.field).toBe('email');
    expect(input.props?.type).toBe('email');
  });

  it('includes all bound fields in objectSchema', () => {
    const objectSchema: Record<string, FieldSchemaEntry> = {
      name: { type: 'string', required: true },
      sku: { type: 'string', required: false },
      price: { type: 'number', required: true },
    };

    const schema = makeSchema(
      [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'text1', component: 'Text' },
          { id: 'text2', component: 'Text' },
          { id: 'input1', component: 'Input' },
        ],
      }],
      objectSchema,
    );

    wireFieldProps(schema);

    // objectSchema on the root should still have all fields
    expect(schema.objectSchema).toBeDefined();
    expect(Object.keys(schema.objectSchema!)).toEqual(expect.arrayContaining(['name', 'sku', 'price']));
  });
});
