# Usage-Based Billing Ingest

> **Status**: v0 — meter → aggregate → invoice integration  
> **Owner**: Billing Team  
> **Last Updated**: 2025-10-25

## Overview

The usage-based billing system captures metered events, aggregates them into summaries, and integrates with canonical invoices for consumption-based pricing models.

## Architecture

```
┌─────────────────┐
│  Usage Events   │  Raw meter readings (API calls, compute hours, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Aggregator    │  Daily/weekly/monthly rollups
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Usage Summaries │  Aggregated totals by period
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Invoice Builder │  Metered line items on canonical invoices
└─────────────────┘
```

## Usage Event Schema

### UsageEvent

```typescript
interface UsageEvent {
  eventId: string;              // Unique event identifier
  subscriptionId: string;        // Subscription being metered
  tenantId: string;              // Tenant (multi-tenancy isolation)
  meterName: string;             // Meter identifier (e.g., "api_calls")
  unit: MeterUnit;               // Unit of measurement
  quantity: number;              // Amount consumed
  recordedAt: string;            // When usage occurred (ISO 8601)
  source: UsageEventSource;      // Event origin
  idempotencyKey?: string;       // For deduplication
  metadata?: Record<string, unknown>; // Source metadata
  createdAt: string;             // Event creation timestamp
}
```

### Supported Meter Units

- `api_calls` — API request count
- `compute_hours` — Compute time
- `storage_gb` — Storage capacity
- `bandwidth_gb` — Data transfer
- `seats` — User seats
- `transactions` — Transaction count
- `events` — Generic event count
- `units` — Generic metered units

### Event Sources

- `api_gateway` — API Gateway meter
- `background_job` — Batch/async jobs
- `manual_entry` — Manual operator entry
- `import` — Bulk import
- `webhook` — External webhook

## Recording Events

### API

```typescript
import { usageAggregator } from '@/services/billing/usage-aggregator';

// Record single event
const event = await usageAggregator.recordEvent({
  subscriptionId: 'sub_001',
  tenantId: 'tenant_001',
  meterName: 'api_calls',
  unit: 'api_calls',
  quantity: 100,
  source: 'api_gateway',
  idempotencyKey: 'unique_request_id', // Optional
  metadata: {
    endpoint: '/api/v1/users',
    region: 'us-east-1',
  },
});

// Record multiple events
const events = await usageAggregator.recordEvents([...inputs]);
```

### Validation

Events are validated on recording:

- `subscriptionId` — Required
- `tenantId` — Required  
- `meterName` — Required, non-empty
- `unit` — Required
- `quantity` — Required, non-negative number
- `source` — Required

Invalid events throw an error with detailed messages.

### Idempotency

Use `idempotencyKey` to prevent duplicate event recording:

```typescript
// Same key = deduped
await recordEvent({ ...input, idempotencyKey: 'req_abc123' });
await recordEvent({ ...input, idempotencyKey: 'req_abc123' }); // Skipped
```

## Aggregation

### Running Aggregation

```typescript
import { usageAggregator } from '@/services/billing/usage-aggregator';

const result = await usageAggregator.aggregate(
  {
    start: '2025-01-01T00:00:00Z',
    end: '2025-02-01T00:00:00Z',
  },
  {
    period: 'daily', // 'daily' | 'weekly' | 'monthly'
    tenantId: 'tenant_001',
  }
);

console.log(result.summaries); // UsageSummary[]
console.log(result.eventCount); // Total events processed
```

### Usage Summary Schema

```typescript
interface UsageSummary {
  summaryId: string;             // Unique summary ID
  subscriptionId: string;        // Subscription
  tenantId: string;              // Tenant
  meterName: string;             // Meter name
  unit: MeterUnit;               // Unit
  period: AggregationPeriod;     // Aggregation period
  periodStart: string;           // Period start (ISO 8601)
  periodEnd: string;             // Period end (ISO 8601)
  totalQuantity: number;         // Total consumed
  eventCount: number;            // Number of events
  minQuantity: number;           // Min event quantity
  maxQuantity: number;           // Max event quantity
  avgQuantity: number;           // Average per event
  aggregatedAt: string;          // Aggregation timestamp
  createdAt: string;             // Created timestamp
}
```

### Scheduled Aggregation

Set up a daily aggregation job (e.g., via cron or scheduled task):

```typescript
// Daily aggregation job
async function dailyAggregation() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await usageAggregator.aggregate(
    {
      start: yesterday.toISOString(),
      end: today.toISOString(),
    },
    {
      period: 'daily',
      tenantId: process.env.TENANT_ID,
    }
  );
  
  console.log(`Aggregated ${result.eventCount} events into ${result.summaries.length} summaries`);
}
```

### CLI Job

Use the built-in PNPM script for local development or ad-hoc rollups:

```bash
# Generate sample events
pnpm usage:sample sub_test_001 --tenant tenant_test --count 200 > artifacts/usage/events.json

# Aggregate previous day's usage for tenant_test
pnpm usage:aggregate --tenant tenant_test
```

