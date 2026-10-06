import { describe, expect, it } from 'vitest';
import { componentRenderers, type ComponentRenderer } from '../../src/render/component-map.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

const CONTRACT_SCHEMA: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'contract-screen',
      component: 'Stack',
      children: [
        { id: 'contract-button', component: 'Button', props: { label: 'Save' } },
        { id: 'contract-card', component: 'Card', props: { body: 'Contract body' } },
        { id: 'contract-badge', component: 'Badge', props: { label: 'Ready' } },
      ],
    },
  ],
};

const REQUESTED_NODE_IDS = ['contract-button', 'contract-card', 'contract-badge'];

const throwingRenderer: ComponentRenderer = () => {
  throw new Error('forced contract failure');
};

function withRendererOverrides(overrides: Record<string, ComponentRenderer>, run: () => Promise<void>): Promise<void> {
  const originals = new Map<string, ComponentRenderer>();
  for (const [name, renderer] of Object.entries(overrides)) {
    originals.set(name, componentRenderers[name]);
    componentRenderers[name] = renderer;
  }

  return run().finally(() => {
    for (const [name, renderer] of originals.entries()) {
      componentRenderers[name] = renderer;
    }
  });
}

function extractNodeIdFromPath(pathValue: string | undefined): string | null {
  if (!pathValue) return null;
  const match = pathValue.match(/^\/fragments\/(.+)$/);
  return match?.[1] ?? null;
}

describe('fragment API contract invariants', () => {
  it('Invariant 1: fragment html never includes document wrapper tags', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: CONTRACT_SCHEMA,
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');
    for (const fragment of Object.values(result.fragments ?? {})) {
      expect(fragment.html).not.toMatch(/<!DOCTYPE/i);
      expect(fragment.html).not.toMatch(/<html/i);
      expect(fragment.html).not.toMatch(/<head/i);
      expect(fragment.html).not.toMatch(/<body/i);
    }
  });

  it('Invariant 2 + 3: every requested node resolves to fragments or errors and fragment keys are canonical node IDs', async () => {
    await withRendererOverrides({ Card: throwingRenderer }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: CONTRACT_SCHEMA,
        apply: true,
        output: { format: 'fragments', strict: false },
      });

      const fragmentKeys = Object.keys(result.fragments ?? {});
      expect(fragmentKeys).toEqual(['contract-button', 'contract-badge']);
      expect(result.fragments?.['contract-button']?.nodeId).toBe('contract-button');
      expect(result.fragments?.['contract-badge']?.nodeId).toBe('contract-badge');

      const errorNodeIds = new Set(
        result.errors
          .filter((entry) => entry.code === 'OODS-S007')
          .map((entry) => extractNodeIdFromPath(entry.path))
          .filter((value): value is string => value !== null)
      );
      const represented = new Set<string>([...fragmentKeys, ...errorNodeIds]);
      expect(Array.from(represented).sort()).toEqual([...REQUESTED_NODE_IDS].sort());
    });
  });

  it('Invariant 4: strict=false allows partial success with isolated errors', async () => {
    await withRendererOverrides({ Card: throwingRenderer }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: CONTRACT_SCHEMA,
        apply: true,
        output: { format: 'fragments', strict: false },
      });

      expect(result.status).toBe('ok');
      expect(Object.keys(result.fragments ?? {})).toEqual(['contract-button', 'contract-badge']);
      const failures = result.errors.filter((entry) => entry.code === 'OODS-S007');
      expect(failures).toHaveLength(1);
      expect(failures[0]?.path).toBe('/fragments/contract-card');
    });
  });

  it('Invariant 5: strict=true fails the whole request when any fragment fails', async () => {
    await withRendererOverrides({ Card: throwingRenderer }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: CONTRACT_SCHEMA,
        apply: true,
        output: { format: 'fragments', strict: true },
      });

      expect(result.status).toBe('error');
      expect(result.fragments).toBeUndefined();
      const failures = result.errors.filter((entry) => entry.code === 'OODS-S007');
      expect(failures).toHaveLength(1);
      expect(failures[0]?.path).toBe('/fragments/contract-card');
    });
  });

  it('Backward compat + CSS contract: document mode remains html-only and cssRefs always resolve', async () => {
    const docResult = await renderHandle({
      mode: 'full',
      schema: CONTRACT_SCHEMA,
      apply: true,
    });
    expect(docResult.status).toBe('ok');
    expect(docResult.html).toContain('<!DOCTYPE html>');
    expect(docResult.fragments).toBeUndefined();

    const fragmentResult = await renderHandle({
      mode: 'full',
      schema: CONTRACT_SCHEMA,
      apply: true,
      output: { format: 'fragments', strict: false },
    });
    expect(fragmentResult.status).toBe('ok');
    for (const fragment of Object.values(fragmentResult.fragments ?? {})) {
      for (const ref of fragment.cssRefs) {
        expect(fragmentResult.css?.[ref]).toBeDefined();
      }
    }
  });
});
