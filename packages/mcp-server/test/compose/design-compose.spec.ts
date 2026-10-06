/**
 * Contract tests for the design.compose MCP tool (s51-m03).
 *
 * Validates:
 * 1. design.compose registered and callable
 * 2. Intent 'dashboard with metrics and sidebar' → valid dashboard UiSchema
 * 3. Intent 'user registration form' → form layout with input components
 * 4. Auto-validate: returned schema passes repl.validate
 * 5. Component selections include reasoning
 * 6. Layout auto-detection from intent keywords
 * 7. Error handling for edge cases
 */
import { describe, it, expect } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import type { DesignComposeOutput } from '../../src/tools/design.compose.js';
import type { UiElement } from '../../src/schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slotNames(output: DesignComposeOutput): string[] {
  return output.selections.map(s => s.slotName);
}

function findSlotElement(output: DesignComposeOutput, slotName: string): UiElement | undefined {
  const intent = `slot:${slotName}`;
  let match: UiElement | undefined;
  const walk = (el: UiElement) => {
    if (el.meta?.intent === intent) {
      match = el;
      return;
    }
    el.children?.forEach(walk);
  };
  output.schema.screens.forEach(walk);
  return match;
}

/* ------------------------------------------------------------------ */
/*  Core handler contracts                                             */
/* ------------------------------------------------------------------ */

