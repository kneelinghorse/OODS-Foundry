import { describe, expect, it } from 'vitest';
import { renderTree } from '../../src/render/tree-renderer.js';
import { emit as emitReact } from '../../src/codegen/react-emitter.js';
import { emit as emitVue } from '../../src/codegen/vue-emitter.js';
import { emit as emitHtml } from '../../src/codegen/html-emitter.js';
import type { UiSchema, UiElement } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const ALIGN_CASES = [
  { align: 'start', css: 'flex-start' },
  { align: 'center', css: 'center' },
  { align: 'end', css: 'flex-end' },
  { align: 'space-between', css: 'space-between' },
] as const;

const codegenOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

function makeSchema(layout: UiElement['layout']): UiSchema {
  return {
    version: '1.0',
    screens: [
      {
        id: 'root',
        component: 'Stack',
        layout,
        children: [],
      },
    ],
  };
}

describe('layout alignment mapping', () => {
  for (const { align, css } of ALIGN_CASES) {
    it(`inline layout uses justify-content for align=${align}`, () => {
      const schema = makeSchema({ type: 'inline', align });

      const html = renderTree(schema);
      expect(html).toContain(`justify-content:${css}`);
      expect(html).not.toContain(`align-items:${css}`);

      const htmlCodegen = emitHtml(schema, codegenOpts);
      expect(htmlCodegen.status).toBe('ok');
      expect(htmlCodegen.code).toContain(`justify-content:${css}`);
      expect(htmlCodegen.code).not.toContain(`align-items:${css}`);

      const react = emitReact(schema, codegenOpts);
      expect(react.status).toBe('ok');
      expect(react.code).toContain(`justifyContent: '${css}'`);
      expect(react.code).not.toContain(`alignItems: '${css}'`);

      const vue = emitVue(schema, codegenOpts);
      expect(vue.status).toBe('ok');
      expect(vue.code).toContain(`justify-content: ${css}`);
      expect(vue.code).not.toContain(`align-items: ${css}`);
    });

    // s221-m01: align-items has no space-between value, so a stack's space-between distributes along its axis with
    // justify-content, as the HTML renderer has since s215-m02 (#2392, #2393); React and Vue emitted the invalid
    // declaration (browsers drop it) on every composed detail header until s221-m01.
    const property = align === 'space-between' ? 'justify-content' : 'align-items';
    const reactProperty = align === 'space-between' ? 'justifyContent' : 'alignItems';
    it(`stack layout uses ${property} for align=${align}`, () => {
      const schema = makeSchema({ type: 'stack', align });

      const html = renderTree(schema);
      expect(html).toContain(`${property}:${css}`);
      expect(html).not.toContain('align-items:space-between');

      const htmlCodegen = emitHtml(schema, codegenOpts);
      expect(htmlCodegen.status).toBe('ok');
      expect(htmlCodegen.code).toContain(`${property}:${css}`);

      const react = emitReact(schema, codegenOpts);
      expect(react.status).toBe('ok');
      expect(react.code).toContain(`${reactProperty}: '${css}'`);
      expect(react.code).not.toContain("alignItems: 'space-between'");

      const vue = emitVue(schema, codegenOpts);
      expect(vue.status).toBe('ok');
      expect(vue.code).toContain(`${property}: ${css}`);
      expect(vue.code).not.toContain('align-items: space-between');
    });
  }
});
