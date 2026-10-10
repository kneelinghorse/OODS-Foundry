import { describe, expect, it } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

function collectNodes(schema: UiSchema, predicate: (node: UiElement) => boolean): UiElement[] {
  const matches: UiElement[] = [];

  const walk = (node: UiElement): void => {
    if (predicate(node)) {
      matches.push(node);
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return matches;
}

describe('design.compose — form field differentiation', () => {
  it('differentiates mixed Subscription fields into specialized form controls', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'form',
      preferences: { fieldGroups: 5 },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');

    const fieldSelections = result.selections.filter((selection) => selection.slotName.startsWith('field-'));
    const selectionByIntent = new Map(
      fieldSelections
        .filter((selection) => selection.selectedComponent)
        .map((selection) => [selection.intent, selection.selectedComponent]),
    );

    expect(selectionByIntent.get('email-input')).toBe('Input');
    expect(selectionByIntent.get('enum-input')).toBe('Select');
    expect(selectionByIntent.get('date-input')).toBe('DatePicker');
    // The final reconciliation may replace a considered textarea slot with a trait editor.
    // Assert the actual long-text control in the returned tree, not a removed candidate.
    expect(collectNodes(result.schema, node => node.component === 'CancellationForm').length).toBeGreaterThan(0);
    expect(['Toggle', 'Checkbox', 'Switch']).toContain(selectionByIntent.get('boolean-input'));

    const selectedComponents = fieldSelections
      .map((selection) => selection.selectedComponent)
      .filter((component): component is string => typeof component === 'string');
    expect(new Set(selectedComponents).size).toBeGreaterThanOrEqual(4);
  });

  it('wires the subscription email field to an email-typed Input node', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'form',
      preferences: { fieldGroups: 5 },
    });

    expect(result.status).toBe('ok');

    const emailInputs = collectNodes(
      result.schema,
      (node) => node.component === 'Input' && node.props?.field === 'customer_email',
    );

    expect(emailInputs.length).toBeGreaterThan(0);
    expect(emailInputs[0].props?.type).toBe('email');
  });

  it.each(['react', 'vue'] as const)('generates User form on %s without scalar controls consuming collection fields', async (framework) => {
    const result = await handle({ object: 'User', context: 'form' });
    expect(result.status).toBe('ok');
    const nodes = collectNodes(result.schema, () => true);
    // Sprint 201 m06 (#2046 duplicate Role fields): User's own scalar role select is the role editor; the membership Role Assignment stays off its form.
    const editors = ['AddressEditor', 'PreferenceEditor', 'StatusSelector', 'TagInput', 'TemplatePicker'];
    expect(nodes.map(node => node.component)).toEqual(expect.arrayContaining(editors));
    expect(nodes.map(node => node.component)).not.toContain('RoleAssignmentForm');

    // Planning generic inputs must leave the full object available to trait
    // editors; deleting collection fields would conceal the binding defect.
    const object = composeObject(loadObject('User'));
    expect(Object.keys(result.schema.objectSchema ?? {}).sort()).toEqual(Object.keys(object.schema).sort());
    for (const [field, definition] of Object.entries(object.schema)) {
      expect(result.schema.objectSchema?.[field].type).toBe(definition.type);
    }
    expect(nodes.find(node => node.component === 'TagInput')?.props?.field).toBe('tags');
    expect(nodes.find(node => node.component === 'AddressEditor')?.props?.field).toBe('addresses');
    expect(nodes.find(node => node.component === 'PreferenceEditor')?.props?.documentField).toBe('preference_document');

    const scalarControls = nodes.filter(node => (
      ['Input', 'Select', 'Textarea', 'DatePicker', 'Toggle', 'Checkbox', 'Switch'].includes(node.component)
      && typeof node.props?.field === 'string'
    ));
    expect(scalarControls.length).toBeGreaterThan(0);
    for (const node of scalarControls) {
      const field = result.schema.objectSchema![node.props!.field as string];
      expect(field, `${node.id} must retain a real object field`).toBeDefined();
      expect(field.enum?.length || ['string', 'datetime', 'email', 'date', 'url', 'uuid', 'integer', 'number', 'boolean'].includes(field.type),
        `${node.component} must not bind ${field.type} field ${node.props!.field}`).toBeTruthy();
    }

    const editorContainers = nodes.filter(node => node.children?.some(child => editors.includes(child.component)));
    expect(editorContainers.length).toBeGreaterThan(0);
    for (const container of editorContainers) {
      expect(container.props?.field).toBeUndefined();
      expect(container.bindings?.onChange).toBeUndefined();
    }

    const role = nodes.find(node => node.component === 'Select' && node.props?.field === 'role');
    expect(role?.props?.options).toEqual([{ value: 'end_user', label: 'End user' }, { value: 'admin', label: 'Admin' }, { value: 'owner', label: 'Owner' }, { value: 'billing', label: 'Billing' }]);

    const generated = await generate({
      framework,
      profile: 'build',
      schema: result.schema,
      options: { styling: 'tokens', typescript: true },
    });
    expect(generated.errors).toBeUndefined();
    expect(generated.status).toBe('ok');
    expect(generated.artifact).toBeDefined();
    expect(generated.code.length).toBeGreaterThan(0);
  });
});
