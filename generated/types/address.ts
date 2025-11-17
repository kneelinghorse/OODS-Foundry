/**
 * Canonical Address value object + metadata types for the Addressable trait.
 * Source: src/schemas/address.ts and src/schemas/address-metadata.ts
 */
export interface Address {
  /**
   * ISO 3166-1 alpha-2 country code in uppercase (e.g., "US").
   */
  countryCode: string;
  /**
   * Postal, ZIP, or PIN code supplied by the user or provider.
   */
  postalCode?: string;
  /**
   * Top-level administrative area (state, province, prefecture, region).
   */
  administrativeArea?: string;
  /**
   * Locality / city / town value.
   */
  locality?: string;
  /**
   * Optional dependent locality or neighborhood.
   */
  dependentLocality?: string;
  /**
   * Ordered list of address lines (line1, line2, line3).
   */
  addressLines: readonly [string, ...string[]];
  /**
   * Organization or company name tied to the address.
   */
  organizationName?: string;
  /**
   * UPU S42-style format template key (e.g., "US", "JP", "GB-PAF").
   */
  formatTemplateKey?: string;
  /**
   * ISO 639-1 language hint for localized rendering.
   */
  languageCode?: string;
}

export type AddressValidationStatus = 'unvalidated' | 'validated' | 'corrected' | 'enriched';
export type AddressGeocodePrecision =
  | 'rooftop'
  | 'range_interpolated'
  | 'geometric_center'
  | 'approximate';

export interface AddressGeocode {
  latitude: number;
  longitude: number;
  precision: AddressGeocodePrecision;
  source?: string;
}

export interface AddressMetadata {
  validationStatus: AddressValidationStatus;
  validationTimestamp?: string;
  validationProvider?: string;
  isResidential?: boolean;
  isBusiness?: boolean;
  isPOBox?: boolean;
  validationFlags: Readonly<Record<string, boolean>>;
  correctedAddress?: Address;
  geocode?: AddressGeocode;
}

export interface AddressableEntryDefinition {
  role: string;
  address: Address;
  metadata?: AddressMetadata;
  isDefault: boolean;
  updatedAt: string;
}

export type AddressRoleRecord = Record<string, AddressableEntryDefinition>;
