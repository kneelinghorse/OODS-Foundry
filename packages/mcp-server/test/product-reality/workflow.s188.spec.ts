import { vi } from 'vitest';

// Decision #1833: git-range/census work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 60_000 });

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { typecheckWorkflow } from './workflow-typecheck.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { collectUiStateBranches, preflightStateContract } from '../../src/codegen/state-contract.js';
import { buildGeneratedArtifact, validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { getAjv } from '../../src/lib/ajv.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import composeInput from '../../src/schemas/design.compose.input.json' assert { type: 'json' };
import composeOutput from '../../src/schemas/design.compose.output.json' assert { type: 'json' };
import generateInput from '../../src/schemas/code.generate.input.json' assert { type: 'json' };
import generateOutput from '../../src/schemas/code.generate.output.json' assert { type: 'json' };
import pipelineInput from '../../src/schemas/pipeline.input.json' assert { type: 'json' };


const root = fileURLToPath(new URL('../../../../', import.meta.url));
const contexts = ['list', 'detail', 'form', 'timeline'] as const;
const artifacts = new Map<'react' | 'vue', GeneratedArtifact>();
let schema: UiSchema;

function link(source: string, target: string) {
  mkdirSync(path.dirname(target), { recursive: true });
  symlinkSync(source, target, 'junction');
}
function rebuild(artifact: GeneratedArtifact, files: Array<{ path: string; contents: string }>) {
  return buildGeneratedArtifact({ framework: artifact.framework, files, actions: artifact.actions,
    imports: artifact.framework === 'react' ? ['@oods/component-contracts', 'react', 'react-dom/client', 'react-dom/server', '@oods/components-react', '@oods/component-styles/css'] : ['@oods/component-contracts', 'vue', '@vitejs/plugin-vue', '@vue/server-renderer', '@oods/components-vue', '@oods/component-styles/css'] });
}

beforeAll(async () => {
  const composition = await compose({ object: 'Subscription', context: 'workflow' });
  const validateInput = getAjv().compile(composeInput);
  expect(validateInput({ object: 'Subscription', context: 'workflow' }), JSON.stringify(validateInput.errors)).toBe(true);
  const validateOutput = getAjv().compile(composeOutput);
  expect(validateOutput(composition), JSON.stringify(validateOutput.errors)).toBe(true);
  expect(composition.status).toBe('ok');
  expect(composition.validation?.status).toBe('ok');
  schema = composition.schema;
  for (const framework of ['react', 'vue'] as const) {
    const result = await generate({ schema, framework, profile: 'build' });
    const validateInput = getAjv().compile(generateInput);
    expect(validateInput({ schema, framework, profile: 'build' }), JSON.stringify(validateInput.errors)).toBe(true);
    const validateOutput = getAjv().compile(generateOutput);
    expect(validateOutput(result), JSON.stringify(validateOutput.errors)).toBe(true);
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    artifacts.set(framework, result.artifact!);
  }
});

describe('Subscription workflow composition', () => {
  it('derives routes and six transition meanings from the public source screens', async () => {
    expect(schema.workflow?.screens.map(({ context, route }) => [context, route])).toEqual([
      ['list', '/'], ['detail', '/:id'], ['form', '/:id/edit'], ['timeline', '/:id/timeline'],
    ]);
    expect(schema.screens.map(({ route }) => route)).toEqual(['/', '/:id', '/:id/edit', '/:id/timeline']);
    expect(schema.workflow?.transitions).toEqual(expect.arrayContaining([
      { action: 'handleRowClick', from: 'list', to: 'detail', effect: 'navigate' },
      { action: 'handleEdit', from: 'detail', to: 'form', effect: 'navigate' },
      { action: 'handleSubmit', from: 'form', to: 'detail', effect: 'save' },
      { action: 'handleCancel', from: 'detail', to: 'detail', effect: 'pending_cancellation' },
      { action: 'handleViewTimeline', from: 'detail', to: 'timeline', effect: 'navigate' },
      { action: 'handleDelete', from: 'detail', to: 'list', effect: 'archive' },
    ]));
    for (const [index, context] of contexts.entries()) {
      const source = await compose({ object: 'Subscription', context });
      if (context === 'list') {
        const actualBranches = structuredClone(schema.screens[index]!.children!);
        const strip = (node: typeof actualBranches[number]) => { node.id = node.id.slice(context.length + 1); node.children?.forEach(strip); };
        actualBranches.forEach(strip);
        expect(actualBranches, 'The list owns its state branches; workflow assembly must reuse them exactly once').toEqual(source.schema.screens[0].children);
        continue;
      }
      const actual = structuredClone(schema.screens[index]!.children!.find((node) => node.state === 'success')!);
      const stripPrefix = (node: typeof actual) => { node.id = node.id.slice(context.length + 1); node.children?.forEach(stripPrefix); };
      stripPrefix(actual);
      delete actual.state;
      if (source.schema.screens[0].bindings) actual.bindings = schema.screens[index]!.bindings;
      else delete actual.bindings;
      expect(actual, `${context} source tree must survive assembly`).toEqual(source.schema.screens[0]);
    }
  });

  it.each(['react', 'vue'] as const)('keeps exactly four canonical branches on every %s screen', (framework) => {
    for (const screen of schema.screens) {
      // Sprint 201 m06 (#2046 doubled empty states): the list's rows collection owns its empty banner, so that screen carries three branches.
      expect(collectUiStateBranches([screen]).map(({ state }) => state)).toEqual(screen.id === 'list-screen' ? ['loading', 'error', 'success', 'empty'] : ['loading', 'empty', 'error', 'success']);
      expect(preflightStateContract([screen], framework)).toEqual([]);
    }
    const broken = structuredClone(schema.screens);
    broken[0].children![0]!.state = 'pending';
    expect(preflightStateContract(broken, framework)).toHaveLength(1);
  });

  it('adds actions in the trait mapping, including no additions for Plan carrying neither trait', async () => {
    for (const context of ['detail', 'form'] as const) {
      const subscription = await compose({ object: 'Subscription', context });
      expect(subscription.schema.screens[0].bindings?.onCancel).toBe(context === 'detail' ? 'handleCancel' : undefined);
      expect(subscription.schema.screens[0].bindings?.onViewTimeline).toBe(context === 'detail' ? 'handleViewTimeline' : undefined);
      const plan = await compose({ object: 'Plan', context });
      expect(plan.objectUsed!.traits.some((trait) => /Cancellable|Timestampable/.test(trait))).toBe(false);
      expect(plan.schema.screens[0].bindings?.onCancel).toBeUndefined();
      expect(plan.schema.screens[0].bindings?.onViewTimeline).toBeUndefined();
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema: subscription.schema, framework, profile: 'build' });
        expect(result.status, JSON.stringify(result.errors)).toBe('ok');
        if (context === 'detail') expect(result.code).toContain('actions.handleCancel();');
        else expect(result.code).not.toContain('actions.handleCancel();');
        if (context === 'detail') expect(result.code).toContain('actions.handleViewTimeline();');
        expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
      }
    }
  });
});

