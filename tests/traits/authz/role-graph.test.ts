import { describe, expect, it } from 'vitest';

import { RoleGraphResolver } from '@/traits/authz/role-graph-resolver.ts';

import { createAuthzTestContext } from './test-helpers.ts';

describe('RoleGraphResolver', () => {
  it('resolves multi-level hierarchies via recursive CTE', async () => {
    const context = createAuthzTestContext();
    const resolver = new RoleGraphResolver(context.executor, { depthLimit: 8 });

    const hierarchy = await resolver.resolveRoleHierarchy(context.roles.admin);
    expect(hierarchy.map((node) => node.name)).toEqual(['Admin', 'Manager', 'Editor', 'Viewer']);
    expect(hierarchy[0]?.depth).toBe(0);
    await context.dispose();
  });

  it('accumulates inherited permissions across parent roles', async () => {
    const context = createAuthzTestContext();
    const resolver = new RoleGraphResolver(context.executor, { depthLimit: 8 });

    const permissions = await resolver.getInheritedPermissions(context.roles.manager);
    const names = permissions.map((permission) => permission.name).sort();
    expect(names).toEqual(['document:edit', 'document:read', 'document:share']);
    await context.dispose();
  });

  it('prevents circular dependencies from duplicating roles', async () => {
    const context = createAuthzTestContext();
    context.addHierarchyEdge(context.roles.admin, context.roles.viewer);

    const resolver = new RoleGraphResolver(context.executor, { depthLimit: 8 });
    const hierarchy = await resolver.resolveRoleHierarchy(context.roles.manager);

    const uniqueRoleIds = new Set(hierarchy.map((node) => node.id));
    expect(uniqueRoleIds.size).toBe(hierarchy.length);
    expect(hierarchy.map((node) => node.name)).toEqual(['Manager', 'Editor', 'Viewer', 'Admin']);
    await context.dispose();
  });
});
