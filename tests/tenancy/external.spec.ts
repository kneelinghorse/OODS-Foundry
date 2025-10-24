/**
 * External Adapter Tenancy Tests
 *
 * Validates isolation when each tenant receives a dedicated database.
 *
 * @module tests/tenancy/external.spec.ts
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DEV_CONFIG,
  type TenancyConfig,
  type TenantDatabaseConfig,
} from '../../configs/tenancy';
import { TenancyContext } from '../../src/services/tenancy/tenancy-context';
import { ExternalAdapter } from '../../src/services/tenancy/database-adapters';

const EXTERNAL_REGISTRY: TenantDatabaseConfig[] = [
  {
    tenantId: 'tenant-alice',
    displayName: 'Alice Corp',
    host: 'alice.db.internal',
    port: 5432,
    database: 'oods_alice',
    username: 'alice_svc',
    password: 'redacted',
    sslMode: 'disable',
    region: 'us-east-1',
    residency: 'US',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    tenantId: 'tenant-bob',
    displayName: 'Bob Industries',
    host: 'bob.db.internal',
    port: 5432,
    database: 'oods_bob',
    username: 'bob_svc',
    password: 'redacted',
    sslMode: 'disable',
    region: 'us-east-2',
    residency: 'US',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

const EXTERNAL_CONFIG: TenancyConfig = {
  ...DEFAULT_DEV_CONFIG,
  mode: 'external-adapter',
  strictIsolation: true,
  externalTenants: EXTERNAL_REGISTRY,
};

describe('External Adapter Tenancy', () => {
  beforeEach(() => {
    TenancyContext.initialize(EXTERNAL_CONFIG);
  });

  afterEach(() => {
    TenancyContext.reset();
  });

  describe('Isolation', () => {
    it('should route queries to dedicated databases', async () => {
      const aliceContext = TenancyContext.create('tenant-alice');
      const bobContext = TenancyContext.create('tenant-bob');

      await aliceContext.withTenant(async (adapter) => {
        expect(adapter).toBeInstanceOf(ExternalAdapter);
        (adapter as ExternalAdapter).seedMockData('tenant-alice', 'subscriptions', [
          { id: 'sub-a1', status: 'active' },
          { id: 'sub-a2', status: 'trialing' },
        ]);
      });

      await bobContext.withTenant(async (adapter) => {
        expect(adapter).toBeInstanceOf(ExternalAdapter);
        (adapter as ExternalAdapter).seedMockData('tenant-bob', 'subscriptions', [
          { id: 'sub-b1', status: 'active' },
        ]);
      });

      const aliceResults = await aliceContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      const bobResults = await bobContext.withTenant(async (adapter) => {
        const conn = await adapter.getConnection();
        return conn.query('SELECT * FROM subscriptions');
      });

      expect(aliceResults).toHaveLength(2);
      expect(aliceResults[0]).toMatchObject({ status: 'active' });
      expect(bobResults).toHaveLength(1);
      expect(bobResults[0]).toMatchObject({ status: 'active' });
    });

    it('should include registry metadata in tenant context', async () => {
      const context = TenancyContext.create('tenant-alice');
      await context.withTenant(async () => {
        const ref = TenancyContext.getCurrentTenant();
        expect(ref?.tenantId).toBe('tenant-alice');
        expect(ref?.displayName).toBe('Alice Corp');
        expect(ref?.metadata).toMatchObject({
          mode: 'external-adapter',
          region: 'us-east-1',
          residency: 'US',
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should fail fast when tenant configuration is missing', async () => {
      const context = TenancyContext.create('tenant-charlie');
      await expect(
        context.withTenant(async (adapter) => {
          await adapter.getConnection();
          return null;
        })
      ).rejects.toThrow('Tenant configuration not found for tenant tenant-charlie');
    });
  });
});

