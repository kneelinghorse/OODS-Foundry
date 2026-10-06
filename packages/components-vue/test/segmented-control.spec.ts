/**
 * s223-m02 (#2527 ruling 10): the SegmentedControl keyboard as a person drives it, the same walk as React's
 * segmented-control.spec.tsx. The browser owns the radio-group keys, so these prove the markup forms one native group:
 * Tab enters at the checked option and leaves on the next Tab, the arrows move the check and emit the change, wrap at
 * the ends and skip a disabled option. The Chromium walk of the same markup in all three renderers is
 * artifacts/product-reality/sprint-223/m02/segmented-control/keyboard.json.
 */
import userEvent from '@testing-library/user-event';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { installCssEscape } from '../../../scripts/product-reality/scenario-interactions.js';
import { SegmentedControl } from '../src/index.js';

const options = [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }];
const mounted: VueWrapper[] = [];
afterEach(() => { mounted.splice(0).forEach((wrapper) => wrapper.unmount()); document.body.innerHTML = ''; });

function setup(props: Record<string, unknown> = {}) {
  installCssEscape(window);
  const events: Array<[string, string]> = [];
  const Host = defineComponent({
    render: () => h('main', {}, [
      h('button', { type: 'button' }, 'Before'),
      h(SegmentedControl, {
        id: 'period', label: 'Billing period', options, defaultValue: 'quarterly', ...props,
        onChange: (value: string) => events.push(['change', value]),
        'onUpdate:modelValue': (value: string) => events.push(['update:modelValue', value]),
      }),
      h('button', { type: 'button' }, 'After'),
    ]),
  });
  const wrapper = mount(Host, { attachTo: document.body });
  mounted.push(wrapper);
  const radio = (label: string) => [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    .find((input) => input.labels?.[0]?.textContent === label)!;
  const checked = () => [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter((input) => input.checked).map((input) => input.value);
  const button = (text: string) => [...document.querySelectorAll('button')].find((element) => element.textContent === text)!;
  return { wrapper, events, radio, checked, button, user: userEvent.setup() };
}

describe('SegmentedControl keyboard (Vue)', () => {
  it('is one Tab stop: Tab enters at the checked option, and the next Tab leaves the group', async () => {
    const { user, radio, button } = setup();
    button('Before').focus();
    await user.tab();
    expect(document.activeElement).toBe(radio('Quarterly'));
    await user.tab();
    expect(document.activeElement).toBe(button('After'));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(radio('Quarterly'));
  });

  it('moves the check with the arrows, wraps at the ends, and emits each choice once', async () => {
    const { user, radio, checked, events } = setup();
    radio('Quarterly').focus();
    await user.keyboard('{ArrowRight}');
    await nextTick();
    expect(document.activeElement).toBe(radio('Yearly'));
    expect(checked()).toEqual(['yearly']);
    expect(events).toEqual([['update:modelValue', 'yearly'], ['change', 'yearly']]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(radio('Monthly'));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(radio('Yearly'));
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowDown}');
    await nextTick();
    expect(checked()).toEqual(['yearly']);
    expect(events.filter(([name]) => name === 'change').map(([, value]) => value)).toEqual(['yearly', 'monthly', 'yearly', 'quarterly', 'yearly']);
  });

  it('skips a disabled option, and a disabled control is no Tab stop and takes no click', async () => {
    const first = setup({ defaultValue: 'monthly', options: [options[0], { ...options[1], disabled: true }, options[2]] });
    first.radio('Monthly').focus();
    await first.user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(first.radio('Yearly'));
    expect(first.events.filter(([name]) => name === 'change')).toEqual([['change', 'yearly']]);
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = '';
    const second = setup({ disabled: true });
    expect([...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((input) => input.disabled)).toBe(true);
    second.button('Before').focus();
    await second.user.tab();
    expect(document.activeElement).toBe(second.button('After'));
    await second.user.click(second.radio('Yearly'));
    expect(second.events).toEqual([]);
    expect(second.checked()).toEqual(['quarterly']);
  });

  it('follows modelValue, and names the group from its label', async () => {
    const wrapper = mount(SegmentedControl, { attachTo: document.body, props: { id: 'period', label: 'Billing period', options, modelValue: 'quarterly' } });
    mounted.push(wrapper);
    const group = wrapper.get('[role="radiogroup"]');
    expect(group.attributes('aria-labelledby')).toBe('period-label');
    expect(wrapper.get('#period-label').text()).toBe('Billing period');
    await wrapper.setProps({ modelValue: 'monthly' });
    expect(wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).checked)).toEqual([true, false, false]);
  });

  it('groups by name (the id unless named) and writes the size the stylesheet reads', async () => {
    const wrapper = mount(SegmentedControl, { props: { id: 'period', label: 'Billing period', options } });
    mounted.push(wrapper);
    expect(wrapper.findAll('input').map((input) => input.attributes('name'))).toEqual(['period', 'period', 'period']);
    expect(wrapper.attributes('data-size')).toBe('md');
    await wrapper.setProps({ name: 'billing', size: 'xs' });
    expect(wrapper.findAll('input').map((input) => input.attributes('name'))).toEqual(['billing', 'billing', 'billing']);
    expect(wrapper.attributes('data-size')).toBe('xs');
  });
});
