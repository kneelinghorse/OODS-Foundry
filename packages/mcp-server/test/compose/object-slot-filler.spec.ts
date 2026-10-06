/**
 * Contract tests for the object slot filler (s62-m03).
 *
 * Validates:
 * 1. fillSlotsWithObject maps SlotPlan entries to template slots
 * 2. Position-based heuristic: top→header, main→main-content/tabs, bottom→footer, sidebar→sidebar
 * 3. Multiple entries in same slot stacked as children by priority
 * 4. Component existence validated against catalog
 * 5. Unfilled required slots fall back to selectComponent()
 * 6. Trait-defined props written into UiElement.props
 * 7. componentOverrides from preferences override view_extension placement
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fillSlotsWithObject, populateObjectSchema, populateBindings, type FillResult } from '../../src/compose/object-slot-filler.js';
import { collectViewExtensions, type SlotPlan } from '../../src/compose/view-extension-collector.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject, type ComposedObject } from '../../src/objects/trait-composer.js';
import { detailTemplate } from '../../src/compose/templates/detail.js';
import { listTemplate } from '../../src/compose/templates/list.js';
import { dashboardTemplate } from '../../src/compose/templates/dashboard.js';
import { formTemplate } from '../../src/compose/templates/form.js';
import { cardTemplate } from '../../src/compose/templates/card.js';
import { resetIdCounter, type TemplateResult } from '../../src/compose/templates/types.js';
import { loadCatalog } from '../../src/compose/component-selector.js';
import type { ComponentCatalogSummary } from '../../src/tools/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import type { FieldDefinition, SemanticMapping } from '../../src/objects/types.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let catalog: ComponentCatalogSummary[];
let subscription: ComposedObject;

beforeEach(async () => {
  catalog = await loadCatalog();
  subscription = composeObject(loadObject('Subscription'));
});

function getDetailTemplate(): TemplateResult {
  resetIdCounter();
  return detailTemplate({ tabCount: 3, tabLabels: ['Overview', 'History', 'Settings'] });
}

function findAllElements(result: FillResult, predicate: (el: UiElement) => boolean): UiElement[] {
  const found: UiElement[] = [];
  const walk = (el: UiElement) => {
    if (predicate(el)) found.push(el);
    el.children?.forEach(walk);
  };
  result.schema.screens.forEach(walk);
  return found;
}

/* ------------------------------------------------------------------ */
/*  Core placement contracts                                           */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — core placement', () => {
  it.each(['Invoice', 'Usage'])('%s keeps its record header when a bound domain chart is added', object => {
    const composed = composeObject(loadObject(object));
    const before = { ...composed, traits: composed.traits.filter(trait => !trait.ref.parameters?.chart) };
    const baseline = fillSlotsWithObject(getDetailTemplate(), collectViewExtensions(before, 'detail').plan, catalog);
    const result = fillSlotsWithObject(getDetailTemplate(), collectViewExtensions(composed, 'detail').plan, catalog);
    const header = findAllElements(baseline, node => node.component === 'DetailHeader');
    expect(header).toHaveLength(1);
    expect(findAllElements(result, node => node.component === 'DetailHeader')).toHaveLength(1);
    expect(findAllElements(result, node => node.chart?.source === 'record-array')).toHaveLength(1);
    expect(result.placements.find(placement => placement.slotName === 'header')?.components[0]).toBe('DetailHeader');
  });

  it('returns schema, placements, and warnings', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.schema).toBeDefined();
    expect(result.schema.screens).toHaveLength(1);
    expect(result.placements).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it('placements contain slot filling decisions', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.placements.length).toBeGreaterThan(0);
    for (const p of result.placements) {
      expect(p.slotName).toBeTruthy();
      expect(['view_extension', 'override', 'fallback']).toContain(p.source);
      expect(p.components.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Position heuristics                                                */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — position heuristics', () => {
  it('position=top maps to header slot', () => {
    const template = getDetailTemplate();
    const topPlan: SlotPlan[] = [{
      component: 'StatusTimeline',
      sourceTrait: 'lifecycle/Stateful',
      position: 'top',
      priority: 40,
      props: { field: 'status' },
    }];
    const result = fillSlotsWithObject(template, topPlan, catalog);
    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.components).toContain('StatusTimeline');
  });

  it('position=main distributes to tab slots in detail template', () => {
    const template = getDetailTemplate();
    const mainPlan: SlotPlan[] = [
      { component: 'StatusBadge', sourceTrait: 'trait-a', position: 'main', priority: 10, props: {} },
      { component: 'RelativeTimestamp', sourceTrait: 'trait-b', position: 'main', priority: 5, props: {} },
    ];
    const result = fillSlotsWithObject(template, mainPlan, catalog);

    const tabPlacements = result.placements.filter((p) => p.slotName.startsWith('tab-'));
    expect(tabPlacements.length).toBeGreaterThan(0);
  });

  it('position=sidebar maps to metadata slot in detail template', () => {
    const template = getDetailTemplate();
    const sidebarPlan: SlotPlan[] = [{
      component: 'FilterPanel',
      sourceTrait: 'core/Classifiable',
      position: 'sidebar',
      priority: 0,
      props: {},
    }];
    const result = fillSlotsWithObject(template, sidebarPlan, catalog);
    const metaPlacement = result.placements.find((p) => p.slotName === 'metadata');
    expect(metaPlacement).toBeDefined();
    expect(metaPlacement!.components).toContain('FilterPanel');
  });

  it('respects explicit target slots for projected dashboard entries', () => {
    resetIdCounter();
    const template = dashboardTemplate({});
    const projectedPlan: SlotPlan[] = [
      {
        component: 'CycleProgressCard',
        sourceTrait: 'financial/Billable',
        position: 'main',
        targetSlot: 'metrics',
        priority: 70,
        props: { progressField: 'current_period_progress' },
      },
      {
        component: 'PaymentTimeline',
        sourceTrait: 'financial/Billable',
        position: 'main',
        targetSlot: 'main-content',
        priority: 60,
        props: { lastPaymentField: 'last_payment_at' },
      },
      {
        component: 'StatusBadge',
        sourceTrait: 'lifecycle/Stateful',
        position: 'before',
        targetSlot: 'sidebar',
        priority: 0,
        props: { field: 'status' },
      },
    ];

    const result = fillSlotsWithObject(template, projectedPlan, catalog);

    expect(result.warnings).toEqual([]);
    expect(result.placements.find((p) => p.slotName === 'metrics')?.components)
      .toContain('CycleProgressCard');
    expect(result.placements.find((p) => p.slotName === 'main-content')?.components)
      .toContain('PaymentTimeline');
    expect(result.placements.find((p) => p.slotName === 'sidebar')?.components)
      .toContain('StatusBadge');
  });
});

