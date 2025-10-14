import { describe, expect, it } from 'vitest';
import { createRenderContext } from '../../src/view/context.js';
import type { ComposedObject } from '../../src/core/composed-object.js';

const stubComposedObject = {
  id: 'TestObject',
  name: 'Test Object',
  traits: [],
  schema: {},
  semantics: {},
  viewExtensions: {},
  tokens: {},
  actions: [],
  metadata: {
    composedAt: new Date(),
    traitOrder: [],
    traitCount: 0,
    provenance: new Map(),
    collisions: [],
    warnings: [],
  },
} as unknown as ComposedObject;

describe('createRenderContext', () => {
  it('freezes the resulting context object and nested structures', () => {
    const context = createRenderContext({
      object: stubComposedObject,
      data: { id: '123' },
      theme: {
        id: 'default',
        mode: 'light',
        tokens: { 'region.main.bg': '#fff' },
      },
      permissions: ['viewer'],
      viewport: {
        width: 1440,
        height: 900,
      },
    });

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.theme)).toBe(true);
    expect(Object.isFrozen(context.permissions)).toBe(true);
    expect(Object.isFrozen(context.viewport)).toBe(true);
  });

  it('copies permission arrays to avoid external mutation', () => {
    const permissions = ['objects:view'];

    const context = createRenderContext({
      object: stubComposedObject,
      data: {},
      theme: {
        id: 'default',
        mode: 'dark',
        tokens: {},
      },
      permissions,
      viewport: {
        width: 1024,
        height: 768,
      },
    });

    permissions.push('objects:edit');

    expect(context.permissions.includes('objects:edit')).toBe(false);
    expect(Object.isFrozen(context.permissions)).toBe(true);
  });
});
