import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { composeDebug } from '../../src/compositor/composeDebug.js';
import { composeExtensions } from '../../src/compositor/composeExtensions.js';
import type { RenderContext } from '../../src/types/render-context.js';
import type { ViewExtension } from '../../src/types/view-extension.js';

type ExtensionData = {
  readonly status?: string;
};

function createRenderContext(data: ExtensionData): RenderContext<ExtensionData> {
  return {
    object: {
      id: 'demo-object',
      tokens: {},
    },
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

function createSection(
  id: string,
  overrides: Partial<ViewExtension<ExtensionData>> = {}
): ViewExtension<ExtensionData> {
  return {
    id,
    region: 'main',
    type: 'section',
    render: () => id,
    ...overrides,
  };
}

describe('composeExtensions', () => {
  it('deduplicates by id with last definition winning', () => {
    const extensions: ViewExtension<ExtensionData>[] = [
      createSection('toolbar-filter', {
        region: 'main',
        priority: 10,
      }),
      createSection('toolbar-filter', {
        region: 'viewToolbar',
        priority: 5,
        render: () => createElement('span', { id: 'toolbar-filter' }, 'filter'),
      }),
    ];

    const context = createRenderContext({});
    const regions = composeExtensions(extensions, context);
    const diagnostics = composeDebug(extensions, context);

    expect(regions.main).toBeNull();
    expect(diagnostics.main).toEqual([]);

    expect(isValidElement(regions.viewToolbar)).toBe(true);
    expect(diagnostics.viewToolbar).toEqual(['toolbar-filter']);

    const toolbar = regions.viewToolbar;
    if (isValidElement(toolbar)) {
      expect(toolbar.props['data-extension-id']).toBe('toolbar-filter');
    }
  });

  it('maintains stable priority ordering', () => {
    const extensions: ViewExtension<ExtensionData>[] = [
      createSection('gamma', { priority: 70 }),
      createSection('alpha', { priority: 10 }),
      createSection('beta', { priority: 40 }),
    ];

    const diagnostics = composeDebug(extensions, createRenderContext({}));
    expect(diagnostics.main).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('applies wrappers, modifiers, and actions in deterministic order', () => {
    const context = createRenderContext({});

    const extensions: ViewExtension<ExtensionData>[] = [
      {
        id: 'main-wrapper',
        region: 'main',
        type: 'wrapper',
        render: () => (child) => createElement('div', { 'data-region-wrapper': 'true' }, child),
      },
      {
        id: 'main-modifier',
        region: 'main',
        type: 'modifier',
        render: () => ({
          wrap: (node: unknown) =>
            createElement('div', { 'data-region-modifier': 'true' }, node as never),
        }),
      },
      {
        id: 'section-wrapper',
        region: 'main',
        type: 'wrapper',
        targetId: 'primary-section',
        render: () => ({
          wrap: (child: unknown) =>
            createElement('div', { 'data-target-wrapper': 'true' }, child as never),
        }),
      },
      {
        id: 'section-modifier',
        region: 'main',
        type: 'modifier',
        targetId: 'primary-section',
        render: () => ({
          props: {
            'data-modified': 'true',
          },
        }),
      },
      {
        id: 'primary-section',
        region: 'main',
        type: 'section',
        priority: 20,
        render: () => createElement('section', { 'data-section': 'primary' }, 'Primary'),
      },
      {
        id: 'primary-action',
        region: 'main',
        type: 'action',
        priority: 30,
        render: () => createElement('button', { 'data-action': 'primary' }, 'Act'),
      },
    ];

    const regions = composeExtensions(extensions, context);
    expect(regions.main).not.toBeNull();

    const markup = renderToStaticMarkup(createElement('div', null, regions.main));
    expect(markup).toContain('data-region-wrapper="true"');
    expect(markup).toContain('data-region-modifier="true"');
    expect(markup).toContain('data-target-wrapper="true"');
    expect(markup).toContain('data-modified="true"');
    expect(markup).toContain('data-action="primary"');
  });

  it('filters extensions with failing conditions', () => {
    const extensions: ViewExtension<ExtensionData>[] = [
      createSection('active-only', {
        conditions: [
          {
            id: 'is-active',
            expression: 'context.data.status === "active"',
          },
        ],
      }),
      createSection('always-on', {
        priority: 30,
      }),
    ];

    const inactiveContext = createRenderContext({ status: 'inactive' });
    const diagnostics = composeDebug(extensions, inactiveContext);

    expect(diagnostics.main).toEqual(['always-on']);

    const activeContext = createRenderContext({ status: 'active' });
    const activeDiagnostics = composeDebug(extensions, activeContext);

    expect(activeDiagnostics.main).toEqual(['always-on', 'active-only']);
  });
});
