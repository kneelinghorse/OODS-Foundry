import { describe, it, expect } from 'vitest';
import { emit } from '../../packages/mcp-server/src/codegen/vue-emitter.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import type { CodegenOptions } from '../../packages/mcp-server/src/codegen/types.js';

const tsOptions: CodegenOptions = { typescript: true, styling: 'tokens' };
const jsOptions: CodegenOptions = { typescript: false, styling: 'tokens' };
const inlineOptions: CodegenOptions = { typescript: true, styling: 'inline' };

function makeSchema(screens: UiSchema['screens']): UiSchema {
  return { version: '1.0.0', screens };
}

// ---------------------------------------------------------------------------
// SFC structure
// ---------------------------------------------------------------------------

describe('vue-emitter', () => {
  it('generates a valid Vue SFC with template and script blocks', () => {
    const schema = makeSchema([
      { id: 'btn-1', component: 'Button', props: { label: 'Click' } },
    ]);

    const result = emit(schema, tsOptions);

    expect(result.status).toBe('ok');
    expect(result.framework).toBe('vue');
    expect(result.fileExtension).toBe('.vue');
    expect(result.code).toContain('<template>');
    expect(result.code).toContain('</template>');
    expect(result.code).toContain('<script setup');
    expect(result.code).toContain('</script>');
  });

  it('includes lang="ts" in script tag when typescript enabled', () => {
    const schema = makeSchema([{ id: 'b-1', component: 'Button' }]);
    const result = emit(schema, tsOptions);
    expect(result.code).toContain('<script setup lang="ts">');
  });

  it('omits lang="ts" when typescript disabled', () => {
    const schema = makeSchema([{ id: 'b-1', component: 'Button' }]);
    const result = emit(schema, jsOptions);
    expect(result.code).toContain('<script setup>');
    expect(result.code).not.toContain('lang="ts"');
  });

  it('includes defineProps in typescript mode', () => {
    const schema = makeSchema([{ id: 'b-1', component: 'Button' }]);
    const result = emit(schema, tsOptions);
    expect(result.code).toContain('defineProps<');
  });

  it('omits defineProps in javascript mode', () => {
    const schema = makeSchema([{ id: 'b-1', component: 'Button' }]);
    const result = emit(schema, jsOptions);
    expect(result.code).not.toContain('defineProps');
  });

  // -------------------------------------------------------------------------
  // Imports
  // -------------------------------------------------------------------------

  it('generates sorted component imports', () => {
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

    const result = emit(schema, tsOptions);
    const importLine = result.code.split('\n').find((l: string) => l.includes('@oods/components-vue'));
    expect(importLine).toBeDefined();
    const match = importLine!.match(/\{(.+)\}/);
    expect(match).toBeTruthy();
    const names = match![1].split(',').map((s: string) => s.trim());
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('returns correct import list', () => {
    const schema = makeSchema([{ id: 'b-1', component: 'Button' }]);
    const result = emit(schema, tsOptions);
    expect(result.imports).toEqual(['@oods/components-vue', '@oods/component-styles/css']);
  });

  // -------------------------------------------------------------------------
  // Template: props mapping
  // -------------------------------------------------------------------------

  it('maps string props to Vue template attributes', () => {
    const schema = makeSchema([
      {
        id: 'i-1',
        component: 'Input',
        props: { type: 'email', placeholder: 'Enter email' },
      },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('type="email"');
    expect(result.code).toContain('placeholder="Enter email"');
  });

  it('maps boolean true props as bare attributes', () => {
    const schema = makeSchema([
      { id: 'i-1', component: 'Input', props: { required: true } },
    ]);

    const result = emit(schema, tsOptions);
    // Boolean true → bare attribute (not :required="true")
    expect(result.code).toMatch(/\brequired\b/);
  });

  it('maps boolean false props with v-bind syntax', () => {
    const schema = makeSchema([
      { id: 'i-1', component: 'Input', props: { disabled: false } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain(':disabled="false"');
  });

  it('maps number props with v-bind syntax', () => {
    const schema = makeSchema([
      { id: 'i-1', component: 'Input', props: { maxLength: 100 } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain(':maxLength="100"');
  });

  it('maps array/object props with v-bind', () => {
    const schema = makeSchema([
      {
        id: 'tbl-1',
        component: 'Table',
        props: { columns: [{ key: 'name' }] },
      },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain(':columns=');
  });

  // -------------------------------------------------------------------------
  // Template: children rendering
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
              { id: 'title-1', component: 'Text' },
            ],
          },
          { id: 'btn-1', component: 'Button' },
        ],
      },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('<Card');
    expect(result.code).toContain('<CardHeader');
    expect(result.code).toContain('<Text');
    expect(result.code).toContain('</Card>');
    expect(result.code).toContain('</CardHeader>');
  });

  it('self-closes components without children', () => {
    const schema = makeSchema([
      { id: 'badge-1', component: 'Badge' },
    ]);

    const result = emit(schema, tsOptions);
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
                  { id: 'l4', component: 'Text' },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.status).toBe('ok');
    expect(result.code).toContain('</Stack>');
    expect(result.code).toContain('</Card>');
  });

  // -------------------------------------------------------------------------
  // Layout props → inline styles
  // -------------------------------------------------------------------------

  it('translates stack layout to flex column', () => {
    const schema = makeSchema([
      { id: 's-1', component: 'Stack', layout: { type: 'stack' } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('display: flex');
    expect(result.code).toContain('flex-direction: column');
  });

  it('translates inline layout to flex row', () => {
    const schema = makeSchema([
      { id: 'i-1', component: 'Stack', layout: { type: 'inline' } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('display: flex');
    expect(result.code).toContain('flex-direction: row');
  });

  it('translates grid layout', () => {
    const schema = makeSchema([
      { id: 'g-1', component: 'Grid', layout: { type: 'grid' } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('display: grid');
    expect(result.code).toContain('grid-template-columns');
  });

  it('translates sidebar layout with wrapper elements', () => {
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

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('data-sidebar-main');
    expect(result.code).toContain('data-sidebar-aside');
  });

  it('applies alignment', () => {
    const schema = makeSchema([
      { id: 's-1', component: 'Stack', layout: { type: 'stack', align: 'center' } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('align-items: center');
  });

  it('applies gap token', () => {
    const schema = makeSchema([
      { id: 's-1', component: 'Stack', layout: { type: 'stack', gapToken: 'md' } },
    ]);

    const result = emit(schema, tsOptions);
    // converged onto the canonical --ref-space-* prefix + scale-<size> leaf (sprint-125 m03)
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

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('var(--ref-space-scale-lg)');
    expect(result.code).toContain('var(--ref-radius-md)');
    expect(result.code).toContain('var(--ref-shadow-sm)');
    expect(result.code).toContain('var(--ref-color-primary)');
    expect(result.code).toContain('var(--ref-typography-body-md)');
  });

  // -------------------------------------------------------------------------
  // Scoped style block
  // -------------------------------------------------------------------------

  it('includes scoped style block when tokens styling + token refs present', () => {
    const schema = makeSchema([
      { id: 'c-1', component: 'Card', style: { colorToken: 'primary' } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('<style scoped>');
    expect(result.code).toContain('</style>');
  });

  it('omits scoped style block when styling is not tokens', () => {
    const schema = makeSchema([
      { id: 'c-1', component: 'Card', style: { colorToken: 'primary' } },
    ]);

    const result = emit(schema, inlineOptions);
    expect(result.code).not.toContain('<style scoped>');
  });

  it('omits scoped style block when no token refs exist', () => {
    const schema = makeSchema([
      { id: 'b-1', component: 'Button' },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).not.toContain('<style scoped>');
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

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('<section data-layout="section"');
    expect(result.code).toContain('</section>');
  });

  // -------------------------------------------------------------------------
  // Data attributes
  // -------------------------------------------------------------------------

  it('adds data-oods-component attribute', () => {
    const schema = makeSchema([{ id: 'b-1', component: 'Button' }]);
    const result = emit(schema, tsOptions);
    expect(result.code).toContain('data-oods-component="Button"');
  });

  it('adds data-layout attribute when layout is set', () => {
    const schema = makeSchema([
      { id: 's-1', component: 'Stack', layout: { type: 'stack' } },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('data-layout="stack"');
  });

  // -------------------------------------------------------------------------
  // Multiple screens
  // -------------------------------------------------------------------------

  it('renders multiple screens in the template', () => {
    const schema = makeSchema([
      { id: 'screen-1', component: 'Card' },
      { id: 'screen-2', component: 'Card' },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.code).toContain('id="screen-1"');
    expect(result.code).toContain('id="screen-2"');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles empty children array', () => {
    const schema = makeSchema([
      { id: 'c-1', component: 'Card', children: [] },
    ]);

    const result = emit(schema, tsOptions);
    expect(result.status).toBe('ok');
  });

  it('deduplicates component imports', () => {
    const schema = makeSchema([
      {
        id: 'root',
        component: 'Stack',
        children: [
          { id: 'b1', component: 'Button' },
          { id: 'b2', component: 'Button' },
        ],
      },
    ]);

    const result = emit(schema, tsOptions);
    const importLine = result.code.split('\n').find((l: string) => l.includes('@oods/components-vue'))!;
    const count = (importLine.match(/Button/g) || []).length;
    expect(count).toBe(1);
  });
});
