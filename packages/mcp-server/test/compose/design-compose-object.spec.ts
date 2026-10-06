/**
 * Contract tests for the object-aware design.compose path (s62-m01).
 *
 * Validates:
 * 1. Object param loads and composes via loadObject/composeObject
 * 2. Context param infers layout (detail→detail, list→list, form→form)
 * 3. Output includes objectUsed block with name, version, traits, fieldsComposed, viewExtensionsApplied
 * 4. Layout inference from context when layout not explicit
 * 5. Explicit layout overrides context inference
 * 6. Unknown object returns error with OODS-N005 code
 * 7. Existing intent-only path remains unaffected (backward compatible)
 */
import { describe, it, expect } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import type { DesignComposeOutput } from '../../src/tools/design.compose.js';

/* ------------------------------------------------------------------ */
/*  Object-aware composition: basic contracts                          */
/* ------------------------------------------------------------------ */

describe('design.compose — object-aware path', () => {
  it('accepts object param and returns objectUsed', async () => {
    const result = await handle({
      intent: 'subscription detail view',
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
  });

  it('objectUsed contains version, traits, fieldsComposed, viewExtensionsApplied', async () => {
    const result = await handle({
      intent: 'subscription detail view',
      object: 'Subscription',
      context: 'detail',
    });
    const ou = result.objectUsed!;
    // Bumped to 2.0.0 in s126-m01: breaking status-enum change (delinquent → past_due + unpaid).
    expect(ou.version).toBe('2.0.0');
    expect(ou.traits).toBeInstanceOf(Array);
    expect(ou.traits.length).toBeGreaterThan(0);
    expect(ou.fieldsComposed).toBeGreaterThan(0);
    expect(typeof ou.viewExtensionsApplied).toBe('object');
  });

  it('Subscription traits include lifecycle/Stateful', async () => {
    const result = await handle({
      intent: 'subscription detail view',
      object: 'Subscription',
      context: 'detail',
    });
    const traitNames = result.objectUsed!.traits;
    // lifecycle/Stateful is present on both core and domain Subscription objects
    expect(traitNames).toContain('lifecycle/Stateful');
    expect(traitNames.length).toBeGreaterThanOrEqual(2);
  });

  it('fieldsComposed reflects merged schema fields from traits + object', async () => {
    const result = await handle({
      intent: 'subscription detail view',
      object: 'Subscription',
      context: 'detail',
    });
    // Subscription has many fields across its 4 traits plus own schema
    expect(result.objectUsed!.fieldsComposed).toBeGreaterThanOrEqual(10);
  });

  it('works with User object', async () => {
    const result = await handle({
      intent: 'user detail view',
      object: 'User',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('User');
  });
});

/* ------------------------------------------------------------------ */
/*  Context → layout inference                                         */
/* ------------------------------------------------------------------ */

describe('design.compose — context layout inference', () => {
  it('context=detail infers detail layout', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.layout).toBe('detail');
    expect(result.meta!.layoutDetected).toContain('context-inferred');
  });

  it('context=list infers list layout', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'list',
    });
    expect(result.layout).toBe('list');
  });

  it('Product list stays registry-valid when composed from first-party traits', async () => {
    const result = await handle({
      object: 'Product',
      context: 'list',
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('list');
    expect(result.validation?.status).toBe('ok');
    expect(JSON.stringify(result.schema)).not.toContain('ActiveFilterChips');
    expect(
      result.selections.some((selection) =>
        selection.candidates.some((candidate) => candidate.name === 'ActiveFilterChips'),
      ),
    ).toBe(false);
  });

  it('context=form infers form layout', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'form',
    });
    expect(result.layout).toBe('form');
  });

  it('context=timeline maps to timeline layout', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'timeline',
    });
    expect(result.layout).toBe('timeline');
  });

  it('context=card maps to card layout', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'card',
    });
    expect(result.layout).toBe('card');
  });

  it('context=inline maps to list layout', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'inline',
    });
    expect(result.layout).toBe('list');
  });

  it('explicit layout overrides context inference', async () => {
    const result = await handle({
      intent: 'subscription view',
      object: 'Subscription',
      context: 'detail',
      layout: 'form',
    });
    expect(result.layout).toBe('form');
    expect(result.meta!.layoutDetected).toContain('explicit');
  });

  it('context without object falls through to intent detection', async () => {
    const result = await handle({
      intent: 'dashboard with metrics',
      context: 'detail',
    });
    // No object → context is ignored, intent-based detection used
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Error handling                                                     */
/* ------------------------------------------------------------------ */

describe('design.compose — object error handling', () => {
  it('unknown object returns error status with OODS-N005', async () => {
    const result = await handle({
      intent: 'detail view',
      object: 'NonExistentObject',
      context: 'detail',
    });
    expect(result.status).toBe('error');
    expect(result.errors).toBeDefined();
    expect(result.errors!.some(e => e.code === 'OODS-N005')).toBe(true);
    expect(result.errors![0].message).toContain('NonExistentObject');
  });

  it('unknown object error includes hint', async () => {
    const result = await handle({
      intent: 'detail view',
      object: 'DoesNotExist',
      context: 'detail',
    });
    expect(result.errors![0].hint).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Backward compatibility                                             */
/* ------------------------------------------------------------------ */

describe('design.compose — backward compatibility', () => {
  it('intent-only path still works (no object param)', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed).toBeUndefined();
  });

  it('all required output fields present on intent-only path', async () => {
    const result = await handle({ intent: 'simple dashboard' });
    expect(result.status).toBeDefined();
    expect(result.layout).toBeDefined();
    expect(result.schema).toBeDefined();
    expect(result.selections).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.schemaRef).toBeTruthy();
  });

  it('validation still works on object-aware path', async () => {
    const result = await handle({
      intent: 'subscription detail view',
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.validation).toBeDefined();
    expect(result.validation!.status).toBe('ok');
  });

  it('validation can be skipped on object-aware path', async () => {
    const result = await handle({
      intent: 'subscription detail view',
      object: 'Subscription',
      context: 'detail',
      options: { validate: false },
    });
    expect(result.validation?.status).toBe('skipped');
  });
});

/* ------------------------------------------------------------------ */
/*  objectSchema bridge (s63-m01)                                      */
/* ------------------------------------------------------------------ */

describe('design.compose — objectSchema bridge', () => {
  it('object-aware compose populates objectSchema on the UiSchema', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.schema.objectSchema).toBeDefined();
    expect(Object.keys(result.schema.objectSchema!).length).toBeGreaterThan(5);
  });

  it('each objectSchema entry has type and required', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    for (const [, entry] of Object.entries(result.schema.objectSchema!)) {
      expect(entry.type).toBeTruthy();
      expect(typeof entry.required).toBe('boolean');
    }
  });

  it('intent-only path has no objectSchema (backward compatible)', async () => {
    const result = await handle({ intent: 'dashboard with metrics' });
    expect(result.schema.objectSchema).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  context bindings (s63-m01)                                         */
/* ------------------------------------------------------------------ */

describe('design.compose — context bindings', () => {
  it('detail context adds onEdit and onDelete bindings', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    const rootBindings = result.schema.screens[0].bindings;
    expect(rootBindings).toBeDefined();
    expect(rootBindings!.onEdit).toBe('handleEdit');
    expect(rootBindings!.onDelete).toBe('handleDelete');
  });

  it('list context adds onRowClick, onSort, onFilter', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'list',
    });
    const rootBindings = result.schema.screens[0].bindings;
    expect(rootBindings!.onRowClick).toBe('handleRowClick');
    expect(rootBindings!.onSort).toBe('handleSort');
    expect(rootBindings!.onFilter).toBe('handleFilter');
  });

  it('form submit belongs to Save while fields own their edits', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'form',
    });
    const rootBindings = result.schema.screens[0].bindings;
    expect(rootBindings!.onSubmit).toBe('handleSubmit');
    expect(rootBindings!.onChange).toBeUndefined();
  });

  it('intent-only path has no bindings (backward compatible)', async () => {
    const result = await handle({ intent: 'dashboard with metrics' });
    expect(result.schema.screens[0].bindings).toBeUndefined();
  });
});
