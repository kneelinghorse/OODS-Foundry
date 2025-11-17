import { AddressableTrait } from '@/traits/addressable/addressable-trait.js';

const HQ_ADDRESS = {
  countryCode: 'US',
  postalCode: '10001',
  administrativeArea: 'NY',
  locality: 'New York',
  addressLines: ['350 5th Ave'],
  organizationName: 'Atlas Manufacturing',
};

const WAREHOUSE_ADDRESS = {
  countryCode: 'DE',
  postalCode: '20095',
  administrativeArea: 'HH',
  locality: 'Hamburg',
  addressLines: ['Spitalerstraße 12'],
};

const DISTRIBUTION_ADDRESS = {
  countryCode: 'US',
  postalCode: '60607',
  administrativeArea: 'IL',
  locality: 'Chicago',
  addressLines: ['233 S Wacker Dr'],
};

/**
 * Provides a snapshot with office, warehouse, and distribution roles filled via
 * the bulk setAddresses API.
 */
export function buildOrganizationAddresses() {
  const trait = new AddressableTrait({}, { allowDynamicRoles: true });
  const collection = new Map([
    [
      'office',
      {
        role: 'office',
        address: HQ_ADDRESS,
        isDefault: true,
      },
    ],
    ['warehouse', { role: 'warehouse', address: WAREHOUSE_ADDRESS }],
    ['distribution', { role: 'distribution', address: DISTRIBUTION_ADDRESS }],
  ]);

  trait.setAddresses(collection);
  return {
    snapshot: trait.toSnapshot(),
    warehouse: trait.getAddress('warehouse'),
  };
}
