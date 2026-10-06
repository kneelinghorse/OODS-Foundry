/**
 * Cross-framework parity tests (s79-m02).
 *
 * Verifies that React, Vue, and HTML emitters all handle the same
 * component/slot patterns: nested children, sidebar layout, section layout,
 * field content injection, event bindings, objectSchema props, and token overrides.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import type { UiSchema, FieldSchemaEntry } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const defaultOpts: CodegenOptions = { typescript: true, styling: 'tokens' };
const vueCompiler = createRequire(
  new URL('../../../components-vue/package.json', import.meta.url),
)('@vue/compiler-sfc');
const mcpServerRoot = fileURLToPath(new URL('../../', import.meta.url));

function reactSemanticErrors(code: string): string[] {
  const compileRoot = mkdtempSync(path.join(mcpServerRoot, '.s182-react-safety-'));
  try {
    const fileName = path.join(compileRoot, 'GeneratedUI.tsx');
    writeFileSync(fileName, code);
    const program = ts.createProgram([fileName], {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    });
    return ts.getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  } finally {
    rmSync(compileRoot, { recursive: true, force: true });
  }
}

function reactSyntacticErrors(code: string): string[] {
  const compileRoot = mkdtempSync(path.join(mcpServerRoot, '.s182-react-syntax-'));
  try {
    const fileName = path.join(compileRoot, 'GeneratedUI.tsx');
    writeFileSync(fileName, code);
    const program = ts.createProgram([fileName], {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
    });
    return program.getSyntacticDiagnostics()
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  } finally {
    rmSync(compileRoot, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/*  Shared test schemas                                                */
/* ------------------------------------------------------------------ */

const nestedSchema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'outer',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'md' },
      children: [
        {
          id: 'card-1',
          component: 'Card',
          style: { radiusToken: 'sm' },
          children: [
            { id: 'text-1', component: 'Text', props: { content: 'Hello' } },
            {
              id: 'inner-stack',
              component: 'Stack',
              layout: { type: 'inline', align: 'center' },
              children: [
                { id: 'btn-1', component: 'Button', props: { label: 'Save' } },
                { id: 'btn-2', component: 'Button', props: { label: 'Cancel' } },
              ],
            },
          ],
        },
        { id: 'badge-1', component: 'Badge', props: { label: 'Active' } },
      ],
    },
  ],
};

const sidebarSchema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'layout-root',
      component: 'Stack',
      layout: { type: 'sidebar' },
      children: [
        { id: 'main-content', component: 'Card', children: [
          { id: 'main-text', component: 'Text', props: { content: 'Main' } },
        ]},
        { id: 'aside-1', component: 'Badge', props: { label: 'Side' } },
        { id: 'aside-2', component: 'Button', props: { label: 'Action' } },
      ],
    },
  ],
};

const sectionSchema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'section-root',
      component: 'Card',
      layout: { type: 'section' },
      style: { spacingToken: 'lg' },
      bindings: { onEdit: 'handleEdit' },
      children: [
        { id: 'sec-text', component: 'Text', props: { content: 'Section' } },
      ],
    },
  ],
};

const fieldBindingSchema: UiSchema = {
  version: '2026.03',
  objectSchema: {
    name: { type: 'string', required: true, description: 'Product name' },
    price: { type: 'number', required: true },
    status: { type: 'string', required: true, enum: ['active', 'inactive'] },
    email: { type: 'email', required: false, description: 'Contact email' },
  },
  screens: [
    {
      id: 'form-root',
      component: 'Stack',
      layout: { type: 'stack' },
      bindings: { onSubmit: 'handleSubmit' },
      children: [
        { id: 'name-text', component: 'Text', props: { field: 'name' } },
        { id: 'status-badge', component: 'StatusBadge', props: { field: 'status' } },
        { id: 'email-input', component: 'Input', props: { field: 'email' } },
        { id: 'price-text', component: 'Text', props: { field: 'price' } },
        { id: 'category-select', component: 'Select', props: { field: 'status' } },
      ],
    },
  ],
};

