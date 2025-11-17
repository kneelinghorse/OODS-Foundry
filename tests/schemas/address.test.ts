import { describe, expect, it } from 'vitest';

import { AddressSchema, getAddressLine, normalizeAddress } from '@/schemas/address.ts';
import {
  AddressMetadataSchema,
  ADDRESS_VALIDATION_STATUSES,
  normalizeAddressMetadata,
} from '@/schemas/address-metadata.ts';

const baseAddress = {
  countryCode: 'us',
  postalCode: '94105',
  administrativeArea: 'CA',
  locality: 'San Francisco',
  addressLines: [' 123 Market St ', 'Suite 400'],
  organizationName: 'OODS Foundry',
  formatTemplateKey: 'US',
};

describe('Address schema', () => {
  it('normalizes ISO country codes and trims address lines', () => {
    const result = normalizeAddress(baseAddress);

    expect(result.countryCode).toBe('US');
    expect(result.addressLines).toHaveLength(2);
    expect(result.addressLines[0]).toBe('123 Market St');
    expect(getAddressLine(result, 2)).toBe('Suite 400');
  });

  it('rejects invalid country codes', () => {
    expect(() =>
      AddressSchema.parse({
        ...baseAddress,
        countryCode: 'USA',
      })
    ).toThrow(/countryCode/i);
  });
});

describe('Address metadata schema', () => {
  it('captures validation results with corrected address and geocode info', () => {
    const metadata = AddressMetadataSchema.parse({
      validationStatus: 'validated',
      validationProvider: 'google-av',
      validationTimestamp: '2025-11-17T12:00:00Z',
      validationFlags: {
        hasSpellCorrections: true,
      },
      correctedAddress: baseAddress,
      geocode: {
        latitude: 37.792,
        longitude: -122.394,
        precision: 'rooftop',
      },
    });

    expect(metadata.validationStatus).toBe('validated');
    expect(metadata.validationFlags.hasSpellCorrections).toBe(true);
    expect(metadata.correctedAddress?.countryCode).toBe('US');
    expect(metadata.geocode?.precision).toBe('rooftop');
  });

  it('normalizes corrected address input through helper', () => {
    const target = {
      countryCode: 'jp',
      postalCode: '141-0032',
      locality: 'Shinagawa-ku',
      administrativeArea: 'Tokyo',
      addressLines: ['東京都品川区大崎2-1-1', 'Thinkpark Tower 5F'],
      formatTemplateKey: 'JP',
    };

    const bundle = normalizeAddressMetadata(
      {
        validationStatus: ADDRESS_VALIDATION_STATUSES[2],
        validationFlags: {},
      },
      target
    );

    expect(bundle.metadata.validationStatus).toBe('corrected');
    expect(bundle.metadata.correctedAddress?.countryCode).toBe('JP');
    expect(bundle.address?.addressLines[0]).toContain('大崎');
  });
});
