/**
 * s223-m02 (#2527 ruling 11): the Combobox keyboard and pointer contract, key by key, as a person drives it, the same
 * walk as React's combobox.spec.tsx. Each test starts from the documented example's options (Japan disabled) and reads
 * what the screen and the ARIA state say, so a regression in any key, in filtering or in the change event fails here.
 */
import { sharedScenarios } from '@oods/component-contracts';
import userEvent from '@testing-library/user-event';
import { mount, type VueWrapper } from '@vue/test-utils';
import { axe } from 'vitest-axe';
import { defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { Combobox, type ComboboxOption } from '../src/index.js';

const example = sharedScenarios.find((scenario) => scenario.oodsComponentId === 'Combobox')!;
const options = example.props.options as readonly ComboboxOption[];
const mounted: VueWrapper[] = [];
afterEach(() => { mounted.splice(0).forEach((wrapper) => wrapper.unmount()); document.body.innerHTML = ''; });

function setup(props: Record<string, unknown> = {}) {
  const events: Array<[string, string]> = [];
  const Host = defineComponent({
    render: () => h('main', {}, [
      h('button', { type: 'button' }, 'Before'),
      h(Combobox, {
        id: 'country', label: 'Shipping country', options, defaultValue: 'ca', ...props,
        onChange: (value: string) => events.push(['change', value]),
        'onUpdate:modelValue': (value: string) => events.push(['update:modelValue', value]),
      }),
      h('button', { type: 'button' }, 'After'),
    ]),
  });
  const wrapper = mount(Host, { attachTo: document.body });
  mounted.push(wrapper);
  const user = userEvent.setup();
  const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const activeLabel = () => {
    const id = input.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id)?.textContent : null;
  };
  const visibleLabels = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].filter((option) => !option.hidden && !option.closest('[hidden]')).map((option) => option.textContent);
  const changes = () => events.filter(([name]) => name === 'change').map(([, value]) => value);
  const updates = () => events.filter(([name]) => name === 'update:modelValue').map(([, value]) => value);
  const option = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) => element.textContent === label)!;
  return { user, input, activeLabel, visibleLabels, changes, updates, option };
}

