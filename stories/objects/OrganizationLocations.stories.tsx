import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { AddressDisplay } from '../../src/components/addresses/address-display.js';
import type { AddressableEntry } from '../../src/traits/addressable/address-entry.js';
import { normalizeAddress } from '../../src/schemas/address.js';

const locationEntries: AddressableEntry[] = [
  {
    role: 'headquarters',
    isDefault: true,
    updatedAt: '2025-11-17T19:05:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '94105',
      administrativeArea: 'CA',
      locality: 'San Francisco',
      addressLines: ['500 Howard St', 'Floor 4'],
      formatTemplateKey: 'US',
    }),
    metadata: {
      validationStatus: 'validated',
      validationTimestamp: '2025-11-17T19:05:30Z',
      validationProvider: 'google-av',
      validationFlags: { executiveBriefings: true },
      geocode: {
        latitude: 37.7898,
        longitude: -122.3971,
        precision: 'rooftop',
      },
    },
  },
  {
    role: 'office',
    isDefault: false,
    updatedAt: '2025-11-17T19:07:00Z',
    address: normalizeAddress({
      countryCode: 'GB',
      postalCode: 'EC2A 4NA',
      administrativeArea: 'London',
      locality: 'London',
      addressLines: ['1 Finsbury Ave'],
      formatTemplateKey: 'GB-PAF',
    }),
    metadata: {
      validationStatus: 'enriched',
      validationProvider: 'loqate',
      validationTimestamp: '2025-11-17T19:07:30Z',
      validationFlags: { needsLiftAccess: true },
    },
  },
  {
    role: 'warehouse',
    isDefault: false,
    updatedAt: '2025-11-17T19:08:00Z',
    address: normalizeAddress({
      countryCode: 'NL',
      postalCode: '1014 BA',
      administrativeArea: 'NH',
      locality: 'Amsterdam',
      addressLines: ['Radarweg 29'],
      formatTemplateKey: 'NL',
    }),
    metadata: {
      validationStatus: 'validated',
      validationProvider: 'dpd',
      validationTimestamp: '2025-11-17T19:08:30Z',
      validationFlags: { bondedWarehouse: true },
    },
  },
  {
    role: 'branch',
    isDefault: false,
    updatedAt: '2025-11-17T19:09:00Z',
    address: normalizeAddress({
      countryCode: 'JP',
      postalCode: '150-0001',
      administrativeArea: 'Tokyo',
      locality: 'Shibuya',
      addressLines: ['6-11-1 Jingumae'],
      formatTemplateKey: 'JP',
    }),
    metadata: {
      validationStatus: 'unvalidated',
      validationProvider: 'manual-entry',
      validationTimestamp: '2025-11-17T19:09:30Z',
      validationFlags: { needsFieldSurvey: true },
    },
  },
];

const meta: Meta<typeof AddressDisplay> = {
  title: 'Objects/Organization/OrganizationLocations',
  component: AddressDisplay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Organization detail layout projecting Addressable trait roles (HQ, offices, warehouses).',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AddressDisplay>;

export const DetailLayout: Story = {
  name: 'Main content – Locations matrix',
  render: () => (
    <section style={{ padding: '2rem', background: 'var(--sys-surface, #0f172a)' }}>
      <div style={{ color: 'var(--sys-text-on-fill, #f8fafc)', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.8 }}>Default role: headquarters</p>
        <h2 style={{ margin: '0.25rem 0 0 0' }}>OODS Foundry – Global footprint</h2>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {locationEntries.map((entry) => (
          <AddressDisplay key={entry.role} entry={entry} showMapPreview showRole variant="card" />
        ))}
      </div>
    </section>
  ),
};
