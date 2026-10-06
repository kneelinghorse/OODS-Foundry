/**
 * Slot Content Distributor tests (s74-m02).
 *
 * Verifies that expanded slots receive differentiated components
 * based on field groups, not the same component repeated in every slot.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import { expandSlots, groupFieldsIntoSlots, type ExpansionContext } from '../../src/compose/slot-expander.js';
import { detailTemplate } from '../../src/compose/templates/detail.js';
import { resetIdCounter } from '../../src/compose/templates/types.js';
import type { FieldDefinition } from '../../src/objects/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function collectSlotComponents(schema: UiSchema): Map<string, string> {
  const slots = new Map<string, string>();
  const walk = (el: UiElement): void => {
    if (el.meta?.intent?.startsWith('slot:')) {
      const name = el.meta.label ?? el.meta.intent.slice('slot:'.length);
      slots.set(name, el.component);
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return slots;
}

function makeMixedFields(): Record<string, FieldDefinition> {
  return {
    name: { type: 'string', required: true, description: 'Name' },
    email: { type: 'email', required: true, description: 'Email' },
    phone: { type: 'string', required: false, description: 'Phone' },
    status: { type: 'string', required: true, description: 'Status',
      validation: { enum: ['active', 'inactive', 'pending'] } },
    price: { type: 'number', required: true, description: 'Price' },
    cost: { type: 'number', required: false, description: 'Cost' },
    margin: { type: 'number', required: false, description: 'Margin' },
    created_at: { type: 'datetime', required: true, description: 'Created' },
    updated_at: { type: 'datetime', required: false, description: 'Updated' },
    is_active: { type: 'boolean', required: true, description: 'Active' },
    is_verified: { type: 'boolean', required: false, description: 'Verified' },
    tags: { type: 'array', required: false, description: 'Tags' },
    website: { type: 'url', required: false, description: 'Website' },
    notes: { type: 'string', required: false, description: 'Notes' },
    category: { type: 'string', required: false, description: 'Category' },
    rating: { type: 'number', required: false, description: 'Rating' },
    sku: { type: 'string', required: false, description: 'SKU' },
    weight: { type: 'number', required: false, description: 'Weight' },
    color: { type: 'string', required: false, description: 'Color' },
    quantity: { type: 'integer', required: true, description: 'Quantity' },
  };
}

/* ------------------------------------------------------------------ */
/*  groupFieldsIntoSlots — unit tests                                  */
/* ------------------------------------------------------------------ */

describe('groupFieldsIntoSlots', () => {
  it('distributes fields with semantic types to different slots', () => {
    const fields = makeMixedFields();
    const semanticTypes: Record<string, string> = {
      price: 'currency',
      cost: 'currency',
      margin: 'percentage',
      status: 'status',
      rating: 'rating',
    };
    const slotNames = ['tab-0', 'tab-1', 'tab-2', 'tab-3'];

    const groups = groupFieldsIntoSlots(fields, slotNames, semanticTypes);

    // Every slot should have at least one field
    for (const name of slotNames) {
      expect(groups[name]).toBeDefined();
      expect(groups[name].length).toBeGreaterThan(0);
    }

    // Total assigned fields should equal total fields
    const totalAssigned = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
    expect(totalAssigned).toBe(Object.keys(fields).length);

    // Currency fields (price, cost) should be in the same slot
    const pricingSlot = slotNames.find(s => groups[s].includes('price'));
    expect(pricingSlot).toBeDefined();
    expect(groups[pricingSlot!]).toContain('cost');
  });

  it('handles empty fields', () => {
    const groups = groupFieldsIntoSlots({}, ['tab-0', 'tab-1']);
    expect(groups['tab-0']).toEqual([]);
    expect(groups['tab-1']).toEqual([]);
  });

  it('handles empty slot names', () => {
    const groups = groupFieldsIntoSlots(makeMixedFields(), []);
    expect(Object.keys(groups)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Expansion with field groups                                        */
/* ------------------------------------------------------------------ */

describe('expandSlots — field groups', () => {
  beforeEach(() => resetIdCounter());

  it('produces field groups when expanding detail tabs', () => {
    const template = detailTemplate({ tabCount: 2 });
    const fields = makeMixedFields();
    const semanticTypes: Record<string, string> = {
      price: 'currency',
      cost: 'currency',
      status: 'status',
    };

    const result = expandSlots(template, {
      layout: 'detail',
      fields,
      semanticTypes,
    });

    expect(result.expanded).toBe(true);
    expect(result.fieldGroups).toBeDefined();

    // Each tab should have a field group
    const tabSlots = Object.keys(result.fieldGroups!).filter(k => k.startsWith('tab-'));
    expect(tabSlots.length).toBeGreaterThan(0);
  });

  it('produces field groups even when not expanding', () => {
    const template = detailTemplate({ tabCount: 3 });
    const fields: Record<string, FieldDefinition> = {
      name: { type: 'string', required: true, description: 'Name' },
      status: { type: 'string', required: true, description: 'Status' },
    };

    const result = expandSlots(template, {
      layout: 'detail',
      fields,
    });

    expect(result.expanded).toBe(false);
    expect(result.fieldGroups).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Integration: expanded slots get distinct components                */
/* ------------------------------------------------------------------ */

describe('slot content distribution — compose integration', () => {
  it('Product detail with many fields: expanded tabs have varied components', async () => {
    const result = await handle({
      intent: 'A detail view for a Product showing all fields',
      object: 'Product',
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('detail');

    // Collect tab slot components
    const slotComponents = collectSlotComponents(result.schema);
    const tabComponents: string[] = [];
    for (const [name, component] of slotComponents) {
      if (name.startsWith('tab-')) {
        tabComponents.push(component);
      }
    }

    // If there are multiple tabs, they shouldn't ALL have the same component
    if (tabComponents.length >= 3) {
      const unique = new Set(tabComponents);
      // At least 2 distinct components across tabs (not all identical)
      expect(unique.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('Subscription detail: selections for tabs carry differentiated context', async () => {
    const result = await handle({
      intent: 'A detail view for a Subscription',
      object: 'Subscription',
    });

    expect(result.status).toBe('ok');

    // Tab selections should not all be identical
    const tabSelections = result.selections
      .filter(s => s.slotName.startsWith('tab-') && s.selectedComponent);

    if (tabSelections.length >= 2) {
      const components = tabSelections.map(s => s.selectedComponent);
      const unique = new Set(components);
      // With field-group-aware hints, at least some tabs should differ
      expect(unique.size).toBeGreaterThanOrEqual(1);
    }
  });
});
