import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';

import type { PermissionDocument } from '@/schemas/authz/permission.schema.js';
import { RoleSchema, type RoleDocument } from '@/schemas/authz/role.schema.js';

import TimeService from '@/services/time/index.js';

import type { PermissionCache } from './cache/permission-cache.js';
import { MembershipService, type MembershipServiceOptions } from './membership-service.js';
import { RoleGraphResolver, type RoleGraphResolverOptions } from './role-graph-resolver.js';
import { cloneParams, nowIso, type RuntimeLogger, type SqlExecutor } from './runtime-types.js';

export interface PermissionResolution {
  readonly permissions: PermissionDocument[];
  readonly roles: RoleDocument[];
  readonly cacheKey: string;
  readonly generatedAt: string;
  readonly source: 'database';
}

export interface EntitlementServiceOptions {
  readonly cacheNamespace?: string;
  readonly logger?: RuntimeLogger;
  readonly membershipOptions?: MembershipServiceOptions;
  readonly roleGraphOptions?: RoleGraphResolverOptions;
  readonly permissionCache?: PermissionCache;
}

interface RoleRow extends QueryResultRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

export class EntitlementService {
  private readonly membershipService: MembershipService;
  private readonly roleGraphResolver: RoleGraphResolver;
  private readonly cacheNamespace: string;
  private readonly logger?: RuntimeLogger;
  private readonly permissionCache?: PermissionCache;
  private readonly localCache = new Map<string, { permissions: PermissionDocument[]; expiresAt: number }>();
  private readonly localCacheTtlMs = 500;

  constructor(private readonly executor: SqlExecutor, options: EntitlementServiceOptions = {}) {
    this.logger = options.logger;
    this.membershipService = new MembershipService(executor, { logger: this.logger, ...options.membershipOptions });
    this.roleGraphResolver = new RoleGraphResolver(executor, { logger: this.logger, ...options.roleGraphOptions });
    this.cacheNamespace = options.cacheNamespace ?? 'entitlements';
    this.permissionCache = options.permissionCache;
  }

  async getUserPermissions(userId: string, organizationId: string): Promise<PermissionDocument[]> {
    return this.fetchPermissionsWithCache(userId, organizationId);
  }

  async hasPermission(userId: string, organizationId: string, permission: string): Promise<boolean> {
    const normalized = permission.trim();
    if (!normalized) {
      return false;
    }
    const permissions = await this.fetchPermissionsWithCache(userId, organizationId);
    const matcher = buildPermissionMatcher(normalized);
    return permissions.some(matcher);
  }

  async resolveUserPermissions(userId: string, organizationId: string): Promise<PermissionResolution> {
    return this.computePermissionSnapshot(userId, organizationId);
  }

  async getUserRoles(userId: string, organizationId: string): Promise<RoleDocument[]> {
    const memberships = await this.membershipService.listUserMemberships(userId, organizationId);
    const roleIds = [...new Set(memberships.map((membership) => membership.role_id))];
    if (roleIds.length === 0) {
      return [];
    }
    return this.fetchRolesByIds(roleIds);
  }

  private async getPermissionsForRole(
    roleId: string,
    cache: Map<string, PermissionDocument[]>
  ): Promise<PermissionDocument[]> {
    const cached = cache.get(roleId);
    if (cached) {
      return cached;
    }
    const permissions = await this.roleGraphResolver.getInheritedPermissions(roleId);
    cache.set(roleId, permissions);
    return permissions;
  }

  private async fetchRolesByIds(roleIds: readonly string[]): Promise<RoleDocument[]> {
    if (roleIds.length === 1) {
      const result = await this.executor.query<RoleRow>(
        'SELECT id, name, description FROM authz.roles WHERE id = $1::uuid',
        cloneParams([roleIds[0]])
      );
      return result.rows.map((row) =>
        RoleSchema.parse({
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
        })
      );
    }

    const result = await this.executor.query<RoleRow>(
      'SELECT id, name, description FROM authz.roles WHERE id = ANY($1::uuid[]) ORDER BY name ASC;',
      cloneParams([roleIds])
    );
    return result.rows.map((row) =>
      RoleSchema.parse({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
      })
    );
  }

