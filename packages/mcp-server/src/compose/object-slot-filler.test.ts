import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import { wireFieldProps } from './object-slot-filler.js';

function makeNode(
  id: string,
  component: string,
  props?: Record<string, unknown>,
): UiElement {
  return {
    id,
    component,
    ...(props ? { props } : {}),
  };
}

describe('wireFieldProps', () => {
  it('preserves explicit field bindings and only auto-binds compatible components', () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [{
        id: 'screen-1',
        component: 'Stack',
        children: [
          makeNode('search', 'SearchInput', { field: 'searchQuery' }),
          makeNode('label', 'LabelCell', { field: 'label', descriptionField: 'description' }),
          makeNode('status', 'StatusBadge', { field: 'status' }),
          makeNode('timestamp', 'RelativeTimestamp', { field: 'updated_at', fallbackField: 'created_at' }),
          makeNode('price', 'PriceBadge', { amountField: 'unit_amount_cents', currencyField: 'currency' }),
          makeNode('tags', 'TagPills'),
          makeNode('action', 'Button'),
        ],
      }],
      objectSchema: {
        searchQuery: { type: 'string', required: false, semanticType: 'input.search.query' },
        label: { type: 'string', required: true, semanticType: 'text.label' },
        description: { type: 'string', required: false, semanticType: 'text.description' },
        status: { type: 'string', required: true, enum: ['active', 'inactive'], semanticType: 'status.state' },
        updated_at: { type: 'datetime', required: false, semanticType: 'audit.updated_at' },
        created_at: { type: 'datetime', required: true, semanticType: 'audit.created_at' },
        unit_amount_cents: { type: 'number', required: true, semanticType: 'commerce.price.amount' },
        currency: { type: 'string', required: true, semanticType: 'commerce.price.currency' },
        channel_catalog: { type: 'Channel[]', required: true, semanticType: 'communication.channels' },
        tags: { type: 'string[]', required: false, semanticType: 'taxonomy.tag.collection' },
        role: { type: 'string', required: true, enum: ['admin', 'owner'], semanticType: 'identity.user.role' },
      },
    };

    const boundCount = wireFieldProps(schema);
    const nodes = schema.screens[0].children ?? [];

    expect(boundCount).toBe(1);
    expect(nodes.find((node) => node.id === 'search')?.props?.field).toBe('searchQuery');
    expect(nodes.find((node) => node.id === 'label')?.props?.field).toBe('label');
    expect(nodes.find((node) => node.id === 'status')?.props?.field).toBe('status');
    expect(nodes.find((node) => node.id === 'timestamp')?.props?.field).toBe('updated_at');
    expect(nodes.find((node) => node.id === 'price')?.props?.field).toBeUndefined();
    expect(nodes.find((node) => node.id === 'tags')?.props?.field).toBe('tags');
    expect(nodes.find((node) => node.id === 'action')?.props?.field).toBeUndefined();
  });

  it('blocks fallback status components from binding to non-status enum fields', () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [{
        id: 'screen-1',
        component: 'Stack',
        children: [
          makeNode('primary-status', 'StatusBadge', { field: 'status' }),
          makeNode('secondary-status', 'StatusBadge'),
        ],
      }],
      objectSchema: {
        status: { type: 'string', required: true, enum: ['active', 'inactive'], semanticType: 'status.state' },
        role: { type: 'string', required: true, enum: ['admin', 'owner'], semanticType: 'identity.user.role' },
      },
    };

    const boundCount = wireFieldProps(schema);
    const nodes = schema.screens[0].children ?? [];

    expect(boundCount).toBe(0);
    expect(nodes.find((node) => node.id === 'secondary-status')?.props?.field).toBeUndefined();
  });
});
