#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { Pool } from 'pg';

interface CliOptions {
  readonly command: 'migrate' | 'rollback' | 'status';
  readonly databaseUrl: string;
  readonly migrationsDir: string;
  readonly rollbackDir: string;
}

interface SqlFile {
  readonly name: string;
  readonly absolutePath: string;
  readonly sql: string;
}

type StructureCheck =
  | { readonly label: string; readonly type: 'relation'; readonly schema: string; readonly name: string }
  | { readonly label: string; readonly type: 'function'; readonly schema: string; readonly name: string }
  | {
      readonly label: string;
      readonly type: 'trigger';
      readonly schema: string;
      readonly table: string;
      readonly name: string;
    };

const MIGRATIONS_DIR = path.resolve('database/migrations');
const ROLLBACK_DIR = path.resolve('database/migrations/rollback');
const REQUIRED_FK_TARGETS = ['core.users', 'core.organizations'];
const EXPECTED_STRUCTURES: readonly StructureCheck[] = [
  { label: 'authz.roles table', type: 'relation', schema: 'authz', name: 'roles' },
  { label: 'authz.permissions table', type: 'relation', schema: 'authz', name: 'permissions' },
  { label: 'authz.role_permissions table', type: 'relation', schema: 'authz', name: 'role_permissions' },
  { label: 'authz.memberships table', type: 'relation', schema: 'authz', name: 'memberships' },
  { label: 'authz.role_hierarchy table', type: 'relation', schema: 'authz', name: 'role_hierarchy' },
  { label: 'authz.sod_role_conflicts table', type: 'relation', schema: 'authz', name: 'sod_role_conflicts' },
  { label: 'authz.action_log table', type: 'relation', schema: 'authz', name: 'action_log' },
  { label: 'idx_memberships_user_org index', type: 'relation', schema: 'authz', name: 'idx_memberships_user_org' },
  { label: 'idx_memberships_org_role index', type: 'relation', schema: 'authz', name: 'idx_memberships_org_role' },
  { label: 'idx_role_permissions_role index', type: 'relation', schema: 'authz', name: 'idx_role_permissions_role' },
  { label: 'idx_action_log_lookup index', type: 'relation', schema: 'authz', name: 'idx_action_log_lookup' },
  { label: 'authz.prevent_conflicting_roles()', type: 'function', schema: 'authz', name: 'prevent_conflicting_roles' },
  {
    label: 'enforce_sod_on_membership trigger',
    type: 'trigger',
    schema: 'authz',
    table: 'memberships',
    name: 'enforce_sod_on_membership',
  },
];

function usage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.log('Usage: pnpm tsx src/cli/authz-migrate.ts <migrate|rollback|status> [--url postgres://...]');
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]): CliOptions {
  const [commandRaw, ...rest] = argv;
  if (!commandRaw) {
    usage('Missing command.');
  }
  const command = commandRaw as CliOptions['command'];
  if (!['migrate', 'rollback', 'status'].includes(command)) {
    usage(`Unsupported command: ${command}`);
  }

  let databaseUrl = process.env.AUTHZ_DATABASE_URL || process.env.DATABASE_URL || '';
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--url' || token === '--database-url') {
      databaseUrl = rest[index + 1];
      index += 1;
    }
  }

  if (!databaseUrl) {
    usage('Missing database connection string. Provide --url or set AUTHZ_DATABASE_URL.');
  }

  return {
    command,
    databaseUrl,
    migrationsDir: MIGRATIONS_DIR,
    rollbackDir: ROLLBACK_DIR,
  };
}

function loadSqlFiles(directory: string, { reverse = false } = {}): SqlFile[] {
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.sql'))
    .map((dirent) => dirent.name)
    .sort();
  if (entries.length === 0) {
    throw new Error(`Directory ${directory} does not contain any .sql files.`);
  }
  if (reverse) {
    entries.reverse();
  }
  return entries.map((name) => {
    const absolutePath = path.join(directory, name);
    const sql = readFileSync(absolutePath, 'utf8');
    return { name, absolutePath, sql };
  });
}

async function ensureForeignKeyTargets(pool: Pool): Promise<void> {
  for (const target of REQUIRED_FK_TARGETS) {
    const result = await pool.query('SELECT to_regclass($1) AS reg', [target]);
    const exists = result.rows[0]?.reg !== null;
    if (!exists) {
      throw new Error(`Cannot find required foreign table: ${target}`);
    }
  }
}

async function executeSqlFiles(pool: Pool, files: readonly SqlFile[]): Promise<void> {
  for (const file of files) {
    console.log(`[authz-migrate] running ${file.name}`);
    await pool.query(file.sql);
  }
}

async function checkStructure(pool: Pool, check: StructureCheck): Promise<boolean> {
  switch (check.type) {
    case 'relation': {
      const identifier = `${check.schema}.${check.name}`;
      const result = await pool.query('SELECT to_regclass($1) AS reg', [identifier]);
      return result.rows[0]?.reg !== null;
    }
    case 'function': {
      const result = await pool.query(
        `SELECT COUNT(*) AS count
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = $1 AND p.proname = $2`,
        [check.schema, check.name]
      );
      return Number(result.rows[0]?.count ?? 0) > 0;
    }
    case 'trigger': {
      const result = await pool.query(
        `SELECT COUNT(*) AS count
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE t.tgname = $1
           AND n.nspname = $2
           AND c.relname = $3
           AND NOT t.tgisinternal`,
        [check.name, check.schema, check.table]
      );
      return Number(result.rows[0]?.count ?? 0) > 0;
    }
    default:
      return false;
  }
}

async function handleStatus(pool: Pool): Promise<void> {
  console.log('Authorization schema status');
  console.log('---------------------------');
  for (const structure of EXPECTED_STRUCTURES) {
    const exists = await checkStructure(pool, structure);
    console.log(`${exists ? '[x]' : '[ ]'} ${structure.label}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: options.databaseUrl });

  try {
    if (options.command === 'status') {
      await handleStatus(pool);
      return;
    }

    if (options.command === 'migrate') {
      await ensureForeignKeyTargets(pool);
      const migrations = loadSqlFiles(options.migrationsDir);
      await executeSqlFiles(pool, migrations);
      console.log('Migrations completed successfully.');
      return;
    }

    if (options.command === 'rollback') {
      const rollbacks = loadSqlFiles(options.rollbackDir, { reverse: true });
      await executeSqlFiles(pool, rollbacks);
      console.log('Rollback completed successfully.');
      return;
    }
  } catch (error) {
    console.error('[authz-migrate] Operation failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
