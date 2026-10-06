/**
 * Contract tests for layout template library (s51-m01).
 *
 * Validates:
 * 1. Each template produces valid UiSchema (passes repl.validate)
 * 2. Templates use only registered components
 * 3. Named slots are present with correct meta.intent markers
 * 4. Templates are parameterizable (column count, section count, etc.)
 * 5. Each template renders via repl.render (document + fragment)
 * 6. IDs are unique within each schema
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import {
  dashboardTemplate,
  formTemplate,
  detailTemplate,
  listTemplate,
  resetIdCounter,
} from '../../src/compose/templates/index.js';
import type { Slot, TemplateResult } from '../../src/compose/templates/index.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Collect all node IDs from a UiSchema recursively. */
function collectIds(schema: UiSchema): string[] {
  const ids: string[] = [];
  function walk(el: UiElement) {
    ids.push(el.id);
    el.children?.forEach(walk);
  }
  schema.screens.forEach(walk);
  return ids;
}

/** Collect all component names from a UiSchema recursively. */
function collectComponents(schema: UiSchema): string[] {
  const comps: string[] = [];
  function walk(el: UiElement) {
    comps.push(el.component);
    el.children?.forEach(walk);
  }
  schema.screens.forEach(walk);
  return comps;
}

/** Collect all slot elements (meta.intent starts with "slot:"). */
function collectSlots(schema: UiSchema): UiElement[] {
  const slots: UiElement[] = [];
  function walk(el: UiElement) {
    if (el.meta?.intent?.startsWith('slot:')) slots.push(el);
    el.children?.forEach(walk);
  }
  schema.screens.forEach(walk);
  return slots;
}

/** Count total nodes in a schema. */
function countNodes(schema: UiSchema): number {
  let count = 0;
  function walk(el: UiElement) {
    count++;
    el.children?.forEach(walk);
  }
  schema.screens.forEach(walk);
  return count;
}

/* ------------------------------------------------------------------ */
/*  Shared validation helper                                           */
/* ------------------------------------------------------------------ */

async function assertValidSchema(schema: UiSchema) {
  const result = await validateHandle({
    mode: 'full',
    schema,
    options: { checkComponents: true },
  });
  expect(result.status, `Validation failed: ${JSON.stringify(result.errors)}`).toBe('ok');
  expect(result.errors).toHaveLength(0);
  return result;
}

async function assertRendersDocument(schema: UiSchema) {
  const result = await renderHandle({
    mode: 'full',
    schema,
    apply: true,
    output: { format: 'document' },
  });
  expect(result.status, `Render failed: ${JSON.stringify(result.errors)}`).toBe('ok');
  expect(result.html).toBeTruthy();
  return result;
}

async function assertRendersFragments(schema: UiSchema) {
  const result = await renderHandle({
    mode: 'full',
    schema,
    apply: true,
    output: { format: 'fragments' },
  });
  expect(result.status, `Fragment render failed: ${JSON.stringify(result.errors)}`).toBe('ok');
  expect(result.fragments).toBeTruthy();
  return result;
}

/* ------------------------------------------------------------------ */
/*  Dashboard template                                                 */
/* ------------------------------------------------------------------ */