const tokenOverrideSchema: UiSchema = {
  version: '2026.03',
  tokenOverrides: {
    'color.primary': '#ff0000',
    'spacing.base': '8px',
  },
  screens: [
    {
      id: 'root',
      component: 'Card',
      style: { colorToken: 'primary' },
      children: [
        { id: 'text', component: 'Text', props: { content: 'Branded' } },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Parity tests                                                       */
/* ------------------------------------------------------------------ */

describe('cross-framework parity', () => {
  describe('nested children (3+ levels)', () => {
    const react = reactEmit(nestedSchema, defaultOpts);
    const vue = vueEmit(nestedSchema, defaultOpts);
    const html = htmlEmit(nestedSchema, defaultOpts);

    it('all frameworks emit ok', () => {
      expect(react.status).toBe('ok');
      expect(vue.status).toBe('ok');
      expect(html.status).toBe('ok');
    });

    it('all frameworks contain all component names', () => {
      for (const result of [react, vue, html]) {
        expect(result.code).toContain('Stack');
        expect(result.code).toContain('Card');
        expect(result.code).toContain('Text');
        expect(result.code).toContain('Button');
        expect(result.code).toContain('Badge');
      }
    });

    it('all frameworks contain all node ids', () => {
      const ids = ['outer', 'card-1', 'text-1', 'inner-stack', 'btn-1', 'btn-2', 'badge-1'];
      for (const result of [react, vue, html]) {
        for (const id of ids) {
          expect(result.code).toContain(id);
        }
      }
    });
  });

  describe('sidebar layout', () => {
    const react = reactEmit(sidebarSchema, defaultOpts);
    const vue = vueEmit(sidebarSchema, defaultOpts);
    const html = htmlEmit(sidebarSchema, defaultOpts);

    it('all frameworks emit ok', () => {
      expect(react.status).toBe('ok');
      expect(vue.status).toBe('ok');
      expect(html.status).toBe('ok');
    });

    it('React and Vue emit sidebar wrapper elements', () => {
      expect(react.code).toContain('data-sidebar-main');
      expect(react.code).toContain('data-sidebar-aside');
      expect(vue.code).toContain('data-sidebar-main');
      expect(vue.code).toContain('data-sidebar-aside');
    });

    it('all frameworks contain all component ids', () => {
      const ids = ['layout-root', 'main-content', 'aside-1', 'aside-2'];
      for (const result of [react, vue, html]) {
        for (const id of ids) {
          expect(result.code).toContain(id);
        }
      }
    });
  });

  describe('section layout with bindings', () => {
    const react = reactEmit(sectionSchema, defaultOpts);
    const vue = vueEmit(sectionSchema, defaultOpts);

    it('both frameworks wrap in section element', () => {
      expect(react.code).toContain('<section data-layout="section"');
      expect(vue.code).toContain('<section data-layout="section"');
    });

    it('both frameworks keep semantic screen actions off the section component', () => {
      expect(react.code).not.toMatch(/Card[^>]*onEdit=/);
      expect(vue.code).not.toMatch(/Card[^>]*@edit=/);
    });

    it('both frameworks declare the same required action', () => {
      expect(react.code).toContain('handleEdit: () => void;');
      expect(vue.code).toContain('handleEdit: () => void;');
      expect(react.actions).toEqual(vue.actions);
    });
  });

  describe('field content injection', () => {
    const react = reactEmit(fieldBindingSchema, defaultOpts);
    const vue = vueEmit(fieldBindingSchema, defaultOpts);
    const html = htmlEmit(fieldBindingSchema, defaultOpts);

    it('all frameworks emit ok', () => {
      expect(react.status).toBe('ok');
      expect(vue.status).toBe('ok');
      expect(html.status).toBe('ok');
    });

    it('React injects field values via JSX expressions', () => {
      expect(react.code).toContain('{name}');       // children strategy
      expect(react.code).toContain('status={status}'); // status-prop strategy
      expect(react.code).toContain('value={email}');   // value-prop strategy
    });

    it('Vue injects field values via template syntax', () => {
      expect(vue.code).toContain('{{ name }}');        // children strategy
      expect(vue.code).toContain(':status="status"');  // status-prop strategy
      expect(vue.code).toContain('v-model="email"');   // idiomatic two-way binding strategy
    });

    it('HTML injects sample values without placeholder markers', () => {
      expect(html.code).not.toContain('data-bind="name"');
      expect(html.code).not.toContain('[name]');
    });

    it('React generates typed props interface', () => {
      expect(react.code).toContain('export interface PageProps');
    });

    it('Vue generates ref() bindings for form schemas (Input/Select present)', () => {
      expect(vue.code).toContain("import { ref } from 'vue'");
      expect(vue.code).toContain('ref<');
    });

    it('React destructures field names from props', () => {
      expect(react.code).toMatch(/\{\s*actions.*email.*name.*price.*status\s*\}/);
    });
  });

  describe('event binding parity', () => {
    const react = reactEmit(fieldBindingSchema, defaultOpts);
    const vue = vueEmit(fieldBindingSchema, defaultOpts);

    it('React declares onSubmit as a required semantic action', () => {
      expect(react.code).not.toContain('onSubmit={handleSubmit}');
      expect(react.code).toContain('handleSubmit: () => void;');
    });

    it('Vue declares onSubmit as a required semantic action', () => {
      expect(vue.code).not.toContain('@submit="handleSubmit"');
      expect(vue.code).toContain('handleSubmit: () => void;');
    });

    it('both omit blank handler stubs', () => {
      expect(react.code).not.toMatch(/TODO|=>\s*\{\s*\}/);
      expect(vue.code).not.toMatch(/TODO|=>\s*\{\s*\}/);
    });
  });

  describe('prop enrichment parity', () => {
    const react = reactEmit(fieldBindingSchema, defaultOpts);
    const vue = vueEmit(fieldBindingSchema, defaultOpts);

    it('both frameworks emit placeholder for form inputs', () => {
      expect(react.code).toContain('placeholder="Contact email"');
      expect(vue.code).toContain('placeholder="Contact email"');
    });

    it('both frameworks emit type from semantic field type', () => {
      expect(react.code).toContain('type="email"');
      expect(vue.code).toContain('type="email"');
    });

    it('both frameworks emit enum options for Select', () => {
      expect(react.code).toContain('options=');
      expect(vue.code).toContain(':options=');
    });
  });

  describe('token overrides', () => {
    const react = reactEmit(tokenOverrideSchema, defaultOpts);
    const vue = vueEmit(tokenOverrideSchema, defaultOpts);

    it('React emits token overrides as CSS variable comment', () => {
      expect(react.code).toContain('--token-color-primary');
      expect(react.code).toContain('--token-spacing-base');
    });

    it('Vue emits token overrides as style block', () => {
      expect(vue.code).toContain('--token-color-primary');
      expect(vue.code).toContain('--token-spacing-base');
    });
  });

  describe('framework metadata', () => {
    const react = reactEmit(nestedSchema, defaultOpts);
    const vue = vueEmit(nestedSchema, defaultOpts);
    const html = htmlEmit(nestedSchema, defaultOpts);

    it('React returns .tsx extension and react framework', () => {
      expect(react.framework).toBe('react');
      expect(react.fileExtension).toBe('.tsx');
    });

    it('Vue returns .vue extension and vue framework', () => {
      expect(vue.framework).toBe('vue');
      expect(vue.fileExtension).toBe('.vue');
    });

    it('HTML returns .html extension and html framework', () => {
      expect(html.framework).toBe('html');
      expect(html.fileExtension).toBe('.html');
    });

    it('React and Vue include their real framework packages and shared CSS in imports', () => {
      expect(react.imports).toContain('@oods/components-react');
      expect(vue.imports).toContain('@oods/components-vue');
      expect(react.imports).toContain('@oods/component-styles/css');
      expect(vue.imports).toContain('@oods/component-styles/css');
    });

    it('HTML has no imports', () => {
      expect(html.imports).toEqual([]);
    });
  });
});

describe('Sprint 182 bounded framework normalization', () => {
  const schema: UiSchema = {
    version: '2026.03',
    objectSchema: {
      email_address: { type: 'email', required: true, description: 'Account email' },
      action_label: { examples: ['Action label'], type: 'string', required: true },
    },
    screens: [
      {
        id: 'input-node',
        component: 'Input',
        props: {
          id: 'explicit-input',
          field: 'email_address',
          value: 'stale@example.test',
          readonly: true,
        },
        bindings: { onUpdate: 'handleInputUpdate' },
      },
      {
        id: 'table-node',
        component: 'Table',
        props: {
          rows: [{ name: 'Ada' }, { id: 'fixed-row', name: 'Lin' }],
        },
      },
      {
        id: 'legacy-tabs',
        component: 'Tabs',
        props: {
          tabs: [
            { id: 'overview', label: 'Overview', content: 'Overview panel', active: true },
            { id: 'billing', label: 'Billing', content: 'Billing panel' },
          ],
        },
      },
      {
        id: 'fallback-active-tabs',
        component: 'Tabs',
        props: {
          tabs: [
            { label: "Owner's tab", content: "Owner's panel", active: true },
            { label: 'Team', content: 'Team panel' },
          ],
        },
      },
      {
        id: 'direct-active-tabs',
        component: 'Tabs',
        props: {
          active: 'billing',
          items: [
            { id: 'overview', label: 'Overview', panel: 'Overview panel' },
            { id: 'billing', label: 'Billing', panel: 'Billing panel' },
          ],
        },
        bindings: { onUpdate: 'handleTabUpdate' },
      },
      {
        id: 'child-tabs',
        component: 'Tabs',
        children: [
          {
            id: 'child-panel',
            component: 'Stack',
            props: { label: 'Child panel' },
            children: [
              { id: 'tabs-panel-copy', component: 'Text', props: { content: 'Visible child panel' } },
            ],
          },
        ],
      },
      {
        id: 'active-card-tabs',
        component: 'Tabs',
        children: [
          {
            id: 'overview-card',
            component: 'Card',
            meta: { label: 'Overview' },
            props: { body: 'Body panel', active: true },
          },
        ],
      },
      {
        id: 'mixed-tabs',
        component: 'Tabs',
        props: {
          items: [{ id: 'explicit-item', label: 'Explicit', panel: 'Explicit panel' }],
        },
        children: [
          {
            id: 'dead-mixed-panel',
            component: 'Text',
            props: { content: 'must not emit beside explicit items' },
          },
        ],
      },
      {
        id: 'body-card',
        component: 'Card',
        props: { body: 'Visible card body' },
      },
      {
        id: 'bound-badge',
        component: 'Badge',
        props: { field: 'action_label' },
      },
      {
        id: 'bound-button',
        component: 'Button',
        props: { field: 'action_label' },
      },
      {
        id: 'static-bound-badge',
        component: 'Badge',
        props: { field: 'action_label', label: 'Static badge content' },
      },
      {
        id: 'static-bound-button',
        component: 'Button',
        props: { field: 'action_label', label: 'Static button content' },
      },
    ],
  };

  const react = reactEmit(schema, defaultOpts);
  const vue = vueEmit(schema, defaultOpts);
  const unsafeTokenValue = '*/\nconst injected = true;\n/*</style><script>evil()</script>';
  const unsafeSchema: UiSchema = {
    version: '2026.03',
    tokenOverrides: {
      'unsafe*/key': unsafeTokenValue,
    },
    screens: [
      {
        id: 'section" data-owned={evil}',
        component: 'Card',
        layout: { type: 'section', gapToken: `gap'" onClick={evil}` },
        props: { id: 'card" onClick={evil}', body: 'Safe card body' },
      },
      {
        id: 'unsafe-button-node',
        component: 'Button',
        layout: { type: 'stack', gapToken: `gap'" onClick={evil}` },
        props: {
          id: 'button" onClick={evil}',
          content: 'x" onClick={evil} &quot; <unsafe>',
        },
      },
      {
        id: 'apostrophe-tabs',
        component: 'Tabs',
        props: {
          items: [{
            id: 'owners',
            label: "Owner's &quot; team",
            panel: "Owner's <panel>",
          }],
        },
      },
    ],
  };
  const unsafeReact = reactEmit(unsafeSchema, { typescript: true, styling: 'inline' });
  const unsafeVue = vueEmit(unsafeSchema, { typescript: true, styling: 'inline' });
  const sectionBindingSchema: UiSchema = {
    version: '2026.03',
    objectSchema: {
      heading: { type: 'string', required: true },
      email: { type: 'email', required: true },
    },
    screens: [
      {
        id: 'section-heading',
        component: 'Text',
        layout: { type: 'section' },
        props: { field: 'heading' },
      },
      {
        id: 'section-email',
        component: 'Input',
        layout: { type: 'section' },
        props: { field: 'email' },
      },
    ],
  };
  const sectionReact = reactEmit(sectionBindingSchema, defaultOpts);
  const sectionVue = vueEmit(sectionBindingSchema, defaultOpts);
  const nucleusFieldSchema: UiSchema = {
    version: '2026.03',
    objectSchema: {
      accepted: { type: 'boolean', required: true },
      birthday: { type: 'date', required: true },
      notes: { type: 'string', required: true },
    },
    screens: [
      { id: 'bound-date', component: 'DatePicker', props: { field: 'birthday' } },
      { id: 'bound-notes', component: 'Textarea', props: { field: 'notes' } },
      { id: 'bound-checkbox', component: 'Checkbox', props: { field: 'accepted' } },
      {
        id: 'explicit-date',
        component: 'DatePicker',
        props: { field: 'birthday', value: '2026-09-03' },
      },
      {
        id: 'explicit-checkbox',
        component: 'Checkbox',
        props: { field: 'accepted', checked: false },
      },
      {
        id: 'missing-field',
        component: 'Input',
        props: { field: 'missing\" @click=\"globalThis.pwned=true' },
      },
    ],
  };
  const nucleusReact = reactEmit(nucleusFieldSchema, defaultOpts);
  const nucleusVue = vueEmit(nucleusFieldSchema, defaultOpts);
  const hostileVariantSchema: UiSchema = {
    version: '2026.03',
    screens: [
      { id: 'safe-variant', component: 'Button', props: { content: 'Safe', intent: 'primary' } },
      {
        id: 'hostile-variant',
        component: 'Button',
        props: {
          class: `x\"] @click=\"globalThis.pwned=true\n</script>`,
          content: 'Hostile',
          intent: `danger\nx\" & </script><script>globalThis.pwned=true</script>`,
        },
      },
    ],
  };
  const hostileVariantReact = reactEmit(hostileVariantSchema, {
    typescript: true,
    styling: 'tailwind',
  });
  const hostileVariantVue = vueEmit(hostileVariantSchema, {
    typescript: true,
    styling: 'tailwind',
  });
  const supportedVariantSchema: UiSchema = {
    version: '2026.03',
    screens: [
      { id: 'primary-variant', component: 'Button', props: { content: 'Save', intent: 'primary' } },
      { id: 'secondary-variant', component: 'Button', props: { content: 'Cancel', intent: 'secondary' } },
    ],
  };
  const supportedVariantReact = reactEmit(supportedVariantSchema, {
    typescript: true,
    styling: 'tailwind',
  });
  const supportedVariantVue = vueEmit(supportedVariantSchema, {
    typescript: true,
    styling: 'tailwind',
  });

  it('emits explicit ids once through the object-field rebuild path and normalizes readOnly', () => {
    expect(react.code.match(/id="explicit-input"/g)).toHaveLength(1);
    expect(vue.code.match(/id="explicit-input"/g)).toHaveLength(1);
    expect(react.code).not.toContain('id="input-node"');
    expect(vue.code).not.toContain('id="input-node"');
    expect(react.code).toContain('readOnly');
    expect(vue.code).toContain('readOnly');
    expect(react.code).not.toContain('readonly');
    expect(vue.code).not.toContain('readonly');
  });

  it('assigns deterministic row ids without replacing supplied ids', () => {
    expect(react.code).toContain('"id":"table-node-row-1"');
    expect(react.code).toContain('"id":"fixed-row"');
    expect(vue.code).toContain('table-node-row-1');
    expect(vue.code).toContain('fixed-row');
  });

  it('normalizes legacy Tabs items, panels, and active selection', () => {
    for (const code of [react.code, vue.code]) {
      expect(code).toContain('defaultSelectedId="overview"');
      expect(code).toContain('handleTabUpdateState');
      expect(code).toContain("'billing'");
      expect(code).toContain('Overview panel');
      expect(code).toContain('Billing panel');
      expect(code).not.toContain('content":"Overview panel');
      expect(code).not.toContain("content':'Overview panel");
      expect(code).not.toContain('active":true');
      expect(code).not.toContain("active':true");
    }
  });

  it('lowers Tabs child panel subtrees onto each target panel surface', () => {
    expect(react.code).toContain('Visible child panel');
    expect(vue.code).toContain('Visible child panel');
    expect(react.code).toMatch(/panel: \(\s*<Stack[\s\S]*id="tabs-panel-copy"/);
    expect(vue.code).toContain('<template #panel="{ item }">');
    expect(vue.code).toContain("item.id === 'child-panel'");
    expect(vue.code).toMatch(/item\.id === 'child-panel'[\s\S]*id="tabs-panel-copy"/);
    expect(reactSemanticErrors(react.code)).toEqual([]);
  });

  it('preserves normalized Card body and active state when deriving Tabs items', () => {
    for (const code of [react.code, vue.code]) {
      expect(code).toContain('defaultSelectedId="overview-card"');
    }
    expect(react.code).toContain('"id":"overview-card","label":"Overview","panel":"Body panel"');
    expect(vue.code).toContain("'id':'overview-card','label':'Overview','panel':'Body panel'");
    expect(react.code).not.toContain('"active":true');
    expect(vue.code).not.toContain("'active':true");

    expect(reactSemanticErrors(react.code)).toEqual([]);
    const parsed = vueCompiler.parse(vue.code, { filename: 'NormalizedTabs.vue' });
    expect(parsed.errors).toEqual([]);
    expect(() => vueCompiler.compileScript(parsed.descriptor, {
      id: 'normalized-tabs',
    })).not.toThrow();
    const template = vueCompiler.compileTemplate({
      id: 'normalized-tabs',
      filename: 'NormalizedTabs.vue',
      source: parsed.descriptor.template?.content ?? '',
    });
    expect(template.errors).toEqual([]);
  });

  it('keeps explicit Tabs items and removes mixed child panels', () => {
    for (const code of [react.code, vue.code]) {
      expect(code).toContain('explicit-item');
      expect(code).toContain('Explicit panel');
      expect(code).not.toContain('dead-mixed-panel');
      expect(code).not.toContain('must not emit beside explicit items');
    }
  });

  it('uses the normalized fallback id for an active legacy Tabs item', () => {
    expect(react.code).toContain('defaultSelectedId="fallback-active-tabs-tab-1"');
    expect(vue.code).toContain('defaultSelectedId="fallback-active-tabs-tab-1"');
  });

  it('binds Badge and Button fields through their supported content prop', () => {
    for (const code of [react.code, vue.code]) {
      expect(code).not.toContain('label={actionLabel}');
      expect(code).not.toContain(':label="actionLabel"');
    }
    expect(react.code).toMatch(/<Badge[^>]*content=\{actionLabel\}/);
    expect(react.code).toMatch(/<Button[^>]*content=\{actionLabel\}/);
    expect(vue.code).toMatch(/<Badge[^>]*:content="actionLabel"/);
    expect(vue.code).toMatch(/<Button[^>]*:content="actionLabel"/);
    expect(reactSemanticErrors(react.code)).toEqual([]);
  });

  it('keeps normalized static Badge and Button content ahead of field binding', () => {
    for (const code of [react.code, vue.code]) {
      expect(code).toMatch(/<Badge[^>]*id="static-bound-badge"[^>]*content="Static badge content"/);
      expect(code).toMatch(/<Button[^>]*id="static-bound-button"[^>]*content="Static button content"/);
    }
  });

  it('keeps Vue source imports and imports metadata in lockstep', () => {
    const sourceImports = vue.code
      .split('\n')
      .flatMap((line) => line.match(/^import(?: .* from)? ['"]([^'"]+)['"];$/)?.[1] ?? []);
    expect(vue.imports).toEqual(sourceImports);
  });

  it('escapes React scalar props, ids, styles, and comments as source data', () => {
    expect(unsafeReact.code).toContain('id="button&quot; onClick={evil}"');
    expect(unsafeReact.code).toContain(
      'content="x&quot; onClick={evil} &amp;quot; &lt;unsafe&gt;"',
    );
    expect(unsafeReact.code).toContain(
      'data-layout-node-id="section&quot; data-owned={evil}"',
    );
    expect(unsafeReact.code).not.toContain('id="button" onClick={evil}');
    expect(unsafeReact.code).not.toContain('content="x" onClick={evil}');
    expect(unsafeReact.code.match(/\*\//g)).toHaveLength(1);
    expect(reactSemanticErrors(unsafeReact.code)).toEqual([]);
  });

  it('escapes Vue scalar/object props, ids, styles, and style blocks as source data', () => {
    expect(unsafeVue.code).toContain('id="button&quot; onClick={evil}"');
    expect(unsafeVue.code).toContain(
      'content="x&quot; onClick={evil} &amp;quot; &lt;unsafe&gt;"',
    );
    expect(unsafeVue.code).toContain("\\'s");
    expect(unsafeVue.code).toContain('\\x26quot;');
    expect(unsafeVue.code).not.toContain('</style><script>evil()');

    const parsed = vueCompiler.parse(unsafeVue.code, { filename: 'UnsafeGeneratedUI.vue' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.descriptor.template).toBeTruthy();
    expect(() => vueCompiler.compileScript(parsed.descriptor, {
      id: 's182-emission-safety',
    })).not.toThrow();

    const template = vueCompiler.compileTemplate({
      id: 's182-emission-safety',
      filename: 'UnsafeGeneratedUI.vue',
      source: parsed.descriptor.template.content,
    });
    expect(template.errors).toEqual([]);
    for (const style of parsed.descriptor.styles) {
      const compiledStyle = vueCompiler.compileStyle({
        id: 's182-emission-safety',
        filename: 'UnsafeGeneratedUI.vue',
        source: style.content,
      });
      expect(compiledStyle.errors).toEqual([]);
    }
  });

  it('binds HTML Badge/Button fields without leaking schema metadata', () => {
    const html = htmlEmit(schema, defaultOpts);
    // s222-m02 (#2502 ruling 11): HTML writes React's Badge markup, the label in its own span, with the tone it resolved.
    expect(html.code).toContain(
      'data-oods-component="Badge" data-oods-node-id="bound-badge" data-tone="neutral" data-emphasis="subtle"><span class="oods-badge__label">Action label</span></span>',
    );
    expect(html.code).toContain(
      'data-oods-component="Button" data-oods-node-id="bound-button">Action label</button>',
    );
  });

  it('preserves Text and Input field bindings inside section wrappers', () => {
    expect(sectionReact.code).toMatch(/<Text[^>]*>\{heading\}<\/Text>/);
    expect(sectionReact.code).toMatch(/<Input[^>]*value=\{email\}[^>]*\/>/);
    expect(sectionVue.code).toMatch(/<Text[^>]*>{{ heading }}<\/Text>/);
    expect(sectionVue.code).toMatch(/<Input[^>]*v-model="email"[^>]*\/>/);
    expect(reactSemanticErrors(sectionReact.code)).toEqual([]);

    const parsed = vueCompiler.parse(sectionVue.code, { filename: 'SectionBindings.vue' });
    expect(parsed.errors).toEqual([]);
    const template = vueCompiler.compileTemplate({
      id: 's182-section-bindings',
      filename: 'SectionBindings.vue',
      source: parsed.descriptor.template.content,
    });
    expect(template.errors).toEqual([]);
  });

  it('binds DatePicker, Textarea, and Checkbox through target-supported values', () => {
    expect(nucleusReact.code).toMatch(/<DatePicker[^>]*id="bound-date"[^>]*value=\{birthday\}/);
    expect(nucleusReact.code).toMatch(/<Textarea[^>]*id="bound-notes"[^>]*value=\{notes\}/);
    expect(nucleusReact.code).toMatch(/<Checkbox[^>]*id="bound-checkbox"[^>]*checked=\{accepted\}/);
    expect(nucleusVue.code).toMatch(/<DatePicker[^>]*id="bound-date"[^>]*v-model="birthday"/);
    expect(nucleusVue.code).toMatch(/<Textarea[^>]*id="bound-notes"[^>]*v-model="notes"/);
    expect(nucleusVue.code).toMatch(/<Checkbox[^>]*id="bound-checkbox"[^>]*v-model="accepted"/);
    expect(reactSemanticErrors(nucleusReact.code)).toEqual([]);
  });

  it('keeps explicit controlled values and drops undeclared field directives', () => {
    const explicitReactDate = nucleusReact.code.match(/<DatePicker[^>]*id="explicit-date"[^>]*\/>/)?.[0];
    const explicitVueDate = nucleusVue.code.match(/<DatePicker[^>]*id="explicit-date"[^>]*\/>/)?.[0];
    const explicitReactCheckbox = nucleusReact.code.match(/<Checkbox[^>]*id="explicit-checkbox"[^>]*\/>/)?.[0];
    const explicitVueCheckbox = nucleusVue.code.match(/<Checkbox[^>]*id="explicit-checkbox"[^>]*\/>/)?.[0];
    const missingVue = nucleusVue.code.match(/<Input[^>]*id="missing-field"[^>]*\/>/)?.[0];

    expect(explicitReactDate).toContain('value="2026-09-03"');
    expect(explicitReactDate).not.toContain('value={birthday}');
    expect(explicitVueDate).toContain('value="2026-09-03"');
    expect(explicitVueDate).not.toContain('v-model=');
    expect(explicitReactCheckbox).toContain('checked={false}');
    expect(explicitReactCheckbox).not.toContain('checked={accepted}');
    expect(explicitVueCheckbox).toContain(':checked="false"');
    expect(explicitVueCheckbox).not.toContain('v-model=');
    expect(missingVue).not.toContain('v-model=');
    expect(missingVue).not.toContain('field=');
  });

  it('serializes hostile Tailwind variant values without breaking either compiler', () => {
    expect(hostileVariantReact.code).toContain('danger\\nx\\x22');
    expect(hostileVariantVue.code).toContain('danger\\nx\\x22');
    expect(hostileVariantVue.code).not.toContain('</script><script>globalThis.pwned=true');
    expect(hostileVariantReact.code).toContain('x\\x22] @click=\\x22globalThis.pwned=true \\x3c/script\\x3e');
    expect(hostileVariantVue.code).toContain('x\\x22] @click=\\x22globalThis.pwned=true \\x3c/script\\x3e');
    expect(hostileVariantVue.code).not.toContain('@click="globalThis.pwned=true');
    expect(reactSyntacticErrors(hostileVariantReact.code)).toEqual([]);

    const parsed = vueCompiler.parse(hostileVariantVue.code, { filename: 'HostileVariant.vue' });
    expect(parsed.errors).toEqual([]);
    expect(() => vueCompiler.compileScript(parsed.descriptor, {
      id: 's182-hostile-variant',
    })).not.toThrow();
    const template = vueCompiler.compileTemplate({
      id: 's182-hostile-variant',
      filename: 'HostileVariant.vue',
      source: parsed.descriptor.template!.content,
    });
    expect(template.errors).toEqual([]);
  });

  it('resolves the declared cva dependency for supported activated variants', () => {
    for (const result of [supportedVariantReact, supportedVariantVue]) {
      expect(result.imports).toContain('class-variance-authority');
      expect(result.code).toContain("import { cva } from 'class-variance-authority';");
    }
    expect(reactSemanticErrors(supportedVariantReact.code)).toEqual([]);

    const parsed = vueCompiler.parse(supportedVariantVue.code, { filename: 'SupportedVariants.vue' });
    expect(parsed.errors).toEqual([]);
    expect(() => vueCompiler.compileScript(parsed.descriptor, {
      id: 's182-supported-variants',
    })).not.toThrow();
    const template = vueCompiler.compileTemplate({
      id: 's182-supported-variants',
      filename: 'SupportedVariants.vue',
      source: parsed.descriptor.template!.content,
    });
    expect(template.errors).toEqual([]);
  });

  it('emits compiler-safe Vue object props containing apostrophes', () => {
    const parsed = vueCompiler.parse(vue.code, { filename: 'GeneratedUI.vue' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.descriptor.template).toBeTruthy();
    expect(() => vueCompiler.compileScript(parsed.descriptor, {
      id: 's182-normalization-regression',
    })).not.toThrow();

    const compiled = vueCompiler.compileTemplate({
      id: 's182-normalization-regression',
      filename: 'GeneratedUI.vue',
      source: parsed.descriptor.template.content,
    });
    expect(compiled.errors).toEqual([]);
  });

  it('turns legacy Card body content into a visible child', () => {
    expect(react.code).toMatch(/<Card[^>]*>Visible card body<\/Card>/);
    expect(vue.code).toMatch(/<Card[^>]*>Visible card body<\/Card>/);
    expect(react.code).not.toContain('body="Visible card body"');
    expect(vue.code).not.toContain('body="Visible card body"');
  });

  it('uses idiomatic Vue update events for fields and Tabs', () => {
    expect(vue.code).toContain('@update:modelValue="handleInputUpdate"');
    expect(vue.code).toContain('@update:selectedId="handleTabUpdate"');
    expect(vue.code).not.toContain('@update="');
  });
});
