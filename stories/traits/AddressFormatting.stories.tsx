/**
 * Addressable trait Storybook coverage
 *
 * Visualises how the international formatter renders sample addresses using the
 * UPU S42 templates delivered in Sprint 25. Each scenario highlights raw fields
 * next to the formatted multiline output.
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { normalizeAddress } from '../../src/schemas/address.js';
import type { Address } from '../../src/schemas/address.js';
import { formatAddress } from '../../src/traits/addressable/address-formatter.js';

const SAMPLE_ADDRESSES = {
  US: normalizeAddress({
    organizationName: 'OODS Foundry',
    countryCode: 'US',
    administrativeArea: 'CA',
    locality: 'San Francisco',
    addressLines: ['123 Market St', 'Suite 500'],
    postalCode: '94105',
    formatTemplateKey: 'US',
  }),
  'GB-PAF': normalizeAddress({
    organizationName: 'Assembly Hall',
    countryCode: 'GB',
    administrativeArea: 'Greater London',
    locality: 'London',
    addressLines: ['5 The Strand'],
    dependentLocality: 'Charing Cross',
    postalCode: 'WC2N 5HX',
    formatTemplateKey: 'GB-PAF',
  }),
  JP: normalizeAddress({
    organizationName: 'オッズ研究所',
    countryCode: 'JP',
    administrativeArea: '東京都',
    locality: '渋谷区',
    dependentLocality: '神南',
    addressLines: ['1-19-11'],
    postalCode: '150-0041',
    formatTemplateKey: 'JP',
  }),
  BR: normalizeAddress({
    organizationName: 'Studio Avenida',
    countryCode: 'BR',
    administrativeArea: 'SP',
    locality: 'São Paulo',
    addressLines: ['Av. Paulista, 2200', '11º Andar'],
    postalCode: '01311-300',
    formatTemplateKey: 'BR',
  }),
} as const satisfies Record<string, Address>;

type SampleKey = keyof typeof SAMPLE_ADDRESSES;

interface AddressFormattingPreviewProps {
  templateKey: SampleKey;
  locale: string;
}

function AddressFormattingPreview({ templateKey, locale }: AddressFormattingPreviewProps): JSX.Element {
  const address = SAMPLE_ADDRESSES[templateKey];
  const { lines } = formatAddress(address, { locale });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'var(--cmp-spacing-stack-default, 1rem)',
      }}
    >
      <section
        style={{
          border: '1px solid var(--cmp-border-default, var(--sys-border-subtle))',
          borderRadius: 'var(--cmp-radius-md, 0.75rem)',
          padding: 'var(--cmp-spacing-inset-default, 1rem)',
          background: 'var(--cmp-surface-panel, var(--sys-surface-raised))',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Normalized Fields</h4>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: '0.5rem',
            rowGap: '0.25rem',
            margin: 0,
          }}
        >
          {renderField('Organization', address.organizationName)}
          {renderField('Address Line 1', address.addressLines[0])}
          {renderField('Address Line 2', address.addressLines[1])}
          {renderField('Locality', address.locality)}
          {renderField('Dependent Locality', address.dependentLocality)}
          {renderField('Administrative Area', address.administrativeArea)}
          {renderField('Postal Code', address.postalCode)}
          {renderField('Template Key', address.formatTemplateKey)}
        </dl>
      </section>

      <section
        style={{
          border: '1px solid var(--cmp-border-accent, var(--sys-border-strong))',
          borderRadius: 'var(--cmp-radius-md, 0.75rem)',
          padding: 'var(--cmp-spacing-inset-default, 1rem)',
          background: 'var(--cmp-surface-accent, var(--sys-surface-raised))',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Formatted Output</h4>
        <ol style={{ listStyle: 'decimal', paddingLeft: '1.25rem', margin: 0 }}>
          {lines.map((line) => (
            <li key={line} style={{ marginBottom: '0.25rem', fontFamily: 'var(--cmp-font-mono, monospace)' }}>
              {line}
            </li>
          ))}
        </ol>
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--cmp-text-muted, var(--sys-text-muted))',
          }}
        >
          Locale: {locale}
        </p>
      </section>
    </div>
  );
}

function renderField(label: string, value: string | undefined): JSX.Element {
  return (
    <>
      <dt style={{ fontSize: '0.75rem', color: 'var(--cmp-text-muted, var(--sys-text-muted))' }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 500 }}>{value ?? '—'}</dd>
    </>
  );
}

type Story = StoryObj<AddressFormattingPreviewProps>;

const meta: Meta<AddressFormattingPreviewProps> = {
  title: 'Traits/Addressable/International Formatting',
  component: AddressFormattingPreview,
  args: {
    templateKey: 'US',
    locale: 'en-US',
  },
  argTypes: {
    templateKey: {
      control: 'select',
      options: Object.keys(SAMPLE_ADDRESSES),
    },
  },
};

export default meta;

export const UnitedStates: Story = {
  args: {
    templateKey: 'US',
    locale: 'en-US',
  },
};

export const UnitedKingdom: Story = {
  args: {
    templateKey: 'GB-PAF',
    locale: 'en-GB',
  },
};

export const Japan: Story = {
  args: {
    templateKey: 'JP',
    locale: 'ja-JP',
  },
};

export const Brazil: Story = {
  args: {
    templateKey: 'BR',
    locale: 'pt-BR',
  },
};
