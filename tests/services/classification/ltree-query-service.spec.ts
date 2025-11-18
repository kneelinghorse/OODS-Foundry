import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';

import {
  LtreeQueryService,
  buildLtreePath,
  type QueryResult,
  type TaxonomyDatabaseClient,
} from '@/services/classification/ltree-query-service.js';

class SqliteClient implements TaxonomyDatabaseClient {
  constructor(private readonly db: Database) {}

  async query<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return { rows, rowCount: rows.length };
    } finally {
      stmt.free();
    }
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<number> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      stmt.step();
      return this.db.getRowsModified();
    } finally {
      stmt.free();
    }
  }
}

describe('LtreeQueryService', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let client: SqliteClient;
  let service: LtreeQueryService;
  const tenantId = 'tenant-a';

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: (file) => resolve(process.cwd(), 'node_modules/sql.js/dist', file),
    });
  });

  beforeEach(() => {
    ({ db, client, service } = createClassificationService(SQL, tenantId));
  });

  afterEach(() => {
    db.close();
  });

  it('normalizes arbitrary segments into ltree paths', () => {
    expect(buildLtreePath(['Electronics', 'Mobile Phones', 'Android Cases'])).toBe(
      'electronics.mobile_phones.android_cases'
    );
  });

  it('fetches subtree using sqlite projections with depth limit', async () => {
    const subtree = await service.fetchSubtree({
      tenantId,
      path: 'electronics',
      includeRoot: true,
      depthLimit: 1,
    });

    expect(subtree.map((row) => row.identifier)).toEqual(['electronics', 'accessories', 'mobile']);
  });

  it('fetches ordered ancestors for a leaf node', async () => {
    const ancestors = await service.fetchAncestors({
      tenantId,
      categoryId: 'cat-cases',
      includeSelf: false,
      order: 'asc',
    });

    expect(ancestors.map((row) => row.identifier)).toEqual(['electronics', 'accessories']);
  });

  it('reparents a branch and maintains child counts + performance target', async () => {
    await service.reparentSubtree({
      tenantId,
      categoryId: 'cat-accessories',
      newParentId: 'cat-mobile',
      actor: 'warm-run',
    });

    db.close();
    ({ db, client, service } = createClassificationService(SQL, tenantId));

    const start = performance.now();
    const moved = await service.reparentSubtree({
      tenantId,
      categoryId: 'cat-accessories',
      newParentId: 'cat-mobile',
      actor: 'test-suite',
    });
    const durationMs = performance.now() - start;

    expect(moved).toBe(2);
    expect(durationMs).toBeLessThan(10);

    const mobileSubtree = await service.fetchSubtree({
      tenantId,
      path: 'electronics.mobile',
      includeRoot: true,
    });

    expect(mobileSubtree.map((row) => row.ltree_path)).toEqual([
      'electronics.mobile',
      'electronics.mobile.accessories',
      'electronics.mobile.accessories.cases',
      'electronics.mobile.android',
      'electronics.mobile.ios',
    ]);

    const counts = await client.query<{ category_id: string; child_count: number }>(
      `SELECT category_id, child_count
       FROM classification_categories
       WHERE category_id IN (?, ?, ?)
       ORDER BY category_id`,
      ['cat-accessories', 'cat-electronics', 'cat-mobile']
    );

    expect(counts.rows).toEqual([
      { category_id: 'cat-accessories', child_count: 1 },
      { category_id: 'cat-electronics', child_count: 1 },
      { category_id: 'cat-mobile', child_count: 3 },
    ]);
  });
});

function bootstrapSchema(db: Database): void {
  db.run(`
    CREATE TABLE classification_categories (
      tenant_id TEXT NOT NULL,
      category_id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      ltree_path TEXT NOT NULL,
      depth INTEGER NOT NULL,
      child_count INTEGER NOT NULL DEFAULT 0,
      is_selectable INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

interface SeedRecord {
  id: string;
  identifier: string;
  slug: string;
  name: string;
  parent: string | null;
  path: string;
  depth: number;
  childCount: number;
}

function seedData(db: Database, tenantId: string): void {
  const now = new Date().toISOString();
  const rows: SeedRecord[] = [
    {
      id: 'cat-electronics',
      identifier: 'electronics',
      slug: 'electronics',
      name: 'Electronics',
      parent: null,
      path: 'electronics',
      depth: 0,
      childCount: 2,
    },
    {
      id: 'cat-mobile',
      identifier: 'mobile',
      slug: 'mobile-phones',
      name: 'Mobile Phones',
      parent: 'cat-electronics',
      path: 'electronics.mobile',
      depth: 1,
      childCount: 2,
    },
    {
      id: 'cat-android',
      identifier: 'android',
      slug: 'android',
      name: 'Android Phones',
      parent: 'cat-mobile',
      path: 'electronics.mobile.android',
      depth: 2,
      childCount: 0,
    },
    {
      id: 'cat-ios',
      identifier: 'ios',
      slug: 'ios',
      name: 'iOS Phones',
      parent: 'cat-mobile',
      path: 'electronics.mobile.ios',
      depth: 2,
      childCount: 0,
    },
    {
      id: 'cat-accessories',
      identifier: 'accessories',
      slug: 'accessories',
      name: 'Accessories',
      parent: 'cat-electronics',
      path: 'electronics.accessories',
      depth: 1,
      childCount: 1,
    },
    {
      id: 'cat-cases',
      identifier: 'cases',
      slug: 'cases',
      name: 'Cases',
      parent: 'cat-accessories',
      path: 'electronics.accessories.cases',
      depth: 2,
      childCount: 0,
    },
  ];

  for (const record of rows) {
    db.run(
      `INSERT INTO classification_categories
        (tenant_id, category_id, identifier, slug, name, parent_id, ltree_path, depth, child_count, is_selectable, mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'taxonomy', ?, ?)`,
      [
        tenantId,
        record.id,
        record.identifier,
        record.slug,
        record.name,
        record.parent,
        record.path,
        record.depth,
        record.childCount,
        now,
        now,
      ]
    );
  }

function createClassificationService(
  SQL: SqlJsStatic,
  tenantId: string
): { db: Database; client: SqliteClient; service: LtreeQueryService } {
  const nextDb = new SQL.Database();
  const nextClient = new SqliteClient(nextDb);
  bootstrapSchema(nextDb);
  seedData(nextDb, tenantId);
  const nextService = new LtreeQueryService(nextClient, {
    dialect: 'sqlite',
    tableName: 'classification_categories',
  });
  return { db: nextDb, client: nextClient, service: nextService };
  }
}

function createClassificationService(
  SQL: SqlJsStatic,
  tenantId: string
): { db: Database; client: SqliteClient; service: LtreeQueryService } {
  const nextDb = new SQL.Database();
  const nextClient = new SqliteClient(nextDb);
  bootstrapSchema(nextDb);
  seedData(nextDb, tenantId);
  const nextService = new LtreeQueryService(nextClient, {
    dialect: 'sqlite',
    tableName: 'classification_categories',
  });
  return { db: nextDb, client: nextClient, service: nextService };
}
