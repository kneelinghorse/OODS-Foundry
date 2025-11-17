import { describe, it, expect } from 'vitest';

import type { Address } from '@/schemas/address.js';
import { normalizeAddressMetadata } from '@/schemas/address-metadata.js';
import type { ValidationVerdict } from '@/schemas/validation-verdict.js';
import { AddressValidationLifecycle } from '@/traits/addressable/validation-lifecycle.js';
import type { ProviderAddressValidationResult } from '@/traits/addressable/validation-service.js';

const BASE_ADDRESS: Address = {
  countryCode: 'US',
  postalCode: '94043',
  administrativeArea: 'CA',
  locality: 'Mountain View',
  addressLines: ['1600 Amphitheatre Parkway'],
};

const BASE_VERDICT: ValidationVerdict = {
  provider: 'stub',
  deliverability: 'deliverable',
  granularity: 'premise',
  addressComplete: true,
  hasInferredComponents: false,
  hasUnconfirmedComponents: false,
  missingComponents: [],
  unconfirmedComponents: [],
  inferredComponents: [],
  componentStatuses: [],
};

function buildResult(
  overrides: Partial<ProviderAddressValidationResult> = {}
): ProviderAddressValidationResult {
  return {
    provider: overrides.provider ?? 'stub',
    verdict: overrides.verdict ?? BASE_VERDICT,
    components: overrides.components ?? [],
    candidate: overrides.candidate,
    geocode: overrides.geocode,
    enrichment: overrides.enrichment,
    timestamp: overrides.timestamp,
    rawResponse: overrides.rawResponse,
  };
}

describe('AddressValidationLifecycle', () => {
  it('promotes lifecycle to validated when provider confirms deliverability', () => {
    const lifecycle = new AddressValidationLifecycle({
      clock: () => '2025-01-15T12:00:00Z',
    });

    const result = lifecycle.apply({
      originalAddress: BASE_ADDRESS,
      providerResult: buildResult(),
    });

    expect(result.metadata.validationStatus).toBe('validated');
    expect(result.metadata.validationProvider).toBe('stub');
    expect(result.metadata.validationTimestamp).toBe('2025-01-15T12:00:00Z');
  });

  it('escalates to corrected when provider supplies a different candidate address', () => {
    const lifecycle = new AddressValidationLifecycle();
    const corrected: Address = {
      ...BASE_ADDRESS,
      postalCode: '94040',
    };

    const result = lifecycle.apply({
      originalAddress: BASE_ADDRESS,
      providerResult: buildResult({
        candidate: corrected,
        components: [
          {
            component: 'postalCode',
            status: 'inferred',
            inputValue: BASE_ADDRESS.postalCode,
            correctedValue: corrected.postalCode,
            messages: [],
          },
        ],
      }),
    });

    expect(result.metadata.validationStatus).toBe('corrected');
    expect(result.correctedAddress?.postalCode).toBe('94040');
  });

  it('promotes to enriched when geocode or enrichment metadata is provided', () => {
    const lifecycle = new AddressValidationLifecycle();

    const result = lifecycle.apply({
      originalAddress: BASE_ADDRESS,
      providerResult: buildResult({
        geocode: {
          latitude: 37.422,
          longitude: -122.084,
          precision: 'rooftop',
          source: 'test',
        },
        enrichment: {
          isResidential: true,
          validationFlags: { 'metadata.uspsCass': true },
        },
      }),
    });

    expect(result.metadata.validationStatus).toBe('enriched');
    expect(result.metadata.geocode?.latitude).toBeCloseTo(37.422);
    expect(result.metadata.isResidential).toBe(true);
    expect(result.metadata.validationFlags['metadata.uspsCass']).toBe(true);
  });

  it('keeps enriched status once achieved, even if later verdict lacks enrichment', () => {
    const lifecycle = new AddressValidationLifecycle();
    const previous = normalizeAddressMetadata({
      validationStatus: 'enriched',
      validationProvider: 'stub',
      validationTimestamp: '2025-01-01T00:00:00Z',
    }).metadata;

    const result = lifecycle.apply({
      originalAddress: BASE_ADDRESS,
      providerResult: buildResult(),
      previousMetadata: previous,
    });

    expect(result.metadata.validationStatus).toBe('enriched');
  });
});
