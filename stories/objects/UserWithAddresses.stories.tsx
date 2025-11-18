import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { AddressDisplay } from '../../src/components/addresses/address-display.js';
import type { AddressableEntry } from '../../src/traits/addressable/address-entry.js';
import { normalizeAddress } from '../../src/schemas/address.js';

const entries: AddressableEntry[] = [
  {
    role: 'home',
    isDefault: true,
    updatedAt: '2025-11-17T17:05:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '60606',
      administrativeArea: 'IL',
      locality: 'Chicago',
      addressLines: ['233 S Wacker Dr', 'Floor 32'],
      formatTemplateKey: 'US',
    }),
    metadata: {
      validationStatus: 'validated',
      validationProvider: 'loqate',
      validationTimestamp: '2025-11-17T17:04:00Z',
      validationFlags: { deliverable: true },
      geocode: {
        latitude: 41.8786,
        longitude: -87.6358,
        precision: 'rooftop',
      },
    },
  },
  {
    role: 'billing',
    isDefault: false,
    updatedAt: '2025-11-17T17:15:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '78205',
      administrativeArea: 'TX',
      locality: 'San Antonio',
      addressLines: ['200 E Market St'],
      formatTemplateKey: 'US',
    }),
    metadata: {
      validationStatus: 'corrected',
      validationProvider: 'google-av',
      validationTimestamp: '2025-11-17T17:16:00Z',
      validationFlags: { normalized: true },
    },
  },
  {
    role: 'shipping',
    isDefault: false,
    updatedAt: '2025-11-17T17:18:00Z',
    address: normalizeAddress({
      countryCode: 'DE',
      postalCode: '20095',
      administrativeArea: 'Hamburg',
      locality: 'Hamburg',
      addressLines: ['Hermannstrasse 13'],
      formatTemplateKey: 'DE',
    }),
    metadata: {
      validationStatus: 'enriched',
      validationProvider: 'dhl-de',
      validationTimestamp: '2025-11-17T17:19:00Z',
      validationFlags: { customsReady: true },
    },
  },
];

const meta: Meta<typeof AddressDisplay> = {
  title: 'Objects/User/UserWithAddresses',
  component: AddressDisplay,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'User profile view demonstrating how Addressable roles are rendered with canonical components.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AddressDisplay>;

export const ProfileAddresses: Story = {
  name: 'Detail – Profile with role badges',
  render: () => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <p style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted, #71717a)', marginBottom: 4 }}>
          Active status ● Address roles: home, billing, shipping
        </p>
        <h2 style={{ margin: 0 }}>Rayna Chen</h2>
        <p style={{ margin: 0, color: 'var(--sys-text-muted, #52525b)' }}>rayna.chen@example.com</p>
      </header>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {entries.map((entry) => (
          <AddressDisplay key={entry.role} entry={entry} showRole showMapPreview />
        ))}
      </div>
    </section>
  ),
};