describe('dashboardTemplate', () => {
  beforeEach(() => resetIdCounter());

  it('produces a valid UiSchema with default options', async () => {
    const { schema } = dashboardTemplate();
    await assertValidSchema(schema);
  });

  it('has version and exactly one screen', () => {
    const { schema } = dashboardTemplate();
    expect(schema.version).toBe('2026.02');
    expect(schema.screens).toHaveLength(1);
  });

  it('uses only registered components', () => {
    const { schema } = dashboardTemplate();
    const comps = collectComponents(schema);
    // All components used should be in the registry
    const expected = new Set(['Stack', 'Grid', 'Card', 'Text', 'Button', 'Input', 'Select', 'Badge', 'Banner', 'Table', 'Tabs']);
    for (const c of comps) {
      expect(expected.has(c), `Component "${c}" is not a known layout primitive`).toBe(true);
    }
  });

  it('generates unique IDs', () => {
    const { schema } = dashboardTemplate();
    const ids = collectIds(schema);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares header, metrics, main-content, and sidebar slots', () => {
    const { slots } = dashboardTemplate();
    const names = slots.map(s => s.name);
    expect(names).toContain('header');
    expect(names).toContain('metrics');
    expect(names).toContain('main-content');
    expect(names).toContain('sidebar');
  });

  it('slot elements appear in the schema tree', () => {
    const { schema, slots } = dashboardTemplate();
    const slotEls = collectSlots(schema);
    const slotIntents = slotEls.map(el => el.meta!.intent!.replace('slot:', ''));
    for (const slot of slots) {
      expect(slotIntents).toContain(slot.name);
    }
  });

  it('respects metricColumns parameter', () => {
    const { schema } = dashboardTemplate({ metricColumns: 2 });
    // Find the Grid element
    function findGrid(el: UiElement): UiElement | undefined {
      if (el.component === 'Grid') return el;
      for (const c of el.children ?? []) {
        const found = findGrid(c);
        if (found) return found;
      }
    }
    const grid = findGrid(schema.screens[0]);
    expect(grid).toBeTruthy();
    expect(grid!.props?.columns).toBe(2);
  });

  it('omits sidebar when includeSidebar=false', () => {
    const { schema, slots } = dashboardTemplate({ includeSidebar: false });
    const names = slots.map(s => s.name);
    expect(names).not.toContain('sidebar');
    // No sidebar layout in tree
    function hasSidebar(el: UiElement): boolean {
      if (el.layout?.type === 'sidebar') return true;
      return (el.children ?? []).some(hasSidebar);
    }
    expect(hasSidebar(schema.screens[0])).toBe(false);
  });

  it('applies theme when provided', () => {
    const { schema } = dashboardTemplate({ theme: 'dark' });
    expect(schema.theme).toBe('dark');
  });

  it('renders in document mode', async () => {
    const { schema } = dashboardTemplate();
    await assertRendersDocument(schema);
  });

  it('renders in fragment mode', async () => {
    const { schema } = dashboardTemplate();
    await assertRendersFragments(schema);
  });
});

/* ------------------------------------------------------------------ */
/*  Form template                                                      */
/* ------------------------------------------------------------------ */

describe('formTemplate', () => {
  beforeEach(() => resetIdCounter());

  it('produces a valid UiSchema with default options', async () => {
    const { schema } = formTemplate();
    await assertValidSchema(schema);
  });

  it('has version and exactly one screen', () => {
    const { schema } = formTemplate();
    expect(schema.version).toBe('2026.02');
    expect(schema.screens).toHaveLength(1);
  });

  it('uses only registered components', () => {
    const { schema } = formTemplate();
    const comps = collectComponents(schema);
    const expected = new Set(['Stack', 'Grid', 'Card', 'Text', 'Button', 'Input', 'Select', 'Badge', 'Banner', 'Table', 'Tabs']);
    for (const c of comps) {
      expect(expected.has(c), `Component "${c}" not registered`).toBe(true);
    }
  });

  it('generates unique IDs', () => {
    const { schema } = formTemplate();
    const ids = collectIds(schema);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares title and field-N slots (actions pre-filled as Button)', () => {
    const { slots, schema } = formTemplate();
    const names = slots.map(s => s.name);
    expect(names).toContain('title');
    expect(names).toContain('field-0');
    expect(names).toContain('field-1');
    expect(names).toContain('field-2');
    // actions is pre-filled with a Button, not a fillable slot
    expect(names).not.toContain('actions');

    // Verify the pre-filled Button has label and type
    const screen = schema.screens[0];
    const actionsBar = screen.children?.find((c: any) => c.layout?.type === 'inline');
    const submitBtn = actionsBar?.children?.[0];
    expect(submitBtn?.component).toBe('Button');
    expect(submitBtn?.props?.label).toBe('Save');
    expect(submitBtn?.props?.type).toBe('submit');
  });

  it('respects fieldGroups parameter', () => {
    const { schema: s3 } = formTemplate({ fieldGroups: 3 });
    const { schema: s5 } = formTemplate({ fieldGroups: 5 });
    // More field groups = more nodes
    expect(countNodes(s5)).toBeGreaterThan(countNodes(s3));
  });

  it('uses provided field slot metadata when available', () => {
    const { slots } = formTemplate({
      fieldSlots: [
        { description: 'Primary email field', intent: 'email-input' },
        { description: 'Role selector', intent: 'enum-input' },
      ],
    });

    expect(slots.find((slot) => slot.name === 'field-0')).toMatchObject({
      description: 'Primary email field',
      intent: 'email-input',
    });
    expect(slots.find((slot) => slot.name === 'field-1')).toMatchObject({
      description: 'Role selector',
      intent: 'enum-input',
    });
  });

  it('includes banner when includeBanner=true', () => {
    const { slots: withBanner } = formTemplate({ includeBanner: true });
    const { slots: withoutBanner } = formTemplate({ includeBanner: false });
    expect(withBanner.map(s => s.name)).toContain('banner');
    expect(withoutBanner.map(s => s.name)).not.toContain('banner');
  });

  it('field group slots are in schema tree', () => {
    const { schema } = formTemplate({ fieldGroups: 2 });
    const slotEls = collectSlots(schema);
    const intents = slotEls.map(el => el.meta!.intent!.replace('slot:', ''));
    expect(intents).toContain('field-0');
    expect(intents).toContain('field-1');
  });

  it('renders in document mode', async () => {
    const { schema } = formTemplate();
    await assertRendersDocument(schema);
  });

  it('renders in fragment mode', async () => {
    const { schema } = formTemplate();
    await assertRendersFragments(schema);
  });
});

