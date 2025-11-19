#!/usr/bin/env node
import process from 'node:process';

import { Pool } from 'pg';

import {
  DEFAULT_PERMISSION_SEEDS,
  DEFAULT_ROLE_SEEDS,
  ROLE_PERMISSION_MATRIX,
  flattenRolePermissionMatrix,
} from './authz-defaults.js';

interface SeedCliOptions {
  readonly command: 'seed-roles' | 'seed-permissions' | 'seed-role-permissions' | 'seed-all';
  readonly databaseUrl: string;
  readonly dryRun: boolean;
}

function usage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.log(
    'Usage: pnpm tsx src/cli/authz-seed.ts <seed-roles|seed-permissions|seed-role-permissions|seed-all> [--url postgres://] [--dry-run]'
  );
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]): SeedCliOptions {
  const [commandRaw, ...rest] = argv;
  if (!commandRaw) {
    usage('Missing command.');
  }
  const command = commandRaw as SeedCliOptions['command'];
  if (!['seed-roles', 'seed-permissions', 'seed-role-permissions', 'seed-all'].includes(command)) {
    usage(`Unsupported command: ${command}`);
  }

  let databaseUrl = process.env.AUTHZ_DATABASE_URL || process.env.DATABASE_URL || '';
  let dryRun = false;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--url' || token === '--database-url') {
      databaseUrl = rest[index + 1];
      index += 1;
      continue;
    }
    if (token === '--dry-run') {
      dryRun = true;
    }
  }

  if (!databaseUrl && !dryRun) {
    usage('Missing database connection string. Provide --url or set AUTHZ_DATABASE_URL.');
  }

  return { command, databaseUrl, dryRun };
}

function requirePool(pool: Pool | null): Pool {
  if (!pool) {
    throw new Error('Database connection required unless --dry-run flag is provided.');
  }
  return pool;
}

async function seedRoles(pool: Pool | null, dryRun: boolean): Promise<void> {
  for (const role of DEFAULT_ROLE_SEEDS) {
    const params = [role.name, role.description ?? null];
    if (dryRun) {
      console.log(`[dry-run] insert role ${role.name}`);
      continue;
    }
    await requirePool(pool).query(
      'INSERT INTO authz.roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      params
    );
  }
}

async function seedPermissions(pool: Pool | null, dryRun: boolean): Promise<void> {
  for (const permission of DEFAULT_PERMISSION_SEEDS) {
    const params = [permission.name, permission.description ?? null, permission.resource_type ?? null];
    if (dryRun) {
      console.log(`[dry-run] insert permission ${permission.name}`);
      continue;
    }
    await requirePool(pool).query(
      'INSERT INTO authz.permissions (name, description, resource_type) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      params
    );
  }
}

async function seedRolePermissions(pool: Pool | null, dryRun: boolean): Promise<void> {
  const matrix = flattenRolePermissionMatrix(ROLE_PERMISSION_MATRIX);
  for (const [roleName, permissions] of matrix.entries()) {
    for (const permission of permissions) {
      if (dryRun) {
        console.log(`[dry-run] bind ${roleName} -> ${permission}`);
        continue;
      }
      await requirePool(pool).query(
        `INSERT INTO authz.role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM authz.roles r
         JOIN authz.permissions p ON p.name = $2
         WHERE r.name = $1
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleName, permission]
      );
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = options.dryRun ? null : new Pool({ connectionString: options.databaseUrl });

  try {
    switch (options.command) {
      case 'seed-roles':
        await seedRoles(pool, options.dryRun);
        break;
      case 'seed-permissions':
        await seedPermissions(pool, options.dryRun);
        break;
      case 'seed-role-permissions':
        await seedRolePermissions(pool, options.dryRun);
        break;
      case 'seed-all':
        await seedRoles(pool, options.dryRun);
        await seedPermissions(pool, options.dryRun);
        await seedRolePermissions(pool, options.dryRun);
        break;
      default:
        usage(`Unsupported command: ${options.command}`);
    }
    console.log(options.dryRun ? 'Seed dry-run completed.' : 'Seed execution completed.');
  } catch (error) {
    console.error('[authz-seed] Operation failed:', error);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

void main();
