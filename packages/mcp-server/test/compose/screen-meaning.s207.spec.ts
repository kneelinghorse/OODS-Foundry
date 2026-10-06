import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { wireFieldProps } from '../../src/compose/object-slot-filler.js';
import { collectDashboardViewExtensions } from '../../src/compose/view-extension-collector.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { loadObject } from '../../src/objects/object-loader.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const nodes = (roots: UiElement[]): UiElement[] => roots.flatMap(node => [node, ...nodes(node.children ?? [])]);

describe('screens state the record facts without creating editors (s207-m02)', () => {
  it.each([['Subscription', 'plan_name'], ['Article', 'label']])('inline %s names the record and never edits an arbitrary field', async (object, field) => {
    const result = await compose({ object, context: 'inline', options: { transient: true } });
    expect(result.status).toBe('ok');
    const tree = nodes(result.schema.screens);
    expect(tree.some(node => node.props?.field === field)).toBe(true);
    expect(tree.filter(node => ['Input', 'Select', 'SearchInput', 'Checkbox', 'Textarea', 'Button'].includes(node.component))).toEqual([]);
    expect(tree.some(node => node.collectionControl || node.collection)).toBe(false);
  });

  it('a real list retains query controls instead of binding those controls to record data', async () => {
    const result = await compose({ object: 'Subscription', context: 'list', options: { transient: true } });
    const tree = nodes(result.schema.screens);
    expect(tree.some(node => node.collectionControl === 'search')).toBe(true);
    expect(tree.some(node => node.collectionControl === 'filter')).toBe(true);
    expect(tree.filter(node => node.collectionControl).some(node => node.props?.field === 'amount')).toBe(false);
  });

  it('a dashboard selects the same billing facts once while retaining distinct facts', () => {
    const object = composeObject(loadObject('Subscription'));
    const plans = collectDashboardViewExtensions(object).plan;
    const billing = plans.filter(plan => plan.sourceTrait.endsWith('/Billable') && plan.targetSlot === 'metrics' && plan.props.amountField === 'amount');
    expect(billing).toHaveLength(1);
    expect(billing[0].props).toMatchObject({ amountField: 'amount', currencyField: 'currency', intervalField: 'billing_interval' });
    expect(plans.some(plan => plan.component === 'CycleProgressCard')).toBe(true);
    // s221-m01: since s216-m06 (87b5f94f81) a dashboard drops the CancellationBadge whose field its CancellationSummary
    // already states, as it keeps one billing projection; the summary stays.
    const summary = plans.find(plan => plan.component === 'CancellationSummary')!;
    expect(summary).toBeDefined();
    expect(plans.filter(plan => plan.component === 'CancellationBadge' && plan.props.field === summary.props.cancelAtPeriodEndField)).toEqual([]);
  });

  it.each([{ amountField: 'tax_amount' }, { minorUnits: 1 }])('keeps a billing projection when its facts or scale differ: %j', (props) => {
    const object = structuredClone(composeObject(loadObject('Subscription')));
    const billable = object.traits.find(trait => trait.ref.name.endsWith('/Billable'))!;
    const card = billable.definition.view_extensions.card.find(extension => extension.component === 'BillingCardMeta')!;
    card.props = { ...card.props, ...props };
    const plans = collectDashboardViewExtensions(object).plan;
    expect(plans.filter(plan => ['BillingSummaryBadge', 'BillingCardMeta'].includes(plan.component))).toHaveLength(2);
  });

  it('does not replace a timestamp value with a generated field label; authored copy remains explicit', () => {
    const schema: UiSchema = { version: '2026.02', objectSchema: {
      updated_at: { type: 'datetime', required: false }, created_at: { type: 'datetime', required: true },
    }, screens: [{ id: 'root', component: 'Stack', children: [
      { id: 'date', component: 'RelativeTimestamp', props: { field: 'updated_at', fallbackField: 'created_at' } },
      { id: 'authored', component: 'RelativeTimestamp', props: { field: 'updated_at', label: 'Imported yesterday' } },
    ] }] };
    wireFieldProps(schema);
    expect(schema.screens[0].children![0].props).toEqual({ field: 'updated_at', fallbackField: 'created_at' });
    expect(schema.screens[0].children![1].props?.label).toBe('Imported yesterday');
  });
});