/* ------------------------------------------------------------------ */
/*  Detail template                                                    */
/* ------------------------------------------------------------------ */

describe('detailTemplate', () => {
  beforeEach(() => resetIdCounter());

  it('produces a valid UiSchema with default options', async () => {
    const { schema } = detailTemplate();
    await assertValidSchema(schema);
  });

  it('has version and exactly one screen', () => {
    const { schema } = detailTemplate();
    expect(schema.version).toBe('2026.02');
    expect(schema.screens).toHaveLength(1);
  });

  it('uses only registered components', () => {
    const { schema } = detailTemplate();
    const comps = collectComponents(schema);
    const expected = new Set(['Stack', 'Grid', 'Card', 'Text', 'Button', 'Input', 'Select', 'Badge', 'Banner', 'Table', 'Tabs']);
    for (const c of comps) {
      expect(expected.has(c), `Component "${c}" not registered`).toBe(true);
    }
  });

  it('generates unique IDs', () => {
    const { schema } = detailTemplate();
    const ids = collectIds(schema);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares header and tab slots', () => {
    const { slots } = detailTemplate();
    const names = slots.map(s => s.name);
    expect(names).toContain('header');
    expect(names).toContain('tab-0');
    expect(names).toContain('tab-1');
    expect(names).toContain('tab-2');
  });

  it('declares metadata slot when includeMetaSidebar=true (default)', () => {
    const { slots } = detailTemplate();
    expect(slots.map(s => s.name)).toContain('metadata');
  });

  it('omits metadata slot when includeMetaSidebar=false', () => {
    const { slots } = detailTemplate({ includeMetaSidebar: false });
    expect(slots.map(s => s.name)).not.toContain('metadata');
  });

  it('respects tabCount parameter', () => {
    const { slots } = detailTemplate({ tabCount: 5 });
    const tabSlots = slots.filter(s => s.name.startsWith('tab-'));
    expect(tabSlots).toHaveLength(5);
  });

  it('respects tabLabels parameter', () => {
    const { schema } = detailTemplate({ tabLabels: ['Overview', 'History', 'Settings'] });
    // Find tab panels and check their labels
    function findTabs(el: UiElement): UiElement | undefined {
      if (el.component === 'Tabs') return el;
      for (const c of el.children ?? []) {
        const found = findTabs(c);
        if (found) return found;
      }
    }
    const tabs = findTabs(schema.screens[0]);
    expect(tabs).toBeTruthy();
    const labels = tabs!.children!.map(c => c.props?.label);
    expect(labels).toEqual(['Overview', 'History', 'Settings']);
  });

  it('renders in document mode', async () => {
    const { schema } = detailTemplate();
    await assertRendersDocument(schema);
  });

  it('renders in fragment mode', async () => {
    const { schema } = detailTemplate();
    await assertRendersFragments(schema);
  });
});

