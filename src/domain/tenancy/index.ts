/**
 * Tenancy Domain
 * 
 * Tenant entities, metadata, and validation utilities.
 * 
 * @module domain/tenancy
 */

export type {
  Tenant,
  TenantMetadata,
  TenantProvisioningRequest,
  TenantDeprovisioningRequest,
} from './tenant';

export {
  isValidTenantId,
  validateTenantMetadata,
  isActiveTenant,
  getTenantSchemaName,
} from './tenant';

