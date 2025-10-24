/**
 * Database Adapters for Multi-Tenancy
 * 
 * Adapters implement tenant isolation patterns for different deployment modes.
 * 
 * @module services/tenancy/database-adapters
 */

import type { TenancyConfig, TenantDatabaseConfig } from '../../../configs/tenancy';
import { TenancyContext } from './tenancy-context';

/**
 * Tenant database connection abstraction
 */
export interface TenantDatabaseConnection {
  /**
   * Execute a query with tenant scoping
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Execute a single-row query
   */
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;

  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit a transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback a transaction
   */
  rollback(): Promise<void>;
}

/**
 * Tenancy adapter interface
 */
export interface ITenancyAdapter {
  /**
   * Get database connection for current tenant
   */
  getConnection(): Promise<TenantDatabaseConnection>;

  /**
   * Release connection back to pool
   */
  releaseConnection(conn: TenantDatabaseConnection): Promise<void>;

  /**
   * Apply tenant scoping to SQL query
   */
  scopeQuery(sql: string): string;

  /**
   * Get tenant ID for current context
   */
  getCurrentTenantId(): string;
}

/**
 * Shared-schema adapter (single database, row-level security)
 */
export class SharedSchemaAdapter implements ITenancyAdapter {
  private mockDb: Map<string, unknown[]> = new Map();

  constructor(config: TenancyConfig) {
    void config; // Placeholder for future connection pool wiring
    // In production, initialize actual database connection pool
  }

  getCurrentTenantId(): string {
    return TenancyContext.requireCurrentTenantId();
  }

  async getConnection(): Promise<TenantDatabaseConnection> {
    const tenantId = this.getCurrentTenantId();
    const query = async <T>(sql: string, _params?: unknown[]): Promise<T[]> => {
      const scopedSql = this.scopeQuery(sql);
      console.debug(`[SharedSchema] Query for tenant ${tenantId}:`, scopedSql);

      // Mock implementation
      const key = `${tenantId}:${scopedSql}`;
      return (this.mockDb.get(key) as T[]) ?? [];
    };

    return {
      query,

      queryOne: async <T>(sql: string, params?: unknown[]): Promise<T | null> => {
        const results = await query<T>(sql, params);
        return results[0] ?? null;
      },

      execute: async (sql: string, _params?: unknown[]): Promise<{ rowCount: number }> => {
        const scopedSql = this.scopeQuery(sql);
        console.debug(`[SharedSchema] Execute for tenant ${tenantId}:`, scopedSql);
        return { rowCount: 1 };
      },

      beginTransaction: async () => {
        console.debug(`[SharedSchema] BEGIN for tenant ${tenantId}`);
      },

      commit: async () => {
        console.debug(`[SharedSchema] COMMIT for tenant ${tenantId}`);
      },

      rollback: async () => {
        console.debug(`[SharedSchema] ROLLBACK for tenant ${tenantId}`);
      },
    };
  }

  async releaseConnection(_conn: TenantDatabaseConnection): Promise<void> {
    // Return connection to pool
  }

  scopeQuery(sql: string): string {
    const tenantId = this.getCurrentTenantId();
    
    // Simple SQL rewriting for demonstration
    // In production, use proper SQL parser or ORM-level filters
    if (sql.toUpperCase().includes('WHERE')) {
      return sql.replace(/WHERE/i, `WHERE tenant_id = '${tenantId}' AND`);
    } else if (sql.toUpperCase().includes('FROM')) {
      return sql.replace(/FROM\s+(\w+)/i, `FROM $1 WHERE tenant_id = '${tenantId}'`);
    }
    
    return sql;
  }

  /**
   * Seed mock data for testing
   */
  seedMockData(tenantId: string, table: string, data: unknown[]): void {
    const key = `${tenantId}:SELECT * FROM ${table} WHERE tenant_id = '${tenantId}'`;
    this.mockDb.set(key, data);
  }
}

/**
 * Schema-per-tenant adapter (one PostgreSQL schema per tenant)
 */
export class SchemaPerTenantAdapter implements ITenancyAdapter {
  private mockSchemas: Map<string, Map<string, unknown[]>> = new Map();

  constructor(config: TenancyConfig) {
    void config; // Placeholder for future connection pool wiring
    // In production, initialize connection pool with schema-switching support
  }

  getCurrentTenantId(): string {
    return TenancyContext.requireCurrentTenantId();
  }

