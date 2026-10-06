/**
 * Contract tests for the code.generate MCP tool.
 *
 * Validates:
 * - React output is structurally valid TSX
 * - Vue output is structurally valid SFC
 * - HTML output matches repl.render document mode
 * - All prop types correctly mapped for each framework
 * - Nested component trees with children render correctly
 * - Layout props translated appropriately per framework
 */
import { describe, it, expect } from 'vitest';
import { handle } from '../../packages/mcp-server/src/tools/code.generate.js';
import { handle as handleRender } from '../../packages/mcp-server/src/tools/repl.render.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** Fixture 1: Simple single-component schema */
const SIMPLE_SCHEMA: UiSchema = {
  version: '1.0.0',
  screens: [
    {
      id: 'btn-1',
      component: 'Button',
      props: { label: 'Submit', type: 'submit', disabled: false },
    },
  ],
};

/** Fixture 2: Nested component tree with children */
const NESTED_SCHEMA: UiSchema = {
  version: '1.0.0',
  screens: [
    {
      id: 'card-1',
      component: 'Card',
      layout: { type: 'stack', gapToken: 'md' },
      children: [
        {
          id: 'header-1',
          component: 'Stack',
          children: [
            { id: 'title-1', component: 'Text', props: { as: 'h2', content: 'Dashboard' } },
          ],
        },
        {
          id: 'body-1',
          component: 'Stack',
          layout: { type: 'stack', gapToken: 'sm' },
          children: [
            { id: 'text-1', component: 'Text', props: { content: 'Welcome back' } },
            { id: 'btn-submit', component: 'Button', props: { label: 'Continue' } },
          ],
        },
      ],
    },
  ],
};

/** Fixture 3: Schema with layout props (grid, stack, sidebar) */
const LAYOUT_SCHEMA: UiSchema = {
  version: '1.0.0',
  screens: [
    {
      id: 'page-1',
      component: 'Stack',
      layout: { type: 'stack', align: 'center', gapToken: 'lg' },
      style: { spacingToken: 'md', radiusToken: 'lg' },
      children: [
        {
          id: 'grid-1',
          component: 'Grid',
          layout: { type: 'grid' },
          children: [
            { id: 'cell-1', component: 'Card' },
            { id: 'cell-2', component: 'Card' },
          ],
        },
        {
          id: 'sidebar-1',
          component: 'Card',
          layout: { type: 'sidebar' },
          children: [
            { id: 'main-content', component: 'Stack' },
            { id: 'aside-content', component: 'Stack' },
          ],
        },
        {
          id: 'inline-1',
          component: 'Stack',
          layout: { type: 'inline', align: 'space-between' },
          children: [
            { id: 'left', component: 'Text' },
            { id: 'right', component: 'Button' },
          ],
        },
      ],
    },
  ],
};

