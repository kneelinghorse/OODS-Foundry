/**
 * Account Domain Module
 * 
 * Polymorphic account archetypes with safe metadata policy.
 * 
 * @module domain/accounts
 */

export {
  // Core types
  type AccountBase,
  type AccountPerson,
  type AccountOrganization,
  type AccountWorkspace,
  type Account,
  type Contact,
  type AccountMembership,
  
  // Metadata schemas
  type PersonMetadata,
  type OrganizationMetadata,
  type WorkspaceMetadata,
  
  // Input types
  type AccountInput,
  type AccountPersonInput,
  type AccountOrganizationInput,
  type AccountWorkspaceInput,
  type ContactInput,
  
  // Type guards
  isPersonAccount,
  isOrganizationAccount,
  isWorkspaceAccount,
} from './core.js';

export {
  // Metadata policy
  MetadataPolicy,
  type ValidationResult,
  type ValidationError,
  type ExtractedPII,
  extractPIIFromMetadata,
} from './metadata-policy.js';

