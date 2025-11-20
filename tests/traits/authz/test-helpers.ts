import { randomUUID } from 'node:crypto';

import type { QueryResult } from 'pg';

import type { SqlExecutor } from '@/traits/authz/runtime-types.ts';

export interface AuthzTestContext {
  executor: SqlExecutor;
  roles: Record<'viewer' | 'editor' | 'manager' | 'admin', string>;
  permissions: Record<'read' | 'edit' | 'share' | 'orgManage', string>;
  users: Record<'alpha' | 'beta', string>;
  organizations: Record<'northwind' | 'globex', string>;
  addHierarchyEdge(parentRoleId: string, childRoleId: string): void;
  grantPermission(roleId: string, permissionName: string): string;
  dispose(): Promise<void>;
}

export function createAuthzTestContext(): AuthzTestContext {
  const roles = {
    viewer: randomUUID(),
    editor: randomUUID(),
    manager: randomUUID(),
    admin: randomUUID(),
  } as const;

  const permissions = {
    read: randomUUID(),
    edit: randomUUID(),
    share: randomUUID(),
    orgManage: randomUUID(),
  } as const;

  const organizations = {
    northwind: randomUUID(),
    globex: randomUUID(),
  } as const;

  const users = {
    alpha: randomUUID(),
    beta: randomUUID(),
  } as const;

  const executor = new FakeSqlExecutor({ roles, permissions, organizations, users });
  return {
    executor,
    roles,
    permissions,
    organizations,
    users,
    addHierarchyEdge: (parentRoleId: string, childRoleId: string) => {
      executor.addHierarchyEdge({ parent_role_id: parentRoleId, child_role_id: childRoleId });
    },
    grantPermission: (roleId: string, permissionName: string) => executor.registerPermission(roleId, permissionName),
    dispose: async () => {
      executor.reset();
    },
  } satisfies AuthzTestContext;
}

interface AuthzSeedOptions {
  roles: AuthzTestContext['roles'];
  permissions: AuthzTestContext['permissions'];
  organizations: AuthzTestContext['organizations'];
  users: AuthzTestContext['users'];
}

interface RoleRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

interface PermissionRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly resource_type: string | null;
}

interface RoleHierarchyEdge {
  readonly parent_role_id: string;
  readonly child_role_id: string;
}

interface MembershipRow {
  id: string;
  user_id: string;
  organization_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
}

class FakeSqlExecutor implements SqlExecutor {
  private readonly roles = new Map<string, RoleRecord>();
  private readonly permissions = new Map<string, PermissionRecord>();
  private readonly rolePermissions = new Map<string, Set<string>>();
  private readonly roleHierarchy: RoleHierarchyEdge[] = [];
  private readonly memberships: MembershipRow[] = [];

  constructor(options: AuthzSeedOptions) {
    this.seedRoles(options.roles);
    this.seedPermissions(options.permissions);
    this.seedRolePermissions(options.roles, options.permissions);
    this.seedHierarchy(options.roles);
    this.seedMemberships(options.users, options.organizations, options.roles);
  }

  reset(): void {
    this.memberships.splice(0);
  }

  addHierarchyEdge(edge: RoleHierarchyEdge): void {
    this.roleHierarchy.push(edge);
  }

