/**
 * ltree query utilities for taxonomy storage.
 *
 * Exposes helpers that work against PostgreSQL (ltree) as well as sqlite
 * projections so tests can run deterministically without Docker.
 */

import { normalizeLtreePath } from '@/schemas/classification/utils.js';
import TimeService from '@/services/time/index.js';

export type DatabaseDialect = 'postgres' | 'sqlite';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface TaxonomyDatabaseClient {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  execute?(sql: string, params?: readonly unknown[]): Promise<number>;
}

export interface LtreeQueryServiceOptions {
  dialect?: DatabaseDialect;
  tableName?: string;
  reparentFunction?: string;
}

export interface SubtreeQueryOptions {
  tenantId: string;
  path: string;
  depthLimit?: number;
  includeRoot?: boolean;
}

export interface AncestorQueryOptions {
  tenantId: string;
  categoryId: string;
  includeSelf?: boolean;
  order?: 'asc' | 'desc';
}

export interface ReparentOptions {
  tenantId: string;
  categoryId: string;
  newParentId: string | null;
  actor?: string;
}

export interface CategoryRow {
  tenant_id: string;
  category_id: string;
  parent_id: string | null;
  identifier: string;
  slug: string;
  name: string;
  ltree_path: string;
  depth: number;
  child_count: number;
  mode: string;
  is_selectable: boolean | number;
}

interface QueryPayload {
  sql: string;
  params: unknown[];
}

/**
 * Build normalized ltree path from raw input (string or path segments).
 */
export function buildLtreePath(input: string | readonly string[]): string {
  if (typeof input === 'string') {
    const fallback = splitSegments(input);
    return normalizeLtreePath(input, fallback);
  }
  const segments = [...input];
  if (segments.length === 0) {
    throw new Error('At least one segment is required to build an ltree path.');
  }
  return normalizeLtreePath(segments, segments);
}

export class LtreeQueryService {
  private readonly dialect: DatabaseDialect;
  private readonly tableName: string;
  private readonly reparentFunction: string;
  private readonly selectColumns = [
    'tenant_id',
    'category_id',
    'parent_id',
    'identifier',
    'slug',
    'name',
    'ltree_path',
    'depth',
    'child_count',
    'mode',
    'is_selectable',
  ];

  constructor(
    private readonly client: TaxonomyDatabaseClient,
    options: LtreeQueryServiceOptions = {}
  ) {
    this.dialect = options.dialect ?? 'postgres';
    this.tableName = options.tableName ?? 'classification.categories';
    this.reparentFunction = options.reparentFunction ?? 'classification.reparent_category';
  }

  async fetchSubtree(options: SubtreeQueryOptions): Promise<CategoryRow[]> {
    const normalizedPath = buildLtreePath(options.path);
    const query = this.buildSubtreeQuery({ ...options, path: normalizedPath });
    const result = await this.client.query<CategoryRow>(query.sql, query.params);
    return result.rows;
  }

  async fetchAncestors(options: AncestorQueryOptions): Promise<CategoryRow[]> {
    if (!options.tenantId) {
      throw new Error('tenantId is required.');
    }
    if (!options.categoryId) {
      throw new Error('categoryId is required.');
    }

    if (this.dialect === 'sqlite') {
      const targetPath = await this.fetchSqliteTargetPath(options.tenantId, options.categoryId);
      if (!targetPath) {
        return [];
      }
      const sqliteQuery = this.buildSqliteAncestorQuery(targetPath, options);
      const sqliteResult = await this.client.query<CategoryRow>(sqliteQuery.sql, sqliteQuery.params);
      return sqliteResult.rows;
    }

    const query = this.buildPostgresAncestorQuery(options);
    const result = await this.client.query<CategoryRow>(query.sql, query.params);
    return result.rows;
  }

  async reparentSubtree(options: ReparentOptions): Promise<number> {
    if (!options.tenantId) {
      throw new Error('tenantId is required.');
    }
    if (!options.categoryId) {
      throw new Error('categoryId is required.');
    }

    if (this.dialect === 'postgres') {
      const params: unknown[] = [];
      const tenantPlaceholder = this.pushParam(params, options.tenantId);
      const categoryPlaceholder = this.pushParam(params, options.categoryId);
      const parentPlaceholder = this.pushParam(params, options.newParentId ?? null);
      const actorPlaceholder = this.pushParam(params, options.actor ?? 'ltree-migrator');
      const sql = `SELECT ${this.reparentFunction}(${this.cast(tenantPlaceholder, 'uuid')}, ${this.cast(
        categoryPlaceholder,
        'uuid'
      )}, ${this.cast(parentPlaceholder, 'uuid')}, ${actorPlaceholder}) AS updated`;
      const result = await this.client.query<{ updated: number }>(sql, params);
      return result.rows[0]?.updated ?? 0;
    }

    return this.sqliteReparent(options);
  }

