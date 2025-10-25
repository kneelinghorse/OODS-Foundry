# Account Archetypes & Polymorphic Model

**Version**: 1.0.0  
**Status**: Active  
**Owner**: Compliance & Billing Domain  
**Last Updated**: 2025-10-25

## Overview

The OODS Foundry implements a **polymorphic Account model** with three distinct archetypes to support B2C, B2B, and workspace collaboration scenarios while maintaining compliance with data protection regulations.

## Why Polymorphic Accounts?

### Problems with Monolithic Account Models

1. **Type confusion**: Mixing individual users and organizations in a single table leads to nullable fields and unclear semantics
2. **PII leakage**: Generic metadata blobs often accumulate sensitive data without retention policies
3. **Access control complexity**: Different archetypes require different permission models
4. **Audit challenges**: Hard to track data lineage when identity, billing, and contact data are conflated

### Our Solution

Separate **Identity**, **Account**, and **Contact** concerns:

- **User** (identity): Authentication, authorization (separate module, not in this doc)
- **Account** (billing/subscription): The entity that pays, has subscriptions, holds settings
- **Contact** (PII): Personal information with retention policies and erasure support

## Account Archetypes

### 1. AccountPerson (B2C)

**Use case**: Individual consumer accounts

```typescript
interface AccountPerson {
  accountId: string;
  accountType: 'person';
  displayName: string;
  contactId: string; // References Contact table (PII)
  locale?: string;
  timezone?: string;
  verified: boolean;
  metadata?: PersonMetadata; // Safe, no PII
}
```

**Key characteristics**:
- One-to-one relationship with Contact record
- Verification status tracked for compliance
- Locale/timezone for personalization
- Safe metadata: preferences, feature flags (NO name, email, phone)

**Example**:
```typescript
const person: AccountPerson = {
  accountId: 'acc_person_abc123',
  accountType: 'person',
  displayName: 'John D.',
  contactId: 'contact_xyz789',
  verified: true,
  locale: 'en-US',
  timezone: 'America/New_York',
  currency: 'USD',
  metadata: {
    theme: 'dark',
    marketingOptIn: true,
  },
  business_time: DateTime.utc(),
  system_time: DateTime.utc(),
};
```

---

### 2. AccountOrganization (B2B)

**Use case**: Company/enterprise accounts

```typescript
interface AccountOrganization {
  accountId: string;
  accountType: 'organization';
  displayName: string;
  legalName: string;
  taxId?: string;
  industry?: string;
  employeeCountRange?: string;
  billingContactId?: string;
  accountOwnerId?: string; // CSM/account manager
  metadata?: OrganizationMetadata; // Safe, business profile
}
```

**Key characteristics**:
- Legal name + tax ID for invoicing
- Billing contact references Contact table
- Account owner/CSM tracking
- Safe metadata: website, procurement notes, custom terms

**Example**:
```typescript
const org: AccountOrganization = {
  accountId: 'acc_org_def456',
  accountType: 'organization',
  displayName: 'Acme Corporation',
  legalName: 'Acme Corporation Ltd.',
  taxId: 'US12-3456789',
  industry: 'Technology',
  employeeCountRange: '51-200',
  billingContactId: 'contact_billing_999',
  accountOwnerId: 'user_csm_111',
  currency: 'USD',
  metadata: {
    website: 'https://acme.example',
    renewalReminderDays: 90,
    customBillingTerms: 'Net 60',
  },
  business_time: DateTime.utc(),
  system_time: DateTime.utc(),
};
```

---

### 3. AccountWorkspace (Team/Project)

**Use case**: Isolated collaboration scope within an organization or owned by a person

```typescript
interface AccountWorkspace {
  accountId: string;
  accountType: 'workspace';
  displayName: string;
  parentAccountId: string; // Organization or Person
  slug: string; // URL-safe identifier
  visibility: 'private' | 'team' | 'organization';
  ownerId: string;
  memberCount: number;
  metadata?: WorkspaceMetadata; // Safe, settings
}
```

**Key characteristics**:
- Belongs to parent Organization or Person account
- Unique slug for workspace URLs
- Visibility controls
- Safe metadata: quotas, integrations, default roles

