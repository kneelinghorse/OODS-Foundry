import { AddressableTrait } from '@/traits/addressable/addressable-trait.js';

const HOME_ADDRESS = {
  countryCode: 'US',
  postalCode: '94043',
  administrativeArea: 'CA',
  locality: 'Mountain View',
  addressLines: ['1600 Amphitheatre Parkway'],
};

const SHIPPING_HUB = {
  countryCode: 'US',
  postalCode: '98109',
  administrativeArea: 'WA',
  locality: 'Seattle',
  addressLines: ['410 Terry Ave N'],
};

/**
 * Example user profile demonstrating how to manage multiple address roles.
 */
export function buildMultiRoleUserSnapshot() {
  const trait = new AddressableTrait(
    {
      addresses: [{ role: 'billing', address: HOME_ADDRESS, isDefault: true }],
    },
    {
      roles: ['billing', 'shipping', 'warehouse'],
    }
  );

  trait.setAddress('shipping', SHIPPING_HUB, {
    metadata: { validationStatus: 'validated', validationProvider: 'google-av' },
  });

  // Toggle the default role without re-writing the address payload.
  trait.setDefaultAddress('shipping');

  return trait.toSnapshot();
}
