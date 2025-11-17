import { z } from 'zod';

/**
 * Maximum number of address lines captured in the canonical value object.
 * Derived from R21.1 research – the majority of global postal systems expose 3 lines.
 */
export const ADDRESS_MAX_LINES = 3;

/**
 * Maximum character length for each address line before UI wrapping is required.
 */
export const ADDRESS_LINE_MAX_LENGTH = 160;

const ISO_COUNTRY_CODE = /^[A-Za-z]{2}$/;
const TEMPLATE_KEY_PATTERN = /^[A-Z0-9_.-]+$/i;

const AddressLine = z
  .string()
  .trim()
  .min(1, 'Address lines must contain meaningful characters.')
  .max(ADDRESS_LINE_MAX_LENGTH);

/**
 * Canonical Address value object used by the Addressable trait.
 *
 * The schema intentionally separates structural components (country, postalCode,
 * administrativeArea, locality) from presentation data (addressLines). Consumers
 * may provide either the 6-field US-style model or richer international inputs.
 */
export const AddressSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .length(2, 'countryCode must be a 2-letter ISO 3166-1 alpha-2 code.')
      .regex(ISO_COUNTRY_CODE, 'countryCode must contain only alphabetic characters.'),
    postalCode: z
      .string()
      .trim()
      .min(1, 'postalCode cannot be empty.')
      .max(32, 'postalCode exceeds maximum length (32 characters).')
      .optional(),
    administrativeArea: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),
    locality: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),
    dependentLocality: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),
    addressLines: z
      .array(AddressLine)
      .min(1, 'At least one address line is required.')
      .max(ADDRESS_MAX_LINES, `Up to ${ADDRESS_MAX_LINES} address lines are supported.`),
    organizationName: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .optional(),
    formatTemplateKey: z
      .string()
      .trim()
      .regex(
        TEMPLATE_KEY_PATTERN,
        'formatTemplateKey accepts alphanumeric characters plus ".", "_" and "-".'
      )
      .min(2)
      .max(32)
      .optional(),
    languageCode: z
      .string()
      .trim()
      .regex(/^[a-z]{2}$/i, 'languageCode must be ISO 639-1 (two letters).')
      .optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    countryCode: value.countryCode.toUpperCase(),
    addressLines: freezeLines(value.addressLines),
  }));

export type Address = z.infer<typeof AddressSchema>;
export type AddressInput = z.input<typeof AddressSchema>;

/**
 * Parse and normalize an input payload into the canonical Address value object.
 */
export function normalizeAddress(input: AddressInput): Address {
  return AddressSchema.parse(input);
}

/**
 * Returns a specific address line using 1-based indexing (line1, line2, line3).
 */
export function getAddressLine(address: Address, line: 1 | 2 | 3): string | undefined {
  return address.addressLines[line - 1];
}

/**
 * Creates a shallow copy of address lines to avoid leaking external references.
 */
function freezeLines(lines: readonly string[]): string[] {
  return [...lines];
}
