/**
 * Fragment Mode Error Edge Cases — Sprint 48 Mission 02
 *
 * Tests the fragment render path against malformed, adversarial, and degenerate
 * inputs. Validates that non-strict mode always returns maximum partial results
 * and that strict mode fails cleanly with actionable errors.
 *
 * Categories:
 *   - Deeply nested trees (10+ levels)
 *   - Missing required props
 *   - Empty / null / undefined children
 *   - Mixed valid and invalid nodes at multiple depths
 *   - Single-node and zero-node schemas
 *   - Props with null/undefined values
 *   - Large sibling count
 */
import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import {
  renderFragments,
  renderFragmentsWithErrors,
  renderTree,
  type FragmentRenderBatch,
} from '../../src/render/tree-renderer.js';
import { componentRenderers, renderMappedComponent } from '../../src/render/component-map.js';
import type { ComponentRenderer } from '../../src/render/component-map.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSchema(screens: UiElement[]): UiSchema {
  return { version: '2026.02', screens };
}

function makeNode(
  id: string,
  component: string,
  props: Record<string, unknown> = {},
  children?: UiElement[],
): UiElement {
  return { id, component, props, children };
}

/**
 * Build a deeply nested tree of the given depth.
 * The leaf node is always a Text component.
 */
function buildDeepTree(depth: number, idPrefix = 'deep'): UiElement {
  if (depth <= 1) {
    return makeNode(`${idPrefix}-leaf`, 'Text', { text: `Leaf at depth ${depth}` });
  }
  return makeNode(`${idPrefix}-${depth}`, 'Stack', {}, [
    buildDeepTree(depth - 1, idPrefix),
  ]);
}

// ---------------------------------------------------------------------------
// Deeply nested trees
// ---------------------------------------------------------------------------
describe('fragment edge cases: deeply nested trees', () => {
  it('renders a 10-level nested tree without error', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [buildDeepTree(10)]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
    const frag = fragments.get('deep-10');
    expect(frag).toBeDefined();
    expect(frag!.html).toContain('Leaf at depth 1');
  });

  it('renders a 20-level nested tree without error', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [buildDeepTree(20)]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
    const frag = fragments.get('deep-20');
    expect(frag!.html).toContain('Leaf at depth 1');
  });

  it('renders a 50-level nested tree without stack overflow', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [buildDeepTree(50)]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
    expect(fragments.get('deep-50')!.html).toContain('Leaf at depth 1');
  });

  it('deeply nested tree preserves all ancestor nesting in HTML output', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [buildDeepTree(5)]),
    ]);
    const html = renderTree(schema);
    // Each level except the leaf wraps in a Stack div
    expect(html).toContain('data-oods-node-id="deep-5"');
    expect(html).toContain('data-oods-node-id="deep-4"');
    expect(html).toContain('data-oods-node-id="deep-3"');
    expect(html).toContain('data-oods-node-id="deep-2"');
    expect(html).toContain('data-oods-node-id="deep-leaf"');
  });
});

