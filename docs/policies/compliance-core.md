# Compliance Core — RBAC & Audit Log

**Status:** Active (Sprint 17)  
**Version:** 1.0.0  
**Owner:** Design System Team  
**Last Updated:** 2025-10-24

## Overview

The Compliance Core provides foundational **Role-Based Access Control (RBAC)** and **immutable audit logging** across the OODS platform. This module enforces authorization boundaries on domain actions (subscriptions, overlays, tokens) and maintains a tamper-proof audit trail for compliance and forensic purposes.

---

## Architecture

### RBAC Components

The RBAC system implements a canonical **five-table model** with optional role hierarchy and separation-of-duty (SoD) constraints:

```
┌─────────────────┐
│     Roles       │  (e.g., viewer, contributor, approver)
└────────┬────────┘
         │
         │ inherits from (optional hierarchy)
         ▼
┌─────────────────┐       ┌──────────────────┐
│ Role Permissions├───────┤   Permissions    │
└────────┬────────┘       └──────────────────┘
         │                 (resource + action pairs)
         │
         ▼
┌─────────────────┐
│   User Roles    │  (user-to-role assignments with tenant scope)
└─────────────────┘
```

**Separation-of-Duty Constraints:**  
Prevent single users from holding conflicting roles (e.g., submitter + approver).

### Audit Log Components

The audit log is an **append-only** immutable chain:

```
Entry 1 → Entry 2 → Entry 3 → ...
  ├─ previousHash (SHA-256 of Entry 1)
  ├─ payloadHash (SHA-256 of action payload)
  ├─ sequenceNumber (monotonic counter)
```

**Chain Integrity:** Each entry links to the previous via cryptographic hash, enabling tamper detection.

---

## Data Model

### Roles

| Field          | Type   | Description                              |
|----------------|--------|------------------------------------------|
| id             | string | Unique role identifier                   |
| name           | string | Role name (e.g., "contributor")          |
| description    | string | Human-readable description               |
| metadata       | object | Optional flags (system, privileged)      |
| parentRoleId   | string | Optional parent for hierarchy inheritance|

**Baseline Roles:**
- `viewer`: Read-only access
- `contributor`: Create and edit resources
- `approver`: Review and approve changes
- `compliance-admin`: Manage roles and audit logs

### Database Migration

- Location: `database/migrations/20251024_171_compliance_core.sql`
- Provisions canonical RBAC tables (`roles`, `permissions`, `role_permissions`, `user_roles`, `role_hierarchy`) plus SoD mappings.
- Creates `compliance.audit_log` with append-only sequence + `BEFORE UPDATE/DELETE` triggers that raise on mutation.
- Aligns with security/governance research calling for immutable audit trails and database-level guardrails.

### Permissions

| Field       | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| id          | string | Unique permission identifier                 |
| resource    | string | Resource type (subscription, overlay, token) |
| action      | string | Action (read, write, pause, approve)         |
| constraints | object | Optional JSON constraints                    |

**Examples:**
- `subscription:pause` — Pause active subscription
- `overlay:publish` — Publish overlay to production
- `token:approve` — Approve token changes

### User Roles

| Field      | Type   | Description                         |
|------------|--------|-------------------------------------|
| userId     | string | User identifier                     |
| roleId     | string | Assigned role                       |
| tenantId   | string | Optional tenant/organization scope  |
| grantedBy  | string | Who granted the role                |
| expiresAt  | Date   | Optional expiration                 |

### Audit Log Entry

| Field           | Type   | Description                          |
|-----------------|--------|--------------------------------------|
| id              | string | Unique entry identifier              |
| timestamp       | string | ISO 8601 timestamp                   |
| actorId         | string | User/agent who performed action      |
| actorType       | enum   | user, agent, system                  |
| action          | string | Action performed (e.g., subscription.pause) |
| resourceRef     | string | Resource reference (e.g., subscription:sub_123) |
| payloadHash     | string | SHA-256 hash of payload              |
| previousHash    | string | Hash of previous entry (chain link) |
| sequenceNumber  | number | Monotonic sequence counter           |
| severity        | enum   | INFO, WARNING, CRITICAL              |

---

## Service APIs

### RBACService

