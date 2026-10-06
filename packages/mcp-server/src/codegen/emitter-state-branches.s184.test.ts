import { describe, expect, it } from 'vitest';
import { transformSync } from 'esbuild';

import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { CodegenOptions } from './types.js';
import { emit as emitReact } from './react-emitter.js';
import { preflightCodegenSyntax } from './syntax-preflight.js';
import { emit as emitVue } from './vue-emitter.js';

type Framework = 'react' | 'vue';

const emitters = {
  react: emitReact,
  vue: emitVue,
} satisfies Record<Framework, typeof emitReact>;

function emit(
  framework: Framework,
  schema: UiSchema,
  typescript: boolean,
): string {
  const options: CodegenOptions = { styling: 'tokens', typescript };
  return emitters[framework](schema, options).code;
}

function schema(...screens: UiElement[]): UiSchema {
  return { version: '1.0', screens };
}

function occurrences(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

describe('Sprint 184 state-branch emitter protocol', () => {
  it.each(['react', 'vue'] as const)(
    '%s keeps no-state output free of the state protocol',
    (framework) => {
      const source = emit(framework, schema({ id: 'root', component: 'Box' }), true);

      expect(source).not.toContain('GeneratedUIState');
      expect(source).not.toContain('uiState');
      expect(source).not.toContain('data-oods-state');
    },
  );

  it.each([
    {
      framework: 'react',
      typescript: true,
      expected: [
        "export type GeneratedUIState = 'loading';",
        'export interface GeneratedUIProps {\n  uiState: GeneratedUIState;\n}',
        'React.FC<GeneratedUIProps> = ({ uiState })',
      ],
    },
    {
      framework: 'react',
      typescript: false,
      expected: [
        "/** @typedef {'loading'} GeneratedUIState */",
        '/** @typedef {{ uiState: GeneratedUIState }} GeneratedUIProps */',
        'const { uiState } = props;',
      ],
    },
    {
      framework: 'vue',
      typescript: true,
      expected: [
        "type GeneratedUIState = 'loading';",
        'const { uiState } = defineProps<{',
        'uiState: GeneratedUIState;',
      ],
    },
    {
      framework: 'vue',
      typescript: false,
      expected: [
        "/** @typedef {'loading'} GeneratedUIState */",
        'uiState: { type: String, required: true }',
        'const uiState = /** @type {GeneratedUIState} */ (generatedProps.uiState);',
      ],
    },
  ] as const)(
    '$framework typescript=$typescript emits a required public selector for state-only schemas',
    ({ framework, typescript, expected }) => {
      const source = emit(
        framework,
        schema({ id: 'loading', component: 'Stack', state: 'loading' }),
        typescript,
      );

      for (const fragment of expected) expect(source).toContain(fragment);
    },
  );

  it.each((['react', 'vue'] as const).flatMap((framework) => (
    [true, false].map((typescript) => ({ framework, typescript }))
  )))(
    '$framework typescript=$typescript composes uiState with object props',
    ({ framework, typescript }) => {
      const source = emit(framework, {
        version: '1.0',
        objectSchema: { title: { type: 'string', required: true } },
        screens: [{
          id: 'success-title',
          component: 'Text',
          state: 'success',
          props: { field: 'title' },
        }],
      }, typescript);

      expect(source).toContain(
        typescript ? "GeneratedUIState = 'success'" : "{'success'} GeneratedUIState",
      );
      expect(source).toContain('uiState');
      expect(source).toContain('title');
      if (typescript) {
        expect(source).toMatch(/uiState: GeneratedUIState;/);
      } else if (framework === 'react') {
        expect(source).toContain('const { uiState, title } = props;');
      } else {
        expect(source).toContain('uiState: { type: String, required: true }');
      }
    },
  );

  it.each((['react', 'vue'] as const).flatMap((framework) => (
    [true, false].map((typescript) => ({ framework, typescript }))
  )))(
    '$framework typescript=$typescript composes uiState with required actions',
    ({ framework, typescript }) => {
      const source = emit(framework, schema({
        id: 'error-form',
        component: 'Form',
        state: 'error',
        bindings: { onSubmit: 'handleSubmit' },
      }), typescript);

      expect(source).toContain(
        typescript ? "GeneratedUIState = 'error'" : "{'error'} GeneratedUIState",
      );
      expect(source).toContain('GeneratedUIActions');
      expect(source).toContain('actions');
      expect(source).toContain('uiState');
      expect(source).toContain("typeof actions.handleSubmit !== 'function'");
      if (!typescript && framework === 'vue') {
        expect(source).toContain('required: true');
      }
    },
  );

  it.each(['react', 'vue'] as const)(
    '%s emits one guard and marker per declaration while deduplicating the union in document order',
    (framework) => {
      const source = emit(framework, schema({
        id: 'root',
        component: 'Stack',
        children: [
          { id: 'loading-a', component: 'Text', state: 'loading', props: { children: 'A' } },
          { id: 'always', component: 'Text', props: { children: 'Always' } },
          { id: 'empty', component: 'Text', state: 'empty', props: { children: 'Empty' } },
          { id: 'loading-b', component: 'Text', state: 'loading', props: { children: 'B' } },
        ],
      }), true);

      expect(source).toContain("GeneratedUIState = 'loading' | 'empty';");
      expect(occurrences(source, /uiState === '(?:loading|empty)'/g)).toBe(3);
      expect(occurrences(source, /data-oods-state="(?:loading|empty)"/g)).toBe(3);
      expect(source).toContain('<Text id="always" data-oods-component="Text">Always</Text>');
    },
  );

  it('keeps the React state guard outside Banner local visibility behavior', () => {
    const source = emitReact(schema({
      id: 'notice',
      component: 'Banner',
      state: 'error',
      bindings: { onDismiss: 'handleDismiss' },
    }), { styling: 'tokens', typescript: true }).code;
    const stateGuard = source.indexOf("uiState === 'error'");
    const localGuard = source.indexOf('handleDismissState &&');
    const component = source.indexOf('<Banner');

    expect(stateGuard).toBeGreaterThan(-1);
    expect(localGuard).toBeGreaterThan(stateGuard);
    expect(component).toBeGreaterThan(localGuard);
    expect(source).not.toContain("uiState === 'error' && (\n        {");
  });

  it.each(['react', 'vue'] as const)(
    '%s preserves guards and markers through section and Tabs normalization',
    (framework) => {
      const sectionSource = emit(framework, schema({
        id: 'section-heading',
        component: 'Heading',
        state: 'success',
        layout: { type: 'section' },
        props: { children: 'Ready' },
      }), true);
      const tabsSource = emit(framework, schema({
        id: 'tabs',
        component: 'Tabs',
        children: [{
          id: 'loading-panel',
          component: 'Text',
          state: 'loading',
          props: { content: 'Loading account' },
        }],
      }), true);

      expect(sectionSource).toContain('data-layout-node-id="section-heading"');
      expect(sectionSource).toContain('data-oods-state="success"');
      expect(sectionSource).toContain("uiState === 'success'");
      expect(tabsSource).toContain('id="loading-panel"');
      expect(tabsSource).toContain('data-oods-state="loading"');
      expect(tabsSource).toContain("uiState === 'loading'");
      if (framework === 'react') {
        // Keeping guard text is insufficient: the rich panel must remain valid JSX inside its items object.
        expect(() => transformSync(sectionSource, { loader: 'tsx' })).not.toThrow();
        expect(() => transformSync(tabsSource, { loader: 'tsx' })).not.toThrow();
      }
    },
  );

  it.each([true, false])('keeps rich Tabs state and local dismiss guards parseable with typescript=%s', typescript => {
    for (const state of [undefined, 'error']) {
      const source = emitReact(schema({
        id: 'notices', component: 'Tabs', children: [{
          id: 'notice-panel', component: 'Banner', state,
          props: { children: 'Account needs attention' }, bindings: { onDismiss: 'handleDismiss' },
        }],
      }), { styling: 'tokens', typescript }).code;
      expect(source).toContain('handleDismissState &&');
      if (state) expect(source).toContain("uiState === 'error'");
      expect(() => transformSync(source, { loader: typescript ? 'tsx' : 'jsx' })).not.toThrow();
    }
  });

  it.each(['react', 'vue'] as const)(
    '%s reserves uiState only when the state protocol is present',
    (framework) => {
      const objectSchema = { ui_state: { type: 'string', required: true } } as const;
      const withoutState: UiSchema = {
        version: '1.0',
        objectSchema,
        screens: [{ id: 'plain', component: 'Text' }],
      };
      const withState: UiSchema = {
        ...withoutState,
        screens: [{ id: 'branch', component: 'Text', state: 'loading' }],
      };

      expect(preflightCodegenSyntax(withoutState, framework, 'tokens')).toEqual([]);
      expect(preflightCodegenSyntax(withState, framework, 'tokens')).toEqual([
        expect.objectContaining({
          code: 'OODS-V007',
          message: expect.stringContaining('generated identifier "uiState"'),
        }),
      ]);
    },
  );

  it.each(['react', 'vue'] as const)(
    '%s rejects a user-authored state marker only when the emitter owns it',
    (framework) => {
      const plain = schema({
        id: 'plain',
        component: 'Text',
        props: { 'data-oods-state': 'consumer-owned' },
      });
      const branch = schema({
        id: 'branch',
        component: 'Text',
        state: 'loading',
        props: { 'data-oods-state': 'consumer-owned' },
      });

      expect(preflightCodegenSyntax(plain, framework, 'tokens')).toEqual([]);
      expect(preflightCodegenSyntax(branch, framework, 'tokens')).toEqual([
        expect.objectContaining({
          code: 'OODS-V007',
          nodeId: 'branch',
          message: expect.stringContaining('emitter-owned attribute'),
        }),
      ]);
    },
  );
});
