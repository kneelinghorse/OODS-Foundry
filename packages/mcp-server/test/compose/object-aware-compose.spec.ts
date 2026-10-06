/**
 * Full pipeline integration tests for object-aware composition (s62-m07).
 *
 * Tests the complete compose pipeline end-to-end:
 * 1. compose(object='Subscription', context='detail') produces trait-driven components
 * 2. View extension priority resolution places higher-priority components first
 * 3. Token overrides appear in schema
 * 4. Tab labels derived from trait categories not 'Tab 1/2/3'
 * 5. Hybrid mode uses intent for layout + object for components
 * 6. Intent auto-detection recognizes object names
 * 7. Unknown object error with suggestion
 * 8. Backward compat — intent-only compose unchanged
 * 9. Full suite green (0 regressions)
 */
import { describe, it, expect } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { collectViewExtensions } from '../../src/compose/view-extension-collector.js';
import { generateLabels } from '../../src/compose/label-generator.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function collectComponentNames(node: Record<string, unknown>): string[] {
  const names: string[] = [];
  if (typeof node.component === 'string') {
    names.push(node.component);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      names.push(...collectComponentNames(child as Record<string, unknown>));
    }
  }
  return names;
}

/* ------------------------------------------------------------------ */
/*  1. Trait-driven components (not generic placeholders)              */
/* ------------------------------------------------------------------ */

describe('object-aware compose — trait-driven components', () => {
  it('Subscription detail produces objectUsed with traits and fields', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.traits.length).toBeGreaterThanOrEqual(2);
    expect(result.objectUsed!.fieldsComposed).toBeGreaterThan(0);
  });

  it('Subscription detail has view extensions for detail context', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.objectUsed!.viewExtensionsApplied).toBeDefined();
    // The Subscription object should have view_extensions for detail context
    // via its traits (lifecycle/Stateful has detail extensions)
    const detailCount = result.objectUsed!.viewExtensionsApplied.detail;
    expect(detailCount).toBeGreaterThan(0);
  });

  it('Subscription detail schema contains real components', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    const components = collectComponentNames(result.schema.screens[0] as Record<string, unknown>);
    expect(components.length).toBeGreaterThan(0);
    // Should not be all generic "Box" placeholders
    const uniqueComponents = new Set(components);
    expect(uniqueComponents.size).toBeGreaterThan(1);
  });
});

/* ------------------------------------------------------------------ */
/*  2. View extension priority sorting                                 */
/* ------------------------------------------------------------------ */

