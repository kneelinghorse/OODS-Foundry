import { describe, expect, it } from 'vitest';
import { formTemplate } from './form.js';
import { isSlotElement, resetIdCounter } from './types.js';

describe('formTemplate', () => {
  it('produces a valid schema with title slot and field groups', () => {
    resetIdCounter();
    const result = formTemplate();

    expect(result.schema.screens).toHaveLength(1);
    expect(result.slots.some((s) => s.name === 'title')).toBe(true);
    expect(result.slots.filter((s) => s.name.startsWith('field-')).length).toBe(3);
  });

  it('emits a pre-filled Button with label and type in the actions bar', () => {
    resetIdCounter();
    const result = formTemplate();

    const screen = result.schema.screens[0];
    const actionsBar = screen.children?.find((c) => c.layout?.type === 'inline');
    expect(actionsBar).toBeDefined();

    const submitButton = actionsBar?.children?.[0];
    expect(submitButton).toBeDefined();
    expect(submitButton?.component).toBe('Button');
    expect(submitButton?.props?.label).toBe('Save');
    expect(submitButton?.props?.type).toBe('submit');
  });

  it('does not declare actions as a fillable slot', () => {
    resetIdCounter();
    const result = formTemplate();

    // Actions is pre-filled, not a slot for the filler to replace
    expect(result.slots.some((s) => s.name === 'actions')).toBe(false);
  });

  it('submit button is not a slot element', () => {
    resetIdCounter();
    const result = formTemplate();

    const screen = result.schema.screens[0];
    const actionsBar = screen.children?.find((c) => c.layout?.type === 'inline');
    const submitButton = actionsBar?.children?.[0];

    expect(submitButton).toBeDefined();
    expect(isSlotElement(submitButton!)).toBe(false);
  });
});