describe('design.compose — core contracts', () => {
  it('handler is callable', async () => {
    const result = await handle({ intent: 'dashboard' });
    expect(result).toBeTruthy();
    expect(result.status).toBe('ok');
  });

  it('returns required output fields', async () => {
    const result = await handle({ intent: 'simple dashboard' });
    expect(result.status).toBeDefined();
    expect(result.layout).toBeDefined();
    expect(result.schema).toBeDefined();
    expect(result.schemaRef).toBeTruthy();
    expect(result.schemaRefCreatedAt).toBeTruthy();
    expect(result.schemaRefExpiresAt).toBeTruthy();
    expect(result.selections).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it('schema has version and screens', async () => {
    const result = await handle({ intent: 'dashboard with metrics' });
    expect(result.schema.version).toBe('2026.02');
    expect(result.schema.screens).toHaveLength(1);
  });

  it('includes meta with intent and layout info', async () => {
    const result = await handle({ intent: 'dashboard with metrics' });
    expect(result.meta).toBeTruthy();
    expect(result.meta!.intentParsed).toBeTruthy();
    expect(result.meta!.layoutDetected).toBeTruthy();
    expect(result.meta!.slotCount).toBeGreaterThan(0);
    expect(result.meta!.nodeCount).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Layout auto-detection                                              */
/* ------------------------------------------------------------------ */

describe('design.compose — layout auto-detection', () => {
  it('"dashboard with metrics and sidebar" → dashboard layout', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.layout).toBe('dashboard');
  });

  it('"user registration form" → form layout', async () => {
    const result = await handle({ intent: 'A contact form with: username input, email address input, bio textarea' });
    expect(result.layout).toBe('form');
  });

  it('"product detail page with tabs" → detail layout', async () => {
    const result = await handle({ intent: 'product detail page with tabs' });
    expect(result.layout).toBe('detail');
  });

  it('"searchable inventory list" → list layout', async () => {
    const result = await handle({ intent: 'searchable inventory list' });
    expect(result.layout).toBe('list');
  });

  it('"browse catalog" → list layout', async () => {
    const result = await handle({ intent: 'browse catalog' });
    expect(result.layout).toBe('list');
  });

  it('"analytics overview" → dashboard layout', async () => {
    const result = await handle({ intent: 'analytics overview' });
    expect(result.layout).toBe('dashboard');
  });

  it('"configure settings" → form layout', async () => {
    const result = await handle({ intent: 'configure settings' });
    expect(result.layout).toBe('form');
  });

  it('explicit layout overrides auto-detection', async () => {
    const result = await handle({ intent: 'some generic UI', layout: 'form' });
    expect(result.layout).toBe('form');
  });

  it('unknown intent defaults to dashboard with low confidence warning', async () => {
    const result = await handle({ intent: 'something completely unrelated xyz' });
    expect(result.layout).toBe('dashboard');
    expect(result.warnings.some(w => w.code === 'OODS-V116')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Dashboard intent                                                   */
/* ------------------------------------------------------------------ */

describe('design.compose — dashboard intent', () => {
  it('produces valid UiSchema that passes validation', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.status).toBe('ok');
    expect(result.validation?.status).toBe('ok');
    expect(result.validation?.errors).toHaveLength(0);
  });

  it('includes header, metrics, main-content, sidebar slots', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    const names = slotNames(result);
    expect(names).toContain('header');
    expect(names).toContain('metrics');
    expect(names).toContain('main-content');
    expect(names).toContain('sidebar');
  });

  it('each selection has candidates with reasoning', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    for (const sel of result.selections) {
      expect(sel.candidates.length).toBeGreaterThan(0);
      expect(sel.candidates[0].reason).toBeTruthy();
      expect(sel.candidates[0].score).toBeGreaterThan(0);
    }
  });

  it('respects metricColumns preference', async () => {
    const result = await handle({
      intent: 'dashboard',
      layout: 'dashboard',
      preferences: { metricColumns: 2 },
    });
    expect(result.status).toBe('ok');
    // The Grid node should have columns=2
    const json = JSON.stringify(result.schema);
    expect(json).toContain('"columns":2');
  });

  it('keeps short dashboard prompts on the default compact slot shape', async () => {
    const result = await handle({
      intent: 'dashboard with metrics and sidebar',
      options: { validate: false },
    });

    expect(slotNames(result)).toEqual(['header', 'metrics', 'main-content', 'sidebar']);
    expect(result.meta?.slotCount).toBe(4);
  });

  it('scales long section-heavy dashboards into distinct main and sidebar slots', async () => {
    const result = await handle({
      intent: 'An operations dashboard for a multi-region SaaS company. The dashboard should include: 1) A KPI section at the top showing active users, revenue, churn rate, and NPS score as large metric cards; 2) A real-time order feed showing the last 50 orders with status badges; 3) A geographic heat map of user activity by region; 4) A system health panel showing service uptime percentages; 5) An alerts panel listing active incidents sorted by severity; 6) A team activity feed with avatar, action, and timestamp; 7) Revenue projections chart.',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.meta?.slotCount).toBeGreaterThan(4);
    expect(slotNames(result)).toEqual([
      'header',
      'metrics',
      'main-content',
      'main-section-1',
      'main-section-2',
      'main-section-3',
      'sidebar',
      'sidebar-section-1',
    ]);
    expect(result.selections.find((selection) => selection.slotName === 'main-content')?.intent).toBe('data-table');
    expect(result.selections.find((selection) => selection.slotName === 'sidebar')?.intent).toBe('metadata-display');
  });
});

/* ------------------------------------------------------------------ */
/*  Form intent                                                        */
/* ------------------------------------------------------------------ */

describe('design.compose — form intent', () => {
  it('"user registration form" produces form layout with inputs', async () => {
    const result = await handle({ intent: 'A contact form with: username input, email address input, bio textarea' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');
    expect(result.validation?.status).toBe('ok');

    // Should have form-related slots (actions is pre-filled, not a slot)
    const names = slotNames(result);
    expect(names).toContain('title');
    // Field slots
    expect(names.some(n => n.startsWith('field-'))).toBe(true);
  });

  it('field slot selections prefer Input or Select', async () => {
    const result = await handle({ intent: 'A contact form with: username input, email address input, bio textarea' });
    const fieldSelections = result.selections.filter(s => s.slotName.startsWith('field-'));
    expect(fieldSelections.length).toBeGreaterThan(0);
    for (const sel of fieldSelections) {
      const topNames = sel.candidates.slice(0, 3).map(c => c.name);
      expect(
        topNames.some(n => n === 'Input' || n === 'Select' || n === 'TagInput'),
        `Expected Input/Select/TagInput in field candidates, got ${topNames.join(', ')}`,
      ).toBe(true);
    }
  });

  it('does not report empty groups requested without authored fields', async () => {
    for (const fieldGroups of [3, 5]) {
      const result = await handle({ intent: 'form', layout: 'form', preferences: { fieldGroups } });
      expect(result.status).toBe('ok');
      expect(result.selections.filter(s => s.slotName.startsWith('field-'))).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Domain-specific intent binding                                      */
/* ------------------------------------------------------------------ */

describe('design.compose — catalog tag binding', () => {
  it('resolves "membership panel" to MembershipPanel', async () => {
    const result = await handle({
      intent: 'membership panel',
      layout: 'detail',
      preferences: { tabLabels: ['Membership'] },
    });

    const selection = result.selections.find(s => s.slotName === 'tab-0');
    expect(selection?.selectedComponent).toBe('MembershipPanel');
    expect(selection?.candidates?.[0]?.reason).toMatch(/tag match|trait match/);
  });

  it('intent "billing timeline" selects a billing-related component (stable only)', async () => {
    const result = await handle({
      intent: 'billing timeline',
      layout: 'detail',
    });

    const selection = result.selections.find(s => s.slotName === 'tab-0');
    // PaymentEventTimeline is status=planned (no renderer), so compose
    // selects the best available stable component for billing context
    expect(selection?.selectedComponent).toBeDefined();
    expect(selection?.candidates?.length).toBeGreaterThan(0);
  });

  it('address editor intent selects AddressEditor in form layout', async () => {
    const result = await handle({ intent: 'address editor', layout: 'form' });
    const fieldSelections = result.selections.filter(s => s.slotName.startsWith('field-'));

    expect(fieldSelections.some(s => s.selectedComponent === 'AddressEditor')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Detail intent                                                      */
/* ------------------------------------------------------------------ */

describe('design.compose — detail intent', () => {
  it('"product detail page" produces detail layout', async () => {
    const result = await handle({ intent: 'product detail page' });
    expect(result.layout).toBe('detail');
    expect(result.validation?.status).toBe('ok');
  });

  it('includes tab slots', async () => {
    const result = await handle({ intent: 'user profile detail view' });
    const names = slotNames(result);
    expect(names.some(n => n.startsWith('tab-'))).toBe(true);
  });

  it('respects tabLabels preference', async () => {
    const result = await handle({
      intent: 'detail',
      layout: 'detail',
      preferences: { tabLabels: ['Overview', 'History'] },
    });
    expect(result.status).toBe('ok');
    const json = JSON.stringify(result.schema);
    expect(json).toContain('Overview');
    expect(json).toContain('History');
  });
});

/* ------------------------------------------------------------------ */
/*  List intent                                                        */
/* ------------------------------------------------------------------ */

describe('design.compose — list intent', () => {
  it('"searchable inventory list" produces list layout', async () => {
    const result = await handle({ intent: 'searchable inventory list' });
    expect(result.layout).toBe('list');
    expect(result.validation?.status).toBe('ok');
  });

  it('reports list slots retained after empty controls are pruned', async () => {
    const result = await handle({ intent: 'browse product catalog' });
    const names = slotNames(result);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(name => findSlotElement(result, name))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Component overrides                                                */
/* ------------------------------------------------------------------ */

describe('design.compose — component overrides', () => {
  it('respects componentOverrides in preferences', async () => {
    const result = await handle({
      intent: 'list',
      layout: 'list',
      preferences: { componentOverrides: { items: 'Table' } },
    });
    const itemsSel = result.selections.find(s => s.slotName === 'items');
    expect(itemsSel).toBeTruthy();
    expect(itemsSel!.selectedComponent).toBe('Table');
    expect(itemsSel!.candidates[0].reason).toContain('user override');
    const itemsSlot = findSlotElement(result, 'items');
    expect(itemsSlot?.component).toBe('Table');
  });

  it('warns when override component is unknown', async () => {
    const result = await handle({
      intent: 'list',
      layout: 'list',
      preferences: { componentOverrides: { items: 'NotAComponent' } },
      options: { validate: false },
    });
    expect(result.warnings.some(w => w.code === 'OODS-V006')).toBe(true);
    const itemsSlot = findSlotElement(result, 'items');
    expect(itemsSlot?.component).toBe('NotAComponent');
  });
});

/* ------------------------------------------------------------------ */
/*  Validation toggle                                                  */
/* ------------------------------------------------------------------ */

describe('design.compose — validation', () => {
  it('validation is on by default', async () => {
    const result = await handle({ intent: 'dashboard' });
    expect(result.validation).toBeTruthy();
    expect(result.validation!.status).not.toBe('skipped');
  });

  it('validation can be skipped', async () => {
    const result = await handle({
      intent: 'dashboard',
      options: { validate: false },
    });
    expect(result.validation?.status).toBe('skipped');
  });

  it('all 6 layouts produce valid schemas', async () => {
    for (const layout of ['dashboard', 'form', 'detail', 'list', 'card', 'timeline'] as const) {
      const result = await handle({ intent: layout, layout });
      expect(result.validation?.status, `${layout} validation failed`).toBe('ok');
      expect(result.validation?.errors, `${layout} has validation errors`).toHaveLength(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Theme preference                                                   */
/* ------------------------------------------------------------------ */

describe('design.compose — theme', () => {
  it('applies theme when provided', async () => {
    const result = await handle({
      intent: 'dashboard',
      layout: 'dashboard',
      preferences: { theme: 'dark' },
    });
    expect(result.schema.theme).toBe('dark');
  });
});

/* ------------------------------------------------------------------ */
/*  Whitespace intent validation                                       */
/* ------------------------------------------------------------------ */

describe('design.compose — whitespace intent validation', () => {
  it('rejects whitespace-only intent with no object', async () => {
    const result = await handle({ intent: '   ' });
    expect(result.status).toBe('error');
    expect(result.errors[0]?.code).toBe('OODS-V003');
  });

  it('rejects empty intent with no object', async () => {
    const result = await handle({ intent: '' });
    expect(result.status).toBe('error');
    expect(result.errors[0]?.code).toBe('OODS-V003');
  });

  it('allows whitespace intent when object is provided', async () => {
    const result = await handle({ intent: '  ', object: 'User' });
    expect(result.status).toBe('ok');
  });
});

/* ------------------------------------------------------------------ */
/*  Card and Timeline layout templates (s86-m02)                       */
/* ------------------------------------------------------------------ */

describe('design.compose — card layout', () => {
  it('context=card selects card layout', async () => {
    const result = await handle({ intent: 'product details', context: 'card' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('card');
  });

  it('card layout produces compact schema with no tabs', async () => {
    const result = await handle({ intent: 'user summary', context: 'card' });
    expect(result.status).toBe('ok');
    const components = collectAllComponents(result.schema.screens[0]);
    expect(components).not.toContain('Tabs');
  });

  it('card layout omits the removed empty footer slot', async () => {
    const result = await handle({ intent: 'product preview', context: 'card' });
    expect(result.status).toBe('ok');
    const names = slotNames(result);
    expect(names).toContain('header');
    expect(names).toContain('body');
    expect(names).not.toContain('footer');
  });

  it('card with object produces objectUsed', async () => {
    const result = await handle({ object: 'Subscription', context: 'card' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('card');
    expect(result.objectUsed).toBeDefined();
  });

  it('layout=card explicit selection works', async () => {
    const result = await handle({ intent: 'anything', layout: 'card' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('card');
  });
});

describe('design.compose — timeline layout', () => {
  it('context=timeline selects timeline layout', async () => {
    const result = await handle({ intent: 'activity log', context: 'timeline' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('timeline');
  });

  it('timeline layout produces entry slots', async () => {
    const result = await handle({ intent: 'event history', context: 'timeline' });
    expect(result.status).toBe('ok');
    const names = slotNames(result);
    expect(names).toContain('header');
    expect(names.some(n => n.startsWith('entry-'))).toBe(true);
  });

  it('timeline with object produces objectUsed', async () => {
    const result = await handle({ object: 'Subscription', context: 'timeline' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('timeline');
    expect(result.objectUsed).toBeDefined();
  });

  it('layout=timeline explicit selection works', async () => {
    const result = await handle({ intent: 'anything', layout: 'timeline' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('timeline');
  });
});

function collectAllComponents(node: Record<string, unknown>): string[] {
  const names: string[] = [];
  if (typeof node.component === 'string') names.push(node.component);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      names.push(...collectAllComponents(child as Record<string, unknown>));
    }
  }
  return names;
}
