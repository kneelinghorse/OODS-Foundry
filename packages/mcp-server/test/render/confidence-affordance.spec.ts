import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import { applySelectionsToSchema, type SelectionEntry } from '../../src/compose/object-slot-filler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSchema(children: UiSchema['screens'][0]['children']): UiSchema {
  return {
    version: '2026.02',
    screens: [{
      id: 'conf-screen',
      component: 'Stack',
      children: children ?? [],
    }],
  };
}

function schemaWithConfidence(confidence: number, confidenceLevel: 'high' | 'medium' | 'low'): UiSchema {
  return makeSchema([
    {
      id: 'card-1',
      component: 'Card',
      props: { label: 'Test' },
      meta: { confidence, confidenceLevel },
    },
  ]);
}

async function renderWithConfidence(schema: UiSchema, showConfidence: boolean, confidenceThreshold?: number) {
  return renderHandle({
    mode: 'full',
    schema,
    apply: true,
    output: {
      showConfidence,
      ...(confidenceThreshold !== undefined ? { confidenceThreshold } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// applySelectionsToSchema — confidence attachment
// ---------------------------------------------------------------------------

describe('applySelectionsToSchema attaches confidence', () => {
  it('attaches confidence and confidenceLevel to slot elements', () => {
    const schema = makeSchema([
      { id: 'slot-metrics', component: 'Slot', meta: { intent: 'slot:metrics' } },
    ]);

    const selections: SelectionEntry[] = [
      { slotName: 'metrics', selectedComponent: 'Badge', confidence: 0.85, confidenceLevel: 'high' },
    ];

    applySelectionsToSchema(schema, selections);
    const node = schema.screens[0].children![0];
    expect(node.component).toBe('Badge');
    expect(node.meta?.confidence).toBe(0.85);
    expect(node.meta?.confidenceLevel).toBe('high');
  });

  it('preserves existing meta fields when attaching confidence', () => {
    const schema = makeSchema([
      { id: 'slot-info', component: 'Slot', meta: { intent: 'slot:info', notes: 'Important section' } },
    ]);

    const selections: SelectionEntry[] = [
      { slotName: 'info', selectedComponent: 'Text', confidence: 0.4, confidenceLevel: 'low' },
    ];

    applySelectionsToSchema(schema, selections);
    const node = schema.screens[0].children![0];
    expect(node.meta?.notes).toBe('Important section');
    expect(node.meta?.confidence).toBe(0.4);
    expect(node.meta?.confidenceLevel).toBe('low');
  });

  it('does not attach confidence when selection has no confidence field', () => {
    const schema = makeSchema([
      { id: 'slot-action', component: 'Slot', meta: { intent: 'slot:action' } },
    ]);

    const selections: SelectionEntry[] = [
      { slotName: 'action', selectedComponent: 'Button' },
    ];

    applySelectionsToSchema(schema, selections);
    const node = schema.screens[0].children![0];
    expect(node.component).toBe('Button');
    expect(node.meta?.confidence).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Renderer: data-oods-confidence attribute output
// ---------------------------------------------------------------------------

describe('data-oods-confidence attribute in rendered HTML', () => {
  it('emits data-oods-confidence when showConfidence=true and node has confidence', async () => {
    const schema = schemaWithConfidence(0.72, 'medium');
    const result = await renderWithConfidence(schema, true);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-confidence="0.72"');
    expect(result.html).toContain('data-confidence-level="medium"');
  });

  it('does NOT emit data-oods-confidence when showConfidence=false (default)', async () => {
    const schema = schemaWithConfidence(0.72, 'medium');
    const result = await renderWithConfidence(schema, false);
    expect(result.status).toBe('ok');
    expect(result.html).not.toContain('data-oods-confidence');
    expect(result.html).not.toContain('data-confidence-level');
  });

  it('does NOT emit by default (no showConfidence option)', async () => {
    const schema = schemaWithConfidence(0.72, 'medium');
    const result = await renderHandle({
      mode: 'full',
      schema,
      apply: true,
    });
    expect(result.status).toBe('ok');
    expect(result.html).not.toContain('data-oods-confidence');
  });

  it('does not emit attributes when node has no confidence metadata', async () => {
    const schema = makeSchema([
      { id: 'plain-card', component: 'Card', props: { label: 'No conf' } },
    ]);
    const result = await renderWithConfidence(schema, true);
    expect(result.status).toBe('ok');
    expect(result.html).not.toContain('data-oods-confidence');
  });
});

// ---------------------------------------------------------------------------
// Low-confidence CSS class
// ---------------------------------------------------------------------------

describe('oods-low-confidence CSS class', () => {
  it('adds oods-low-confidence class when confidence < threshold (default 0.5)', async () => {
    const schema = schemaWithConfidence(0.3, 'low');
    const result = await renderWithConfidence(schema, true);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('oods-low-confidence');
  });

  it('does NOT add class when confidence >= threshold', async () => {
    const schema = schemaWithConfidence(0.7, 'high');
    const result = await renderWithConfidence(schema, true);
    expect(result.status).toBe('ok');
    expect(result.html).not.toContain('oods-low-confidence');
  });

  it('respects custom confidenceThreshold', async () => {
    const schema = schemaWithConfidence(0.6, 'medium');
    // With threshold 0.7, confidence 0.6 should be low
    const result = await renderWithConfidence(schema, true, 0.7);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('oods-low-confidence');
  });

  it('does NOT add class when showConfidence=false even if confidence is low', async () => {
    const schema = schemaWithConfidence(0.2, 'low');
    const result = await renderWithConfidence(schema, false);
    expect(result.status).toBe('ok');
    expect(result.html).not.toContain('oods-low-confidence');
  });

  it('exact threshold boundary: confidence == threshold does NOT get class', async () => {
    const schema = schemaWithConfidence(0.5, 'medium');
    const result = await renderWithConfidence(schema, true, 0.5);
    expect(result.status).toBe('ok');
    expect(result.html).not.toContain('oods-low-confidence');
  });
});

// ---------------------------------------------------------------------------
// Fragment mode
// ---------------------------------------------------------------------------

describe('confidence in fragment mode', () => {
  it('emits data-oods-confidence in fragments when showConfidence=true', async () => {
    const schema = schemaWithConfidence(0.45, 'low');
    const result = await renderHandle({
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', showConfidence: true },
    });
    expect(result.status).toBe('ok');
    const fragmentHtml = Object.values(result.fragments ?? {})[0]?.html ?? '';
    expect(fragmentHtml).toContain('data-oods-confidence="0.45"');
    expect(fragmentHtml).toContain('oods-low-confidence');
  });

  it('does NOT emit in fragments when showConfidence=false', async () => {
    const schema = schemaWithConfidence(0.45, 'low');
    const result = await renderHandle({
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', showConfidence: false },
    });
    expect(result.status).toBe('ok');
    const fragmentHtml = Object.values(result.fragments ?? {})[0]?.html ?? '';
    expect(fragmentHtml).not.toContain('data-oods-confidence');
  });
});

// ---------------------------------------------------------------------------
// renderTree directly (unit test of attribute emission)
// ---------------------------------------------------------------------------

describe('renderTree with confidence metadata', () => {
  it('renderTree emits data-oods-confidence when meta has confidence', () => {
    const schema = schemaWithConfidence(0.88, 'high');
    const html = renderTree(schema);
    expect(html).toContain('data-oods-confidence="0.88"');
    expect(html).toContain('data-confidence-level="high"');
  });
});
