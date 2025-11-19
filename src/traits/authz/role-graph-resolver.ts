import { createHash } from 'node:crypto';

import type { QueryResultRow } from 'pg';

import {
  PermissionSchema,
  type PermissionDocument,
} from '@/schemas/authz/permission.schema.js';
import { RoleSchema, type RoleDocument } from '@/schemas/authz/role.schema.js';

import { cloneParams, nowIso, type RuntimeLogger, type SqlExecutor } from './runtime-types.js';

export interface RoleHierarchyNode extends RoleDocument {
  readonly depth: number;
}

export interface RoleGraphResolverOptions {
  readonly depthLimit?: number;
  readonly logger?: RuntimeLogger;
}

export class RoleGraphResolverError extends Error {}

interface RoleHierarchyRow extends QueryResultRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly depth: number;
}

interface PermissionRow extends QueryResultRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly resource_type: string | null;
}

const ROLE_TREE_CTE = `
WITH RECURSIVE role_tree AS (
  SELECT r.id,
         r.name,
         r.description,
         0 AS depth,
         ARRAY[r.id] AS path
  FROM authz.roles r
  WHERE r.id = $1
  UNION ALL
  SELECT parent.id,
         parent.name,
         parent.description,
         child.depth + 1,
         child.path || parent.id
  FROM role_tree child
  JOIN authz.role_hierarchy h ON h.child_role_id = child.id
  JOIN authz.roles parent ON parent.id = h.parent_role_id
  WHERE NOT parent.id = ANY(child.path)
    AND child.depth + 1 <= $2
)
`;

const RESOLVE_HIERARCHY_SQL = `${ROLE_TREE_CTE}
SELECT id, name, description, depth
FROM role_tree
ORDER BY depth ASC, name ASC;`;

const INHERITED_PERMISSIONS_SQL = `${ROLE_TREE_CTE}
SELECT DISTINCT p.id, p.name, p.description, p.resource_type
FROM role_tree tree
JOIN authz.role_permissions rp ON rp.role_id = tree.id
JOIN authz.permissions p ON p.id = rp.permission_id
ORDER BY p.name ASC;`;

const ROLE_EXISTS_SQL = 'SELECT 1 FROM authz.roles WHERE id = $1';

const DEFAULT_DEPTH_LIMIT = 5;

export class RoleGraphResolver {
  private readonly depthLimit: number;
  private readonly logger?: RuntimeLogger;

  constructor(private readonly executor: SqlExecutor, options: RoleGraphResolverOptions = {}) {
    this.depthLimit = Math.max(1, options.depthLimit ?? DEFAULT_DEPTH_LIMIT);
    this.logger = options.logger;
  }

  async resolveRoleHierarchy(roleId: string): Promise<RoleHierarchyNode[]> {
    const rows = await this.runQuery<RoleHierarchyRow>(RESOLVE_HIERARCHY_SQL, [roleId, this.depthLimit]);
    if (rows.length === 0) {
      throw new RoleGraphResolverError(`Role ${roleId} was not found in authz.roles.`);
    }

    return rows.map((row) => ({
      ...RoleSchema.parse({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
      }),
      depth: row.depth,
    }));
  }

  async getInheritedPermissions(roleId: string): Promise<PermissionDocument[]> {
    const rows = await this.runQuery<PermissionRow>(INHERITED_PERMISSIONS_SQL, [roleId, this.depthLimit]);
    if (rows.length === 0) {
      await this.ensureRoleExists(roleId);
      return [];
    }

    return rows.map((row) =>
      PermissionSchema.parse({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        resource_type: row.resource_type ?? undefined,
      })
    );
  }

  private async runQuery<T extends QueryResultRow>(sql: string, params: readonly unknown[]): Promise<T[]> {
    const startedAt = performance.now();
    const result = await this.executor.query<T>(sql, cloneParams(params));
    this.logger?.debug?.('role_graph_query', {
      sqlId: createSqlFingerprint(sql),
      rowCount: result.rowCount ?? result.rows?.length ?? 0,
      duration_ms: Number((performance.now() - startedAt).toFixed(3)),
      ts: nowIso(),
    });
    return result.rows ?? [];
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const exists = await this.executor.query(ROLE_EXISTS_SQL, cloneParams([roleId]));
    if ((exists.rowCount ?? 0) === 0) {
      throw new RoleGraphResolverError(`Role ${roleId} was not found in authz.roles.`);
    }
  }
}

function createSqlFingerprint(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const digest = createHash('sha1').update(normalized).digest('hex').slice(0, 8);
  return `${normalized.slice(0, 24)}…#${digest}`;
}
