/**
 * Tenancy Service
 * 
 * Multi-tenant isolation and context management.
 * Provides tenant-scoped execution contexts for all data access.
 * 
 * @module services/tenancy
 */

export { TenancyContext } from './tenancy-context';
export { TenantResolver, SubdomainResolver, HeaderResolver, JWTResolver } from './tenant-resolver';
export type { ITenantResolver, TenantResolutionResult } from './tenant-resolver';
export {
  SharedSchemaAdapter,
  SchemaPerTenantAdapter,
  ExternalAdapter,
} from './database-adapters';
export type { ITenancyAdapter, TenantDatabaseConnection } from './database-adapters';
