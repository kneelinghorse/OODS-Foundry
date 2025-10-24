/**
 * Compliance Integration Tests
 * 
 * End-to-end tests demonstrating RBAC + audit integration
 * across domain actions (subscription, overlay, token).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RBACService, resetRBACService } from '../../src/services/compliance/rbac-service';
import { AuditLogService, resetAuditLogService } from '../../src/services/compliance/audit-service';
import type {
  Role,
  Permission,
  RolePermission,
  UserOrganizationMembership,
} from '../../src/domain/compliance/rbac';
import { BASELINE_ROLES, BASELINE_PERMISSIONS } from '../../src/domain/compliance/rbac';

describe('Compliance Integration', () => {
  let rbacService: RBACService;
  let auditService: AuditLogService;

  beforeEach(() => {
    resetRBACService();
    resetAuditLogService();
    rbacService = new RBACService();
    auditService = new AuditLogService();

    // Seed baseline roles and permissions
    seedBaseline(rbacService);
  });

  describe('Subscription Pause Flow', () => {
    it('should allow contributor to pause subscription with audit trail', () => {
      const userId = 'user_contributor_1';
      const subscriptionRef = 'subscription:sub_premium_123';

      // Grant contributor role
      rbacService.grantRole(userId, 'role_contributor', 'system');

      // Check permission
      const permissionResult = rbacService.checkPermission(
        userId,
        subscriptionRef,
        'pause'
      );

      expect(permissionResult.allowed).toBe(true);
      expect(permissionResult.grantedByRoles).toContain('contributor');

      // Record audit event
      const auditEntry = auditService.record({
        actorId: userId,
        actorType: 'user',
        action: 'subscription.pause',
        resourceRef: subscriptionRef,
        payload: { reason: 'customer request', timestamp: new Date().toISOString() },
        severity: 'WARNING',
      });

      expect(auditEntry.action).toBe('subscription.pause');
      expect(auditEntry.actorId).toBe(userId);

      // Verify audit trail
      const auditLogs = auditService.query({ actorId: userId });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].resourceRef).toBe(subscriptionRef);
    });

    it('should deny viewer from pausing subscription', () => {
      const userId = 'user_viewer_1';
      const subscriptionRef = 'subscription:sub_basic_456';

      // Grant viewer role (read-only)
      rbacService.grantRole(userId, 'role_viewer', 'system');

      // Check permission
      const permissionResult = rbacService.checkPermission(
        userId,
        subscriptionRef,
        'pause'
      );

      expect(permissionResult.allowed).toBe(false);
      expect(permissionResult.reason).toContain('No permission');

      // Denied action should still be audited
      auditService.record({
        actorId: userId,
        actorType: 'user',
        action: 'subscription.pause',
        resourceRef: subscriptionRef,
        payload: { denied: true, reason: permissionResult.reason },
        severity: 'CRITICAL',
        metadata: { permissionCheck: 'failed' },
      });

      const deniedLogs = auditService.query({
        actorId: userId,
        severity: 'CRITICAL',
      });

      expect(deniedLogs.length).toBe(1);
      expect(deniedLogs[0].metadata?.permissionCheck).toBe('failed');
    });
  });

  describe('Overlay Publish Flow', () => {
    it('should allow approver to publish overlay with audit trail', () => {
      const userId = 'user_approver_1';
      const overlayRef = 'overlay:brand-theme-v2';

      // Grant approver role
      rbacService.grantRole(userId, 'role_approver', 'system');

      // Check permission
      const permissionResult = rbacService.checkPermission(
        userId,
        overlayRef,
        'publish'
      );

      expect(permissionResult.allowed).toBe(true);

      // Record audit event with CRITICAL severity (production publish)
      const auditEntry = auditService.record({
        actorId: userId,
        actorType: 'user',
        action: 'overlay.publish',
        resourceRef: overlayRef,
        payload: {
          version: 'v2.1.0',
          environment: 'production',
          changedTokens: ['color.primary', 'spacing.base'],
        },
        severity: 'CRITICAL',
      });

      expect(auditEntry.severity).toBe('CRITICAL');

      // Verify chain integrity after critical action
      const verification = auditService.verifyIntegrity();
      expect(verification.valid).toBe(true);
    });
  });

  describe('Token Approval Flow', () => {
    it('should enforce approver role for token approval', () => {
      const contributorId = 'user_contributor_1';
      const approverId = 'user_approver_1';
      const tokenRef = 'token:color-primary';

      // Grant roles
      rbacService.grantRole(contributorId, 'role_contributor', 'system');
      rbacService.grantRole(approverId, 'role_approver', 'system');

      // Contributor submits token change
      auditService.record({
        actorId: contributorId,
        actorType: 'user',
        action: 'token.write',
        resourceRef: tokenRef,
        payload: { oldValue: '#0066CC', newValue: '#0052A3' },
        severity: 'INFO',
      });

      // Contributor cannot approve (should fail permission check)
      const contributorApproval = rbacService.checkPermission(
        contributorId,
        tokenRef,
        'approve'
      );
      expect(contributorApproval.allowed).toBe(false);

      // Approver can approve
      const approverApproval = rbacService.checkPermission(
        approverId,
        tokenRef,
        'approve'
      );
      expect(approverApproval.allowed).toBe(true);

      // Record approval
      auditService.record({
        actorId: approverId,
        actorType: 'user',
        action: 'token.approve',
        resourceRef: tokenRef,
        payload: { approved: true, submittedBy: contributorId },
        severity: 'WARNING',
      });

      // Verify audit trail shows both actions
      const tokenLogs = auditService.query({ resourceRef: tokenRef });
      expect(tokenLogs.length).toBe(2);
      
      const actions = tokenLogs.map(l => l.action);
      expect(actions).toContain('token.write');
      expect(actions).toContain('token.approve');
    });
  });

  describe('Compliance Admin Flow', () => {
    it('should allow compliance-admin to manage roles', () => {
      const adminId = 'user_admin_1';
      const targetUserId = 'user_target_1';

      // Grant compliance-admin role
      rbacService.grantRole(adminId, 'role_compliance_admin', 'system');

      // Admin can manage roles
      const manageRolesPermission = rbacService.checkPermission(
        adminId,
        'compliance:roles',
        'manage-roles'
      );
      expect(manageRolesPermission.allowed).toBe(true);

      // Admin grants role to another user
      rbacService.grantRole(targetUserId, 'role_contributor', adminId);

      // Audit the role grant
      auditService.record({
        actorId: adminId,
        actorType: 'user',
        action: 'compliance.grant-role',
        resourceRef: `user:${targetUserId}`,
        payload: { roleId: 'role_contributor', grantedBy: adminId },
        severity: 'CRITICAL',
        metadata: { complianceAction: true },
      });

      // Verify target user has role
      const effectiveRoles = rbacService.listEffectiveRoles(targetUserId);
      expect(effectiveRoles.some(r => r.id === 'role_contributor')).toBe(true);

      // Verify audit log
      const complianceLogs = auditService.query({
        action: 'compliance.grant-role',
      });
      expect(complianceLogs.length).toBe(1);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate permissions by tenant', () => {
      const userId = 'user_multi_tenant';

      seedMembership(rbacService, {
        relationshipId: 'rel_tenant_a',
        userId,
        organizationId: 'tenant_a',
        state: 'active',
        role: 'member',
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      // Grant role for tenant_a only
      rbacService.grantRole(userId, 'role_contributor', 'system', 'tenant_a');

      // Should have permission in tenant_a
      const resultA = rbacService.checkPermission(
        userId,
        'subscription:sub_123',
        'write',
        'tenant_a'
      );
      expect(resultA.allowed).toBe(true);

      // Should NOT have permission in tenant_b
      const resultB = rbacService.checkPermission(
        userId,
        'subscription:sub_456',
        'write',
        'tenant_b'
      );
      expect(resultB.allowed).toBe(false);

      // Audit events should track tenant scope
      auditService.record({
        actorId: userId,
        actorType: 'user',
        action: 'subscription.write',
        resourceRef: 'subscription:sub_123',
        payload: {},
        tenantId: 'tenant_a',
      });

      const tenantLogs = auditService.query({ tenantId: 'tenant_a' });
      expect(tenantLogs.length).toBe(1);
    });
  });

  describe('Audit Chain Integrity', () => {
    it('should maintain chain integrity across multiple operations', () => {
      const userId = 'user_1';
      rbacService.grantRole(userId, 'role_contributor', 'system');

      // Perform multiple audited operations
      const operations = [
        { action: 'subscription.create', ref: 'subscription:sub_1' },
        { action: 'subscription.pause', ref: 'subscription:sub_1' },
        { action: 'subscription.resume', ref: 'subscription:sub_1' },
        { action: 'token.write', ref: 'token:color' },
        { action: 'overlay.write', ref: 'overlay:theme' },
      ];

      for (const op of operations) {
        auditService.record({
          actorId: userId,
          actorType: 'user',
          action: op.action,
          resourceRef: op.ref,
          payload: { timestamp: new Date().toISOString() },
        });
      }

      // Verify chain integrity
      const verification = auditService.verifyIntegrity();
      expect(verification.valid).toBe(true);

      // Verify sequence numbers are consecutive
      const logs = auditService.export();
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i].sequenceNumber).toBe(logs[i - 1].sequenceNumber + 1);
      }
    });
  });
});

/**
 * Seed baseline roles and permissions for testing
 */
