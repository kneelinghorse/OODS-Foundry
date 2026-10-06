/* @vitest-environment jsdom */
/**
 * s223-m02 (#2527 ruling 10): the SegmentedControl keyboard as a person drives it. The browser owns the radio-group keys,
 * so these prove the markup forms one native group: Tab enters at the checked option and leaves on the next Tab, the
 * arrows move the check and fire the change, wrap at the ends and skip a disabled option. The Chromium walk of the same
 * markup in all three renderers is artifacts/product-reality/sprint-223/m02/segmented-control/keyboard.json.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installCssEscape } from '../../../scripts/product-reality/scenario-interactions.js';
import { SegmentedControl, type SegmentedControlProps } from '../src/index.js';

const options = [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }];
afterEach(cleanup);

function setup(props: Partial<SegmentedControlProps> = {}) {
  installCssEscape(window);
  const onValueChange = vi.fn();
  const onUpdate = vi.fn();
  const onChange = vi.fn();
  const view = render(
    <main>
      <button type="button">Before</button>
      <SegmentedControl id="period" label="Billing period" options={options} defaultValue="quarterly"
        onValueChange={onValueChange} onUpdate={onUpdate} onChange={onChange} {...props} />
      <button type="button">After</button>
    </main>
  );
  const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
  const checked = () => (screen.getAllByRole('radio') as HTMLInputElement[]).filter(input => input.checked).map(input => input.value);
  return { ...view, user: userEvent.setup(), onValueChange, onUpdate, onChange, radio, checked };
}

describe('SegmentedControl keyboard (React)', () => {
  it('is one Tab stop: Tab enters at the checked option, and the next Tab leaves the group', async () => {
    const { user, radio } = setup();
    screen.getByRole('button', { name: 'Before' }).focus();
    await user.tab();
    expect(document.activeElement).toBe(radio('Quarterly'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(radio('Quarterly'));
  });

  it('moves the check with the arrows, wraps at the ends, and reports each choice once', async () => {
    const { user, radio, checked, onValueChange, onUpdate, onChange } = setup();
    radio('Quarterly').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(radio('Yearly'));
    expect(checked()).toEqual(['yearly']);
    expect(onValueChange.mock.calls).toEqual([['yearly']]);
    expect(onUpdate.mock.calls).toEqual([['yearly']]);
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(radio('Monthly'));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(radio('Yearly'));
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowDown}');
    expect(checked()).toEqual(['yearly']);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['yearly', 'monthly', 'yearly', 'quarterly', 'yearly']);
  });

  it('skips a disabled option, and a disabled control is no Tab stop and takes no click', async () => {
    const first = setup({ defaultValue: 'monthly', options: [options[0]!, { ...options[1]!, disabled: true }, options[2]!] });
    first.radio('Monthly').focus();
    await first.user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(first.radio('Yearly'));
    expect(first.onValueChange.mock.calls).toEqual([['yearly']]);
    cleanup();
    const second = setup({ disabled: true });
    expect((screen.getAllByRole('radio') as HTMLInputElement[]).every(input => input.disabled)).toBe(true);
    screen.getByRole('button', { name: 'Before' }).focus();
    await second.user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    await second.user.click(second.radio('Yearly'));
    expect(second.onValueChange).not.toHaveBeenCalled();
    expect(second.checked()).toEqual(['quarterly']);
  });

  it('keeps a controlled choice until value changes, and names the group from its label', async () => {
    const { user, radio, checked, onValueChange, rerender } = setup({ value: 'quarterly', defaultValue: undefined });
    expect(screen.getByRole('radiogroup', { name: 'Billing period' }).getAttribute('aria-labelledby')).toBe('period-label');
    radio('Quarterly').focus();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([['yearly']]);
    expect(checked()).toEqual(['quarterly']);
    rerender(
      <main>
        <SegmentedControl id="period" label="Billing period" options={options} value="yearly" onValueChange={onValueChange} />
      </main>
    );
    expect(checked()).toEqual(['yearly']);
  });

  it('groups by name (the id unless named) and writes the size the stylesheet reads', () => {
    const { container, rerender } = setup();
    expect([...container.querySelectorAll('input')].map(input => input.name)).toEqual(['period', 'period', 'period']);
    expect(container.querySelector('[data-oods-component="SegmentedControl"]')?.getAttribute('data-size')).toBe('md');
    rerender(<SegmentedControl id="period" label="Billing period" options={options} name="billing" size="xs" />);
    expect([...container.querySelectorAll('input')].map(input => input.name)).toEqual(['billing', 'billing', 'billing']);
    expect(container.querySelector('[data-oods-component="SegmentedControl"]')?.getAttribute('data-size')).toBe('xs');
  });
});
