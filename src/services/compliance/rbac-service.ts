/**
 * RBAC Service
 * 
 * Core authorization service providing permission checks, role resolution,
 * and separation-of-duty enforcement.
 * 
 * @module services/compliance/rbac-service
 */

import { DateTime } from 'luxon';
import type {
  Role,
  Permission,
  UserRole,
  RolePermission,
  RoleHierarchy,
  SeparationOfDutyConstraint,
  UserOrganizationMembership,
} from '../../domain/compliance/rbac';
import { isActiveMembership } from '../../domain/compliance/rbac';
import TimeService from '../time';

/**
 * In-memory storage for development/testing
 * In production, replace with database persistence
 */
interface RBACStore {
  roles: Map<string, Role>;
  permissions: Map<string, Permission>;
  userRoles: Map<string, UserRole[]>;
  rolePermissions: Map<string, RolePermission[]>;
  roleHierarchy: Map<string, RoleHierarchy[]>;
  sodConstraints: Map<string, SeparationOfDutyConstraint>;
  memberships: Map<string, UserOrganizationMembership[]>;
}

/**
 * Permission check result with detailed reason
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  /** Roles that granted this permission */
  grantedByRoles?: string[];
}

/**
 * RBAC Service implementation
 */
export class RBACService {
  private store: RBACStore;

  constructor(store?: RBACStore) {
    this.store = store ?? {
      roles: new Map(),
      permissions: new Map(),
      userRoles: new Map(),
      rolePermissions: new Map(),
      roleHierarchy: new Map(),
      sodConstraints: new Map(),
      memberships: new Map(),
    };
  }

  /**
   * Check if a user has permission to perform an action on a resource
   * 
   * @param userId - User identifier
   * @param resourceRef - Resource reference (e.g., "subscription:sub_123")
   * @param action - Action to perform (e.g., "pause", "approve")
   * @param tenantId - Optional tenant scope
   * @returns Permission check result
   */
  checkPermission(
    userId: string,
    resourceRef: string,
    action: string,
    tenantId?: string
  ): PermissionCheckResult {
    if (tenantId && !this.hasActiveMembership(userId, tenantId)) {
      return {
        allowed: false,
        reason: `User is not an active member of tenant "${tenantId}"`,
      };
    }

    // Get user's effective roles
    const effectiveRoles = this.listEffectiveRoles(userId, tenantId);
    
    if (effectiveRoles.length === 0) {
      return {
        allowed: false,
        reason: 'User has no assigned roles',
      };
    }

    // Extract resource type from reference (e.g., "subscription" from "subscription:sub_123")
    const [resourceType] = resourceRef.split(':');

    // Find permissions that match resource and action
    const grantedByRoles: string[] = [];
    
    for (const role of effectiveRoles) {
      const rolePerms = this.store.rolePermissions.get(role.id) ?? [];
      
      for (const rp of rolePerms) {
        const perm = this.store.permissions.get(rp.permissionId);
        
        if (perm && perm.resource === resourceType && perm.action === action) {
          // Check optional constraints
          if (this.matchesConstraints(perm, resourceRef)) {
            grantedByRoles.push(role.name);
          }
        }
      }
    }

    if (grantedByRoles.length > 0) {
      return {
        allowed: true,
        grantedByRoles,
      };
    }

    return {
      allowed: false,
      reason: `No permission for action "${action}" on resource "${resourceType}"`,
    };
  }

