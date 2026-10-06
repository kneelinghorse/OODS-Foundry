import { vi } from 'vitest';

// Decision #1833: git-range/census work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 60_000 });

import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { resolveFieldProps, mapFieldType } from '../../src/codegen/binding-utils.js';
import { wireFieldProps } from '../../src/compose/object-slot-filler.js';
import { neutralFieldValue } from '../../src/codegen/workflow-data-emitter.js';
import { enumOptionLabel } from '../../src/compose/internal-fields.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { runS185M04LiveConsumers } from '../../../../scripts/product-reality/s185-m04-live-consumers.js';
import { composeFreshInputs, runLiveGenerationOnly } from '../../../../scripts/product-reality/s184-m06-live-consumers.js';
import { deriveConsumerModel, deriveValueProbes, schemaNodes } from '../../../../scripts/product-reality/s185-m04-consumer-contract.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const compiler = requireVue('@vue/compiler-sfc');
const esbuild = createRequire(requireVue.resolve('vite/package.json'))('esbuild');
const operands = [
  ['Article', 'detail'], ['Media', 'detail'], ['Product', 'detail'], ['User', 'detail'],
  ['Plan', 'inline'], ['Subscription', 'inline'], ['Usage', 'list'], ['Usage', 'inline'], ['Transaction', 'timeline'],
] as const;

