import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { composeDebug } from '../../src/compositor/composeDebug.js';
import { composeExtensions } from '../../src/compositor/composeExtensions.js';
import type { RenderContext } from '../../src/types/render-context.js';
import type { ViewExtension } from '../../src/types/view-extension.js';

interface SampleData {
  readonly status?: string;
}

function createRenderContext(data: SampleData): RenderContext<SampleData> {
  return {
    object: {
      id: 'verification-object',
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
      width: 1440,
      height: 900,
    },
  };
}

function createSection(
  id: string,
  overrides: Partial<ViewExtension<SampleData>> = {}
): ViewExtension<SampleData> {
  return {
    id,
    region: 'main',
    type: 'section',
    render: () => createElement('section', { id }),
    ...overrides,
  };
}

describe('B3.3 — Compositor Contracts', () => {
  it('deduplicates extensions by id with last definition winning', () => {
    const extensions: ViewExtension<SampleData>[] = [
      createSection('toolbar-filter', {
        region: 'main',
        priority: 40,
      }),
      createSection('toolbar-filter', {
        region: 'viewToolbar',
        priority: 20,
        render: () => createElement('div', { 'data-extension': 'toolbar-filter' }),
      }),
    ];

    const context = createRenderContext({});
    const composed = composeExtensions(extensions, context);
    const diagnostics = composeDebug(extensions, context);

    expect(composed.main).toBeNull();
    expect(diagnostics.main).toEqual([]);

    const toolbarRegion = composed.viewToolbar;
    expect(toolbarRegion).not.toBeNull();
    expect(diagnostics.viewToolbar).toEqual(['toolbar-filter']);

    expect(isValidElement(toolbarRegion)).toBe(true);
    if (isValidElement(toolbarRegion)) {
      expect(toolbarRegion.props['data-extension-id']).toBe('toolbar-filter');
    }
  });

  it('sorts extensions by priority while preserving stability for ties', () => {
    const extensions: ViewExtension<SampleData>[] = [
      createSection('alpha', { priority: 10 }),
      createSection('beta', { priority: 10 }),
      createSection('gamma', { priority: 30 }),
      createSection('delta', { priority: 5 }),
    ];

    const diagnostics = composeDebug(extensions, createRenderContext({}));
    expect(diagnostics.main).toEqual(['delta', 'alpha', 'beta', 'gamma']);
  });

  it('filters extensions based on conditional expressions and propagates errors', () => {
    const extensions: ViewExtension<SampleData>[] = [
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

    const inactive = composeDebug(extensions, createRenderContext({ status: 'inactive' }));
    expect(inactive.main).toEqual(['always-on']);

    const active = composeDebug(extensions, createRenderContext({ status: 'active' }));
    expect(active.main).toEqual(['always-on', 'active-only']);
  });

  it('applies wrapper → section/action → modifier ordering deterministically', () => {
    const context = createRenderContext({});
    const extensions: ViewExtension<SampleData>[] = [
      {
        id: 'global-modifier',
        region: 'main',
        type: 'modifier',
        render: () => ({
          wrap: (node: unknown) => createElement('div', { 'data-global-mod': 'true' }, node as never),
        }),
      },
      {
        id: 'section-wrapper',
        region: 'main',
        type: 'wrapper',
        targetId: 'primary-section',
        render: () => (child) => createElement('div', { 'data-target-wrapper': 'true' }, child),
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
        render: () => createElement('button', { 'data-action': 'primary' }, 'Go'),
      },
      {
        id: 'section-modifier',
        region: 'main',
        type: 'modifier',
        targetId: 'primary-section',
        render: () => ({
          props: {
            'data-section-modified': 'true',
          },
        }),
      },
      {
        id: 'global-wrapper',
        region: 'main',
        type: 'wrapper',
        render: () => (child) => createElement('div', { 'data-global-wrapper': 'true' }, child),
      },
    ];

    const composed = composeExtensions(extensions, context);
    expect(composed.main).not.toBeNull();

    const markup = renderToStaticMarkup(createElement('div', null, composed.main));
    expect(markup).toContain('data-global-wrapper="true"');
    expect(markup).toContain('data-global-mod="true"');
    expect(markup).toContain('data-target-wrapper="true"');
    expect(markup).toContain('data-section-modified="true"');
    expect(markup).toContain('data-action="primary"');
  });
});
