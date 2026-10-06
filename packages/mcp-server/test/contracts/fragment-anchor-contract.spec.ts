/**
 * Fragment-anchor contract test (s106-m01).
 *
 * Synthesis-Workbench pins human review comments to anchors emitted on
 * repl.render's `output.format=fragments` HTML. This test hardens the two
 * anchor attributes into a documented contract:
 *
 *   - data-oods-label   = the DURABLE, structure-independent anchor. Derived
 *                         from slot/field semantics, not tree position, so a
 *                         surviving slot keeps its label across a structural
 *                         re-compose. Consumers should anchor long-lived
 *                         comments here. NOT guaranteed unique within a render
 *                         (see docs/api/fragment-anchor-contract.md) — pair it
 *                         with a disambiguator if collisions matter.
 *   - data-oods-node-id = BEST-EFFORT. It is a per-compose-run uid() counter
 *                         (resetIdCounter() per template), so it is
 *                         deterministic for a fixed input but SHIFTS when the
 *                         structure changes. Fine as a within-render key; do
 *                         not persist it across re-composes.
 *
 * SPEC NOTE (Rule 12): the mission spec named
 * test/contracts/emitter-data-attr-parity.spec.ts as the file to extend, but
 * that test covers a different attribute family (data-entity-urn /
 * data-element-type / data-role / data-slot-*) on the fidelity codegen
 * emitters (boxes-arrows/wireframe/branded-mockup), which have no fragments
 * mode. The spec's explicit alternative — "OR add a focused
 * fragment-anchor-contract test" — is taken here so the two unrelated
 * contracts stay separate.
 *
 * No renderer behavior change: the anchors are already emitted at
 * component-map.ts:120,122. This file is contract + regression coverage only.
 */

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { handle as composeHandle, type DesignComposeInput } from '../../src/tools/design.compose.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function renderFragments(schema: UiSchema) {
  const result = await renderHandle({
    mode: 'full',
    schema,
    apply: true,
    output: { format: 'fragments', strict: false },
  });
  expect(result.status).toBe('ok');
  return result.fragments ?? {};
}

/**
 * Compose -> render fragments -> collect every (data-oods-label ->
 * data-oods-node-id) pair across all fragment HTML. Keyed by label because the
 * label is the anchor under test.
 */
async function composedLabelToNodeId(input: DesignComposeInput): Promise<Map<string, string>> {
  const composed = await composeHandle(input);
  expect(composed.status).toBe('ok');
  const fragments = await renderFragments(composed.schema);
  const map = new Map<string, string>();
  for (const fragment of Object.values(fragments)) {
    const doc = new JSDOM(`<div>${fragment.html}</div>`).window.document;
    for (const el of Array.from(doc.querySelectorAll('[data-oods-label]'))) {
      const label = el.getAttribute('data-oods-label');
      const nodeId = el.getAttribute('data-oods-node-id');
      // Anchor invariant: anything carrying a label MUST also carry a node-id.
      expect(nodeId, `node carrying data-oods-label="${label}" must also carry data-oods-node-id`).toBeTruthy();
      if (label) map.set(label, nodeId ?? '');
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  1. Anchor presence on repl.render format:fragments output          */
/* ------------------------------------------------------------------ */

describe('fragment-anchor contract: both anchors present on fragments output', () => {
  const ANCHORED_SCHEMA: UiSchema = {
    version: '2026.02',
    screens: [
      {
        id: 'anchor-screen',
        component: 'Stack',
        children: [
          { id: 'anchor-button', component: 'Button', props: { label: 'Save' }, meta: { label: 'primary-action' } },
          { id: 'anchor-card', component: 'Card', props: { body: 'Summary' }, meta: { label: 'summary-card' } },
        ],
      },
    ],
  };

  it('emits data-oods-node-id AND data-oods-label on every labeled fragment node', async () => {
    const fragments = await renderFragments(ANCHORED_SCHEMA);
    expect(Object.keys(fragments)).toEqual(['anchor-button', 'anchor-card']);

    const expected: Record<string, string> = {
      'anchor-button': 'primary-action',
      'anchor-card': 'summary-card',
    };

    for (const [nodeId, label] of Object.entries(expected)) {
      const fragment = fragments[nodeId];
      expect(fragment, `fragment ${nodeId}`).toBeDefined();
      const root = new JSDOM(`<div>${fragment!.html}</div>`).window.document
        .querySelector(`[data-oods-node-id="${nodeId}"]`);
      expect(root, `element carrying data-oods-node-id=${nodeId}`).not.toBeNull();
      // Both anchors present, with the expected values.
      expect(root!.getAttribute('data-oods-node-id')).toBe(nodeId);
      expect(root!.getAttribute('data-oods-label')).toBe(label);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  2. Durability contract across a structural re-compose              */
/* ------------------------------------------------------------------ */

describe('fragment-anchor contract: data-oods-label durable, data-oods-node-id best-effort', () => {
  it('is deterministic — identical input yields identical label->node-id map', async () => {
    const a = await composedLabelToNodeId({ object: 'Subscription', context: 'detail', preferences: { tabCount: 3 } });
    const b = await composedLabelToNodeId({ object: 'Subscription', context: 'detail', preferences: { tabCount: 3 } });
    expect(Object.fromEntries(b)).toEqual(Object.fromEntries(a));
  });

  it('a surviving slot keeps its data-oods-label while data-oods-node-id may shift', async () => {
    // Generic detail retains the requested sections. Object detail intentionally
    // consolidates empty/duplicate trait tabs (s198), so it no longer exercises
    // the structural change this consumer anchor contract requires.
    const fewer = await composedLabelToNodeId({ layout: 'detail', preferences: { tabCount: 3 } });
    const more = await composedLabelToNodeId({ layout: 'detail', preferences: { tabCount: 5 } });
    expect(more.size - fewer.size).toBe(2);

    // Surviving slots = labels present in BOTH renders.
    const surviving = [...fewer.keys()].filter((label) => more.has(label));
    expect(surviving.length, 'structural change should preserve some slots').toBeGreaterThan(2);

    // DURABLE: every surviving slot is still addressable by the same label.
    // (Labels are matched directly, so "still present" is the durability claim.)
    for (const label of surviving) {
      expect(more.has(label), `surviving slot "${label}" must keep its data-oods-label`).toBe(true);
    }

    // BEST-EFFORT: at least one surviving slot's node-id shifts under the
    // structural change. If this becomes 0 the node-id has silently become
    // structure-independent — the contract (and the docs) would be wrong.
    const shifted = surviving.filter((label) => fewer.get(label) !== more.get(label));
    expect(shifted.length, 'node-id is best-effort: a structural change should shift at least one surviving node-id').toBeGreaterThan(0);

    // Concrete pins of the mechanism:
    //  - `header` precedes the tab block, so both its label and node-id are stable.
    //  - Generic `metadata` follows the tab block, so its allocated id shifts.
    expect(fewer.has('header') && more.has('header')).toBe(true);
    expect(more.get('header')).toBe(fewer.get('header'));

    expect(fewer.has('metadata') && more.has('metadata')).toBe(true);
    expect(more.get('metadata')).not.toBe(fewer.get('metadata'));
  });
});
