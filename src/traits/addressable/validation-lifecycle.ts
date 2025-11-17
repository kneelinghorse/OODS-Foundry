import type { Address } from '@/schemas/address.js';
import {
  normalizeAddressMetadata,
} from '@/schemas/address-metadata.js';
import type {
  AddressMetadata,
  AddressValidationStatus,
  AddressGeocodeInput,
} from '@/schemas/address-metadata.js';
import TimeService from '@/services/time/index.js';
import type { ProviderAddressValidationResult } from './validation-service.js';

export interface AddressValidationLifecycleOptions {
  readonly clock?: () => string;
}

export interface LifecycleComputationInput {
  readonly originalAddress: Address;
  readonly providerResult: ProviderAddressValidationResult;
  readonly previousMetadata?: AddressMetadata;
}

export interface LifecycleComputationOutput {
  readonly metadata: AddressMetadata;
  readonly correctedAddress?: Address;
}

const CORRECTED_STATUSES = new Set<AddressValidationStatus>(['corrected', 'enriched']);
const ENRICHED_STATUSES = new Set<AddressValidationStatus>(['enriched']);
const DELIVERABLE_STATES = new Set(['deliverable', 'deliverable_missing_unit', 'deliverable_incorrect_unit', 'partial']);

/**
 * Computes lifecycle transitions for Address metadata as validation providers emit verdicts.
 * Ensures the lifecycle always advances monotonically from unvalidated→validated→corrected→enriched.
 */
export class AddressValidationLifecycle {
  private readonly clock: () => string;

  constructor(options: AddressValidationLifecycleOptions = {}) {
    this.clock = options.clock ?? (() => TimeService.toIsoString(TimeService.nowSystem()));
  }

  apply(input: LifecycleComputationInput): LifecycleComputationOutput {
    const { providerResult, originalAddress, previousMetadata } = input;
    const status = this.deriveStatus(originalAddress, providerResult, previousMetadata?.validationStatus);
    const timestamp = providerResult.timestamp ?? this.clock();
    const correctedAddress = providerResult.candidate ?? previousMetadata?.correctedAddress;
    const geocode: AddressGeocodeInput | undefined =
      providerResult.geocode ?? previousMetadata?.geocode;

    const metadataBundle = normalizeAddressMetadata(
      {
        validationStatus: status,
        validationProvider: providerResult.provider,
        validationTimestamp: timestamp,
        isResidential: this.resolveFlag('isResidential', providerResult, previousMetadata),
        isBusiness: this.resolveFlag('isBusiness', providerResult, previousMetadata),
        isPOBox: this.resolveFlag('isPOBox', providerResult, previousMetadata),
        validationFlags: this.mergeValidationFlags(providerResult, previousMetadata),
        correctedAddress,
        geocode,
      },
      correctedAddress
    );

    return {
      metadata: metadataBundle.metadata,
      correctedAddress: metadataBundle.address ?? correctedAddress ?? undefined,
    };
  }

  private deriveStatus(
    originalAddress: Address,
    result: ProviderAddressValidationResult,
    previous?: AddressValidationStatus
  ): AddressValidationStatus {
    if (previous && ENRICHED_STATUSES.has(previous)) {
      return previous;
    }

    if (this.hasEnrichment(result)) {
      return 'enriched';
    }

    if (this.hasCorrections(originalAddress, result, previous)) {
      return 'corrected';
    }

    if (DELIVERABLE_STATES.has(result.verdict.deliverability) || result.verdict.addressComplete) {
      return 'validated';
    }

    return previous ?? 'unvalidated';
  }

  private hasCorrections(
    original: Address,
    result: ProviderAddressValidationResult,
    previous?: AddressValidationStatus
  ): boolean {
    if (previous && CORRECTED_STATUSES.has(previous)) {
      return true;
    }

    if (result.candidate && !addressesEqual(original, result.candidate)) {
      return true;
    }

    return result.components.some((component) => Boolean(component.correctedValue));
  }

  private hasEnrichment(result: ProviderAddressValidationResult): boolean {
    if (result.geocode) {
      return true;
    }

    const enrichment = result.enrichment;
    if (!enrichment) {
      return false;
    }

    return (
      enrichment.isBusiness !== undefined ||
      enrichment.isResidential !== undefined ||
      enrichment.isPOBox !== undefined ||
      (enrichment.validationFlags !== undefined &&
        Object.keys(enrichment.validationFlags).length > 0)
    );
  }

  private resolveFlag(
    flag: 'isResidential' | 'isBusiness' | 'isPOBox',
    result: ProviderAddressValidationResult,
    previous?: AddressMetadata
  ): boolean | undefined {
    const enrichment = result.enrichment;
    if (enrichment && enrichment[flag] !== undefined) {
      return enrichment[flag];
    }
    return previous ? previous[flag] : undefined;
  }

  private mergeValidationFlags(
    result: ProviderAddressValidationResult,
    previous?: AddressMetadata
  ): Record<string, boolean> {
    const base = previous?.validationFlags ?? {};
    const incoming = result.enrichment?.validationFlags ?? {};
    return {
      ...base,
      ...incoming,
    };
  }
}

function addressesEqual(a: Address, b: Address | undefined | null): boolean {
  if (!b) {
    return false;
  }

  return JSON.stringify(a) === JSON.stringify(b);
}
