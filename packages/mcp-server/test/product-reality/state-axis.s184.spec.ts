import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { UI_WORKFLOW_STATES } from '@oods/component-contracts';
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as generateCode } from '../../src/tools/code.generate.js';
import type { CodeGenerateOutput } from '../../src/tools/types.js';

type Framework = 'react' | 'vue';
type WorkflowState = typeof UI_WORKFLOW_STATES[number];
type SemanticSnapshot = {
  markersInDocumentOrder: string[];
  visibleText: string;
};
type ParityDifference = {
  state: WorkflowState;
  path: keyof SemanticSnapshot;
  react: string | string[];
  vue: string | string[];
};

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '../../../..');
const mcpServerRoot = path.join(repositoryRoot, 'packages/mcp-server');
const reactPackageRoot = path.join(repositoryRoot, 'packages/components-react');
const vuePackageRoot = path.join(repositoryRoot, 'packages/components-vue');
const componentStylesRoot = path.join(repositoryRoot, 'packages/component-styles');
const reactRequire = createRequire(path.join(reactPackageRoot, 'package.json'));
const vueRequire = createRequire(path.join(vuePackageRoot, 'package.json'));
const vitePackageRoot = path.dirname(vueRequire.resolve('vite/package.json'));
const viteBin = path.join(vitePackageRoot, 'bin/vite.js');

const FRAMEWORKS = ['react', 'vue'] as const satisfies readonly Framework[];
const STATE_COPY: Readonly<Record<WorkflowState, string>> = {
  loading: 'Loading subscriptions.',
  empty: 'No subscriptions found.',
  error: 'Subscriptions could not be loaded.',
  success: 'Subscriptions loaded.',
};
const STATE_TONES: Readonly<Record<WorkflowState, string>> = {
  loading: 'info',
  empty: 'neutral',
  error: 'critical',
  success: 'success',
};

/**
 * Deliberately empty at first adoption. A future entry must name its companion
 * test so a changed divergence cannot silently become permanent.
 */
const STATE_PARITY_DIFFERENCE_ALLOWLIST: ReadonlyArray<{
  path: string;
  react: unknown;
  vue: unknown;
  reason: string;
  testId: string;
}> = [];

function stateBranch(state: WorkflowState): UiSchema['screens'][number] {
  return {
    id: `${state}-subscriptions`,
    component: 'Banner',
    state,
    props: {
      content: STATE_COPY[state],
      tone: STATE_TONES[state],
    },
  };
}