  /**
   * Get all effective roles for a user, including inherited roles
   * 
   * @param userId - User identifier
   * @param tenantId - Optional tenant scope
   * @returns List of effective roles
   */
  listEffectiveRoles(userId: string, tenantId?: string): Role[] {
    if (tenantId && !this.hasActiveMembership(userId, tenantId)) {
      return [];
    }

    const userRoles = this.store.userRoles.get(userId) ?? [];
    
    // Filter by tenant if specified
    const scopedRoles = tenantId
      ? userRoles.filter(ur => ur.tenantId === tenantId || !ur.tenantId)
      : userRoles;

    // Filter expired roles
    const now = TimeService.nowSystem();
    const activeRoles = scopedRoles.filter((ur) => {
      if (!ur.expiresAt) {
        return true;
      }
      const expiry = DateTime.fromJSDate(ur.expiresAt).toUTC();
      return expiry > now;
    });

    // Get base roles
    const baseRoles = activeRoles
      .map(ur => this.store.roles.get(ur.roleId))
      .filter((r): r is Role => r !== undefined);

    // Expand with inherited roles
    const effectiveRoles = new Map<string, Role>();
    
    for (const role of baseRoles) {
      effectiveRoles.set(role.id, role);
      
      // Add parent roles recursively
      this.addParentRoles(role, effectiveRoles);
    }

    return Array.from(effectiveRoles.values());
  }

