/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { AddressDisplay } from '@/components/addresses/address-display.js';
import type { AddressFormEntry } from '@/components/addresses/address-types.js';
import type { AddressableEntry } from '@/traits/addressable/address-entry.js';
import { normalizeAddress } from '@/schemas/address.js';

const entry: AddressableEntry = {
  role: 'shipping',
  address: normalizeAddress({
    countryCode: 'US',
    postalCode: '94105',
    administrativeArea: 'CA',
    locality: 'San Francisco',
    addressLines: ['500 Howard St', 'Suite 350'],
    organizationName: 'OODS Foundry',
    formatTemplateKey: 'US',
  }),
  metadata: {
    validationStatus: 'validated',
    validationProvider: 'google-av',
    validationTimestamp: '2025-11-17T18:05:00Z',
    geocode: {
      latitude: 37.7898,
      longitude: -122.3971,
      precision: 'rooftop',
    },
    validationFlags: {},
  },
  isDefault: true,
  updatedAt: '2025-11-17T18:05:00Z',
};

describe('AddressDisplay', () => {
  it('renders formatted lines and validation badge', () => {
    render(<AddressDisplay entry={entry} />);
    expect(screen.getByText('500 Howard St')).toBeInTheDocument();
    expect(screen.getByText(/Validated/i)).toBeInTheDocument();
  });

  it('invokes callbacks when action buttons are clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<AddressDisplay entry={entry} onEdit={onEdit} onDelete={onDelete} />);

    screen.getByRole('button', { name: 'Edit' }).click();
    screen.getByRole('button', { name: 'Remove' }).click();

    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('falls back to raw lines when normalization is unavailable', () => {
    const draftEntry: AddressFormEntry = {
      role: 'billing',
      address: {
        addressLines: ['Line 1'],
      },
    };

    render(<AddressDisplay entry={draftEntry} showValidation={false} />);
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
  });
});
