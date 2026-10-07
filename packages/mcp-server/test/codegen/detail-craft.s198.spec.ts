import { reconcileFormDetail } from '../../src/compose/form-detail.js';
import type { ComposedObject } from '../../src/objects/trait-composer.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { OBJECTS, contextsForObject } from '../../src/lib/runtime-ledger.js';
import { formatReadOnlyValue, traitEventRows } from '@oods/component-contracts';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import type { UiElement } from '../../src/schemas/generated.js';
const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);

describe('s198 detail craft preserves readable, labelled record values', () => {
  it.each(OBJECTS.filter(object => contextsForObject(object).includes('detail')))('%s generates real read-only fields and unique, populated tabs in both frameworks', async object => {
    const { schema } = await compose({ object, context: 'detail' });
    const nodes = walk(schema.screens);
    expect(nodes.filter(node => /(?:Editor|Form|Picker|Selector|Controls)$/.test(node.component))).toEqual([]);
    expect(nodes.filter(node => node.component === 'Card' && !node.children?.length)).toEqual([]);
    const tabs = nodes.find(node => node.component === 'Tabs');
    if (tabs) expect(new Set(tabs.children!.map(node => node.props?.label)).size).toBe(tabs.children!.length);
    for (const row of nodes.filter(node => node.id.endsWith('-read-field'))) {
      expect(row.children).toHaveLength(2);
      expect(row.children![0]!.props?.content).toBeTruthy();
      const value = row.children![1]!;
      // s225-m01: trait status rows bind by statusField; a label must still describe a real object field.
      if (value.component === 'StatusBadge') {
        expect(value.props?.statusField).toBeTruthy();
        expect(schema.objectSchema?.[String(value.props?.statusField)]).toBeDefined();
      } else expect(value.props?.field ?? value.props?.amountField).toBeTruthy();
    }
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    }
  });
  it('replaces empty scaffolding and editors with declared fields once, even on repeated reconciliation', () => {
    // s213-m03 (finding 7): the amount is money in minor units because its semantics declare it, as populateObjectSchema
    // records from Billable's minorUnits parameter; before, the name "amount" beside a currency field decided.
    const schema: UiSchema = { version: '2026.02', objectSchema: { name: { type: 'string' }, enabled: { type: 'boolean' }, amount: { type: 'integer', money: { currencyField: 'currency', minorUnits: 1000 } }, currency: { type: 'string' } }, screens: [{ id: 'screen', component: 'Stack', children: [
      { id: 'detail-header', component: 'Stack', children: [{ id: 'editor', component: 'Input', props: { field: 'name' } }] },
      { id: 'body', component: 'Card', children: [{ id: 'tabs', component: 'Tabs', children: [{ id: 'empty', component: 'Card' }] }] },
    ] }] };
    const composed = { object: { name: 'Test' }, semantics: {}, traits: [{ ref: { name: 'Billable', parameters: { minorUnits: 1000 } }, definition: {} }] } as unknown as ComposedObject;
    reconcileFormDetail(schema, 'detail', composed);
    const once = structuredClone(schema);
    expect(walk(schema.screens).filter(node => node.component === 'Input')).toEqual([]);
    expect(walk(schema.screens).find(node => node.component === 'BillingSummaryBadge')?.props?.minorUnits).toBe(1000);
    expect(walk(schema.screens).filter(node => node.id.endsWith('-read-field'))).toHaveLength(3);
    reconcileFormDetail(schema, 'detail', composed);
    expect(schema).toEqual(once);
  });
  it('exposes Invoice contact and price fields under its invoice identity, and Plan has more than a bare amount', async () => {
    // s206-m01: an invoice is headed by its number (billing.invoice.number), the field that names it, not by its id.
    for (const [object, identity, required] of [['Invoice', 'invoice_number', ['billing_contact_name', 'billing_contact_email', 'subtotal_minor', 'tax_minor']], ['Plan', 'plan_name', ['amount_minor', 'status', 'plan_code']]] as const) {
      const { schema } = await compose({ object, context: 'detail' });
      const nodes = walk(schema.screens);
      expect(nodes.find(node => node.component === 'DetailHeader')?.props?.titleField).toBe(identity);
      // s222-m03 (#2502 ruling 13): a plan's status is the badge in its page header (bound by statusField), not a row.
      for (const field of required) expect(nodes.some(node => node.props?.field === field || node.props?.amountField === field || node.props?.statusField === field), field).toBe(true);
      expect(nodes.find(node => node.props?.amountField === (object === 'Invoice' ? 'subtotal_minor' : 'amount_minor'))?.component).toBe('BillingSummaryBadge');
    }
  });
  it('distinguishes absence, false and zero and formats only declared codes and dates', () => {
    expect(formatReadOnlyValue(false, 'boolean')).toBe('No');
    expect(formatReadOnlyValue(0, 'integer')).toBe('0');
    expect(formatReadOnlyValue(undefined, 'integer')).toBe('Not recorded');
    expect(formatReadOnlyValue('2026-09-08T12:00:00Z', 'datetime')).toBe('Sep 8, 2026, 12:00 PM');
    expect(formatReadOnlyValue('pending_cancellation', 'string', true)).toBe('Pending Cancellation');
    expect(formatReadOnlyValue('authored_title', 'string')).toBe('authored_title');
    expect(formatReadOnlyValue('bad-date', 'date')).toBe('Invalid date');
  });
  it('reads each actual transition, including mixed history vocabularies, rather than repeating current status', () => {
    const rows = traitEventRows('transition', { status: 'cancelled', history: [
      { from: 'trialing', to: 'pending_cancellation', at: '2026-09-01T12:00:00Z' },
      { from_state: 'pending_cancellation', to_state: 'cancelled', transitioned_at: '2026-09-02T12:00:00Z', title: 'Customer closed account' },
    ] });
    expect(rows.map(row => row.title)).toEqual(['Trialing → Pending Cancellation', 'Customer closed account · Pending Cancellation → Cancelled']);
    expect(rows.map(row => row.time)).toEqual(['Sep 1, 2026, 12:00 PM', 'Sep 2, 2026, 12:00 PM']);
  });
  it('preserves HTML tab panel content and layout with honest integration controls', async () => {
    const schema = { version: '2026.02', screens: [{ id: 'tabs', component: 'Tabs', props: { ariaLabel: 'Record details' }, children: [
      { id: 'identity', component: 'Stack', props: { label: 'Identity' }, layout: { type: 'stack' as const, gapToken: 'stack-default' }, children: [{ id: 'contact', component: 'Text', props: { content: 'Invoice contact' } }] },
      { id: 'billing', component: 'Card', props: { label: 'Billing' }, children: [{ id: 'price', component: 'BillingSummaryBadge', props: { amount: 1999, currency: 'usd', minorUnits: 100, showInterval: false } }] },
    ] }] };
    const result = await generate({ schema, framework: 'html', profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(result.code).toContain('Invoice contact'); expect(result.code).toContain('$19.99');
    expect(result.code.match(/<div[^>]*role="tabpanel"/g)).toHaveLength(2);
    expect(result.code).toContain('data-oods-runtime="tabs"');
    const app = await compose({ object: 'Invoice', context: 'detail' });
    const rejected = await generate({ schema: app.schema, framework: 'html', profile: 'build' });
    expect(rejected.status).toBe('ok');
    expect(rejected.code).toContain('No record was changed.');
  });
  it.each(['react', 'vue'] as const)('%s workflow compiles the readonly detail expressions', async framework => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    const result = await generate({ schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const check = typecheckWorkflow(result.artifact!);
    expect(check.status, check.stdout + check.stderr).toBe(0);
  }, 30_000);
});
