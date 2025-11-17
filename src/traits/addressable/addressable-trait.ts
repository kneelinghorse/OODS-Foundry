import type { AddressableEntry } from './address-entry.js';
import type { AddressInput } from '@/schemas/address.js';
import { formatAddress as formatAddressValue } from './address-formatter.js';
import type {
  FormatAddressOptions,
  FormatAddressResult,
} from './address-formatter.js';
import {
  AddressStore,
  type AddressCollectionInput,
  type AddressStoreSnapshot,
  type SetAddressOptions as StoreSetAddressOptions,
} from './address-store.js';
import { DEFAULT_ADDRESS_ROLES } from './role-manager.js';

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

export type AddressableSnapshot = AddressStoreSnapshot;

export type SetAddressOptions = StoreSetAddressOptions;

export { DEFAULT_ADDRESS_ROLES } from './role-manager.js';

/**
 * Runtime helper managing Addressable trait data in memory.
 * Provides deterministic get/set/remove operations with role guardrails.
 */
export class AddressableTrait {
  private readonly store: AddressStore;

  constructor(state: AddressableTraitState = {}, options: AddressableTraitOptions = {}) {
    this.store = new AddressStore({
      roles: options.roles ?? DEFAULT_ADDRESS_ROLES,
      allowDynamicRoles: options.allowDynamicRoles,
      defaultRole: state.defaultRole ?? options.defaultRole,
      addresses: state.addresses,
      clock: options.clock,
    });
  }

  /**
  * Returns the Addressable entry for a specific role (or default role if omitted).
  */
  getAddress(role?: string): AddressableEntry | null {
    return this.store.getAddress(role);
  }

  getDefaultRole(): string | null {
    return this.store.getDefaultRole();
  }

  getDefaultAddress(role?: string): AddressableEntry | null {
    if (role) {
      return this.store.getDefaultAddress(role);
    }

    return this.store.getDefaultAddress() ?? this.store.getAddress();
  }

  getAddresses(roles?: readonly string[]): AddressableEntry[] {
    return this.store.getAddresses(roles);
  }

  /**
   * Adds or replaces an address for the provided role.
   */
  setAddress(role: string, address: AddressInput, options: SetAddressOptions = {}): AddressableEntry {
    return this.store.setAddress(role, address, options);
  }

  /**
   * Bulk replace the current role map.
   */
  setAddresses(addresses: AddressCollectionInput): void {
    this.store.setAddresses(addresses);
  }

  /**
   * Explicitly assigns the default address role without mutating entries.
   */
  setDefaultAddress(role: string): AddressableEntry {
    return this.store.setDefaultRole(role);
  }

  /**
   * Removes an address role; returns true when a role was present.
   */
  removeAddress(role: string): boolean {
    return this.store.removeAddress(role);
  }

  /**
   * Serialize the current state for persistence or composition.
   */
  toSnapshot(): AddressableSnapshot {
    return this.store.toSnapshot();
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
}