  /**
   * Grant a role to a user with optional tenant scope
   * 
   * @param userId - User identifier
   * @param roleId - Role identifier
   * @param grantedBy - Granter identifier
   * @param tenantId - Optional tenant scope
   * @param expiresAt - Optional expiration date
   * @throws Error if separation-of-duty constraint violated
   */
  grantRole(
    userId: string,
    roleId: string,
    grantedBy: string,
    tenantId?: string,
    expiresAt?: Date
  ): UserRole {
    if (!this.store.roles.has(roleId)) {
      throw new Error(`Role "${roleId}" is not registered`);
    }

    if (tenantId && !this.hasActiveMembership(userId, tenantId)) {
      throw new Error(
        `User "${userId}" is not an active member of tenant "${tenantId}"`
      );
    }

    const existingAssignments = this.store.userRoles.get(userId) ?? [];
    const duplicate = existingAssignments.find(assignment => {
      const assignmentTenant = assignment.tenantId ?? null;
      const targetTenant = tenantId ?? null;
      return assignment.roleId === roleId && assignmentTenant === targetTenant;
    });

    if (duplicate) {
      throw new Error(`Role "${roleId}" already granted to user "${userId}"`);
    }

    // Check separation-of-duty constraints
    const sodViolation = this.checkSeparationOfDuty(userId, roleId);
    if (sodViolation) {
      throw new Error(
        `Cannot grant role "${roleId}": violates separation-of-duty constraint "${sodViolation.name}"`
      );
    }

    const systemNow = TimeService.nowSystem();
    const idSeed = systemNow.toMillis().toString(36);

    const userRole: UserRole = {
      id: `ur_${idSeed}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      roleId,
      tenantId,
      grantedAt: systemNow.toJSDate(),
      grantedBy,
      expiresAt,
    };

    this.store.userRoles.set(userId, [...existingAssignments, userRole]);

    return userRole;
  }

  /**
   * Revoke a role from a user
   * 
   * @param userId - User identifier
   * @param roleId - Role identifier
   * @param tenantId - Optional tenant scope
   * @returns True if role was revoked, false if not found
   */
  revokeRole(userId: string, roleId: string, tenantId?: string): boolean {
    const userRoles = this.store.userRoles.get(userId) ?? [];
    
    const filtered = userRoles.filter(ur => {
      if (ur.roleId !== roleId) return true;
      if (tenantId && ur.tenantId !== tenantId) return true;
      return false;
    });

    if (filtered.length === userRoles.length) {
      return false; // No role was removed
    }

    this.store.userRoles.set(userId, filtered);
    return true;
  }

  /**
   * Add a separation-of-duty constraint
   * 
   * @param constraint - SoD constraint definition
   */
  addSoDConstraint(constraint: SeparationOfDutyConstraint): void {
    this.store.sodConstraints.set(constraint.id, constraint);
  }

  /**
   * Check if granting a role would violate separation-of-duty
   * 
   * @param userId - User identifier
   * @param newRoleId - Role to be granted
   * @returns Violated constraint or null
   */
  private checkSeparationOfDuty(
    userId: string,
    newRoleId: string
  ): SeparationOfDutyConstraint | null {
    const userRoles = this.store.userRoles.get(userId) ?? [];
    const existingRoleIds = new Set(userRoles.map(ur => ur.roleId));

    for (const constraint of this.store.sodConstraints.values()) {
      const { conflictingRoleIds } = constraint;

      // Check if user already has a conflicting role
      if (conflictingRoleIds.includes(newRoleId)) {
        for (const existingId of existingRoleIds) {
          if (conflictingRoleIds.includes(existingId)) {
            return constraint;
          }
        }
      }
    }

    return null;
  }

  /**
   * Recursively add parent roles to the effective roles set
   */
  private addParentRoles(role: Role, effectiveRoles: Map<string, Role>): void {
    const candidateParentIds = new Set<string>();

    if (role.parentRoleId) {
      candidateParentIds.add(role.parentRoleId);
    }

    const hierarchyEntries = this.store.roleHierarchy.get(role.id) ?? [];
    for (const entry of hierarchyEntries) {
      candidateParentIds.add(entry.parentRoleId);
    }

    for (const parentRoleId of candidateParentIds) {
      const parent = this.store.roles.get(parentRoleId);
      if (!parent) {
        continue;
      }

      if (effectiveRoles.has(parent.id)) {
        continue;
      }

      effectiveRoles.set(parent.id, parent);
      this.addParentRoles(parent, effectiveRoles);
    }
  }

  /**
   * Check if permission constraints are satisfied
   * For now, always returns true; extend with constraint evaluation logic
   */
  private matchesConstraints(_permission: Permission, _resourceRef: string): boolean {
    // Future: evaluate constraints like {"owner": true, "status": ["active"]}
    return true;
  }

  /**
   * Determine if the user has an active membership in the tenant
   */
  private hasActiveMembership(userId: string, tenantId: string): boolean {
    const memberships = this.store.memberships.get(userId) ?? [];
    return memberships.some(
      membership =>
        membership.organizationId === tenantId && isActiveMembership(membership)
    );
  }

  /**
   * Seed the store with a role
   * Development helper
   */
  seedRole(role: Role): void {
    this.store.roles.set(role.id, role);
  }

  /**
   * Seed role hierarchy (child inherits parent)
   * Development helper
   */
  seedRoleHierarchy(link: RoleHierarchy): void {
    const existing = this.store.roleHierarchy.get(link.childRoleId) ?? [];
    this.store.roleHierarchy.set(link.childRoleId, [...existing, link]);
  }

  /**
   * Seed the store with a permission
   * Development helper
   */
  seedPermission(permission: Permission): void {
    this.store.permissions.set(permission.id, permission);
  }

  /**
   * Seed role-permission mapping
   * Development helper
   */
  seedRolePermission(rolePermission: RolePermission): void {
    const existing = this.store.rolePermissions.get(rolePermission.roleId) ?? [];
    this.store.rolePermissions.set(rolePermission.roleId, [...existing, rolePermission]);
  }

  /**
   * Seed membership data (integration with User↔Organization graph)
   * Development helper
   */
  seedMembership(membership: UserOrganizationMembership): void {
    const existing = this.store.memberships.get(membership.userId) ?? [];
    const filtered = existing.filter(
      existingMembership =>
        existingMembership.organizationId !== membership.organizationId
    );
    this.store.memberships.set(membership.userId, [...filtered, membership]);
  }
}

/**
 * Singleton instance for app-wide usage
 */
let _instance: RBACService | null = null;

export function getRBACService(): RBACService {
  if (!_instance) {
    _instance = new RBACService();
  }
  return _instance;
}

/**
 * Reset singleton (testing only)
 */
export function resetRBACService(): void {
  _instance = null;
}
