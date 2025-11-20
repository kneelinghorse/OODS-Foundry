#!/usr/bin/env node
import process from 'node:process';

import { Pool } from 'pg';

export interface Queryable {
  query: (text: string, values?: readonly unknown[]) => Promise<unknown>;
}

export interface SeedExecutionOptions {
  readonly dryRun?: boolean;
}

export interface SeedCliOptions {
  readonly databaseUrl: string;
  readonly dryRun: boolean;
}

export function parseSeedCliArgs(argv: readonly string[]): SeedCliOptions {
  let databaseUrl =
    process.env.COMMUNICATION_DATABASE_URL || process.env.COMMUNICATION_DB_URL || process.env.DATABASE_URL || '';
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--url' || token === '--database-url') {
      databaseUrl = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (token === '--dry-run') {
      dryRun = true;
    }
  }

  if (!databaseUrl && !dryRun) {
    throw new Error('Missing database connection string. Provide --url or set COMMUNICATION_DATABASE_URL.');
  }

  return { databaseUrl, dryRun };
}

export async function runSeedCli(
  argv: readonly string[],
  commandLabel: string,
  handler: (queryable: Queryable | null, options: Required<SeedExecutionOptions>) => Promise<void>
): Promise<void> {
  const options = parseSeedCliArgs(argv);
  const pool = options.dryRun ? null : new Pool({ connectionString: options.databaseUrl });

  try {
    await handler(pool, { dryRun: options.dryRun });
    console.log(
      options.dryRun
        ? `[${commandLabel}] Dry-run completed. No rows were written.`
        : `[${commandLabel}] Seed execution completed.`
    );
  } catch (error) {
    console.error(`[${commandLabel}] Seed execution failed:`, error);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

export function requireQueryable(queryable: Queryable | null): Queryable {
  if (!queryable) {
    throw new Error('Database connection required for seed execution.');
  }
  return queryable;
}