describe('object-aware compose — priority resolution', () => {
  it('view extensions sorted by priority desc for detail context', () => {
    const composed = composeObject(loadObject('Subscription'));
    const { plan } = collectViewExtensions(composed, 'detail');

    if (plan.length >= 2) {
      // Verify priority ordering: first entry has highest priority
      for (let i = 0; i < plan.length - 1; i++) {
        expect(plan[i].priority).toBeGreaterThanOrEqual(plan[i + 1].priority);
      }
    }
  });

  it('each plan entry has sourceTrait attribution', () => {
    const composed = composeObject(loadObject('Subscription'));
    const { plan } = collectViewExtensions(composed, 'detail');

    for (const entry of plan) {
      expect(entry.sourceTrait).toBeTruthy();
      expect(entry.component).toBeTruthy();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  3. Token overrides in schema                                       */
/* ------------------------------------------------------------------ */

describe('object-aware compose — token overrides', () => {
  it('Subscription object has token data in composition', () => {
    const composed = composeObject(loadObject('Subscription'));
    // Composed tokens map should exist
    expect(composed.tokens).toBeDefined();
    expect(typeof composed.tokens).toBe('object');
  });
});

/* ------------------------------------------------------------------ */
/*  4. Tab labels from trait categories                                */
/* ------------------------------------------------------------------ */

describe('object-aware compose — tab labels', () => {
  it('Subscription detail labels are category-derived, not Tab 1/2/3', () => {
    const composed = composeObject(loadObject('Subscription'));
    const result = generateLabels(composed, 'detail');

    expect(result.labels.length).toBeGreaterThan(0);
    for (const label of result.labels) {
      expect(label).not.toMatch(/^Tab \d+$/);
      // Labels should be human-readable (e.g., "Status & History", "Billing")
      expect(label.length).toBeGreaterThan(0);
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });

  it('label count matches number of trait category groups', () => {
    const composed = composeObject(loadObject('Subscription'));
    const result = generateLabels(composed, 'detail');
    expect(result.labels.length).toBe(result.groupSizes.length);
  });
});

/* ------------------------------------------------------------------ */
/*  4b. Pipeline tab label integration (s86-m01)                       */
/* ------------------------------------------------------------------ */

/** Walk the schema tree to find the Tabs element. */
function findTabs(node: Record<string, unknown>): Record<string, unknown> | undefined {
  if (node.component === 'Tabs') return node;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findTabs(child as Record<string, unknown>);
      if (found) return found;
    }
  }
  if (Array.isArray((node as Record<string, unknown[]>).screens)) {
    for (const screen of (node as Record<string, unknown[]>).screens) {
      const found = findTabs(screen as Record<string, unknown>);
      if (found) return found;
    }
  }
  return undefined;
}

function getTabLabels(schema: Record<string, unknown>): string[] {
  const tabs = findTabs(schema);
  if (!tabs?.children || !Array.isArray(tabs.children)) return [];
  return (tabs.children as Record<string, Record<string, string>>[])
    .map(child => child.props?.label)
    .filter(Boolean) as string[];
}

describe('object-aware compose — pipeline tab label wiring (s86-m01)', () => {
  it('Subscription detail pipeline produces semantic tab labels, not Tab 1/2/3', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    const labels = getTabLabels(result.schema as unknown as Record<string, unknown>);
    expect(labels.length).toBeGreaterThan(0);

    // ALL tabs should have semantic labels — no "Tab N" generics
    for (const label of labels) {
      expect(label).not.toMatch(/^Tab \d+$/);
      expect(label.length).toBeGreaterThan(0);
    }

    // Sprint 201 m06 (`#2046` tab order): the populated Billing recipes lead; the read-only record summary follows.
    expect(labels).toEqual(['Billing', 'Details']);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('user-provided tabLabels override generated labels', async () => {
    const customLabels = ['My Tab A', 'My Tab B'];
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
      preferences: { tabLabels: customLabels },
    });
    expect(result.status).toBe('ok');
    const labels = getTabLabels(result.schema as unknown as Record<string, unknown>);
    expect(labels[0]).toBe('My Tab A');
    expect(labels[1]).toBe('My Tab B');
  });

  it('intent-only compose (no object) falls back to generic labels without error', async () => {
    const result = await handle({
      intent: 'a detail view for user profiles',
    });
    expect(result.status).toBe('ok');
    // No objectUsed means no generateLabels call — generic labels are fine
    if (!result.objectUsed) {
      const labels = getTabLabels(result.schema as unknown as Record<string, unknown>);
      for (const label of labels) {
        expect(label).toMatch(/^Tab \d+$/);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  5. Hybrid mode: intent for layout + object for components          */
/* ------------------------------------------------------------------ */

describe('object-aware compose — hybrid mode', () => {
  it('billing overview intent + Subscription object: objectUsed populated', async () => {
    const result = await handle({
      intent: 'billing overview',
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
  });

  it('dashboard intent + object: layout from intent, data from object', async () => {
    const result = await handle({
      intent: 'dashboard metrics overview',
      object: 'Subscription',
      layout: 'dashboard',
    });
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed!.name).toBe('Subscription');
  });

  it('dashboard intent + object projects richer dashboard components from fallback object contexts', async () => {
    const result = await handle({
      intent: 'subscription dashboard with metrics and billing health',
      object: 'Subscription',
      layout: 'dashboard',
    });

    expect(result.layout).toBe('dashboard');
    expect(result.validation?.status).toBe('ok');
    expect(result.warnings.some((warning) => warning.code === 'OODS-V119')).toBe(false);

    const components = collectComponentNames(result.schema.screens[0] as Record<string, unknown>);
    // Billable's detail extension owns the billing slot after recipe implementation.
    expect(components).toContain('CycleProgressCard');
    expect(components).toContain('StatusTimeline');
    expect(components).toContain('StatusBadge');
    expect(components).toContain('CancellationSummary');
    expect(components).not.toContain('VizAreaPreview');
  });

  it('object-only: synthetic intent generates valid schema', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.meta!.intentSynthetic).toBe(true);
    expect(result.meta!.intentParsed).toBe('Subscription detail view');
  });
});

/* ------------------------------------------------------------------ */
/*  6. Intent auto-detection recognizes object names                   */
/* ------------------------------------------------------------------ */

describe('object-aware compose — intent auto-detection', () => {
  it('Subscription detail view auto-detects object', async () => {
    const result = await handle({
      intent: 'Subscription detail view',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
    expect(result.meta!.objectAutoDetected).toBe('Subscription');
  });

  it('auto-detects context from intent keywords', async () => {
    const result = await handle({
      intent: 'Subscription detail view',
    });
    expect(result.meta!.contextAutoDetected).toBe('detail');
  });

  it('auto-detected list context infers list layout', async () => {
    const result = await handle({
      intent: 'Subscription list page',
    });
    expect(result.layout).toBe('list');
    expect(result.objectUsed!.name).toBe('Subscription');
  });
});

/* ------------------------------------------------------------------ */
/*  7. Unknown object error with suggestion                            */
/* ------------------------------------------------------------------ */

describe('object-aware compose — error handling', () => {
  it('misspelled object returns error with Did you mean suggestion', async () => {
    const result = await handle({
      intent: 'detail view',
      object: 'Subscripion',
      context: 'detail',
    });
    expect(result.status).toBe('error');
    expect(result.errors![0].code).toBe('OODS-N005');
    expect(result.errors![0].hint).toContain('Did you mean');
    expect(result.errors![0].hint).toContain('Subscription');
  });

  it('completely unknown object returns error', async () => {
    const result = await handle({
      intent: 'detail view',
      object: 'XyzNonExistent',
      context: 'detail',
    });
    expect(result.status).toBe('error');
    expect(result.errors![0].code).toBe('OODS-N005');
  });
});

/* ------------------------------------------------------------------ */
/*  8. Backward compatibility                                          */
/* ------------------------------------------------------------------ */

describe('object-aware compose — backward compatibility', () => {
  it('intent-only path still works (no object param)', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed).toBeUndefined();
  });

  it('form intent still works', async () => {
    const result = await handle({ intent: 'user registration form' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');
  });

  it('list intent still works', async () => {
    const result = await handle({ intent: 'searchable product catalog' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('list');
  });

  it('detail intent still works', async () => {
    const result = await handle({ intent: 'product detail page with tabs' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('detail');
  });

  it('all output fields present on intent-only path', async () => {
    const result = await handle({ intent: 'simple dashboard' });
    expect(result.status).toBeDefined();
    expect(result.layout).toBeDefined();
    expect(result.schema).toBeDefined();
    expect(result.selections).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.schemaRef).toBeTruthy();
  });

  it('validation works on both paths', async () => {
    const objectResult = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(objectResult.validation?.status).toBe('ok');

    const intentResult = await handle({
      intent: 'dashboard with metrics',
    });
    expect(intentResult.validation?.status).toBe('ok');
  });
});
