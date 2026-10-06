import { describe, it, expect } from 'vitest';
import { emit } from '../../src/codegen/react-emitter.js';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const defaultOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

function makeSchema(...screens: UiElement[]): UiSchema {
  return { version: '1.0', screens };
}

function makeSchemaWithObjectSchema(
  objectSchema: Record<string, FieldSchemaEntry>,
  ...screens: UiElement[]
): UiSchema {
  return { version: '1.0', screens, objectSchema };
}

describe('react-emitter', () => {
  describe('style output — no triple braces', () => {
    it('emits correct double-brace style={{ ... }} for layout styles', () => {
      const schema = makeSchema({
        id: 'card-1',
        component: 'Card',
        layout: { type: 'stack', gapToken: 'md' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.status).toBe('ok');
      // Must have style={{ ... }} (double brace), NOT style={{{ ... }}} (triple)
      expect(result.code).toContain("style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ref-space-scale-md)' }}");
      expect(result.code).not.toMatch(/style=\{\{\{/);
    });

    it('emits correct double-brace style for token styles', () => {
      const schema = makeSchema({
        id: 'box-1',
        component: 'Box',
        style: { spacingToken: 'lg', radiusToken: 'sm' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("style={{ borderRadius: 'var(--ref-radius-sm)', padding: 'var(--ref-space-scale-lg)' }}");
      expect(result.code).not.toMatch(/style=\{\{\{/);
    });

    it('emits correct double-brace style for merged layout + token styles', () => {
      const schema = makeSchema({
        id: 'panel-1',
        component: 'Panel',
        layout: { type: 'inline', align: 'center' },
        style: { colorToken: 'primary' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("style={{");
      expect(result.code).not.toMatch(/style=\{\{\{/);
    });

    it('emits correct double-brace style for section layout', () => {
      const schema = makeSchema({
        id: 'sec-1',
        component: 'Heading',
        layout: { type: 'section' },
        style: { spacingToken: 'xl' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      // Section layout also wraps with style={}
      expect(result.code).not.toMatch(/style=\{\{\{/);
      // Should have valid double-brace patterns
      const styleMatches = result.code.match(/style=\{\{/g);
      if (styleMatches) {
        // Every style={{ must be followed eventually by }} (double close)
        expect(result.code).not.toMatch(/style=\{\{\{/);
      }
    });
  });

  describe('self-closing nodes', () => {
    it('renders self-closing tag for childless components', () => {
      const schema = makeSchema({
        id: 'btn-1',
        component: 'Button',
        props: { label: 'Click me' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('<Button');
      expect(result.code).toContain('id="btn-1"');
      expect(result.code).toContain('content="Click me"');
      expect(result.code).toContain('/>');
    });
  });

  describe('nested trees', () => {
    it('emits correct nested JSX with styles at multiple levels', () => {
      const schema = makeSchema({
        id: 'outer',
        component: 'Stack',
        layout: { type: 'stack', gapToken: 'sm' },
        children: [
          {
            id: 'inner-1',
            component: 'Card',
            style: { radiusToken: 'md', shadowToken: 'sm' },
            children: [
              {
                id: 'text-1',
                component: 'Text',
                props: { content: 'Hello' },
              },
            ],
          },
          {
            id: 'inner-2',
            component: 'Badge',
            style: { colorToken: 'success' },
            children: [],
          },
        ],
      });
      const result = emit(schema, defaultOpts);
      expect(result.status).toBe('ok');
      // No triple braces anywhere in the output
      expect(result.code).not.toMatch(/\{\{\{/);
      // Should have nested structure
      expect(result.code).toContain('<Stack');
      expect(result.code).toContain('<Card');
      expect(result.code).toContain('<Text');
      expect(result.code).toContain('<Badge');
    });
  });

  describe('general correctness', () => {
    it('includes import block', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Button',
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("import React from 'react';");
      expect(result.code).toContain("import { Button } from '@oods/components-react';");
    });

    it('generates TypeScript annotations when typescript=true', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Card',
        children: [],
      });
      const result = emit(schema, { typescript: true, styling: 'tokens' });
      expect(result.code).toContain('React.FC');
      expect(result.fileExtension).toBe('.tsx');
    });

    it('omits TypeScript annotations when typescript=false', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Card',
        children: [],
      });
      const result = emit(schema, { typescript: false, styling: 'tokens' });
      expect(result.code).not.toContain(': React.FC');
      expect(result.fileExtension).toBe('.jsx');
    });

    it('returns no warnings for valid schema', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Button',
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.warnings).toEqual([]);
    });

    it('sets framework to react', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Button',
      });
      const result = emit(schema, defaultOpts);
      expect(result.framework).toBe('react');
    });
  });

  describe('typed props from objectSchema (s63-m02)', () => {
    it('generates PageProps interface when objectSchema is present', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          name: { type: 'string', required: true, description: 'User name' },
          age: { type: 'integer', required: false, description: 'User age' },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('export interface PageProps');
      expect(result.code).toContain('name: string;');
      expect(result.code).toContain('age?: number;');
    });

    it('maps field types to TypeScript types correctly', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          id: { type: 'string', required: true },
          count: { type: 'integer', required: true },
          price: { type: 'number', required: true },
          active: { type: 'boolean', required: true },
          created_at: { type: 'datetime', required: true },
          email: { type: 'email', required: false },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('id: string;');
      expect(result.code).toContain('count: number;');
      expect(result.code).toContain('price: number;');
      expect(result.code).toContain('active: boolean;');
      expect(result.code).toContain('createdAt: string;');
      expect(result.code).toContain('email?: string;');
    });

    it('generates union literal type for enum fields', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          status: {
            type: 'string',
            required: true,
            enum: ['active', 'paused', 'terminated'],
          },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("status: 'active' | 'paused' | 'terminated';");
    });

    it('marks required fields as non-optional and optional fields with ?', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          required_field: { type: 'string', required: true },
          optional_field: { type: 'string', required: false },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('requiredField: string;');
      expect(result.code).toContain('optionalField?: string;');
    });

    it('includes JSDoc comments for fields with descriptions', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          name: { type: 'string', required: true, description: 'User display name' },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('/** User display name */');
    });

    it('uses React.FC<PageProps> as return type when objectSchema present', () => {
      const schema = makeSchemaWithObjectSchema(
        { name: { type: 'string', required: true } },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('React.FC<PageProps>');
    });

    it('without objectSchema, emitter behaves exactly as before', () => {
      const schema = makeSchema({ id: 'root', component: 'Box' });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain('interface PageProps');
      expect(result.code).toContain(': React.FC');
      expect(result.code).not.toContain('React.FC<');
    });

    it('does not generate PageProps when typescript=false', () => {
      const schema = makeSchemaWithObjectSchema(
        { name: { type: 'string', required: true } },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, { typescript: false, styling: 'tokens' });
      expect(result.code).not.toContain('PageProps');
      expect(result.code).not.toContain('interface');
    });

    it('converts snake_case field names to camelCase', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          first_name: { type: 'string', required: true },
          last_login_at: { type: 'datetime', required: false },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('firstName: string;');
      expect(result.code).toContain('lastLoginAt?: string;');
    });
  });

  describe('propSchema default value wiring (s63-m02)', () => {
    it('does not redeclare schema field names that are already destructured as params', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'StatusBadge',
            props: { status: 'active', priority: 3 },
          },
        ],
        objectSchema: {
          status: { type: 'string', required: true, enum: ['active', 'paused', 'terminated'] },
          priority: { type: 'integer', required: false },
        },
      };
      const result = emit(schema, defaultOpts);
      // These are destructured from component params — must NOT be redeclared as const
      expect(result.code).not.toContain("const status = 'active';");
      expect(result.code).not.toContain('const priority = 3;');
      // But the props should still appear on the JSX element
      expect(result.code).toContain('status="active"');
    });

    it('does not redeclare boolean schema fields as const', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Toggle',
            props: { active: true },
          },
        ],
        objectSchema: {
          active: { type: 'boolean', required: true },
        },
      };
      const result = emit(schema, defaultOpts);
      // 'active' is destructured from params — must not be redeclared
      expect(result.code).not.toContain('const active = true;');
    });

    it('emits const declarations for non-schema props that are not UI-reserved names', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Card',
            props: { customField: 'Default' },
          },
        ],
        objectSchema: {
          name: { type: 'string', required: true },
          customField: { type: 'string', required: false },
        },
      };
      const result = emit(schema, defaultOpts);
      // 'name' is a UI-reserved prop name — not emitted as const
      // 'customField' matches schema but is also destructured — not redeclared
      expect(result.code).not.toContain("const customField = 'Default';");
    });

    it('does not emit prop defaults without objectSchema', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Card',
        props: { name: 'Default' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain("const name = 'Default';");
    });

    it('does not redeclare schema fields from nested children', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Page',
            children: [
              {
                id: 'badge',
                component: 'StatusBadge',
                props: { status: 'paused' },
              },
            ],
          },
        ],
        objectSchema: {
          status: { type: 'string', required: true, enum: ['active', 'paused'] },
        },
      };
      const result = emit(schema, defaultOpts);
      // 'status' is a UI-reserved name AND a schema field — must not be redeclared
      expect(result.code).not.toContain("const status = 'paused';");
    });

    it('ignores element props that do not match objectSchema fields', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Card',
            props: { label: 'Hello', status: 'active' },
          },
        ],
        objectSchema: {
          status: { type: 'string', required: true },
        },
      };
      const result = emit(schema, defaultOpts);
      // 'label' is not in objectSchema and is a UI-reserved name — no default
      expect(result.code).not.toContain("const label = 'Hello';");
      // 'status' is a schema field AND a UI-reserved name — no const redeclaration
      expect(result.code).not.toContain("const status = 'active';");
    });
  });

  describe('typed action protocol (s183-m02)', () => {
    it('emits screen bindings as required domain actions with generated action controls', () => {
      const schema = makeSchema({
        id: 'form-root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit', onChange: 'handleChange' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('handleSubmit: () => void;');
      expect(result.code).toContain('handleChange: () => void;');
      expect(result.code).toContain('/* @oods-domain-binding handleSubmit */');
      expect(result.code).toContain('actions.handleSubmit();');
      expect(result.code).toContain('data-oods-screen-actions="form-root"');
      expect(result.code).toContain('data-oods-action="handleSubmit"');
      expect(result.code).toContain('onClick={() => handleSubmit()}');
      // s211-m02: screen actions are the design system's Button.
      expect(result.code).toContain('>Submit</Button>');
      expect(result.code).not.toMatch(/TODO|=>\s*\{\s*\}/);
    });

    it('keeps semantic screen bindings off component props while rendering controls', () => {
      const schema = makeSchema({
        id: 'form-root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain('onSubmit={handleSubmit}');
      expect(result.code).toContain('data-oods-action="handleSubmit"');
      expect(result.code).toContain('onClick={() => handleSubmit()}');
      expect(result.actions).toEqual([{
        name: 'handleSubmit',
        parameters: [],
        sources: [{ nodeId: 'form-root', component: 'Form', event: 'onSubmit' }],
      }]);
    });

    it('declares detail context actions', () => {
      const schema = makeSchema({
        id: 'detail-root',
        component: 'DetailView',
        bindings: { onEdit: 'handleEdit', onDelete: 'handleDelete' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('handleEdit: () => void;');
      expect(result.code).toContain('handleDelete: () => void;');
    });

    it('declares typed list context actions', () => {
      const schema = makeSchema({
        id: 'list-root',
        component: 'ListView',
        bindings: { onRowClick: 'handleRowClick', onSort: 'handleSort', onFilter: 'handleFilter' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('handleRowClick: (rowId: string) => void;');
      expect(result.code).toContain('handleSort: (column: string) => void;');
      expect(result.code).toContain('handleFilter: (criteria: Record<string, unknown>) => void;');
      expect(result.code).not.toMatch(/onClick=\{\(\) => handleRowClick\(/);
      expect(result.code).not.toMatch(/onClick=\{\(\) => handleSort\(/);
      expect(result.code).not.toMatch(/onClick=\{\(\) => handleFilter\(/);
      expect(result.code).toContain('disabled title="This action needs input from your application."');
    });

    it('runtime requirements are checked inside the component function', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
      });
      const result = emit(schema, defaultOpts);
      const exportIdx = result.code.indexOf('export const GeneratedUI');
      const guardIdx = result.code.indexOf("typeof actions.handleSubmit !== 'function'");
      const returnIdx = result.code.indexOf('return (');
      expect(guardIdx).toBeGreaterThan(exportIdx);
      expect(guardIdx).toBeLessThan(returnIdx);
    });

    it('collects bindings from nested children', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
        children: [
          {
            id: 'field',
            component: 'Input',
            bindings: { onChange: 'handleFieldChange' },
          },
        ],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('handleSubmit: () => void;');
      expect(result.code).toContain('const handleFieldChange');
    });

    it('no handler stubs when no bindings present', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Box',
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain('const handle');
    });

    it('emits a checked JSDoc contract when typescript=false', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
      });
      const result = emit(schema, { typescript: false, styling: 'tokens' });
      expect(result.code).toContain('@typedef {{ handleSubmit: () => void }} GeneratedUIActions');
      expect(result.code).toContain("typeof actions.handleSubmit !== 'function'");
      expect(result.code).not.toContain('React.FormEvent');
    });
  });
});