  private async fetchPermissionsWithCache(userId: string, organizationId: string): Promise<PermissionDocument[]> {
    if (!this.permissionCache) {
      const cached = this.readLocalCache(userId, organizationId);
      if (cached) {
        return [...cached];
      }
      const snapshot = await this.computePermissionSnapshot(userId, organizationId);
      this.writeLocalCache(userId, organizationId, snapshot.permissions);
      return [...snapshot.permissions];
    }
    const result = await this.permissionCache.getPermissions(userId, organizationId, {
      loader: async () => (await this.computePermissionSnapshot(userId, organizationId)).permissions,
    });
    this.logger?.debug?.('permission_cache_lookup', {
      userId,
      organizationId,
      source: result.source,
      cacheKey: result.cacheKey,
      latencyMs: Number(result.latencyMs.toFixed(3)),
    });
    if (result.permissions) {
      return [...result.permissions];
    }
    const snapshot = await this.computePermissionSnapshot(userId, organizationId);
    await this.permissionCache.setPermissions(userId, organizationId, snapshot.permissions);
    return [...snapshot.permissions];
  }

  private readLocalCache(userId: string, organizationId: string): PermissionDocument[] | null {
    const entry = this.localCache.get(this.localCacheKey(userId, organizationId));
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < TimeService.nowSystem().toMillis()) {
      this.localCache.delete(this.localCacheKey(userId, organizationId));
      return null;
    }
    return entry.permissions;
  }

  private writeLocalCache(userId: string, organizationId: string, permissions: readonly PermissionDocument[]): void {
    this.localCache.set(this.localCacheKey(userId, organizationId), {
      permissions: [...permissions],
      expiresAt: TimeService.nowSystem().toMillis() + this.localCacheTtlMs,
    });
  }

  private localCacheKey(userId: string, organizationId: string): string {
    return `${organizationId}:${userId}`;
  }

  private async computePermissionSnapshot(userId: string, organizationId: string): Promise<PermissionResolution> {
    const directRoles = await this.getUserRoles(userId, organizationId);
    if (directRoles.length === 0) {
      return {
        permissions: [],
        roles: [],
        cacheKey: this.buildCacheKey(userId, organizationId, []),
        generatedAt: nowIso(),
        source: 'database',
      } satisfies PermissionResolution;
    }

    const permissionMap = new Map<string, PermissionDocument>();
    const resolverCache = new Map<string, PermissionDocument[]>();

    for (const role of directRoles) {
      const inherited = await this.getPermissionsForRole(role.id, resolverCache);
      for (const permission of inherited) {
        permissionMap.set(permission.id, permission);
      }
    }

    const permissions = [...permissionMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const snapshot: PermissionResolution = {
      permissions,
      roles: directRoles,
      cacheKey: this.buildCacheKey(userId, organizationId, directRoles),
      generatedAt: nowIso(),
      source: 'database',
    };

    this.logger?.debug?.('entitlements_resolved', {
      userId,
      organizationId,
      permissionCount: permissions.length,
      roleCount: directRoles.length,
      ts: snapshot.generatedAt,
    });

    return snapshot;
  }

  private buildCacheKey(userId: string, organizationId: string, roles: readonly RoleDocument[]): string {
    const hash = createHash('sha1');
    hash.update(userId);
    hash.update(':');
    hash.update(organizationId);
    hash.update(':');
    const roleIds = roles.map((role) => role.id).sort();
    hash.update(roleIds.join(','));
    const digest = hash.digest('hex');
    return `${this.cacheNamespace}:${organizationId}:${userId}:${digest}`;
  }
}

function buildPermissionMatcher(needle: string): (permission: PermissionDocument) => boolean {
  const target = needle.toLowerCase();
  const isUuid = /^[0-9a-f-]{32,36}$/i.test(needle);
  if (isUuid) {
    return (permission) => permission.id.toLowerCase() === target;
  }
  return (permission) => permission.name.toLowerCase() === target;
}
