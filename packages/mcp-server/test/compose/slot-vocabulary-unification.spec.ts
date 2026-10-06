import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/design.compose.js';

function collectComponents(schema: UiSchema): string[] {
  const names = new Set<string>();

  function walk(node: UiElement): void {
    names.add(node.component);
    node.children?.forEach(walk);
  }

  schema.screens.forEach(walk);
  return Array.from(names);
}

describe('slot vocabulary unification', () => {
  it('maps User list before/after extensions into concrete slots without placement warnings', async () => {
    const result = await handle({
      object: 'User',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.warnings.filter((warning) => warning.code === 'OODS-V120')).toHaveLength(0);
    expect(result.selections.find((selection) => selection.slotName === 'search')).toBeUndefined();
    expect(result.selections.find((selection) => selection.slotName === 'toolbar-actions')).toBeUndefined();

    const components = collectComponents(result.schema);
    // Sprint 201 m06 (#2046 field-name chips): the slots resolve to the summary badges, but the list row
    // keeps only recipes that print a record value, so the four label-printing badges stay off the schema.
    expect(components).not.toContain('MessageStatusBadge');
    expect(components).not.toContain('AddressSummaryBadge');
    expect(components).not.toContain('PreferenceSummaryBadge');
    expect(components).not.toContain('RoleBadgeList');
    expect(components).toContain('StatusBadge');
    expect(components).toContain('SearchInput');
    // The one row action is bound to its collection; surplus toolbar actions stay absent.
    const visit = (node: UiElement): UiElement[] => [node, ...(node.children ?? []).flatMap(visit)];
    const row = result.schema.screens.flatMap(visit).find(node => node.collection?.source === 'rows');
    const buttons = result.schema.screens.flatMap(visit).filter(node => node.component === 'Button');
    expect(row).toBeDefined();
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatchObject({ collectionControl: 'open', props: { field: row!.collection!.keyField } });
  });

  it('maps Subscription list secondary billing placement without OODS-V120 warnings', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.warnings.filter((warning) => warning.code === 'OODS-V120')).toHaveLength(0);
    const toolbarSelection = result.selections.find(
      (selection) => selection.slotName === 'toolbar-actions',
    );

    expect(toolbarSelection?.selectedComponent).toBe('BillingSummaryBadge');
    expect(toolbarSelection?.candidates.map((candidate) => candidate.name)).toContain('BillingSummaryBadge');

    const components = collectComponents(result.schema);
    // The one row action is bound to its collection; surplus toolbar actions stay absent.
    const visit = (node: UiElement): UiElement[] => [node, ...(node.children ?? []).flatMap(visit)];
    const row = result.schema.screens.flatMap(visit).find(node => node.collection?.source === 'rows');
    const buttons = result.schema.screens.flatMap(visit).filter(node => node.component === 'Button');
    expect(row).toBeDefined();
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatchObject({ collectionControl: 'open', props: { field: row!.collection!.keyField } });
    expect(components).toContain('BillingSummaryBadge');
    expect(components).toContain('StatusBadge');
    expect(components).toContain('RelativeTimestamp');
  });
});