  private buildSubtreeQuery(options: SubtreeQueryOptions & { path: string }): QueryPayload {
    const includeRoot = options.includeRoot ?? true;
    const params: unknown[] = [];
    const tenantParam = this.pushParam(params, options.tenantId);
    let sql = `SELECT ${this.columns('c')} FROM ${this.tableName} c WHERE c.tenant_id = ${tenantParam} `;
    const basePathParam = this.pushParam(params, options.path);

    if (this.dialect === 'postgres') {
      sql += `AND c.ltree_path <@ text2ltree(${basePathParam}) `;
      if (!includeRoot) {
        const rootParam = this.reuseParam(params, basePathParam, options.path);
        sql += `AND c.ltree_path <> text2ltree(${rootParam}) `;
      }
    } else {
      const likeParam = this.pushParam(params, `${options.path}.%`);
      sql += `AND (c.ltree_path = ${basePathParam} OR c.ltree_path LIKE ${likeParam}) `;
      if (!includeRoot) {
        const rootParam = this.reuseParam(params, basePathParam, options.path);
        sql += `AND c.ltree_path <> ${rootParam} `;
      }
    }

    if (typeof options.depthLimit === 'number') {
      const baseDepth = Math.max(this.countSegments(options.path) - 1, 0);
      const maxDepth = baseDepth + options.depthLimit;
      const depthParam = this.pushParam(params, maxDepth);
      sql += `AND c.depth <= ${depthParam} `;
    }

    sql += 'ORDER BY c.ltree_path';
    return { sql, params };
  }

  private buildPostgresAncestorQuery(options: AncestorQueryOptions): QueryPayload {
    const params: unknown[] = [];
    const tenantParam = this.pushParam(params, options.tenantId);
    const tenantParamOuter = this.reuseParam(params, tenantParam, options.tenantId);
    const categoryParam = this.pushParam(params, options.categoryId);
    const includeSelf = options.includeSelf ?? true;
    const direction = options.order === 'desc' ? 'DESC' : 'ASC';

    if (this.dialect === 'postgres') {
      let sql = `WITH target AS (
        SELECT ltree_path FROM ${this.tableName}
        WHERE tenant_id = ${tenantParam} AND category_id = ${categoryParam}
      )
      SELECT ${this.columns('ancestor')}
      FROM ${this.tableName} ancestor
      JOIN target ON TRUE
      WHERE ancestor.tenant_id = ${tenantParamOuter}
        AND ancestor.ltree_path @> target.ltree_path `;

      if (!includeSelf) {
        sql += 'AND ancestor.ltree_path <> target.ltree_path ';
      }

      sql += `ORDER BY ancestor.depth ${direction}`;
      return { sql, params };
    }

    let sql = `WITH target AS (
      SELECT ltree_path FROM ${this.tableName}
      WHERE tenant_id = ${tenantParam} AND category_id = ${categoryParam}
    )
    SELECT ${this.columns('ancestor')}
    FROM ${this.tableName} ancestor
    JOIN target ON TRUE
    WHERE ancestor.tenant_id = ${this.reuseParam(params, tenantParam, options.tenantId)}
      AND (
        ancestor.ltree_path = target.ltree_path
        OR target.ltree_path LIKE ancestor.ltree_path || '.%'
      ) `;

    if (!includeSelf) {
      sql += 'AND ancestor.ltree_path <> target.ltree_path ';
    }

    sql += `ORDER BY ancestor.depth ${direction}`;
    return { sql, params };
  }

  private buildSqliteAncestorQuery(targetPath: string, options: AncestorQueryOptions): QueryPayload {
    const params: unknown[] = [];
    const tenantParam = this.pushParam(params, options.tenantId);
    const equalsParam = this.pushParam(params, targetPath);
    const likeParam = this.pushParam(params, targetPath);
    let sql = `SELECT ${this.columns('c')}
      FROM ${this.tableName} c
      WHERE c.tenant_id = ${tenantParam}
        AND (${equalsParam} = c.ltree_path OR ${likeParam} LIKE c.ltree_path || '.%')`;

    if (!(options.includeSelf ?? true)) {
      const selfParam = this.pushParam(params, targetPath);
      sql += ` AND c.ltree_path <> ${selfParam}`;
    }

    const direction = options.order === 'desc' ? 'DESC' : 'ASC';
    sql += ` ORDER BY c.depth ${direction}`;
    return { sql, params };
  }

