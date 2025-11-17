import { normalizeAddressRole } from './address-entry.js';

export const DEFAULT_ADDRESS_ROLES = ['billing', 'shipping'] as const;

export interface RoleManagerOptions {
  readonly roles?: readonly string[];
  readonly allowDynamicRoles?: boolean;
}

/**
 * Maintains the canonical role ordering for Addressable entries and enforces the
 * allow list configured by the trait parameters.
 */
export class RoleManager {
  private readonly allowDynamicRoles: boolean;
  private readonly roleOrder = new Map<string, number>();

  constructor(options: RoleManagerOptions = {}) {
    const roles = options.roles ?? DEFAULT_ADDRESS_ROLES;
    roles.forEach((role, index) => {
      const normalized = normalizeAddressRole(role);
      if (!this.roleOrder.has(normalized)) {
        this.roleOrder.set(normalized, index);
      }
    });

    this.allowDynamicRoles = options.allowDynamicRoles ?? false;
  }

  /**
   * Registers a role that already exists in persisted state without applying the
   * dynamic role guardrails. Used when ingesting snapshots.
   */
  adopt(role: string): string {
    const normalized = normalizeAddressRole(role);
    if (!this.roleOrder.has(normalized)) {
      this.roleOrder.set(normalized, this.roleOrder.size);
    }
    return normalized;
  }

  /**
   * Ensures a role is part of the allow list, optionally expanding via the
   * dynamic role escape hatch.
   */
  ensure(role: string): string {
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

  has(role: string): boolean {
    return this.roleOrder.has(role);
  }

  /**
   * Sorts entries using the deterministic role order (parameter order first,
   * followed by dynamically-registered roles).
   */
  sort<T extends { role: string }>(entries: Iterable<T>): T[] {
    const collection = Array.from(entries);
    collection.sort((a, b) => this.compare(a.role, b.role));
    return collection;
  }

  private compare(left: string, right: string): number {
    const rank = (role: string): number => this.roleOrder.get(role) ?? Number.MAX_SAFE_INTEGER;
    const delta = rank(left) - rank(right);
    return delta !== 0 ? delta : left.localeCompare(right);
  }
}
