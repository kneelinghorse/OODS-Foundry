import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_EXTENSION_PRIORITY, ViewExtensionError, normalizeViewExtensions } from '../../src/view/extensions.js';
import type { ViewExtension } from '../../src/types/view-extension.js';

function createExtension(
  id: string,
  overrides: Partial<ViewExtension> = {}
): ViewExtension {
  return {
    id,
    region: 'main',
    type: 'section',
    render: () => id,
    ...overrides,
  };
}

describe('normalizeViewExtensions', () => {
  it('applies replace-on-id semantics with last definition winning', () => {
    const first = createExtension('actions', { priority: 10, render: () => 'first' });
    const competing = createExtension('actions', { priority: 5, render: () => 'replacement' });
    const extra = createExtension('summary', { priority: 20 });

    const result = normalizeViewExtensions([first, extra, competing]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('actions');
    expect(result[0].priority).toBe(5);
    expect(result[0].render).toBe(competing.render);
    expect(result[1].id).toBe('summary');
  });

  it('sorts extensions by priority and preserves relative order for ties', () => {
    const extA = createExtension('alpha', { priority: 10 });
    const extB = createExtension('bravo', { priority: 10 });
    const extC = createExtension('charlie', { priority: 30 });

    const result = normalizeViewExtensions([extB, extA, extC]);

    expect(result.map((ext) => ext.id)).toEqual(['bravo', 'alpha', 'charlie']);
  });

  it('uses default priority when none is provided', () => {
    const prioritized = createExtension('header', { priority: 10 });
    const defaulted = createExtension('body');

    const result = normalizeViewExtensions([defaulted, prioritized]);

    expect(DEFAULT_VIEW_EXTENSION_PRIORITY).toBe(50);
    expect(result.map((ext) => ext.id)).toEqual(['header', 'body']);
    expect(result[1].priority).toBeUndefined();
  });

  it('throws when an extension targets an unknown region', () => {
    const invalid = createExtension('bad', {
      region: 'mysteryZone' as unknown as ViewExtension['region'],
    });

    expect(() => normalizeViewExtensions([invalid])).toThrow(ViewExtensionError);
  });

  it('maps legacy region aliases to canonical ids', () => {
    const legacy = createExtension('timeline', {
      region: 'timeline' as unknown as ViewExtension['region'],
    });

    const result = normalizeViewExtensions([legacy]);

    expect(result[0].region).toBe('contextPanel');
  });

  it('is deterministic across repeated normalization passes', () => {
    const source = [
      createExtension('nav', { priority: 15 }),
      createExtension('toolbar', { priority: 15 }),
      createExtension('main-content', { priority: 25 }),
      createExtension('nav', { priority: 5 }),
    ];

    const runOne = normalizeViewExtensions(source);
    const runTwo = normalizeViewExtensions(source);
    const runThree = normalizeViewExtensions([...source]);

    expect(runTwo).toStrictEqual(runOne);
    expect(runThree).toStrictEqual(runOne);
  });
});
