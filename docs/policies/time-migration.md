# Temporal Hygiene Migration Guide

**Sprint:** 17  
**Mission:** B17.6  
**Status:** Complete  
**Date:** 2025-10-25

## Overview

This guide documents the completed migration to the dual-time model (business_time vs system_time) for temporal hygiene across the OODS Foundry billing and compliance domains.

## What Changed

### 1. Time Policy Established

- **docs/policies/time.md**: Comprehensive dual-time specification
- **Business Time**: Tenant-relative timestamps for SLAs, billing, reports
- **System Time**: Immutable UTC timestamps for audit trails

### 2. TimeService Utilities

**src/services/time/index.ts** provides:

```typescript
// Current time
TimeService.nowSystem()           // UTC timestamp
TimeService.nowBusiness(tenant)   // Tenant timezone

// Dual timestamp creation
TimeService.createDualTimestamp(tenant)

// Conversions
TimeService.toSystemTime(date)
TimeService.displayInTenantZone(date, tenant)
TimeService.normalizeToUtc(input, tenantTz)

// Business day operations
TimeService.isSameBusinessDay(a, b, tenant)
TimeService.startOfBusinessDay(date, tenant)
TimeService.billingPeriod(year, month, tenant)
```

### 3. Database Migrations

**database/migrations/20251025_add_dual_time_columns.sql** adds:

- `business_time TIMESTAMPTZ NOT NULL`
- `system_time TIMESTAMPTZ NOT NULL`

To tables:
- `subscriptions`
- `invoices`
- `audit_log`
- `usage_summaries`
- `billing_accounts`

### 4. Type Updates

**src/domain/billing/core.ts** now includes dual-time fields:

```typescript
interface CanonicalSubscription {
  // ... other fields
  business_time: DateTime;  // Lifecycle events in tenant TZ
  system_time: DateTime;    // Immutable UTC record
  createdAt: string;        // @deprecated
  updatedAt: string;        // @deprecated
}
```

Similar updates for:
- `CanonicalInvoice`
- `CanonicalPaymentIntent`
- `BillingAccount`

### 5. ESLint Enforcement

**eslint/rules/no-naive-date.cjs** blocks:

```typescript
// ❌ Forbidden
new Date()
Date.now()

// ✅ Required
TimeService.nowSystem()
TimeService.nowBusiness(tenant)
```

Configured in `eslint.config.cjs` with `oods/no-naive-date: error`.

### 6. Comprehensive Tests

**tests/time/temporal-hygiene.spec.ts**: 33 passing tests covering:

- Core API functionality
- DST transitions (spring forward, fall back)
- Business day boundaries
- Billing period calculations
- Timezone conversions
- Database format conversions
- Audit hash stability

### 7. Storybook Proofs

**stories/proofs/TemporalHygiene.stories.tsx** demonstrates:

- Invoice due dates across timezones
- Billing period boundaries
- Subscription lifecycle events
- DST transition resilience

## Migration Steps Completed

1. ✅ Created dual-time policy documentation
2. ✅ Implemented TimeService with Luxon integration
3. ✅ Generated SQL migrations for dual-time columns
4. ✅ Updated TypeScript domain types
5. ✅ Created ESLint rule to prevent naive Date usage
6. ✅ Wrote comprehensive test suite (33 tests)
7. ✅ Created Storybook proof stories

## Dependencies Added

- `luxon ^3.7.2` - Timezone-aware DateTime library
- `@types/luxon ^3.7.1` - TypeScript definitions

## Key Decisions

### Why Luxon?

- **IANA timezone support**: Full timezone database with DST handling
- **Immutability**: All operations return new instances
- **ISO 8601 compliance**: Native database format support
- **Type safety**: Excellent TypeScript integration

### Backward Compatibility

Legacy `createdAt`/`updatedAt` fields marked `@deprecated` but retained for migration period. New code MUST use `business_time`/`system_time`.

## Usage Examples

### Creating Records

```typescript
const tenant: Tenant = { id: 'acme', timezone: 'America/Los_Angeles' };
const dual = TimeService.createDualTimestamp(tenant);

const subscription: CanonicalSubscription = {
  // ... other fields
  business_time: dual.business_time,
  system_time: dual.system_time,
  createdAt: dual.system_time.toISO()!, // legacy compat
  updatedAt: dual.system_time.toISO()!,
};
```

### Billing Period Queries

```typescript
// Get November 2025 billing period for tenant
const [start, end] = TimeService.billingPeriod(2025, 11, tenant);

// Query invoices in billing period
const invoices = await db.query(`
  SELECT * FROM invoices
  WHERE business_time >= $1 AND business_time < $2
  AND tenant_id = $3
`, [start.toISO(), end.toISO(), tenant.id]);
```

### Displaying Timestamps

```typescript
// Show in tenant timezone
const display = TimeService.displayInTenantZone(
  subscription.business_time,
  tenant
);
// "2025-10-25T09:00:00.000-07:00"

// Custom format
const formatted = TimeService.formatForTenant(
  subscription.business_time,
  tenant,
  'MMM dd, yyyy HH:mm'
);
// "Oct 25, 2025 09:00"
```

## Testing DST Transitions

```typescript
// Spring forward: 2025-03-09 2:30am doesn't exist in NY
const input = '2025-03-09T02:30:00';
const normalized = TimeService.normalizeToUtc(input, 'America/New_York');
// Luxon adjusts forward to 3:30am EDT

// Fall back: 2025-11-02 1:30am occurs twice in NY
const ambiguous = '2025-11-02T01:30:00';
const resolved = TimeService.normalizeToUtc(ambiguous, 'America/New_York');
// Luxon picks first occurrence (EDT)
```

## Validation

### Running Tests

```bash
pnpm vitest run tests/time/temporal-hygiene.spec.ts
# ✓ 33 passing
```

### Running ESLint

```bash
pnpm lint
# Enforces no-naive-date rule across src/ and apps/
```

### Viewing Proofs

```bash
pnpm storybook
# Navigate to Proofs → Temporal Hygiene
```

## Next Steps (Out of Scope)

1. **Historical Backfill**: Migrate existing data business_time values from createdAt + tenant TZ
2. **Analytics Warehouse**: Update OLAP queries to respect dual-time semantics
3. **Reporting Dashboards**: Ensure reports query business_time for tenant-relative metrics

## References

- **Policy**: docs/policies/time.md
- **TimeService**: src/services/time/index.ts
- **Tests**: tests/time/temporal-hygiene.spec.ts
- **Proofs**: stories/proofs/TemporalHygiene.stories.tsx
- **Migration**: database/migrations/20251025_add_dual_time_columns.sql
- **Research**: cmos/Industry-Research/R1.4 (temporal divergence analysis)

---

**Completed By:** Codex Agent  
**Sprint:** 17  
**Mission:** B17.6 - Temporal Hygiene  
**Date:** 2025-10-25