/* ------------------------------------------------------------------ */
/*  List template                                                      */
/* ------------------------------------------------------------------ */

describe('listTemplate', () => {
  beforeEach(() => resetIdCounter());

  it('produces a valid UiSchema with default options', async () => {
    const { schema } = listTemplate();
    await assertValidSchema(schema);
  });

  it('has version and exactly one screen', () => {
    const { schema } = listTemplate();
    expect(schema.version).toBe('2026.02');
    expect(schema.screens).toHaveLength(1);
  });

  it('uses only registered components', () => {
    const { schema } = listTemplate();
    const comps = collectComponents(schema);
    const expected = new Set(['Stack', 'Grid', 'Card', 'Text', 'Button', 'Input', 'SearchInput', 'Select', 'Badge', 'Banner', 'Table', 'Tabs']);
    for (const c of comps) {
      expect(expected.has(c), `Component "${c}" not registered`).toBe(true);
    }
  });

  it('generates unique IDs', () => {
    const { schema } = listTemplate();
    const ids = collectIds(schema);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares items, search, filters, toolbar-actions, and pagination slots', () => {
    const { slots } = listTemplate();
    const names = slots.map(s => s.name);
    expect(names).toContain('items');
    expect(names).toContain('search');
    expect(names).toContain('filters');
    expect(names).toContain('toolbar-actions');
    expect(names).toContain('pagination');
  });

  it('omits search when includeSearch=false', () => {
    const { slots } = listTemplate({ includeSearch: false });
    expect(slots.map(s => s.name)).not.toContain('search');
  });

  it('omits filters when includeFilters=false', () => {
    const { slots } = listTemplate({ includeFilters: false });
    expect(slots.map(s => s.name)).not.toContain('filters');
  });

  it('omits pagination when includePagination=false', () => {
    const { slots, schema } = listTemplate({ includePagination: false });
    expect(slots.map(s => s.name)).not.toContain('pagination');
    // Should have fewer children on the root Stack
    expect(schema.screens[0].children).toHaveLength(2); // toolbar + items only
  });

  it('minimal list (no search, no filters, no pagination) is still valid', async () => {
    const { schema } = listTemplate({
      includeSearch: false,
      includeFilters: false,
      includePagination: false,
    });
    await assertValidSchema(schema);
  });

  it('renders in document mode', async () => {
    const { schema } = listTemplate();
    await assertRendersDocument(schema);
  });

  it('renders in fragment mode', async () => {
    const { schema } = listTemplate();
    await assertRendersFragments(schema);
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-template invariants                                          */
/* ------------------------------------------------------------------ */

describe('cross-template invariants', () => {
  const templates: [string, () => TemplateResult][] = [
    ['dashboard', () => dashboardTemplate()],
    ['form', () => formTemplate()],
    ['detail', () => detailTemplate()],
    ['list', () => listTemplate()],
  ];

  beforeEach(() => resetIdCounter());

  for (const [name, factory] of templates) {
    it(`${name}: schema.version is 2026.02`, () => {
      resetIdCounter();
      const { schema } = factory();
      expect(schema.version).toBe('2026.02');
    });

    it(`${name}: screens has exactly 1 element`, () => {
      resetIdCounter();
      const { schema } = factory();
      expect(schema.screens).toHaveLength(1);
    });

    it(`${name}: root screen component is Stack`, () => {
      resetIdCounter();
      const { schema } = factory();
      expect(schema.screens[0].component).toBe('Stack');
    });

    it(`${name}: at least one required slot`, () => {
      resetIdCounter();
      const { slots } = factory();
      expect(slots.some(s => s.required)).toBe(true);
    });

    it(`${name}: every slot has name, description, and intent`, () => {
      resetIdCounter();
      const { slots } = factory();
      for (const slot of slots) {
        expect(slot.name).toBeTruthy();
        expect(slot.description).toBeTruthy();
        expect(slot.intent).toBeTruthy();
      }
    });

    it(`${name}: slot names are unique`, () => {
      resetIdCounter();
      const { slots } = factory();
      const names = slots.map(s => s.name);
      expect(new Set(names).size).toBe(names.length);
    });
  }
});
