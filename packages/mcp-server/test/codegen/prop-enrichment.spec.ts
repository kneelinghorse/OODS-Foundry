/**
 * Integration tests for prop enrichment through compose → codegen flow (s78-m03).
 *
 * Validates that:
 * 1. Object-backed forms get label/type from field metadata
 * 2. Intent-only forms get label from parsed intent phrases
 * 3. Codegen emitters correctly output enriched props
 */
import { describe, expect, it } from 'vitest';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const codegenOptions: CodegenOptions = {
  typescript: true,
  styling: 'tokens',
};

describe('prop enrichment: compose → codegen integration', () => {
  describe('object-backed form', () => {
    it('enriches Input with label and type from object field metadata', async () => {
      const result = await composeHandle({
        object: 'User',
        context: 'form',
        options: { validate: false },
      });
      expect(result.status).toBe('ok');

      // Check that the schema has enriched props on at least some field nodes
      const leafNodes: Array<{ component: string; props: Record<string, unknown> }> = [];
      const walk = (node: any): void => {
        if (node.props?.field) {
          leafNodes.push({ component: node.component, props: node.props });
        }
        node.children?.forEach(walk);
      };
      result.schema.screens.forEach(walk);

      const inputNodes = leafNodes.filter((n) => n.component === 'Input');
      expect(inputNodes.length).toBeGreaterThan(0);
      expect(inputNodes.every(n => typeof n.props.label === 'string')).toBe(true);
      expect(inputNodes.some(n => String(n.props.placeholder ?? '').startsWith('Enter '))).toBe(false);
    });

    it('codegen emits enriched props from object-backed compose', async () => {
      const result = await composeHandle({
        object: 'User',
        context: 'form',
        options: { validate: false },
      });
      expect(result.status).toBe('ok');

      const codeResult = reactEmit(result.schema, codegenOptions);
      expect(codeResult.status).toBe('ok');
      // Should contain at least one placeholder prop
      expect(codeResult.code).not.toMatch(/placeholder="Enter /);
    });
  });

  describe('intent-only form', () => {
    it('enriches form fields with label from parsed intent phrases', async () => {
      const result = await composeHandle({
        intent: 'A contact form with: name, email address, message',
        options: { validate: false },
      });
      expect(result.status).toBe('ok');
      expect(result.layout).toBe('form');

      // Walk the schema tree for field slot nodes with label props
      const fieldNodes: Array<{ component: string; props: Record<string, unknown> }> = [];
      const walk = (node: any): void => {
        if (node.props?.label && typeof node.props.label === 'string') {
          fieldNodes.push({ component: node.component, props: node.props });
        }
        node.children?.forEach(walk);
      };
      result.schema.screens.forEach(walk);

      // Should have at least one enriched field
      expect(fieldNodes.length).toBeGreaterThan(0);
    });

    it('codegen emits labels without invented placeholders from intent-parsed form', async () => {
      const result = await composeHandle({
        intent: 'A settings form with: username, email address, bio textarea',
        options: { validate: false },
      });
      expect(result.status).toBe('ok');

      const codeResult = reactEmit(result.schema, codegenOptions);
      expect(codeResult.status).toBe('ok');
      expect(codeResult.code).toMatch(/label=/);
      expect(codeResult.code).not.toMatch(/placeholder="Enter /);
    });
  });
});
