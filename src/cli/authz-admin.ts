#!/usr/bin/env node
import process from 'node:process';

import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';

import { MembershipService } from '@/traits/authz/membership-service.js';
import { createSodPolicyBuilder } from '@/traits/authz/sod-policy-builder.js';
import { cloneParams, type SqlExecutor } from '@/traits/authz/runtime-types.js';

interface ParsedOptions {
  readonly command: AuthzAdminCommand;
  readonly databaseUrl?: string;
  readonly format: 'table' | 'json';
  readonly dryRun: boolean;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly roleId?: string;
  readonly roleAId?: string;
  readonly roleBId?: string;
  readonly reason?: string;
  readonly scopeOrgId?: string | null;
}

const SUPPORTED_COMMANDS = ['list-roles', 'list-permissions', 'assign-role', 'create-sod-policy', 'list-conflicts'] as const;
type AuthzAdminCommand = (typeof SUPPORTED_COMMANDS)[number];

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`Usage: pnpm tsx src/cli/authz-admin.ts <${SUPPORTED_COMMANDS.join('|')}> [options]

Commands:
  list-roles             List registered roles (supports --json)
  list-permissions       List registered permissions (supports --json)
  assign-role            Assign role to user (--user, --org, --role)
  create-sod-policy      Create a SoD policy (--role-a, --role-b, --reason [, --org])
  list-conflicts         Show SoD conflicts (optional --org)

Common options:
  --url <postgres://>    Database connection string (defaults to AUTHZ_DATABASE_URL)
  --json                 Emit JSON instead of table output (list commands only)
  --dry-run              Log actions without mutating (mutating commands only)
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]): ParsedOptions {
  const [commandRaw, ...rest] = argv;
  if (!commandRaw) {
    printUsage('Missing command.');
  }
  if (!SUPPORTED_COMMANDS.includes(commandRaw as AuthzAdminCommand)) {
    printUsage(`Unsupported command: ${commandRaw}`);
  }
  const command = commandRaw as AuthzAdminCommand;
  let databaseUrl = process.env.AUTHZ_DATABASE_URL || process.env.DATABASE_URL || '';
  let format: ParsedOptions['format'] = 'table';
  let dryRun = false;
  const options: Record<string, string | undefined> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case '--url':
      case '--database-url':
        databaseUrl = rest[index + 1] ?? '';
        index += 1;
        break;
      case '--json':
        format = 'json';
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default: {
        if (token.startsWith('--')) {
          const key = token.slice(2);
          options[key] = rest[index + 1];
          index += 1;
        }
        break;
      }
    }
  }

  return {
    command,
    databaseUrl,
    format,
    dryRun,
    userId: options.user,
    organizationId: options.org,
    roleId: options.role,
    roleAId: options['role-a'],
    roleBId: options['role-b'],
    reason: options.reason,
    scopeOrgId: options.org ?? null,
  } satisfies ParsedOptions;
}

function ensureDatabaseUrl(options: ParsedOptions): string {
  if (!options.databaseUrl) {
    printUsage('Database connection string required. Provide --url or set AUTHZ_DATABASE_URL.');
  }
  return options.databaseUrl;
}

async function listRoles(pool: Pool | null, format: ParsedOptions['format']): Promise<void> {
  const executor = requirePool(pool);
  const result = await executor.query('SELECT id, name, description FROM authz.roles ORDER BY name ASC;');
  if (format === 'json') {
    console.log(JSON.stringify(result.rows, null, 2));
    return;
  }
  console.table(result.rows);
}

async function listPermissions(pool: Pool | null, format: ParsedOptions['format']): Promise<void> {
  const executor = requirePool(pool);
  const result = await executor.query('SELECT id, name, resource_type, description FROM authz.permissions ORDER BY name ASC;');
  if (format === 'json') {
    console.log(JSON.stringify(result.rows, null, 2));
    return;
  }
  console.table(result.rows);
}

async function assignRole(pool: Pool | null, options: ParsedOptions): Promise<void> {
  if (!options.userId || !options.organizationId || !options.roleId) {
    printUsage('assign-role requires --user, --org, and --role.');
  }
  if (options.dryRun) {
    console.log(`[dry-run] assign role ${options.roleId} to ${options.userId} within ${options.organizationId}`);
    return;
  }
  const executor = new PoolExecutor(requirePool(pool));
  const membershipService = new MembershipService(executor);
  const membership = await membershipService.assignRole(options.userId!, options.organizationId!, options.roleId!);
  console.log('Role assigned:', membership);
}

async function createSodPolicy(pool: Pool | null, options: ParsedOptions): Promise<void> {
  if (!options.roleAId || !options.roleBId || !options.reason) {
    printUsage('create-sod-policy requires --role-a, --role-b, and --reason.');
  }
  if (options.dryRun) {
    console.log(`[dry-run] create SoD policy ${options.roleAId} vs ${options.roleBId} (${options.reason})`);
    return;
  }
  const builder = createSodPolicyBuilder(new PoolExecutor(requirePool(pool)));
  const policy = await builder.createRoleConflict(options.roleAId!, options.roleBId!, options.reason!, options.scopeOrgId ?? undefined);
  console.log('Policy created:', policy);
}

async function listConflicts(pool: Pool | null, options: ParsedOptions): Promise<void> {
  const builder = createSodPolicyBuilder(new PoolExecutor(requirePool(pool)));
  const conflicts = await builder.listConflicts(options.scopeOrgId ?? undefined);
  if (options.format === 'json') {
    console.log(JSON.stringify(conflicts, null, 2));
    return;
  }
  console.table(
    conflicts.map((conflict) => ({
      id: conflict.id,
      roles: `${conflict.roleAId} × ${conflict.roleBId}`,
      organization: conflict.organizationId ?? 'global',
      reason: conflict.reason,
      active: conflict.active,
    }))
  );
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const isMutation = options.command === 'assign-role' || options.command === 'create-sod-policy';
  const needsConnection = isMutation ? !options.dryRun : true;
  const url = needsConnection ? ensureDatabaseUrl(options) : options.databaseUrl;
  const pool = needsConnection ? new Pool({ connectionString: url }) : null;

  try {
    switch (options.command) {
      case 'list-roles':
        await listRoles(pool, options.format);
        break;
      case 'list-permissions':
        await listPermissions(pool, options.format);
        break;
      case 'assign-role':
        await assignRole(pool, options);
        break;
      case 'create-sod-policy':
        await createSodPolicy(pool, options);
        break;
      case 'list-conflicts':
        await listConflicts(pool, options);
        break;
      default:
        printUsage(`Unsupported command: ${options.command}`);
    }
  } catch (error) {
    console.error('[authz-admin] Operation failed:', error);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

function requirePool(pool: Pool | null): Pool {
  if (!pool) {
    throw new Error('Database connection required for this command.');
  }
  return pool;
}

class PoolExecutor implements SqlExecutor {
  constructor(private readonly pool: Pool) {}

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
    const normalized = cloneParams(params) as unknown[] | undefined;
    return this.pool.query<T>(sql, normalized);
  }
}

void run();
