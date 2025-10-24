#!/usr/bin/env tsx
/**
 * Tenancy Seed Script
 * 
 * Provisions sample tenants for development and testing.
 * Supports shared-schema, schema-per-tenant, and external-adapter modes.
 * 
 * Usage:
 *   pnpm tenancy:seed
 *   OODS_TENANCY_MODE=schema-per-tenant pnpm tenancy:seed
 * 
 * @module scripts/tenancy/seed
 */

import {
  getTenancyConfig,
  loadTenantDatabaseRegistry,
  type TenancyConfig,
} from '../../configs/tenancy';
import { TenancyContext } from '../../src/services/tenancy/tenancy-context';

interface SeedTenant {
  tenantId: string;
  displayName: string;
  users: Array<{ id: string; name: string; email: string }>;
  subscriptions: Array<{ id: string; status: string; plan: string }>;
}

const SEED_TENANTS: SeedTenant[] = [
  {
    tenantId: 'tenant-alice',
    displayName: 'Alice Corp',
    users: [
      { id: 'user-a1', name: 'Alice Admin', email: 'alice@example.com' },
      { id: 'user-a2', name: 'Alice User', email: 'alice.user@example.com' },
    ],
    subscriptions: [
      { id: 'sub-a1', status: 'active', plan: 'professional' },
      { id: 'sub-a2', status: 'trialing', plan: 'enterprise' },
    ],
  },
  {
    tenantId: 'tenant-bob',
    displayName: 'Bob Industries',
    users: [
      { id: 'user-b1', name: 'Bob Admin', email: 'bob@example.com' },
    ],
    subscriptions: [
      { id: 'sub-b1', status: 'active', plan: 'starter' },
    ],
  },
  {
    tenantId: 'tenant-charlie',
    displayName: 'Charlie Enterprises',
    users: [
      { id: 'user-c1', name: 'Charlie Admin', email: 'charlie@example.com' },
      { id: 'user-c2', name: 'Charlie Billing', email: 'billing@charlie.com' },
      { id: 'user-c3', name: 'Charlie Support', email: 'support@charlie.com' },
    ],
    subscriptions: [
      { id: 'sub-c1', status: 'active', plan: 'enterprise' },
      { id: 'sub-c2', status: 'paused', plan: 'professional' },
    ],
  },
];

async function seedSharedSchema(): Promise<void> {
  console.log('📦 Seeding shared-schema mode...\n');

  for (const tenant of SEED_TENANTS) {
    console.log(`  → Tenant: ${tenant.displayName} (${tenant.tenantId})`);
    
    const context = TenancyContext.create(tenant.tenantId);
    
    await context.withTenant(async (adapter) => {
      const conn = await adapter.getConnection();

      // Seed users
      for (const user of tenant.users) {
        await conn.execute(
          'INSERT INTO users (id, tenant_id, name, email) VALUES (?, ?, ?, ?)',
          [user.id, tenant.tenantId, user.name, user.email]
        );
      }
      console.log(`    ✓ Seeded ${tenant.users.length} users`);

      // Seed subscriptions
      for (const sub of tenant.subscriptions) {
        await conn.execute(
          'INSERT INTO subscriptions (id, tenant_id, status, plan) VALUES (?, ?, ?, ?)',
          [sub.id, tenant.tenantId, sub.status, sub.plan]
        );
      }
      console.log(`    ✓ Seeded ${tenant.subscriptions.length} subscriptions`);
    });

    console.log('');
  }

  console.log('✅ Shared-schema seeding complete!\n');
}

async function seedSchemaPerTenant(): Promise<void> {
  console.log('📦 Seeding schema-per-tenant mode...\n');

  for (const tenant of SEED_TENANTS) {
    const schemaName = `tenant_${tenant.tenantId.replace(/-/g, '_')}`;
    console.log(`  → Tenant: ${tenant.displayName} (${schemaName})`);

    const context = TenancyContext.create(tenant.tenantId);

    await context.withTenant(async (adapter) => {
      // In production: CREATE SCHEMA IF NOT EXISTS tenant_xxx
      console.log(`    ✓ Schema ${schemaName} ready`);

      const conn = await adapter.getConnection();

      // Seed users (no tenant_id column needed)
      for (const user of tenant.users) {
        await conn.execute(
          'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
          [user.id, user.name, user.email]
        );
      }
      console.log(`    ✓ Seeded ${tenant.users.length} users`);

      // Seed subscriptions
      for (const sub of tenant.subscriptions) {
        await conn.execute(
          'INSERT INTO subscriptions (id, status, plan) VALUES (?, ?, ?)',
          [sub.id, sub.status, sub.plan]
        );
      }
      console.log(`    ✓ Seeded ${tenant.subscriptions.length} subscriptions`);
    });

    console.log('');
  }

  console.log('✅ Schema-per-tenant seeding complete!\n');
}

async function seedExternalAdapter(config: TenancyConfig): Promise<void> {
  console.log('📦 Seeding external-adapter mode...\n');

  const registry = loadTenantDatabaseRegistry(config);
  const registryById = new Map(registry.map((entry) => [entry.tenantId, entry]));

  for (const tenant of SEED_TENANTS) {
    const registryEntry = registryById.get(tenant.tenantId);
    if (!registryEntry) {
      console.warn(
        `  ⚠️  Registry entry missing for ${tenant.displayName} (${tenant.tenantId}) — skipping`
      );
      continue;
    }

    console.log(
      `  → Tenant: ${tenant.displayName} (${registryEntry.host}:${registryEntry.port}/${registryEntry.database})`
    );

    const context = TenancyContext.create(tenant.tenantId);

    await context.withTenant(async (adapter) => {
      const conn = await adapter.getConnection();
      console.log(`    ✓ Connection established as ${registryEntry.username}`);

      for (const user of tenant.users) {
        await conn.execute('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [
          user.id,
          user.name,
          user.email,
        ]);
      }
      console.log(`    ✓ Seeded ${tenant.users.length} users`);

      for (const sub of tenant.subscriptions) {
        await conn.execute(
          'INSERT INTO subscriptions (id, status, plan) VALUES (?, ?, ?)',
          [sub.id, sub.status, sub.plan]
        );
      }
      console.log(`    ✓ Seeded ${tenant.subscriptions.length} subscriptions`);
    });

    console.log('');
  }

  console.log('✅ External-adapter seeding complete!\n');
}

async function main(): Promise<void> {
  console.log('🌱 OODS Tenancy Seed Script\n');

  const config = getTenancyConfig();
  console.log(`Mode: ${config.mode}`);
  console.log(`Resolver: ${config.resolver}\n`);

  TenancyContext.initialize(config);

  switch (config.mode) {
    case 'shared-schema':
      await seedSharedSchema();
      break;

    case 'schema-per-tenant':
      await seedSchemaPerTenant();
      break;

    case 'external-adapter':
      await seedExternalAdapter(config);
      break;

    default:
      console.error(`❌ Unknown tenancy mode: ${config.mode}`);
      process.exit(1);
  }

  console.log('📊 Summary:');
  console.log(`  Tenants seeded: ${SEED_TENANTS.length}`);
  console.log(`  Total users: ${SEED_TENANTS.reduce((sum, t) => sum + t.users.length, 0)}`);
  console.log(`  Total subscriptions: ${SEED_TENANTS.reduce((sum, t) => sum + t.subscriptions.length, 0)}`);
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
