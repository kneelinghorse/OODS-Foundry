import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingAmountInput, BillingIntervalSelector, BillingSummaryBadge } from '../src/index.js';

afterEach(cleanup);

describe('Billable value semantics', () => {
  it('formats a plain monetary field without inventing a billing cadence', () => {
    const { rerender } = render(<BillingSummaryBadge amount={1250} currency="usd" minorUnits={1000} showInterval={false} />);
    expect(screen.getByText('$1.250')).toBeTruthy();
    rerender(<BillingSummaryBadge amount={1250} currency="usd" minorUnits={1000} />);
    expect(screen.getByText('$1.250 · No interval')).toBeTruthy();
  });
  it.each([[1999, 'usd', 100, '$19.99'], [0, 'usd', 100, '$0.00'], [1999, 'jpy', 1, '¥1,999']] as const)('announces minor-unit amount %s with its interval', (amount, currency, minorUnits, text) => {
    const { container } = render(<BillingSummaryBadge amount={amount} currency={currency} minorUnits={minorUnits} interval="monthly" />);
    expect(container.textContent).toBe(`${text} · monthly`);
  });
  it('preserves integer storage, rounds half up, rejects negatives and leaves blank undefined', () => {
    const change = vi.fn();
    render(<BillingAmountInput amount={1234} onChange={change} />);
    const input = screen.getByRole('textbox', { name: 'Billing amount' }) as HTMLInputElement;
    for (const [text, value] of [['19.99', 1999], ['1.005', 101], ['0', 0], ['', undefined]] as const) {
      fireEvent.change(input, { target: { value: text } });
      expect(change).toHaveBeenLastCalledWith(value);
    }
    expect(change).toHaveBeenCalledTimes(4);
    fireEvent.change(input, { target: { value: '-1' } });
    expect(change).toHaveBeenCalledTimes(4);
    expect(input.value).toBe('-1');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = screen.getByRole('alert');
    expect(error.textContent).toBe('Enter a non-negative amount.');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(input.checkValidity()).toBe(false);
  });
  it('emits the selected declared interval as a string update', () => {
    const change = vi.fn();
    render(<BillingIntervalSelector interval="monthly" intervals={['monthly', 'yearly']} onChange={change} />);
    const select = screen.getByRole('combobox', { name: 'Billing interval' }) as HTMLSelectElement;
    expect([...select.options].map(option => [option.value, option.text])).toEqual([['monthly', 'Monthly'], ['yearly', 'Yearly']]);
    fireEvent.change(select, { target: { value: 'yearly' } });
    expect(select.value).toBe('yearly');
    expect(change.mock.calls).toEqual([['yearly']]);
    fireEvent.change(select, { target: { value: 'weekly' } });
    expect(change.mock.calls).toEqual([['yearly']]);
  });
  it('shows invalid intervals without silently selecting a valid value', () => {
    render(<BillingIntervalSelector interval="weekly" intervals={['monthly', 'yearly']} />);
    const select = screen.getByRole('combobox', { name: 'Billing interval' }) as HTMLSelectElement;
    expect(select.value).toBe('weekly');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect([...select.options].filter((option) => !option.disabled).map((option) => option.value)).toEqual(['monthly', 'yearly']);
  });
});
