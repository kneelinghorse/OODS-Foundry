#!/usr/bin/env tsx

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import initSqlJs, { type Database } from 'sql.js';

import {
  LtreeQueryService,
  type QueryResult,
  type TaxonomyDatabaseClient,
} from '../../src/services/classification/ltree-query-service.js';

class SqliteBenchClient implements TaxonomyDatabaseClient {
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

interface SeedRecord {
  id: string;
  parent: string | null;
  path: string;
  depth: number;
  childCount: number;
}

async function main(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => resolve(process.cwd(), 'node_modules/sql.js/dist', file),
  });

  const db = new SQL.Database();
  const tenantId = 'bench-tenant';
  bootstrapSchema(db);
  const datasetSize = seedData(db, tenantId);

  const client = new SqliteBenchClient(db);
  const service = new LtreeQueryService(client, {
    dialect: 'sqlite',
    tableName: 'classification_categories',
  });

  const subtreeQuery = {
    tenantId,
    path: 'electronics.mobile',
    includeRoot: false,
    depthLimit: 2,
  };

  // Warm-up to avoid measuring wasm initialization overhead.
  await service.fetchSubtree(subtreeQuery);

  let subtreeDuration = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const start = performance.now();
    await service.fetchSubtree(subtreeQuery);
    subtreeDuration = Math.min(subtreeDuration, performance.now() - start);
  }

  const reparentStart = performance.now();
  await service.reparentSubtree({
    tenantId,
    categoryId: 'cat-accessories',
    newParentId: 'cat-mobile',
    actor: 'bench',
  });
  const reparentDuration = performance.now() - reparentStart;

  const payload = {
    timestamp: new Date().toISOString(),
    dialect: 'sqlite (sql.js)',
    dataset: {
      tenants: 1,
      nodes: datasetSize,
    },
    targets: {
      subtreeMs: '<=3',
      reparentMs: '<=10',
    },
    measurements: {
      subtreeMs: Number(subtreeDuration.toFixed(3)),
      reparentMs: Number(reparentDuration.toFixed(3)),
    },
    notes: 'sqlite mock uses sql.js; postgres path uses classification.reparent_category for production.',
  };

  const outputPath = resolve(process.cwd(), 'diagnostics/classification-ltree-benchmarks.json');
  writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  db.close();
  // eslint-disable-next-line no-console
  console.log(`Wrote classification benchmarks to ${outputPath}`);
}

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
      child_count INTEGER NOT NULL,
      is_selectable INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedData(db: Database, tenantId: string): number {
  const now = new Date().toISOString();
  const records: SeedRecord[] = [
    { id: 'cat-electronics', parent: null, path: 'electronics', depth: 0, childCount: 2 },
    { id: 'cat-mobile', parent: 'cat-electronics', path: 'electronics.mobile', depth: 1, childCount: 3 },
    { id: 'cat-android', parent: 'cat-mobile', path: 'electronics.mobile.android', depth: 2, childCount: 0 },
    { id: 'cat-ios', parent: 'cat-mobile', path: 'electronics.mobile.ios', depth: 2, childCount: 0 },
    { id: 'cat-foldable', parent: 'cat-mobile', path: 'electronics.mobile.foldable', depth: 2, childCount: 0 },
    { id: 'cat-accessories', parent: 'cat-electronics', path: 'electronics.accessories', depth: 1, childCount: 2 },
    { id: 'cat-cases', parent: 'cat-accessories', path: 'electronics.accessories.cases', depth: 2, childCount: 1 },
    { id: 'cat-cases-rugged', parent: 'cat-cases', path: 'electronics.accessories.cases.rugged', depth: 3, childCount: 0 },
    { id: 'cat-chargers', parent: 'cat-accessories', path: 'electronics.accessories.chargers', depth: 2, childCount: 0 },
  ];

  for (const record of records) {
    db.run(
      `INSERT INTO classification_categories
        (tenant_id, category_id, identifier, slug, name, parent_id, ltree_path, depth, child_count, mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'taxonomy', ?, ?)`,
      [
        tenantId,
        record.id,
        record.id.replace('cat-', ''),
        record.id.replace('cat-', '').replace(/_/g, '-'),
        record.id.replace('cat-', '').replace(/-/g, ' '),
        record.parent,
        record.path,
        record.depth,
        record.childCount,
        now,
        now,
      ]
    );
  }

  return records.length;
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
