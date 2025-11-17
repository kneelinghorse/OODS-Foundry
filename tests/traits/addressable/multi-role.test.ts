import { describe, it, expect } from 'vitest';

import { AddressableTrait } from '@/traits/addressable/addressable-trait.ts';

const BILLING_ADDRESS = {
  countryCode: 'US',
  postalCode: '94107',
  administrativeArea: 'CA',
  locality: 'San Francisco',
  addressLines: ['500 Howard St', 'Suite 350'],
  organizationName: 'OODS Foundry',
};

const SHIPPING_ADDRESS = {
  countryCode: 'CA',
  postalCode: 'M5V 2T6',
  administrativeArea: 'ON',
  locality: 'Toronto',
  addressLines: ['480 Front St W', 'Unit 7'],
};

const WAREHOUSE_ADDRESS = {
  countryCode: 'US',
  postalCode: '97203',
  administrativeArea: 'OR',
  locality: 'Portland',
  addressLines: ['7429 N Curtis Ave'],
};

describe('AddressableTrait multi-role management', () => {
  it('stores role-specific metadata with deterministic ordering', () => {
    const trait = new AddressableTrait({}, { roles: ['billing', 'shipping', 'warehouse'] });

    trait.setAddress('billing', BILLING_ADDRESS, {
      isDefault: true,
      metadata: { validationStatus: 'validated', validationProvider: 'google-av' },
    });
    trait.setAddress('shipping', SHIPPING_ADDRESS, {
      metadata: { validationStatus: 'unvalidated', validationProvider: 'manual-entry' },
    });

    expect(trait.getDefaultRole()).toBe('billing');
    expect(trait.getAddress('shipping')?.metadata?.validationProvider).toBe('manual-entry');
    expect(trait.getAddresses().map((entry) => entry.role)).toEqual(['billing', 'shipping']);
  });

  it('supports bulk setAddresses inputs and role filtering', () => {
    const trait = new AddressableTrait({}, { allowDynamicRoles: true });
    const addressMap = new Map<string, { role: string; address: typeof SHIPPING_ADDRESS; isDefault?: boolean }>();
    addressMap.set('shipping', { role: 'shipping', address: SHIPPING_ADDRESS, isDefault: true });
    addressMap.set('warehouse', { role: 'warehouse', address: WAREHOUSE_ADDRESS });

    trait.setAddresses(addressMap);

    const scoped = trait.getAddresses(['warehouse']);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.role).toBe('warehouse');
    expect(trait.getDefaultAddress()?.role).toBe('shipping');

    const snapshot = trait.toSnapshot();
    expect(Object.keys(snapshot.addresses)).toEqual(['shipping', 'warehouse']);
  });
});
