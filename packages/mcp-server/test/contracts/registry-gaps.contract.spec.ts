import { describe, expect, it } from 'vitest';
import { componentRenderers } from '../../src/render/component-map.js';
import { loadComponentRegistry } from '../../src/tools/repl.utils.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import type { UiSchema } from '../../src/schemas/generated.js';

// ---------- Fixtures ----------

/** Schema with 3 known + 1 unknown top-level component. */
function mixedSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: 'screen-1',
        component: 'Stack',
        children: [
          { id: 'btn-1', component: 'Button', props: { label: 'Save' } },
          { id: 'card-1', component: 'Card', props: { body: 'Hello' } },
          { id: 'unknown-1', component: 'FancyWidget' },
          { id: 'badge-1', component: 'Badge', props: { label: 'OK' } },
        ],
      },
    ],
  };
}

/** Schema with only unknown components. */
function allUnknownSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: 'screen-1',
        component: 'Stack',
        children: [
          { id: 'unk-1', component: 'Whoops' },
          { id: 'unk-2', component: 'AlsoUnknown' },
        ],
      },
    ],
  };
}

/** Schema with Grid + other known components. */
function gridSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: 'screen-1',
        component: 'Stack',
        children: [
          {
            id: 'grid-1',
            component: 'Grid',
            props: { columns: 3, rows: 2, gap: 'md', columnGap: 'sm', rowGap: 'lg' },
            children: [
              { id: 'cell-1', component: 'Text', props: { text: 'Cell 1' } },
              { id: 'cell-2', component: 'Text', props: { text: 'Cell 2' } },
              { id: 'cell-3', component: 'Text', props: { text: 'Cell 3' } },
            ],
          },
          { id: 'btn-2', component: 'Button', props: { label: 'Submit' } },
        ],
      },
    ],
  };
}

/** Schema with Grid using minimal props. */
function gridMinimalSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: 'screen-1',
        component: 'Stack',
        children: [
          { id: 'grid-min', component: 'Grid' },
        ],
      },
    ],
  };
}

// ---------- Per-node unknown component isolation ----------

describe('per-node unknown component isolation', () => {
  it('non-strict fragment mode returns partial fragments for known components + per-node UNKNOWN_COMPONENT errors', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: mixedSchema(),
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');

    // Known components should produce fragments
    expect(result.fragments).toBeDefined();
    const fragmentKeys = Object.keys(result.fragments ?? {});
    expect(fragmentKeys).toContain('btn-1');
    expect(fragmentKeys).toContain('card-1');
    expect(fragmentKeys).toContain('badge-1');

    // Unknown component should NOT be in fragments
    expect(fragmentKeys).not.toContain('unknown-1');

    // Unknown component should appear as per-node error
    const unknownErrors = result.errors.filter((e) => e.code === 'OODS-V006');
    expect(unknownErrors).toHaveLength(1);
    expect(unknownErrors[0]?.nodeId).toBe('unknown-1');
    expect(unknownErrors[0]?.component).toBe('FancyWidget');
    expect(unknownErrors[0]?.path).toBe('/fragments/unknown-1');
  });

  it('strict fragment mode fails the entire request on unknown components', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: mixedSchema(),
      apply: true,
      output: { format: 'fragments', strict: true },
    });

    expect(result.status).toBe('error');
    expect(result.fragments).toBeUndefined();

    const unknownErrors = result.errors.filter((e) => e.code === 'OODS-V006');
    expect(unknownErrors.length).toBeGreaterThan(0);
  });

  it('document mode with unknown component retains existing behavior (global error)', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: mixedSchema(),
      apply: true,
      output: { format: 'document' },
    });

    expect(result.status).toBe('error');
    expect(result.html).toBeUndefined();

    const unknownErrors = result.errors.filter((e) => e.code === 'OODS-V006');
    expect(unknownErrors.length).toBeGreaterThan(0);
  });

  it('non-strict fragment mode with all-unknown components returns 0 fragments + errors with status=error', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: allUnknownSchema(),
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    // With no successful fragments, status should be error
    expect(result.status).toBe('error');
    expect(result.fragments).toBeUndefined();

    const unknownErrors = result.errors.filter((e) => e.code === 'OODS-V006');
    expect(unknownErrors).toHaveLength(2);
  });

  it('non-strict fragment mode with only known components produces all fragments and no errors', async () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [
        {
          id: 'screen-1',
          component: 'Stack',
          children: [
            { id: 'btn-ok', component: 'Button', props: { label: 'OK' } },
            { id: 'card-ok', component: 'Card', props: { body: 'Fine' } },
          ],
        },
      ],
    };

    const result = await renderHandle({
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');
    expect(Object.keys(result.fragments ?? {})).toHaveLength(2);
    expect(result.errors.filter((e) => e.code === 'OODS-V006')).toHaveLength(0);
  });
});

// ---------- Grid component rendering ----------

describe('Grid component rendering', () => {
  it('Grid renders as CSS Grid container with correct props', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: gridSchema(),
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');
    expect(result.fragments).toBeDefined();
    expect(result.fragments?.['grid-1']).toBeDefined();

    const gridFragment = result.fragments!['grid-1'];
    expect(gridFragment.component).toBe('Grid');
    expect(gridFragment.html).toContain('data-oods-component="Grid"');
    expect(gridFragment.html).toContain('display:grid');
    // s221-m01: a column count is a maximum since #2418; the fragment carries the count and the shipped Grid rule that
    // reads it, so a fragment rendered with its own CSS keeps its columns.
    expect(gridFragment.html).toContain('--oods-grid-columns:3');
    expect(gridFragment.html).toContain('data-max-columns="3"');
    expect(gridFragment.cssRefs).toContain('cmp.grid.base');
    expect(result.css?.['cmp.grid.base']).toContain("[data-oods-component='Grid'][data-max-columns]");
    expect(gridFragment.html).toContain('grid-template-rows:repeat(2, minmax(0, 1fr))');
    expect(gridFragment.html).toContain('gap:var(--ref-space-scale-md)');
    expect(gridFragment.html).toContain('column-gap:var(--ref-space-scale-sm)');
    expect(gridFragment.html).toContain('row-gap:var(--ref-space-scale-lg)');
  });

  it('Grid renders children inside grid layout', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: gridSchema(),
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    const gridFragment = result.fragments!['grid-1'];
    // Children should be rendered inside the grid
    expect(gridFragment.html).toContain('Cell 1');
    expect(gridFragment.html).toContain('Cell 2');
    expect(gridFragment.html).toContain('Cell 3');
    // Children should have their component markers
    expect(gridFragment.html).toContain('data-oods-component="Text"');
  });

  it('Grid with minimal props renders valid grid container', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: gridMinimalSchema(),
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');
    const gridFragment = result.fragments?.['grid-min'];
    expect(gridFragment).toBeDefined();
    expect(gridFragment!.html).toContain('display:grid');
    expect(gridFragment!.html).toContain('data-oods-component="Grid"');
    // Should not contain column/row template without props
    expect(gridFragment!.html).not.toContain('grid-template-columns');
    expect(gridFragment!.html).not.toContain('grid-template-rows');
  });

  it('Grid is registered in the component registry', () => {
    const registry = loadComponentRegistry();
    expect(registry.names.has('Grid')).toBe(true);
  });

  it('Grid has a mapped renderer', () => {
    expect(componentRenderers['Grid']).toBeDefined();
  });
});