/* ------------------------------------------------------------------ */
/*  Stacking behavior                                                  */
/* ------------------------------------------------------------------ */

describe('bound chart placement preserves the declaration for generation', () => {
  it.each([
    ['VizAreaPreview', 'area'], ['VizMarkPreview', 'bar'], ['VizLinePreview', 'line'],
    ['VizPointPreview', 'scatter'], ['VizScatterPreview', 'scatter'], ['VizHeatmapPreview', 'heatmap'],
  ])('%s carries a cloned chart operand outside ordinary DOM props', (component, chartType) => {
    const chart = { chartType, source: 'record-array', dataField: 'samples',
      encodings: { x: { field: 'label' }, y: { field: 'value' } },
      sampleRows: [{ label: 'First', value: 3 }, { label: 'Second', value: 5 }] };
    const original = structuredClone(chart);
    const plan: SlotPlan[] = [{ component, sourceTrait: 'viz/BoundMark', position: 'top', priority: 55,
      props: { chart, title: 'Declared chart', description: 'Declared sample units' } }];
    const result = fillSlotsWithObject(getDetailTemplate(), plan, catalog);
    const placed = findAllElements(result, node => node.component === component);
    expect(placed).toHaveLength(1);
    expect(placed[0]!.chart).toEqual(original);
    expect(placed[0]!.props).toMatchObject({ title: 'Declared chart', description: 'Declared sample units' });
    expect(placed[0]!.props).not.toHaveProperty('chart');
    expect(placed[0]!.chart).not.toBe(chart);
    expect(chart).toEqual(original);
  });
});

