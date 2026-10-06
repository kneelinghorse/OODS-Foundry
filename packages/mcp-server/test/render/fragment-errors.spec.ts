import { describe, expect, it } from 'vitest';
import { componentRenderers, type ComponentRenderer } from '../../src/render/component-map.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

const errorFixture: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'fragment-error-screen',
      component: 'Stack',
      children: [
        { id: 'fragment-ok-button', component: 'Button', props: { label: 'Save' } },
        { id: 'fragment-failing-card', component: 'Card', props: { body: 'Details' } },
        { id: 'fragment-ok-badge', component: 'Badge', props: { label: 'Ready' } },
      ],
    },
  ],
};

const forcedFailure: ComponentRenderer = () => {
  throw new Error('forced fragment failure');
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

describe('repl.render fragment error isolation', () => {
  it('returns all fragments when no renderer throws', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: errorFixture,
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');
    expect(Object.keys(result.fragments ?? {})).toEqual(['fragment-ok-button', 'fragment-failing-card', 'fragment-ok-badge']);
    expect(result.errors.some((entry) => entry.code === 'OODS-S007')).toBe(false);
  });

  it('isolates one failing fragment in non-strict mode and keeps successful fragments', async () => {
    await withRendererOverrides({ Card: forcedFailure }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: errorFixture,
        apply: true,
        output: { format: 'fragments', strict: false },
      });

      expect(result.status).toBe('ok');
      expect(Object.keys(result.fragments ?? {})).toEqual(['fragment-ok-button', 'fragment-ok-badge']);

      const failures = result.errors.filter((entry) => entry.code === 'OODS-S007');
      expect(failures).toHaveLength(1);
      expect(failures[0]?.path).toBe('/fragments/fragment-failing-card');
      expect(failures[0]?.component).toBe('Card');
      expect(failures[0]?.message).toContain('fragment-failing-card');
    });
  });

  it('fails the entire response in strict mode when any fragment renderer throws', async () => {
    await withRendererOverrides({ Card: forcedFailure }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: errorFixture,
        apply: true,
        output: { format: 'fragments', strict: true },
      });

      expect(result.status).toBe('error');
      expect(result.fragments).toBeUndefined();
      expect(result.errors.some((entry) => entry.code === 'OODS-S007')).toBe(true);
    });
  });

  it('returns error in non-strict mode when all fragments fail', async () => {
    await withRendererOverrides({ Button: forcedFailure, Card: forcedFailure, Badge: forcedFailure }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: errorFixture,
        apply: true,
        output: { format: 'fragments', strict: false },
      });

      expect(result.status).toBe('error');
      expect(result.fragments).toBeUndefined();
      const failures = result.errors.filter((entry) => entry.code === 'OODS-S007');
      expect(failures).toHaveLength(3);
    });
  });

  it('returns error in strict mode when all fragments fail', async () => {
    await withRendererOverrides({ Button: forcedFailure, Card: forcedFailure, Badge: forcedFailure }, async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: errorFixture,
        apply: true,
        output: { format: 'fragments', strict: true },
      });

      expect(result.status).toBe('error');
      expect(result.fragments).toBeUndefined();
      const failures = result.errors.filter((entry) => entry.code === 'OODS-S007');
      expect(failures).toHaveLength(3);
    });
  });
});
