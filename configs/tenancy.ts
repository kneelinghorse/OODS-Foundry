/**
 * Multi-Tenancy Configuration
 *
 * Runtime configuration and validation for OODS Foundry tenancy modes.
 * Supports shared-schema, schema-per-tenant, and external-adapter deployment patterns.
 *
 * @module configs/tenancy
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Tenancy deployment modes
 */
export const TenancyMode = z.enum([
  'shared-schema', // Single DB, single schema, row-level security
  'schema-per-tenant', // Single DB, one schema per tenant
  'external-adapter', // Separate database per tenant
]);
export type TenancyMode = z.infer<typeof TenancyMode>;

/**
 * Tenant resolution strategies
 */
export const TenantResolver = z.enum([
  'subdomain', // Extract from subdomain: tenant-abc.oods.app
  'header', // Read from X-Tenant-ID header
  'jwt-claim', // Extract from JWT 'tenantId' claim
  'path-prefix', // Parse from URL: /t/tenant-abc/...
]);
export type TenantResolver = z.infer<typeof TenantResolver>;

/**
 * External tenant database configuration (for external-adapter mode)
 */
const uuidCheck = z.string().uuid();
const slugRegex = /^[a-zA-Z0-9_-]+$/;

export const TenantDatabaseConfigSchema = z.object({
  tenantId: z
    .string()
    .min(1)
    .refine(
      (value) => uuidCheck.safeParse(value).success || slugRegex.test(value),
      {
        message: 'tenantId must be a UUID or slug (letters, numbers, -, _)',
      }
    ),
  displayName: z.string(),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  database: z.string(),
  username: z.string(),
  password: z.string(), // Encrypted in production
  sslMode: z.enum(['disable', 'require', 'verify-ca', 'verify-full']).default('require'),
  region: z.string().optional(),
  residency: z.string().optional(), // Data residency requirement (e.g., 'EU', 'US')
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TenantDatabaseConfig = z.infer<typeof TenantDatabaseConfigSchema>;

/**
 * Tenancy configuration schema
 */
export const TenancyConfigSchema = z.object({
  /**
   * Tenancy deployment mode
   * @default 'shared-schema'
   */
  mode: TenancyMode.default('shared-schema'),

  /**
   * Strategy for resolving tenant ID from request
   * @default 'subdomain'
   */
  resolver: TenantResolver.default('subdomain'),

  /**
   * Database connection string (for shared-schema and schema-per-tenant modes)
   * @example 'postgresql://user:pass@localhost:5432/oods_foundry'
   */
  databaseUrl: z.string().url().optional(),

  /**
   * Path to tenant database configurations (for external-adapter mode)
   * @example './configs/tenant-databases.json'
   */
  tenantConfigPath: z.string().default('configs/tenant-databases.json'),

  /**
   * Optional inline registry for external adapter configuration
   */
  externalTenants: z.array(TenantDatabaseConfigSchema).optional(),

  /**
   * Enable strict tenant isolation validation
   * When true, fail requests with no tenant context
   * @default true
   */
  strictIsolation: z.boolean().default(true),

  /**
   * Fallback tenant ID for development/testing
   * Only used when strictIsolation is false
   * @default undefined
   */
  fallbackTenantId: z.string().uuid().optional(),

  /**
   * Enable tenant-specific schema migrations
   * Only relevant for schema-per-tenant mode
   * @default true
   */
  enablePerTenantMigrations: z.boolean().default(true),

  /**
   * Connection pool settings
   */
  pool: z.object({
    /**
     * Maximum connections per tenant (schema-per-tenant mode)
     * @default 10
     */
    maxPerTenant: z.number().int().min(1).max(100).default(10),

    /**
     * Idle timeout in milliseconds
     * @default 30000 (30 seconds)
     */
    idleTimeoutMs: z.number().int().min(1000).default(30000),

    /**
     * Connection timeout in milliseconds
     * @default 5000 (5 seconds)
     */
    connectionTimeoutMs: z.number().int().min(1000).default(5000),
  }).default({
    maxPerTenant: 10,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 5000,
  }),

  /**
   * Audit logging configuration
   */
  audit: z.object({
    /**
     * Require tenant ID in all audit logs
     * @default true
     */
    requireTenantId: z.boolean().default(true),

    /**
     * Flag cross-tenant admin operations
     * @default true
     */
    flagCrossTenantAccess: z.boolean().default(true),
  }).default({
    requireTenantId: true,
    flagCrossTenantAccess: true,
  }),
});

export type TenancyConfig = z.infer<typeof TenancyConfigSchema>;

/**
 * Parse tenancy configuration from environment variables
 */
export function parseTenancyConfig(): TenancyConfig {
  const strictIsolation =
    process.env.OODS_STRICT_ISOLATION === undefined
      ? undefined
      : process.env.OODS_STRICT_ISOLATION === 'true';

  const raw = {
    mode: process.env.OODS_TENANCY_MODE,
    resolver: process.env.OODS_TENANT_RESOLVER,
    databaseUrl: process.env.DATABASE_URL,
    tenantConfigPath: process.env.TENANT_CONFIG_PATH,
    strictIsolation,
    fallbackTenantId: process.env.OODS_FALLBACK_TENANT_ID,
    enablePerTenantMigrations: process.env.OODS_PER_TENANT_MIGRATIONS !== 'false',
    pool: {
      maxPerTenant: process.env.OODS_POOL_MAX_PER_TENANT
        ? parseInt(process.env.OODS_POOL_MAX_PER_TENANT, 10)
        : undefined,
      idleTimeoutMs: process.env.OODS_POOL_IDLE_TIMEOUT_MS
        ? parseInt(process.env.OODS_POOL_IDLE_TIMEOUT_MS, 10)
        : undefined,
      connectionTimeoutMs: process.env.OODS_POOL_CONNECTION_TIMEOUT_MS
        ? parseInt(process.env.OODS_POOL_CONNECTION_TIMEOUT_MS, 10)
        : undefined,
    },
    audit: {
      requireTenantId: process.env.OODS_AUDIT_REQUIRE_TENANT_ID !== 'false',
      flagCrossTenantAccess: process.env.OODS_AUDIT_FLAG_CROSS_TENANT !== 'false',
    },
  };

  return TenancyConfigSchema.parse(raw);
}

/**
 * Validate tenancy configuration
 * Throws ZodError if invalid
 */
export function validateTenancyConfig(config: unknown): TenancyConfig {
  return TenancyConfigSchema.parse(config);
}

/**
 * Validate mode-specific requirements
 */
export function validateModeRequirements(config: TenancyConfig): void {
  if (
    config.mode === 'external-adapter' &&
    !config.tenantConfigPath &&
    (!config.externalTenants || config.externalTenants.length === 0)
  ) {
    throw new Error(
      'TENANT_CONFIG_PATH or externalTenants is required when OODS_TENANCY_MODE=external-adapter'
    );
  }

  if (
    (config.mode === 'shared-schema' || config.mode === 'schema-per-tenant') &&
    !config.databaseUrl
  ) {
    throw new Error(
      `DATABASE_URL is required when OODS_TENANCY_MODE=${config.mode}`
    );
  }

  if (config.strictIsolation && config.fallbackTenantId) {
    console.warn(
      'Warning: fallbackTenantId is ignored when strictIsolation=true'
    );
  }
}

/**
 * Get validated tenancy configuration from environment
 */
export function getTenancyConfig(): TenancyConfig {
  const config = parseTenancyConfig();
  validateModeRequirements(config);
  return config;
}

/**
 * Default configuration for development
 */
export const DEFAULT_DEV_CONFIG: TenancyConfig = {
  mode: 'shared-schema',
  resolver: 'header',
  databaseUrl: 'postgresql://localhost:5432/oods_dev',
  tenantConfigPath: 'configs/tenant-databases.json',
  strictIsolation: false,
  fallbackTenantId: '00000000-0000-0000-0000-000000000001',
  enablePerTenantMigrations: false,
  pool: {
    maxPerTenant: 5,
    idleTimeoutMs: 10000,
    connectionTimeoutMs: 3000,
  },
  audit: {
    requireTenantId: true,
    flagCrossTenantAccess: true,
  },
};

/**
 * Resolve external tenant configuration registry (external-adapter mode).
 * Prefers inline config when provided, otherwise loads from TENANT_CONFIG_PATH.
 */
export function loadTenantDatabaseRegistry(config: TenancyConfig): TenantDatabaseConfig[] {
  if (config.externalTenants && config.externalTenants.length > 0) {
    return config.externalTenants;
  }

  if (!config.tenantConfigPath) {
    throw new Error(
      'TENANT_CONFIG_PATH must be specified to load external tenant registry'
    );
  }

  const resolvedPath = resolve(process.cwd(), config.tenantConfigPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Tenant registry file not found: ${resolvedPath}`);
  }

  const contents = readFileSync(resolvedPath, 'utf-8');
  const parsed = JSON.parse(contents);
  return z.array(TenantDatabaseConfigSchema).parse(parsed);
}
