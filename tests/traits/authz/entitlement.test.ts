import { describe, expect, it } from 'vitest';

import { EntitlementService } from '@/traits/authz/entitlement-service.ts';
import { MembershipService } from '@/traits/authz/membership-service.ts';

import { createAuthzTestContext } from './test-helpers.ts';

describe('MembershipService', () => {
  it('assigns, lists, and revokes membership records', async () => {
    const context = createAuthzTestContext();
    const service = new MembershipService(context.executor);

    const inserted = await service.assignRole(
      context.users.beta,
      context.organizations.globex,
      context.roles.viewer
    );
    expect(inserted.organization_id).toBe(context.organizations.globex);

    const userMemberships = await service.listUserMemberships(context.users.beta);
    expect(userMemberships.length).toBeGreaterThanOrEqual(2);

    const northwindMemberships = await service.listUserMemberships(
      context.users.beta,
      context.organizations.northwind
    );
    expect(northwindMemberships).toHaveLength(1);

    const orgMembers = await service.listOrgMembers(context.organizations.globex);
    expect(orgMembers.some((member) => member.user_id === context.users.beta)).toBe(true);

    const revoked = await service.revokeRole(
      context.users.beta,
      context.organizations.globex,
      context.roles.viewer
    );
    expect(revoked).toBe(true);

    const afterRevoke = await service.listOrgMembers(context.organizations.globex);
    expect(afterRevoke.some((member) => member.user_id === context.users.beta)).toBe(false);
    await context.dispose();
  });
});

describe('EntitlementService', () => {
  it('resolves hierarchical permissions for single role assignments', async () => {
    const context = createAuthzTestContext();
    const service = new EntitlementService(context.executor);

    const permissions = await service.getUserPermissions(
      context.users.beta,
      context.organizations.northwind
    );

    const names = permissions.map((permission) => permission.name).sort();
    expect(names).toEqual(['document:edit', 'document:read', 'document:share']);
    await context.dispose();
  });

  it('unions permissions across multiple roles in the same organization', async () => {
    const context = createAuthzTestContext();
    const membershipService = new MembershipService(context.executor);
    await membershipService.assignRole(
      context.users.alpha,
      context.organizations.northwind,
      context.roles.manager
    );

    const service = new EntitlementService(context.executor);
    const permissions = await service.getUserPermissions(
      context.users.alpha,
      context.organizations.northwind
    );

    const names = permissions.map((permission) => permission.name).sort();
    expect(names).toEqual(['document:edit', 'document:read', 'document:share']);
    await context.dispose();
  });

  it('enforces organization isolation when checking permissions', async () => {
    const context = createAuthzTestContext();
    const membershipService = new MembershipService(context.executor);
    await membershipService.assignRole(
      context.users.alpha,
      context.organizations.northwind,
      context.roles.admin
    );

    const service = new EntitlementService(context.executor);
    const hasNorthwindAccess = await service.hasPermission(
      context.users.alpha,
      context.organizations.northwind,
      'org:manage'
    );
    expect(hasNorthwindAccess).toBe(true);

    const hasGlobexAccess = await service.hasPermission(
      context.users.alpha,
      context.organizations.globex,
      'org:manage'
    );
    expect(hasGlobexAccess).toBe(false);
    await context.dispose();
  });
});
