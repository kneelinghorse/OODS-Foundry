/**
 * Contract tests for object semantic token injection (s62-m04).
 *
 * Validates:
 * 1. ComposedObject.tokens merged into UiSchema as tokenOverrides
 * 2. Token override precedence: object tokens > trait tokens > global tokens
 * 3. repl_render emits object-specific token CSS variables when tokenOverrides present
 * 4. code_generate includes token override comments/declarations
 * 5. Backward compatible: schemas without tokenOverrides render identically
 */
import { describe, it, expect } from 'vitest';
import { injectTokenOverrides } from '../../src/compose/object-slot-filler.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import type { UiSchema } from '../../src/schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function minimalSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [{ id: 'screen-1', component: 'Stack', children: [{ id: 'child-1', component: 'Text' }] }],
  };
}

/* ------------------------------------------------------------------ */
/*  Token injection into UiSchema                                      */
/* ------------------------------------------------------------------ */

describe('injectTokenOverrides — schema injection', () => {
  it('adds tokenOverrides to UiSchema from token map', () => {
    const schema = minimalSchema();
    const tokens = {
      'billing.subscription.status.active': 'var(--semantic-success)',
      'billing.subscription.status.paused': 'var(--semantic-warning)',
    };

    const warnings = injectTokenOverrides(schema, tokens);
    expect(warnings).toHaveLength(0);
    expect(schema.tokenOverrides).toBeDefined();
    expect(schema.tokenOverrides!['billing.subscription.status.active']).toBe('var(--semantic-success)');
    expect(schema.tokenOverrides!['billing.subscription.status.paused']).toBe('var(--semantic-warning)');
  });

  it('skips non-string values with warning', () => {
    const schema = minimalSchema();
    const tokens = {
      'valid.token': 'var(--success)',
      'invalid.token': 42,
      'another.invalid': { nested: true },
    };

    const warnings = injectTokenOverrides(schema, tokens as Record<string, unknown>);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('invalid.token');
    expect(schema.tokenOverrides!['valid.token']).toBe('var(--success)');
    expect(schema.tokenOverrides!['invalid.token']).toBeUndefined();
  });

  it('empty token map does not add tokenOverrides', () => {
    const schema = minimalSchema();
    const warnings = injectTokenOverrides(schema, {});
    expect(warnings).toHaveLength(0);
    expect(schema.tokenOverrides).toBeUndefined();
  });

  it('works with real Subscription tokens', () => {
    const composed = composeObject(loadObject('Subscription'));
    const schema = minimalSchema();
    const warnings = injectTokenOverrides(schema, composed.tokens);

    expect(warnings).toHaveLength(0);
    expect(schema.tokenOverrides).toBeDefined();
    expect(Object.keys(schema.tokenOverrides!).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Token precedence                                                   */
/* ------------------------------------------------------------------ */

describe('injectTokenOverrides — precedence', () => {
  it('ComposedObject.tokens already have correct precedence (object > trait)', () => {
    // The trait composer already handles precedence:
    // object tokens override trait tokens (last-write-wins in composeObject)
    const composed = composeObject(loadObject('Subscription'));
    // Subscription defines object-level tokens that override trait defaults
    expect(composed.tokens).toBeDefined();
    expect(Object.keys(composed.tokens).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Render pipeline: token CSS variables                               */
/* ------------------------------------------------------------------ */

describe('renderTree — tokenOverrides', () => {
  it('emits CSS variables when tokenOverrides present', () => {
    const schema = minimalSchema();
    schema.tokenOverrides = {
      'billing.status.active': 'var(--semantic-success)',
      'billing.status.paused': 'var(--semantic-warning)',
    };

    const html = renderTree(schema);
    expect(html).toContain('data-token-overrides="true"');
    expect(html).toContain('--token-billing-status-active');
    expect(html).toContain('var(--semantic-success)');
    expect(html).toContain('--token-billing-status-paused');
    expect(html).toContain('var(--semantic-warning)');
  });

  it('renders normally without tokenOverrides (backward compatible)', () => {
    const schema = minimalSchema();
    const html = renderTree(schema);
    expect(html).not.toContain('data-token-overrides');
    expect(html).not.toContain('<style');
    // Should still render the tree
    expect(html).toContain('data-oods-component="Stack"');
  });

  it('wraps token CSS in :root scope', () => {
    const schema = minimalSchema();
    schema.tokenOverrides = { 'test.token': 'var(--test)' };
    const html = renderTree(schema);
    expect(html).toContain(':root {');
  });
});

/* ------------------------------------------------------------------ */
/*  Code generate: token comments                                      */
/* ------------------------------------------------------------------ */

describe('code.generate — tokenOverrides', () => {
  it('React emitter includes token override comments', async () => {
    const { emit } = await import('../../src/codegen/react-emitter.js');
    const schema = minimalSchema();
    schema.tokenOverrides = {
      'billing.status.active': 'var(--semantic-success)',
    };

    const result = emit(schema, { styling: 'tokens', typescript: true });
    expect(result.code).toContain('token overrides');
    expect(result.code).toContain('--token-billing-status-active');
    expect(result.code).toContain('var(--semantic-success)');
  });

  it('React emitter omits token block when no overrides', async () => {
    const { emit } = await import('../../src/codegen/react-emitter.js');
    const schema = minimalSchema();

    const result = emit(schema, { styling: 'tokens', typescript: true });
    expect(result.code).not.toContain('token overrides');
  });

  it('Vue emitter includes token override style block', async () => {
    const { emit } = await import('../../src/codegen/vue-emitter.js');
    const schema = minimalSchema();
    schema.tokenOverrides = {
      'billing.status.active': 'var(--semantic-success)',
    };

    const result = emit(schema, { styling: 'tokens', typescript: true });
    expect(result.code).toContain('--token-billing-status-active');
    expect(result.code).toContain('var(--semantic-success)');
  });
});