function seedBaseline(service: RBACService): void {
  // Create roles
  const roles: Role[] = [
    {
      id: 'role_viewer',
      name: 'viewer',
      description: 'Read-only access',
      metadata: { system: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role_contributor',
      name: 'contributor',
      description: 'Create and edit resources',
      metadata: { system: true },
      parentRoleId: 'role_viewer',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role_approver',
      name: 'approver',
      description: 'Approve changes',
      metadata: { system: true },
      parentRoleId: 'role_contributor',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role_compliance_admin',
      name: 'compliance-admin',
      description: 'Manage compliance',
      metadata: { system: true, privileged: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const role of roles) {
    service.seedRole(role);
  }

  // Create permissions based on BASELINE_PERMISSIONS
  const permissions: Permission[] = BASELINE_PERMISSIONS.map((bp, idx) => ({
    ...bp,
    id: `perm_${idx}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  for (const perm of permissions) {
    service.seedPermission(perm);
  }

  // Map permissions to roles
  const rolePermissionMappings: Array<{ roleId: string; permIds: number[] }> = [
    // Viewer: read-only
    { roleId: 'role_viewer', permIds: [0, 4, 7] }, // subscription.read, overlay.read, token.read
    
    // Contributor: viewer + write + pause
    { roleId: 'role_contributor', permIds: [1, 2, 5, 8] }, // subscription.write, subscription.pause, overlay.write, token.write
    
    // Approver: contributor + cancel/publish/approve
    { roleId: 'role_approver', permIds: [3, 6, 9] }, // subscription.cancel, overlay.publish, token.approve
    
    // Compliance admin: all compliance permissions
    { roleId: 'role_compliance_admin', permIds: [10, 11, 12] }, // manage-roles, assign-permissions, view-audit-log
  ];

  for (const mapping of rolePermissionMappings) {
    for (const permIdx of mapping.permIds) {
      const rp: RolePermission = {
        id: `rp_${mapping.roleId}_${permIdx}`,
        roleId: mapping.roleId,
        permissionId: permissions[permIdx].id,
        createdAt: new Date(),
      };
      service.seedRolePermission(rp);
    }
  }
}

function seedMembership(service: RBACService, membership: UserOrganizationMembership): void {
  service.seedMembership(membership);
}
