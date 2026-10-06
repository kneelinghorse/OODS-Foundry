import { describe, it, expect, beforeEach } from 'vitest';
import { expandSlots, type ExpansionContext } from './slot-expander.js';
import { detailTemplate } from './templates/detail.js';
import { dashboardTemplate } from './templates/dashboard.js';
import { formTemplate } from './templates/form.js';
import { listTemplate } from './templates/list.js';
import { resetIdCounter } from './templates/types.js';
import type { FieldDefinition } from '../objects/types.js';

function makeFields(count: number, type = 'string'): Record<string, FieldDefinition> {
  const fields: Record<string, FieldDefinition> = {};
  for (let i = 0; i < count; i++) {
    fields[`field_${i}`] = { type, required: i < 3, description: `Field ${i}` };
  }
  return fields;
}

function makeKpiFields(count: number): Record<string, FieldDefinition> {
  const fields: Record<string, FieldDefinition> = {};
  for (let i = 0; i < count; i++) {
    fields[`metric_${i}`] = { type: 'number', required: true, description: `Metric ${i}` };
  }
  return fields;
}

describe('expandSlots', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('detail layout', () => {
    it('does not expand when fields fit in existing tabs', () => {
      const template = detailTemplate({ tabCount: 3 });
      const ctx: ExpansionContext = {
        layout: 'detail',
        fields: makeFields(8), // 8 fields / 4 per tab = 2 tabs needed, 3 exist
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(false);
      expect(result.slotsAdded).toBe(0);
    });

    it('expands tabs when fields exceed capacity', () => {
      resetIdCounter();
      const template = detailTemplate({ tabCount: 2 });
      const ctx: ExpansionContext = {
        layout: 'detail',
        fields: makeFields(20), // 20 fields / 4 per tab = 5 tabs needed
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(true);
      expect(result.slotsAdded).toBe(3); // 5 needed - 2 existing = 3 added
      expect(result.template.slots.filter(s => s.name.startsWith('tab-'))).toHaveLength(5);
    });

    it('caps at max 8 tabs', () => {
      resetIdCounter();
      const template = detailTemplate({ tabCount: 2 });
      const ctx: ExpansionContext = {
        layout: 'detail',
        fields: makeFields(50), // would need 13 tabs, capped at 8
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(true);
      expect(result.template.slots.filter(s => s.name.startsWith('tab-'))).toHaveLength(8);
    });

    it('injects tab panel elements into the Tabs component', () => {
      resetIdCounter();
      const template = detailTemplate({ tabCount: 2 });
      const ctx: ExpansionContext = {
        layout: 'detail',
        fields: makeFields(16),
      };
      const result = expandSlots(template, ctx);
      // Find the Tabs element
      const findTabs = (el: any): any => {
        if (el.component === 'Tabs') return el;
        return el.children?.map(findTabs).find(Boolean);
      };
      const tabs = result.template.schema.screens.map(findTabs).find(Boolean);
      expect(tabs).toBeDefined();
      expect(tabs.children.length).toBe(4); // 2 original + 2 expanded
    });
  });

  describe('dashboard layout', () => {
    it('does not expand when KPI fields are within threshold', () => {
      const template = dashboardTemplate();
      const ctx: ExpansionContext = {
        layout: 'dashboard',
        fields: makeKpiFields(3),
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(false);
      expect(result.slotsAdded).toBe(0);
    });

    it('adds metric slots when KPI fields exceed threshold', () => {
      resetIdCounter();
      const template = dashboardTemplate();
      const ctx: ExpansionContext = {
        layout: 'dashboard',
        fields: makeKpiFields(7),
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(true);
      expect(result.slotsAdded).toBe(7);
      expect(result.template.slots.filter(s => s.name.startsWith('metric-'))).toHaveLength(7);
    });

    it('caps metric slots at 12', () => {
      resetIdCounter();
      const template = dashboardTemplate();
      const ctx: ExpansionContext = {
        layout: 'dashboard',
        fields: makeKpiFields(20),
      };
      const result = expandSlots(template, ctx);
      expect(result.template.slots.filter(s => s.name.startsWith('metric-'))).toHaveLength(12);
    });

    it('detects KPI fields via semantic type', () => {
      resetIdCounter();
      const template = dashboardTemplate();
      const fields: Record<string, FieldDefinition> = {
        name: { type: 'string', required: true, description: 'Name' },
        revenue: { type: 'string', required: true, description: 'Revenue' },
        margin: { type: 'string', required: true, description: 'Margin' },
        growth: { type: 'string', required: true, description: 'Growth' },
        status: { type: 'string', required: true, description: 'Status' },
        cost: { type: 'string', required: true, description: 'Cost' },
      };
      const semanticTypes: Record<string, string> = {
        revenue: 'currency',
        margin: 'percentage',
        growth: 'percentage',
        cost: 'currency',
        status: 'status', // not KPI
      };
      const ctx: ExpansionContext = {
        layout: 'dashboard',
        fields,
        semanticTypes,
      };
      // 4 currency/percentage fields → at threshold, shouldn't expand
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(false);
    });
  });

  describe('form layout', () => {
    it('does not expand when fields fit in existing groups', () => {
      const template = formTemplate({ fieldGroups: 5 });
      const ctx: ExpansionContext = {
        layout: 'form',
        fields: makeFields(4),
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(false);
    });

    it('returns field groups for form slots even without expansion', () => {
      const template = formTemplate({ fieldGroups: 4 });
      const ctx: ExpansionContext = {
        layout: 'form',
        fields: {
          primary_email: { type: 'email', required: true, description: 'Email' },
          role: { type: 'string', required: true, description: 'Role', validation: { enum: ['admin', 'owner'] } },
          created_at: { type: 'datetime', required: true, description: 'Created at' },
          description: { type: 'string', required: false, description: 'Long description', validation: { maxLength: 240 } },
        },
        semanticTypes: {
          primary_email: 'identity.user.email',
          role: 'identity.user.role',
          created_at: 'audit.created_at',
        },
      };

      const result = expandSlots(template, ctx);

      expect(result.fieldGroups).toBeDefined();
      expect(result.fieldGroups!['field-0']).toBeDefined();
      expect(Object.values(result.fieldGroups!).flat()).toHaveLength(4);
    });

    it('expands field groups when fields exceed capacity', () => {
      resetIdCounter();
      const template = formTemplate({ fieldGroups: 3 });
      const ctx: ExpansionContext = {
        layout: 'form',
        fields: makeFields(7),
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(true);
      expect(result.slotsAdded).toBe(4); // 7 needed - 3 existing
      expect(result.template.slots.filter(s => s.name.startsWith('field-'))).toHaveLength(7);
    });

    it('caps at max 10 field groups', () => {
      resetIdCounter();
      const template = formTemplate({ fieldGroups: 3 });
      const ctx: ExpansionContext = {
        layout: 'form',
        fields: makeFields(15),
      };
      const result = expandSlots(template, ctx);
      expect(result.template.slots.filter(s => s.name.startsWith('field-'))).toHaveLength(10);
    });
  });

  describe('list layout', () => {
    it('does not expand (columns are auto-managed)', () => {
      resetIdCounter();
      const template = listTemplate();
      const ctx: ExpansionContext = {
        layout: 'list',
        fields: makeFields(20),
      };
      const result = expandSlots(template, ctx);
      expect(result.expanded).toBe(false);
      expect(result.reason).toContain('auto');
    });
  });
});
