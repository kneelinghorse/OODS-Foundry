# Account Metadata Policy & Guardrails

**Version**: 1.0.0  
**Status**: Active  
**Owner**: Compliance & Security  
**Last Updated**: 2025-10-25

## Overview

This policy defines **safe metadata schemas** for Account objects and prevents PII leakage into generic JSON blobs. All metadata must pass validation before storage.

## Why a Metadata Policy?

### Problems with Unstructured Metadata

1. **PII accumulation**: Developers inadvertently store email, phone, SSN in "flexible" metadata fields
2. **GDPR/CCPA risk**: Unstructured data makes data subject access requests (DSAR) impossible to fulfill
3. **Audit gaps**: No way to track what data exists or where it came from
4. **Schema drift**: Metadata keys proliferate without governance

### Our Solution

- **Approved key allowlist**: Only documented keys accepted per account type
- **PII detection**: Automated scanning rejects email, phone, SSN, credit card patterns
- **Runtime validation**: `MetadataPolicy.validate()` required before write
- **Static enforcement**: ESLint rule `no-account-unsafe-metadata` blocks unsafe code

---

## Safe Metadata Schemas

### PersonMetadata (B2C Preferences)

**Approved keys** (NO PII):

| Key                   | Type                      | Description                     |
|-----------------------|---------------------------|---------------------------------|
| `theme`               | `'light' \| 'dark' \| 'auto'` | UI theme preference         |
| `marketingOptIn`      | `boolean`                 | Marketing email consent         |
| `productUpdates`      | `boolean`                 | Product update notifications    |
| `referralSource`      | `string`                  | How user found the product      |
| `onboardingCompleted` | `boolean`                 | Onboarding flow completion flag |
| `featureFlags`        | `Record<string, boolean>` | Experimental feature opt-ins    |

**Example**:
```typescript
const metadata: PersonMetadata = {
  theme: 'dark',
  marketingOptIn: false,
  productUpdates: true,
  featureFlags: {
    beta_editor: true,
  },
};
```

**Forbidden**:
```typescript
// ❌ WRONG: PII in metadata
const badMetadata = {
  fullName: 'John Doe', // Store in Contact table!
  email: 'john@example.com', // Store in Contact table!
  phone: '555-1234', // Store in Contact table!
};
```

---

### OrganizationMetadata (B2B Profile)

**Approved keys** (NO PII):

| Key                    | Type     | Description                           |
|------------------------|----------|---------------------------------------|
| `website`              | `string` | Company website URL                   |
| `registrationNumber`   | `string` | Business registration number          |
| `licenseType`          | `string` | Business license classification       |
| `procurementNotes`     | `string` | Internal procurement process notes    |
| `renewalReminderDays`  | `number` | Days before renewal to send reminder  |
| `customBillingTerms`   | `string` | Custom payment terms (e.g., "Net 90") |

**Example**:
```typescript
const metadata: OrganizationMetadata = {
  website: 'https://acme.example',
  registrationNumber: 'REG-2024-001',
  procurementNotes: 'Requires VP approval for >$50k contracts',
  renewalReminderDays: 90,
  customBillingTerms: 'Net 60',
};
```

**Forbidden**:
```typescript
// ❌ WRONG: Contact info in metadata
const badMetadata = {
  billingEmail: 'billing@acme.com', // Use billingContactId!
  supportPhone: '555-9999', // Use Contact table!
};
```

---

### WorkspaceMetadata (Team Settings)

**Approved keys** (NO PII):

| Key                  | Type                      | Description                     |
|----------------------|---------------------------|---------------------------------|
| `defaultMemberRole`  | `string`                  | Default role for new members    |
| `icon`               | `string`                  | Workspace icon/emoji            |
| `colorTheme`         | `string`                  | Workspace color theme           |
| `quotas`             | `object`                  | Resource quotas (members, etc.) |
| `integrations`       | `Record<string, boolean>` | Enabled integrations            |

**Example**:
```typescript
const metadata: WorkspaceMetadata = {
  defaultMemberRole: 'contributor',
  icon: '🚀',
  colorTheme: 'purple',
  quotas: {
    maxMembers: 50,
    maxProjects: 100,
  },
  integrations: {
    slack: true,
    github: true,
  },
};
```

---

## Runtime Validation

### Required Before Write

Every metadata write must call `MetadataPolicy.validate()`:

