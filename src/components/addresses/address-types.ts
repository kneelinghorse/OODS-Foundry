import { ADDRESS_MAX_LINES } from '@/schemas/address.js';
import { normalizeAddress } from '@/schemas/address.js';
import type { Address, AddressInput } from '@/schemas/address.js';
import type { AddressMetadata } from '@/schemas/address-metadata.js';
import type { AddressableEntry, AddressableEntryInput } from '@/traits/addressable/address-entry.js';

export interface AddressDraft {
  readonly countryCode?: string;
  readonly postalCode?: string;
  readonly administrativeArea?: string;
  readonly locality?: string;
  readonly dependentLocality?: string;
  readonly addressLines: readonly string[];
  readonly organizationName?: string;
  readonly formatTemplateKey?: string;
  readonly languageCode?: string;
}

export interface AddressFormEntry {
  readonly role: string;
  readonly address: AddressDraft;
  readonly metadata?: AddressMetadata;
  readonly isDefault?: boolean;
}

export interface AddressCountryOption {
  readonly countryCode: string;
  readonly templateKey: string;
  readonly label: string;
  readonly description?: string;
}

export function createAddressDraft(input?: Partial<AddressInput>): AddressDraft {
  const addressLines = normalizeLines(input?.addressLines ?? []);
  return {
    countryCode: input?.countryCode?.toUpperCase(),
    postalCode: input?.postalCode,
    administrativeArea: input?.administrativeArea,
    locality: input?.locality,
    dependentLocality: input?.dependentLocality,
    addressLines,
    organizationName: input?.organizationName,
    formatTemplateKey: input?.formatTemplateKey,
    languageCode: input?.languageCode,
  };
}

export function coerceAddressDraft(draft?: AddressDraft | null): AddressDraft {
  if (!draft) {
    return createAddressDraft();
  }

  const normalizedLines = normalizeLines(draft.addressLines ?? []);
  return {
    countryCode: draft.countryCode?.toUpperCase(),
    postalCode: draft.postalCode,
    administrativeArea: draft.administrativeArea,
    locality: draft.locality,
    dependentLocality: draft.dependentLocality,
    addressLines: normalizedLines,
    organizationName: draft.organizationName,
    formatTemplateKey: draft.formatTemplateKey,
    languageCode: draft.languageCode,
  };
}

export function normalizeLines(lines: readonly string[]): string[] {
  const sanitized = lines
    .map((line) => (typeof line === 'string' ? line : ''))
    .slice(0, ADDRESS_MAX_LINES);

  if (sanitized.length === 0) {
    sanitized.push('');
  }

  return sanitized;
}

export function trimAddressLines(lines: readonly string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, ADDRESS_MAX_LINES);
}

export function toAddressFormEntry(entry: AddressableEntry): AddressFormEntry {
  return {
    role: entry.role,
    address: createAddressDraft(entry.address),
    metadata: entry.metadata,
    isDefault: entry.isDefault,
  };
}

export function toAddressableEntryInput(entry: AddressFormEntry): AddressableEntryInput | null {
  const normalized = tryNormalizeDraft(entry.address);
  if (!normalized) {
    return null;
  }

  return {
    role: entry.role,
    address: normalized,
    metadata: entry.metadata,
    isDefault: entry.isDefault,
  };
}

export function tryNormalizeDraft(draft: AddressDraft): Address | null {
  if (!draft.countryCode) {
    return null;
  }

  const normalizedLines = trimAddressLines(draft.addressLines);
  if (normalizedLines.length === 0) {
    return null;
  }

  try {
    return normalizeAddress({
      countryCode: draft.countryCode,
      postalCode: emptyToUndefined(draft.postalCode),
      administrativeArea: emptyToUndefined(draft.administrativeArea),
      locality: emptyToUndefined(draft.locality),
      dependentLocality: emptyToUndefined(draft.dependentLocality),
      addressLines: normalizedLines,
      organizationName: emptyToUndefined(draft.organizationName),
      formatTemplateKey: draft.formatTemplateKey,
      languageCode: emptyToUndefined(draft.languageCode),
    });
  } catch {
    return null;
  }
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
