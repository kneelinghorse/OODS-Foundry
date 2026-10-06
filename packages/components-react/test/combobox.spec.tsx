/* @vitest-environment jsdom */

/**
 * s223-m02 (#2527 ruling 11): the Combobox keyboard and pointer contract, key by key, as a person drives it. Each test
 * starts from the documented example's options (Japan disabled) and reads what the screen and the ARIA state say: the
 * WAI-ARIA combobox pattern is the contract, so a regression in any key, in filtering or in the change event fails here.
 */
import { sharedScenarios } from '@oods/component-contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Combobox, type ComboboxOption, type ComboboxProps } from '../src/index.js';

afterEach(cleanup);

const example = sharedScenarios.find(scenario => scenario.oodsComponentId === 'Combobox')!;
const options = example.props.options as readonly ComboboxOption[];

function setup(props: Partial<ComboboxProps> = {}) {
  const onValueChange = vi.fn();
  const onUpdate = vi.fn();
  const user = userEvent.setup();
  render(
    <main>
      <button type="button">Before</button>
      <Combobox id="country" label="Shipping country" options={options} defaultValue="ca" onValueChange={onValueChange} onUpdate={onUpdate} {...props} />
      <button type="button">After</button>
    </main>
  );
  const input = screen.getByRole('combobox', { name: 'Shipping country' }) as HTMLInputElement;
  const activeLabel = () => {
    const id = input.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id)?.textContent : null;
  };
  const visibleLabels = () => screen.queryAllByRole('option').map(option => option.textContent);
  return { user, input, onValueChange, onUpdate, activeLabel, visibleLabels };
}

describe('Combobox keyboard (WAI-ARIA combobox with a listbox popup)', () => {
  it('Down opens the list at the first option and moves, skipping the disabled one and wrapping', async () => {
    const { user, input, activeLabel } = setup();
    input.focus();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('listbox', { hidden: true }).closest('[hidden]')).not.toBeNull();
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox', { name: 'Shipping country' })).toBeTruthy();
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

  it('Enter picks the active option, closes the list and emits change and update once', async () => {
    const { user, input, onValueChange, onUpdate, activeLabel } = setup();
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('France');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('fr');
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('fr');
    expect(input.value).toBe('France');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    // The chosen option carries aria-selected and shows the check mark; Canada no longer does.
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toBe('France');
    expect(document.querySelector('[aria-selected="true"] .oods-combobox__check svg path')?.getAttribute('d')).toBe('M3.5 8.5l3 3 6-7');
    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    // Enter with the list closed does nothing, so a form around the field can submit.
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('Enter while an input method composes text picks nothing; the next plain Enter picks', async () => {
    const { user, input, onValueChange, activeLabel } = setup();
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('France');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('fr');
  });

  it('typing filters by a case-insensitive match on the label; an empty result says No matches and picks nothing', async () => {
    const { user, input, onValueChange, visibleLabels, activeLabel } = setup();
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
    const empty = screen.getByText('No matches');
    expect(empty.getAttribute('role')).toBe('status');
    expect(empty.closest('[role="option"], [role="listbox"]')).toBeNull();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('zz');
  });

  it('Escape closes the list and keeps the text; a second Escape clears the field and emits an empty value', async () => {
    const { user, input, onValueChange } = setup();
    await user.clear(input);
    await user.type(input, 'ger');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('ger');
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(input.value).toBe('');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('');
    expect(document.querySelector('[aria-selected="true"]')).toBeNull();
    // A third Escape has nothing to clear and emits nothing.
    await user.keyboard('{Escape}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('Tab closes the list without picking, and leaving the field restores the chosen label', async () => {
    const { user, input, onValueChange } = setup();
    await user.clear(input);
    await user.type(input, 'fr');
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe('country-option-2');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('Canada');
  });

  it('a click opens the list, a click on an option picks it, a disabled option cannot be picked, and an outside click closes it', async () => {
    const { user, input, onValueChange, visibleLabels } = setup();
    await user.click(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(visibleLabels()).toHaveLength(8);
    const japan = screen.getByRole('option', { name: 'Japan' });
    expect(japan.getAttribute('aria-disabled')).toBe('true');
    await user.click(japan);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input);
    // Moving the pointer over an option makes it the active one, so one option is ever on the hover fill.
    await user.hover(screen.getByRole('option', { name: 'Mexico' }));
    expect(input.getAttribute('aria-activedescendant')).toBe('country-option-5');
    await user.click(screen.getByRole('option', { name: 'Mexico' }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('mx');
    expect(input.value).toBe('Mexico');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input);
    await user.click(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await user.click(screen.getByRole('main'));
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('a disabled combobox never opens, and name submits the chosen value rather than its label', async () => {
    const disabled = setup({ disabled: true, name: 'country' });
    expect(disabled.input.disabled).toBe(true);
    await disabled.user.click(disabled.input);
    expect(disabled.input.getAttribute('aria-expanded')).toBe('false');
    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"][name="country"]');
    expect(hidden?.value).toBe('ca');
    expect(disabled.input.hasAttribute('name')).toBe(false);
  });

  it('writes the size, the invalid state and its message, and stays one markup across sizes', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const { container, unmount } = render(<Combobox id={`c-${size}`} label="Plan" options={options} size={size} validation={{ state: 'error', message: 'Choose a country' }} />);
      const root = container.querySelector('[data-oods-component="Combobox"]')!;
      expect(root.getAttribute('data-size')).toBe(size);
      const input = container.querySelector('input')!;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(`c-${size}-validation`);
      expect(container.querySelector(`#c-${size}-validation`)?.textContent).toBe('Choose a country');
      unmount();
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
    expect(screen.getByText('No matches')).toBeTruthy();
    const result = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
