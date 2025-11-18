import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { AddressDisplay } from '../../src/components/addresses/address-display.js';
import type { AddressableEntry } from '../../src/traits/addressable/address-entry.js';
import { normalizeAddress } from '../../src/schemas/address.js';

const shippingEntry: AddressableEntry = {
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
    validationTimestamp: '2025-11-17T05:12:00Z',
    validationFlags: {},
    geocode: {
      latitude: 37.7898,
      longitude: -122.3971,
      precision: 'rooftop',
    },
  },
  isDefault: true,
  updatedAt: '2025-11-17T05:12:00Z',
};

const warehouseEntry: AddressableEntry = {
  role: 'warehouse',
  address: normalizeAddress({
    countryCode: 'GB',
    postalCode: 'N1 9GU',
    administrativeArea: 'London',
    locality: 'London',
    addressLines: ['38 Wharf Rd'],
    organizationName: 'OODS Fulfilment',
    formatTemplateKey: 'GB-PAF',
  }),
  metadata: {
    validationStatus: 'enriched',
    validationProvider: 'loqate',
    validationTimestamp: '2025-11-15T10:01:00Z',
    validationFlags: { 'metadata.isBusiness': true },
    geocode: {
      latitude: 51.5315,
      longitude: -0.0989,
      precision: 'geometric_center',
    },
  },
  isDefault: false,
  updatedAt: '2025-11-15T10:01:00Z',
};

type Story = StoryObj<typeof AddressDisplay>;

const meta: Meta<typeof AddressDisplay> = {
  title: 'Components/Addresses/AddressDisplay',
  component: AddressDisplay,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const DefaultCard: Story = {
  args: {
    entry: shippingEntry,
    onEdit: () => undefined,
    onDelete: () => undefined,
    onSetDefault: () => undefined,
  },
};

export const InlineVariant: Story = {
  args: {
    entry: warehouseEntry,
    variant: 'inline',
    showMapPreview: false,
    showRole: false,
  },
};

export const WithCustomActions: Story = {
  args: {
    entry: shippingEntry,
    actions: (
      <button type="button" style={{ border: 'none', background: 'transparent', color: 'var(--sys-text-accent, currentColor)' }}>
        View timeline
      </button>
    ),
  },
};
