import { NUCLEUS_COMPONENT_IDS, sharedScenarios } from '@oods/component-contracts';
import { renderSharedScenario } from './scenario-fixtures.js';
import { mount } from '@vue/test-utils';
import { axe } from 'vitest-axe';
import { defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';

import {
  Banner,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Select,
  Table,
  Tabs,
  Textarea,
} from '../src/index.js';

const AccessibilityShowcase = defineComponent({
  name: 'AccessibilityShowcase',
  setup() {
    return () => h('main', { 'aria-label': 'Vue component accessibility showcase' }, [
      h(Banner, {
        title: 'Payment failed',
        detail: 'Update the card',
        tone: 'critical',
        dismissLabel: 'Dismiss payment warning',
      }),
      h(Button, { content: 'Save changes' }),
      h(Input, {
        id: 'email',
        label: 'Email',
        modelValue: 'invalid',
        required: true,
        help: 'Use a work address',
        validation: { state: 'error', message: 'Enter a valid email' },
      }),
      h(Checkbox, {
        id: 'marketing',
        label: 'Product updates',
        required: true,
        help: 'Choose whether to subscribe',
      }),
      h(Select, {
        id: 'plan',
        label: 'Plan',
        modelValue: 'pro',
        options: [
          { value: 'basic', label: 'Basic' },
          { value: 'pro', label: 'Pro' },
        ],
      }),
      h(Textarea, { id: 'notes', label: 'Notes', help: 'Visible to account managers' }),
      h(Tabs, {
        ariaLabel: 'Account sections',
        items: [
          { id: 'overview', label: 'Overview', panel: 'Summary' },
          { id: 'billing', label: 'Billing', panel: 'Invoices' },
        ],
      }),
      h(Table, {
        caption: 'Subscriptions',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
        ],
        rows: [{ id: 'sub-1', name: 'Acme', status: 'Active' }],
        selectable: true,
      }),
    ]);
  },
});

describe('@oods/components-vue accessibility outcomes', () => {
  const axeScenarios = sharedScenarios;
  it('runs every governed root through the axe loop exactly once', () => {
    expect(axeScenarios.map(scenario => scenario.oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(axeScenarios).toHaveLength(NUCLEUS_COMPONENT_IDS.length);
  });
  for (const scenario of axeScenarios) {
    it(`passes axe for the ${scenario.oodsComponentId} shared scenario`, async () => {
      const wrapper = mount(defineComponent({ render: () => h('main', {}, [renderSharedScenario(scenario)]) }), { attachTo: document.body });
      try {
        const result = await axe(wrapper.element, { rules: { 'color-contrast': { enabled: false } } });
        expect(result.violations).toEqual([]);
        expect(wrapper.text().trim().length).toBeGreaterThan(0);
      } finally { wrapper.unmount(); }
    });
  }

  it('associates field labels, help, validation, and invalid state', () => {
    const wrapper = mount(Input, {
      props: {
        id: 'email',
        label: 'Email',
        help: 'Use a work address',
        validation: { state: 'error', message: 'Enter a valid email' },
      },
    });
    const input = wrapper.get('input');
    expect(wrapper.get('label').attributes('for')).toBe('email');
    expect(input.attributes('aria-describedby')).toBe('email-help email-validation');
    expect(input.attributes('aria-errormessage')).toBe('email-validation');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('#email-help').text()).toBe('Use a work address');
    expect(wrapper.get('#email-validation').text()).toBe('Enter a valid email');
  });

  it('associates labels, help, and errors for every native field family', () => {
    const cases = [
      { component: Input, selector: 'input', extra: {} },
      { component: DatePicker, selector: 'input', extra: {} },
      { component: Select, selector: 'select', extra: { options: [{ value: 'pro', label: 'Pro' }] } },
      { component: Textarea, selector: 'textarea', extra: {} },
      { component: Checkbox, selector: 'input', extra: {} },
    ];

    for (const [index, fieldCase] of cases.entries()) {
      const id = `field-${index}`;
      const wrapper = mount(fieldCase.component, {
        props: {
          id,
          label: 'Field label',
          help: 'Field help',
          validation: { state: 'error', message: 'Field error' },
          ...fieldCase.extra,
        },
      });
      const control = wrapper.get(fieldCase.selector);
      expect(wrapper.get('label').attributes('for'), id).toBe(id);
      expect(control.attributes('aria-describedby'), id).toBe(`${id}-help ${id}-validation`);
      expect(control.attributes('aria-errormessage'), id).toBe(`${id}-validation`);
      expect(control.attributes('aria-invalid'), id).toBe('true');
      expect(wrapper.get(`#${id}-help`).text(), id).toBe('Field help');
      expect(wrapper.get(`#${id}-validation`).text(), id).toBe('Field error');
      wrapper.unmount();
    }
  });

  it('uses required announcement, button, tabs, and table semantics', () => {
    const wrapper = mount(AccessibilityShowcase);
    expect(wrapper.get('[data-oods-component="Banner"]').attributes('role')).toBe('alert');
    expect(wrapper.get('[data-oods-component="Button"]').attributes('type')).toBe('button');
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Account sections');
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2);
    expect(wrapper.findAll('[role="tabpanel"]')).toHaveLength(2);
    const checkbox = wrapper.get('#marketing');
    expect((checkbox.element as HTMLInputElement).required).toBe(true);
    expect(wrapper.get('label[for="marketing"] .oods-field-required').text()).toBe('*');
    expect(
      wrapper.get('label[for="marketing"] .oods-field-required').attributes('aria-hidden'),
    ).toBe('true');
    expect(wrapper.get('table caption').text()).toBe('Subscriptions');
    expect(wrapper.findAll('thead th[scope="col"]')).toHaveLength(2);
    expect(wrapper.findAll('tbody td')).toHaveLength(2);
    const rowAction = wrapper.get('tbody td:first-child .oods-table-row-action');
    expect(rowAction.attributes('type')).toBe('button');
    expect(rowAction.text()).toBe('Acme');
    expect(rowAction.attributes('aria-label')).toBeUndefined();
  });

  it('has no automated axe violations for the nondegenerate showcase', async () => {
    const wrapper = mount(AccessibilityShowcase, { attachTo: document.body });
    const result = await axe(wrapper.element, {
      rules: {
        // JSDOM has no canvas/layout engine; visual color is covered by the browser evidence gate.
        'color-contrast': { enabled: false },
      },
    });
    expect(result.violations).toEqual([]);
    wrapper.unmount();
  });
});
