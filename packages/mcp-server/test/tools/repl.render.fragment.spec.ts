import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

const fragmentSchema: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'fragment-screen',
      component: 'Stack',
      children: [
        { id: 'fragment-button', component: 'Button', props: { label: 'Save' } },
        {
          id: 'fragment-card',
          component: 'Card',
          children: [{ id: 'fragment-card-text', component: 'Text', props: { text: 'Card details' } }],
        },
        { id: 'fragment-badge', component: 'Badge', props: { label: 'New' } },
      ],
    },
  ],
};

function expectFragmentCssRefsResolve(cssRefs: string[], css: Record<string, string>): void {
  for (const ref of cssRefs) {
    expect(css[ref]).toBeDefined();
  }
}

describe('repl.render fragment mode', () => {
  it('renders fragments + css payload and omits html in fragments mode', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: fragmentSchema,
      apply: true,
      output: { format: 'fragments', strict: false, compact: false },
    });

    expect(result.status).toBe('ok');
    expect(result.html).toBeUndefined();
    expect(result.output).toEqual({ format: 'fragments', strict: false });
    expect(result.fragments).toBeDefined();
    expect(result.css).toBeDefined();
    expect(result.css?.['css.tokens']).toBeDefined();
    expect(Object.keys(result.fragments ?? {})).toEqual(['fragment-button', 'fragment-card', 'fragment-badge']);

    const button = result.fragments?.['fragment-button'];
    expect(button?.component).toBe('Button');
    expect(button?.html).toContain('data-oods-node-id="fragment-button"');
    expect(button?.cssRefs).toContain('css.base');
    expect(button?.cssRefs).toContain('cmp.button.base');

    const card = result.fragments?.['fragment-card'];
    expect(card?.html).toContain('data-oods-node-id="fragment-card-text"');

    for (const fragment of Object.values(result.fragments ?? {})) {
      expectFragmentCssRefsResolve(fragment.cssRefs, result.css ?? {});
    }
  });

  it('respects includeCss=false by omitting css.tokens while keeping component css', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: fragmentSchema,
      apply: true,
      output: { format: 'fragments', includeCss: false, compact: false },
    });

    expect(result.status).toBe('ok');
    expect(result.output).toEqual({ format: 'fragments', strict: false });
    expect(result.css?.['css.tokens']).toBeUndefined();
    expect(result.css?.['cmp.button.base']).toContain('[data-oods-component="Button"]');
    expect(result.fragments?.['fragment-button']?.cssRefs).not.toContain('css.tokens');
  });

  it('returns validation-only response when apply=false in fragments mode', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: fragmentSchema,
      apply: false,
      output: { format: 'fragments' },
    });

    expect(result.status).toBe('ok');
    expect(result.html).toBeUndefined();
    expect(result.fragments).toBeUndefined();
    expect(result.css).toBeUndefined();
    expect(result.output).toBeUndefined();
  });

  it('keeps document mode behavior for output.format=document and omitted output', async () => {
    const explicitDocument = await renderHandle({
      mode: 'full',
      schema: fragmentSchema,
      apply: true,
      output: { format: 'document', strict: true, compact: false },
    });
    expect(explicitDocument.status).toBe('ok');
    expect(explicitDocument.html).toContain('<!DOCTYPE html>');
    expect(explicitDocument.fragments).toBeUndefined();
    expect(explicitDocument.output).toEqual({ format: 'document', strict: true });

    const defaultDocument = await renderHandle({
      mode: 'full',
      schema: fragmentSchema,
      apply: true,
    });
    expect(defaultDocument.status).toBe('ok');
    expect(defaultDocument.html).toContain('<!DOCTYPE html>');
    expect(defaultDocument.fragments).toBeUndefined();
    expect(defaultDocument.output).toEqual({ format: 'document', strict: false });
  });
});
