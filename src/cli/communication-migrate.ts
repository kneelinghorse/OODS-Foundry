#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { Pool } from 'pg';

type MigrationCommand = 'migrate' | 'rollback' | 'status' | 'reset';

interface CliOptions {
  readonly command: MigrationCommand;
  readonly databaseUrl: string;
  readonly dryRun: boolean;
}

interface SqlFileDescriptor {
  readonly name: string;
  readonly absolutePath: string;
}

const MIGRATIONS_DIR = path.resolve('database/migrations');
const ROLLBACK_DIR = path.resolve('database/migrations/rollback');

const COMMUNICATION_MIGRATION_PAIRS = [
  ['20251120_001_create_communication_schema.sql', '20251120_001_drop_communication_schema.sql'],
  ['20251120_002_create_channels_table.sql', '20251120_002_drop_channels_table.sql'],
  ['20251120_003_create_templates_table.sql', '20251120_003_drop_templates_table.sql'],
  ['20251120_004_create_delivery_policies_table.sql', '20251120_004_drop_delivery_policies_table.sql'],
  ['20251120_005_create_messages_table.sql', '20251120_005_drop_messages_table.sql'],
  ['20251120_006_create_message_recipients_table.sql', '20251120_006_drop_message_recipients_table.sql'],
  ['20251120_007_create_delivery_attempts_table.sql', '20251120_007_drop_delivery_attempts_table.sql'],
  ['20251120_008_create_conversations_table.sql', '20251120_008_drop_conversations_table.sql'],
  ['20251120_009_create_conversation_participants_table.sql', '20251120_009_drop_conversation_participants_table.sql'],
  ['20251120_010_create_sla_metrics_table.sql', '20251120_010_drop_sla_metrics_table.sql'],
] as const;

const COMMUNICATION_MIGRATIONS = COMMUNICATION_MIGRATION_PAIRS.map(([migration]) => migration) as readonly string[];

const MIGRATION_FILES: readonly SqlFileDescriptor[] = COMMUNICATION_MIGRATIONS.map((name) => ({
  name,
  absolutePath: path.join(MIGRATIONS_DIR, name),
}));

const ROLLBACK_LOOKUP = new Map<string, SqlFileDescriptor>();
for (const [migrationName, rollbackName] of COMMUNICATION_MIGRATION_PAIRS) {
  const descriptor = { name: rollbackName, absolutePath: path.join(ROLLBACK_DIR, rollbackName) };
  ROLLBACK_LOOKUP.set(migrationName, descriptor);
}

function usage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.log(
    'Usage: pnpm tsx src/cli/communication-migrate.ts <migrate|rollback|status|reset> [--url postgres://] [--dry-run]'
  );
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const [commandRaw, ...rest] = argv;
  if (!commandRaw) {
    usage('Missing command.');
  }
  const command = commandRaw as MigrationCommand;
  if (!['migrate', 'rollback', 'status', 'reset'].includes(command)) {
    usage(`Unsupported command: ${command}`);
  }

  let databaseUrl =
    process.env.COMMUNICATION_DATABASE_URL || process.env.COMMUNICATION_DB_URL || process.env.DATABASE_URL || '';
  let dryRun = false;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--url' || token === '--database-url') {
      databaseUrl = rest[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  if (!databaseUrl) {
    usage('Missing database connection string. Provide --url or set COMMUNICATION_DATABASE_URL.');
  }

  return { command, databaseUrl, dryRun };
}

function loadSql(file: SqlFileDescriptor): string {
  return readFileSync(file.absolutePath, 'utf8');
}

async function schemaMigrationsTableExists(pool: Pool): Promise<boolean> {
  const result = await pool.query("SELECT to_regclass('communication.schema_migrations') AS reg");
  return result.rows[0]?.reg !== null;
}

async function fetchAppliedMigrations(pool: Pool): Promise<readonly string[]> {
  const hasLedger = await schemaMigrationsTableExists(pool);
  if (!hasLedger) {
    return [];
  }
  const result = await pool.query(
    'SELECT filename FROM communication.schema_migrations ORDER BY applied_at ASC'
  );
  return result.rows.map((row) => row.filename as string);
}

function computeChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

async function recordMigration(pool: Pool, filename: string, sql: string): Promise<void> {
  if (!(await schemaMigrationsTableExists(pool))) {
    return;
  }
  const checksum = computeChecksum(sql);
  await pool.query(
    `INSERT INTO communication.schema_migrations (filename, checksum) VALUES ($1, $2)
     ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()`,
    [filename, checksum]
  );
}

async function removeMigrationRecord(pool: Pool, filename: string): Promise<void> {
  if (!(await schemaMigrationsTableExists(pool))) {
    return;
  }
  await pool.query('DELETE FROM communication.schema_migrations WHERE filename = $1', [filename]);
}

async function executeSql(pool: Pool, sql: string, dryRun: boolean, label: string): Promise<void> {
  if (dryRun) {
    console.log(`[dry-run] ${label}`);
    console.log(sql.trim());
    return;
  }
  await pool.query(sql);
}

async function runMigrations(pool: Pool, dryRun: boolean): Promise<void> {
  const applied = new Set(await fetchAppliedMigrations(pool));

  for (const file of MIGRATION_FILES) {
    if (applied.has(file.name)) {
      console.log(`[communication-migrate] skipping ${file.name} (already applied)`);
      continue;
    }

    const sql = loadSql(file);
    await executeSql(pool, sql, dryRun, `[communication-migrate] applying ${file.name}`);

    if (!dryRun) {
      await recordMigration(pool, file.name, sql);
    }
  }
}

async function rollbackMigrations(pool: Pool, dryRun: boolean, rollbackAll: boolean): Promise<void> {
  const applied = await fetchAppliedMigrations(pool);
  if (applied.length === 0) {
    console.log('[communication-migrate] No applied migrations to rollback.');
    return;
  }

  const targets = rollbackAll ? [...applied].reverse() : [applied[applied.length - 1]];

  for (const filename of targets) {
    const descriptor = ROLLBACK_LOOKUP.get(filename);
    if (!descriptor) {
      throw new Error(`Cannot find rollback SQL for migration ${filename}.`);
    }
    const sql = loadSql(descriptor);
    await executeSql(pool, sql, dryRun, `[communication-migrate] rolling back ${filename}`);
    if (!dryRun) {
      await removeMigrationRecord(pool, filename);
    }
  }
}

async function showStatus(pool: Pool): Promise<void> {
  console.log('Communication schema status');
  console.log('---------------------------');
  const applied = new Set(await fetchAppliedMigrations(pool));
  for (const file of MIGRATION_FILES) {
    const marker = applied.has(file.name) ? 'x' : ' ';
    console.log(`[${marker}] ${file.name}`);
  }
  console.log('\nSchema objects');
  const expectedTables = [
    'communication.schema_migrations',
    'communication.channels',
    'communication.templates',
    'communication.delivery_policies',
    'communication.messages',
    'communication.message_recipients',
    'communication.delivery_attempts',
    'communication.conversations',
    'communication.conversation_participants',
    'communication.sla_metrics',
  ];
  for (const identifier of expectedTables) {
    const result = await pool.query('SELECT to_regclass($1) AS reg', [identifier]);
    const exists = result.rows[0]?.reg !== null;
    console.log(`${exists ? '[x]' : '[ ]'} ${identifier}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: options.databaseUrl });

  try {
    switch (options.command) {
      case 'migrate':
        await runMigrations(pool, options.dryRun);
        break;
      case 'rollback':
        await rollbackMigrations(pool, options.dryRun, false);
        break;
      case 'reset':
        await rollbackMigrations(pool, options.dryRun, true);
        await runMigrations(pool, options.dryRun);
        break;
      case 'status':
        if (options.dryRun) {
          console.warn('[communication-migrate] --dry-run flag is ignored for status command.');
        }
        await showStatus(pool);
        break;
      default:
        usage(`Unsupported command: ${options.command}`);
    }
  } catch (error) {
    console.error('[communication-migrate] Operation failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