function schemaFor(states: readonly WorkflowState[]): UiSchema {
  return {
    version: '1.0',
    screens: states.map(stateBranch) as UiSchema['screens'],
  };
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function link(source: string, destination: string): void {
  mkdirSync(path.dirname(destination), { recursive: true });
  symlinkSync(source, destination, 'junction');
}

function installRuntimeLinks(root: string, framework: Framework): void {
  if (framework === 'react') {
    for (const dependency of ['react', 'react-dom'] as const) {
      link(
        path.dirname(reactRequire.resolve(`${dependency}/package.json`)),
        path.join(root, 'node_modules', dependency),
      );
    }
    link(
      reactPackageRoot,
      path.join(root, 'node_modules/@oods/components-react'),
    );
  } else {
    link(
      path.dirname(vueRequire.resolve('vue/package.json')),
      path.join(root, 'node_modules/vue'),
    );
    link(
      path.dirname(vueRequire.resolve('@vue/server-renderer/package.json')),
      path.join(root, 'node_modules/@vue/server-renderer'),
    );
    link(
      vuePackageRoot,
      path.join(root, 'node_modules/@oods/components-vue'),
    );
  }
  link(componentStylesRoot, path.join(root, 'node_modules/@oods/component-styles'));
}

function sourceImports(
  framework: Framework,
  variants: readonly string[],
): { imports: string; registry: string } {
  const imports = variants.map((variant, index) => (
    framework === 'react'
      ? `import { GeneratedUI as GeneratedUI${index} } from './GeneratedUI-${variant}.tsx';`
      : `import GeneratedUI${index} from './GeneratedUI-${variant}.vue';`
  )).join('\n');
  const registry = variants
    .map((variant, index) => `${JSON.stringify(variant)}: GeneratedUI${index}`)
    .join(',\n  ');
  return { imports, registry };
}

function buildRuntimeBundle(
  framework: Framework,
  sources: Readonly<Record<string, string>>,
): { root: string; bundle: string } {
  const root = mkdtempSync(path.join(mcpServerRoot, `.s184-state-${framework}-`));
  installRuntimeLinks(root, framework);

  const variants = Object.keys(sources);
  const extension = framework === 'react' ? 'tsx' : 'vue';
  for (const [variant, source] of Object.entries(sources)) {
    writeFileSync(path.join(root, `GeneratedUI-${variant}.${extension}`), source);
  }

  const generated = sourceImports(framework, variants);
  const entryExtension = framework === 'react' ? 'tsx' : 'ts';
  const entry = framework === 'react'
    ? `${generated.imports}
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const variants = {
  ${generated.registry}
} as const;
const [variantName, uiState] = process.argv.slice(2);
const GeneratedUI = variants[variantName as keyof typeof variants];
if (!GeneratedUI || !uiState) throw new Error('variant and uiState are required');
process.stdout.write(renderToStaticMarkup(<GeneratedUI uiState={uiState as never} />));
`
    : `${generated.imports}
import { renderToString } from '@vue/server-renderer';
import { createSSRApp } from 'vue';

const variants = {
  ${generated.registry}
} as const;
const [variantName, uiState] = process.argv.slice(2);
const GeneratedUI = variants[variantName as keyof typeof variants];
if (!GeneratedUI || !uiState) throw new Error('variant and uiState are required');
process.stdout.write(await renderToString(createSSRApp(GeneratedUI, { uiState })));
`;
  writeFileSync(path.join(root, `entry.${entryExtension}`), entry);

  const pluginUrl = pathToFileURL(vueRequire.resolve(
    framework === 'react' ? '@vitejs/plugin-react' : '@vitejs/plugin-vue',
  )).href;
  const pluginName = framework === 'react' ? 'react' : 'vue';
  writeFileSync(path.join(root, 'vite.config.mjs'), `
import ${pluginName} from ${JSON.stringify(pluginUrl)};

export default {
  plugins: [${pluginName}()],
  build: {
    ssr: './entry.${entryExtension}',
    target: 'esnext',
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'server.mjs' } },
  },
};
`);

  const built = spawnSync(
    process.execPath,
    [viteBin, 'build', '--config', path.join(root, 'vite.config.mjs')],
    { cwd: root, encoding: 'utf8', timeout: 120_000 },
  );
  if (built.status !== 0) {
    rmSync(root, { recursive: true, force: true });
    throw new Error(
      `${framework} state runtime failed to build:\n${built.stdout}\n${built.stderr}`,
    );
  }
  return { root, bundle: path.join(root, 'dist/server.mjs') };
}

function renderVariant(
  bundle: string,
  variant: string,
  state: WorkflowState,
): SemanticSnapshot {
  const rendered = spawnSync(process.execPath, [bundle, variant, state], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (rendered.status !== 0) {
    throw new Error(`SSR failed for ${variant}/${state}:\n${rendered.stderr}`);
  }
  const document = new JSDOM(rendered.stdout).window.document;
  return {
    markersInDocumentOrder: [...document.querySelectorAll('[data-oods-state]')]
      .map((element) => element.getAttribute('data-oods-state') ?? ''),
    visibleText: (document.body.textContent ?? '').replace(/\s+/g, ' ').trim(),
  };
}

function guardNeedle(framework: Framework, state: WorkflowState): string {
  return framework === 'react'
    ? `uiState === '${state}'`
    : `uiState === '${state}'`;
}

function removeOneStateBranch(
  source: string,
  framework: Framework,
  state: WorkflowState,
): string {
  const needle = guardNeedle(framework, state);
  expect(source.split(needle)).toHaveLength(2);
  return source.replace(needle, 'false');
}

function parityDifferences(
  react: Readonly<Record<WorkflowState, SemanticSnapshot>>,
  vue: Readonly<Record<WorkflowState, SemanticSnapshot>>,
): ParityDifference[] {
  const differences: ParityDifference[] = [];
  for (const state of UI_WORKFLOW_STATES) {
    for (const pathName of ['markersInDocumentOrder', 'visibleText'] as const) {
      if (JSON.stringify(react[state][pathName]) !== JSON.stringify(vue[state][pathName])) {
        differences.push({
          state,
          path: pathName,
          react: react[state][pathName],
          vue: vue[state][pathName],
        });
      }
    }
  }
  return differences;
}

describe('Sprint 184 m05 workflow state axis', () => {
  const aggregateResults = new Map<Framework, CodeGenerateOutput>();
  const buildCells = new Map<string, CodeGenerateOutput>();
  const runtimeRoots: string[] = [];
  const runtimeBundles = new Map<Framework, string>();
  const baselineSnapshots = new Map<Framework, Record<WorkflowState, SemanticSnapshot>>();
  const mutantSnapshots = new Map<Framework, Record<WorkflowState, Record<WorkflowState, SemanticSnapshot>>>();

  beforeAll(async () => {
    for (const state of UI_WORKFLOW_STATES) {
      for (const framework of FRAMEWORKS) {
        buildCells.set(
          `${state}/${framework}`,
          await generateCode({ framework, profile: 'build', schema: schemaFor([state]) }),
        );
      }
    }

    for (const framework of FRAMEWORKS) {
      const generated = await generateCode({
        framework,
        profile: 'build',
        schema: schemaFor(UI_WORKFLOW_STATES),
      });
      aggregateResults.set(framework, generated);
      if (generated.status !== 'ok') {
        throw new Error(`${framework} aggregate generation failed: ${JSON.stringify(generated.errors)}`);
      }

      const sources: Record<string, string> = { baseline: generated.code };
      for (const state of UI_WORKFLOW_STATES) {
        sources[`mutant-${state}`] = removeOneStateBranch(generated.code, framework, state);
      }
      const runtime = buildRuntimeBundle(framework, sources);
      runtimeRoots.push(runtime.root);
      runtimeBundles.set(framework, runtime.bundle);

      const baseline = {} as Record<WorkflowState, SemanticSnapshot>;
      for (const state of UI_WORKFLOW_STATES) {
        baseline[state] = renderVariant(runtime.bundle, 'baseline', state);
      }
      baselineSnapshots.set(framework, baseline);

      const targetMutants = {} as Record<WorkflowState, Record<WorkflowState, SemanticSnapshot>>;
      for (const removedState of UI_WORKFLOW_STATES) {
        const snapshots = {} as Record<WorkflowState, SemanticSnapshot>;
        for (const renderedState of UI_WORKFLOW_STATES) {
          snapshots[renderedState] = renderVariant(
            runtime.bundle,
            `mutant-${removedState}`,
            renderedState,
          );
        }
        targetMutants[removedState] = snapshots;
      }
      mutantSnapshots.set(framework, targetMutants);
    }
  }, 180_000);

  afterAll(() => {
    for (const root of runtimeRoots) rmSync(root, { recursive: true, force: true });
  });

  it.each(UI_WORKFLOW_STATES.flatMap((state) => (
    FRAMEWORKS.map((framework) => ({ state, framework }))
  )))('$framework builds a non-empty $state artifact at build confidence', ({ state, framework }) => {
    const result = buildCells.get(`${state}/${framework}`)!;
    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(result.errors ?? []).toEqual([]);
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.artifact?.files[0]?.contents.length).toBeGreaterThan(0);
    expect(result.validationReceipt.checks).toContain('state-contract');
  });

  it.each(FRAMEWORKS)('%s emits exactly one ordered branch per declaration', (framework) => {
    const source = aggregateResults.get(framework)!.code;
    const guardStates = [...source.matchAll(/uiState === '([^']+)'/g)].map((match) => match[1]);
    const markerStates = [...source.matchAll(/data-oods-state="([^"]+)"/g)].map((match) => match[1]);

    expect(guardStates).toEqual(UI_WORKFLOW_STATES);
    expect(markerStates).toEqual(UI_WORKFLOW_STATES);
    expect(guardStates).toHaveLength(schemaFor(UI_WORKFLOW_STATES).screens.length);
  });

  it('computes zero cross-target marker or visible-text differences', () => {
    const react = baselineSnapshots.get('react')!;
    const vue = baselineSnapshots.get('vue')!;
    for (const state of UI_WORKFLOW_STATES) {
      expect(react[state]).toEqual({
        markersInDocumentOrder: [state],
        visibleText: STATE_COPY[state],
      });
      expect(vue[state]).toEqual({
        markersInDocumentOrder: [state],
        visibleText: STATE_COPY[state],
      });
    }

    const computedDifferences = parityDifferences(react, vue);
    expect(STATE_PARITY_DIFFERENCE_ALLOWLIST).toHaveLength(0);
    expect(computedDifferences).toEqual(STATE_PARITY_DIFFERENCE_ALLOWLIST);
    process.stdout.write(
      `\n[s184-m05] state parity differences=${computedDifferences.length}; `
      + `allowlist=${STATE_PARITY_DIFFERENCE_ALLOWLIST.length}\n`,
    );
    process.stdout.write(`[s184-m05:parity] ${JSON.stringify({
      states: UI_WORKFLOW_STATES,
      react,
      vue,
      computedDifferences,
      allowlist: STATE_PARITY_DIFFERENCE_ALLOWLIST,
    })}\n`);
  });

  it.each(FRAMEWORKS.flatMap((framework) => (
    UI_WORKFLOW_STATES.map((removedState) => ({ framework, removedState }))
  )))(
    '$framework/$removedState mutation reds exactly its selected target-state cell',
    ({ framework, removedState }) => {
      const failures: Array<{ framework: Framework; state: WorkflowState }> = [];
      for (const observedFramework of FRAMEWORKS) {
        for (const state of UI_WORKFLOW_STATES) {
          const actual = observedFramework === framework
            ? mutantSnapshots.get(framework)![removedState][state]
            : baselineSnapshots.get(observedFramework)![state];
          const expected = baselineSnapshots.get(observedFramework)![state];
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            failures.push({ framework: observedFramework, state });
          }
        }
      }

      expect(failures).toEqual([{ framework, state: removedState }]);
      expect(mutantSnapshots.get(framework)![removedState][removedState]).toEqual({
        markersInDocumentOrder: [],
        visibleText: '',
      });
      process.stdout.write(
        `[s184-m05:mutation] target=${framework} removed=${removedState} `
        + `red=${framework}/${removedState} green=7\n`,
      );
    }
  );

  it('restores the exact emitted bytes and all eight runtime cells after the mutation matrix', () => {
    for (const framework of FRAMEWORKS) {
      const source = aggregateResults.get(framework)!.code;
      expect(sha256(source)).toBe(sha256(aggregateResults.get(framework)!.artifact!.files[0]!.contents));
      const restored = {} as Record<WorkflowState, SemanticSnapshot>;
      for (const state of UI_WORKFLOW_STATES) {
        restored[state] = renderVariant(runtimeBundles.get(framework)!, 'baseline', state);
      }
      expect(restored).toEqual(baselineSnapshots.get(framework));
      process.stdout.write(
        `[s184-m05:restore] target=${framework} source=${sha256(source)} green=4\n`,
      );
    }
  });

  it.each(FRAMEWORKS)('%s preserves both measured red/inert controls', async (framework) => {
    const propsLoading = await generateCode({
      framework,
      profile: 'build',
      schema: {
        version: '1.0',
        screens: [{ id: 'loading-prop', component: 'Stack', props: { loading: true } }],
      },
    });
    expect(propsLoading.status).toBe('error');
    expect(propsLoading.artifact).toBeUndefined();
    expect(propsLoading.errors).toEqual([
      expect.objectContaining({ code: 'OODS-V007', nodeId: 'loading-prop' }),
    ]);

    const inertIntent = await generateCode({
      framework,
      profile: 'build',
      schema: {
        version: '1.0',
        screens: [{
          id: 'loading-intent',
          component: 'Stack',
          meta: { intent: 'state:loading' },
        }],
      },
    });
    expect(inertIntent.status, JSON.stringify(inertIntent.errors ?? [])).toBe('ok');
    expect(inertIntent.code).not.toContain('data-oods-state');
    expect(inertIntent.code).not.toMatch(/uiState\s*===/);
  });
});
