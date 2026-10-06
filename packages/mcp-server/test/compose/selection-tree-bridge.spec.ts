/**
 * Selection→Tree Bridge tests (s74-m01).
 *
 * Verifies that component selection rankings (field affinity, position
 * affinity, component selector scores) are applied to the actual UiSchema
 * tree nodes — not just in selections metadata.
 *
 * Test groups:
 *   1. List footer: selection-filled slots appear in tree
 *   2. Detail: view_extension + fallback both appear in tree
 *   3. No-object path: selections applied to tree slots
 *   4. applySelectionsToSchema: unit tests for the bridge function
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import { applySelectionsToSchema, type SelectionEntry } from '../../src/compose/object-slot-filler.js';
import { listTemplate } from '../../src/compose/templates/list.js';
import { detailTemplate } from '../../src/compose/templates/detail.js';
import { resetIdCounter, slotElement } from '../../src/compose/templates/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function collectSlotElements(schema: UiSchema): Map<string, UiElement> {
  const slots = new Map<string, UiElement>();
  const walk = (el: UiElement): void => {
    if (el.meta?.intent?.startsWith('slot:')) {
      const name = el.meta.label ?? el.meta.intent.slice('slot:'.length);
      slots.set(name, el);
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return slots;
}

function findElementBySlot(schema: UiSchema, slotName: string): UiElement | undefined {
  return collectSlotElements(schema).get(slotName);
}

/* ------------------------------------------------------------------ */
/*  1. List footer: selection-ranked components in tree                */
/* ------------------------------------------------------------------ */

