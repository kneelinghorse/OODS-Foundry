/**
 * Polymorphic Account Domain Model
 * 
 * Canonical account archetypes (Person, Organization, Workspace) with
 * safe metadata policy that prevents PII leakage.
 * 
 * @module domain/accounts/core
 */

import type { DateTime } from 'luxon';

/**
 * Base account fields shared across all archetypes
 */
export interface AccountBase {
  /** Internal account identifier */
  accountId: string;
  
  /** Account display name */
  displayName: string;
  
  /** Account type discriminator */
  accountType: 'person' | 'organization' | 'workspace';
  
  /** Immutable customer key for CRM/billing linkage */
  accountKey?: string;
  
  /** Account health score (0-100) */
  healthScore?: number;
  
  /** Risk segment classification */
  riskSegment?: 'growth' | 'stable' | 'at_risk' | 'churned';
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Preferred payment method */
  paymentMethod?: 'card' | 'ach' | 'wire' | 'invoice';
  
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Business time: account creation in tenant timezone */
  business_time: DateTime;
  
  /** System time: immutable UTC record creation timestamp */
  system_time: DateTime;
}

/**
 * Person account (B2C individual)
 * 
 * PII fields (name, email, phone) live in dedicated Contact table
 * with retention policies and erasure support.
 */
export interface AccountPerson extends AccountBase {
  accountType: 'person';
  
  /** Reference to Contact record (stores PII with retention metadata) */
  contactId: string;
  
  /** Preferred language/locale */
  locale?: string;
  
  /** Timezone identifier (IANA) */
  timezone?: string;
  
  /** Account verification status */
  verified: boolean;
  
  /** Safe metadata: preferences, settings (NO PII) */
  metadata?: PersonMetadata;
}

/**
 * Organization account (B2B company)
 */
export interface AccountOrganization extends AccountBase {
  accountType: 'organization';
  
  /** Legal entity name */
  legalName: string;
  
  /** Tax identifier (VAT, EIN, etc.) */
  taxId?: string;
  
  /** Business domain/industry */
  industry?: string;
  
  /** Employee count range */
  employeeCountRange?: 'self' | '2-10' | '11-50' | '51-200' | '201-1000' | '1001+';
  
  /** Annual revenue range (minor units) */
  annualRevenueRange?: string;
  
  /** Billing contact ID (references Contact table) */
  billingContactId?: string;
  
  /** Account owner/CSM ID */
  accountOwnerId?: string;
  
  /** Safe metadata: business profile (NO PII) */
  metadata?: OrganizationMetadata;
}

/**
 * Workspace account (team/project workspace)
 * 
 * Workspaces belong to an Organization or Person and provide
 * isolated collaboration scope.
 */
export interface AccountWorkspace extends AccountBase {
  accountType: 'workspace';
  
  /** Parent organization ID */
  parentAccountId: string;
  
  /** Workspace slug (URL-safe identifier) */
  slug: string;
  
  /** Workspace visibility */
  visibility: 'private' | 'team' | 'organization';
  
  /** Workspace owner/creator ID */
  ownerId: string;
  
  /** Member count */
  memberCount: number;
  
  /** Safe metadata: workspace settings (NO PII) */
  metadata?: WorkspaceMetadata;
}

/**
 * Union type for all account archetypes
 */
export type Account = AccountPerson | AccountOrganization | AccountWorkspace;

/**
 * Safe metadata schemas (approved keys only, NO PII)
 */

/**
 * Person account metadata (preferences, settings)
 * NO PII: name, email, phone, address live in Contact table
 */
export interface PersonMetadata {
  /** UI theme preference */
  theme?: 'light' | 'dark' | 'auto';
  
  /** Marketing email opt-in */
  marketingOptIn?: boolean;
  
  /** Product update notifications */
  productUpdates?: boolean;
  
  /** Referral source */
  referralSource?: string;
  
  /** Onboarding completed flag */
  onboardingCompleted?: boolean;
  
