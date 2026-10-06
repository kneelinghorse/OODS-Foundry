import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { canonicalize, sha256 } from '@oods/artifacts';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/code.generate.js';
import { FOUNDATION_V1_SHOWCASE_SCHEMA } from './foundation-fixture.s182.js';

const mcpServerRoot = fileURLToPath(new URL('../../', import.meta.url));
const vuePackageRoot = fileURLToPath(new URL('../../../components-vue/', import.meta.url));
const vueRequire = createRequire(path.join(vuePackageRoot, 'package.json'));
const frameworks = ['react', 'vue'] as const;
const stylings = ['inline', 'tailwind', 'tokens'] as const;
const typescriptOptions = [false, true] as const;
const requiredActionNames = [
  'handleActivate',
  'handleRowActivate',
  'handleSecondaryActivate',
] as const;
type RequiredActionName = typeof requiredActionNames[number];
const matrix = frameworks.flatMap((framework) => (
  stylings.flatMap((styling) => (
    typescriptOptions.map((typescript) => ({ framework, styling, typescript }))
  ))
));

function hash(value: string): string {
  return `sha256:${sha256(value)}`;
}

function rehash(artifact: GeneratedArtifact): GeneratedArtifact {
  for (const file of artifact.files) file.contentHash = hash(file.contents);
  const { contentHash: _oldHash, ...payload } = artifact;
  artifact.contentHash = hash(canonicalize(payload));
  return artifact;
}

function actionObjectSource(
  omittedAction?: RequiredActionName,
  typescript = true,
): string {
  return [
    omittedAction === 'handleActivate'
      ? null
      : '  handleActivate: () => undefined,',
    omittedAction === 'handleRowActivate'
      ? null
      : `  handleRowActivate: (rowId${typescript ? ': string' : ''}) => { void rowId; },`,
    omittedAction === 'handleSecondaryActivate'
      ? null
      : '  handleSecondaryActivate: () => undefined,',
  ].filter((line): line is string => line !== null).join('\n');
}

