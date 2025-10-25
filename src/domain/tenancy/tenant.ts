/**
 * Tenant Domain Model
 * 
 * Core tenant entity and metadata structures.
 * 
 * @module domain/tenancy/tenant
 */

/**
 * Tenant entity
 */
export interface Tenant {
  /**
   * Unique tenant identifier (UUID)
   */
  id: string;

  /**
   * Display name
   */
  displayName: string;

  /**
   * Tenancy mode for this tenant
   */
  mode: 'shared-schema' | 'schema-per-tenant' | 'external-adapter';

  /**
   * PostgreSQL schema name (for schema-per-tenant mode)
   * @example 'tenant_abc123'
   */
  schemaName?: string;

  /**
   * External database connection ID (for external-adapter mode)
   */
  databaseConnectionId?: string;

  /**
   * Data residency requirement
   * @example 'EU', 'US', 'APAC'
   */
  residency?: string;

  /**
   * Tenant status
   */
  status: 'active' | 'suspended' | 'deprovisioning' | 'archived';

  /**
   * Subscription tier
   */
  tier: 'trial' | 'starter' | 'professional' | 'enterprise' | 'custom';

  /**
   * Feature flags enabled for this tenant
   */
  features?: string[];

  /**
   * Tenant-specific metadata (non-PII)
   */
  metadata?: TenantMetadata;

  /**
   * Provisioning timestamp
   */
  createdAt: string;

  /**
   * Last update timestamp
   */
  updatedAt: string;

  /**
   * Deprovisioning timestamp (when status = archived)
   */
  archivedAt?: string;
}

/**
 * Tenant metadata (non-PII only)
 */
export interface TenantMetadata {
  /**
   * Primary domain
   */
  domain?: string;

  /**
   * Industry vertical
   */
  industry?: string;

  /**
   * Company size
   */
  companySize?: 'small' | 'medium' | 'large' | 'enterprise';

  /**
   * Primary region
   */
  region?: string;

  /**
   * Preferred language/locale
   */
  locale?: string;

  /**
   * Billing currency
   */
  currency?: string;

  /**
   * Custom branding enabled
   */
  customBranding?: boolean;

  /**
   * Additional non-PII fields
   */
  [key: string]: unknown;
}

/**
 * Tenant provisioning request
 */
export interface TenantProvisioningRequest {
  displayName: string;
  mode: Tenant['mode'];
  tier: Tenant['tier'];
  residency?: string;
  features?: string[];
  metadata?: TenantMetadata;
}

/**
 * Tenant deprovisioning request
 */
export interface TenantDeprovisioningRequest {
  tenantId: string;
  reason: 'account_closed' | 'compliance_violation' | 'non_payment' | 'migration' | 'other';
  retentionDays?: number;
}

/**
 * Validate tenant ID format
 */
export function isValidTenantId(tenantId: string): boolean {
  if (!tenantId || typeof tenantId !== 'string') {
    return false;
  }
  // UUID v4 format or tenant- prefix with alphanumeric
  return /^([a-f0-9-]{36}|tenant-[a-z0-9-]+)$/.test(tenantId);
}

/**
 * Validate tenant metadata (ensure no PII)
 */
export function validateTenantMetadata(metadata: unknown): metadata is TenantMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const record = metadata as Record<string, unknown>;

  // Block common PII fields
  const piiFields = ['email', 'phone', 'ssn', 'passport', 'creditCard', 'address'];
  for (const field of piiFields) {
    if (field in record) {
      throw new Error(`PII field '${field}' not allowed in tenant metadata. Use dedicated schemas.`);
    }
  }

  return true;
}

/**
 * Check if tenant is active
 */
export function isActiveTenant(tenant: Tenant): boolean {
  return tenant.status === 'active';
}

/**
 * Get schema name for tenant
 */
export function getTenantSchemaName(tenantId: string): string {
  return `tenant_${tenantId.replace(/-/g, '_')}`;
}