describe('Sprint 187 fresh composition binding intent', () => {
  it.each(operands)('%s/%s preserves its fields and generates in both frameworks', async (object, context) => {
    const composed = await compose({ object, context });
    expect(composed.status).toBe('ok');
    const schema = composed.schema!;
    const before = JSON.stringify(schema);
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      expect(result.artifact?.framework).toBe(framework);
    }
    expect(JSON.stringify(schema)).toBe(before);
    if (context === 'detail') {
      const timeline = schemaNodes(schema).find((node) => node.component === 'StatusTimeline');
      expect(timeline?.props?.field).toBe('status');
      expect(timeline?.props?.historyField).toBe('state_history');
      expect(timeline?.props).not.toHaveProperty('label');
    }
  });

  it.each(['list', 'form', 'inline'] as const)('Product/%s keeps naming data and honest controls after the ports', async (context) => {
    const schema = (await compose({ object: 'Product', context })).schema!;
    const nodes = schemaNodes(schema);
    if (context === 'list') {
      expect(nodes.find((node) => node.component === 'LabelCell')?.props).toMatchObject({ field: 'label', descriptionField: 'description' });
      expect(nodes.find(node => node.collectionControl === 'filter')).toMatchObject({ component: 'Select', props: { label: 'Status' } });
      expect(nodes.find(node => node.collection?.source === 'rows')?.collection?.keyField).toBe('product_id');
    } else if (context === 'form') {
      // s221-m01: since s216-m01 (#2407) the ClassificationEditor stays a classification control; a real Textarea beside it
      // edits description.
      const editor = nodes.find((node) => node.component === 'ClassificationEditor')!;
      expect(editor.props).not.toHaveProperty('field');
      expect(editor.bindings?.onChange).toBeUndefined();
      expect(nodes.find(node => node.props?.field === 'description')).toMatchObject({ component: 'Textarea', bindings: { onChange: 'handleChange_description' } });
    } else {
      // s207: a single-record inline view has no collection query controls.
      // The trait's state remains typed for the list's collection controls.
      expect(nodes.some(node => ['SearchInput', 'PaginationBar', 'FilterPanel'].includes(node.component) || node.collectionControl)).toBe(false);
      expect(nodes.find(node => node.component === 'InlineLabel')?.props?.field).toBe('label');
      expect(schema.objectSchema?.searchActive.type).toBe('boolean');
    }
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema, framework, profile: 'build' });
      expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
      if (context === 'form') {
        // The description's editor owns its value as local state seeded from the record (s216-m01, #2407).
        expect(generated.code).toContain(framework === 'react' ? "React.useState<string>(String(description ?? ''))" : "ref<string>(String(description.value ?? ''))");
        expect(generated.code).toContain(framework === 'react' ? 'value={handleChange_descriptionState}' : ':modelValue="handleChange_descriptionState"');
        expect(schema.screens[0].bindings?.onChange).toBeUndefined(); // Native field events must not also dispatch a root-level change.
      }
    }
  });

  it.each(['list', 'detail', 'card'] as const)('Organization/%s preserves its ownership and tag data through both generators', async (context) => {
    const schema = (await compose({ object: 'Organization', context })).schema!;
    const nodes = schemaNodes(schema);
    if (context === 'list') expect(nodes.find((node) => node.component === 'OwnerBadge')?.props).toMatchObject({ ownerIdField: 'owner_id', ownerTypeField: 'owner_type' });
    if (context === 'detail') expect(nodes.find((node) => node.component === 'OwnershipSummary')?.props).toMatchObject({ transferredAtField: 'ownership_transferred_at', allowTransferParameter: 'allowTransfer' });
    if (context === 'card') {
      expect(nodes.some((node) => node.component === 'Button')).toBe(false);
      expect(nodes.find((node) => node.component === 'OwnershipMeta')).toBeDefined();
      // s223-m01 (#2527 rulings 6-7): a card shows its tags as pills, as its list row does, not a "Tag Count" row.
      expect(nodes.find((node) => node.component === 'TagPills')?.props).toMatchObject({ field: 'tags', maxVisible: 3 });
      expect(nodes.some((node) => node.component === 'TagSummary')).toBe(false);
      // The trait explicitly defaults tags to empty; sample generation must preserve that and invent none. s222-m03
      // (#2502 ruling 14): Organization now authors its samples' tags, so the first sample's authored tags are shown.
      expect(deriveConsumerModel(schema).tags).toEqual(loadObject('Organization').samples![0]!.tags);
    }
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema, framework, profile: 'build' });
      expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
      if (context === 'card') expect(generated.code).toMatch(/tags=\{tags\}|:tags="tags"/);
    }
  });

  it.each(['detail', 'form', 'card'] as const)('Subscription/%s preserves lifecycle data and disclosed directives', async (context) => {
    const schema = (await compose({ object: 'Subscription', context })).schema!;
    const nodes = schemaNodes(schema);
    if (context === 'detail') expect(nodes.find((node) => node.component === 'ArchiveSummary')?.props)
      .toMatchObject({ archivedField: 'is_archived', archivedAtField: 'archived_at', reasonField: 'archive_reason', metadataField: 'archive_metadata' });
    if (context === 'form') {
      const form = nodes.find((node) => node.component === 'CancellationForm')!;
      expect(form.props).toMatchObject({ reasonField: 'cancellation_reason', codeField: 'cancellation_reason_code', allowedReasonsParameter: 'allowedReasons' });
      expect(form.bindings).toBeUndefined();
      // s221-m01: an unauthored string is its neutral typed value, never a label standing in for data (s216-m05, #2412).
      expect(deriveConsumerModel(schema).cancellationReasonCode).toBe(neutralFieldValue(schema.objectSchema!.cancellation_reason_code!));
    }
    if (context === 'card') {
      for (const component of ['ArchivePill', 'CancellationBadge']) {
        expect(nodes.find((node) => node.component === component)?.props).not.toHaveProperty('label');
      }
      expect(nodes.find((node) => node.component === 'BillingCardMeta')?.props).toMatchObject({ amountField: 'amount', currencyField: 'currency', intervalField: 'billing_interval', minorUnitsParameter: 'minorUnits', minorUnits: 100 });
    }
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      if (context === 'detail') {
        expect(schema.objectSchema?.archived_at.type).toBe('datetime?');
        expect(result.code).toContain('archivedAt?: string | null;');
      }
    }
  });

  it.each(['ArchivePill', 'CancellationBadge'])('%s preserves an authored label while suppressing synthetic state labels', (component) => {
    const schema: UiSchema = { version: '2026.02', objectSchema: { flag: { type: 'boolean', description: 'Technical description' } }, screens: [
      { id: 'implicit', component, props: { field: 'flag' } },
      { id: 'authored', component, props: { field: 'flag', label: 'Authored label' } },
    ] };
    wireFieldProps(schema);
    expect(schema.screens[0]!.props).not.toHaveProperty('label');
    expect(resolveFieldProps(schema.screens[0]!, schema.objectSchema) ?? {}).not.toHaveProperty('label');
    expect(schema.screens[1]!.props?.label).toBe('Authored label');
  });

  it.each([
    ['datetime?', 'string | null'], ['boolean?', 'boolean | null'], ['integer[]?', 'number[] | null'],
  ])('maps nullable trait %s without changing the required flag or source entry', (type, expected) => {
    const entry = { type, required: true };
    expect(mapFieldType(entry)).toBe(expected);
    expect(entry).toEqual({ type, required: true });
    expect(mapFieldType({ type: 'string?', enum: ['a', 'b'] })).toBe("'a' | 'b' | null");
  });

  it('does not treat search-active booleans as editable search query text', () => {
    const schema: UiSchema = { version: '2026.02', objectSchema: {
      searchActive: { type: 'boolean', required: true, semanticType: 'state.search.active' },
      searchQuery: { type: 'string', required: false, semanticType: 'input.search.query' },
    }, screens: [{ id: 'query', component: 'SearchInput' }] };
    wireFieldProps(schema);
    expect(schema.screens[0]!.props?.field).toBe('searchQuery');
    expect(schema.screens[0]!.bindings).toEqual({ onUpdate: 'handleUpdate_searchQuery' });
    expect(schema.objectSchema?.searchActive.type).toBe('boolean');
  });

  it('keeps authored choices and enum semantics, converting only continuous empty Selects', () => {
    const choices = [{ value: '0', label: 'Zero' }, { value: '7', label: 'Seven' }];
    const schema: UiSchema = { version: '2026.02', objectSchema: {
      quantity: { type: 'number', required: true }, status: { type: 'string', required: true, enum: ['active', 'ended'] },
    }, screens: [
      { id: 'continuous', component: 'Select', props: { field: 'quantity' } },
      { id: 'authored', component: 'Select', props: { field: 'quantity', options: choices } },
      { id: 'enum', component: 'Select', props: { field: 'status' } },
    ] };
    wireFieldProps(schema);
    expect(schema.screens[0]).toMatchObject({ component: 'Input', props: { field: 'quantity', type: 'number' }, bindings: { onChange: 'handleChange_quantity' } });
    expect(schema.screens[1]).toMatchObject({ component: 'Select', props: { options: choices } });
    // s221-m01: enum options keep their stored values and read like the badges (s215-m01, #2388).
    expect(schema.screens[2]).toMatchObject({ component: 'Select', props: { options: ['active', 'ended'].map(value => ({ value, label: enumOptionLabel(value) })) } });
  });

  it.each(['react', 'vue'] as const)('renders typed values and explicit empty/nonempty collections in generated %s', async (framework) => {
    for (const [object, context] of [...operands.slice(4), ['Subscription', 'card'] as const, ['Subscription', 'detail'] as const]) {
      const schema = (await compose({ object, context })).schema!;
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      const cacheRoot = path.join(repositoryRoot, `packages/components-${framework}/.cache`);
      mkdirSync(cacheRoot, { recursive: true });
      const directory = mkdtempSync(path.join(cacheRoot, 's187-values-'));
      try {
        let source = result.code!;
        if (framework === 'vue') {
          const parsed = compiler.parse(source, { filename: 'GeneratedUI.vue' });
          expect(parsed.errors).toEqual([]);
          source = compiler.compileScript(parsed.descriptor, { id: 's187-values', inlineTemplate: true }).content;
        }
        const sourcePath = path.join(directory, framework === 'react' ? 'GeneratedUI.tsx' : 'GeneratedUI.ts');
        writeFileSync(sourcePath, source);
        esbuild.buildSync({ entryPoints: [sourcePath], outfile: path.join(directory, 'GeneratedUI.cjs'), bundle: true,
          platform: 'node', format: 'cjs', target: 'es2022', jsx: 'automatic', logLevel: 'silent',
          // s221-m02: the component styles' token CSS names DM Sans's files beside it; esbuild needs a loader for them.
          loader: { '.woff2': 'file' },
          external: ['react', 'react-dom', 'vue', '@oods/components-react', '@oods/components-react/*', '@oods/components-vue', '@oods/components-vue/*'],
        });
        const models = [deriveConsumerModel(schema), deriveConsumerModel(schema)];
        for (const probe of deriveValueProbes(schema, models[1]!).filter((probe) => probe.kind === 'numeric-input' || probe.kind === 'boolean-text')) {
          const key = probe.field.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
          models[1]![key] = probe.kind === 'boolean-text' ? true : 7;
        }
        if (context === 'card') { models[1]!.isArchived = true; models[1]!.cancelAtPeriodEnd = true; }
        if (context === 'detail') models.push({ ...deriveConsumerModel(schema), archivedAt: null });
        const collection = schemaNodes(schema).find(node => node.collection)?.collection;
        if (collection) {
          models[0][collection.source] = [];
          models[1][collection.source] = collection.source === 'rows' ? [{ ...models[1] }] : [{ id: 'consumer-event', title: 'Consumer lifecycle event', at: '2026-09-08T12:00:00Z' }];
        }
        const expectedModels = [...models];
        if (framework === 'vue' && result.code!.includes('const generatedProps = defineProps<Props>();')) {
          models.push({});
          expectedModels.push(deriveConsumerModel(schema));
        }
        writeFileSync(path.join(directory, 'render.cjs'), `
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const generated = require('./GeneratedUI.cjs');
const framework = ${JSON.stringify(framework)};
const models = ${JSON.stringify(models)};
const probes = ${JSON.stringify(expectedModels.map((model) => collection ? [] : deriveValueProbes(schema, model)))};
// s223-m01 (#2527 ruling 7): a card's chip that hides its default is absent while its flag is false; that absence is the
// value it represents, so it is asserted instead of a text.
const hidden = ${JSON.stringify(expectedModels.map((model) => schemaNodes(schema).filter((node) => node.props?.hideWhenFalse === true && typeof node.props?.field === 'string' && model[String(node.props.field).replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())] === false).map((node) => ({ id: node.id, component: node.component }))))};
const collection = ${JSON.stringify(collection ?? null)};
const actionNames = ${JSON.stringify(result.artifact!.actions.map(({ name }) => name))};
(async () => {
  for (let i = 0; i < models.length; i++) {
    const props = { ...models[i], actions: Object.fromEntries(actionNames.map(name => [name, () => {}])) };
    let html = framework === 'react'
      ? require('react-dom/server').renderToString(require('react').createElement(generated.GeneratedUI, props))
      : await require('@vue/server-renderer').renderToString(require('vue').createSSRApp(generated.default, props));
    // s232-m01: the planted summary deliberately ignores hideWhenFalse and omits id. The old chip-id assertion
    // passed this case; the component-presence assertion below must reject the real summary still being drawn.
    if (process.env.OODS_S232_PLANT_SUMMARY === '1' && hidden[i].length) {
      const component = require('@oods/components-' + framework)[hidden[i][0].component];
      const props = { isArchived: false, cancelAtPeriodEnd: false, hideWhenFalse: false };
      html += framework === 'react'
        ? require('react-dom/server').renderToString(require('react').createElement(component, props))
        : await require('@vue/server-renderer').renderToString(require('vue').createSSRApp(component, props));
    }
    const document = JSDOM.fragment(html);
    if (models[i].archivedAt === null) assert.ok(![...document.querySelectorAll('[data-oods-component=ArchiveSummary] dt')].some(node => node.textContent === 'Archived At'), 'null archive timestamp must omit its date term');
    if (collection) {
      const items = models[i][collection.source] || [];
      const region = document.querySelector('[data-oods-collection=' + JSON.stringify(collection.source) + ']');
      assert.ok(region, 'the declared collection must render');
      assert.equal(region.querySelectorAll('ol > li').length, items.length, 'empty and populated operands must drive the real collection');
      // s206-m01: a row shows the field that names the record (collection.labelField: Usage's meter), the key only when nothing names it.
      if (items.length) assert.ok(region.textContent.includes(collection.source === 'events' ? 'Consumer lifecycle event' : String(items[0][(collection.labelField ?? collection.keyField).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())])), 'the row or event operand must supply the visible label');
      else assert.match(region.textContent, /No records found|No events yet/);
    } else assert.ok(probes[i].length || hidden[i].length, 'a typed value must actually be exercised');
    for (const { id, component } of hidden[i]) {
      assert.equal(document.querySelector('[id=' + JSON.stringify(id) + ']'), null, id + ' must not draw a default-only chip');
      assert.equal(document.querySelector('[data-oods-component=' + JSON.stringify(component) + ']'), null, component + ' hidden summary must be absent from the document');
    }
    for (const probe of probes[i]) {
      const node = document.querySelector('[id=' + JSON.stringify(probe.nodeId) + ']');
      assert.ok(node, probe.nodeId);
      const target = probe.selector ? node.querySelector(probe.selector) : node;
      assert.ok(target, probe.selector);
      const actual = probe.kind === 'status' ? node.querySelector('[data-timeline-current]').textContent.trim() : probe.kind === 'native-value' ? target.value : probe.kind === 'numeric-input' || probe.kind === 'query-input' ? target.getAttribute('value') : target.textContent.trim();
      assert.equal(actual, probe.expected, probe.field + ' must preserve its typed value');
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`);
        const rendered = spawnSync('node', [path.join(directory, 'render.cjs')], { encoding: 'utf8' });
        expect(rendered.status, rendered.stderr).toBe(0);
        if (context === 'card') {
          const planted = spawnSync('node', [path.join(directory, 'render.cjs')], { encoding: 'utf8', env: { ...process.env, OODS_S232_PLANT_SUMMARY: '1' } });
          expect(planted.status, 'a summary which ignores hideWhenFalse must be rejected').not.toBe(0);
          expect(planted.stderr).toContain('hidden summary must be absent from the document');
        }
      } finally { rmSync(directory, { recursive: true, force: true }); }
    }
  }, 60_000);

  it('retains authentic fresh schemas and artifact provenance without touching a saved store', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 's187-fresh-generation-'));
    try {
      const freshInputs = [{ object: 'Transaction', context: 'timeline' as const }];
      const result = await runLiveGenerationOnly({ artifactRoot: root, freshInputs, mission: 's187-m01' });
      expect(result.cells).toHaveLength(2);
      const record = JSON.parse(readFileSync(path.join(root, 'live-generation/fresh-Transaction-timeline/composition.json'), 'utf8'));
      expect(record.composition.input).toEqual(freshInputs[0]);
      expect(record.composition.sourceHead).toMatch(/^[a-f0-9]{40}$/);
      expect(record.schema).toEqual((await compose(freshInputs[0]!)).schema);
      for (const cell of result.cells) {
        expect(cell.sourceSchema).toEqual(record.schema);
        expect(cell.composition?.schemaSha256).toBe(record.schemaRef);
        const artifact = JSON.parse(readFileSync(path.join(root, 'live-generation', cell.schema, cell.framework, 'artifact.json'), 'utf8'));
        expect(artifact).toEqual(cell.artifact);
      }
      expect(result.report.schemaStore).toBeNull();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('rejects duplicate, non-public, overridden, and mixed fresh/saved operands', async () => {
    const input = { object: 'User', context: 'detail' as const };
    await expect(composeFreshInputs([input, input])).rejects.toThrow('distinct public');
    await expect(composeFreshInputs([{ ...input, object: '../User' }])).rejects.toThrow('distinct public');
    await expect(composeFreshInputs([{ ...input, intent: 'override' } as typeof input])).rejects.toThrow('without overrides');
    await expect(runLiveGenerationOnly({ artifactRoot: '/unused', freshInputs: [input], schemaNames: ['user-detail-showcase'] })).rejects.toThrow('mutually exclusive');
    await expect(runS185M04LiveConsumers({ artifactRoot: '/unused', freshInputs: [input], schemaNames: ['user-detail-showcase'] })).rejects.toThrow('mutually exclusive');
  });
});