```typescript
import { RBACService } from '@oods/trait-engine/services/compliance/rbac-service';

const rbacService = new RBACService();

// Check permission
const result = rbacService.checkPermission(
  'user_123',
  'subscription:sub_456',
  'pause'
);
// → { allowed: true, grantedByRoles: ['contributor'] }

// List effective roles (including inherited)
const roles = rbacService.listEffectiveRoles('user_123');

// Grant role
rbacService.grantRole('user_123', 'role_contributor', 'admin_1');

// Revoke role
rbacService.revokeRole('user_123', 'role_contributor');
```

> **Tenant membership:** `grantRole()` validates active `User↔Organization` membership (Relationship.object state `active`) before allowing tenant-scoped assignments. `checkPermission()` returns an explicit `"not an active member"` reason when membership is missing, preventing orphaned grants.

### AuditLogService

```typescript
import { AuditLogService } from '@oods/trait-engine/services/compliance/audit-service';

const auditService = new AuditLogService();

// Record audit event
const entry = auditService.record({
  actorId: 'user_123',
  actorType: 'user',
  action: 'subscription.pause',
  resourceRef: 'subscription:sub_456',
  payload: { reason: 'customer request' },
  severity: 'WARNING',
});

// Query audit log
const logs = auditService.query({
  actorId: 'user_123',
  startTime: '2025-10-01T00:00:00Z',
  endTime: '2025-10-31T23:59:59Z',
});

// Verify chain integrity
const verification = auditService.verifyIntegrity();
// → { valid: true }

// Export for compliance reporting
const exported = auditService.export();
```

---

## Usage Patterns

### 1. Gating Subscription Actions

```typescript
// Before pausing a subscription
const canPause = rbacService.checkPermission(
  userId,
  `subscription:${subscriptionId}`,
  'pause'
);

if (!canPause.allowed) {
  throw new Error(`Unauthorized: ${canPause.reason}`);
}

// Record action in audit log
auditService.record({
  actorId: userId,
  actorType: 'user',
  action: 'subscription.pause',
  resourceRef: `subscription:${subscriptionId}`,
  payload: { reason, timestamp: new Date().toISOString() },
  severity: 'WARNING',
});

// Proceed with pause logic...
```

### 2. Enforcing Token Approval Workflow

```typescript
// Contributor submits token change
auditService.record({
  actorId: contributorId,
  actorType: 'user',
  action: 'token.write',
  resourceRef: `token:${tokenId}`,
  payload: { oldValue, newValue },
  severity: 'INFO',
});

// Approver reviews and approves
const canApprove = rbacService.checkPermission(
  approverId,
  `token:${tokenId}`,
  'approve'
);

if (!canApprove.allowed) {
  throw new Error('Only approvers can approve token changes');
}

auditService.record({
  actorId: approverId,
  actorType: 'user',
  action: 'token.approve',
  resourceRef: `token:${tokenId}`,
  payload: { approved: true, submittedBy: contributorId },
  severity: 'CRITICAL',
});
```

### 3. Multi-Tenant Role Scoping

```typescript
// Grant role scoped to specific tenant
rbacService.grantRole(
  userId,
  'role_contributor',
  'admin',
  'tenant_a' // tenant scope
);

// Permission checks automatically respect tenant scope
const result = rbacService.checkPermission(
  userId,
  'subscription:sub_123',
  'write',
  'tenant_a' // only has permission in tenant_a
);
```

---

## Operational Runbook

### Daily Operations

1. **Monitor Audit Log Volume**
   ```bash
   pnpm compliance:proof
   # Check audit statistics in output
   ```

2. **Verify Chain Integrity**
   ```typescript
   const verification = auditService.verifyIntegrity();
   if (!verification.valid) {
     alert('CRITICAL: Audit log tampering detected');
   }
   ```

3. **Review Critical Actions**
   ```typescript
   const criticalLogs = auditService.query({
     severity: 'CRITICAL',
     startTime: startOfDay,
   });
   ```

4. **Enforce Audit Immutability**
   ```bash
   pnpm lint:audit-log
   # Fails if any migration attempts UPDATE/DELETE/TRUNCATE on compliance.audit_log
   ```

### Role Management

**Grant Role:**
```bash
# Via API
rbacService.grantRole(userId, roleId, grantedBy, tenantId, expiresAt);
```

**Revoke Role:**
```bash
# Via API
rbacService.revokeRole(userId, roleId, tenantId);
```

