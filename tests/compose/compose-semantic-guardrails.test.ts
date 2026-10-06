import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import { handle as composeHandle } from '../../packages/mcp-server/src/tools/design.compose.js';

function collectComponents(schema: UiSchema, component: string): UiElement[] {
  const matches: UiElement[] = [];

  const walk = (node: UiElement): void => {
    if (node.component === component) {
      matches.push(node);
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return matches;
}

describe('design.compose semantic guardrails', () => {
  it('differentiates generic settings-form fields from intent cues', async () => {
    const result = await composeHandle({
      intent: 'A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');

    const fieldSelections = result.selections
      .filter((selection) => selection.slotName.startsWith('field-'))
      .map((selection) => selection.selectedComponent);

    expect(new Set(fieldSelections).size).toBeGreaterThan(1);
    expect(fieldSelections.some((name) => ['PreferenceEditor', 'Toggle', 'Checkbox', 'Switch'].includes(name ?? ''))).toBe(true);
    // "frequency dropdown" asks for a choice control, so it composes a Select, and the composer invents no options
    // for it (#2384). s216-m05 removed the invented option-a/option-b values, which were the cue's only carrier, and
    // this assertion went red unnoticed (no gate runs tests/compose) until s223-m02 moved the cue onto the phrase.
    expect(fieldSelections).toContain('Select');
    const select = collectComponents(result.schema, 'Select')[0];
    expect(select?.props?.label).toBe('frequency');
    expect(select?.props?.options).toBeUndefined();
  });

  it('separates Product collection query controls from record fields', async () => {
    const result = await composeHandle({
      object: 'Product',
      context: 'list',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');

    const searchInput = collectComponents(result.schema, 'SearchInput')[0];
    const labelCell = collectComponents(result.schema, 'LabelCell')[0];
    const timestamp = collectComponents(result.schema, 'RelativeTimestamp')[0];
    const toolbarButton = collectComponents(result.schema, 'Button')[0];

    expect(searchInput?.collectionControl).toBe('search');
    expect(searchInput?.props?.field).toBeUndefined();
    expect(labelCell?.props?.field).toBe('label');
    expect(timestamp?.props?.field).toBe('updated_at');
    expect(toolbarButton?.collectionControl).toBe('open');
    expect(toolbarButton?.props?.field).toBe('product_id');
  });

  it('blocks non-status fallback bindings in expanded User detail tabs', async () => {
    const result = await composeHandle({
      object: 'User',
      context: 'detail',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');

    const badStatusBinding = collectComponents(result.schema, 'StatusBadge')
      .some((node) => node.props?.field === 'role');

    expect(badStatusBinding).toBe(false);
  });

  it('prefers SearchInput for searchable lists and keeps results slots non-search', async () => {
    const result = await composeHandle({
      intent: 'A paginated list of Users showing name, email, and role with search and filtering',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('list');

    const searchSelection = result.selections.find((selection) => selection.slotName === 'search');
    const itemsSelection = result.selections.find((selection) => selection.slotName === 'items');
    const filtersSelection = result.selections.find((selection) => selection.slotName === 'filters');

    expect(searchSelection?.selectedComponent).toBe('SearchInput');
    expect(itemsSelection?.selectedComponent).not.toBe('SearchInput');
    expect(filtersSelection?.selectedComponent).not.toBe('SearchInput');
  });

  it('keeps non-search text form fields on Input when search semantics are absent', async () => {
    const result = await composeHandle({
      intent: 'A contact form with email input, name input',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');

    const fieldSelections = result.selections
      .filter((selection) => selection.slotName.startsWith('field-'))
      .map((selection) => selection.selectedComponent);

    expect(fieldSelections.every((name) => name === 'Input')).toBe(true);
  });
});
