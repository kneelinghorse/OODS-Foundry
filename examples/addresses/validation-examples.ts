import { GoogleAddressValidationAdapter } from '@/traits/addressable/google-av-adapter.js';
import { validateAddress } from '@/traits/addressable/validation-service.js';
import type { AddressInput } from '@/schemas/address.js';
import type { AddressValidationOutcome } from '@/traits/addressable/validation-service.js';

/**
 * Validates an address using Google Address Validation API.
 * Set GOOGLE_ADDRESS_VALIDATION_API_KEY before invoking.
 */
export async function validateShippingAddress(address: AddressInput): Promise<AddressValidationOutcome> {
  const apiKey =
    process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_ADDRESS_VALIDATION_API_KEY environment variable.');
  }

  const provider = new GoogleAddressValidationAdapter({ apiKey });
  return validateAddress(address, { provider });
}

/**
 * Example payload taken from the Addressable trait docs.
 */
export const SAMPLE_ADDRESS: AddressInput = {
  countryCode: 'US',
  administrativeArea: 'CA',
  locality: 'Mountain View',
  postalCode: '94043',
  addressLines: ['1600 Amphitheatre Parkway'],
  organizationName: 'Google LLC',
};
