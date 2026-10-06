import { describe, expect, it } from 'vitest';
import { componentRenderers } from '../../src/render/component-map.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { renderFragments, renderTree } from '../../src/render/tree-renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSchema(children: UiSchema['screens'][0]['children']): UiSchema {
  return {
    version: '2026.02',
    screens: [{
      id: 'edge-screen',
      component: 'Stack',
      children: children ?? [],
    }],
  };
}

async function renderFull(schema: UiSchema) {
  return renderHandle({ mode: 'full', schema, apply: true });
}

async function renderFragment(schema: UiSchema) {
  return renderHandle({
    mode: 'full',
    schema,
    apply: true,
    output: { format: 'fragments', strict: false },
  });
}

// ---------------------------------------------------------------------------
// All-optional props: components that render with empty props
// ---------------------------------------------------------------------------

describe('renderer edge cases: all-optional props (defaults work)', () => {
  const optionalPropComponents = ['Stack', 'Card', 'Badge', 'Text', 'Banner'];

  for (const component of optionalPropComponents) {
    it(`${component} renders with empty props object`, async () => {
      const schema = makeSchema([
        { id: `empty-props-${component.toLowerCase()}`, component, props: {} },
      ]);
      const result = await renderFull(schema);
      expect(result.status).toBe('ok');
      expect(result.html).toContain(`data-oods-node-id="empty-props-${component.toLowerCase()}"`);
    });
  }

  it('Stack renders with no props and no children', async () => {
    const schema = makeSchema([
      { id: 'bare-stack', component: 'Stack', props: {} },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-node-id="bare-stack"');
  });

  it('Card renders with no props and produces non-empty html', async () => {
    const schema = makeSchema([
      { id: 'bare-card', component: 'Card', props: {} },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-node-id="bare-card"');
  });
});

// ---------------------------------------------------------------------------
// Children vs childless
// ---------------------------------------------------------------------------

describe('renderer edge cases: children vs childless', () => {
  it('Button renders differently with children vs without', async () => {
    const withoutChildren = makeSchema([
      { id: 'btn-no-child', component: 'Button', props: { label: 'Click' } },
    ]);
    const withChildren = makeSchema([
      {
        id: 'btn-with-child',
        component: 'Button',
        props: { label: 'Click' },
        children: [
          { id: 'btn-inner', component: 'Badge', props: { label: 'New' } },
        ],
      },
    ]);

    const r1 = await renderFull(withoutChildren);
    const r2 = await renderFull(withChildren);
    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    // With children, the child's node should appear in output
    expect(r2.html).toContain('data-oods-node-id="btn-inner"');
  });

  it('Card renders children over body prop when both present', async () => {
    const schema = makeSchema([
      {
        id: 'card-override',
        component: 'Card',
        props: { body: 'Ignored body' },
        children: [
          { id: 'card-child', component: 'Text', props: { text: 'Child text' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-node-id="card-child"');
  });

  it('Input renders as leaf even if children are provided', async () => {
    const schema = makeSchema([
      {
        id: 'input-leaf',
        component: 'Input',
        props: { label: 'Name' },
        children: [
          { id: 'input-rogue-child', component: 'Text', props: { text: 'Should not appear' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-node-id="input-leaf"');
  });

  it('Stack with deeply nested children renders all descendants', async () => {
    const schema = makeSchema([
      {
        id: 'depth-0',
        component: 'Stack',
        props: {},
        children: [{
          id: 'depth-1',
          component: 'Card',
          props: {},
          children: [{
            id: 'depth-2',
            component: 'Text',
            props: { text: 'Deep' },
          }],
        }],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-node-id="depth-0"');
    expect(result.html).toContain('data-oods-node-id="depth-1"');
    expect(result.html).toContain('data-oods-node-id="depth-2"');
  });
});

// ---------------------------------------------------------------------------
// Layout props: Grid
// ---------------------------------------------------------------------------

describe('renderer edge cases: Grid layout props', () => {
  it('Grid renders with default column layout when no props given', async () => {
    const schema = makeSchema([
      {
        id: 'grid-default',
        component: 'Grid',
        props: {},
        children: [
          { id: 'grid-item-a', component: 'Text', props: { text: 'A' } },
          { id: 'grid-item-b', component: 'Text', props: { text: 'B' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-node-id="grid-default"');
    expect(result.html).toContain('display:grid');
    // s221-m01: no column count, no maximum; an empty data-max-columns matched the maximum rule with no count (one column).
    expect(result.html).not.toMatch(/id="grid-default"[^>]*data-max-columns/);
  });

  it('Grid respects explicit columns prop', async () => {
    const schema = makeSchema([
      {
        id: 'grid-cols',
        component: 'Grid',
        props: { columns: 3 },
        children: [
          { id: 'gc-1', component: 'Text', props: { text: '1' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    // s221-m01: a column count is a maximum since #2418 (after #2226): the element carries the count and the document's
    // shipped Grid rule lays it out, instead of a fixed inline repeat(3, ...).
    expect(result.html).toContain('<div id="grid-cols" style="display:grid;--oods-grid-columns:3"');
    expect(result.html).toMatch(/id="grid-cols"[^>]*data-max-columns="3"/);
    expect(result.html).toContain("[data-oods-component='Grid'][data-max-columns]");
  });

  it('Grid respects explicit rows prop', async () => {
    const schema = makeSchema([
      {
        id: 'grid-rows',
        component: 'Grid',
        props: { rows: 2 },
        children: [
          { id: 'gr-1', component: 'Text', props: { text: '1' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('repeat(2');
  });

  it('Grid applies gap token as CSS variable', async () => {
    const schema = makeSchema([
      {
        id: 'grid-gap',
        component: 'Grid',
        props: { gap: 'cluster-tight' },
        children: [
          { id: 'gg-1', component: 'Text', props: { text: '1' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    // s206-m01: 'cluster-tight' resolves to the scale's sm leaf; --ref-space-cluster-tight was never defined.
    expect(result.html).toContain('var(--ref-space-scale-sm)');
  });

  it('Grid applies separate columnGap and rowGap', async () => {
    const schema = makeSchema([
      {
        id: 'grid-gaps',
        component: 'Grid',
        props: { columnGap: 'cluster-tight', rowGap: 'inset-default' },
        children: [
          { id: 'gx-1', component: 'Text', props: { text: '1' } },
        ],
      },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('var(--ref-space-scale-sm)');
    expect(result.html).toContain('var(--ref-space-inset-default)');
  });
});

// ---------------------------------------------------------------------------
// Fragment vs document mode differences
// ---------------------------------------------------------------------------

describe('renderer edge cases: fragment vs document mode', () => {
  it('document mode wraps output in <!DOCTYPE html>', async () => {
    const schema = makeSchema([
      { id: 'doc-text', component: 'Text', props: { text: 'Hello' } },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.fragments).toBeUndefined();
  });

  it('fragment mode omits document wrapper', async () => {
    const schema = makeSchema([
      { id: 'frag-text', component: 'Text', props: { text: 'Hello' } },
    ]);
    const result = await renderFragment(schema);
    expect(result.status).toBe('ok');
    expect(result.fragments).toBeDefined();
    for (const frag of Object.values(result.fragments ?? {})) {
      expect(frag.html).not.toContain('<!DOCTYPE html>');
      expect(frag.html).not.toContain('<html');
      expect(frag.html).not.toContain('<body');
    }
  });

  it('same schema produces equivalent node IDs in both modes', async () => {
    const schema = makeSchema([
      { id: 'shared-node', component: 'Badge', props: { label: 'Test' } },
    ]);
    const docResult = await renderFull(schema);
    const fragResult = await renderFragment(schema);

    expect(docResult.html).toContain('data-oods-node-id="shared-node"');
    expect(fragResult.fragments?.['shared-node']?.nodeId).toBe('shared-node');
    expect(fragResult.fragments?.['shared-node']?.html).toContain('data-oods-node-id="shared-node"');
  });

  it('fragment mode produces cssRefs that resolve to css map entries', async () => {
    const schema = makeSchema([
      { id: 'css-node', component: 'Card', props: { body: 'CSS test' } },
    ]);
    const result = await renderFragment(schema);
    expect(result.status).toBe('ok');
    for (const frag of Object.values(result.fragments ?? {})) {
      for (const ref of frag.cssRefs) {
        expect(result.css?.[ref]).toBeDefined();
      }
    }
  });

  it('Grid renders in fragment mode with layout styles', async () => {
    const schema = makeSchema([
      {
        id: 'frag-grid',
        component: 'Grid',
        props: { columns: 2, gap: 'cluster-tight' },
        children: [
          { id: 'fg-1', component: 'Text', props: { text: 'A' } },
          { id: 'fg-2', component: 'Text', props: { text: 'B' } },
        ],
      },
    ]);
    const result = await renderFragment(schema);
    expect(result.status).toBe('ok');
    const gridFrag = result.fragments?.['frag-grid'];
    expect(gridFrag).toBeDefined();
    expect(gridFrag?.html).toContain('display:grid');
  });
});

// ---------------------------------------------------------------------------
// Registry completeness
// ---------------------------------------------------------------------------

describe('renderer edge cases: registry completeness', () => {
  it('componentRenderers map has at least 80 entries', () => {
    const count = Object.keys(componentRenderers).length;
    expect(count).toBeGreaterThanOrEqual(80);
  });

  it('every registered renderer is a function', () => {
    for (const [name, renderer] of Object.entries(componentRenderers)) {
      expect(typeof renderer).toBe('function');
    }
  });

  it('fallback renderer produces HTML for unregistered components via tree renderer', () => {
    const schema = makeSchema([
      { id: 'unknown-comp', component: 'CompletelyMadeUp', props: { x: 1 } },
    ]);
    const html = renderTree(schema);
    expect(html).toContain('Unknown component');
    expect(html).toContain('data-oods-fallback="true"');
  });

  it('handler returns error status for schemas containing unknown components', async () => {
    const schema = makeSchema([
      { id: 'unknown-comp', component: 'CompletelyMadeUp', props: { x: 1 } },
    ]);
    const result = await renderFull(schema);
    expect(result.status).toBe('error');
    expect(result.errors.some((e: { code: string }) => e.code === 'OODS-V006')).toBe(true);
  });
});
