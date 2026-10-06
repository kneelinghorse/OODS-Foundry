import { describe, it, expect } from 'vitest';
import { emit } from '../../packages/mcp-server/src/codegen/react-emitter.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import type { CodegenOptions } from '../../packages/mcp-server/src/codegen/types.js';

const defaultOptions: CodegenOptions = { typescript: true, styling: 'tokens' };
const jsOptions: CodegenOptions = { typescript: false, styling: 'tokens' };

function makeSchema(screens: UiSchema['screens']): UiSchema {
  return { version: '1.0.0', screens };
}

// ---------------------------------------------------------------------------
// Basic generation
// ---------------------------------------------------------------------------

describe('react-emitter', () => {
  it('generates valid TSX for a single component', () => {
    const schema = makeSchema([
      { id: 'btn-1', component: 'Button', props: { label: 'Click me' } },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.status).toBe('ok');
    expect(result.framework).toBe('react');
    expect(result.fileExtension).toBe('.tsx');
    expect(result.code).toContain("import React from 'react'");
    expect(result.code).toContain("import { Button } from '@oods/components-react'");
    expect(result.code).toContain('<Button');
    expect(result.code).toContain('id="btn-1"');
    expect(result.code).toContain('content="Click me"');
  });

  it('uses .jsx extension when typescript is false', () => {
    const schema = makeSchema([
      { id: 'btn-1', component: 'Button' },
    ]);

    const result = emit(schema, jsOptions);

    expect(result.fileExtension).toBe('.jsx');
    expect(result.code).not.toContain('React.FC');
    expect(result.code).not.toContain('Props =');
  });

  it('includes TypeScript prop types when enabled', () => {
    const schema = makeSchema([
      { id: 'btn-1', component: 'Button' },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain('React.FC');
    // s213-m01 (finding 6): the per-component aliases (`type ButtonProps = React.ComponentPropsWithoutRef<…>`) were
    // declared for every component and read by nothing, so a consumer compiling with noUnusedLocals rejected the file.
    expect(result.code).not.toContain('ButtonProps');
  });

  // -------------------------------------------------------------------------
  // Imports
  // -------------------------------------------------------------------------

  it('generates component imports from UiSchema component names', () => {
    const schema = makeSchema([
      {
        id: 'root',
        component: 'Card',
        children: [
          { id: 'h', component: 'CardHeader' },
          { id: 'b', component: 'Button' },
          { id: 't', component: 'Text' },
        ],
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain('Button');
    expect(result.code).toContain('Card');
    expect(result.code).toContain('CardHeader');
    expect(result.code).toContain('Text');
    // Sorted alphabetically in import
    const importLine = result.code.split('\n').find((l: string) => l.includes('@oods/components-react'));
    expect(importLine).toBeDefined();
    const match = importLine!.match(/\{(.+)\}/);
    expect(match).toBeTruthy();
    const names = match![1].split(',').map((s: string) => s.trim());
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('returns correct import list', () => {
    const schema = makeSchema([
      { id: 'btn-1', component: 'Button' },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.imports).toEqual(['react', '@oods/components-react', '@oods/component-styles/css']);
  });

  // -------------------------------------------------------------------------
  // Props mapping
  // -------------------------------------------------------------------------

  it('maps UiElement.props to JSX attributes', () => {
    const schema = makeSchema([
      {
        id: 'input-1',
        component: 'Input',
        props: {
          type: 'email',
          placeholder: 'Enter email',
          required: true,
          disabled: false,
          maxLength: 100,
        },
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain('type="email"');
    expect(result.code).toContain('placeholder="Enter email"');
    // boolean true renders as bare attribute
    expect(result.code).toContain('required');
    // boolean false renders with explicit value
    expect(result.code).toContain('disabled={false}');
    expect(result.code).toContain('maxLength={100}');
  });

  it('handles string props with special characters', () => {
    const schema = makeSchema([
      {
        id: 't-1',
        component: 'Text',
        props: { content: 'Hello "world" & friends' },
      },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('content="Hello &quot;world&quot; &amp; friends"');
  });

  it('handles array and object props as JSON', () => {
    const schema = makeSchema([
      {
        id: 'tbl-1',
        component: 'Table',
        props: {
          columns: [{ key: 'name', label: 'Name' }],
          config: { striped: true },
        },
      },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('columns={');
    expect(result.code).toContain('config={');
  });

  // -------------------------------------------------------------------------
  // Children rendering
  // -------------------------------------------------------------------------

  it('renders children recursively', () => {
    const schema = makeSchema([
      {
        id: 'card-1',
        component: 'Card',
        children: [
          {
            id: 'header-1',
            component: 'CardHeader',
            children: [
              { id: 'title-1', component: 'Text', props: { as: 'h1' } },
            ],
          },
          { id: 'btn-1', component: 'Button' },
        ],
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain('<Card');
    expect(result.code).toContain('<CardHeader');
    expect(result.code).toContain('<Text');
    expect(result.code).toContain('</Card>');
    expect(result.code).toContain('</CardHeader>');
    // Text has no children, so self-closing
    expect(result.code).toContain('<Text');
  });

  it('self-closes components without children', () => {
    const schema = makeSchema([
      { id: 'badge-1', component: 'Badge', props: { label: 'New' } },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('<Badge');
    expect(result.code).toContain('/>');
    expect(result.code).not.toContain('</Badge>');
  });

  it('handles deeply nested trees', () => {
    const schema = makeSchema([
      {
        id: 'l1',
        component: 'Stack',
        children: [
          {
            id: 'l2',
            component: 'Card',
            children: [
              {
                id: 'l3',
                component: 'Stack',
                children: [
                  {
                    id: 'l4',
                    component: 'Text',
                    children: [
                      { id: 'l5', component: 'Badge' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.status).toBe('ok');
    // Each level should be properly nested
    expect(result.code).toContain('</Stack>');
    expect(result.code).toContain('</Card>');
    expect(result.code).toContain('</Text>');
  });

  // -------------------------------------------------------------------------
  // Layout props → React style objects
  // -------------------------------------------------------------------------

  it('translates stack layout to flex column style', () => {
    const schema = makeSchema([
      {
        id: 's-1',
        component: 'Stack',
        layout: { type: 'stack' },
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain("display: 'flex'");
    expect(result.code).toContain("flexDirection: 'column'");
  });

  it('translates inline layout to flex row style', () => {
    const schema = makeSchema([
      {
        id: 'i-1',
        component: 'Stack',
        layout: { type: 'inline' },
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain("display: 'flex'");
    expect(result.code).toContain("flexDirection: 'row'");
  });

  it('translates grid layout to CSS grid style', () => {
    const schema = makeSchema([
      {
        id: 'g-1',
        component: 'Grid',
        layout: { type: 'grid' },
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain("display: 'grid'");
    expect(result.code).toContain('gridTemplateColumns');
  });

  it('translates sidebar layout', () => {
    const schema = makeSchema([
      {
        id: 'sb-1',
        component: 'Card',
        layout: { type: 'sidebar' },
        children: [
          { id: 'main-1', component: 'Stack' },
          { id: 'aside-1', component: 'Stack' },
        ],
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain('data-sidebar-main');
    expect(result.code).toContain('data-sidebar-aside');
  });

  it('applies alignment to layout', () => {
    const schema = makeSchema([
      {
        id: 's-1',
        component: 'Stack',
        layout: { type: 'stack', align: 'center' },
      },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain("alignItems: 'center'");
  });

  it('applies gap token to layout', () => {
    const schema = makeSchema([
      {
        id: 's-1',
        component: 'Stack',
        layout: { type: 'stack', gapToken: 'md' },
      },
    ]);

    const result = emit(schema, defaultOptions);
    // t-shirt spacing sizes resolve to their scale-<size> leaf (sprint-125 m03 #552)
    expect(result.code).toContain('var(--ref-space-scale-md)');
  });

  // -------------------------------------------------------------------------
  // Style tokens
  // -------------------------------------------------------------------------

  it('resolves style tokens to CSS variables', () => {
    const schema = makeSchema([
      {
        id: 'c-1',
        component: 'Card',
        style: {
          spacingToken: 'lg',
          radiusToken: 'md',
          shadowToken: 'sm',
          colorToken: 'primary',
          typographyToken: 'body.md',
        },
      },
    ]);

    const result = emit(schema, defaultOptions);

    expect(result.code).toContain('var(--ref-space-scale-lg)');
    expect(result.code).toContain('var(--ref-radius-md)');
    expect(result.code).toContain('var(--ref-shadow-sm)');
    expect(result.code).toContain('var(--ref-color-primary)');
    expect(result.code).toContain('var(--ref-typography-body-md)');
  });

  // -------------------------------------------------------------------------
  // data attributes
  // -------------------------------------------------------------------------

  it('adds data-oods-component attribute', () => {
    const schema = makeSchema([
      { id: 'b-1', component: 'Button' },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('data-oods-component="Button"');
  });

  it('adds data-layout attribute when layout is set', () => {
    const schema = makeSchema([
      { id: 's-1', component: 'Stack', layout: { type: 'stack' } },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('data-layout="stack"');
  });

  // -------------------------------------------------------------------------
  // Section layout
  // -------------------------------------------------------------------------

  it('wraps section layout in a section element', () => {
    const schema = makeSchema([
      {
        id: 'sec-1',
        component: 'Card',
        layout: { type: 'section' },
        children: [
          { id: 'inner-1', component: 'Text' },
        ],
      },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('<section data-layout="section"');
    expect(result.code).toContain('</section>');
  });

  // -------------------------------------------------------------------------
  // Multiple screens
  // -------------------------------------------------------------------------

  it('renders multiple screens inside one page landmark (s202-m01)', () => {
    const schema = makeSchema([
      { id: 'screen-1', component: 'Card' },
      { id: 'screen-2', component: 'Card' },
    ]);

    const result = emit(schema, defaultOptions);

    // Sprint 202 m01: a standalone emission is a page, so its screens sit in one main landmark named after the
    // first screen, where the fragment used to be. These screens carry no label, so the shell adds no heading.
    expect(result.code).toContain('<main data-oods-shell="screen-1">');
    expect(result.code).toContain('</main>');
    expect(result.code).not.toContain('data-oods-shell-heading');
    // Both screens present
    expect(result.code).toContain('id="screen-1"');
    expect(result.code).toContain('id="screen-2"');
  });

  // -------------------------------------------------------------------------
  // Component wrapper
  // -------------------------------------------------------------------------

  it('exports a GeneratedUI component', () => {
    const schema = makeSchema([
      { id: 'b-1', component: 'Button' },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.code).toContain('export const GeneratedUI');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles empty children array', () => {
    const schema = makeSchema([
      { id: 'c-1', component: 'Card', children: [] },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.status).toBe('ok');
    // Empty children → self-closing
    expect(result.code).toContain('/>');
  });

  it('handles component with no props', () => {
    const schema = makeSchema([
      { id: 'c-1', component: 'Card' },
    ]);

    const result = emit(schema, defaultOptions);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('<Card');
  });

  it('deduplicates component imports', () => {
    const schema = makeSchema([
      {
        id: 'root',
        component: 'Stack',
        children: [
          { id: 'b1', component: 'Button' },
          { id: 'b2', component: 'Button' },
          { id: 'b3', component: 'Button' },
        ],
      },
    ]);

    const result = emit(schema, defaultOptions);
    // Button should appear only once in import
    const importLine = result.code.split('\n').find((l: string) => l.includes('@oods/components-react'))!;
    const count = (importLine.match(/Button/g) || []).length;
    expect(count).toBe(1);
  });
});