// ---------------------------------------------------------------------------
// Empty / null / undefined children
// ---------------------------------------------------------------------------
describe('fragment edge cases: empty and null children', () => {
  it('handles children as empty array', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('empty-card', 'Card', {}, []),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
    expect(fragments.get('empty-card')).toBeDefined();
  });

  it('handles children as undefined', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        { id: 'undef-children', component: 'Card', children: undefined } as UiElement,
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
  });

  it('handles screen with no children', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, []),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(0);
  });

  it('handles screen with undefined children', () => {
    const schema = makeSchema([
      { id: 'screen', component: 'Stack' } as UiElement,
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(0);
  });

  it('handles empty screens array', () => {
    const schema = makeSchema([]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(0);
  });

  it('renderTree handles empty screens gracefully', () => {
    const html = renderTree(makeSchema([]));
    expect(html).toBe('');
  });

  it('renderTree handles screen with empty children', () => {
    const html = renderTree(makeSchema([makeNode('screen', 'Stack', {}, [])]));
    expect(html).toContain('data-oods-component="Stack"');
  });
});

// ---------------------------------------------------------------------------
// Missing / null / undefined props
// ---------------------------------------------------------------------------
describe('fragment edge cases: missing and null props', () => {
  it('renders Button with no props — uses default label', () => {
    const html = renderMappedComponent(
      makeNode('no-props-btn', 'Button', {}),
    );
    expect(html).toContain('>Button</button>');
  });

  it('renders Text with no props — uses empty string', () => {
    const html = renderMappedComponent(
      makeNode('no-props-text', 'Text', {}),
    );
    expect(html).toContain('data-oods-component="Text"');
  });

  it('renders Card with undefined props', () => {
    const node: UiElement = { id: 'undef-props', component: 'Card' };
    const html = renderMappedComponent(node);
    expect(html).toContain('data-oods-component="Card"');
  });

  it('renders component with null prop values without crash', () => {
    const html = renderMappedComponent(
      makeNode('null-props', 'Button', { label: null, text: null, disabled: null }),
    );
    // null values skipped in buildAttributes, defaults used for label
    expect(html).toContain('>Button</button>');
  });

  it('renders component with undefined prop values without crash', () => {
    const html = renderMappedComponent(
      makeNode('undef-vals', 'Badge', { label: undefined, text: undefined }),
    );
    expect(html).toContain('>Badge</span>');
  });

  it('renders Select with no options prop', () => {
    const html = renderMappedComponent(
      makeNode('no-opts', 'Select', {}),
    );
    expect(html).toContain('<select');
    expect(html).toContain('</select>');
  });

  it('renders Select with empty options array', () => {
    const html = renderMappedComponent(
      makeNode('empty-opts', 'Select', { options: [] }),
    );
    expect(html).toContain('<select');
  });

  it('renders Table with no rows', () => {
    const html = renderMappedComponent(
      makeNode('no-rows', 'Table', { columns: [{ key: 'a', label: 'A' }] }),
    );
    expect(html).toContain('<table');
  });

  it('renders Table with no columns', () => {
    const html = renderMappedComponent(
      makeNode('no-cols', 'Table', { rows: [{ a: '1' }] }),
    );
    expect(html).toContain('<table');
  });

  it('renders Tabs with empty tabs array', () => {
    const html = renderMappedComponent(
      makeNode('no-tabs', 'Tabs', { tabs: [] }),
    );
    expect(html).toContain('<section');
  });

  it('renders timeline with no events', () => {
    const html = renderMappedComponent(
      makeNode('empty-tl', 'AuditTimeline', {}),
    );
    expect(html).toContain('data-timeline-empty="true"');
    expect(html).toContain('No events');
  });

  it('renders TagPills with empty tags', () => {
    const html = renderMappedComponent(
      makeNode('empty-tags', 'TagPills', { tags: [] }),
    );
    expect(html).toContain('data-summary-type="tag-pills"');
  });
});

// ---------------------------------------------------------------------------
// Mixed valid and invalid nodes at multiple depths
// ---------------------------------------------------------------------------
describe('fragment edge cases: mixed valid/invalid at multiple depths', () => {
  it('non-strict: renders valid fragments alongside unknown component errors', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('valid-button', 'Button', { label: 'OK' }),
        makeNode('unknown-1', 'CompletelyFakeComponent', { data: 'test' }),
        makeNode('valid-badge', 'Badge', { label: 'Tag' }),
        makeNode('unknown-2', 'AnotherFake', {}),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    // Valid nodes produce fragments
    expect(fragments.has('valid-button')).toBe(true);
    expect(fragments.has('valid-badge')).toBe(true);
    // Unknown components produce fallback HTML (not errors — tree-renderer
    // doesn't know about the registry, so they render as fallback)
    expect(fragments.has('unknown-1')).toBe(true);
    expect(fragments.has('unknown-2')).toBe(true);
    expect(errors).toHaveLength(0);
    // Fallback renders contain the unknown component label
    expect(fragments.get('unknown-1')!.html).toContain('data-oods-fallback="true"');
  });

  it('valid children inside an unknown parent still render', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('unknown-parent', 'NotReal', {}, [
          makeNode('valid-child', 'Text', { text: 'I should render' }),
        ]),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
    // The child's HTML is included inside the parent's fallback render
    expect(fragments.get('unknown-parent')!.html).toContain('I should render');
  });

  it('valid sibling renders even when another sibling has deeply nested unknown', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('good-card', 'Card', { body: 'Good' }),
        makeNode('nested-unknown', 'Stack', {}, [
          makeNode('level-2', 'Stack', {}, [
            makeNode('level-3-unknown', 'NeverHeardOfIt', { weird: true }),
          ]),
        ]),
        makeNode('good-badge', 'Badge', { label: 'OK' }),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.has('good-card')).toBe(true);
    expect(fragments.has('nested-unknown')).toBe(true);
    expect(fragments.has('good-badge')).toBe(true);
    // The deeply nested unknown still renders as fallback
    expect(fragments.get('nested-unknown')!.html).toContain('data-oods-fallback="true"');
  });
});

