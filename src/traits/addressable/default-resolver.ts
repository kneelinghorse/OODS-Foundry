import type { AddressableEntry } from './address-entry.js';

export interface DefaultResolverOptions {
  readonly defaultRole?: string;
}

/**
 * Tracks which role should be treated as the canonical default address. Prefers
 * explicit assignments (setDefaultAddress / isDefault flag) and gracefully
 * falls back to the first available entry when defaults disappear.
 */
export class DefaultResolver {
  private defaultRole?: string;

  constructor(options: DefaultResolverOptions = {}) {
    this.defaultRole = options.defaultRole;
  }

  current(): string | null {
    return this.defaultRole ?? null;
  }

  /**
   * Explicitly assign a default role.
   */
  set(role: string): void {
    this.defaultRole = role;
  }

  clear(): void {
    this.defaultRole = undefined;
  }

  /**
   * Processes an entry that has been ingested into the store, granting
   * precedence to entries flagged as default.
   */
  adopt(entry: AddressableEntry): void {
    if (entry.isDefault) {
      this.defaultRole = entry.role;
      return;
    }

    if (!this.defaultRole) {
      this.defaultRole = entry.role;
    }
  }

  /**
   * Ensures the stored default role still exists within the provided entries.
   * If not, choose the next best candidate (explicit default flag, otherwise
   * the first entry in the iterator).
   */
  ensure(entries: Iterable<AddressableEntry>): void {
    const snapshot = Array.from(entries);
    if (snapshot.length === 0) {
      this.defaultRole = undefined;
      return;
    }

    if (this.defaultRole && snapshot.some((entry) => entry.role === this.defaultRole)) {
      return;
    }

    const fallback = snapshot.find((entry) => entry.isDefault) ?? snapshot[0];
    this.defaultRole = fallback?.role;
  }
}
