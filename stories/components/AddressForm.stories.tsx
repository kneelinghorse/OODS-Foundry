import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { AddressForm } from '../../src/components/addresses/address-form.js';
import { createAddressDraft, type AddressFormEntry } from '../../src/components/addresses/address-types.js';
import type { ComponentValidationResult } from '../../src/traits/addressable/validation-service.js';

const sampleEntry: AddressFormEntry = {
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
      postalCode: '94105',
      administrativeArea: 'CA',
      locality: 'San Francisco',
      addressLines: ['500 Howard St', 'Suite 350'],
      organizationName: 'OODS Foundry',
      formatTemplateKey: 'US',
    },
    geocode: {
      latitude: 37.7898,
      longitude: -122.3971,
      precision: 'rooftop',
    },
    validationFlags: {},
  },
  isDefault: true,
};

const validationComponents: ComponentValidationResult[] = [
  { component: 'postalCode', status: 'confirmed', messages: [] },
  { component: 'administrativeArea', status: 'confirmed', messages: [] },
  { component: 'locality', status: 'confirmed', messages: [] },
  { component: 'addressLines', status: 'inferred', correctedValue: ['500 Howard St', 'Suite 350'], messages: [] },
];

type Story = StoryObj<typeof AddressForm>;

const meta: Meta<typeof AddressForm> = {
  title: 'Components/Addresses/AddressForm',
  component: AddressForm,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

const Template: Story = {
  render: (args) => {
    const [entry, setEntry] = useState<AddressFormEntry>(args.entry ?? sampleEntry);
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <AddressForm {...args} entry={entry} onEntryChange={setEntry} />
      </div>
    );
  },
};

export const UnitedStates: Story = {
  ...Template,
  args: {
    entry: sampleEntry,
    roles: ['billing', 'shipping', 'warehouse'],
    allowCustomRoles: true,
    validationComponents,
  },
};

export const UnitedKingdom: Story = {
  ...Template,
  args: {
    entry: {
      ...sampleEntry,
      role: 'billing',
      address: createAddressDraft({
        countryCode: 'GB',
        postalCode: 'SW1A 1AA',
        administrativeArea: 'London',
        locality: 'London',
        dependentLocality: 'Westminster',
        addressLines: ['Buckingham Palace'],
        organizationName: 'Crown Estates',
        formatTemplateKey: 'GB-PAF',
      }),
      metadata: {
        validationStatus: 'validated',
        validationProvider: 'loqate',
        validationTimestamp: '2025-11-15T09:30:00Z',
        validationFlags: {},
      },
    },
    roles: ['billing', 'shipping', 'warehouse'],
    allowCustomRoles: false,
  },
};

export const Japan: Story = {
  ...Template,
  args: {
    entry: {
      ...sampleEntry,
      role: 'warehouse',
      address: createAddressDraft({
        countryCode: 'JP',
        postalCode: '150-0041',
        administrativeArea: '東京都',
        locality: '渋谷区',
        dependentLocality: '神南',
        addressLines: ['1-19-11'],
        organizationName: 'オッズ研究所',
        formatTemplateKey: 'JP',
        languageCode: 'ja',
      }),
      metadata: {
        validationStatus: 'enriched',
        validationProvider: 'jp-post',
        validationTimestamp: '2025-11-10T11:00:00Z',
        geocode: {
          latitude: 35.6697,
          longitude: 139.7041,
          precision: 'rooftop',
        },
        validationFlags: { 'metadata.isResidential': true },
      },
    },
    roles: ['billing', 'shipping', 'warehouse'],
    allowCustomRoles: true,
  },
};