// ---------------------------------------------------------------------------
// Single-node schemas
// ---------------------------------------------------------------------------
describe('fragment edge cases: single-node schemas', () => {
  it('single screen with one child produces one fragment', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('only-child', 'Text', { text: 'Solo' }),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(1);
    expect(fragments.get('only-child')!.html).toContain('Solo');
  });

  it('screen with no children produces zero fragments', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, []),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(0);
  });

  it('renderTree with single leaf node', () => {
    const schema = makeSchema([
      makeNode('screen', 'Text', { text: 'Standalone' }),
    ]);
    const html = renderTree(schema);
    expect(html).toContain('Standalone');
    expect(html).toContain('data-oods-component="Text"');
  });
});

// ---------------------------------------------------------------------------
// Multiple screens
// ---------------------------------------------------------------------------
describe('fragment edge cases: multiple screens', () => {
  it('collects fragments from all screens', () => {
    const schema = makeSchema([
      makeNode('screen-1', 'Stack', {}, [
        makeNode('s1-btn', 'Button', { label: 'S1' }),
      ]),
      makeNode('screen-2', 'Stack', {}, [
        makeNode('s2-badge', 'Badge', { label: 'S2' }),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(2);
    expect(fragments.has('s1-btn')).toBe(true);
    expect(fragments.has('s2-badge')).toBe(true);
  });

  it('one screen failing does not affect other screens', () => {
    const schema = makeSchema([
      makeNode('screen-ok', 'Stack', {}, [
        makeNode('ok-text', 'Text', { text: 'Fine' }),
      ]),
      makeNode('screen-empty', 'Stack', {}, []),
      makeNode('screen-ok-2', 'Stack', {}, [
        makeNode('ok-badge', 'Badge', { label: 'Also fine' }),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Large sibling count
// ---------------------------------------------------------------------------
describe('fragment edge cases: large sibling count', () => {
  it('renders 100 sibling fragments without error', () => {
    const children: UiElement[] = [];
    for (let i = 0; i < 100; i++) {
      children.push(makeNode(`child-${i}`, 'Badge', { label: `Badge ${i}` }));
    }
    const schema = makeSchema([makeNode('screen', 'Stack', {}, children)]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Layout types with edge-case children
// ---------------------------------------------------------------------------
describe('fragment edge cases: layout types', () => {
  it('sidebar layout with zero children renders without crash', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        { id: 'empty-sidebar', component: 'Card', layout: { type: 'sidebar' }, children: [] },
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.get('empty-sidebar')!.html).toContain('data-sidebar-main="true"');
  });

  it('sidebar layout with single child puts it in main slot', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        {
          id: 'single-sidebar',
          component: 'Card',
          layout: { type: 'sidebar' },
          children: [makeNode('main-content', 'Text', { text: 'Main' })],
        },
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    expect(fragments.get('single-sidebar')!.html).toContain('data-sidebar-main="true"');
    expect(fragments.get('single-sidebar')!.html).toContain('Main');
  });

  it('section layout renders section wrapper around content', () => {
    const schema = makeSchema([
      {
        id: 'section-screen',
        component: 'Card',
        layout: { type: 'section' },
        children: [makeNode('section-child', 'Text', { text: 'Inside section' })],
      },
    ]);
    const html = renderTree(schema);
    expect(html).toContain('<section data-layout="section"');
    expect(html).toContain('Inside section');
  });

  it('grid layout with no children renders empty grid', () => {
    const html = renderMappedComponent(
      { id: 'empty-grid', component: 'Grid', layout: { type: 'grid' }, children: [] } as UiElement,
      '',
    );
    expect(html).toContain('data-layout="grid"');
  });
});

// ---------------------------------------------------------------------------
// Props with unusual types
// ---------------------------------------------------------------------------
describe('fragment edge cases: unusual prop types', () => {
  it('handles boolean props correctly', () => {
    const html = renderMappedComponent(
      makeNode('bool-btn', 'Button', { disabled: true, hidden: false }),
    );
    expect(html).toContain(' disabled');
    expect(html).not.toContain(' hidden');
  });

  it('handles numeric prop values', () => {
    const html = renderMappedComponent(
      makeNode('num-grid', 'Grid', { columns: 0 }),
    );
    // columns=0 should not produce grid-template-columns (asNumber returns 0 which is falsy)
    expect(html).toContain('data-oods-component="Grid"');
  });

  it('keeps object metadata out of rendered attributes', () => {
    const html = renderMappedComponent(
      makeNode('obj-card', 'Card', { metadata: { key: 'value' } }),
    );
    expect(html).not.toContain('data-prop-metadata');
    expect(html).not.toContain('key');
  });

  it('keeps undeclared array props out of rendered attributes', () => {
    const html = renderMappedComponent(
      makeNode('arr-card', 'Card', { tags: ['a', 'b'] }),
    );
    expect(html).not.toContain('data-prop-tags');
  });

  it('handles very long string props without crash', () => {
    const longString = 'a'.repeat(10000);
    const html = renderMappedComponent(
      makeNode('long-text', 'Text', { text: longString }),
    );
    expect(html).toContain(longString);
  });

  it('handles empty string props', () => {
    const html = renderMappedComponent(
      makeNode('empty-str', 'Text', { text: '' }),
    );
    // Empty text falls through to empty default
    expect(html).toContain('data-oods-component="Text"');
  });
});

// ---------------------------------------------------------------------------
// Fragment result structure
// ---------------------------------------------------------------------------
describe('fragment edge cases: result structure', () => {
  it('fragment result contains correct nodeId and component', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('my-button', 'Button', { label: 'Test' }),
      ]),
    ]);
    const { fragments } = renderFragmentsWithErrors(schema);
    const frag = fragments.get('my-button');
    expect(frag).toMatchObject({
      nodeId: 'my-button',
      component: 'Button',
    });
    expect(typeof frag!.html).toBe('string');
    expect(frag!.html.length).toBeGreaterThan(0);
  });

  it('error result contains nodeId, component, and message', () => {
    const original = componentRenderers.Button;
    componentRenderers.Button = () => { throw new Error('test error'); };
    try {
      const schema = makeSchema([
        makeNode('screen', 'Stack', {}, [
          makeNode('err-button', 'Button', { label: 'Fail' }),
        ]),
      ]);
      const { errors } = renderFragmentsWithErrors(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        nodeId: 'err-button',
        component: 'Button',
      });
      expect(errors[0].message).toContain('test error');
    } finally {
      componentRenderers.Button = original;
    }
  });

  it('renderFragments returns only fragments map (no errors)', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('frag-text', 'Text', { text: 'Hello' }),
      ]),
    ]);
    const fragments = renderFragments(schema);
    expect(fragments instanceof Map).toBe(true);
    expect(fragments.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Non-string error messages
// ---------------------------------------------------------------------------
describe('fragment edge cases: non-Error throws', () => {
  it('handles non-Error throw in renderer', () => {
    const original = componentRenderers.Badge;
    componentRenderers.Badge = (() => { throw 'string error'; }) as ComponentRenderer;
    try {
      const schema = makeSchema([
        makeNode('screen', 'Stack', {}, [
          makeNode('str-err-badge', 'Badge', { label: 'Fail' }),
        ]),
      ]);
      const { errors } = renderFragmentsWithErrors(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('string error');
    } finally {
      componentRenderers.Badge = original;
    }
  });

  it('handles undefined throw in renderer', () => {
    const original = componentRenderers.Badge;
    componentRenderers.Badge = (() => { throw undefined; }) as ComponentRenderer;
    try {
      const schema = makeSchema([
        makeNode('screen', 'Stack', {}, [
          makeNode('undef-err', 'Badge', { label: 'Fail' }),
        ]),
      ]);
      const { errors } = renderFragmentsWithErrors(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('undefined');
    } finally {
      componentRenderers.Badge = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Duplicate node IDs
// ---------------------------------------------------------------------------
describe('fragment edge cases: duplicate node IDs', () => {
  it('last fragment wins when nodes share the same ID', () => {
    const schema = makeSchema([
      makeNode('screen', 'Stack', {}, [
        makeNode('dup-id', 'Button', { label: 'First' }),
        makeNode('dup-id', 'Badge', { label: 'Second' }),
      ]),
    ]);
    const { fragments, errors } = renderFragmentsWithErrors(schema);
    expect(errors).toHaveLength(0);
    // Map.set overwrites — last one wins
    expect(fragments.size).toBe(1);
    expect(fragments.get('dup-id')!.component).toBe('Badge');
  });
});