**Example**:
```typescript
const workspace: AccountWorkspace = {
  accountId: 'acc_workspace_ghi789',
  accountType: 'workspace',
  displayName: 'Engineering Team',
  parentAccountId: 'acc_org_def456',
  slug: 'engineering',
  visibility: 'team',
  ownerId: 'user_lead_222',
  memberCount: 15,
  currency: 'USD',
  metadata: {
    defaultMemberRole: 'contributor',
    icon: '⚙️',
    quotas: {
      maxMembers: 50,
      maxProjects: 100,
    },
    integrations: {
      slack: true,
      github: true,
    },
  },
  business_time: DateTime.utc(),
  system_time: DateTime.utc(),
};
```

---

## Contact Table (PII Segregation)

All personally identifiable information lives in the **Contact** table with retention policies:

```typescript
interface Contact {
  contactId: string;
  accountId?: string;
  fullName: string; // PII
  email: string; // PII
  phone?: string; // PII
  address?: AddressFields; // PII
  title?: string;
  contactType: 'primary' | 'billing' | 'technical' | 'legal';
  retentionPolicyId: string;
  erasureRequestedAt?: DateTime;
  erasedAt?: DateTime;
  business_time: DateTime;
  system_time: DateTime;
}
```

### Data Subject Access/Erasure

When a user requests data deletion:

1. Set `erasureRequestedAt` timestamp
2. Queue erasure job (respects retention policy)
3. On completion:
   - Overwrite PII fields: `fullName: '[ERASED]'`, `email: 'erased_${id}@privacy.local'`
   - Set `erasedAt` timestamp
   - Preserve `contactId` for referential integrity

---

## Account Membership (User ↔ Account Mapping)

The **AccountMembership** table maps Users to Accounts via RBAC roles:

```typescript
interface AccountMembership {
  membershipId: string;
  userId: string; // Authentication identity
  accountId: string; // Account reference
  accountType: Account['accountType'];
  roleId: string; // RBAC role
  state: 'invited' | 'active' | 'suspended' | 'revoked';
  joinedAt: DateTime;
  invitedBy?: string;
}
```

### Membership Lifecycle

1. **Invited**: User invited but hasn't accepted
2. **Active**: User actively using the account
3. **Suspended**: Temporarily disabled (e.g., payment issues)
4. **Revoked**: Permanently removed

---

## Type Guards

Use type guards to safely narrow account types:

```typescript
import { isPersonAccount, isOrganizationAccount, isWorkspaceAccount } from '@domain/accounts';

function processAccount(account: Account) {
  if (isPersonAccount(account)) {
    // account.contactId is available
    console.log(`Person account: ${account.contactId}`);
  } else if (isOrganizationAccount(account)) {
    // account.legalName is available
    console.log(`Org account: ${account.legalName}`);
  } else if (isWorkspaceAccount(account)) {
    // account.parentAccountId is available
    console.log(`Workspace: ${account.slug}`);
  }
}
```

---

## Migration from Legacy BillingAccount

See `database/migrations/20251025_migrate_billing_accounts_to_polymorphic.sql` for migration script.

### Steps

1. **Extract contacts**: Move PII fields to `contacts` table
2. **Classify accounts**: Default to `organization` archetype for B2B
3. **Sanitize metadata**: Remove PII using `extractPIIFromMetadata` helper
4. **Update foreign keys**: Point subscriptions/invoices to new account IDs
5. **Verify**: Run post-migration queries to check for residual PII

---

## Best Practices

### DO

✅ Store PII in `contacts` table with retention policies  
✅ Use type guards to narrow account types  
✅ Validate metadata with `MetadataPolicy.validate()`  
✅ Map users to accounts via `AccountMembership`  
✅ Track temporal data with `business_time` and `system_time`

### DON'T

❌ Store email, phone, or name in account metadata  
❌ Mix account types in conditional logic without type guards  
❌ Write arbitrary metadata without validation  
❌ Conflate User (identity) with Account (billing entity)  
❌ Bypass Contact table for PII storage

---

## Related Documentation

- [Metadata Policy & Safe Metadata Schema](./account-metadata-policy.md)
- [RBAC & Permissions](./rbac.md)
- [Temporal Hygiene (Dual-Time Model)](./time.md)
- [Tenancy Strategy](../tenancy/strategy.md)

---

**Questions?** Contact: compliance-team@oods.dev