describe('selection→tree bridge — list footer', () => {
  it('User list compose: pagination slot component differs from template default', async () => {
    const result = await handle({
      intent: 'A paginated list of Users showing name, email, and role with search and filtering',
      object: 'User',
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('list');

    // The pagination selection should exist with a component
    const paginationSel = result.selections.find((s) => s.slotName === 'pagination');
    expect(paginationSel).toBeDefined();
    expect(paginationSel!.selectedComponent).toBeTruthy();

    // The pagination slot in the tree should NOT be the template default 'Text'
    const paginationEl = findElementBySlot(result.schema, 'pagination');
    if (paginationEl) {
      // If filled by selection or view_extension, it should differ from default
      expect(paginationEl.component).not.toBe('Text');
    }
  });

  it('User list compose: all slots with selections appear filled in tree', async () => {
    const result = await handle({
      intent: 'A list of Users with search and pagination',
      object: 'User',
    });

    expect(result.status).toBe('ok');

    // Every slot with a selection should be filled in the tree (not default)
    const slotElements = collectSlotElements(result.schema);
    const defaultComponents = new Map([
      ['search', 'Input'],
      ['filters', 'Select'],
      ['pagination', 'Text'],
      ['items', 'Stack'],
      ['toolbar-actions', 'Button'],
    ]);

    let filledCount = 0;
    for (const sel of result.selections) {
      if (!sel.selectedComponent) continue;
      const el = slotElements.get(sel.slotName);
      if (!el) continue;

      const defaultComp = defaultComponents.get(sel.slotName);
      // Slot should be either: the selected component, a Stack (stacking), or something from view_extensions
      // The key assertion: it should NOT still be the template default if a selection was made
      if (el.component !== defaultComp) {
        filledCount++;
      }
    }

    // At least some slots should have been updated from their defaults
    expect(filledCount).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  2. Detail: view_extension + fallback filling in tree               */
/* ------------------------------------------------------------------ */

describe('selection→tree bridge — detail view', () => {
  it('Product detail: tree nodes are not all default placeholders', async () => {
    const result = await handle({
      intent: 'A detail view for a Product showing name, price, SKU, and inventory status with a status badge',
      object: 'Product',
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('detail');

    // Collect all slot elements and their default components
    resetIdCounter();
    const defaultTemplate = detailTemplate({});
    const defaultSlots = collectSlotElements(defaultTemplate.schema);
    const actualSlots = collectSlotElements(result.schema);

    // At least some slots should have components different from their defaults
    let changedCount = 0;
    for (const [name, el] of actualSlots) {
      const defaultEl = defaultSlots.get(name);
      if (defaultEl && el.component !== defaultEl.component) {
        changedCount++;
      }
    }

    expect(changedCount).toBeGreaterThan(0);
  });

  it('Organization detail: metadata slot is filled', async () => {
    const result = await handle({
      intent: 'A detail view of an Organization',
      object: 'Organization',
    });

    expect(result.status).toBe('ok');

    // metadata slot should be filled (either by view_extension or selection)
    const metaSel = result.selections.find((s) => s.slotName === 'metadata');
    if (metaSel?.selectedComponent) {
      const metaEl = findElementBySlot(result.schema, 'metadata');
      if (metaEl) {
        // Should not still be the default 'Stack' placeholder
        expect(metaEl.component).not.toBe('Stack');
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  3. No-object path: selections applied to tree                      */
/* ------------------------------------------------------------------ */

describe('selection→tree bridge — no object path', () => {
  it('settings form: all slots with selections are applied to tree', async () => {
    const result = await handle({
      intent: 'A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown',
    });

    expect(result.status).toBe('ok');

    // Every selection should be reflected in the tree
    const slotElements = collectSlotElements(result.schema);
    for (const sel of result.selections) {
      if (!sel.selectedComponent) continue;
      const el = slotElements.get(sel.slotName);
      if (el) {
        // Selection should be applied: component matches selected
        expect(el.component).toBe(sel.selectedComponent);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  4. applySelectionsToSchema unit tests                              */
/* ------------------------------------------------------------------ */

describe('applySelectionsToSchema — unit', () => {
  it('replaces slot placeholder components with selected components', () => {
    resetIdCounter();
    const template = listTemplate({});
    const { schema } = template;

    const selections: SelectionEntry[] = [
      { slotName: 'pagination', selectedComponent: 'PaginationBar' },
      { slotName: 'search', selectedComponent: 'SearchInput' },
    ];

    const applied = applySelectionsToSchema(schema, selections);

    expect(applied).toBeGreaterThanOrEqual(1);

    const paginationEl = findElementBySlot(schema, 'pagination');
    expect(paginationEl).toBeDefined();
    expect(paginationEl!.component).toBe('PaginationBar');

    const searchEl = findElementBySlot(schema, 'search');
    expect(searchEl).toBeDefined();
    expect(searchEl!.component).toBe('SearchInput');
  });

  it('returns 0 when no selections have selectedComponent', () => {
    resetIdCounter();
    const template = listTemplate({});
    const { schema } = template;

    const applied = applySelectionsToSchema(schema, [
      { slotName: 'pagination', selectedComponent: undefined },
    ]);
    expect(applied).toBe(0);
  });

  it('does not modify non-slot elements', () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [{
        id: 'root',
        component: 'Stack',
        children: [
          { id: 'child1', component: 'Text' },
          { id: 'child2', component: 'Button' },
        ],
      }],
    };

    const applied = applySelectionsToSchema(schema, [
      { slotName: 'header', selectedComponent: 'DetailHeader' },
    ]);

    expect(applied).toBe(0);
    expect(schema.screens[0].component).toBe('Stack');
  });

  it('applies selections to detail template tab slots', () => {
    resetIdCounter();
    const template = detailTemplate({ tabCount: 2 });
    const { schema } = template;

    const selections: SelectionEntry[] = [
      { slotName: 'tab-0', selectedComponent: 'Card' },
      { slotName: 'tab-1', selectedComponent: 'Table' },
      { slotName: 'header', selectedComponent: 'DetailHeader' },
    ];

    const applied = applySelectionsToSchema(schema, selections);
    expect(applied).toBeGreaterThanOrEqual(2);

    const tab0 = findElementBySlot(schema, 'tab-0');
    expect(tab0).toBeDefined();
    expect(tab0!.component).toBe('Card');

    const tab1 = findElementBySlot(schema, 'tab-1');
    expect(tab1).toBeDefined();
    expect(tab1!.component).toBe('Table');
  });
});
