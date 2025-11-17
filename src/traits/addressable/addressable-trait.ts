import {
  normalizeAddressRole,
  createAddressableEntry,
  fromAddressableEntry,
  toAddressRoleRecord,
} from './address-entry.js';
import type {
  AddressableEntry,
  AddressableEntryInput,
  AddressRoleRecord,
  CreateAddressableEntryOptions,
} from './address-entry.js';
import type { AddressInput } from '@/schemas/address.js';
import type { AddressMetadataInput } from '@/schemas/address-metadata.js';
import TimeService from '@/services/time/index.js';
import {
  formatAddress as formatAddressValue,
} from './address-formatter.js';
import type {
  FormatAddressOptions,
  FormatAddressResult,
} from './address-formatter.js';

export interface AddressableTraitOptions {
  readonly roles?: readonly string[];
  readonly defaultRole?: string;
  readonly allowDynamicRoles?: boolean;
  readonly clock?: () => string;
}

export interface AddressableTraitState {
  readonly addresses?: AddressCollectionInput;
  readonly defaultRole?: string;
}

export interface AddressableSnapshot {
  readonly addresses: AddressRoleRecord;
  readonly defaultRole?: string;
}

export interface SetAddressOptions extends Omit<CreateAddressableEntryOptions, 'timestamp'> {
  readonly metadata?: AddressMetadataInput;
}

type AddressCollectionInput =
  | AddressableEntryInput[]
  | AddressRoleRecord
  | Map<string, AddressableEntryInput>
  | undefined;

export const DEFAULT_ADDRESS_ROLES = ['billing', 'shipping'] as const;

/**
 * Runtime helper managing Addressable trait data in memory.
 * Provides deterministic get/set/remove operations with role guardrails.
 */
export class AddressableTrait {
  private readonly allowDynamicRoles: boolean;
  private readonly clock: () => string;
  private readonly roleOrder = new Map<string, number>();
  private readonly entries = new Map<string, AddressableEntry>();
  private defaultRole?: string;

  constructor(state: AddressableTraitState = {}, options: AddressableTraitOptions = {}) {
    const roles = options.roles ?? DEFAULT_ADDRESS_ROLES;
    roles.forEach((role, index) => {
      const normalized = normalizeAddressRole(role);
      this.roleOrder.set(normalized, index);
    });

    this.allowDynamicRoles = options.allowDynamicRoles ?? false;
    const defaultClock = () => TimeService.toIsoString(TimeService.nowSystem());
    this.clock = options.clock ?? defaultClock;
    this.defaultRole = state.defaultRole
      ? normalizeAddressRole(state.defaultRole)
      : options.defaultRole
        ? normalizeAddressRole(options.defaultRole)
        : undefined;

    this.ingestAddresses(state.addresses);
    this.ensureDefaultRole();
  }

  /**
  * Returns the Addressable entry for a specific role (or default role if omitted).
  */
  getAddress(role?: string): AddressableEntry | null {
    if (role) {
      const normalized = normalizeAddressRole(role);
      return this.entries.get(normalized) ?? null;
    }

    const fallback = this.defaultRole
      ? this.entries.get(this.defaultRole)
      : this.entries.values().next().value;
    return fallback ?? null;
  }

  getDefaultRole(): string | null {
    return this.defaultRole ?? null;
  }

  getDefaultAddress(): AddressableEntry | null {
    return this.defaultRole ? this.getAddress(this.defaultRole) : this.getAddress();
  }

  getAddresses(): AddressableEntry[] {
    return this.sortEntries();
  }

  /**
   * Adds or replaces an address for the provided role.
   */
  setAddress(role: string, address: AddressInput, options: SetAddressOptions = {}): AddressableEntry {
    const normalizedRole = this.assertRoleAllowed(role);
    const entry = createAddressableEntry(normalizedRole, address, options.metadata, {
      isDefault: options.isDefault,
      timestamp: this.clock(),
    });

    this.entries.set(normalizedRole, entry);
    this.updateDefaultRole(entry);
    return entry;
  }

  /**
   * Removes an address role; returns true when a role was present.
   */
  removeAddress(role: string): boolean {
    const normalized = normalizeAddressRole(role);
    const removed = this.entries.delete(normalized);

    if (!removed) {
      return false;
    }

    if (this.defaultRole === normalized) {
      this.defaultRole = this.entries.keys().next().value;
    }

    return true;
  }

  /**
   * Serialize the current state for persistence or composition.
   */
  toSnapshot(): AddressableSnapshot {
    return {
      addresses: toAddressRoleRecord(this.entries.values()),
      defaultRole: this.defaultRole,
    };
  }

  /**
   * Format the address for the requested role using the UPU S42 template.
   */
  formatAddress(role?: string, options?: FormatAddressOptions): FormatAddressResult | null {
    const entry = this.getAddress(role);
    if (!entry) {
      return null;
    }
    return formatAddressValue(entry.address, options);
  }

  /**
   * Convenience method returning the formatted address string (lines joined by newline).
   */
  getFormattedAddress(role?: string, options?: FormatAddressOptions): string | null {
    const result = this.formatAddress(role, options);
    return result?.formatted ?? null;
  }

  private ingestAddresses(addresses: AddressCollectionInput): void {
    if (!addresses) {
      return;
    }

    if (Array.isArray(addresses)) {
      addresses.forEach((entry) => this.insertEntry(entry));
      return;
    }

    if (addresses instanceof Map) {
      addresses.forEach((entry) => this.insertEntry(entry));
      return;
    }

    Object.values(addresses).forEach((entry) => this.insertEntry(entry));
  }

  private insertEntry(entry: AddressableEntryInput | AddressableEntry): void {
    const normalizedRole = this.assertRoleAllowed(entry.role);
    const normalized = fromAddressableEntry({
      ...entry,
      role: normalizedRole,
    });

    this.entries.set(normalizedRole, Object.freeze({ ...normalized, role: normalizedRole }));
    this.updateDefaultRole(normalized);
  }

  private assertRoleAllowed(role: string): string {
    const normalized = normalizeAddressRole(role);
    if (this.roleOrder.has(normalized)) {
      return normalized;
    }

    if (this.allowDynamicRoles) {
      this.roleOrder.set(normalized, this.roleOrder.size);
      return normalized;
    }

    throw new Error(`Role "${role}" is not allowed. Configure it via the roles parameter.`);
  }

  private ensureDefaultRole(): void {
    if (this.defaultRole && this.entries.has(this.defaultRole)) {
      return;
    }

    const preferred = this.sortEntries().find((entry) => entry.isDefault);
    this.defaultRole = preferred?.role ?? this.entries.keys().next().value;
  }

  private updateDefaultRole(entry: AddressableEntry): void {
    if (entry.isDefault) {
      this.defaultRole = entry.role;
      return;
    }

    if (!this.defaultRole) {
      this.defaultRole = entry.role;
    }
  }

  private sortEntries(): AddressableEntry[] {
    const collection = Array.from(this.entries.values());

    const rank = (role: string): number => this.roleOrder.get(role) ?? Number.MAX_SAFE_INTEGER;
    collection.sort((a, b) => {
      const diff = rank(a.role) - rank(b.role);
      return diff !== 0 ? diff : a.role.localeCompare(b.role);
    });

    return collection;
  }
}
