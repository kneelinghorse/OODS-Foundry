import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/ui/basic-mix.ui-schema.json');
const BASIC_SCHEMA: UiSchema = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

function collectComponents(screens: UiElement[]): Set<string> {
  const components = new Set<string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    components.add(node.component);
    if (node.children) stack.push(...node.children);
  }
  return components;
}

function countNodes(screens: UiElement[]): number {
  let count = 0;
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    count += 1;
    if (node.children) stack.push(...node.children);
  }
  return count;
}

describe('code.generate parity', () => {
  it('emits React + Vue outputs with matching component coverage and meta counts', async () => {
    const options = { styling: 'inline', typescript: true } as const;
    const react = await codegenHandle({ schema: BASIC_SCHEMA, framework: 'react', options });
    const vue = await codegenHandle({ schema: BASIC_SCHEMA, framework: 'vue', options });

    expect(react.status).toBe('ok');
    expect(vue.status).toBe('ok');

    const components = collectComponents(BASIC_SCHEMA.screens);
    const nodeCount = countNodes(BASIC_SCHEMA.screens);

    expect(react.meta?.componentCount).toBe(components.size);
    expect(vue.meta?.componentCount).toBe(components.size);
    expect(react.meta?.nodeCount).toBe(nodeCount);
    expect(vue.meta?.nodeCount).toBe(nodeCount);

    expect(react.code).toContain("import React from 'react';");
    expect(react.code).toContain("from '@oods/components-react';");
    expect(react.code).toContain("import '@oods/component-styles/css';");
    expect(vue.code).toContain('<template>');
    expect(vue.code).toContain('<script setup');
    expect(vue.code).toContain("from '@oods/components-vue';");
    expect(vue.code).toContain("import '@oods/component-styles/css';");

    for (const component of components) {
      expect(react.code).toContain(`<${component}`);
      expect(vue.code).toContain(`<${component}`);
      expect(react.code).toContain(`data-oods-component="${component}"`);
      expect(vue.code).toContain(`data-oods-component="${component}"`);
    }

    expect(react.code).not.toMatch(/style=\{\{\{/);
    for (const code of [react.code, vue.code]) {
      expect(code).toContain('content="Save"');
      expect(code).toContain('content="New"');
      expect(code).toContain('content="Updated"');
      expect(code).toContain('Card body');
      expect(code).toContain('Hello world');
      expect(code).toContain('defaultSelectedId="overview"');
      expect(code).not.toContain('message="Updated"');
      expect(code).not.toContain('text="Hello world"');
    }
    expect(react.code).toContain('"id":"basic-table-row-1"');
    expect(vue.code).toContain("'id':'basic-table-row-1'");
  });

  it('keeps React and Vue style formatting valid for layout + token styles', async () => {
    const styledSchema: UiSchema = {
      version: '1.0',
      screens: [
        {
          id: 'styled-screen',
          component: 'Card',
          layout: { type: 'stack', gapToken: 'md' },
          style: { spacingToken: 'sm' },
          children: [],
        },
      ],
    };

    const options = { styling: 'inline', typescript: true } as const;
    const react = await codegenHandle({ schema: styledSchema, framework: 'react', options });
    const vue = await codegenHandle({ schema: styledSchema, framework: 'vue', options });

    expect(react.status).toBe('ok');
    expect(vue.status).toBe('ok');

    expect(react.code).toContain("style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ref-space-scale-md)', padding: 'var(--ref-space-scale-sm)' }}");
    expect(react.code).not.toMatch(/style=\{\{\{/);
    // sprint-125 m03: vue converged onto react's canonical --ref-space-* + scale-<size> leaf.
    expect(vue.code).toContain('style="display: flex; flex-direction: column; gap: var(--ref-space-scale-md); padding: var(--ref-space-scale-sm)"');
  });
});