The aggregation job writes UsageSummary records to `artifacts/usage/summaries.json`, which the invoice builder consumes when attaching metered line items.

## Invoice Integration

### Metered Line Items

Usage summaries convert to invoice line items:

```typescript
interface UsageLineItem {
  id: string;
  description: string;           // "API Calls - January 2025"
  meterName: string;
  unit: MeterUnit;
  quantity: number;              // From summary
  unitRateMinor: number;         // Price per unit (cents)
  totalMinor: number;            // quantity × unitRateMinor
  periodStart: string;
  periodEnd: string;
  summaryId: string;             // Reference to UsageSummary
  createdAt: string;
}
```

### Overage Calculation

```typescript
import { calculateOverage } from '@/domain/billing/usage';

const overage = calculateOverage(
  15000,  // totalQuantity
  10000,  // includedQuantity
  5       // overageRateMinor ($0.05)
);
// => 25000 (5000 overage × $0.05 = $250.00)
```

### Example Invoice

```typescript
{
  invoiceId: 'inv_001',
  invoiceNumber: 'INV-2025-001',
  status: 'posted',
  lineItems: [
    {
      id: 'li_base',
      description: 'API Metered Plan - Monthly',
      quantity: 1,
      unitAmountMinor: 4900,
      amountMinor: 4900,
    },
    {
      id: 'li_usage',
      description: 'API Calls - Overage (5,000 calls @ $0.05/call)',
      quantity: 5000,
      unitAmountMinor: 5,
      amountMinor: 25000, // $250.00
    },
  ],
  totalMinor: 29900, // $299.00
}
```

### UsageInvoiceBuilder

The invoice builder enriches canonical invoices with usage line items pulled from persisted summaries:

```typescript
import { usageInvoiceBuilder } from '@/services/billing/invoice-builder';
import { usageAggregator } from '@/services/billing/usage-aggregator';

// 1. Record and aggregate events (usually cron via pnpm usage:aggregate)
await usageAggregator.recordEvents(eventsFromProvider);
await usageAggregator.aggregate(
  {
    start: '2025-01-01T00:00:00Z',
    end: '2025-02-01T00:00:00Z',
  },
  {
    tenantId: 'tenant_001',
    period: 'daily',
  }
);

// 2. Attach usage to canonical invoice before rendering or publishing
const enrichedInvoice = await usageInvoiceBuilder.attachUsage(canonicalInvoice, canonicalSubscription);
console.log(enrichedInvoice.usageLineItems);
```

By default the builder reads summaries from `artifacts/usage/summaries.json`, ensuring invoices rendered in Storybook or downstream services reflect the latest aggregated usage.

## Testing & Development

### Generate Sample Events

Use the CLI tool to generate test data:

```bash
# Generate 100 events over 7 days
pnpm usage:sample sub_test_001 --count 100 --days 7

# Generate with specific tenant
pnpm usage:sample sub_prod_123 --tenant tenant_prod --count 500 --days 30

# Output summary
pnpm usage:sample sub_dev_001 --format summary
```

### Test Workflow

```typescript
import { usageAggregator } from '@/services/billing/usage-aggregator';

// 1. Record events
await usageAggregator.recordEvents([
  {
    subscriptionId: 'sub_test',
    tenantId: 'tenant_test',
    meterName: 'api_calls',
    unit: 'api_calls',
    quantity: 100,
    source: 'api_gateway',
  },
]);

// 2. Aggregate
const result = await usageAggregator.aggregate(
  {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-02T00:00:00Z',
  },
  { period: 'daily', subscriptionId: 'sub_test' }
);

// 3. Retrieve summaries
const summaries = await usageAggregator.getSummaries('sub_test');
```

## Tenancy Isolation

All usage events and summaries are isolated by `tenantId`:

- Events recorded with `tenantId`
- Aggregation scoped to tenant
- Queries filter by tenant

This ensures multi-tenant data sovereignty.

## Best Practices

### Event Recording

1. **Use idempotency keys** for request-driven events
2. **Include metadata** for debugging and analytics
3. **Record at source** (API gateway, job completion)
4. **Validate inputs** before recording

### Aggregation

1. **Run daily** for timely reporting
2. **Monitor failures** and retry
3. **Archive old events** after aggregation
4. **Pre-aggregate** high-volume meters

### Invoice Integration

1. **Define clear rate tiers** in subscription plans
2. **Document overage policies** for customers
3. **Notify before overage** charges
4. **Provide usage dashboards** for transparency

## Future Enhancements

- **Real-time streaming analytics** (current: batch aggregation)
- **Provider-specific usage push** (Stripe Usage Records, etc.)
- **Usage alerts & notifications**
- **Custom aggregation windows**
- **Usage forecasting**

## Related Documentation

- [Canonical Billing Model](./canonical-model.md)
- [Billing ACL](./billing-acl.md)
- [Subscription States](./subscription-states.md)
- [Invoice Lifecycle](./invoice-lifecycle.md)

## Support

For questions or issues:

- **Slack**: #billing-engineering
- **Email**: billing-team@example.com
- **Docs**: https://docs.example.com/billing/usage