  /** Feature flags */
  featureFlags?: Record<string, boolean>;
}

/**
 * Organization account metadata (business profile)
 * NO PII: contact details live in Contact table
 */
export interface OrganizationMetadata {
  /** Website URL */
  website?: string;
  
  /** Company registration number */
  registrationNumber?: string;
  
  /** Business license type */
  licenseType?: string;
  
  /** Procurement process notes */
  procurementNotes?: string;
  
  /** Contract renewal reminder (days before) */
  renewalReminderDays?: number;
  
  /** Custom billing terms */
  customBillingTerms?: string;
}

/**
 * Workspace account metadata (settings)
 * NO PII: member data stored separately
 */
export interface WorkspaceMetadata {
  /** Default role for new members */
  defaultMemberRole?: string;
  
  /** Workspace icon/emoji */
  icon?: string;
  
  /** Workspace color theme */
  colorTheme?: string;
  
  /** Resource quotas */
  quotas?: {
    maxMembers?: number;
    maxProjects?: number;
    maxStorage?: number;
  };
  
  /** Integrations enabled */
  integrations?: Record<string, boolean>;
}

/**
 * Contact record (stores PII with retention metadata)
 * Separate table for data subject access/erasure compliance
 */
export interface Contact {
  /** Contact record ID */
  contactId: string;
  
  /** Associated account ID */
  accountId?: string;
  
  /** Full name (PII) */
  fullName: string;
  
  /** Email address (PII) */
  email: string;
  
  /** Phone number (PII, optional) */
  phone?: string;
  
  /** Mailing address (PII, optional) */
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  
  /** Job title */
  title?: string;
  
  /** Contact type */
  contactType: 'primary' | 'billing' | 'technical' | 'legal';
  
  /** Retention policy reference */
  retentionPolicyId: string;
  
  /** Erasure request timestamp (if applicable) */
  erasureRequestedAt?: DateTime;
  
  /** Erasure completed timestamp */
  erasedAt?: DateTime;
  
  /** Business time: contact creation */
  business_time: DateTime;
  
  /** System time: record timestamp */
  system_time: DateTime;
}

/**
 * Account ownership/membership mapping
 * Maps Users ↔ Accounts via RBAC roles
 */
export interface AccountMembership {
  /** Membership record ID */
  membershipId: string;
  
  /** User ID */
  userId: string;
  
  /** Account ID */
  accountId: string;
  
  /** Account type */
  accountType: Account['accountType'];
  
  /** Membership role (from RBAC) */
  roleId: string;
  
  /** Membership state */
  state: 'invited' | 'active' | 'suspended' | 'revoked';
  
  /** Joined timestamp */
  joinedAt: DateTime;
  
  /** Invited by user ID */
  invitedBy?: string;
  
  /** Business time: membership lifecycle */
  business_time: DateTime;
  
  /** System time: record timestamp */
  system_time: DateTime;
}

/**
 * Type guards for account archetypes
 */
export function isPersonAccount(account: Account): account is AccountPerson {
  return account.accountType === 'person';
}

export function isOrganizationAccount(account: Account): account is AccountOrganization {
  return account.accountType === 'organization';
}

export function isWorkspaceAccount(account: Account): account is AccountWorkspace {
  return account.accountType === 'workspace';
}

/**
 * Account input types (for creation)
 */
export type AccountPersonInput = Omit<AccountPerson, 'accountId' | 'business_time' | 'system_time'>;
export type AccountOrganizationInput = Omit<AccountOrganization, 'accountId' | 'business_time' | 'system_time'>;
export type AccountWorkspaceInput = Omit<AccountWorkspace, 'accountId' | 'business_time' | 'system_time'>;

export type AccountInput = AccountPersonInput | AccountOrganizationInput | AccountWorkspaceInput;

/**
 * Contact input type
 */
export type ContactInput = Omit<Contact, 'contactId' | 'business_time' | 'system_time'>;

