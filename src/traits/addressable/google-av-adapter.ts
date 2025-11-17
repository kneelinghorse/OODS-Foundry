import { normalizeAddress } from '@/schemas/address.js';
import type { Address } from '@/schemas/address.js';
import {
  ValidationVerdictSchema,
} from '@/schemas/validation-verdict.js';
import type { ValidationVerdict } from '@/schemas/validation-verdict.js';
import {
  toAddressGeocodeFromGoogle,
  type GoogleGeocodePayload,
} from './geocoder.js';
import {
  AddressValidationError,
} from './validation-service.js';
import type {
  AddressValidationProvider,
  AddressValidationRequest,
  ComponentValidationResult,
  ProviderAddressValidationResult,
  ProviderEnrichmentMetadata,
} from './validation-service.js';

export interface GoogleAddressValidationAdapterOptions {
  readonly apiKey?: string;
  readonly endpoint?: string;
  readonly fieldMask?: string;
  readonly fetchImpl?: typeof fetch;
  readonly enableUspsCass?: boolean;
  readonly defaultRegionCode?: string;
  readonly defaultLanguageCode?: string;
}

const GOOGLE_ENDPOINT = 'https://addressvalidation.googleapis.com/v1:validateAddress';
const DEFAULT_FIELD_MASK =
  'result.verdict,result.address.postalAddress,result.address.addressComponents,result.geocode,result.metadata';

const DELIVERABILITY_MAP: Record<string, ValidationVerdict['deliverability']> = {
  DELIVERABLE: 'deliverable',
  DELIVERABLE_MISSING_UNIT: 'deliverable_missing_unit',
  DELIVERABLE_INCORRECT_UNIT: 'deliverable_incorrect_unit',
  PARTIAL: 'partial',
  UNDELIVERABLE: 'undeliverable',
};

const GRANULARITY_MAP: Record<string, ValidationVerdict['granularity']> = {
  SUB_PREMISE: 'subpremise',
  PREMISE: 'premise',
  ROUTE: 'route',
  LOCALITY: 'locality',
  ADMINISTRATIVE_AREA: 'administrative_area',
  COUNTRY: 'country',
};

const COMPONENT_FIELDS: readonly (keyof Address)[] = [
  'addressLines',
  'organizationName',
  'postalCode',
  'administrativeArea',
  'locality',
  'dependentLocality',
  'countryCode',
  'languageCode',
];

export class GoogleAddressValidationAdapter implements AddressValidationProvider {
  readonly id = 'google-av';
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fieldMask: string;
  private readonly fetchImpl: typeof fetch;
  private readonly enableUspsCass: boolean;
  private readonly defaultRegionCode?: string;
  private readonly defaultLanguageCode?: string;

  constructor(options: GoogleAddressValidationAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') {
      throw new AddressValidationError(
        'A fetch implementation is required for Google Address Validation adapter.',
        'configuration_error'
      );
    }

    this.apiKey =
      options.apiKey ??
      process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY ??
      process.env.GOOGLE_MAPS_API_KEY ??
      '';

    if (!this.apiKey) {
      throw new AddressValidationError(
        'Google Address Validation API key is missing. Provide apiKey or set GOOGLE_ADDRESS_VALIDATION_API_KEY.',
        'configuration_error'
      );
    }