  async getConnection(): Promise<TenantDatabaseConnection> {
    const tenantId = this.getCurrentTenantId();
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    // In production: SET search_path = tenant_xxx
    console.debug(`[SchemaPerTenant] Using schema: ${schemaName}`);

    const query = async <T>(sql: string, _params?: unknown[]): Promise<T[]> => {
      console.debug(`[SchemaPerTenant] Query in ${schemaName}:`, sql);

      // Mock implementation
      const schema = this.mockSchemas.get(tenantId) ?? new Map();
      const key = sql;
      return (schema.get(key) as T[]) ?? [];
    };

    return {
      query,

      queryOne: async <T>(sql: string, params?: unknown[]): Promise<T | null> => {
        const results = await query<T>(sql, params);
        return results[0] ?? null;
      },

      execute: async (sql: string, _params?: unknown[]): Promise<{ rowCount: number }> => {
        console.debug(`[SchemaPerTenant] Execute in ${schemaName}:`, sql);
        return { rowCount: 1 };
      },

      beginTransaction: async () => {
        console.debug(`[SchemaPerTenant] BEGIN in ${schemaName}`);
      },

      commit: async () => {
        console.debug(`[SchemaPerTenant] COMMIT in ${schemaName}`);
      },

      rollback: async () => {
        console.debug(`[SchemaPerTenant] ROLLBACK in ${schemaName}`);
      },
    };
  }

  async releaseConnection(_conn: TenantDatabaseConnection): Promise<void> {
    // In production: RESET search_path and return to pool
  }

  scopeQuery(sql: string): string {
    // No query rewriting needed; schema isolation handles scoping
    return sql;
  }

  /**
   * Seed mock data for testing
   */
  seedMockData(tenantId: string, table: string, data: unknown[]): void {
    let schema = this.mockSchemas.get(tenantId);
    if (!schema) {
      schema = new Map();
      this.mockSchemas.set(tenantId, schema);
    }
    const key = `SELECT * FROM ${table}`;
    schema.set(key, data);
  }
}

/**
 * External adapter (dedicated database per tenant)
 */
export class ExternalAdapter implements ITenancyAdapter {
  private registry: Map<string, TenantDatabaseConfig>;
  private mockDatabases: Map<string, Map<string, unknown[]>> = new Map();

  constructor(config: TenancyConfig, registry: TenantDatabaseConfig[]) {
    void config; // Placeholder for future connection pool wiring
    if (!registry || registry.length === 0) {
      throw new Error('ExternalAdapter requires tenant registry configuration');
    }
    this.registry = new Map(registry.map((entry) => [entry.tenantId, entry]));
  }

  private ensureTenantConfig(tenantId: string): TenantDatabaseConfig {
    const tenantConfig = this.registry.get(tenantId);
    if (!tenantConfig) {
      throw new Error(`Tenant configuration not found for tenant ${tenantId}`);
    }
    return tenantConfig;
  }

  private getTenantStore(tenantId: string): Map<string, unknown[]> {
    let store = this.mockDatabases.get(tenantId);
    if (!store) {
      store = new Map();
      this.mockDatabases.set(tenantId, store);
    }
    return store;
  }

  getCurrentTenantId(): string {
    return TenancyContext.requireCurrentTenantId();
  }

  async getConnection(): Promise<TenantDatabaseConnection> {
    const tenantId = this.getCurrentTenantId();
    const tenantConfig = this.ensureTenantConfig(tenantId);
    const store = this.getTenantStore(tenantId);

    console.debug(
      `[ExternalAdapter] Tenant ${tenantConfig.displayName} (${tenantId}) → ` +
        `${tenantConfig.host}:${tenantConfig.port}/${tenantConfig.database}`
    );

    const query = async <T>(sql: string, _params?: unknown[]): Promise<T[]> => {
      console.debug(`[ExternalAdapter] Query in ${tenantConfig.database}:`, sql);
      const key = sql.trim();
      return (store.get(key) as T[]) ?? [];
    };

    return {
      query,

      queryOne: async <T>(sql: string, params?: unknown[]): Promise<T | null> => {
        const results = await query<T>(sql, params);
        return results[0] ?? null;
      },

      execute: async (sql: string, _params?: unknown[]): Promise<{ rowCount: number }> => {
        console.debug(`[ExternalAdapter] Execute in ${tenantConfig.database}:`, sql);
        return { rowCount: 1 };
      },

      beginTransaction: async () => {
        console.debug(`[ExternalAdapter] BEGIN for tenant ${tenantId}`);
      },

      commit: async () => {
        console.debug(`[ExternalAdapter] COMMIT for tenant ${tenantId}`);
      },

      rollback: async () => {
        console.debug(`[ExternalAdapter] ROLLBACK for tenant ${tenantId}`);
      },
    };
  }

  async releaseConnection(_conn: TenantDatabaseConnection): Promise<void> {
    // Close connection / release to pool (no-op for mock)
  }

  scopeQuery(sql: string): string {
    // External adapter isolates at database level; no rewriting needed
    return sql;
  }

  /**
   * Seed mock data for testing
   */
  seedMockData(tenantId: string, table: string, data: unknown[]): void {
    const store = this.getTenantStore(tenantId);
    const key = `SELECT * FROM ${table}`;
    store.set(key, data);
  }
}
