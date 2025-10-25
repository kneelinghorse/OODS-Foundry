# Temporal Hygiene Policy

**Version:** 1.0  
**Effective:** Sprint 17 (October 2025)  
**Status:** Required

## Overview

This policy establishes dual-time conventions for OODS Foundry to eliminate timezone drift and reporting inconsistencies across billing, compliance, and audit domains.

## Dual-Time Model

### Business Time vs System Time

Every time-sensitive domain event maintains **two timestamps**:

1. **`business_time`** (timestamptz): The meaningful moment from a business/tenant perspective
   - Subscription renewals, invoice due dates, user actions
   - Stored in tenant's declared timezone
   - Used for reports, SLAs, billing cycles

2. **`system_time`** (timestamptz): The moment the system recorded the event
   - Immutable audit trail
   - Always UTC internally
   - Used for debugging, replication, event ordering

### When to Use Each

| Use Case | Field | Example |
|----------|-------|---------|
| Invoice due date | `business_time` | "2025-11-01T00:00:00-08:00" (tenant TZ) |
| Audit log entry | `system_time` | "2025-10-25T14:23:45Z" (UTC) |
| Subscription renewal | Both | business: tenant midnight; system: actual DB write |
| Usage event metering | `business_time` | Billed in tenant's day/month boundaries |

## Database Schema

### Column Types

All time columns MUST use `timestamptz` (PostgreSQL) / `TIMESTAMP WITH TIME ZONE` (SQL standard).

**❌ Never use:**
- `timestamp` (without time zone)
- `date` (loses time-of-day precision)
- Integer unix timestamps (loses timezone context)

### Migration Pattern

```sql
-- Add dual-time columns
ALTER TABLE subscriptions
  ADD COLUMN business_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN system_time TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index for queries by business time
CREATE INDEX idx_subscriptions_business_time ON subscriptions(business_time);
```

## TypeScript Utilities

### TimeService API

```typescript
import { TimeService } from '@/services/time';

// Current moments
const now = TimeService.nowBusiness();      // tenant-aware DateTime
const utcNow = TimeService.nowSystem();     // always UTC

// Conversion
const systemTs = TimeService.toSystemTime(businessDate);
const displayStr = TimeService.displayInTenantZone(date, tenant);

// Comparison
const diff = TimeService.compareBusinessTime(dateA, dateB);

// Normalization
const utc = TimeService.normalizeToUtc(userInput, tenantTz);
```

### Luxon Integration

We use [Luxon](https://moment.github.io/luxon/) for timezone-aware operations:

```typescript
import { DateTime } from 'luxon';

// Tenant-relative billing period
const period = DateTime.fromISO('2025-11-01', { zone: 'America/Los_Angeles' });
```

## Lint Rules

### ESLint: `no-naive-date`

Prevents direct `new Date()` or `Date.now()` usage without TimeService wrapper.

**❌ Forbidden:**
```typescript
const now = new Date();
const ts = Date.now();
```

**✅ Required:**
```typescript
const now = TimeService.nowSystem();
const businessNow = TimeService.nowBusiness();
```

### Exceptions

Exceptions allowed only for:
- Test fixtures with explicit `// eslint-disable-next-line no-naive-date`
- Migration scripts (documented separately)

## Testing Requirements

### DST Boundaries

All time-sensitive tests MUST cover:
- Spring forward (2AM → 3AM gap)
- Fall back (1AM → 2AM repeat)

```typescript
it('handles DST spring forward', () => {
  const tz = 'America/New_York';
  // 2025-03-09T02:30 doesn't exist in NY
  const input = DateTime.fromISO('2025-03-09T02:30', { zone: tz });
  expect(input.isValid).toBe(false);
  
  const normalized = TimeService.normalizeToUtc(input, tz);
  expect(normalized.isValid).toBe(true);
});
```

### Audit Hash Stability

Audit log hashes MUST include `system_time` for immutability verification:

```typescript
function computeHash(entry: AuditEntry): string {
  const payload = `${entry.id}|${entry.system_time.toISOString()}|${entry.action}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

## Storybook Proofs

Time-sensitive stories (invoices, subscriptions, usage) display **both** timestamps:

```tsx
<InvoiceCard
  invoice={invoice}
  annotations={{
    dueDate: TimeService.displayInTenantZone(invoice.business_time, tenant),
    recorded: invoice.system_time.toISOString()
  }}
/>
```

## Migration Strategy

### Existing Data

For tables without dual-time:

1. Add columns with `DEFAULT NOW()`
2. Backfill `business_time` from existing timestamp + tenant TZ offset
3. Document confidence level in migration notes

### New Tables

All new domain tables require `business_time` and `system_time` from v1.

## Reference

- **Research:** cmos/Industry-Research/R1.4 (temporal divergence analysis)
- **Tenancy:** docs/tenancy/context.md (tenant timezone metadata)
- **Compliance:** docs/policies/compliance-core.md (audit immutability)

## Rationale

1. **Eliminate Reporting Drift:** Business queries use tenant-local midnight, not UTC midnight
2. **Audit Integrity:** System time provides immutable ordering for forensics
3. **DST Resilience:** Luxon handles edge cases transparently
4. **Multi-Tenant Scale:** Each tenant maintains own business calendar

---

**Owner:** Design System Team  
**Review Cycle:** Quarterly  
**Last Updated:** 2025-10-25
