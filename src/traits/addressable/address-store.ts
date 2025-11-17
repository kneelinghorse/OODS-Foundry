import type { AddressInput } from '@/schemas/address.js';
import type { AddressMetadataInput } from '@/schemas/address-metadata.js';
import TimeService from '@/services/time/index.js';
import {
  createAddressableEntry,
  fromAddressableEntry,
  normalizeAddressRole,
  toAddressRoleRecord,
} from './address-entry.js';
import type {
  AddressableEntry,
  AddressableEntryInput,
  AddressRoleRecord,
  CreateAddressableEntryOptions,
} from './address-entry.js';
import { DefaultResolver } from './default-resolver.js';
import { RoleManager, DEFAULT_ADDRESS_ROLES } from './role-manager.js';

export type AddressCollectionInput =
  | readonly AddressableEntryInput[]
  | AddressRoleRecord
  | Map<string, AddressableEntryInput>
  | undefined;

export interface SetAddressOptions extends Omit<CreateAddressableEntryOptions, 'timestamp'> {
  readonly metadata?: AddressMetadataInput;
}

export interface AddressStoreOptions {
  readonly roles?: readonly string[];
  readonly allowDynamicRoles?: boolean;
  readonly defaultRole?: string;
  readonly addresses?: AddressCollectionInput;
  readonly clock?: () => string;
}

export interface AddressStoreSnapshot {
  readonly addresses: AddressRoleRecord;
  readonly defaultRole?: string;
}

export class AddressStore {
  private readonly roleManager: RoleManager;
  private readonly defaultResolver: DefaultResolver;
  private readonly clock: () => string;
  private readonly entries = new Map<string, AddressableEntry>();

  constructor(options: AddressStoreOptions = {}) {
    this.roleManager = new RoleManager({
      roles: options.roles ?? DEFAULT_ADDRESS_ROLES,
      allowDynamicRoles: options.allowDynamicRoles,
    });
    const defaultRole = options.defaultRole ? normalizeAddressRole(options.defaultRole) : undefined;
    this.defaultResolver = new DefaultResolver({ defaultRole });
    this.clock = options.clock ?? (() => TimeService.toIsoString(TimeService.nowSystem()));

    this.hydrate(options.addresses);
  }

  getAddress(role?: string): AddressableEntry | null {
    if (role) {
      const normalized = normalizeAddressRole(role);
      return this.entries.get(normalized) ?? null;
    }

    const preferred = this.defaultResolver.current();
    if (preferred) {
      const entry = this.entries.get(preferred);
      if (entry) {
        return entry;
      }
    }

    const iterator = this.entries.values().next();
    return iterator.done ? null : iterator.value;
  }

  getDefaultAddress(role?: string): AddressableEntry | null {
    if (role) {
      const normalized = normalizeAddressRole(role);
      return this.entries.get(normalized) ?? null;
    }

    const preferred = this.defaultResolver.current();
    return preferred ? this.entries.get(preferred) ?? null : null;
  }

  getDefaultRole(): string | null {
    return this.defaultResolver.current();
  }

  getAddresses(roles?: readonly string[]): AddressableEntry[] {
    if (!roles || roles.length === 0) {
      return this.roleManager.sort(this.entries.values());
    }

    const scoped: AddressableEntry[] = [];
    roles.forEach((role) => {
      const normalized = normalizeAddressRole(role);
      const entry = this.entries.get(normalized);
      if (entry) {
        scoped.push(entry);
      }
    });
    return scoped;
  }

  setAddress(role: string, address: AddressInput, options: SetAddressOptions = {}): AddressableEntry {
    const normalizedRole = this.roleManager.ensure(role);
    const entry = createAddressableEntry(normalizedRole, address, options.metadata, {
      isDefault: options.isDefault,
      timestamp: this.clock(),
    });

    this.entries.set(normalizedRole, entry);
    if (options.isDefault) {
      this.defaultResolver.set(normalizedRole);
    } else if (!this.defaultResolver.current()) {
      this.defaultResolver.set(normalizedRole);
    }

    return entry;
  }

  setAddresses(addresses: AddressCollectionInput): void {
    const normalizedEntries = this.normalizeCollection(addresses);
    const preservedDefault = this.defaultResolver.current();

    this.entries.clear();
    normalizedEntries.forEach((entry) => {
      this.entries.set(entry.role, entry);
    });

    this.defaultResolver.clear();

    if (this.entries.size === 0) {
      return;
    }

    const explicitDefault = normalizedEntries.find((entry) => entry.isDefault)?.role;
    if (explicitDefault) {
      this.defaultResolver.set(explicitDefault);
      return;
    }

    if (preservedDefault && this.entries.has(preservedDefault)) {
      this.defaultResolver.set(preservedDefault);
      return;
    }

    this.defaultResolver.ensure(this.entries.values());
  }

  setDefaultRole(role: string): AddressableEntry {
    const normalized = normalizeAddressRole(role);
    const entry = this.entries.get(normalized);
    if (!entry) {
      throw new Error(`Cannot set default address. Role "${role}" has no address.`);
    }

    this.defaultResolver.set(normalized);
    return entry;
  }

  removeAddress(role: string): boolean {
    const normalized = normalizeAddressRole(role);
    const removed = this.entries.delete(normalized);
    if (!removed) {
      return false;
    }

    this.defaultResolver.ensure(this.entries.values());
    return true;
  }

  toSnapshot(): AddressStoreSnapshot {
    return {
      addresses: toAddressRoleRecord(this.entries.values()),
      defaultRole: this.defaultResolver.current() ?? undefined,
    };
  }

  private hydrate(addresses: AddressCollectionInput): void {
    const normalizedEntries = this.normalizeCollection(addresses);
    normalizedEntries.forEach((entry) => {
      this.entries.set(entry.role, entry);
      this.defaultResolver.adopt(entry);
    });

    this.defaultResolver.ensure(this.entries.values());
  }

  private normalizeCollection(input: AddressCollectionInput): AddressableEntry[] {
    if (!input) {
      return [];
    }

    if (Array.isArray(input)) {
      return input.map((entry) => this.normalizeEntry(entry));
    }

    if (input instanceof Map) {
      return Array.from(input.values(), (entry) => this.normalizeEntry(entry));
    }

    return Object.values(input).map((entry) => this.normalizeEntry(entry));
  }

  private normalizeEntry(entry: AddressableEntryInput | AddressableEntry): AddressableEntry {
    const normalized = fromAddressableEntry(entry);
    this.roleManager.adopt(normalized.role);
    return Object.freeze({ ...normalized, role: normalized.role });
  }
}
