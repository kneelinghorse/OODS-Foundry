import { describe, it, expect } from 'vitest';

import { AddressableTrait } from '@/traits/addressable/addressable-trait.ts';

const BILLING_ADDRESS = {
  countryCode: 'US',
  postalCode: '10001',
  administrativeArea: 'NY',
  locality: 'New York',
  addressLines: ['350 5th Ave'],
};

const SHIPPING_ADDRESS = {
  countryCode: 'US',
  postalCode: '30303',
  administrativeArea: 'GA',
  locality: 'Atlanta',
  addressLines: ['600 Peachtree St NE'],
};

describe('AddressableTrait default management', () => {
  it('reassigns default role via setDefaultAddress', () => {
    const trait = new AddressableTrait({
      addresses: [
        { role: 'billing', address: BILLING_ADDRESS, isDefault: true },
        { role: 'shipping', address: SHIPPING_ADDRESS },
      ],
    });

    const defaultEntry = trait.setDefaultAddress('shipping');
    expect(defaultEntry.role).toBe('shipping');
    expect(trait.getDefaultRole()).toBe('shipping');
    expect(trait.getDefaultAddress()?.role).toBe('shipping');
    expect(trait.getDefaultAddress('billing')?.role).toBe('billing');
  });

  it('falls back to remaining role when default is removed', () => {
    const trait = new AddressableTrait();
    trait.setAddress('billing', BILLING_ADDRESS, { isDefault: true });
    trait.setAddress('shipping', SHIPPING_ADDRESS);

    const removed = trait.removeAddress('billing');
    expect(removed).toBe(true);
    expect(trait.getDefaultRole()).toBe('shipping');
    expect(trait.getDefaultAddress()?.role).toBe('shipping');
  });

  it('throws when setting default for an unknown role', () => {
    const trait = new AddressableTrait();
    expect(() => trait.setDefaultAddress('shipping')).toThrow(/role "shipping"/i);
  });
});