```typescript
import { MetadataPolicy } from '@domain/accounts';

// ✅ CORRECT
const account: AccountPerson = {
  accountId: 'acc_123',
  accountType: 'person',
  displayName: 'Alice',
  contactId: 'contact_456',
  currency: 'USD',
  verified: true,
  metadata: {
    theme: 'dark',
    marketingOptIn: true,
  },
  business_time: DateTime.utc(),
  system_time: DateTime.utc(),
};

const result = MetadataPolicy.validate(account);
if (!result.valid) {
  throw new Error(`Metadata validation failed: ${result.errors.map(e => e.message).join(', ')}`);
}

// Save to database
await saveAccount(account);
```

### Validation Errors

The validator returns structured errors:

```typescript
interface ValidationError {
  field: string;
  code: 'unknown_key' | 'pii_detected' | 'type_mismatch' | 'value_out_of_range';
  message: string;
}
```

**Example error**:
```json
{
  "field": "metadata.email",
  "code": "pii_detected",
  "message": "Email address detected in metadata. Store in Contact table instead."
}
```

---

## PII Detection Patterns

The policy automatically scans for PII patterns:

| Pattern       | Regex                                      | Action         |
|---------------|--------------------------------------------|----------------|
| Email         | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}\b` | Reject |
| Phone         | `\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`           | Reject         |
| SSN           | `\b\d{3}-\d{2}-\d{4}\b`                   | Reject + alert |
| Credit Card   | `\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b` | Reject + alert |

**Example violations**:

```typescript
// ❌ Email detected
metadata: {
  notes: 'Contact at alice@example.com', // REJECTED
}

// ❌ Phone detected
metadata: {
  support: 'Call 555-123-4567', // REJECTED
}

// ❌ SSN (critical)
metadata: {
  taxInfo: '123-45-6789', // REJECTED + incident created
}
```

---

## ESLint Enforcement

The `no-account-unsafe-metadata` rule blocks unsafe code at lint time:

```typescript
// ❌ Fails lint
account.metadata = { secretKey: 'value' }; // Missing validation

// ✅ Passes lint
const result = MetadataPolicy.validate(account);
if (result.valid) {
  account.metadata = { theme: 'dark' };
}
```

Enable in `.eslintrc.json` (or equivalent config):

```json
{
  "rules": {
    "oods/no-account-unsafe-metadata": "error"
  }
}
```

---

## Sanitization for Migration

When migrating legacy data, use `extractPIIFromMetadata` to separate PII:

```typescript
import { extractPIIFromMetadata } from '@domain/accounts';

const legacyMetadata = {
  theme: 'light',
  contactEmail: 'user@example.com',
  supportPhone: '555-9999',
};

const extracted = extractPIIFromMetadata(legacyMetadata);

console.log(extracted.emails); // ['user@example.com']
console.log(extracted.phones); // ['555-9999']
console.log(extracted.sanitizedMetadata); // { theme: 'light' }

// Create Contact record with extracted PII
await createContact({
  email: extracted.emails[0],
  phone: extracted.phones[0],
  // ...
});

// Save sanitized metadata
account.metadata = extracted.sanitizedMetadata;
```

---

## Testing Requirements

All code that writes metadata must include tests:

```typescript
import { MetadataPolicy } from '@domain/accounts';

describe('Account creation', () => {
  it('should reject metadata with email', () => {
    const account = createAccount({
      metadata: {
        // @ts-expect-error - testing PII
        userEmail: 'test@example.com',
      },
    });
    
    const result = MetadataPolicy.validate(account);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('pii_detected');
  });
});
```

---

## Compliance Checklist

Before deploying account-related code:

- [ ] All metadata keys documented in approved schemas
- [ ] `MetadataPolicy.validate()` called before every write
- [ ] ESLint rule enabled and passing
- [ ] PII extracted to Contact table with retention policy
- [ ] Tests cover PII detection and sanitization
- [ ] Migration script reviewed for residual PII

---

## Incident Response

If PII is discovered in metadata:

1. **Immediate**: Quarantine affected records
2. **Extract**: Use `extractPIIFromMetadata` to identify PII
3. **Migrate**: Move PII to Contact table
4. **Sanitize**: Overwrite metadata field
5. **Audit**: Log incident in audit trail
6. **Notify**: Inform compliance team and affected users (if required)

---

## Related Documentation

- [Account Archetypes](./account-archetypes.md)
- [Contact Table & Retention Policies](./contact-retention.md)
- [RBAC & Permissions](./rbac.md)
- [Data Subject Access Requests (DSAR)](./dsar.md)

---

**Questions?** Contact: compliance-team@oods.dev  
**Report violations**: security@oods.dev
