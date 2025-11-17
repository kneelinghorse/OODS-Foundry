import { describe, expect, it } from 'vitest';

import { normalizeAddress } from '@/schemas/address.ts';
import { formatAddress } from '@/traits/addressable/address-formatter.ts';
import { extractComponents } from '@/traits/addressable/component-extractor.ts';
import { AddressableTrait } from '@/traits/addressable/addressable-trait.ts';

const usAddress = normalizeAddress({
  organizationName: 'OODS Foundry',
  countryCode: 'US',
  administrativeArea: 'CA',
  locality: 'San Francisco',
  addressLines: ['123 Market St', 'Suite 500'],
  postalCode: '94105',
  formatTemplateKey: 'US',
});

const jpAddress = normalizeAddress({
  organizationName: 'オッズ研究所',
  countryCode: 'JP',
  administrativeArea: '東京都',
  locality: '渋谷区',
  dependentLocality: '神南',
  addressLines: ['1-19-11'],
  postalCode: '150-0041',
  formatTemplateKey: 'JP',
});

describe('formatAddress', () => {
  it('renders a USPS-compliant multiline address string', () => {
    const result = formatAddress(usAddress);
    expect(result.lines).toEqual([
      'OODS Foundry',
      '123 Market St',
      'Suite 500',
      'San Francisco, CA 94105',
      'United States',
    ]);
    expect(result.components.addressLines).toHaveLength(2);
  });

  it('applies locale aware formatting for Japan with postal marker', () => {
    const result = formatAddress(jpAddress, { locale: 'ja-JP' });
    expect(result.lines[1]).toBe('〒150-0041');
    expect(result.lines[2]).toContain('東京都渋谷区神南');
    expect(result.lines.at(-1)).toBe('日本');
  });
});

describe('AddressableTrait integration', () => {
  it('exposes getFormattedAddress via runtime helper', () => {
    const trait = new AddressableTrait(
      {
        addresses: [
          {
            role: 'shipping',
            address: usAddress,
            isDefault: true,
          },
        ],
      },
      { roles: ['shipping'] }
    );

    const formatted = trait.getFormattedAddress('shipping');
    expect(formatted).toContain('San Francisco, CA 94105');
  });
});

describe('component extraction', () => {
  it('maps formatted output back to structured components', () => {
    const result = formatAddress(usAddress);
    const extracted = extractComponents(result.formatted, { templateKey: 'US' });

    expect(extracted.organizationName).toBe('OODS Foundry');
    expect(extracted.addressLines).toEqual(['123 Market St', 'Suite 500']);
    expect(extracted.locality).toBe('San Francisco');
    expect(extracted.administrativeArea).toBe('CA');
    expect(extracted.postalCode).toBe('94105');
  });

  it('handles localized templates such as Canada with uppercase postal codes', () => {
    const caAddress = normalizeAddress({
      organizationName: 'Example Labs',
      countryCode: 'CA',
      administrativeArea: 'ON',
      locality: 'Toronto',
      addressLines: ['480 Front St W', 'Unit 18'],
      postalCode: 'm5v 2t6',
      formatTemplateKey: 'CA',
    });

    const result = formatAddress(caAddress);
    expect(result.lines.at(-1)).toBe('Canada');
    expect(result.lines.at(-2)).toBe('Toronto, ON  M5V 2T6');

    const extracted = extractComponents(result.formatted, { templateKey: 'CA' });
    expect(extracted.postalCode).toBe('M5V 2T6');
    expect(extracted.organizationName).toBe('Example Labs');
    expect(Array.isArray(extracted.addressLines)).toBe(true);
  });
});
