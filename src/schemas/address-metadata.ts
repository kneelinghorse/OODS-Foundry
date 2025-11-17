import { z } from 'zod';

import { AddressSchema } from './address.js';
import type { Address, AddressInput } from './address.js';

export const ADDRESS_VALIDATION_STATUSES = ['unvalidated', 'validated', 'corrected', 'enriched'] as const;
export type AddressValidationStatus = (typeof ADDRESS_VALIDATION_STATUSES)[number];

export const GEOCODE_PRECISIONS = [
  'rooftop',
  'range_interpolated',
  'geometric_center',
  'approximate',
] as const;
export type GeocodePrecision = (typeof GEOCODE_PRECISIONS)[number];

const GeocodeSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precision: z.enum(GEOCODE_PRECISIONS).default('approximate'),
    source: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .optional(),
  })
  .strict();

export type AddressGeocode = z.infer<typeof GeocodeSchema>;
export type AddressGeocodeInput = z.input<typeof GeocodeSchema>;

/**
 * Metadata emitted by validation/enrichment providers for an address.
 * Encodes lifecycle state, derived attributes, and optional corrected forms.
 */
export const AddressMetadataSchema = z
  .object({
    validationStatus: z.enum(ADDRESS_VALIDATION_STATUSES).default('unvalidated'),
    validationTimestamp: z.string().datetime().optional(),
    validationProvider: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .optional(),
    isResidential: z.boolean().optional(),
    isBusiness: z.boolean().optional(),
    isPOBox: z.boolean().optional(),
    validationFlags: z
      .record(z.string(), z.boolean())
      .default({})
      .transform((flags) => Object.freeze({ ...flags })),
    correctedAddress: AddressSchema.optional(),
    geocode: GeocodeSchema.optional(),
  })
  .strict();

export type AddressMetadata = z.infer<typeof AddressMetadataSchema>;
export type AddressMetadataInput = z.input<typeof AddressMetadataSchema>;

export interface AddressableMetadataBundle {
  readonly metadata: AddressMetadata;
  readonly address?: Address;
}

export function normalizeAddressMetadata(
  input: AddressMetadataInput,
  correctedAddress?: AddressInput
): AddressableMetadataBundle {
  const metadata = AddressMetadataSchema.parse({
    ...input,
    correctedAddress: correctedAddress ? AddressSchema.parse(correctedAddress) : input.correctedAddress,
  });

  return {
    metadata,
    address: metadata.correctedAddress,
  };
}
