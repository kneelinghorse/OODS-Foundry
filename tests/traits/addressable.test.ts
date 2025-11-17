import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import AddressableTraitModule, { DEFAULT_ADDRESS_ROLES as DEFAULT_ROLES } from '../../traits/core/Addressable.trait.ts';
import { AddressableTrait } from '@/traits/addressable/addressable-trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'core');
const yamlPath = join(traitDir, 'Addressable.trait.yaml');

const billingAddress = {
  countryCode: 'US',
  postalCode: '94105',
  administrativeArea: 'CA',
  locality: 'San Francisco',
  addressLines: ['123 Market St', 'Suite 500'],
  organizationName: 'OODS Foundry',
  formatTemplateKey: 'US',
};

const shippingAddress = {
  countryCode: 'CA',
  postalCode: 'M5V 2T6',
  administrativeArea: 'ON',
  locality: 'Toronto',
  addressLines: ['480 Front St W', 'Unit 18'],
  formatTemplateKey: 'CA',
};

describe('Addressable trait definition', () => {
  it('parses YAML definition with semantics and view extensions', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;
    expect(def.trait.name).toBe('Addressable');
    expect(def.schema.addresses.description).toContain('Collection of');
    expect(def.view_extensions?.form?.[0]?.component).toBe('AddressEditor');
  });

  it('exports TypeScript definition with defaults and tokens', () => {
    expect(AddressableTraitModule.parameters?.[0]?.default).toEqual(DEFAULT_ROLES);
    expect(AddressableTraitModule.tokens).toHaveProperty('location.address.card.bg');
    expect(AddressableTraitModule.metadata?.owners).toContain('core@oods.systems');
  });

  it('validates parameters through the shared validator', () => {
    const validator = new ParameterValidator();

    const ok = validator.validate('Addressable', {
      roles: ['billing', 'shipping', 'warehouse'],
      defaultRole: 'shipping',
    });
    expect(ok.valid).toBe(true);

    const invalid = validator.validate('Addressable', {
      roles: ['billing'],
      defaultRole: 'shipping',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues[0]?.message).toContain('billing');
  });
});

describe('Addressable trait runtime helper', () => {
  it('manages multi-role addresses with default selection', () => {
    const trait = new AddressableTrait(
      {
        addresses: [
          {
            role: 'billing',
            address: billingAddress,
            isDefault: true,
          },
          {
            role: 'shipping',
            address: shippingAddress,
          },
        ],
      },
      { roles: ['billing', 'shipping'] }
    );

    expect(trait.getDefaultRole()).toBe('billing');
    expect(trait.getAddress('shipping')?.address.countryCode).toBe('CA');
    expect(trait.getAddresses()).toHaveLength(2);
    expect(trait.toSnapshot().addresses.billing).toBeDefined();
  });

  it('updates metadata via setAddress and reassigns defaults when removed', () => {
    const trait = new AddressableTrait({}, { roles: ['billing', 'shipping'] });

    trait.setAddress('billing', billingAddress, {
      isDefault: true,
      metadata: { validationStatus: 'validated', validationProvider: 'google-av' },
    });
    trait.setAddress('shipping', shippingAddress, {
      metadata: { validationStatus: 'unvalidated' },
    });

    expect(trait.getDefaultAddress()?.address.addressLines[0]).toContain('Market');

    const removed = trait.removeAddress('billing');
    expect(removed).toBe(true);
    expect(trait.getDefaultRole()).toBe('shipping');
  });

  it('enforces the allowed roles list unless dynamic roles are enabled', () => {
    const strict = new AddressableTrait({}, { roles: ['billing'] });
    expect(() => strict.setAddress('warehouse', billingAddress)).toThrow(/Role "warehouse"/i);

    const dynamic = new AddressableTrait({}, { roles: ['billing'], allowDynamicRoles: true });
    dynamic.setAddress('warehouse', shippingAddress);
    expect(dynamic.getAddress('warehouse')).not.toBeNull();
  });
});
