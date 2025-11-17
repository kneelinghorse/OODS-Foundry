import { normalizeAddress } from '@/schemas/address.js';
import type { Address, AddressInput } from '@/schemas/address.js';
import type { AddressMetadata } from '@/schemas/address-metadata.js';
import type { AddressGeocodeInput } from '@/schemas/address-metadata.js';
import {
  ValidationVerdictSchema,
} from '@/schemas/validation-verdict.js';
import type {
  ValidationVerdict,
  ValidationComponentStatus,
} from '@/schemas/validation-verdict.js';
import { AddressValidationLifecycle } from './validation-lifecycle.js';

export type ComponentValidationResult = ValidationComponentStatus;

export interface ProviderEnrichmentMetadata {
  isResidential?: boolean;
  isBusiness?: boolean;
  isPOBox?: boolean;
  validationFlags?: Record<string, boolean>;
}

export interface ProviderAddressValidationResult {
  readonly provider: string;
  readonly verdict: ValidationVerdict;
  readonly components: readonly ComponentValidationResult[];
  readonly candidate?: Address;
  readonly geocode?: AddressGeocodeInput;
  readonly enrichment?: ProviderEnrichmentMetadata;
  readonly timestamp?: string;
  readonly rawResponse?: unknown;
}

export interface AddressValidationRequest {
  readonly address: Address;
  readonly regionCode?: string;
  readonly languageCode?: string;
  readonly sessionToken?: string;
  readonly previousResponseId?: string;
  readonly signal?: AbortSignal;
}

export interface AddressValidationProvider {
  readonly id: string;
  validate(request: AddressValidationRequest): Promise<ProviderAddressValidationResult>;
}

export interface AddressValidationOutcome {
  readonly metadata: AddressMetadata;
  readonly correctedAddress?: Address;
  readonly verdict: ValidationVerdict;
  readonly components: readonly ComponentValidationResult[];
  readonly provider: string;
  readonly rawResponse?: unknown;
}

export interface ValidateAddressOptions {
  readonly provider?: AddressValidationProvider;
  readonly lifecycle?: AddressValidationLifecycle;
  readonly metadata?: AddressMetadata;
  readonly sessionToken?: string;
  readonly previousResponseId?: string;
  readonly regionCode?: string;
  readonly languageCode?: string;
  readonly signal?: AbortSignal;
}

export type AddressValidationErrorCode =
  | 'missing_provider'
  | 'provider_failed'
  | 'invalid_verdict'
  | 'configuration_error';

export class AddressValidationError extends Error {
  readonly code: AddressValidationErrorCode;

  constructor(message: string, code: AddressValidationErrorCode, cause?: unknown) {
    super(message);
    this.name = 'AddressValidationError';
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

let defaultProvider: AddressValidationProvider | null = null;

export function setDefaultValidationProvider(provider: AddressValidationProvider | null): void {
  defaultProvider = provider;
}

export function getDefaultValidationProvider(): AddressValidationProvider | null {
  return defaultProvider;
}

export async function validateAddress(
  addressInput: AddressInput,
  options: ValidateAddressOptions = {}
): Promise<AddressValidationOutcome> {
  const normalized = normalizeAddress(addressInput);
  const provider = resolveProvider(options.provider);
  const lifecycle = options.lifecycle ?? new AddressValidationLifecycle();
  const request = buildRequest(normalized, options);
  let providerResult: ProviderAddressValidationResult;

  try {
    providerResult = await provider.validate(request);
  } catch (error) {
    throw new AddressValidationError('Address validation provider failed.', 'provider_failed', error);
  }

  const verdict = validateVerdict(providerResult.verdict, provider.id);
  const normalizedResult: ProviderAddressValidationResult = {
    ...providerResult,
    verdict,
    components: providerResult.components,
  };

  const lifecycleResult = lifecycle.apply({
    originalAddress: normalized,
    providerResult: normalizedResult,
    previousMetadata: options.metadata,
  });

  return {
    metadata: lifecycleResult.metadata,
    correctedAddress: lifecycleResult.correctedAddress,
    verdict,
    components: normalizedResult.components,
    provider: normalizedResult.provider,
    rawResponse: normalizedResult.rawResponse,
  };
}

function buildRequest(address: Address, options: ValidateAddressOptions): AddressValidationRequest {
  return {
    address,
    regionCode: options.regionCode ?? address.countryCode,
    languageCode: options.languageCode ?? address.languageCode,
    sessionToken: options.sessionToken,
    previousResponseId: options.previousResponseId,
    signal: options.signal,
  };
}

function resolveProvider(provider?: AddressValidationProvider): AddressValidationProvider {
  if (provider) {
    return provider;
  }
  if (defaultProvider) {
    return defaultProvider;
  }
  throw new AddressValidationError(
    'No address validation provider configured. Pass a provider or call setDefaultValidationProvider().',
    'missing_provider'
  );
}

function validateVerdict(verdict: ValidationVerdict, providerId: string): ValidationVerdict {
  try {
    return ValidationVerdictSchema.parse({
      ...verdict,
      provider: verdict.provider ?? providerId,
    });
  } catch (error) {
    throw new AddressValidationError('Validation provider returned an invalid verdict.', 'invalid_verdict', error);
  }
}
