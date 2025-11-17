import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  validateAddress,
  setDefaultValidationProvider,
  AddressValidationError,
} from '@/traits/addressable/validation-service.js';
import type {
  AddressValidationProvider,
  AddressValidationRequest,
  ProviderAddressValidationResult,
} from '@/traits/addressable/validation-service.js';
import { AddressValidationLifecycle } from '@/traits/addressable/validation-lifecycle.js';
import { GoogleAddressValidationAdapter } from '@/traits/addressable/google-av-adapter.js';

const BASE_ADDRESS_INPUT = {
  countryCode: 'US',
  postalCode: '94043',
  administrativeArea: 'CA',
  locality: 'Mountain View',
  addressLines: ['1600 Amphitheatre Parkway'],
};

function baseProviderResult(): ProviderAddressValidationResult {
  return {
    provider: 'stub',
    verdict: {
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
    },
    components: [],
  };
}

class StubProvider implements AddressValidationProvider {
  readonly id = 'stub';
  private readonly result: ProviderAddressValidationResult;

  constructor(result: ProviderAddressValidationResult) {
    this.result = result;
  }

  async validate(_request: AddressValidationRequest): Promise<ProviderAddressValidationResult> {
    return this.result;
  }
}

describe('validateAddress', () => {
  beforeEach(() => {
    setDefaultValidationProvider(null);
  });

  it('returns metadata with validated status when provider reports deliverable', async () => {
    const provider = new StubProvider(baseProviderResult());
    const lifecycle = new AddressValidationLifecycle({
      clock: () => '2025-01-20T00:00:00Z',
    });

    const outcome = await validateAddress(BASE_ADDRESS_INPUT, {
      provider,
      lifecycle,
    });

    expect(outcome.provider).toBe('stub');
    expect(outcome.metadata.validationStatus).toBe('validated');
    expect(outcome.metadata.validationTimestamp).toBe('2025-01-20T00:00:00Z');
  });

  it('throws when no provider configured', async () => {
    await expect(validateAddress(BASE_ADDRESS_INPUT)).rejects.toThrow(AddressValidationError);
  });

  it('integrates with Google adapter and propagates enrichment metadata', async () => {
    const fetchMock = vi.fn(async () => {
      const payload = {
        result: {
          verdict: {
            deliverability: 'DELIVERABLE',
            validationGranularity: 'PREMISE',
            addressComplete: true,
            missingComponentTypes: [],
            unconfirmedComponentTypes: [],
            inferredComponentTypes: [],
          },
          address: {
            postalAddress: {
              regionCode: 'US',
              postalCode: '94043',
              administrativeArea: 'CA',
              locality: 'Mountain View',
              addressLines: ['1600 Amphitheatre Parkway'],
              organization: 'Google LLC',
            },
          },
          geocode: {
            location: {
              latitude: 37.422,
              longitude: -122.084,
            },
            placeId: 'place-id',
            locationType: 'ROOFTOP',
          },
          metadata: {
            addressType: 'RESIDENTIAL',
            poBox: false,
          },
        },
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const adapter = new GoogleAddressValidationAdapter({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
    });

    const lifecycle = new AddressValidationLifecycle({
      clock: () => '2025-01-25T00:00:00Z',
    });

    const outcome = await validateAddress(BASE_ADDRESS_INPUT, {
      provider: adapter,
      lifecycle,
    });

    expect(outcome.metadata.validationStatus).toBe('enriched');
    expect(outcome.metadata.isResidential).toBe(true);
    expect(outcome.correctedAddress?.organizationName).toBe('Google LLC');
    expect(outcome.verdict.deliverability).toBe('deliverable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestedUrl, requestInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(requestedUrl.searchParams.get('key')).toBe('test-key');
    expect(requestInit.method).toBe('POST');
  });
});