    this.endpoint = options.endpoint ?? GOOGLE_ENDPOINT;
    this.fieldMask = options.fieldMask ?? DEFAULT_FIELD_MASK;
    this.enableUspsCass = options.enableUspsCass ?? true;
    this.defaultRegionCode = options.defaultRegionCode;
    this.defaultLanguageCode = options.defaultLanguageCode;
  }

  async validate(request: AddressValidationRequest): Promise<ProviderAddressValidationResult> {
    const payload = this.buildPayload(request);
    const url = new URL(this.endpoint);
    url.searchParams.set('key', this.apiKey);
    if (this.fieldMask) {
      url.searchParams.set('fields', this.fieldMask);
    }
    url.searchParams.set('alt', 'json');

    const response = await this.fetchImpl(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
      signal: request.signal,
    });

    if (!response.ok) {
      const message = await safeReadText(response);
      throw new AddressValidationError(
        `Google Address Validation API failed with ${response.status}: ${message}`,
        'provider_failed'
      );
    }

    let json: GoogleAddressValidationResponse;
    try {
      json = (await response.json()) as GoogleAddressValidationResponse;
    } catch (error) {
      throw new AddressValidationError('Failed to parse Google Address Validation response.', 'provider_failed', error);
    }

    return this.normalizeResponse(json, request.address);
  }

  private buildPayload(request: AddressValidationRequest): GoogleValidateAddressRequest {
    const address = request.address;
    const regionCode = request.regionCode ?? this.defaultRegionCode ?? address.countryCode;
    const languageCode = request.languageCode ?? this.defaultLanguageCode ?? address.languageCode;
    return {
      address: compact({
        regionCode,
        languageCode,
        postalCode: address.postalCode,
        administrativeArea: address.administrativeArea,
        locality: address.locality,
        sublocality: address.dependentLocality,
        addressLines: address.addressLines,
        organization: address.organizationName,
      }),
      enableUspsCass: this.enableUspsCass,
      previousResponseId: request.previousResponseId,
      sessionToken: request.sessionToken,
    };
  }

  private normalizeResponse(
    response: GoogleAddressValidationResponse,
    originalAddress: Address
  ): ProviderAddressValidationResult {
    const result = response.result;
    if (!result) {
      throw new AddressValidationError('Google Address Validation response missing result payload.', 'provider_failed');
    }

    const candidate = toCandidateAddress(result.address?.postalAddress);
    const verdict = this.toValidationVerdict(result.verdict);
    const componentStatuses = this.buildComponentStatuses(originalAddress, candidate, verdict);
    const geocode = toAddressGeocodeFromGoogle(result.geocode);
    const enrichment = toEnrichmentMetadata(result.metadata);

    const normalizedVerdict: ValidationVerdict = ValidationVerdictSchema.parse({
      ...verdict,
      provider: this.id,
      componentStatuses,
    });

    return {
      provider: this.id,
      verdict: normalizedVerdict,
      components: componentStatuses,
      candidate,
      geocode,
      enrichment,
      rawResponse: response,
    };
  }

  private toValidationVerdict(verdict?: GoogleVerdict): ValidationVerdict {
    const deliverability =
      verdict?.deliverability && DELIVERABILITY_MAP[verdict.deliverability]
        ? DELIVERABILITY_MAP[verdict.deliverability]
        : 'unknown';
    const granularity =
      verdict?.validationGranularity && GRANULARITY_MAP[verdict.validationGranularity]
        ? GRANULARITY_MAP[verdict.validationGranularity]
        : 'unspecified';

    return {
      provider: this.id,
      deliverability,
      granularity,
      addressComplete: verdict?.addressComplete ?? false,
      hasInferredComponents: verdict?.hasInferredComponents ?? false,
      hasUnconfirmedComponents: verdict?.hasUnconfirmedComponents ?? false,
      missingComponents: (verdict?.missingComponentTypes ?? []).map(normalizeComponentType),
      unconfirmedComponents: (verdict?.unconfirmedComponentTypes ?? []).map(normalizeComponentType),
      inferredComponents: (verdict?.inferredComponentTypes ?? []).map(normalizeComponentType),
      componentStatuses: [],
      metadata: verdict
        ? {
            inputGranularity: verdict.inputGranularity,
            validationGranularity: verdict.validationGranularity,
          }
        : undefined,
    };
  }

  private buildComponentStatuses(
    original: Address,
    candidate: Address | undefined,
    verdict: ValidationVerdict
  ): ComponentValidationResult[] {
    const statuses: ComponentValidationResult[] = [];
    const inferredComponents = new Set(verdict.inferredComponents);
    const missingComponents = new Set(verdict.missingComponents);
    const unconfirmedComponents = new Set(verdict.unconfirmedComponents);

    for (const field of COMPONENT_FIELDS) {
      const componentName = field.toString();
      const inputValue = extractValue(original[field]);
      const correctedValue = extractValue(candidate?.[field]);
      const status = resolveComponentStatus(
        componentName,
        {
          inferredComponents,
          missingComponents,
          unconfirmedComponents,
        },
        inputValue,
        correctedValue
      );

      statuses.push({
        component: componentName,
        status,
        inputValue,
        correctedValue,
        messages: [],
      });
    }

    const seen = new Set(statuses.map((component) => component.component));
    for (const component of verdict.missingComponents) {
      if (seen.has(component)) {
        continue;
      }
      statuses.push({
        component,
        status: 'missing',
        messages: [],
      });
      seen.add(component);
    }

    for (const component of verdict.unconfirmedComponents) {
      if (seen.has(component)) {
        continue;
      }
      statuses.push({
        component,
        status: 'unconfirmed',
        messages: [],
      });
      seen.add(component);
    }

    for (const component of verdict.inferredComponents) {
      if (seen.has(component)) {
        continue;
      }
      statuses.push({
        component,
        status: 'inferred',
        messages: [],
      });
      seen.add(component);
    }

    return statuses;
  }
}

function extractValue(value: Address[keyof Address] | undefined): string | string[] | undefined {
  if (Array.isArray(value)) {
    return value.length ? [...value] : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function resolveComponentStatus(
  component: string,
  verdict: {
    readonly inferredComponents: ReadonlySet<string>;
    readonly missingComponents: ReadonlySet<string>;
    readonly unconfirmedComponents: ReadonlySet<string>;
  },
  input?: string | string[],
  corrected?: string | string[]
): ComponentValidationResult['status'] {
  if (verdict.missingComponents.has(component)) {
    return 'missing';
  }
  if (verdict.unconfirmedComponents.has(component)) {
    return 'unconfirmed';
  }
  if (verdict.inferredComponents.has(component)) {
    return 'inferred';
  }
  if (corrected && !valuesEqual(input, corrected)) {
    return 'inferred';
  }
  return 'confirmed';
}

function valuesEqual(
  a?: string | string[],
  b?: string | string[]
): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const arrayA = Array.isArray(a) ? a : a ? [a] : [];
    const arrayB = Array.isArray(b) ? b : b ? [b] : [];
    if (arrayA.length !== arrayB.length) {
      return false;
    }
    return arrayA.every((value, index) => value === arrayB[index]);
  }

  return a === b;
}

