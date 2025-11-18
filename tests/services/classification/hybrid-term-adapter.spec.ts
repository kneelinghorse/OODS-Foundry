import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { resolve } from 'node:path';

import { HybridTermAdapter } from '@/services/classification/hybrid-term-adapter.js';
import type { HybridBridgeClient } from '@/services/classification/hybrid-term-adapter.js';
import type { QueryResult } from '@/services/classification/ltree-query-service.js';

class SqliteHybridClient implements HybridBridgeClient {
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
}

describe('HybridTermAdapter', () => {
  let SQL: SqlJsStatic;
  let db: Database;
  let adapter: HybridTermAdapter;
  let client: SqliteHybridClient;
  const tenantId = 'tenant-a';

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: (file) => resolve(process.cwd(), 'node_modules/sql.js/dist', file),
    });
  });

  beforeEach(() => {
    db = new SQL.Database();
    bootstrapHybridSchema(db);
    client = new SqliteHybridClient(db);
    adapter = new HybridTermAdapter(client, {
      dialect: 'sqlite',
      termsTable: '"classification.terms"',
      taxonomyTable: '"classification.term_taxonomy"',
      relationshipsTable: '"classification.term_relationships"',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('shares canonical terms between taxonomy and tags', async () => {
    insertCategory(db, tenantId, { id: 'cat-news', slug: 'news' });
    insertTag(db, tenantId, { id: 'tag-news', slug: 'news' });

    const category = await adapter.ensureEntry({
      tenantId,
      slug: 'news',
      name: 'News',
      taxonomy: 'category',
      categoryId: 'cat-news',
      hierarchyPath: 'content.news',
    });

    const tag = await adapter.ensureEntry({
      tenantId,
      slug: 'news',
      name: 'News',
      taxonomy: 'tag',
      tagId: 'tag-news',
    });

    expect(category.term.id).toBe(tag.term.id);
    expect(category.taxonomy.taxonomy).toBe('category');
    expect(tag.taxonomy.taxonomy).toBe('tag');

    const termRows = await client.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM "classification.terms"'
    );
    expect(termRows.rows[0]?.total).toBe(1);

    const taxonomyRows = await client.query<{ term_id: string; taxonomy: string }>(
      'SELECT term_id, taxonomy FROM "classification.term_taxonomy" ORDER BY taxonomy'
    );
    expect(taxonomyRows.rows).toEqual([
      { term_id: category.term.id as string, taxonomy: 'category' },
      { term_id: tag.term.id as string, taxonomy: 'tag' },
    ]);
  });

  it('deduplicates relationships and bumps relationship counts', async () => {
    insertCategory(db, tenantId, { id: 'cat-hardware', slug: 'hardware' });
    insertTag(db, tenantId, { id: 'tag-trending', slug: 'trending' });

    const hardware = await adapter.ensureEntry({
      tenantId,
      slug: 'hardware',
      name: 'Hardware',
      taxonomy: 'category',
      categoryId: 'cat-hardware',
      hierarchyPath: 'electronics.hardware',
    });

    const trending = await adapter.ensureEntry({
      tenantId,
      slug: 'trending',
      name: 'Trending',
      taxonomy: 'tag',
      tagId: 'tag-trending',
    });

    await adapter.assignRelationship({
      tenantId,
      objectType: 'product',
      objectId: 'prod-1',
      termTaxonomyId: hardware.taxonomy.id as string,
      field: 'primary',
    });

    await adapter.assignRelationship({
      tenantId,
      objectType: 'product',
      objectId: 'prod-1',
      termTaxonomyId: hardware.taxonomy.id as string,
      field: 'primary',
    });

    const relRows = await client.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM "classification.term_relationships"'
    );
    expect(relRows.rows[0]?.total).toBe(1);

    const hardwareCount = await client.query<{ relationship_count: number }>(
      'SELECT relationship_count FROM "classification.term_taxonomy" WHERE term_taxonomy_id = ? LIMIT 1',
      [hardware.taxonomy.id]
    );
    expect(hardwareCount.rows[0]?.relationship_count).toBe(1);

    await adapter.assignRelationship({
      tenantId,
      objectType: 'product',
      objectId: 'prod-1',
      termTaxonomyId: trending.taxonomy.id as string,
      field: 'secondary',
    });

    const trendingCount = await client.query<{ relationship_count: number }>(
      'SELECT relationship_count FROM "classification.term_taxonomy" WHERE term_taxonomy_id = ? LIMIT 1',
      [trending.taxonomy.id]
    );
    expect(trendingCount.rows[0]?.relationship_count).toBe(1);
  });
});

function bootstrapHybridSchema(db: Database): void {
  db.run(`
    CREATE TABLE "classification.terms" (
      tenant_id TEXT NOT NULL,
      term_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      language TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, slug)
    );
  `);

  db.run(`
    CREATE TABLE "classification.categories" (
      category_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      slug TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE "classification.tags" (
      tag_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      slug TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE "classification.term_taxonomy" (
      tenant_id TEXT NOT NULL,
      term_taxonomy_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      term_id TEXT NOT NULL,
      taxonomy TEXT NOT NULL,
      category_id TEXT,
      tag_id TEXT,
      parent_term_taxonomy_id TEXT,
      hierarchy_path TEXT,
      depth INTEGER NOT NULL DEFAULT 0,
      relationship_count INTEGER NOT NULL DEFAULT 0,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (term_id) REFERENCES "classification.terms" (term_id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES "classification.categories" (category_id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES "classification.tags" (tag_id) ON DELETE CASCADE,
      UNIQUE (tenant_id, term_id, taxonomy)
    );
  `);

  db.run(`
    CREATE TABLE "classification.term_relationships" (
      tenant_id TEXT NOT NULL,
      object_type TEXT NOT NULL,
      object_id TEXT NOT NULL,
      term_taxonomy_id TEXT NOT NULL,
      field TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, object_type, object_id, term_taxonomy_id),
      FOREIGN KEY (term_taxonomy_id) REFERENCES "classification.term_taxonomy" (term_taxonomy_id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TRIGGER term_relations_increment
    AFTER INSERT ON "classification.term_relationships"
    BEGIN
      UPDATE "classification.term_taxonomy"
      SET relationship_count = relationship_count + 1
      WHERE term_taxonomy_id = NEW.term_taxonomy_id;
    END;
  `);

  db.run(`
    CREATE TRIGGER term_relations_decrement
    AFTER DELETE ON "classification.term_relationships"
    BEGIN
      UPDATE "classification.term_taxonomy"
      SET relationship_count = CASE
        WHEN relationship_count > 0 THEN relationship_count - 1
        ELSE 0
      END
      WHERE term_taxonomy_id = OLD.term_taxonomy_id;
    END;
  `);
}

function insertCategory(db: Database, tenantId: string, record: { id: string; slug: string }): void {
  db.run(
    `INSERT INTO "classification.categories" (category_id, tenant_id, slug) VALUES (?, ?, ?)`,
    [record.id, tenantId, record.slug]
  );
}

function insertTag(db: Database, tenantId: string, record: { id: string; slug: string }): void {
  db.run(`INSERT INTO "classification.tags" (tag_id, tenant_id, slug) VALUES (?, ?, ?)`, [record.id, tenantId, record.slug]);
}
