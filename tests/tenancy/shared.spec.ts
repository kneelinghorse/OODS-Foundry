/**
 * Shared-Schema Tenancy Tests
 * 
 * Validates tenant isolation in shared-schema mode:
 * - Row-level security
 * - Cross-tenant query prevention
 * - Audit log segregation
 * 
 * @module tests/tenancy/shared.spec.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TenancyContext } from '../../src/services/tenancy/tenancy-context';
import { SharedSchemaAdapter } from '../../src/services/tenancy/database-adapters';
import { DEFAULT_DEV_CONFIG } from '../../configs/tenancy';

describe('Shared-Schema Tenancy', () => {
  beforeEach(() => {
    // Initialize with shared-schema mode
    TenancyContext.initialize({
      ...DEFAULT_DEV_CONFIG,
      mode: 'shared-schema',
      strictIsolation: true,
    });
  });

  afterEach(() => {
    TenancyContext.reset();
  });

  describe('Tenant Isolation', () => {
    it('should isolate queries to current tenant', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      // Seed data for both tenants
      const aliceSubs = [
        { id: 'sub-a1', tenant_id: 'tenant-alice', status: 'active' },
        { id: 'sub-a2', tenant_id: 'tenant-alice', status: 'trialing' },
      ];
      const bobSubs = [
        { id: 'sub-b1', tenant_id: 'tenant-bob', status: 'active' },
      ];

      await aliceContext.withTenant(async (adapter) => {
        if (adapter instanceof SharedSchemaAdapter) {
          adapter.seedMockData('tenant-alice', 'subscriptions', aliceSubs);
        }
      });

      await bobContext.withTenant(async (adapter) => {
        if (adapter instanceof SharedSchemaAdapter) {
          adapter.seedMockData('tenant-bob', 'subscriptions', bobSubs);
        }
      });

      // Query as Alice
      const aliceResults = await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      // Query as Bob
      const bobResults = await bobContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      // Assert: Alice sees only Alice's data
      expect(aliceResults).toHaveLength(2);
      expect(aliceResults).toEqual(aliceSubs);

      // Assert: Bob sees only Bob's data
      expect(bobResults).toHaveLength(1);
      expect(bobResults).toEqual(bobSubs);
    });

    it('should prevent cross-tenant data access', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      // Seed Bob's data
      const bobSubs = [
        { id: 'sub-b1', tenant_id: 'tenant-bob', status: 'active' },
      ];

      await bobContext.withTenant(async (adapter) => {
        if (adapter instanceof SharedSchemaAdapter) {
          adapter.seedMockData('tenant-bob', 'subscriptions', bobSubs);
        }
      });

      // Try to query as Alice (should get empty result)
      const aliceResults = await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      // Assert: Alice sees no data (Bob's data is isolated)
      expect(aliceResults).toHaveLength(0);
    });

    it('should enforce tenant context requirement', async () => {
      // Attempt to query without tenant context
      expect(() => {
        TenancyContext.requireCurrentTenant();
      }).toThrow('No tenant context set');
    });

    it('should restore previous tenant context after withTenant', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      // Set Alice as current
      TenancyContext.setCurrentTenant('tenant-alice');
      expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');

      // Execute Bob's context
      await bobContext.withTenant(async () => {
        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-bob');
      });

      // Assert: Alice restored after Bob's context
      expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');
    });
  });

  describe('Query Scoping', () => {
    it('should append tenant filter to WHERE clause', async () => {
      const context = TenancyContext.create('tenant-alice');

      await context.withTenant(async (adapter) => {
        const sql = 'SELECT * FROM subscriptions WHERE status = active';
        const scopedSql = adapter.scopeQuery(sql);

        expect(scopedSql).toContain("tenant_id = 'tenant-alice'");
        expect(scopedSql).toContain('AND');
      });
    });

    it('should add WHERE clause if missing', async () => {
      const context = TenancyContext.create('tenant-bob');

      await context.withTenant(async (adapter) => {
        const sql = 'SELECT * FROM users';
        const scopedSql = adapter.scopeQuery(sql);

        expect(scopedSql).toContain("WHERE tenant_id = 'tenant-bob'");
      });
    });
  });

  describe('Transaction Isolation', () => {
    it('should maintain tenant context across transaction', async () => {
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
        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');
      });
    });

    it('should restore context after rollback', async () => {
      const context = TenancyContext.create('tenant-bob');

      await context.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();

        await conn.beginTransaction();
        await conn.execute('INSERT INTO subscriptions (id, status) VALUES (?, ?)', [
          'sub-b2',
          'active',
        ]);
        await conn.rollback();

        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-bob');
      });
    });
  });

  describe('Multi-Tenant Edge Cases', () => {
    it('should handle concurrent tenant contexts', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');
      const charlieContext = TenancyContext.create('tenant-charlie');

      const results = await Promise.all([
        aliceContext.withTenant(async () => {
          return { tenant: TenancyContext.getCurrentTenantId() };
        }),
        bobContext.withTenant(async () => {
          return { tenant: TenancyContext.getCurrentTenantId() };
        }),
        charlieContext.withTenant(async () => {
          return { tenant: TenancyContext.getCurrentTenantId() };
        }),
      ]);

      expect(results[0]?.tenant).toBe('tenant-alice');
      expect(results[1]?.tenant).toBe('tenant-bob');
      expect(results[2]?.tenant).toBe('tenant-charlie');
    });

    it('should handle nested tenant contexts', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      await aliceContext.withTenant(async () => {
        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');

        await bobContext.withTenant(async () => {
          expect(TenancyContext.getCurrentTenantId()).toBe('tenant-bob');
        });

        // Alice restored after nested Bob context
        expect(TenancyContext.getCurrentTenantId()).toBe('tenant-alice');
      });
    });

    it('should reject invalid tenant IDs', () => {
      expect(() => TenancyContext.create('')).toThrow('Invalid tenantId');
      expect(() => TenancyContext.create(null as unknown as string)).toThrow('Invalid tenantId');
    });
  });
});