describe('Generated applications close their own contracts', () => {
  it('accepts workflow through pipeline and makes unsupported JavaScript-only emission explicit', async () => {
    const input = { object: 'Subscription', context: 'workflow' as const, framework: 'react' as const, options: { skipRender: true } };
    const validateInput = getAjv().compile(pipelineInput);
    expect(validateInput(input), JSON.stringify(validateInput.errors)).toBe(true);
    const result = await pipeline(input);
    expect(result.error).toBeUndefined();
    expect(result.code?.artifact.files.some((file) => file.path === 'src/App.tsx')).toBe(true);
    const unsupported = await generate({ schema, framework: 'react', profile: 'build', options: { typescript: false } });
    expect(unsupported.status).toBe('error');
    expect(unsupported.errors?.[0]?.message).toContain('typescript=true');
  });
  it('rejects noncanonical object names before interpolating an application shell', async () => {
    const unsafe = structuredClone(schema);
    unsafe.workflow!.object = `Subscription" onClick={alert(1)}`;
    const result = await generate({ schema: unsafe, framework: 'react', profile: 'build' });
    expect(result.status).toBe('error');
    expect(result.errors?.[0]?.message).toContain('canonical alphanumeric');
    expect(result.artifact).toBeUndefined();
  });

  it.each(['react', 'vue'] as const)('%s ships every source file and rejects missing imports or disconnected actions', (framework) => {
    const artifact = artifacts.get(framework)!;
    const extension = framework === 'react' ? '.tsx' : '.vue';
    expect(artifact.files.map(({ path }) => path)).toEqual(expect.arrayContaining([
      `src/App${extension}`, ...contexts.map((context) => `src/screens/${context[0]!.toUpperCase() + context.slice(1)}${extension}`),
      'src/store.ts', 'src/sample-data.ts', 'src/application.ts', 'src/actions.ts', 'package.json', 'index.html',
    ]));
    expect(validateGeneratedArtifact(artifact)).toEqual([]);
    expect(() => rebuild(artifact, artifact.files.filter((file) => file.path !== 'src/store.ts'))).toThrow(/local import/);
    expect(() => rebuild(artifact, artifact.files.map((file) => ({ ...file, contents: file.contents.replace('actions.handleCancel();', 'actions.handleEdit();') })))).toThrow(/must forward to actions.handleCancel/);
    expect(() => rebuild(artifact, artifact.files.map((file) => ({ ...file, contents: file.contents.replace('actions.handleViewTimeline();', '') })))).toThrow(/must forward/);
    expect(artifact.actions.find(({ name }) => name === 'handleCancel')?.sources.map(({ nodeId }) => nodeId).sort()).toEqual(['detail-screen']);
  });

  it.each(['react', 'vue'] as const)('%s application typechecks strict against the built component packages', (framework) => {
    const result = typecheckWorkflow(artifacts.get(framework)!);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 70_000);
});

describe('Generated store drives the lifecycle without consumer wiring', () => {
  it('covers deterministic seeds, query boundaries, save, cancellation history, archive/restore and failure modes', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'oods-s188-store-'));
    try {
      // s213-m01: the store is transpiled to CommonJS .js, so the folder declares that scope itself; a temp folder inside a
      // "type": "module" package (the handoff keeps TMPDIR in the repository) otherwise loads it as ESM.
      writeFileSync(path.join(directory, 'package.json'), '{"type":"commonjs"}\n');
      for (const name of ['store', 'sample-data', 'application', 'actions', 'chart-assets']) {
        const source = artifacts.get('react')!.files.find((file) => file.path === `src/${name}.ts`)!.contents;
        writeFileSync(path.join(directory, `${name}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
      link(path.join(root, 'packages/component-contracts'), path.join(directory, 'node_modules/@oods/component-contracts'));
      const req = createRequire(path.join(directory, 'entry.cjs'));
      const { sampleData } = req('./sample-data.js');
      const { createStore, sortField } = req('./store.js');
      // s221-m01: the seeds are Subscription's authored records since s219-m01 (#2452, #2453; authored examples win, #2413),
      // with no archived seed and no invented ids since s216-m05 (#2412). Every expectation below reads from them.
      const seeds = sampleData as Array<Record<string, any>>;
      // s222-m03 (#2502 ruling 14): one seed per authored Subscription sample (eight).
      expect(seeds).toHaveLength(8);
      expect(seeds.map(record => record.status)).toEqual(schema.objectSchema!.status!.examples);
      expect(new Set(seeds.map(record => record.billing_interval))).toEqual(new Set(['monthly', 'yearly']));
      // Sprint 201 m06 (#2046): the collection outcome agrees with the lifecycle state instead of rotating the enum; an
      // authored past-due record may still be retrying.
      for (const record of seeds) {
        expect(['past_due', 'unpaid'].includes(record.status) ? ['failed', 'retrying'] : ['future', 'trialing'].includes(record.status) ? ['pending'] : ['succeeded'], record.subscription_id).toContain(record.payment_status);
      }
      const live = seeds.filter(record => !record.is_archived);
      const archivedSeeds = seeds.length - live.length;
      const target = String(live.filter(record => record.status === 'active').sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])))[0]!.subscription_id);
      const ended = String(seeds.find(record => record.status === 'terminated')!.subscription_id);
      const store = createStore({ latency: 2, now: () => '2026-01-20T12:00:00.000Z' });
      expect(store.list().total).toBe(live.length);
      expect(store.list({ archived: true }).total).toBe(archivedSeeds);
      expect(store.list({ search: target }).records).toHaveLength(1);
      expect(store.list({ status: 'active' }).records[0].subscription_id).toBe(target);
      // The price ladder has ties; pagination must retain their stable record order. s222-m03 (#2502 ruling 14): the
      // authored samples tie at the second and third prices (two Business subscriptions), so pages of two split the tie.
      const ladder = live.map((record, index) => ({ record, index })).sort((a, b) => b.record.amount - a.record.amount || a.index - b.index).map(({ record }) => [record.subscription_id, record.amount]);
      expect(ladder[1]![1]).toBe(ladder[2]![1]);
      expect(store.list({ sort: 'amount', descending: true, page: 2, pageSize: 2 }).records.map((record: { subscription_id: string; amount: number }) => [record.subscription_id, record.amount]))
        .toEqual(ladder.slice(2, 4));
      const edited = store.get(target);
      edited.plan_name = 'Team annual';
      expect(store.get(target).plan_name).not.toBe('Team annual');
      store.save(edited);
      expect(store.get(target).plan_name).toBe('Team annual');
      const cancelled = store.cancel(target, 'Budget change', 'budget', true);
      expect(cancelled).toMatchObject({ status: 'pending_cancellation', cancellation_reason: 'Budget change', cancellation_reason_code: 'budget', cancel_at_period_end: true });
      // s191-m03 A2: persist the display title alongside unchanged lifecycle evidence.
      expect(cancelled.state_history.at(-1)).toEqual({ title: 'Pending Cancellation', from: 'active', to: 'pending_cancellation', reason: 'Budget change', code: 'budget', atPeriodEnd: true, at: '2026-01-20T12:00:00.000Z' });
      expect(store.list({ search: 'Team annual' }).records[0].status).toBe('pending_cancellation');
      expect(() => store.cancel(target, 'Again', 'budget', false)).toThrow(/current state/);
      expect(() => store.cancel(ended, 'Ended', 'budget', false)).toThrow(/current state/);
      store.archive(target);
      expect(store.list().total).toBe(live.length - 1);
      expect(store.list({ archived: true }).total).toBe(archivedSeeds + 1);
      store.restore(target);
      expect(store.list().total).toBe(live.length);
      // Subscription declares requireReason=false; the store must not invent a mandatory reason.
      expect(createStore().cancel(target, '', '', false).status).toBe('pending_cancellation');
      expect(sampleData.every((record: { last_event: string }) => schema.workflow!.data.recordedEvents!.includes(record.last_event))).toBe(true);
      expect(createStore({ empty: true }).list().total).toBe(0);
      const failing = createStore({ fail: true, latency: 0 });
      await expect(failing.ready()).rejects.toThrow(/Simulated/);
      failing.setFailure(false);
      await expect(failing.ready()).resolves.toBeUndefined();
      const { createWorkflow } = req('./application.js');
      const app = createWorkflow({ latency: 2 });
      const observations: string[] = [];
      app.subscribe((state: { uiState: string }) => observations.push(state.uiState));
      await app.navigate('list');
      expect(observations).toEqual(['loading', 'success']);
      await app.navigate('detail', target);
      expect(app.snapshot().id).toBe(target);
      await app.navigate('form');
      expect(app.snapshot().screen).toBe('form');
      await app.filter('no-such-subscription');
      expect(app.snapshot().uiState).toBe('empty');
      await app.filter('');
      expect(app.snapshot().uiState).toBe('success');
      const empty = createWorkflow({ empty: true, latency: 0 });
      const error = createWorkflow({ fail: true, latency: 0 });
      for (const screen of contexts) {
        await empty.navigate(screen); expect(empty.snapshot().uiState).toBe('empty');
        await error.navigate(screen); expect(error.snapshot().uiState).toBe('error');
      }
      await error.retry(); expect(error.snapshot().uiState).toBe('success');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
