/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { AddressForm } from '@/components/addresses/address-form.js';
import { createAddressDraft, type AddressFormEntry } from '@/components/addresses/address-types.js';

const baseEntry: AddressFormEntry = {
  role: 'shipping',
  address: createAddressDraft({
    countryCode: 'US',
    postalCode: '94105',
    administrativeArea: 'CA',
    locality: 'San Francisco',
    addressLines: ['500 Howard St', 'Suite 350'],
    organizationName: 'OODS Foundry',
    formatTemplateKey: 'US',
  }),
  metadata: {
    validationStatus: 'corrected',
    validationProvider: 'google-av',
    validationTimestamp: '2025-11-17T18:05:00Z',
    correctedAddress: {
      countryCode: 'US',
      postalCode: '94105-1234',
      administrativeArea: 'CA',
      locality: 'San Francisco',
      addressLines: ['500 Howard Street', 'Suite 350'],
      organizationName: 'OODS Foundry',
      formatTemplateKey: 'US',
    },
    validationFlags: {},
  },
  isDefault: true,
};

describe('AddressForm', () => {
  it('emits updated address when fields change', async () => {
    const spy = vi.fn();
    render(<AddressForm entry={baseEntry} roles={['billing', 'shipping']} onEntryChange={spy} />);

    const inputs = await screen.findAllByRole('textbox');
    const line1 = inputs.find((input) => input.id.includes('line-1'));
    expect(line1).toBeDefined();
    fireEvent.change(line1 as HTMLInputElement, { target: { value: '123 Market St' } });

    expect(spy).toHaveBeenCalled();
    const nextEntry = spy.mock.calls.pop()?.[0];
    expect(nextEntry?.address.addressLines[0]).toBe('123 Market St');
  });

  it('updates country and template when selector changes', async () => {
    const spy = vi.fn();
    render(<AddressForm entry={baseEntry} roles={['billing', 'shipping']} onEntryChange={spy} />);

    const selects = await screen.findAllByRole('combobox');
    const selector = selects.find((element) => element.id.includes('country'));
    expect(selector).toBeDefined();

    fireEvent.change(selector as HTMLSelectElement, {
      target: { value: 'GB-PAF' },
    });

    const nextEntry = spy.mock.calls.pop()?.[0];
    expect(nextEntry?.address.countryCode).toBe('GB');
    expect(nextEntry?.address.formatTemplateKey).toBe('GB-PAF');
  });

  it('surfaces validation corrections from metadata', async () => {
    render(<AddressForm entry={baseEntry} roles={['shipping']} />);

    const suggestions = await screen.findAllByText(/Suggested:/i);
    expect(suggestions.some((element) => element.textContent?.includes('500 Howard Street'))).toBe(true);
  });

  it('calls onValidate with normalized payload when button is pressed', async () => {
    const validate = vi.fn();
    render(
      <AddressForm
        entry={baseEntry}
        roles={['billing', 'shipping']}
        onEntryChange={() => undefined}
        onValidate={validate}
      />
    );

    const button = await screen.findByRole('button', { name: /validate address/i });
    fireEvent.click(button);
    expect(validate).toHaveBeenCalled();
    const [, normalized] = validate.mock.calls[0] ?? [];
    expect(normalized?.countryCode).toBe('US');
  });
});
