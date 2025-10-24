/**
 * RBAC Service Tests
 * 
 * Unit and contract tests for RBAC permission checks,
 * role resolution, and separation-of-duty enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RBACService, resetRBACService } from '../../src/services/compliance/rbac-service';
import type {
  Role,
  Permission,
  RolePermission,
  SeparationOfDutyConstraint,
  UserOrganizationMembership,
} from '../../src/domain/compliance/rbac';

describe('RBACService', () => {
  let service: RBACService;

  beforeEach(() => {
    resetRBACService();
    service = new RBACService();
  });

  describe('Permission Checks', () => {
    it('should deny permission when user has no roles', () => {
      const result = service.checkPermission('user_1', 'subscription:sub_123', 'pause');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User has no assigned roles');
    });

    it('should grant permission when user has required role', () => {
      // Setup: Create role with subscription.pause permission
      const role: Role = {
        id: 'role_admin',
        name: 'admin',
        description: 'Administrator',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const permission: Permission = {
        id: 'perm_sub_pause',
        resource: 'subscription',
        action: 'pause',
        description: 'Pause subscription',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rolePermission: RolePermission = {
        id: 'rp_1',
        roleId: role.id,
        permissionId: permission.id,
        createdAt: new Date(),
      };

      service.seedRole(role);
      service.seedPermission(permission);
      service.seedRolePermission(rolePermission);

      // Grant role to user
      service.grantRole('user_1', role.id, 'system');

      // Check permission
      const result = service.checkPermission('user_1', 'subscription:sub_123', 'pause');
      
      expect(result.allowed).toBe(true);
      expect(result.grantedByRoles).toContain('admin');
    });

    it('should deny permission when user lacks required permission', () => {
      // Setup: Create role without the required permission
      const role: Role = {
        id: 'role_viewer',
        name: 'viewer',
        description: 'Viewer',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const permission: Permission = {
        id: 'perm_sub_read',
        resource: 'subscription',
        action: 'read',
        description: 'Read subscription',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rolePermission: RolePermission = {
        id: 'rp_1',
        roleId: role.id,
        permissionId: permission.id,
        createdAt: new Date(),
      };

      service.seedRole(role);
      service.seedPermission(permission);
      service.seedRolePermission(rolePermission);

      // Grant role to user
      service.grantRole('user_1', role.id, 'system');

      // Check different permission (pause instead of read)
      const result = service.checkPermission('user_1', 'subscription:sub_123', 'pause');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No permission for action "pause"');
    });
  });

  describe('Role Hierarchy', () => {
    it('should inherit permissions from parent roles', () => {
      // Setup hierarchy: contributor inherits from viewer
      const viewerRole: Role = {
        id: 'role_viewer',
        name: 'viewer',
        description: 'Viewer',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contributorRole: Role = {
        id: 'role_contributor',
        name: 'contributor',
        description: 'Contributor',
        metadata: {},
        parentRoleId: viewerRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const readPerm: Permission = {
        id: 'perm_read',
        resource: 'subscription',
        action: 'read',
        description: 'Read',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const writePerm: Permission = {
        id: 'perm_write',
        resource: 'subscription',
        action: 'write',
        description: 'Write',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Viewer can read
      const rp1: RolePermission = {
        id: 'rp_1',
        roleId: viewerRole.id,
        permissionId: readPerm.id,
        createdAt: new Date(),
      };

      // Contributor can write
      const rp2: RolePermission = {
        id: 'rp_2',
        roleId: contributorRole.id,
        permissionId: writePerm.id,
        createdAt: new Date(),
      };

      service.seedRole(viewerRole);
      service.seedRole(contributorRole);
      service.seedPermission(readPerm);
      service.seedPermission(writePerm);
      service.seedRolePermission(rp1);
      service.seedRolePermission(rp2);

      // Grant contributor role (should inherit viewer)
      service.grantRole('user_1', contributorRole.id, 'system');

      // Should have both read and write
      const readResult = service.checkPermission('user_1', 'subscription:sub_123', 'read');
      const writeResult = service.checkPermission('user_1', 'subscription:sub_123', 'write');
      
      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(true);
    });

    it('should list effective roles including inherited ones', () => {
      const viewerRole: Role = {
        id: 'role_viewer',
        name: 'viewer',
        description: 'Viewer',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contributorRole: Role = {
        id: 'role_contributor',
        name: 'contributor',
        description: 'Contributor',
        metadata: {},
        parentRoleId: viewerRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.seedRole(viewerRole);
      service.seedRole(contributorRole);

      service.grantRole('user_1', contributorRole.id, 'system');

      const effectiveRoles = service.listEffectiveRoles('user_1');
      const roleNames = effectiveRoles.map(r => r.name);
      
      expect(roleNames).toContain('contributor');
      expect(roleNames).toContain('viewer');
    });

    it('should respect hierarchy links seeded via table', () => {
      const rootRole: Role = {
        id: 'role_root',
        name: 'root',
        description: 'Root role',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childRole: Role = {
        id: 'role_child',
        name: 'child',
        description: 'Child role',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const permission: Permission = {
        id: 'perm_manage',
        resource: 'subscription',
        action: 'cancel',
        description: 'Cancel subscription',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.seedRole(rootRole);
      service.seedRole(childRole);
      service.seedPermission(permission);
      service.seedRolePermission({
        id: 'rp_root_cancel',
        roleId: rootRole.id,
        permissionId: permission.id,
        createdAt: new Date(),
      });

      service.seedRoleHierarchy({
        parentRoleId: rootRole.id,
        childRoleId: childRole.id,
        depth: 1,
      });

      service.grantRole('user_hierarchy', childRole.id, 'system');

      const result = service.checkPermission(
        'user_hierarchy',
        'subscription:sub_xyz',
        'cancel'
      );

      expect(result.allowed).toBe(true);
      expect(result.grantedByRoles).toContain('root');
    });
  });

  describe('Separation of Duty', () => {
    it('should prevent granting conflicting roles', () => {
      const approverRole: Role = {
        id: 'role_approver',
        name: 'approver',
        description: 'Approver',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const submitterRole: Role = {
        id: 'role_submitter',
        name: 'submitter',
        description: 'Submitter',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.seedRole(approverRole);
      service.seedRole(submitterRole);

      // Add SoD constraint: approver and submitter are mutually exclusive
      const sodConstraint: SeparationOfDutyConstraint = {
        id: 'sod_1',
        name: 'approver-submitter-separation',
        conflictingRoleIds: [approverRole.id, submitterRole.id],
        description: 'Cannot approve own submissions',
        createdAt: new Date(),
      };

      service.addSoDConstraint(sodConstraint);

      // Grant approver role
      service.grantRole('user_1', approverRole.id, 'system');

      // Attempt to grant submitter role should fail
      expect(() => {
        service.grantRole('user_1', submitterRole.id, 'system');
      }).toThrow(/violates separation-of-duty/);
    });
  });

  describe('Tenant Scoping', () => {
    it('should scope permissions to tenant context', () => {
      const role: Role = {
        id: 'role_admin',
        name: 'admin',
        description: 'Admin',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const permission: Permission = {
        id: 'perm_write',
        resource: 'subscription',
        action: 'write',
        description: 'Write',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rolePermission: RolePermission = {
        id: 'rp_1',
        roleId: role.id,
        permissionId: permission.id,
        createdAt: new Date(),
      };

      service.seedRole(role);
      service.seedPermission(permission);
      service.seedRolePermission(rolePermission);
      seedMembership(service, {
        relationshipId: 'rel_tenant_a',
        userId: 'user_1',
        organizationId: 'tenant_a',
        state: 'active',
        role: 'member',
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      // Grant role scoped to tenant_a
      service.grantRole('user_1', role.id, 'system', 'tenant_a');

      // Check permission in tenant_a context
      const resultA = service.checkPermission('user_1', 'subscription:sub_123', 'write', 'tenant_a');
      expect(resultA.allowed).toBe(true);

      // Check permission in tenant_b context (should fail)
      const resultB = service.checkPermission('user_1', 'subscription:sub_123', 'write', 'tenant_b');
      expect(resultB.allowed).toBe(false);
    });
  });

  describe('Role Revocation', () => {
    it('should revoke role and remove permissions', () => {
      const role: Role = {
        id: 'role_admin',
        name: 'admin',
        description: 'Admin',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const permission: Permission = {
        id: 'perm_write',
        resource: 'subscription',
        action: 'write',
        description: 'Write',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rolePermission: RolePermission = {
        id: 'rp_1',
        roleId: role.id,
        permissionId: permission.id,
        createdAt: new Date(),
      };

      service.seedRole(role);
      service.seedPermission(permission);
      service.seedRolePermission(rolePermission);

      // Grant role
      service.grantRole('user_1', role.id, 'system');

      // Verify permission granted
      let result = service.checkPermission('user_1', 'subscription:sub_123', 'write');
      expect(result.allowed).toBe(true);

      // Revoke role
      const revoked = service.revokeRole('user_1', role.id);
      expect(revoked).toBe(true);

      // Verify permission removed
      result = service.checkPermission('user_1', 'subscription:sub_123', 'write');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Membership Integration', () => {
    it('should require active membership before granting tenant-scoped role', () => {
      const role: Role = {
        id: 'role_contributor',
        name: 'contributor',
        description: 'Contributor',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.seedRole(role);

      expect(() => {
        service.grantRole('user_missing_membership', role.id, 'system', 'tenant_x');
      }).toThrow(/not an active member/);

      seedMembership(service, {
        relationshipId: 'rel_membership_x',
        userId: 'user_missing_membership',
        organizationId: 'tenant_x',
        state: 'active',
        role: 'member',
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => {
        service.grantRole('user_missing_membership', role.id, 'system', 'tenant_x');
      }).not.toThrow();
    });

    it('should return membership error when checking tenant permission without membership', () => {
      const result = service.checkPermission(
        'user_no_membership',
        'subscription:sub_999',
        'write',
        'tenant_z'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not an active member');
    });
  });
});

function seedMembership(
  service: RBACService,
  membership: UserOrganizationMembership
): void {
  service.seedMembership(membership);
}
