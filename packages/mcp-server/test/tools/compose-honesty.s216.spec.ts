import { afterEach, expect, it, vi } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import * as validator from '../../src/tools/repl.validate.js';
import * as selector from '../../src/compose/component-selector.js';
import * as traits from '../../src/objects/trait-loader.js';
import { deriveConsumerModel } from '../../src/codegen/preview-model.js';
import { workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';
import type { UiSchema, UiElement } from '../../src/schemas/generated.js';
afterEach(() => vi.restoreAllMocks());
const nodes = (items: UiElement[]): UiElement[] => items.flatMap(n => [n, ...nodes(n.children ?? [])]);
it('reports only surviving slots and omits invented placement confidence', async () => {
  const result = await compose({ object: 'Subscription', context: 'form', options: { transient: true } });
  const present = new Set(nodes(result.schema.screens).flatMap(n => n.meta?.intent?.startsWith('slot:') ? [n.meta.intent.slice(5)] : []));
  expect(result.selections.length).toBeGreaterThan(0);
  expect(result.selections.filter(s => !present.has(s.slotName))).toEqual([]);
  for (const entry of result.selections.filter(s => s.placedComponents?.length)) {
    expect(entry.confidence).toBeUndefined();
    expect(entry.confidenceLevel).toBeUndefined();
    expect(entry.candidates.every(c => c.score === undefined)).toBe(true);
  }
  expect(result.meta?.intelligence?.positionAffinityUsed).toBeUndefined();
});
it('surfaces selector keyword warnings to the caller', async () => {
  const original = selector.selectComponent;
  vi.spyOn(selector, 'selectComponent').mockImplementation((...args) => ({ ...original(...args), warning: 'Unknown intent; results based on keyword matching only.' }));
  const result = await compose({ intent: 'dashboard', options: { transient: true } });
  expect(result.warnings.some(w => /keyword matching only/.test(w.message))).toBe(true);
});
it('a validator crash refuses the composition instead of recording success', async () => {
  vi.spyOn(validator, 'handle').mockRejectedValue(new Error('validation fault'));
  const result = await compose({ object: 'User', context: 'detail', options: { transient: true } });
  expect(result.status).toBe('error');
  expect(result.validation?.status).toBe('invalid');
  expect(result.errors?.[0]?.message).toContain('validation fault');
  expect(result.compositionId).toBeUndefined();
});
it('unknown and unloadable objects keep actionable not-found and invalid errors', async () => {
  expect((await compose({ object: 'ThereIsNoSuchObject', options: { transient: true } })).errors?.[0]?.code).toBe('OODS-N005');
  vi.spyOn(traits, 'loadTrait').mockImplementation(() => { throw new Error('trait fault'); });
  expect((await compose({ object: 'User', options: { transient: true } })).errors?.[0]?.code).toBe('OODS-V215');
});
it('intent and object form fields do not invent placeholders or option choices', async () => {
  for (const input of [{ intent: 'form with a colour dropdown' }, { object: 'User', context: 'form' as const }]) {
    const result = await compose({ ...input, options: { transient: true } });
    expect(JSON.stringify(result.schema)).not.toMatch(/Enter |option-a|option-b/);
  }
});
it('sample values come from authors or neutral types, never guessed business data', () => {
  const schema: UiSchema = { version: '2026.03', screens: [{ id: 'billing', component: 'BillingSummary', props: { amountField: 'amount', currencyField: 'currency' } }], objectSchema: {
    name: { type: 'string' }, amount: { type: 'integer' }, currency: { type: 'string' }, addresses: { type: 'AddressableEntry[]' }, count: { type: 'number' }, published: { type: 'boolean' },
    authored: { type: 'string', examples: ['Authored name'] }, configured: { type: 'integer', default: 42 }, status: { type: 'string', enum: ['pending', 'ready'] },
  } };
  const expected = { name: '', amount: 0, currency: '', addresses: [], count: 0, published: false, authored: 'Authored name', configured: 42, status: 'pending' };
  expect(deriveConsumerModel(schema)).toMatchObject(expected);
  expect(workflowSampleData(schema).records[0]).toMatchObject(expected);
  expect(workflowSampleData(schema).seedTable.every(row => !!row.rule)).toBe(true);
});

it('generic React action surfaces never fabricate caller arguments or object-specific copy', async () => {
  const { emit } = await import('../../src/codegen/react-emitter.js');
  const result = emit({ version: '2026.03', screens: [{ id: 'list-root', component: 'ListView', bindings: { onRowClick: 'openRow', onSort: 'sortRows', onFilter: 'filterRows', onCancel: 'cancelRecord' } }], objectSchema: { subscription_id: { type: 'string', required: true, semanticType: 'billing.subscription.id' } } }, { typescript: true, styling: 'tokens' });
  expect(result.code).not.toContain('Cancel subscription');
  expect(result.code).not.toMatch(/onClick=\{\(\) => (?:openRow|sortRows|filterRows)\(/);
  expect(result.code).toContain('This action needs input from your application.');
});
it('empty payment history stays empty and generates a named empty state, never a fabricated series', async () => {
  const { prepareChartAssets, placedChartRequests } = await import('../../src/codegen/chart-assets.js');
  const result = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
  expect(result.status).toBe('ok');
  // s219-m01: Subscription now authors payments; a record without authored payments still gets no invented series.
  delete result.schema.objectSchema!.payment_history!.examples;
  expect(workflowSampleData(result.schema).records[0]?.payment_history).toEqual([]);
  expect(placedChartRequests(result.schema)).toEqual([]);
  const output = await prepareChartAssets(result.schema);
  expect(output.files).toHaveLength(3);
  expect(output.files.every(file => file.contents.includes('No recorded payments') && file.contents.includes('role="img"'))).toBe(true);
});
it('HTML seed resolution retains examples authored on the supplied schema', async () => {
  const { renderSeed } = await import('../../src/codegen/render-seed.js');
  const result = await compose({ object: 'Subscription', context: 'form', options: { transient: true } });
  result.schema.objectSchema!.plan_name!.examples = ['Authored input plan'];
  expect((await renderSeed(result.schema)).model.planName).toBe('Authored input plan');
});
it('a fallback layout omits confidence when no layout keyword supplied evidence', async () => {
  const result = await compose({ intent: 'quux', options: { transient: true } });
  expect(result.meta?.layoutDetected).not.toContain('confidence');
  expect(result.warnings.some(w => /no layout keyword/i.test(w.message))).toBe(true);
});
