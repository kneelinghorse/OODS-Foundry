import { describe, expect, it } from 'vitest';
import type { ComposedObject } from '../../../src/core/composed-object.js';
import { ViewExtensionError } from '../../../src/view/extensions.js';
import { composeDebug } from '../../../src/view/compositor/composeDebug.js';
import {
  type ComposeExtensionsOptions,
  composeExtensions,
  type ExtensionComposition,
  type ViewExtension,
} from '../../../src/view/compositor/composeExtensions.js';

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

const stubComposedObject = {
  id: 'stub',
  name: 'Stub Object',
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

function createContext<Data>(data: Data) {
  return {
    object: stubComposedObject,
    data,
    theme: {
      id: 'default',
      mode: 'light',
      tokens: {},
    },
    permissions: [],
    viewport: {
      width: 1280,
      height: 720,
    },
  };
}

function run(
  extensions: readonly ViewExtension[],
  options?: ComposeExtensionsOptions<{ status: string }>
): ExtensionComposition<{ status: string }> {
  return composeExtensions(extensions, options);
}

describe('composeExtensions', () => {
  it('groups extensions by region and type while preserving order and targets', () => {
    const extensions: ViewExtension[] = [
      createExtension('main-card', { type: 'section', priority: 10 }),
      createExtension('header-primary', {
        region: 'pageHeader',
        type: 'action',
        priority: 5,
      }),
      createExtension('card-modifier', {
        type: 'modifier',
        targetId: 'main-card',
        priority: 15,
      }),
      createExtension('card-wrapper', {
        type: 'wrapper',
        targetId: 'main-card',
        priority: 12,
      }),
      createExtension('secondary-card', { type: 'section', priority: 30 }),
      createExtension('region-modifier', {
        type: 'modifier',
      }),
    ];

    const context = createContext({ status: 'active' });

    const composition = run(extensions, { context });
    const mainPlan = composition.regions.main;

    expect(mainPlan.sections.map((ext) => ext.id)).toEqual(['main-card', 'secondary-card']);
    expect(mainPlan.modifiers.byTarget['main-card']?.map((ext) => ext.id)).toEqual([
      'card-modifier',
    ]);
    expect(mainPlan.modifiers.unbound.map((ext) => ext.id)).toEqual(['region-modifier']);
    expect(mainPlan.wrappers.byTarget['main-card']?.map((ext) => ext.id)).toEqual([
      'card-wrapper',
    ]);

    const headerPlan = composition.regions.pageHeader;
    expect(headerPlan.actions.map((ext) => ext.id)).toEqual(['header-primary']);
  });

  it('deduplicates extensions by id with last definition winning', () => {
    const extensions: ViewExtension[] = [
      createExtension('toolbar-filter', {
        region: 'viewToolbar',
        type: 'section',
        priority: 20,
      }),
      createExtension('toolbar-filter', {
        region: 'contextPanel',
        type: 'section',
        priority: 5,
      }),
    ];

    const composition = run(extensions, { context: createContext({ status: 'active' }) });

    expect(composition.activeExtensions).toHaveLength(1);
    const [winner] = composition.activeExtensions;
    expect(winner.region).toBe('contextPanel');
    expect(composition.regions.viewToolbar.sections).toHaveLength(0);
    expect(composition.regions.contextPanel.sections[0].id).toBe('toolbar-filter');
  });

  it('evaluates conditions and reports inactive extensions', () => {
    const extensions: ViewExtension[] = [
      createExtension('status-banner', {
        conditions: [
          {
            id: 'active-only',
            expression: 'context.data.status === "active"',
          },
        ],
      }),
      createExtension('inactive-warning', {
        conditions: [
          {
            id: 'inactive-only',
            expression: 'context.data.status !== "active"',
          },
        ],
      }),
    ];

    const context = createContext({ status: 'active' });
    const composition = run(extensions, { context });

    expect(composition.activeExtensions.map((ext) => ext.id)).toEqual(['status-banner']);
    expect(composition.inactiveExtensions).toHaveLength(1);
    expect(composition.inactiveExtensions[0]?.extension.id).toBe('inactive-warning');
    expect(composition.inactiveExtensions[0]?.reason).toBe('condition_failed');
    expect(composition.inactiveExtensions[0]?.failedConditions[0]?.id).toBe('inactive-only');
  });

  it('throws when conditions exist but no render context is provided', () => {
    const extensions: ViewExtension[] = [
      createExtension('needs-context', {
        conditions: [
          {
            id: 'requires-context',
            expression: 'context.data.status === "active"',
          },
        ],
      }),
    ];

    expect(() => composeExtensions(extensions)).toThrowError(/no RenderContext was provided/);
    expect(() => composeExtensions(extensions)).toThrowError(ViewExtensionError);
  });

  it('returns deterministic output for identical inputs', () => {
    const extensions: ViewExtension[] = [
      createExtension('alpha', { priority: 10 }),
      createExtension('beta', { priority: 20 }),
    ];

    const context = createContext({ status: 'active' });
    const first = run(extensions, { context });
    const second = run([...extensions], { context });

    expect(second).toStrictEqual(first);
  });
});

describe('composeDebug', () => {
  it('provides metrics snapshot for diagnostics', () => {
    const extensions: ViewExtension[] = [
      createExtension('main-section', { type: 'section' }),
      createExtension('main-action', { type: 'action' }),
      createExtension('wrap-section', { type: 'wrapper', targetId: 'main-section' }),
    ];

    const context = createContext({ status: 'active' });
    const { metrics, composition } = composeDebug(extensions, { context });

    expect(metrics.inputCount).toBe(3);
    expect(metrics.normalizedCount).toBe(3);
    expect(metrics.activeCount).toBe(3);
    expect(metrics.inactiveCount).toBe(0);
    expect(metrics.regions.main.total).toBe(3);
    expect(metrics.regions.main.sections).toBe(1);
    expect(metrics.regions.main.wrappers.total).toBe(1);
    expect(composition.activeExtensions).toHaveLength(3);
  });
});