  registerPermission(roleId: string, permissionName: string): string {
    const id = randomUUID();
    this.permissions.set(id, {
      id,
      name: permissionName,
      description: `${permissionName} (dynamic)`,
      resource_type: null,
    });
    const bucket = this.rolePermissions.get(roleId) ?? new Set<string>();
    bucket.add(id);
    this.rolePermissions.set(roleId, bucket);
    return id;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>> {
    const normalized = sql.trim();
    if (normalized.startsWith('WITH RECURSIVE role_tree')) {
      if (normalized.includes('SELECT DISTINCT p.id')) {
        return this.queryInheritedPermissions(params ?? []) as QueryResult<T>;
      }
      return this.queryRoleHierarchy(params ?? []) as QueryResult<T>;
    }

    if (normalized.startsWith('SELECT 1 FROM authz.roles')) {
      return this.queryRoleExists(params ?? []) as QueryResult<T>;
    }

    if (normalized.startsWith('INSERT INTO authz.memberships')) {
      return this.upsertMembership(params ?? []) as QueryResult<T>;
    }

    if (normalized.startsWith('DELETE FROM authz.memberships')) {
      return this.deleteMembership(params ?? []) as QueryResult<T>;
    }

    if (normalized.includes('FROM authz.memberships') && normalized.includes('WHERE user_id')) {
      return this.queryMembershipsForUser(params ?? []) as QueryResult<T>;
    }

    if (normalized.includes('FROM authz.memberships') && normalized.includes('WHERE organization_id')) {
      return this.queryMembershipsForOrg(params ?? []) as QueryResult<T>;
    }

    if (normalized.startsWith('SELECT id, name, description FROM authz.roles WHERE id = $1')) {
      return this.querySingleRole(params ?? []) as QueryResult<T>;
    }

    if (normalized.startsWith('SELECT id, name, description FROM authz.roles WHERE id = ANY')) {
      return this.queryRolesByIds(params ?? []) as QueryResult<T>;
    }

    throw new Error(`Unsupported SQL in fake executor: ${normalized}`);
  }

  private queryRoleHierarchy(params: readonly unknown[]): QueryResult<RoleHierarchyRow> {
    const roleId = params[0] as string;
    const limit = Number(params[1]) || 5;
    const nodes: RoleHierarchyRow[] = [];
    const queue: Array<{ id: string; depth: number; path: readonly string[] }> = [
      { id: roleId, depth: 0, path: [roleId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) {
        continue;
      }
      visited.add(current.id);
      const role = this.roles.get(current.id);
      if (!role) {
        continue;
      }
      nodes.push({
        id: role.id,
        name: role.name,
        description: role.description,
        depth: current.depth,
      });
      if (current.depth >= limit) {
        continue;
      }
      const parents = this.roleHierarchy
        .filter((edge) => edge.child_role_id === current.id)
        .map((edge) => edge.parent_role_id);
      for (const parent of parents) {
        if (current.path.includes(parent)) {
          continue;
        }
        queue.push({ id: parent, depth: current.depth + 1, path: [...current.path, parent] });
      }
    }

    if (nodes.length === 0) {
      throw new Error(`Role ${roleId} not found`);
    }

    return { rows: nodes as RoleHierarchyRow[], rowCount: nodes.length };
  }

  private queryInheritedPermissions(params: readonly unknown[]): QueryResult<PermissionRow> {
    const roleId = params[0] as string;
    const limit = Number(params[1]) || 5;
    const hierarchy = this.queryRoleHierarchy([roleId, limit]).rows;
    const permissionIds = new Set<string>();
    for (const node of hierarchy) {
      const bound = this.rolePermissions.get(node.id);
      if (!bound) {
        continue;
      }
      for (const permissionId of bound) {
        permissionIds.add(permissionId);
      }
    }
    const rows = [...permissionIds]
      .map((permissionId) => this.permissions.get(permissionId))
      .filter((row): row is PermissionRecord => Boolean(row))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        resource_type: record.resource_type,
      }));
    return { rows: rows as PermissionRow[], rowCount: rows.length };
  }

  private queryRoleExists(params: readonly unknown[]): QueryResult<{ exists: number }> {
    const roleId = params[0] as string;
    return {
      rows: this.roles.has(roleId) ? [{ exists: 1 }] : [],
      rowCount: this.roles.has(roleId) ? 1 : 0,
    };
  }

  private upsertMembership(params: readonly unknown[]): QueryResult<MembershipRow> {
    const [userId, orgId, roleId] = params as [string, string, string];
    const existing = this.memberships.find(
      (row) => row.user_id === userId && row.organization_id === orgId && row.role_id === roleId
    );
    if (existing) {
      existing.updated_at = nowIso();
      return { rows: [existing], rowCount: 1 };
    }
    const row: MembershipRow = {
      id: randomUUID(),
      user_id: userId,
      organization_id: orgId,
      role_id: roleId,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.memberships.push(row);
    return { rows: [row], rowCount: 1 };
  }

  private deleteMembership(params: readonly unknown[]): QueryResult<{ id: string }> {
    const [userId, orgId, roleId] = params as [string, string, string];
    const index = this.memberships.findIndex(
      (row) => row.user_id === userId && row.organization_id === orgId && row.role_id === roleId
    );
    if (index === -1) {
      return { rows: [], rowCount: 0 };
    }
    const [removed] = this.memberships.splice(index, 1);
    return { rows: [{ id: removed.id }], rowCount: 1 };
  }

  private queryMembershipsForUser(params: readonly unknown[]): QueryResult<MembershipRow> {
    const userId = params[0] as string;
    const orgId = params[1] as string | null | undefined;
    const rows = this.memberships.filter((row) => {
      if (row.user_id !== userId) {
        return false;
      }
      if (orgId) {
        return row.organization_id === orgId;
      }
      return true;
    });
    return { rows, rowCount: rows.length };
  }

  private queryMembershipsForOrg(params: readonly unknown[]): QueryResult<MembershipRow> {
    const orgId = params[0] as string;
    const rows = this.memberships.filter((row) => row.organization_id === orgId);
    return { rows, rowCount: rows.length };
  }

  private querySingleRole(params: readonly unknown[]): QueryResult<RoleRow> {
    const roleId = params[0] as string;
    const role = this.roles.get(roleId);
    if (!role) {
      return { rows: [], rowCount: 0 };
    }
    return {
      rows: [role as RoleRow],
      rowCount: 1,
    };
  }

  private queryRolesByIds(params: readonly unknown[]): QueryResult<RoleRow> {
    const roleIds = (params[0] as string[]) ?? [];
    const rows = roleIds
      .map((id) => this.roles.get(id))
      .filter((row): row is RoleRecord => Boolean(row))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { rows: rows as RoleRow[], rowCount: rows.length };
  }

  private seedRoles(roles: AuthzTestContext['roles']): void {
    for (const [key, id] of Object.entries(roles)) {
      this.roles.set(id, {
        id,
        name: capitalize(key),
        description: `${capitalize(key)} role`,
      });
    }
  }

  private seedPermissions(permissions: AuthzTestContext['permissions']): void {
    const mapping: Record<string, string> = {
      read: 'document:read',
      edit: 'document:edit',
      share: 'document:share',
      orgManage: 'org:manage',
    };
    for (const [key, id] of Object.entries(permissions)) {
      this.permissions.set(id, {
        id,
        name: mapping[key] ?? key,
        description: `${key} permission`,
        resource_type: key === 'orgManage' ? 'organization' : 'document',
      });
    }
  }

  private seedRolePermissions(
    roles: AuthzTestContext['roles'],
    permissions: AuthzTestContext['permissions']
  ): void {
    const matrix: Record<string, readonly string[]> = {
      [roles.viewer]: [permissions.read],
      [roles.editor]: [permissions.edit],
      [roles.manager]: [permissions.share],
      [roles.admin]: [permissions.orgManage],
    };
    for (const [roleId, permissionIds] of Object.entries(matrix)) {
      const bucket = this.rolePermissions.get(roleId) ?? new Set<string>();
      for (const permissionId of permissionIds) {
        bucket.add(permissionId);
      }
      this.rolePermissions.set(roleId, bucket);
    }
  }

  private seedHierarchy(roles: AuthzTestContext['roles']): void {
    const edges: RoleHierarchyEdge[] = [
      { parent_role_id: roles.viewer, child_role_id: roles.editor },
      { parent_role_id: roles.editor, child_role_id: roles.manager },
      { parent_role_id: roles.manager, child_role_id: roles.admin },
    ];
    this.roleHierarchy.push(...edges);
  }

  private seedMemberships(
    users: AuthzTestContext['users'],
    organizations: AuthzTestContext['organizations'],
    roles: AuthzTestContext['roles']
  ): void {
    const baseRows: MembershipRow[] = [
      {
        id: randomUUID(),
        user_id: users.alpha,
        organization_id: organizations.northwind,
        role_id: roles.editor,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: randomUUID(),
        user_id: users.alpha,
        organization_id: organizations.northwind,
        role_id: roles.viewer,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: randomUUID(),
        user_id: users.alpha,
        organization_id: organizations.globex,
        role_id: roles.viewer,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: randomUUID(),
        user_id: users.beta,
        organization_id: organizations.northwind,
        role_id: roles.manager,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ];
    this.memberships.push(...baseRows);
  }
}

interface RoleHierarchyRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly depth: number;
}

interface PermissionRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly resource_type: string | null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function nowIso(): string {
  return new Date().toISOString();
}