function reactConsumerErrors(
  code: string,
  typescript: boolean,
  supplyActions: boolean,
  omittedAction?: RequiredActionName,
): string[] {
  const root = mkdtempSync(path.join(mcpServerRoot, '.s183-react-actions-'));
  try {
    const generatedPath = path.join(root, typescript ? 'GeneratedUI.tsx' : 'GeneratedUI.jsx');
    const consumerPath = path.join(root, 'Consumer.tsx');
    writeFileSync(generatedPath, code);
    writeFileSync(consumerPath, `
import React from 'react';
import { GeneratedUI } from './GeneratedUI.js';

${supplyActions ? `
const actions = {
${actionObjectSource(omittedAction)}
};
export const Consumer = () => <GeneratedUI actions={actions} />;
` : 'export const Consumer = () => <GeneratedUI />;'}
`);
    const program = ts.createProgram([generatedPath, consumerPath], {
      allowJs: !typescript,
      checkJs: !typescript,
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
    rmSync(root, { recursive: true, force: true });
  }
}

async function vueConsumerResult(
  code: string,
  typescript: boolean,
  supplyActions: boolean,
  omittedAction?: RequiredActionName,
): Promise<{ status: number | null; output: string }> {
  const root = mkdtempSync(path.join(tmpdir(), 'oods-s183-vue-actions-'));
  try {
    mkdirSync(path.join(root, 'node_modules'));
    mkdirSync(path.join(root, 'node_modules', '@oods'));
    symlinkSync(
      path.dirname(vueRequire.resolve('vue/package.json')),
      path.join(root, 'node_modules', 'vue'),
      'junction',
    );
    symlinkSync(
      vuePackageRoot,
      path.join(root, 'node_modules', '@oods', 'components-vue'),
      'junction',
    );
    writeFileSync(path.join(root, 'GeneratedUI.vue'), code);
    writeFileSync(path.join(root, 'Consumer.vue'), `
<template><GeneratedUI${supplyActions ? ' :actions="actions"' : ''} /></template>
<script setup lang="ts">
import GeneratedUI from './GeneratedUI.vue';
${supplyActions ? `const actions = {
${actionObjectSource(omittedAction)}
};` : ''}
</script>
`);
    writeFileSync(path.join(root, 'tsconfig.json'), `${JSON.stringify({
      compilerOptions: {
        allowJs: !typescript,
        // Vue's package loader realpaths the workspace-linked component
        // package outside node_modules. Enabling project-wide checkJs would
        // diagnose that dependency's compiled JS instead of this generated
        // SFC; required props remain template-checked, while the separate SSR
        // proof below exercises every JavaScript action member at runtime.
        checkJs: false,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: 'ES2022',
      },
      include: ['./GeneratedUI.vue', './Consumer.vue'],
    }, null, 2)}\n`);
    const startedAt = performance.now();
    // Keep the worker event loop responsive while each real compiler runs.
    // Vitest's task-update RPC has its own 60s timer, independent of this test.
    const result = await new Promise<{
      status: number | null; signal: NodeJS.Signals | null; error: Error | null;
      stdout: string; stderr: string;
    }>((resolve) => {
      const child = spawn(
        process.execPath,
        [vueRequire.resolve('vue-tsc/bin/vue-tsc.js'), '--noEmit', '--pretty', 'false', '-p', path.join(root, 'tsconfig.json')],
        { cwd: mcpServerRoot, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
      );
      let stdout = '';
      let stderr = '';
      let error: Error | null = null;
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.on('error', (cause) => { error = cause; });
      child.on('close', (status, signal) => resolve({ status, signal, error, stdout, stderr }));
    });
    const measurement = {
      typescript, supplyActions, omittedAction: omittedAction ?? null,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      status: result.status, signal: result.signal,
      error: result.error ? {
        name: result.error.name, message: result.error.message,
        code: (result.error as NodeJS.ErrnoException).code,
      } : null,
    };
    console.info('[s183 vue-tsc action contract]', JSON.stringify(measurement));
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    if (result.error || result.status === null) {
      throw new Error(`vue-tsc did not finish: ${JSON.stringify(measurement)}\n${output}`);
    }
    return { status: result.status, output };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function vueJavaScriptRuntimeOmissionResults(
  code: string,
): Array<{ omittedAction: RequiredActionName; status: number | null; output: string }> {
  const root = mkdtempSync(path.join(mcpServerRoot, '.s183-vue-runtime-actions-'));
  try {
    mkdirSync(path.join(root, 'node_modules', '@vue'), { recursive: true });
    mkdirSync(path.join(root, 'node_modules', '@oods'), { recursive: true });
    symlinkSync(
      path.dirname(vueRequire.resolve('vue/package.json')),
      path.join(root, 'node_modules', 'vue'),
      'junction',
    );
    symlinkSync(
      path.dirname(vueRequire.resolve('@vue/server-renderer/package.json')),
      path.join(root, 'node_modules', '@vue', 'server-renderer'),
      'junction',
    );
    symlinkSync(
      path.resolve(mcpServerRoot, '../components-vue'),
      path.join(root, 'node_modules', '@oods', 'components-vue'),
      'junction',
    );
    symlinkSync(
      path.resolve(mcpServerRoot, '../component-styles'),
      path.join(root, 'node_modules', '@oods', 'component-styles'),
      'junction',
    );
    writeFileSync(path.join(root, 'GeneratedUI.vue'), code);
    writeFileSync(path.join(root, 'entry.mjs'), `
import { renderToString } from '@vue/server-renderer';
import { createSSRApp } from 'vue';
import GeneratedUI from './GeneratedUI.vue';

const actions = {
${actionObjectSource(undefined, false)}
};
const omittedAction = process.env.OODS_OMITTED_ACTION;
if (omittedAction) delete actions[omittedAction];

try {
  await renderToString(createSSRApp(GeneratedUI, { actions }));
  if (omittedAction) {
    process.stderr.write('GeneratedUI rendered despite a missing action.');
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exitCode = omittedAction ? 1 : 3;
}
`);
    const vuePluginUrl = pathToFileURL(vueRequire.resolve('@vitejs/plugin-vue')).href;
    const vueServerRendererEntry = vueRequire.resolve('@vue/server-renderer');
    writeFileSync(path.join(root, 'vite.config.mjs'), `
import vue from ${JSON.stringify(vuePluginUrl)};

export default {
  plugins: [vue()],
  resolve: {
    alias: { '@vue/server-renderer': ${JSON.stringify(vueServerRendererEntry)} },
  },
  build: {
    ssr: './entry.mjs',
    target: 'esnext',
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'server.mjs' } },
  },
};
`);

    const vitePackageRoot = path.dirname(vueRequire.resolve('vite/package.json'));
    const build = spawnSync(
      process.execPath,
      [path.join(vitePackageRoot, 'bin/vite.js'), 'build', '--config', path.join(root, 'vite.config.mjs')],
      { cwd: root, encoding: 'utf8', timeout: 120_000 },
    );
    if (build.status !== 0) {
      throw new Error(`Vue JavaScript runtime proof failed to build:\n${build.stdout}\n${build.stderr}`);
    }

    const bundle = path.join(root, 'dist/server.mjs');
    const complete = spawnSync(process.execPath, [bundle], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env },
      timeout: 120_000,
    });
    if (complete.status !== 0) {
      throw new Error(`Vue JavaScript complete action contract failed at runtime:\n${complete.stdout}\n${complete.stderr}`);
    }

    return requiredActionNames.map((omittedAction) => {
      const result = spawnSync(process.execPath, [bundle], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, OODS_OMITTED_ACTION: omittedAction },
        timeout: 120_000,
      });
      return {
        omittedAction,
        status: result.status,
        output: `${result.stdout}\n${result.stderr}`.trim(),
      };
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('Sprint 183 M02 typed action protocol', () => {
  it.each(matrix)(
    'closes every binding for $framework/$styling/typescript=$typescript',
    async ({ framework, styling, typescript }) => {
      const result = await handle({
        framework,
        schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
        options: { styling, typescript },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.code).not.toMatch(/TODO|=>\s*\{\s*\}/);
      expect(result.artifact!.actions).toEqual([
        {
          name: 'handleActivate',
          parameters: [],
          sources: [{ nodeId: 'showcase-action', component: 'Button', event: 'onActivate' }],
        },
        {
          name: 'handleRowActivate',
          parameters: [{ name: 'rowId', type: 'string' }],
          sources: [{ nodeId: 'showcase-subscriptions', component: 'Table', event: 'onRowActivate' }],
        },
        {
          name: 'handleSecondaryActivate',
          parameters: [],
          sources: [{ nodeId: 'showcase-secondary-action', component: 'Button', event: 'onActivate' }],
        },
      ]);
      expect(result.code.match(/@oods-local-binding/g)).toHaveLength(7);
      expect(result.code.match(/@oods-domain-binding/g)).toHaveLength(3);
      expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
    },
  );

  it.each(frameworks)('%s keeps screen actions typed but off the Stack API', async (framework) => {
    const result = await handle({
      framework,
      schema: {
        version: '1.0',
        screens: [{
          id: 'detail-root',
          component: 'Stack',
          bindings: { onEdit: 'handleEdit', onDelete: 'handleDelete' },
        }],
      },
    });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(result.artifact!.actions.map(({ name }) => name)).toEqual(['handleDelete', 'handleEdit']);
    expect(result.code).not.toMatch(/<Stack[^>]*(?:onEdit|onDelete|@edit|@delete)/);
    expect(result.code).toContain('handleEdit: () => void');
    expect(result.code).toContain('handleDelete: () => void');
  });

  it.each(frameworks)('%s rejects an empty local handler after a hash-consistent mutation', async (framework) => {
    const result = await handle({ framework, schema: FOUNDATION_V1_SHOWCASE_SCHEMA });
    const mutated = structuredClone(result.artifact!);
    mutated.files[0]!.contents = mutated.files[0]!.contents.replace(
      /(\/\* @oods-local-binding handleTabChange \*\/ const handleTabChange = .*?=> \{).*?(\};)/,
      '$1 $2',
    );
    rehash(mutated);

    expect(validateGeneratedArtifact(mutated)).toContain(
      "Generated local binding handler 'handleTabChange' must update its own state from its input or dismiss it.",
    );
  });

  it.each(frameworks)('%s rejects action metadata removed while its binding remains', async (framework) => {
    const result = await handle({ framework, schema: FOUNDATION_V1_SHOWCASE_SCHEMA });
    const mutated = structuredClone(result.artifact!);
    mutated.actions = mutated.actions.filter(({ name }) => name !== 'handleActivate');
    rehash(mutated);

    expect(validateGeneratedArtifact(mutated)).toContain(
      "Generated action marker 'handleActivate' is missing from artifact actions.",
    );
  });

  it.each(frameworks)('%s requires injected actions to be own properties at runtime', async (framework) => {
    const result = await handle({
      framework,
      schema: {
        version: '1.0',
        screens: [{
          id: 'action',
          component: 'Button',
          bindings: { onActivate: 'constructor' },
        }],
      },
      options: { styling: 'tokens', typescript: false },
    });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    const guard = result.code.split('\n').find((line) => (
      line.includes('GeneratedUI requires actions.constructor.')
    ));
    expect(guard).toBeDefined();
    const runGuard = Function('actions', guard!) as (actions: object) => void;
    expect(() => runGuard({})).toThrow('GeneratedUI requires actions.constructor.');
    expect(() => runGuard(Object.create({ constructor: () => undefined }))).toThrow(
      'GeneratedUI requires actions.constructor.',
    );
    expect(() => runGuard({ constructor: () => undefined })).not.toThrow();
  });

  it.each([
    ['onChange', '@change="changeEmail"'],
    ['onInput', '@input="inputEmail"'],
    ['onUpdate', '@update:modelValue="updateEmail"'],
  ] as const)('Vue preserves the declared %s timing while controlling local state', async (event, binding) => {
    const handlerName = binding.match(/="([^"]+)"$/)![1]!;
    const result = await handle({
      framework: 'vue',
      schema: {
        version: '1.0',
        screens: [{
          id: 'email',
          component: 'Input',
          bindings: { [event]: handlerName },
        }],
      },
      options: { styling: 'tokens', typescript: true },
    });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(result.code).toContain(`:modelValue="${handlerName}State"`);
    if (event !== 'onUpdate') {
      const setter = `set${handlerName[0]!.toUpperCase()}${handlerName.slice(1)}State`;
      expect(result.code).toContain(`@update:modelValue="${setter}"`);
    }
    expect(result.code).toContain(binding);
  });

  it('coerces numeric object fields before initializing string-semantic local state', async () => {
    const schema: UiSchema = {
      version: '1.0',
      objectSchema: {
        age: { type: 'integer', required: false },
      },
      screens: [{
        id: 'root',
        component: 'Stack',
        children: [{
          id: 'age',
          component: 'Input',
          props: { field: 'age', type: 'number' },
          bindings: { onChange: 'changeAge' },
        }],
      }],
    };
    const react = await handle({
      framework: 'react',
      schema,
      options: { styling: 'tokens', typescript: true },
    });
    const vue = await handle({
      framework: 'vue',
      schema,
      options: { styling: 'tokens', typescript: true },
    });

    expect(react.status, JSON.stringify(react.errors ?? [])).toBe('ok');
    expect(react.code).toContain("React.useState<string>(String(age ?? ''))");
    expect(reactConsumerErrors(react.code, true, false)).toEqual([]);
    expect(vue.status, JSON.stringify(vue.errors ?? [])).toBe('ok');
    expect(vue.code).toContain("ref<string>(String(age.value ?? ''))");
    expect(await vueConsumerResult(vue.code, true, false)).toEqual({ status: 0, output: '' });
  }, 120_000);

  it.each(typescriptOptions)('React typescript=$typescript requires every injected action', async (typescript) => {
    const result = await handle({
      framework: 'react',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
      options: { styling: 'tokens', typescript },
    });
    const missing = reactConsumerErrors(result.code, typescript, false);
    const complete = reactConsumerErrors(result.code, typescript, true);

    expect(missing.join('\n')).toContain('actions');
    expect(complete).toEqual([]);
  });

  it('React TypeScript rejects each individually omitted domain action', async () => {
    const result = await handle({
      framework: 'react',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
      options: { styling: 'tokens', typescript: true },
    });

    expect(reactConsumerErrors(result.code, true, true)).toEqual([]);
    for (const omittedAction of requiredActionNames) {
      const errors = reactConsumerErrors(result.code, true, true, omittedAction);
      expect(errors.join('\n'), omittedAction).toContain(omittedAction);
    }
  }, 120_000);

  it.each(typescriptOptions)('Vue typescript=$typescript requires every injected action', async (typescript) => {
    const result = await handle({
      framework: 'vue',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
      options: { styling: 'tokens', typescript },
    });
    const missing = await vueConsumerResult(result.code, typescript, false);
    const complete = await vueConsumerResult(result.code, typescript, true);

    expect(missing.status).not.toBe(0);
    expect(missing.output).toContain('actions');
    expect(complete.output).toBe('');
    expect(complete.status).toBe(0);
  }, 120_000);

  // The preceding complete-actions case proves the consumer compiles. Give
  // each omission its own deadline: the s186 capture spent 222.67s across the
  // grouped compilers, exceeding the shared 180s deadline despite valid results.
  // Each child remains capped at 120s, with time to report its own diagnostics.
  it.each(requiredActionNames)('Vue TypeScript rejects each individually omitted domain action: %s', async (omittedAction) => {
    const result = await handle({
      framework: 'vue',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
      options: { styling: 'tokens', typescript: true },
    });

    const missing = await vueConsumerResult(result.code, true, true, omittedAction);
    expect(missing.status, omittedAction).not.toBe(0);
    expect(missing.output, omittedAction).toContain(omittedAction);
  }, 150_000);

  it('Vue JavaScript rejects each omitted action at runtime', async () => {
    const result = await handle({
      framework: 'vue',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
      options: { styling: 'tokens', typescript: false },
    });

    expect(result.artifact!.actions.map(({ name }) => name)).toEqual(requiredActionNames);
    for (const runtime of vueJavaScriptRuntimeOmissionResults(result.code)) {
      expect(runtime.status, runtime.omittedAction).toBe(1);
      expect(runtime.output, runtime.omittedAction).toContain(
        `GeneratedUI requires actions.${runtime.omittedAction}.`,
      );
    }
  }, 120_000);
});