function normalizeComponentType(value: string): string {
  return camelCase(value);
}

function compact<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined && value !== null);
  return Object.fromEntries(entries) as T;
}

function safeReadText(response: Response): Promise<string> {
  return response
    .text()
    .then((text) => text || response.statusText)
    .catch(() => response.statusText);
}

function toCandidateAddress(postal?: GooglePostalAddress | null): Address | undefined {
  if (!postal?.regionCode || !postal.addressLines || postal.addressLines.length === 0) {
    return undefined;
  }

  const addressLines = [...postal.addressLines];
  const input = compact({
    countryCode: postal.regionCode,
    postalCode: postal.postalCode,
    administrativeArea: postal.administrativeArea,
    locality: postal.locality ?? postal.sublocality,
    dependentLocality: postal.sublocality,
    addressLines,
    organizationName: postal.organization,
    languageCode: postal.languageCode,
  });

  try {
    return normalizeAddress(input);
  } catch {
    return undefined;
  }
}

function toEnrichmentMetadata(metadata?: GoogleAddressMetadata | null): ProviderEnrichmentMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const flags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'boolean') {
      flags[`metadata.${camelCase(key)}`] = value;
    }
  }

  const enrichment: ProviderEnrichmentMetadata = {};
  if (metadata.addressType) {
    const normalized = metadata.addressType.toLowerCase();
    if (normalized.includes('residential')) {
      enrichment.isResidential = true;
      enrichment.isBusiness = false;
    } else if (normalized.includes('business') || normalized.includes('commercial')) {
      enrichment.isBusiness = true;
      enrichment.isResidential = false;
    }
  }

  if (metadata.residential === true) {
    enrichment.isResidential = true;
  } else if (metadata.residential === false && enrichment.isResidential === undefined) {
    enrichment.isResidential = false;
  }

  if (metadata.business === true) {
    enrichment.isBusiness = true;
  } else if (metadata.business === false && enrichment.isBusiness === undefined) {
    enrichment.isBusiness = false;
  }

  if (metadata.poBox === true || metadata.poBoxIndicator === true) {
    enrichment.isPOBox = true;
  } else if (metadata.poBox === false && enrichment.isPOBox === undefined) {
    enrichment.isPOBox = false;
  }

  if (Object.keys(flags).length > 0) {
    enrichment.validationFlags = flags;
  }

  return Object.keys(enrichment).length > 0 ? enrichment : undefined;
}

function camelCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join('');
}

interface GoogleValidateAddressRequest {
  readonly address: GooglePostalAddressInput;
  readonly enableUspsCass?: boolean;
  readonly previousResponseId?: string;
  readonly sessionToken?: string;
}

interface GooglePostalAddressInput {
  readonly regionCode: string;
  readonly languageCode?: string;
  readonly postalCode?: string;
  readonly administrativeArea?: string;
  readonly locality?: string;
  readonly sublocality?: string;
  readonly addressLines: readonly string[];
  readonly organization?: string;
}

interface GoogleAddressValidationResponse {
  readonly responseId?: string;
  readonly result?: {
    readonly verdict?: GoogleVerdict;
    readonly address?: {
      readonly postalAddress?: GooglePostalAddress;
    };
    readonly geocode?: GoogleGeocodePayload;
    readonly metadata?: GoogleAddressMetadata;
  };
}

interface GoogleVerdict {
  readonly inputGranularity?: string;
  readonly validationGranularity?: string;
  readonly deliverability?: string;
  readonly addressComplete?: boolean;
  readonly hasInferredComponents?: boolean;
  readonly hasUnconfirmedComponents?: boolean;
  readonly missingComponentTypes?: readonly string[];
  readonly unconfirmedComponentTypes?: readonly string[];
  readonly inferredComponentTypes?: readonly string[];
}

interface GooglePostalAddress {
  readonly regionCode?: string;
  readonly languageCode?: string;
  readonly postalCode?: string;
  readonly administrativeArea?: string;
  readonly locality?: string;
  readonly sublocality?: string;
  readonly addressLines?: readonly string[];
  readonly organization?: string;
}

interface GoogleAddressMetadata {
  readonly addressType?: string;
  readonly business?: boolean;
  readonly residential?: boolean;
  readonly poBox?: boolean;
  readonly poBoxIndicator?: boolean;
  readonly [key: string]: unknown;
}