describe('Combobox keyboard (WAI-ARIA combobox with a listbox popup)', () => {
  it('Down opens the list at the first option and moves, skipping the disabled one and wrapping', async () => {
    const { user, input, activeLabel } = setup();
    input.focus();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="listbox"]')?.closest('[hidden]')).not.toBeNull();
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="listbox"]')?.closest('[hidden]')).toBeNull();
    expect(activeLabel()).toBe('Australia');
    expect(document.querySelector('[data-active="true"]')?.textContent).toBe('Australia');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('Germany');
    await user.keyboard('{ArrowDown}');
    expect(activeLabel()).toBe('Mexico');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('United States');
    await user.keyboard('{ArrowDown}');
    expect(activeLabel()).toBe('Australia');
    expect(document.activeElement).toBe(input);
  });

  it('Up moves back and wraps; with the list closed it opens the list at the last option', async () => {
    const { user, input, activeLabel } = setup();
    input.focus();
    await user.keyboard('{ArrowUp}');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(activeLabel()).toBe('United States');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(activeLabel()).toBe('Mexico');
    await user.keyboard('{ArrowUp}');
    expect(activeLabel()).toBe('Germany');
    await user.keyboard('{Home}{ArrowUp}');
    expect(activeLabel()).toBe('United States');
  });

  it('Home and End go to the ends of an open list, and move the caret while it is closed', async () => {
    const { user, input, activeLabel } = setup();
    input.focus();
    await user.keyboard('{End}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.selectionStart).toBe('Canada'.length);
    await user.keyboard('{Home}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.selectionStart).toBe(0);
    await user.keyboard('{ArrowDown}{End}');
    expect(activeLabel()).toBe('United States');
    await user.keyboard('{Home}');
    expect(activeLabel()).toBe('Australia');
  });

  it('Enter picks the active option, closes the list and emits change and update:modelValue once', async () => {
    const { user, input, activeLabel, changes, updates } = setup();
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('France');
    await user.keyboard('{Enter}');
    expect(changes()).toEqual(['fr']);
    expect(updates()).toEqual(['fr']);
    expect(input.value).toBe('France');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toBe('France');
    expect(document.querySelector('[aria-selected="true"] .oods-combobox__check svg path')?.getAttribute('d')).toBe('M3.5 8.5l3 3 6-7');
    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    await user.keyboard('{Enter}');
    expect(changes()).toEqual(['fr']);
  });

  it('Enter while an input method composes text picks nothing; the next plain Enter picks', async () => {
    const { user, input, activeLabel, changes } = setup();
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('France');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
    await nextTick();
    expect(changes()).toEqual([]);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Enter}');
    expect(changes()).toEqual(['fr']);
  });

  it('typing filters by a case-insensitive match on the label; an empty result says No matches and picks nothing', async () => {
    const { user, input, visibleLabels, activeLabel, changes } = setup();
    await user.clear(input);
    await user.type(input, 'uNiTeD');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(visibleLabels()).toEqual(['United Kingdom', 'United States']);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('United States');
    // The label contains the text anywhere, not only at its start.
    await user.clear(input);
    await user.type(input, 'KING');
    expect(visibleLabels()).toEqual(['United Kingdom']);
    await user.clear(input);
    await user.type(input, 'zz');
    expect(visibleLabels()).toEqual([]);
    const empty = document.querySelector<HTMLElement>('.oods-combobox__empty')!;
    expect(empty.textContent).toBe('No matches');
    expect(empty.getAttribute('role')).toBe('status');
    expect(empty.closest('[role="option"], [role="listbox"]')).toBeNull();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(changes()).toEqual([]);
    expect(input.value).toBe('zz');
  });

  it('Escape closes the list and keeps the text; a second Escape clears the field and emits an empty value', async () => {
    const { user, input, changes } = setup();
    await user.clear(input);
    await user.type(input, 'ger');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('ger');
    expect(changes()).toEqual([]);
    await user.keyboard('{Escape}');
    expect(input.value).toBe('');
    expect(changes()).toEqual(['']);
    expect(document.querySelector('[aria-selected="true"]')).toBeNull();
    await user.keyboard('{Escape}');
    expect(changes()).toEqual(['']);
  });

  it('Tab closes the list without picking, and leaving the field restores the chosen label', async () => {
    const { user, input, changes } = setup();
    await user.clear(input);
    await user.type(input, 'fr');
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe('country-option-2');
    await user.tab();
    expect(document.activeElement?.textContent).toBe('After');
    await nextTick();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(changes()).toEqual([]);
    expect(input.value).toBe('Canada');
  });

  it('a click opens the list, a click on an option picks it, a disabled option cannot be picked, and an outside click closes it', async () => {
    const { user, input, visibleLabels, option, changes } = setup();
    await user.click(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(visibleLabels()).toHaveLength(8);
    expect(option('Japan').getAttribute('aria-disabled')).toBe('true');
    await user.click(option('Japan'));
    expect(changes()).toEqual([]);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input);
    await user.hover(option('Mexico'));
    expect(input.getAttribute('aria-activedescendant')).toBe('country-option-5');
    await user.click(option('Mexico'));
    expect(changes()).toEqual(['mx']);
    expect(input.value).toBe('Mexico');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input);
    await user.click(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await user.click(document.querySelector('main')!);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(changes()).toEqual(['mx']);
  });

  it('a disabled combobox never opens, and name submits the chosen value rather than its label', async () => {
    const { user, input } = setup({ disabled: true, name: 'country' });
    expect(input.disabled).toBe(true);
    await user.click(input);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="country"]')?.value).toBe('ca');
    expect(input.hasAttribute('name')).toBe(false);
  });

  it('writes the size, the invalid state and its message', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const wrapper = mount(Combobox, { props: { id: `c-${size}`, label: 'Plan', options, size, validation: { state: 'error', message: 'Choose a country' } } });
      expect(wrapper.get('[data-oods-component="Combobox"]').attributes('data-size')).toBe(size);
      const input = wrapper.get('input');
      expect(input.attributes('aria-invalid')).toBe('true');
      expect(input.attributes('aria-describedby')).toBe(`c-${size}-validation`);
      expect(wrapper.get(`#c-${size}-validation`).text()).toBe('Choose a country');
      wrapper.unmount();
    }
  });
});

describe('Combobox accessibility (axe)', () => {
  it('passes axe with the list open, an active option and the chosen check mark', async () => {
    const { user, input } = setup({ help: 'Type to filter. We do not ship to Japan yet.' });
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe('country-option-2');
    const result = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('passes axe with the list open and no matches', async () => {
    const { user, input } = setup();
    await user.clear(input);
    await user.type(input, 'zz');
    expect(document.querySelector('.oods-combobox__empty')?.textContent).toBe('No matches');
    const result = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
