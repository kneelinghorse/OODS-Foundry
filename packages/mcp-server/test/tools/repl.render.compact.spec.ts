import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

// NOTE: these tests call renderHandle() directly, bypassing AJV. The compact
// default is true at BOTH layers (schema + handler) so the bridge transport and
// a direct import behave identically. Tests that need the full token CSS pass
// output.compact=false explicitly; the AJV schema-default injection is covered
// in repl.group.test.ts.

const testSchema: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'compact-screen',
      component: 'Stack',
      children: [
        { id: 'compact-button', component: 'Button', props: { label: 'Save' } },
        { id: 'compact-badge', component: 'Badge', props: { label: 'New' } },
      ],
    },
  ],
};

describe('repl.render compact mode', () => {
  describe('document format', () => {
    it('omits token CSS from HTML when compact=true', async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'document', compact: true },
      });

      expect(result.status).toBe('ok');
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('compact mode');
      expect(result.html).not.toContain('data-source="tokens"');
      expect(result.html).toContain('data-source="components"');
      expect(result.tokenCssRef).toBe('tokens.build');
      expect(result.output).toEqual({ format: 'document', strict: false, compact: true });
    });

    it('includes token CSS when compact=false (explicit opt-out)', async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'document', compact: false },
      });

      expect(result.status).toBe('ok');
      expect(result.html).toContain('data-source="tokens"');
      expect(result.tokenCssRef).toBeUndefined();
      expect(result.output).toEqual({ format: 'document', strict: false });
    });

    it('compact document is significantly smaller than full document', async () => {
      const full = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'document', compact: false },
      });

      const compact = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'document', compact: true },
      });

      const fullSize = JSON.stringify(full).length;
      const compactSize = JSON.stringify(compact).length;

      expect(compactSize).toBeLessThan(fullSize);
      // Token CSS is ~78KB, so compact should be at least 40% smaller
      expect(compactSize / fullSize).toBeLessThan(0.6);
    });
  });

  describe('fragment format', () => {
    it('omits css.tokens from fragments when compact=true', async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'fragments', compact: true },
      });

      expect(result.status).toBe('ok');
      expect(result.css?.['css.tokens']).toBeUndefined();
      expect(result.css?.['css.base']).toBeDefined();
      expect(result.tokenCssRef).toBe('tokens.build');
      expect(result.fragments?.['compact-button']?.cssRefs).not.toContain('css.tokens');
      expect(result.output).toEqual({ format: 'fragments', strict: false, compact: true });
    });

    it('includes css.tokens in fragments when compact=false (explicit opt-out)', async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'fragments', compact: false },
      });

      expect(result.status).toBe('ok');
      expect(result.css?.['css.tokens']).toBeDefined();
      expect(result.tokenCssRef).toBeUndefined();
    });

    it('compact fragment response is smaller than full fragment response', async () => {
      const full = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'fragments', compact: false },
      });

      const compact = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
        output: { format: 'fragments', compact: true },
      });

      const fullSize = JSON.stringify(full).length;
      const compactSize = JSON.stringify(compact).length;

      expect(compactSize).toBeLessThan(fullSize);
    });
  });

  describe('default behavior', () => {
    it('default is a complete document with token CSS and no external CSS dependency', async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: true,
      });

      expect(result.status).toBe('ok');
      expect(result.tokenCssRef).toBeUndefined();
      expect(result.html).toContain('data-source="tokens"');
    });

    it('no tokenCssRef when apply=false', async () => {
      const result = await renderHandle({
        mode: 'full',
        schema: testSchema,
        apply: false,
        output: { compact: true },
      });

      expect(result.status).toBe('ok');
      expect(result.tokenCssRef).toBeUndefined();
      expect(result.output).toBeUndefined();
    });
  });
});