  private async sqliteReparent(options: ReparentOptions): Promise<number> {
    if (!this.client.execute) {
      throw new Error('Database client does not implement execute(), required for sqlite dialect.');
    }

    const currentResult = await this.client.query<{ ltree_path: string; depth: number; parent_id: string | null }>(
      `SELECT ltree_path, depth, parent_id FROM ${this.tableName} WHERE tenant_id = ? AND category_id = ? LIMIT 1`,
      [options.tenantId, options.categoryId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new Error(`Category ${options.categoryId} not found for tenant ${options.tenantId}.`);
    }

    let parentPath: string | null = null;
    let parentDepth = -1;
    if (options.newParentId) {
      const parentResult = await this.client.query<{ ltree_path: string; depth: number }>(
        `SELECT ltree_path, depth FROM ${this.tableName} WHERE tenant_id = ? AND category_id = ? LIMIT 1`,
        [options.tenantId, options.newParentId]
      );
      const parent = parentResult.rows[0];
      if (!parent) {
        throw new Error(`Parent ${options.newParentId} not found for tenant ${options.tenantId}.`);
      }
      if (
        parent.ltree_path === current.ltree_path ||
        parent.ltree_path.startsWith(`${current.ltree_path}.`)
      ) {
        throw new Error('Cannot reparent a node into its own subtree.');
      }
      parentPath = parent.ltree_path;
      parentDepth = parent.depth;
    }

    const subtree = await this.client.query<{ category_id: string; ltree_path: string; depth: number }>(
      `SELECT category_id, ltree_path, depth FROM ${this.tableName}
       WHERE tenant_id = ? AND (ltree_path = ? OR ltree_path LIKE ?)
       ORDER BY depth`,
      [options.tenantId, current.ltree_path, `${current.ltree_path}.%`]
    );

    const updatedAt = TimeService.toIsoString(TimeService.nowSystem());
    await this.client.execute('BEGIN');

    try {
      for (const node of subtree.rows) {
        const suffix = this.slicePath(node.ltree_path, current.depth);
        const newPath = parentPath ? this.joinPaths(parentPath, suffix) : suffix;
        const depthDelta = node.depth - current.depth;
        const newDepth = parentPath ? parentDepth + 1 + depthDelta : depthDelta;
        await this.client.execute(
          `UPDATE ${this.tableName}
             SET ltree_path = ?, depth = ?, updated_at = ?
           WHERE tenant_id = ? AND category_id = ?`,
          [newPath, newDepth, updatedAt, options.tenantId, node.category_id]
        );
      }

      await this.client.execute(
        `UPDATE ${this.tableName}
           SET parent_id = ?
         WHERE tenant_id = ? AND category_id = ?`,
        [options.newParentId, options.tenantId, options.categoryId]
      );

      await this.client.execute(`UPDATE ${this.tableName} SET child_count = 0 WHERE tenant_id = ?`, [
        options.tenantId,
      ]);

      const aggregates = await this.client.query<{ parent_id: string; total: number }>(
        `SELECT parent_id, COUNT(*) AS total
         FROM ${this.tableName}
         WHERE tenant_id = ? AND parent_id IS NOT NULL
         GROUP BY parent_id`,
        [options.tenantId]
      );

      for (const aggregate of aggregates.rows) {
        await this.client.execute(
          `UPDATE ${this.tableName}
             SET child_count = ?
           WHERE tenant_id = ? AND category_id = ?`,
          [aggregate.total, options.tenantId, aggregate.parent_id]
        );
      }

      await this.client.execute('COMMIT');
    } catch (error) {
      await this.client.execute('ROLLBACK');
      throw error;
    }

    return subtree.rows.length;
  }

  private pushParam(params: unknown[], value: unknown): string {
    params.push(value);
    const index = params.length;
    return this.dialect === 'postgres' ? `$${index}` : '?';
  }

  private reuseParam(params: unknown[], placeholder: string, value: unknown): string {
    if (this.dialect === 'postgres') {
      return placeholder;
    }
    return this.pushParam(params, value);
  }

  private columns(alias: string): string {
    return this.selectColumns.map((column) => `${alias}.${column}`).join(', ');
  }

  private async fetchSqliteTargetPath(tenantId: string, categoryId: string): Promise<string | null> {
    const result = await this.client.query<{ ltree_path: string }>(
      `SELECT ltree_path FROM ${this.tableName} WHERE tenant_id = ? AND category_id = ? LIMIT 1`,
      [tenantId, categoryId]
    );
    return result.rows[0]?.ltree_path ?? null;
  }

  private cast(placeholder: string, type: string): string {
    if (this.dialect === 'postgres') {
      return `${placeholder}::${type}`;
    }
    return placeholder;
  }

  private countSegments(path: string): number {
    return splitSegments(path).length;
  }

  private slicePath(path: string, baseDepth: number): string {
    if (baseDepth <= 0) {
      return path;
    }
    const segments = splitSegments(path);
    const sliced = segments.slice(baseDepth);
    return sliced.join('.');
  }

  private joinPaths(parentPath: string, suffix: string): string {
    if (!suffix) {
      return parentPath;
    }
    if (!parentPath) {
      return suffix;
    }
    return `${parentPath}.${suffix}`;
  }
}

function splitSegments(value: string): string[] {
  return value
    .split(/[./]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