describe('fillSlotsWithObject — stacking', () => {
  it('multiple entries targeting same slot are stacked', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [
      { component: 'StatusBadge', sourceTrait: 'trait-a', position: 'top', priority: 20, props: {} },
      { component: 'Banner', sourceTrait: 'trait-b', position: 'top', priority: 10, props: {} },
    ];
    const result = fillSlotsWithObject(template, plan, catalog);
    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.components).toHaveLength(2);
    expect(headerPlacement!.components).toContain('StatusBadge');
    expect(headerPlacement!.components).toContain('Banner');
  });

  it('stacked elements wrapped in Stack container', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [
      { component: 'StatusBadge', sourceTrait: 'trait-a', position: 'top', priority: 20, props: {} },
      { component: 'Banner', sourceTrait: 'trait-b', position: 'top', priority: 10, props: {} },
    ];
    const result = fillSlotsWithObject(template, plan, catalog);

    // Find the header slot element — it should be a Stack with 2 children
    const stacks = findAllElements(result, (el) =>
      el.component === 'Stack' && (el.children?.length ?? 0) >= 2 &&
      el.children!.some((c) => c.component === 'StatusBadge') &&
      el.children!.some((c) => c.component === 'Banner'),
    );
    expect(stacks.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Catalog validation                                                 */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — catalog validation', () => {
  it('warns when component not in catalog', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [{
      component: 'FakeComponent',
      sourceTrait: 'test/Fake',
      position: 'top',
      priority: 0,
      props: {},
    }];
    const result = fillSlotsWithObject(template, plan, catalog);
    expect(result.warnings.some((w) => w.includes('FakeComponent'))).toBe(true);
    expect(result.placements.some((placement) => placement.components.includes('FakeComponent'))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Fallback behavior                                                  */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — fallback', () => {
  it('keeps a populated optional card footer as metadata without inventing an action', () => {
    const organization = composeObject(loadObject('Organization'));
    const { plan } = collectViewExtensions(organization, 'card');
    const result = fillSlotsWithObject(cardTemplate({}), plan, catalog);
    // s223-m01: Taggable's card recipe is TagPills, as its list row is. (design.compose routes a card's after-recipes
    // into the body; called directly, the filler still places them in the footer.)
    expect(result.placements.find((entry) => entry.slotName === 'footer')?.components)
      .toEqual(['OwnershipMeta', 'TagPills']);
    expect(findAllElements(result, (element) => element.component === 'Button')).toEqual([]);
  });

  it('preserves an explicitly authored action in an optional footer', () => {
    const result = fillSlotsWithObject(cardTemplate({}), [{
      component: 'Button', sourceTrait: 'test/Action', position: 'bottom', priority: 10,
      props: { label: 'Open owner' },
    }], catalog);
    expect(findAllElements(result, (element) => element.component === 'Button'))
      .toEqual([expect.objectContaining({ props: { label: 'Open owner' } })]);
  });

  it('unfilled required slots fall back to selectComponent', () => {
    const template = getDetailTemplate();
    // Empty plan — no view extensions
    const result = fillSlotsWithObject(template, [], catalog, undefined, 'subscription detail');

    // header is required and should be filled via fallback
    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.source).toBe('fallback');
    expect(headerPlacement!.components.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Props propagation                                                  */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — props', () => {
  it('trait-defined props written into UiElement.props', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [{
      component: 'StatusTimeline',
      sourceTrait: 'lifecycle/Stateful',
      position: 'top',
      priority: 40,
      props: { field: 'status', historyField: 'state_history' },
    }];
    const result = fillSlotsWithObject(template, plan, catalog);

    const elements = findAllElements(result, (el) => el.component === 'StatusTimeline');
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].props).toHaveProperty('field', 'status');
    expect(elements[0].props).toHaveProperty('historyField', 'state_history');
  });
});

/* ------------------------------------------------------------------ */
/*  Component overrides                                                */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — componentOverrides', () => {
  it('overrides take precedence over view_extension placement', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [{
      component: 'StatusTimeline',
      sourceTrait: 'lifecycle/Stateful',
      position: 'top',
      priority: 40,
      props: { field: 'status' },
    }];
    const overrides = { header: 'CustomHeader' };
    const result = fillSlotsWithObject(template, plan, catalog, overrides);

    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.source).toBe('override');
    expect(headerPlacement!.components).toEqual(['CustomHeader']);
  });

  it('non-overridden slots still filled by view_extensions', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const overrides = { header: 'CustomHeader' };
    const result = fillSlotsWithObject(template, plan, catalog, overrides);

    // At least one non-override placement should exist
    const veOrFallback = result.placements.filter((p) => p.source !== 'override');
    expect(veOrFallback.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration: real object data                                      */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — integration with Subscription', () => {
  it('fills detail template from Subscription view_extensions', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.schema.screens).toHaveLength(1);
    expect(result.placements.length).toBeGreaterThan(0);
  });

  it('fills list template from Subscription view_extensions', () => {
    resetIdCounter();
    const template = listTemplate({});
    const { plan } = collectViewExtensions(subscription, 'list');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.schema.screens).toHaveLength(1);
    expect(result.placements.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  populateObjectSchema                                               */
/* ------------------------------------------------------------------ */

describe('populateObjectSchema — field schema bridge', () => {
  function makeSchema(): UiSchema {
    return { version: '2026.02', screens: [{ id: 'root', component: 'Box' }] };
  }

  it('populates objectSchema from FieldDefinition map', () => {
    const schema = makeSchema();
    const fields: Record<string, FieldDefinition> = {
      name: { type: 'string', required: true, description: 'User name' },
      age: { type: 'integer', required: false, description: 'User age' },
    };
    populateObjectSchema(schema, fields);

    expect(schema.objectSchema).toBeDefined();
    expect(schema.objectSchema!.name).toEqual({ type: 'string', required: true, description: 'User name' });
    expect(schema.objectSchema!.age).toEqual({ type: 'integer', required: false, description: 'User age' });
  });

  it('extracts enum from validation', () => {
    const schema = makeSchema();
    const fields: Record<string, FieldDefinition> = {
      status: {
        type: 'string',
        required: true,
        description: 'Status',
        validation: { enum: ['active', 'paused', 'terminated'] },
      },
    };
    populateObjectSchema(schema, fields);

    expect(schema.objectSchema!.status.enum).toEqual(['active', 'paused', 'terminated']);
  });

  it('includes semanticType from semantic mappings', () => {
    const schema = makeSchema();
    const fields: Record<string, FieldDefinition> = {
      status: { type: 'string', required: true, description: 'Status' },
    };
    const semantics: Record<string, SemanticMapping> = {
      status: { semantic_type: 'billing.subscription.status', token_mapping: 'tokenMap(billing.subscription.status.*)' },
    };
    populateObjectSchema(schema, fields, semantics);

    expect(schema.objectSchema!.status.semanticType).toBe('billing.subscription.status');
  });

  it('does not set objectSchema when fieldSchema is empty', () => {
    const schema = makeSchema();
    populateObjectSchema(schema, {});

    expect(schema.objectSchema).toBeUndefined();
  });

  it('works with real Subscription composed schema', () => {
    const schema = makeSchema();
    // s213-m03: pass the traits, as design.compose does. Subscription's amount declares its minor units through
    // Billable's minorUnits parameter (finding 7), and a declaration naming a parameter resolves only against them.
    populateObjectSchema(schema, subscription.schema, subscription.semantics, subscription.traits);

    expect(schema.objectSchema).toBeDefined();
    const entries = Object.entries(schema.objectSchema!);
    expect(entries.length).toBeGreaterThan(5);
    expect(schema.objectSchema!.amount!.money).toEqual({ currencyField: 'currency', minorUnits: 100 });

    // Every entry has type and required
    for (const [fieldName, entry] of entries) {
      expect(entry.type).toBeTruthy();
      expect(typeof entry.required).toBe('boolean');
    }

    // At least some fields have semantic types
    const withSemanticType = entries.filter(([, e]) => e.semanticType);
    expect(withSemanticType.length).toBeGreaterThan(0);

    // Fields with validation.enum should have enum populated
    const withEnum = entries.filter(([, e]) => e.enum);
    for (const [, entry] of withEnum) {
      expect(entry.enum!.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  populateBindings                                                   */
/* ------------------------------------------------------------------ */

describe('populateBindings — context-appropriate events', () => {
  function makeSchema(): UiSchema {
    return { version: '2026.02', screens: [{ id: 'root', component: 'Page' }] };
  }

  it('form context adds onSubmit and onChange bindings', () => {
    const schema = makeSchema();
    populateBindings(schema, 'form', ['name', 'email']);

    expect(schema.screens[0].bindings).toBeDefined();
    expect(schema.screens[0].bindings!.onSubmit).toBe('handleSubmit');
    expect(schema.screens[0].bindings!.onChange).toBe('handleChange');
  });

  it('list context adds onRowClick, onSort, onFilter', () => {
    const schema = makeSchema();
    populateBindings(schema, 'list');

    expect(schema.screens[0].bindings!.onRowClick).toBe('handleRowClick');
    expect(schema.screens[0].bindings!.onSort).toBe('handleSort');
    expect(schema.screens[0].bindings!.onFilter).toBe('handleFilter');
  });

  it('detail context adds onEdit and onDelete', () => {
    const schema = makeSchema();
    populateBindings(schema, 'detail');

    expect(schema.screens[0].bindings!.onEdit).toBe('handleEdit');
    expect(schema.screens[0].bindings!.onDelete).toBe('handleDelete');
  });

  it('unknown context is a no-op (backward compatible)', () => {
    const schema = makeSchema();
    populateBindings(schema, 'timeline');

    expect(schema.screens[0].bindings).toBeUndefined();
  });

  it('form context adds per-field onChange bindings to field-bound elements', () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [{
        id: 'root',
        component: 'Form',
        children: [
          { id: 'f1', component: 'TextInput', props: { field: 'name' } },
          { id: 'f2', component: 'EmailInput', props: { field: 'email' } },
          { id: 'f3', component: 'Button', props: { label: 'Submit' } },
        ],
      }],
    };
    populateBindings(schema, 'form', ['name', 'email']);

    // Root form element should have context bindings
    expect(schema.screens[0].bindings!.onSubmit).toBe('handleSubmit');

    // Field-bound elements should have per-field onChange
    const nameInput = schema.screens[0].children![0];
    expect(nameInput.bindings!.onChange).toBe('handleChange_name');

    const emailInput = schema.screens[0].children![1];
    expect(emailInput.bindings!.onChange).toBe('handleChange_email');

    // Non-field element should not have onChange
    const button = schema.screens[0].children![2];
    expect(button.bindings).toBeUndefined();
  });
});
