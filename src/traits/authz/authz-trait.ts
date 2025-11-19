import TimeService from '@/services/time/index.js';

import {
  normalizeRole,
  type RoleDocument,
  type RoleInput,
} from '@/schemas/authz/role.schema.js';
import {
  normalizePermission,
  type PermissionDocument,
  type PermissionInput,
} from '@/schemas/authz/permission.schema.js';
import {
  normalizeMembership,
  type MembershipDocument,
  type MembershipInput,
} from '@/schemas/authz/membership.schema.js';
import {
  normalizeRoleHierarchyEdge,
  type RoleHierarchyEdge,
  type RoleHierarchyInput,
} from '@/schemas/authz/role-hierarchy.schema.js';

type MembershipKey = `${string}|${string}|${string}`;

const DEFAULT_CLOCK = (): string => TimeService.toIsoString(TimeService.nowSystem());

function membershipKey(userId: string, organizationId: string, roleId: string): MembershipKey {
  return `${userId}|${organizationId}|${roleId}`;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function safeRandomUUID(): string | undefined {
  const availableCrypto =
    typeof globalThis === 'object' && globalThis ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (availableCrypto && typeof availableCrypto.randomUUID === 'function') {
    return availableCrypto.randomUUID();
  }
  return undefined;
}

export interface RolePermissionBinding {
  readonly roleId: string;
  readonly permissionId: string;
}

export interface AuthableTraitState {
  readonly roleCatalog?: readonly RoleInput[];
  readonly permissionCatalog?: readonly PermissionInput[];
  readonly memberships?: readonly MembershipInput[];
  readonly rolePermissions?: Readonly<Record<string, readonly string[]>>;
  readonly roleHierarchyEdges?: readonly RoleHierarchyInput[];
}

export interface AuthableTraitOptions {
  readonly clock?: () => string;
  readonly bindings?: readonly RolePermissionBinding[];
}

export class AuthableTrait {
  private readonly roleMap = new Map<string, RoleDocument>();
  private readonly roleNameMap = new Map<string, RoleDocument>();
  private readonly permissionMap = new Map<string, PermissionDocument>();
  private readonly permissionNameMap = new Map<string, PermissionDocument>();
  private readonly membershipMap = new Map<string, MembershipDocument>();
  private readonly membershipIndex = new Map<MembershipKey, string>();
  private readonly rolePermissionMap = new Map<string, Set<string>>();
  private readonly hierarchy: RoleHierarchyEdge[] = [];
  private readonly clock: () => string;

  constructor(state: AuthableTraitState = {}, options: AuthableTraitOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;

    for (const role of state.roleCatalog ?? []) {
      this.addRole(normalizeRole(role));
    }

    for (const permission of state.permissionCatalog ?? []) {
      this.addPermission(normalizePermission(permission));
    }

    const runtimeBindings: RolePermissionBinding[] = [];
    if (state.rolePermissions) {
      for (const [roleId, permissions] of Object.entries(state.rolePermissions)) {
        for (const permissionId of permissions) {
          runtimeBindings.push({ roleId, permissionId });
        }
      }
    }
    if (options.bindings) {
      runtimeBindings.push(...options.bindings);
    }
    for (const binding of runtimeBindings) {
      this.linkRolePermission(binding.roleId, binding.permissionId);
    }

    for (const membership of state.memberships ?? []) {
      const normalized = normalizeMembership(membership, {
        clock: this.clock,
        generateId: () => membership.id ?? safeRandomUUID() ?? `mbr_${cryptoRandomFallback()}`,
      });
      this.storeMembership(normalized);
    }

    for (const edge of state.roleHierarchyEdges ?? []) {
      this.hierarchy.push(normalizeRoleHierarchyEdge(edge));
    }
  }

  listRoles(): RoleDocument[] {
    return [...this.roleMap.values()];
  }

  listPermissions(): PermissionDocument[] {
    return [...this.permissionMap.values()];
  }

  listMemberships(): MembershipDocument[] {
    return [...this.membershipMap.values()];
  }

  listHierarchyEdges(): RoleHierarchyEdge[] {
    return [...this.hierarchy];
  }

  upsertRole(role: RoleInput): RoleDocument {
    const normalized = normalizeRole(role);
    this.addRole(normalized);
    return normalized;
  }

  upsertPermission(permission: PermissionInput): PermissionDocument {
    const normalized = normalizePermission(permission);
    this.addPermission(normalized);
    return normalized;
  }

  assignMembership(membership: MembershipInput): MembershipDocument {
    const normalized = normalizeMembership(membership, {
      clock: this.clock,
      generateId: () => membership.id ?? this.generateMembershipId(),
    });
    const key = membershipKey(normalized.user_id, normalized.organization_id, normalized.role_id);
    const existingId = this.membershipIndex.get(key);
    if (existingId) {
      const existing = this.membershipMap.get(existingId);
      if (existing) {
        const updated: MembershipDocument = {
          ...existing,
          updated_at: this.clock(),
        };
        this.membershipMap.set(existingId, updated);
        return updated;
      }
    }

    this.storeMembership(normalized);
    return normalized;
  }

  revokeMembership(userId: string, organizationId: string, roleRef: string): boolean {
    const roleId = this.resolveRoleId(roleRef);
    const key = membershipKey(userId, organizationId, roleId);
    const membershipId = this.membershipIndex.get(key);
    if (!membershipId) {
      return false;
    }
    this.membershipIndex.delete(key);
    return this.membershipMap.delete(membershipId);
  }

  getMembershipsForUser(userId: string, organizationId?: string): MembershipDocument[] {
    return this.filterMemberships((membership) => {
      if (membership.user_id !== userId) {
        return false;
      }
      if (organizationId) {
        return membership.organization_id === organizationId;
      }
      return true;
    });
  }

  getMembershipsForOrganization(organizationId: string): MembershipDocument[] {
    return this.filterMemberships((membership) => membership.organization_id === organizationId);
  }

  getRolesForUser(userId: string, organizationId?: string): RoleDocument[] {
    const memberships = this.getMembershipsForUser(userId, organizationId);
    const seen = new Set<string>();
    const roles: RoleDocument[] = [];
    for (const membership of memberships) {
      const role = this.roleMap.get(membership.role_id);
      if (role && !seen.has(role.id)) {
        seen.add(role.id);
        roles.push(role);
      }
    }
    return roles;
  }

  userHasRole(userId: string, organizationId: string, roleRef: string): boolean {
    const roleId = this.resolveRoleId(roleRef);
    const key = membershipKey(userId, organizationId, roleId);
    return this.membershipIndex.has(key);
  }

  userHasPermission(userId: string, organizationId: string, permissionRef: string): boolean {
    const permissionId = this.resolvePermissionId(permissionRef);
    if (!permissionId) {
      return false;
    }
    const memberships = this.getMembershipsForUser(userId, organizationId);
    for (const membership of memberships) {
      const permissions = this.rolePermissionMap.get(membership.role_id);
      if (permissions?.has(permissionId)) {
        return true;
      }
    }
    return false;
  }

  getPermissionsForRole(roleRef: string): PermissionDocument[] {
    const roleId = this.resolveRoleId(roleRef);
    const permissionIds = this.rolePermissionMap.get(roleId);
    if (!permissionIds) {
      return [];
    }
    const permissions: PermissionDocument[] = [];
    for (const id of permissionIds) {
      const permission = this.permissionMap.get(id);
      if (permission) {
        permissions.push(permission);
      }
    }
    return permissions;
  }

  linkRolePermission(roleRef: string, permissionRef: string): void {
    const roleId = this.resolveRoleId(roleRef);
    const permissionId = this.resolvePermissionId(permissionRef);

    if (!permissionId) {
      throw new Error(`Permission "${permissionRef}" is not registered.`);
    }

    const set = this.rolePermissionMap.get(roleId) ?? new Set<string>();
    set.add(permissionId);
    this.rolePermissionMap.set(roleId, set);
  }

  getRoleHierarchy(): RoleHierarchyEdge[] {
    return this.listHierarchyEdges();
  }

  private addRole(role: RoleDocument): void {
    this.roleMap.set(role.id, role);
    this.roleNameMap.set(normalizeName(role.name), role);
  }

  private addPermission(permission: PermissionDocument): void {
    this.permissionMap.set(permission.id, permission);
    this.permissionNameMap.set(normalizeName(permission.name), permission);
  }

  private storeMembership(membership: MembershipDocument): void {
    this.membershipMap.set(membership.id, membership);
    const key = membershipKey(membership.user_id, membership.organization_id, membership.role_id);
    this.membershipIndex.set(key, membership.id);
  }

  private resolveRoleId(roleRef: string): string {
    if (this.roleMap.has(roleRef)) {
      return roleRef;
    }
    const match = this.roleNameMap.get(normalizeName(roleRef));
    if (!match) {
      throw new Error(`Role "${roleRef}" is not registered.`);
    }
    return match.id;
  }

  private resolvePermissionId(permissionRef: string): string | undefined {
    if (this.permissionMap.has(permissionRef)) {
      return permissionRef;
    }
    return this.permissionNameMap.get(normalizeName(permissionRef))?.id;
  }

  private filterMemberships(
    predicate: (membership: MembershipDocument) => boolean
  ): MembershipDocument[] {
    const results: MembershipDocument[] = [];
    for (const membership of this.membershipMap.values()) {
      if (predicate(membership)) {
        results.push(membership);
      }
    }
    return results;
  }

  private generateMembershipId(): string {
    return safeRandomUUID() ?? `mbr_${cryptoRandomFallback()}`;
  }
}

function cryptoRandomFallback(): string {
  return Math.random().toString(36).slice(2) + TimeService.nowSystem().toMillis().toString(36);
}
