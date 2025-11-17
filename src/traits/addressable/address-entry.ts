import { normalizeAddress } from '@/schemas/address.js';
import type { Address, AddressInput } from '@/schemas/address.js';
import { AddressMetadataSchema } from '@/schemas/address-metadata.js';
import type { AddressMetadata, AddressMetadataInput } from '@/schemas/address-metadata.js';
import TimeService from '@/services/time/index.js';

const ROLE_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

export interface AddressableEntry {
  readonly role: string;
  readonly address: Address;
  readonly metadata?: AddressMetadata;
  readonly isDefault: boolean;
  readonly updatedAt: string;
}

export interface AddressableEntryInput {
  readonly role: string;
  readonly address: AddressInput;
  readonly metadata?: AddressMetadataInput;
  readonly isDefault?: boolean;
  readonly updatedAt?: string;
}

export interface CreateAddressableEntryOptions {
  readonly isDefault?: boolean;
  readonly timestamp?: string;
}

export type AddressRoleRecord = Record<string, AddressableEntry>;

/**
 * Normalize a role string into a deterministic, slug-style identifier.
 */
export function normalizeAddressRole(role: string): string {
  if (typeof role !== 'string') {
    throw new TypeError('role must be a string.');
  }

  const trimmed = role.trim();
  if (trimmed.length === 0) {
    throw new Error('role cannot be empty.');
  }

  if (!ROLE_SLUG_PATTERN.test(trimmed)) {
    throw new Error(
      `role "${role}" is invalid. Use lower-case letters, numbers, ".", "_" or "-" only.`
    );
  }

  return trimmed.toLowerCase();
}

/**
 * Produces an immutable AddressableEntry backed by normalized schemas.
 */
export function createAddressableEntry(
  role: string,
  address: AddressInput,
  metadata?: AddressMetadataInput,
  options: CreateAddressableEntryOptions = {}
): AddressableEntry {
  const normalizedRole = normalizeAddressRole(role);
  const normalizedAddress = normalizeAddress(address);
  const normalizedMetadata = metadata ? AddressMetadataSchema.parse(metadata) : undefined;
  const updatedAt =
    options.timestamp ?? TimeService.toIsoString(TimeService.nowSystem());

  return Object.freeze({
    role: normalizedRole,
    address: normalizedAddress,
    metadata: normalizedMetadata,
    isDefault: Boolean(options.isDefault),
    updatedAt,
  });
}

/**
 * Creates a normalized entry from a serialized record.
 */
export function fromAddressableEntry(input: AddressableEntryInput): AddressableEntry {
  return createAddressableEntry(input.role, input.address, input.metadata, {
    isDefault: input.isDefault,
    timestamp: input.updatedAt,
  });
}

/**
 * Replace metadata on an entry with a freshly parsed structure.
 */
export function updateAddressMetadata(
  entry: AddressableEntry,
  metadata: AddressMetadataInput
): AddressableEntry {
  return createAddressableEntry(entry.role, entry.address, metadata, {
    isDefault: entry.isDefault,
    timestamp: TimeService.toIsoString(TimeService.nowSystem()),
  });
}

/**
 * Convert a collection of entries into a serializable record keyed by role.
 */
export function toAddressRoleRecord(entries: Iterable<AddressableEntry>): AddressRoleRecord {
  const record: AddressRoleRecord = {};
  for (const entry of entries) {
    record[entry.role] = entry;
  }
  return record;
}
