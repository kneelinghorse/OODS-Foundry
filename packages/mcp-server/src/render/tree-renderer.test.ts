import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../schemas/generated.js';
import { renderFragments, renderTree, resolveStyleTokensToCssVars } from './tree-renderer.js';

const schemaFixture: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'screen-home',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'inset-default' },
      style: { spacingToken: 'inset-default' },
      children: [
        {
          id: 'panel-grid',
          component: 'Card',
          layout: { type: 'grid', gapToken: 'cluster-tight' },
          style: { radiusToken: 'md' },
          children: [
            {
              id: 'inline-group',
              component: 'Stack',
              layout: { type: 'inline', align: 'center' },
              style: { colorToken: 'text-primary' },
              children: [
                { id: 'deep-text', component: 'Text', props: { text: 'Deep node' } },
                { id: 'deep-unknown', component: 'NotMappedComponent', props: { priority: 'high' } },
              ],
            },
          ],
        },
        {
          id: 'panel-sidebar',
          component: 'Card',
          layout: { type: 'sidebar', gapToken: 'cluster-default' },
          style: { shadowToken: 'lg' },
          children: [
            { id: 'sidebar-main', component: 'Text', props: { text: 'Main content' } },
            { id: 'sidebar-help', component: 'Badge', props: { label: 'Help' } },
          ],
        },
      ],
    },
    {
      id: 'screen-settings',
      component: 'Card',
      layout: { type: 'section' },
      style: { typographyToken: 'body-default' },
      children: [{ id: 'settings-copy', component: 'Text', props: { text: 'Settings section' } }],
    },
  ],
};

const fragmentFixture: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'fragment-screen',
      component: 'Stack',
      children: [
        {
          id: 'fragment-a',
          component: 'Card',
          children: [
            { id: 'fragment-a-child', component: 'Text', props: { text: 'Nested A' } },
          ],
        },
        {
          id: 'fragment-b',
          component: 'Stack',
          children: [
            { id: 'fragment-b-child', component: 'Badge', props: { label: 'Nested B' } },
          ],
        },
        { id: 'fragment-c', component: 'Text', props: { text: 'Leaf C' } },
      ],
    },
  ],
};

describe('tree-renderer', () => {
  it('recursively renders nested UiSchema trees', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('data-oods-node-id="screen-home"');
    expect(html).toContain('data-oods-node-id="panel-grid"');
    expect(html).toContain('data-oods-node-id="inline-group"');
    expect(html).toContain('data-oods-node-id="deep-text"');

    const rootIndex = html.indexOf('screen-home');
    const middleIndex = html.indexOf('panel-grid');
    const deepIndex = html.indexOf('deep-text');
    expect(rootIndex).toBeGreaterThan(-1);
    expect(middleIndex).toBeGreaterThan(rootIndex);
    expect(deepIndex).toBeGreaterThan(middleIndex);
  });

  it('maps layouts to expected CSS behaviors', () => {
    const html = renderTree(schemaFixture);

    // Stack layout
    expect(html).toContain('display:flex');
    expect(html).toContain('flex-direction:column');
    // Grid layout
    expect(html).toContain('grid-template-columns:repeat(auto-fit, minmax(0, 1fr))');
    // Inline layout
    expect(html).toContain('flex-direction:row');
    // Section layout
    expect(html).toContain('<section data-layout="section" data-layout-node-id="screen-settings"');
    // Sidebar layout
    expect(html).toContain('grid-template-columns:minmax(0, 1fr) minmax(16rem, 24rem)');
    // s213-m01: the sidebar column is a plain region, not a complementary landmark; nested inside a screen's content,
    // an <aside> was the ClassificationPanel axe finding on Evidence, Document and Article.
    expect(html).toContain('<div data-sidebar-aside="true">');
    expect(html).not.toContain('<aside');
  });

  it('resolves style tokens to CSS variable references with sys fallback to ref', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('gap:var(--sys-space-inset-default, var(--ref-space-inset-default))');
    expect(html).toContain('padding:var(--sys-space-inset-default, var(--ref-space-inset-default))');
    expect(html).toContain('border-radius:var(--sys-radius-md, var(--ref-radius-md))');
    expect(html).toContain('box-shadow:var(--sys-shadow-lg, var(--ref-shadow-lg))');
    expect(html).toContain('color:var(--sys-color-text-primary, var(--ref-color-text-primary))');
    expect(html).toContain('font:var(--sys-typography-body-default, var(--ref-typography-body-default))');
  });

  it('uses fallback renderer for unmapped components', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('Unknown component: NotMappedComponent');
    expect(html).toContain('data-oods-fallback="true"');
  });

  it('exports token resolver helper with sys-primary and ref-fallback', () => {
    const resolved = resolveStyleTokensToCssVars({
      spacingToken: 'inset-default',
      radiusToken: 'sm',
      shadowToken: 'md',
      colorToken: 'text-primary',
      typographyToken: 'body-default',
    });

    expect(resolved.padding).toBe('var(--sys-space-inset-default, var(--ref-space-inset-default))');
    expect(resolved['border-radius']).toBe('var(--sys-radius-sm, var(--ref-radius-sm))');
    expect(resolved['box-shadow']).toBe('var(--sys-shadow-md, var(--ref-shadow-md))');
    expect(resolved.color).toBe('var(--sys-color-text-primary, var(--ref-color-text-primary))');
    expect(resolved.font).toBe('var(--sys-typography-body-default, var(--ref-typography-body-default))');
  });

  it('creates fragments for each top-level screen child in a single-screen tree', () => {
    const fragments = renderFragments(fragmentFixture);

    expect(fragments.size).toBe(3);
    expect(Array.from(fragments.keys())).toEqual(['fragment-a', 'fragment-b', 'fragment-c']);
    expect(fragments.get('fragment-a')).toMatchObject({ nodeId: 'fragment-a', component: 'Card' });
    expect(fragments.get('fragment-b')).toMatchObject({ nodeId: 'fragment-b', component: 'Stack' });
    expect(fragments.get('fragment-c')).toMatchObject({ nodeId: 'fragment-c', component: 'Text' });
  });

  it('renders nested fragment subtrees inline without document wrapper tags', () => {
    const fragments = renderFragments(fragmentFixture);
    const fragmentA = fragments.get('fragment-a');

    expect(fragmentA?.html).toContain('data-oods-node-id="fragment-a"');
    expect(fragmentA?.html).toContain('data-oods-node-id="fragment-a-child"');
    expect(fragmentA?.html).not.toContain('<!DOCTYPE html>');
    expect(fragmentA?.html).not.toContain('<html');
    expect(fragmentA?.html).not.toContain('<body');
  });

  it('collects fragments across all screens while excluding screen root nodes', () => {
    const fragments = renderFragments(schemaFixture);

    expect(Array.from(fragments.keys())).toEqual(['panel-grid', 'panel-sidebar', 'settings-copy']);
    expect(fragments.has('screen-home')).toBe(false);
    expect(fragments.has('screen-settings')).toBe(false);
    expect(fragments.get('settings-copy')).toMatchObject({ nodeId: 'settings-copy', component: 'Text' });
  });
});
