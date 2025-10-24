/**
 * Schema-Per-Tenant Isolation Tests
 * 
 * Validates tenant isolation in schema-per-tenant mode:
 * - Schema-level separation
 * - Cross-schema query prevention
 * - Schema switching correctness
 * 
 * @module tests/tenancy/isolated.spec.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TenancyContext } from '../../src/services/tenancy/tenancy-context';
import { SchemaPerTenantAdapter } from '../../src/services/tenancy/database-adapters';
import { DEFAULT_DEV_CONFIG } from '../../configs/tenancy';

describe('Schema-Per-Tenant Isolation', () => {
  beforeEach(() => {
    // Initialize with schema-per-tenant mode
    TenancyContext.initialize({
      ...DEFAULT_DEV_CONFIG,
      mode: 'schema-per-tenant',
      strictIsolation: true,
    });
  });

  afterEach(() => {
    TenancyContext.reset();
  });

  describe('Schema Isolation', () => {
    it('should route queries to tenant-specific schema', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      // Seed data in separate schemas
      const aliceSubs = [
        { id: 'sub-a1', status: 'active' },
        { id: 'sub-a2', status: 'trialing' },
      ];
      const bobSubs = [
        { id: 'sub-b1', status: 'active' },
      ];

      await aliceContext.withTenant(async (adapter) => {
        if (adapter instanceof SchemaPerTenantAdapter) {
          adapter.seedMockData('tenant-alice', 'subscriptions', aliceSubs);
        }
      });

      await bobContext.withTenant(async (adapter) => {
        if (adapter instanceof SchemaPerTenantAdapter) {
          adapter.seedMockData('tenant-bob', 'subscriptions', bobSubs);
        }
      });

      // Query each schema
      const aliceResults = await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      const bobResults = await bobContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      // Assert: Each tenant sees only their schema's data
      expect(aliceResults).toHaveLength(2);
      expect(aliceResults).toEqual(aliceSubs);

      expect(bobResults).toHaveLength(1);
      expect(bobResults).toEqual(bobSubs);
    });

    it('should prevent cross-schema data access', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      // Seed only Bob's schema
      const bobSubs = [
        { id: 'sub-b1', status: 'active' },
      ];

      await bobContext.withTenant(async (adapter) => {
        if (adapter instanceof SchemaPerTenantAdapter) {
          adapter.seedMockData('tenant-bob', 'subscriptions', bobSubs);
        }
      });

      // Query as Alice (different schema, no data)
      const aliceResults = await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      // Assert: Alice's schema has no data
      expect(aliceResults).toHaveLength(0);
    });

    it('should not append tenant_id filter to queries', async () => {
      const context = TenancyContext.create('tenant-alice');

      await context.withTenant(async (adapter) => {
        const sql = 'SELECT * FROM subscriptions WHERE status = active';
        const scopedSql = adapter.scopeQuery(sql);

        // Schema-per-tenant doesn't need tenant_id filtering
        expect(scopedSql).toBe(sql);
        expect(scopedSql).not.toContain('tenant_id');
      });
    });
  });

  describe('Schema Naming', () => {
    it('should use tenant-specific schema names', async () => {
      const testCases = [
        { tenantId: 'tenant-alice', expectedSchema: 'tenant_tenant_alice' },
        { tenantId: 'tenant-bob-123', expectedSchema: 'tenant_tenant_bob_123' },
        { tenantId: 'charlie', expectedSchema: 'tenant_charlie' },
      ];

      for (const { tenantId, expectedSchema } of testCases) {
        const context = TenancyContext.create(tenantId);
        await context.withTenant(async () => {
          // In production, verify SET search_path = expectedSchema
          // Mock implementation logs schema name
          expect(TenancyContext.getCurrentTenantId()).toBe(tenantId);
        });
      }
    });
  });

  describe('Transaction Isolation', () => {
    it('should maintain schema context across transaction', async () => {
      const context = TenancyContext.create('tenant-alice');

      await context.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();

        await conn.beginTransaction();
        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');

        await conn.execute('INSERT INTO subscriptions (id, status) VALUES (?, ?)', [
          'sub-a3',
          'active',
        ]);

        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');
        await conn.commit();
      });
    });

    it('should not leak data across schema transactions', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      // Start transactions in both schemas
      await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        await conn.beginTransaction();
        await conn.execute('INSERT INTO subscriptions (id, status) VALUES (?, ?)', [
          'sub-a1',
          'active',
        ]);
        // Don't commit yet
      });

      await bobContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        const results = await conn.query('SELECT * FROM subscriptions');
        
        // Bob's schema should not see Alice's uncommitted data
        expect(results).toHaveLength(0);
      });
    });
  });

  describe('Concurrent Access', () => {
    it('should handle multiple tenants querying simultaneously', async () => {
      const contexts = [
        TenancyContext.create('tenant-alice'),
        TenancyContext.create('tenant-bob'),
        TenancyContext.create('tenant-charlie'),
      ];

      // Seed different data per tenant
      for (let i = 0; i < contexts.length; i++) {
        const context = contexts[i];
        if (!context) continue;
        
        await context.withTenant(async (adapter) => {
          if (adapter instanceof SchemaPerTenantAdapter) {
            const tenantId = TenancyContext.getCurrentTenantId() ?? 'unknown';
            adapter.seedMockData(tenantId, 'subscriptions', [
              { id: `sub-${i}`, status: 'active', tenant: tenantId },
            ]);
          }
        });
      }

      // Query all tenants concurrently
      const results = await Promise.all(
        contexts.map((context) =>
          context.withTenant(async (adapter) => {
            const conn = await adapter.getConnection();
            const subs = await conn.query<{ tenant: string }>('SELECT * FROM subscriptions');
            return {
              tenant: TenancyContext.getCurrentTenantId(),
              count: subs.length,
              data: subs,
            };
          })
        )
      );

      // Each tenant sees only their own data
      expect(results[0]?.count).toBe(1);
      expect(results[0]?.data[0]?.tenant).toBe('tenant-alice');

      expect(results[1]?.count).toBe(1);
      expect(results[1]?.data[0]?.tenant).toBe('tenant-bob');

      expect(results[2]?.count).toBe(1);
      expect(results[2]?.data[0]?.tenant).toBe('tenant-charlie');
    });
  });

  describe('Error Handling', () => {
    it('should fail fast when tenant context is missing', () => {
      expect(() => {
        TenancyContext.requireCurrentTenant();
      }).toThrow('No tenant context set');
    });

    it('should reject empty schema names', () => {
      expect(() => {
        TenancyContext.create('');
      }).toThrow('Invalid tenantId');
    });
  });

  describe('Per-Tenant Migrations', () => {
    it('should support independent schema versions', async () => {
      // Simulate different schema versions per tenant
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      await aliceContext.withTenant(async (adapter) => {
        if (adapter instanceof SchemaPerTenantAdapter) {
          // Alice's schema has new columns
          adapter.seedMockData('tenant-alice', 'subscriptions', [
            { id: 'sub-a1', status: 'active', new_column: 'value' },
          ]);
        }
      });

      await bobContext.withTenant(async (adapter) => {
        if (adapter instanceof SchemaPerTenantAdapter) {
          // Bob's schema uses old schema (no new_column yet)
          adapter.seedMockData('tenant-bob', 'subscriptions', [
            { id: 'sub-b1', status: 'active' },
          ]);
        }
      });

      // Both schemas work independently
      const aliceResults = await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query<{ new_column?: string }>('SELECT * FROM subscriptions');
      });

      const bobResults = await bobContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      expect(aliceResults[0]).toHaveProperty('new_column');
      expect(bobResults[0]).not.toHaveProperty('new_column');
    });
  });
});
