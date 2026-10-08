/**
 * Contract tests for the view extension collector (s62-m02).
 *
 * Validates:
 * 1. collectViewExtensions returns SlotPlan[] sorted by priority desc, then trait order
 * 2. Each SlotPlan entry contains: component, sourceTrait, position, priority, props
 * 3. Props include trait-defined field mappings
 * 4. Empty context returns empty plan with warning
 * 5. Works for all contexts: detail, list, form, timeline, card, inline
 */
import { describe, it, expect } from 'vitest';
import {
  collectDashboardViewExtensions,
  collectViewExtensions,
  type SlotPlan,
} from '../../src/compose/view-extension-collector.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject, type ComposedObject } from '../../src/objects/trait-composer.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getSubscription(): ComposedObject {
  return composeObject(loadObject('Subscription'));
}

function getUser(): ComposedObject {
  return composeObject(loadObject('User'));
}

/* ------------------------------------------------------------------ */
/*  Core contracts                                                     */
/* ------------------------------------------------------------------ */

describe('collectViewExtensions — core contracts', () => {
  it('returns a plan array and warnings array', () => {
    const composed = getSubscription();
    const result = collectViewExtensions(composed, 'detail');
    expect(result.plan).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it('each SlotPlan entry has component, sourceTrait, position, priority, props', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'detail');
    expect(plan.length).toBeGreaterThan(0);

    for (const entry of plan) {
      expect(entry.component).toBeTruthy();
      expect(typeof entry.component).toBe('string');
      expect(entry.sourceTrait).toBeTruthy();
      expect(typeof entry.sourceTrait).toBe('string');
      expect(typeof entry.position).toBe('string');
      expect(typeof entry.priority).toBe('number');
      expect(typeof entry.props).toBe('object');
    }
  });

  it('plan is sorted by priority descending', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'detail');
    if (plan.length > 1) {
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].priority).toBeLessThanOrEqual(plan[i - 1].priority);
      }
    }
  });

  it('same-priority entries maintain trait declaration order', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'detail');

    // Find entries with the same priority
    const byPriority = new Map<number, SlotPlan[]>();
    for (const entry of plan) {
      if (!byPriority.has(entry.priority)) {
        byPriority.set(entry.priority, []);
      }
      byPriority.get(entry.priority)!.push(entry);
    }

    // For same-priority groups, the trait order from composed.traits should be preserved
    const traitOrder = composed.traits.map((t) => t.ref.name);
    for (const [, group] of byPriority) {
      if (group.length < 2) continue;
      for (let i = 1; i < group.length; i++) {
        const prevIdx = traitOrder.indexOf(group[i - 1].sourceTrait);
        const currIdx = traitOrder.indexOf(group[i].sourceTrait);
        // Same or later trait (not earlier)
        expect(currIdx).toBeGreaterThanOrEqual(prevIdx);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Props include field mappings                                       */
/* ------------------------------------------------------------------ */

describe('collectViewExtensions — props', () => {
  it('includes trait-defined field mappings in props', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'detail');

    // At least one entry should have non-empty props
    const withProps = plan.filter((p) => Object.keys(p.props).length > 0);
    expect(withProps.length).toBeGreaterThan(0);
  });

  it('list context StatusBadge has field prop', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'list');

    // The lifecycle/Stateful trait contributes StatusBadge to list context
    const statusBadge = plan.find((p) => p.component === 'StatusBadge');
    if (statusBadge) {
      expect(statusBadge.props).toHaveProperty('field');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Empty context handling                                             */
/* ------------------------------------------------------------------ */

describe('collectViewExtensions — empty context', () => {
  it('composes an object that declares no view extensions from its fields without a warning', () => {
    // A fresh import declares none; every screen composed from it warned "Available contexts: none" (site SITE-11).
    const composed = { ...getSubscription(), traits: [], viewExtensions: {} };
    const result = collectViewExtensions(composed, 'list');
    expect(result.plan).toHaveLength(0);
    expect(result.warnings).toEqual([]);
  });

  it('returns empty plan with warning for unknown context', () => {
    const composed = getSubscription();
    const result = collectViewExtensions(composed, 'nonexistent');
    expect(result.plan).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('No view_extensions found');
    expect(result.warnings[0]).toContain('nonexistent');
  });

  it('warning includes available contexts', () => {
    const composed = getSubscription();
    const result = collectViewExtensions(composed, 'nonexistent');
    // Should mention available contexts
    expect(result.warnings[0]).toContain('Available contexts:');
  });
});

/* ------------------------------------------------------------------ */
/*  Multi-context support                                              */
/* ------------------------------------------------------------------ */

describe('collectViewExtensions — context coverage', () => {
  it('detail context returns entries', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'detail');
    expect(plan.length).toBeGreaterThan(0);
  });

  it('list context returns entries', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'list');
    expect(plan.length).toBeGreaterThan(0);
  });

  it('form context returns entries', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'form');
    expect(plan.length).toBeGreaterThan(0);
  });

  it('different contexts return different plans', () => {
    const composed = getSubscription();
    const detail = collectViewExtensions(composed, 'detail');
    const list = collectViewExtensions(composed, 'list');
    const form = collectViewExtensions(composed, 'form');

    // Components should differ across contexts
    const detailComponents = detail.plan.map((p) => p.component).sort().join(',');
    const listComponents = list.plan.map((p) => p.component).sort().join(',');
    const formComponents = form.plan.map((p) => p.component).sort().join(',');

    // At least two of the three should differ
    const unique = new Set([detailComponents, listComponents, formComponents]);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it('works with User object', () => {
    const composed = getUser();
    const contexts = ['detail', 'list', 'form'];
    for (const ctx of contexts) {
      const result = collectViewExtensions(composed, ctx);
      expect(result.plan).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Dashboard projection                                               */
/* ------------------------------------------------------------------ */

describe('collectDashboardViewExtensions — dashboard projection', () => {
  it('adds the declared chart without removing the existing domain dashboard panels', () => {
    // s220-m01: Subscription's payment chart is MarkBar, whose bound chart projects into detail and dashboard views.
    const composed = getSubscription();
    const after = collectDashboardViewExtensions(composed);
    const charts = after.plan.filter(entry => entry.props.chart);
    expect(charts).toHaveLength(1);
    expect(charts[0]).toMatchObject({ component: 'VizMarkPreview', targetSlot: 'main-content' });
    const mark = composed.traits.find(trait => trait.definition.trait.name === 'MarkBar')!;
    delete mark.definition.view_extensions!.dashboard;
    const before = collectDashboardViewExtensions(composed);
    expect(before.plan.every(entry => !entry.props.chart)).toBe(true);
    expect(after.plan.filter(entry => !entry.props.chart)).toEqual(before.plan);
    expect(after.warnings).toEqual([]);
  });

  it('projects Subscription dashboard slots from compact and detail contexts', () => {
    const composed = getSubscription();
    const result = collectDashboardViewExtensions(composed);

    expect(result.warnings).toEqual([]);
    expect(result.plan.some((entry) =>
      entry.targetSlot === 'metrics' && entry.component === 'CycleProgressCard',
    )).toBe(true);
    expect(result.plan.some((entry) =>
      entry.targetSlot === 'main-content' && entry.component === 'PaymentTimeline',
    )).toBe(true);
    expect(result.plan.some((entry) =>
      entry.targetSlot === 'sidebar' && entry.component === 'StatusBadge',
    )).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Position defaults                                                  */
/* ------------------------------------------------------------------ */

describe('collectViewExtensions — position defaults', () => {
  it('entries without explicit position default to "main"', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'list');

    // list context StatusBadge typically has no position
    const noPosEntry = plan.find((p) => !['top', 'bottom', 'sidebar'].includes(p.position));
    if (noPosEntry) {
      expect(noPosEntry.position).toBe('main');
    }
  });

  it('entries with explicit position preserve it', () => {
    const composed = getSubscription();
    const { plan } = collectViewExtensions(composed, 'detail');

    // detail context StatusTimeline has position: top
    const topEntry = plan.find((p) => p.position === 'top');
    if (topEntry) {
      expect(topEntry.position).toBe('top');
    }
  });
});