**Add SoD Constraint:**
```typescript
rbacService.addSoDConstraint({
  id: 'sod_approver_submitter',
  name: 'approver-submitter-separation',
  conflictingRoleIds: ['role_approver', 'role_contributor'],
  description: 'Cannot approve own submissions',
  createdAt: new Date(),
});
```

### Data Retention

**Audit Log Retention Policy:**
- **Active logs:** Retain indefinitely (append-only)
- **Archival:** Export monthly for cold storage
- **Compliance requirements:** 7 years retention (consult legal)

**Export for Compliance:**
```typescript
const logs = auditService.export({
  startTime: '2025-01-01T00:00:00Z',
  endTime: '2025-12-31T23:59:59Z',
});

// Write to secure archive
fs.writeFileSync('audit-2025.json', JSON.stringify(logs, null, 2));
```

---

## CI Enforcement

### Prevent Audit Log Tampering

**Linter Rule (Future):**
Reject any SQL/Prisma mutations that `UPDATE` or `DELETE` from audit_log table:

```typescript
// ❌ BLOCKED
db.auditLog.delete({ where: { id } });

// ✅ ALLOWED
db.auditLog.create({ data: entry });
```

### Permission Check Coverage

**Contract Tests:**
Ensure all privileged actions gate via `checkPermission()`:

```typescript
// tests/compliance/contracts.spec.ts
describe('Subscription Pause', () => {
  it('must check permission before pausing', () => {
    // Assert permission check is invoked
  });
});
```

---

## Testing

### Run Tests

```bash
# Unit tests
pnpm test tests/compliance/rbac.spec.ts
pnpm test tests/compliance/audit-log.spec.ts

# Integration tests
pnpm test tests/compliance/integration.spec.ts

# CLI proof
pnpm compliance:proof
```

### Storybook Proofs

Interactive permission checks and audit log viewer:

```bash
pnpm storybook
# Navigate to: Proofs > Compliance Core
```

**Stories:**
- `PermissionCheckDemo` — Interactive RBAC testing
- `AuditLogViewer` — Chain integrity and event inspection

---

## Security Considerations

1. **Immutability:** Audit logs must never be modified post-creation. Enforce at database and service layer.
2. **Hash Chain:** Verify integrity regularly; any break indicates tampering.
3. **Separation of Duty:** Critical workflows (e.g., token approval) should enforce SoD constraints.
4. **Tenant Isolation:** Ensure role grants and permission checks always respect tenant scope.
5. **Privileged Roles:** Limit `compliance-admin` role to trusted users; log all role grants at CRITICAL severity.

---

## Migration Guide

### From No RBAC

**Before (Direct Permission Check):**
```typescript
if (user.role !== 'admin') {
  throw new Error('Unauthorized');
}
```

**After (RBAC):**
```typescript
const result = rbacService.checkPermission(user.id, resourceRef, action);
if (!result.allowed) {
  throw new Error(`Unauthorized: ${result.reason}`);
}
```

### From External Audit System

**Before (External Logger):**
```typescript
externalLogger.log({ user, action, resource });
```

**After (Compliance Core):**
```typescript
auditService.record({
  actorId: user.id,
  actorType: 'user',
  action,
  resourceRef,
  payload: { ... },
});
```

---

## References

- **Mission:** `cmos/missions/sprint-17/B17.1_compliance-core-rbac-audit.yaml`
- **Research:** `cmos/Industry-Research/R1.4_Convergent-Gravity-Analysis.md`
- **RBAC Schema:** `src/domain/compliance/rbac.ts`
- **Audit Schema:** `src/domain/compliance/audit.ts`
- **Services:** `src/services/compliance/`
- **Tests:** `tests/compliance/`

---

## Changelog

### 2025-10-24 — v1.0.0 (Initial Release)

- Implemented canonical 5-table RBAC model
- Added role hierarchy and SoD constraints
- Built append-only audit log with hash chain
- Delivered RBACService and AuditLogService APIs
- Unit, contract, and integration tests (100% coverage)
- CLI proof (`pnpm compliance:proof`)
- Storybook proofs (`Proofs/Compliance Core`)

---

## Support

For questions or issues:
- **Internal Slack:** `#oods-compliance`
- **Docs:** `docs/policies/compliance-core.md`
- **Runbook:** This document

---

**End of Document**
