import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { displayFieldExpression, resolveFrameworkChildContent, resolveFrameworkRecipeProps } from '../../src/codegen/binding-utils.js';
import { populateObjectSchema } from '../../src/compose/object-slot-filler.js';
import { typecheckWorkflow } from './workflow-typecheck.js';
import type { FieldSchemaEntry } from '../../src/schemas/generated.js';
import { expectedCollectionOrder } from '../../../../scripts/product-reality/s188-m03-app-consumers.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';

const fields: Record<string, FieldSchemaEntry> = {
  payment_reference: { type: 'string', required: false, semanticType: 'text.label', displayFallbackField: 'transaction_id' },
  transaction_id: { type: 'uuid', required: true },
};

describe('authored Transaction name (Derek approval, decision 2266)', () => {
  it.each([undefined, null, '', '   ', 'PAY-123', '  PAY-123  ', 0, false])('displays %j without rewriting a value', reference => {
    const expression = displayFieldExpression('payment_reference', fields);
    const display = new Function('paymentReference', 'transactionId', `return ${expression}`);
    expect(display(reference, 'tx-17')).toBe(reference === undefined || reference === null || typeof reference === 'string' && !reference.trim() ? 'tx-17' : reference);
  });

  it('keeps editors raw and applies the rule only to naming displays', () => {
    expect(resolveFrameworkChildContent({ id: 'input', component: 'Input', props: { field: 'payment_reference' } }, fields)?.fieldName).toBe('paymentReference');
    expect(resolveFrameworkChildContent({ id: 'text', component: 'Text', props: { field: 'payment_reference' } }, fields)?.fieldName).toContain('transactionId');
    expect(resolveFrameworkRecipeProps({ id: 'header', component: 'CardHeader', props: { titleField: 'payment_reference' } }, fields).bindings[0].expression).toContain('transactionId');
    expect(resolveFrameworkRecipeProps({ id: 'archived', component: 'ArchivedRowOverlay', props: { labelField: 'payment_reference' } }, fields).bindings.find(binding => binding.targetProp === 'label')?.expression).toContain('transactionId');
    expect(displayFieldExpression('payment_reference', { ...fields, payment_reference: { type: 'string', required: false } })).toBe('paymentReference');
  });

  it('refuses a missing or self-referential authored target instead of inventing one', () => {
    for (const target of ['unknown', 'payment_reference', 'toString']) {
      expect(() => populateObjectSchema({ version: '2026.02', screens: [] }, {
        payment_reference: { type: 'string', required: false, description: 'Reference' },
      }, { payment_reference: { semantic_type: 'text.label', token_mapping: 'text', ui_hints: { displayFallbackField: target } } })).toThrow('Invalid display fallback');
    }
  });

  it.each(['react', 'vue'] as const)('%s uses the optional reference consistently without inventing seed names', async framework => {
    const { schema } = await compose({ object: 'Transaction', context: 'workflow', options: { transient: true } });
    expect(schema.objectSchema!.payment_reference).toMatchObject(fields.payment_reference);
    // s221-m01: the records are authored with references since s219-m01 (#2452, #2453) and keyed neutrally since s216-m05
    // (#2412); the list orders by the shown name, the reference, falling back to the record key when a reference is blank.
    const shown = (record: Record<string, unknown>) => String(record.payment_reference ?? '').trim() ? String(record.payment_reference) : String(record.transaction_id);
    const live = workflowSampleRecords(schema).filter(record => !record.is_archived);
    expect(expectedCollectionOrder(schema, undefined, true)).toEqual([...live].sort((a, b) => shown(b).localeCompare(shown(a))).map(record => String(record.transaction_id)));
    const result = await generate({ schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const artifact = result.artifact!;
    const typed = typecheckWorkflow(artifact);
    expect(typed.status, typed.stdout + typed.stderr).toBe(0);
    const app = artifact.files.find(file => /^src\/App\./.test(file.path))!.contents;
    expect(app).toContain('state.draft["payment_reference"]');
    expect(app).toContain('state.draft["transaction_id"]');
    for (const context of ['List', 'Detail', 'Timeline']) {
      const code = artifact.files.find(file => file.path.startsWith(`src/screens/${context}.`))!.contents;
      expect(code, context).toContain("String(paymentReference ?? '').trim() ? paymentReference : transactionId");
    }
    const directory = mkdtempSync(path.join(tmpdir(), 'transaction-name-'));
    try {
      writeFileSync(path.join(directory, 'package.json'), '{"type":"commonjs"}');
      for (const file of artifact.files.filter(file => /^src\/(store|sample-data|application|actions)\.ts$/.test(file.path))) {
        writeFileSync(path.join(directory, path.basename(file.path, '.ts') + '.js'), ts.transpileModule(file.contents, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
      mkdirSync(path.join(directory, 'node_modules/@oods'), { recursive: true });
      symlinkSync(fileURLToPath(new URL('../../../../packages/component-contracts', import.meta.url)), path.join(directory, 'node_modules/@oods/component-contracts'), 'junction');
      const req = createRequire(path.join(directory, 'entry.cjs'));
      const { sampleData } = req('./sample-data.js');
      // Authored, never invented: every seeded reference is one of the object's own examples.
      expect(sampleData.every((record: Record<string, unknown>) => record.payment_reference === undefined || (schema.objectSchema!.payment_reference!.examples ?? []).includes(record.payment_reference))).toBe(true);
      const seed = sampleData.slice(0, 2).map((record: Record<string, unknown>, index: number) => ({ ...record, transaction_id: index ? 'A-ID' : 'Z-ID', payment_reference: index ? '' : 'B-REF', is_archived: false }));
      const { createStore, screenProps } = req('./store.js');
      const store = createStore({ seed });
      expect(store.list().records.map((record: Record<string, unknown>) => record.transaction_id)).toEqual(['A-ID', 'Z-ID']);
      expect(store.get('A-ID').payment_reference).toBe('');
      expect(screenProps(store.get('A-ID')).paymentReference).toBe('');
      const { createWorkflow } = req('./application.js');
      const workflow = createWorkflow({ seed, latency: 0 });
      await workflow.navigate('form', 'A-ID');
      expect(workflow.snapshot().draft.payment_reference).toBe('');
      await workflow.navigate('detail', 'A-ID');
      expect(workflow.snapshot().draft.payment_reference).toBe('');
      workflow.dispose();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 60_000);
});