/** Fixture 4: Schema with all prop types */
const ALL_PROPS_SCHEMA: UiSchema = {
  version: '1.0.0',
  screens: [
    {
      id: 'form-1',
      component: 'Card',
      children: [
        {
          id: 'input-str',
          component: 'Input',
          props: { label: 'Name', placeholder: 'Enter name', type: 'text' },
        },
        {
          id: 'textarea-num',
          component: 'Textarea',
          props: { label: 'Rows', rows: 5 },
        },
        {
          id: 'input-bool',
          component: 'Input',
          props: { label: 'Enabled', required: true, disabled: false, readOnly: true },
        },
        {
          id: 'table-1',
          component: 'Table',
          props: {
            columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }],
          },
        },
        {
          id: 'validation-1',
          component: 'Input',
          props: {
            label: 'Status',
            validation: { state: 'success', message: 'Valid' },
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// React contract tests
// ---------------------------------------------------------------------------

describe('code.generate contracts — React', () => {
  it('generates structurally valid TSX from simple schema', async () => {
    const result = await handle({ schema: SIMPLE_SCHEMA, framework: 'react' });

    expect(result.status).toBe('ok');
    expect(result.framework).toBe('react');
    expect(result.fileExtension).toBe('.tsx');

    // Basic TSX structure
    expect(result.code).toContain("import React from 'react'");
    expect(result.code).toContain("import {");
    expect(result.code).toContain("from '@oods/components-react'");
    expect(result.code).toContain('export const GeneratedUI');
    expect(result.code).toContain('return (');

    // No unclosed tags (simple heuristic: count open/close tags)
    const openTags = (result.code.match(/<[A-Z][A-Za-z]*[\s>]/g) || []).length;
    const closeTags = (result.code.match(/<\/[A-Z][A-Za-z]*>/g) || []).length;
    const selfClosing = (result.code.match(/\/>/g) || []).length;
    // Self-closing + close-tags should account for all open tags
    expect(closeTags + selfClosing).toBeGreaterThanOrEqual(openTags);
  });

  it('renders nested component trees with correct hierarchy', async () => {
    const result = await handle({ schema: NESTED_SCHEMA, framework: 'react' });

    expect(result.status).toBe('ok');

    // All components present
    expect(result.code).toContain('<Card');
    expect(result.code).toContain('<Stack');
    expect(result.code).toContain('<Text');
    expect(result.code).toContain('<Stack');
    expect(result.code).toContain('<Button');

    // Nesting order: Card > Stack > Text
    const cardIdx = result.code.indexOf('<Card');
    const headerIdx = result.code.indexOf('<Stack');
    const textIdx = result.code.indexOf('<Text');
    expect(cardIdx).toBeLessThan(headerIdx);
    expect(headerIdx).toBeLessThan(textIdx);
  });

  it('translates all layout types correctly', async () => {
    const result = await handle({ schema: LAYOUT_SCHEMA, framework: 'react' });

    expect(result.status).toBe('ok');

    // Stack: flex column
    expect(result.code).toContain("flexDirection: 'column'");
    // Grid: display grid
    expect(result.code).toContain("display: 'grid'");
    // Sidebar: wrapper elements
    expect(result.code).toContain('data-sidebar-main');
    expect(result.code).toContain('data-sidebar-aside');
    // Inline: flex row
    expect(result.code).toContain("flexDirection: 'row'");
    // Alignment
    expect(result.code).toContain("alignItems: 'center'");
    // Gap token (t-shirt sizes resolve to scale-<size> leaf, sprint-125 m03)
    expect(result.code).toContain('var(--ref-space-scale-lg)');
    // Style tokens
    expect(result.code).toContain('var(--ref-space-scale-md)');
    expect(result.code).toContain('var(--ref-radius-lg)');
  });

  it('maps all prop types correctly', async () => {
    const result = await handle({ schema: ALL_PROPS_SCHEMA, framework: 'react' });

    expect(result.status).toBe('ok');

    // String props
    expect(result.code).toContain('placeholder="Enter name"');
    expect(result.code).toContain('type="text"');

    // Number props
    expect(result.code).toContain('rows={5}');

    // Boolean props
    expect(result.code).toContain('required');
    expect(result.code).toContain('disabled={false}');

    // Array props
    expect(result.code).toContain('columns={');

    // Object props
    expect(result.code).toContain('validation={');
  });

  it('includes meta information', async () => {
    const result = await handle({ schema: NESTED_SCHEMA, framework: 'react' });

    expect(result.meta).toBeDefined();
    expect(result.meta!.nodeCount).toBe(6); // card, header stack, title, body stack, text, button
    expect(result.meta!.componentCount).toBe(4); // Card, Text, Stack, Button
  });
});

// ---------------------------------------------------------------------------
// Vue contract tests
// ---------------------------------------------------------------------------

describe('code.generate contracts — Vue', () => {
  it('generates structurally valid SFC from simple schema', async () => {
    const result = await handle({ schema: SIMPLE_SCHEMA, framework: 'vue' });

    expect(result.status).toBe('ok');
    expect(result.framework).toBe('vue');
    expect(result.fileExtension).toBe('.vue');

    // SFC blocks
    expect(result.code).toContain('<template>');
    expect(result.code).toContain('</template>');
    expect(result.code).toContain('<script setup');
    expect(result.code).toContain('</script>');

    // Imports
    expect(result.code).toContain("from '@oods/components-vue'");
  });

  it('renders nested component trees with correct hierarchy', async () => {
    const result = await handle({ schema: NESTED_SCHEMA, framework: 'vue' });

    expect(result.status).toBe('ok');

    // All components present
    expect(result.code).toContain('<Card');
    expect(result.code).toContain('<Stack');
    expect(result.code).toContain('<Text');
    expect(result.code).toContain('<Stack');
    expect(result.code).toContain('<Button');

    // Closing tags present
    expect(result.code).toContain('</Card>');
    expect(result.code).toContain('</Stack>');
  });

  it('translates all layout types correctly', async () => {
    const result = await handle({ schema: LAYOUT_SCHEMA, framework: 'vue' });

    expect(result.status).toBe('ok');

    // Stack: flex column (CSS property names)
    expect(result.code).toContain('flex-direction: column');
    // Grid: display grid
    expect(result.code).toContain('display: grid');
    // Sidebar: wrapper elements
    expect(result.code).toContain('data-sidebar-main');
    expect(result.code).toContain('data-sidebar-aside');
    // Inline: flex row
    expect(result.code).toContain('flex-direction: row');
    // Token vars (Vue converged onto --ref-space-* + scale-<size> leaf, sprint-125 m03)
    expect(result.code).toContain('var(--ref-space-scale-lg)');
  });

  it('maps all prop types correctly with Vue syntax', async () => {
    const result = await handle({ schema: ALL_PROPS_SCHEMA, framework: 'vue' });

    expect(result.status).toBe('ok');

    // String props: standard attributes
    expect(result.code).toContain('placeholder="Enter name"');
    expect(result.code).toContain('type="text"');

    // Number props: v-bind
    expect(result.code).toContain(':rows="5"');

    // Boolean true: bare attribute
    expect(result.code).toMatch(/\brequired\b/);

    // Boolean false: v-bind
    expect(result.code).toContain(':disabled="false"');

    // Array props: v-bind
    expect(result.code).toContain(':columns=');

    // Object props: v-bind
    expect(result.code).toContain(':validation=');
  });

  it('includes scoped style block when token refs are present', async () => {
    const result = await handle({
      schema: LAYOUT_SCHEMA,
      framework: 'vue',
      options: { styling: 'tokens' },
    });

    expect(result.code).toContain('<style scoped>');
  });

  it('generates typed defineProps in TypeScript mode', async () => {
    const result = await handle({
      schema: SIMPLE_SCHEMA,
      framework: 'vue',
      options: { typescript: true },
    });

    expect(result.code).toContain('lang="ts"');
    expect(result.code).toContain('defineProps<');
  });
});

// ---------------------------------------------------------------------------
// HTML contract tests
// ---------------------------------------------------------------------------

describe('code.generate contracts — HTML', () => {
  it('produces HTML document from simple schema', async () => {
    const result = await handle({ schema: SIMPLE_SCHEMA, framework: 'html' });

    expect(result.status).toBe('ok');
    expect(result.framework).toBe('html');
    expect(result.fileExtension).toBe('.html');
    expect(result.code).toContain('<html');
    expect(result.code).toContain('</html>');
    expect(result.imports).toEqual([]);
  });

  it.each([{ theme: 'dark', brand: 'B' }, { theme: 'light', brand: 'A' }] as const)('applies an explicit HTML scope once: %j', async options => {
    const result = await handle({ schema: SIMPLE_SCHEMA, framework: 'html', options });
    expect(result.status).toBe('ok');
    expect(result.code).toContain(`<html lang="en" data-theme="${options.theme}" data-brand="${options.brand}">`);
    expect(result.code).toContain(`<body data-theme="${options.theme}" data-brand="${options.brand}">`);
    expect(result.code).toContain(`:root { color-scheme: ${options.theme}; }`);
    expect(result.code.match(/#oods-preview-root \{/g)).toHaveLength(1);
  });

  it('matches repl.render document mode output', async () => {
    const codeGenResult = await handle({ schema: NESTED_SCHEMA, framework: 'html' });

    const renderResult = await handleRender({
      mode: 'full',
      schema: NESTED_SCHEMA,
      apply: true,
      // repl.render now defaults compact (token CSS omitted); code.generate
      // emits a full standalone document, so compare full-vs-full.
      output: { compact: false },
    });

    expect(codeGenResult.status).toBe('ok');
    expect(renderResult.status).toBe('ok');

    // Both should produce HTML documents
    expect(codeGenResult.code).toContain('<html');
    expect(renderResult.html).toBeDefined();

    // The HTML content should match — both use the same rendering pipeline
    expect(codeGenResult.code).toBe(renderResult.html);
  });

  it('HTML output matches repl.render for layout schema', async () => {
    const codeGenResult = await handle({ schema: LAYOUT_SCHEMA, framework: 'html' });

    const renderResult = await handleRender({
      mode: 'full',
      schema: LAYOUT_SCHEMA,
      apply: true,
      output: { compact: false }, // full CSS to match code.generate
    });

    expect(codeGenResult.status).toBe('ok');
    expect(renderResult.status).toBe('ok');
    expect(codeGenResult.code).toBe(renderResult.html);
  });

  it('HTML output matches repl.render for all-props schema', async () => {
    const codeGenResult = await handle({ schema: ALL_PROPS_SCHEMA, framework: 'html' });

    const renderResult = await handleRender({
      mode: 'full',
      schema: ALL_PROPS_SCHEMA,
      apply: true,
      output: { compact: false }, // full CSS to match code.generate
    });

    expect(codeGenResult.status).toBe('ok');
    expect(renderResult.status).toBe('ok');
    expect(codeGenResult.code).toBe(renderResult.html);
  });
});

// ---------------------------------------------------------------------------
// Cross-framework contract tests
// ---------------------------------------------------------------------------

describe('code.generate contracts — cross-framework', () => {
  it('all three frameworks generate for the same schema without errors', async () => {
    for (const framework of ['react', 'vue', 'html'] as const) {
      const result = await handle({ schema: NESTED_SCHEMA, framework });

      expect(result.status).toBe('ok');
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBe(0);
    }
  });

  it('all frameworks handle schemas with all prop types', async () => {
    for (const framework of ['react', 'vue', 'html'] as const) {
      const result = await handle({ schema: ALL_PROPS_SCHEMA, framework });
      expect(result.status).toBe('ok');
    }
  });

  it('invalid schema returns error for all frameworks', async () => {
    const badSchema: UiSchema = { version: '1.0.0', screens: [] };

    for (const framework of ['react', 'vue', 'html'] as const) {
      const result = await handle({ schema: badSchema, framework });
      expect(result.status).toBe('error');
    }
  });

  it('meta is consistent across React and Vue', async () => {
    const reactResult = await handle({ schema: NESTED_SCHEMA, framework: 'react' });
    const vueResult = await handle({ schema: NESTED_SCHEMA, framework: 'vue' });

    // Meta is computed in the handler before dispatching to emitter
    expect(reactResult.meta).toEqual(vueResult.meta);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe('code.generate contracts — backward compatibility', () => {
  it('defaults to typescript:true when options omitted', async () => {
    const result = await handle({ schema: SIMPLE_SCHEMA, framework: 'react' });
    expect(result.fileExtension).toBe('.tsx');
    expect(result.code).toContain('React.FC');
  });

  it('defaults to styling:tokens when options omitted', async () => {
    const result = await handle({
      schema: LAYOUT_SCHEMA,
      framework: 'vue',
    });
    // Token styling → inline styles with var() refs
    expect(result.code).toContain('var(--ref-');
  });
});

// ---------------------------------------------------------------------------
// Styling option validation
// ---------------------------------------------------------------------------

describe('code.generate contracts — styling options', () => {
  it('accepts styling:inline and produces output', async () => {
    const result = await handle({
      schema: SIMPLE_SCHEMA,
      framework: 'react',
      options: { styling: 'inline' },
    });
    expect(result.status).toBe('ok');
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('accepts styling:tokens and produces output', async () => {
    const result = await handle({
      schema: SIMPLE_SCHEMA,
      framework: 'react',
      options: { styling: 'tokens' },
    });
    expect(result.status).toBe('ok');
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('schema enum does not include css-modules', async () => {
    const schema = await import(
      '../../packages/mcp-server/src/schemas/code.generate.input.json',
      { with: { type: 'json' } }
    );
    const stylingEnum = schema.default.properties.options.properties.styling.enum;
    expect(stylingEnum).toEqual(['inline', 'tokens', 'tailwind']);
    expect(stylingEnum).not.toContain('css-modules');
  });
});
