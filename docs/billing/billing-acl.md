# Billing Anti-Corruption Layer (ACL)

## Overview

The Billing Anti-Corruption Layer (ACL) isolates third-party billing provider models (Stripe, Chargebee, Zuora) behind adapters that translate provider-specific payloads into canonical domain types. This preserves core sovereignty and prevents provider terminology from leaking into the application.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Providers                       │
├──────────────┬──────────────────┬──────────────────────────────┤
│    Stripe    │    Chargebee     │         Zuora                │
│  Webhooks    │    Webhooks      │       Webhooks               │
└──────┬───────┴────────┬─────────┴──────────┬───────────────────┘
       │                │                     │
       │                │                     │
       ▼                ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│              Provider Adapters (ACL Boundary)                     │
├──────────────┬──────────────────┬───────────────────────────────┤
│ StripeAdapter│ ChargebeeAdapter │      ZuoraAdapter             │
│              │                  │                               │
│ - translate  │ - translate      │ - translate                   │
│   Subscription│   Subscription  │   Subscription                │
│ - translate  │ - translate      │ - translate                   │
│   Invoice    │   Invoice        │   Invoice                     │
│ - translate  │ - translate      │ - translate                   │
│   Event      │   Event          │   Event                       │
└──────┬───────┴────────┬─────────┴──────────┬───────────────────┘
       │                │                     │
       │  Canonical Domain Types              │
       ▼                ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Canonical Domain Layer                         │
├──────────────────────────────────────────────────────────────────┤
│  - CanonicalSubscription                                         │
│  - CanonicalInvoice                                              │
│  - CanonicalPaymentIntent                                        │
│  - BillingEvent                                                  │
└──────┬───────────────────────────────────────────────────────────┘
       │
       │  Provider-agnostic types
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Application Layer (UI, Services)                 │
│                                                                   │
│  ✅ Uses only canonical types                                    │
│  ✅ No provider-specific identifiers                             │
│  ✅ Provider changes don't impact core logic                     │
└──────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. **Provider Sovereignty**
The ACL ensures that changes to billing providers (adding new ones, removing old ones, or switching between them) do not require changes to core application logic.

### 2. **Terminology Isolation**
Provider-specific terminology (e.g., `sub_abc123`, `StripeSubscription`) never appears outside of adapter modules. This is enforced via ESLint rules.

### 3. **Single Responsibility**
Each adapter has one job: translate provider payloads to canonical types. Business logic lives in the domain layer, not in adapters.

### 4. **Audit Trail Preservation**
While we normalize data, we preserve provider metadata for audit purposes:
- Provider name
- Provider resource ID
- Provider status (raw)
- Translation timestamp

## Canonical Domain Types

### CanonicalSubscription

Provider-agnostic subscription representation:

```typescript
interface CanonicalSubscription {
  subscriptionId: string;           // Internal ID: "stripe_sub_123"
  accountId: string;                 // Customer ID
  status: SubscriptionStatus;        // Normalized 7-state model
  statusNote?: string;
  plan: {
    planCode: string;
    planName: string;
    billingInterval: BillingInterval;
    intervalCount: number;
    amountMinor: number;            // In minor units (cents)
    currency: string;
    trialPeriodDays: number;
  };
  currentPeriod: {
    start: string;                   // ISO 8601
    end: string;
  };
  // ... more fields
}
```

**7-State Subscription Model:**
- `future` - Not yet started
- `trialing` - In trial period
- `active` - Active subscription
- `delinquent` - Payment overdue with collection in flight
- `paused` - Temporarily suspended
- `pending_cancellation` - Scheduled to cancel
- `terminated` - Access ended

### CanonicalInvoice

Provider-agnostic invoice representation:

```typescript
interface CanonicalInvoice {
  invoiceId: string;
  invoiceNumber: string;
  subscriptionId: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  totalMinor: number;
  balanceMinor: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  // ... more fields
}
```

**5-State Invoice Model:**
- `draft` - Not finalized
- `posted` - Sent to customer
- `paid` - Fully paid
- `past_due` - Overdue
- `void` - Canceled/voided

### BillingEvent

Canonical event representation for webhook handling:

```typescript
interface BillingEvent {
  eventId: string;
  type: BillingEventType;
  severity: EventSeverity;
  timestamp: string;
  provider: {
    name: 'stripe' | 'chargebee' | 'zuora';
    eventId: string;
    eventType: string;              // Raw provider type
  };
  data: {
    objectType: 'subscription' | 'invoice' | 'payment_intent';
    object: CanonicalSubscription | CanonicalInvoice | ...;
  };
  tenantId?: string;
}
```

## Adapter Interface

All provider adapters implement the `BillingAdapter` interface:

```typescript
interface BillingAdapter {
  readonly providerName: 'stripe' | 'chargebee' | 'zuora';
  
  translateSubscription(
    rawSubscription: unknown,
    tenantId?: string
  ): CanonicalSubscriptionWithProvider;
  
  translateInvoice(
    rawInvoice: unknown,
    tenantId?: string
  ): CanonicalInvoiceWithProvider;
  
  translateEvent(
    rawEvent: unknown,
    tenantId?: string
  ): BillingEvent;
}
```

## Provider Adapters

### Stripe Adapter

Maps Stripe's terminology to canonical types:

- `customer.subscription.*` → `subscription.*` events
- `invoice.*` → `invoice.*` events
- Stripe status strings → Canonical status enums
- Unix timestamps → ISO 8601 strings
- Provider IDs prefixed: `sub_abc` → `stripe_sub_abc`

**Example:**

```typescript
const adapter = new StripeAdapter();

// Raw Stripe webhook payload
const stripeSubscription = {
  id: 'sub_abc123',
  customer: 'cus_xyz789',
  status: 'active',
  current_period_start: 1704067200,
  current_period_end: 1735689599,
  // ... more Stripe fields
};

// Translate to canonical
const canonical = adapter.translateSubscription(stripeSubscription, 'tenant-1');

// canonical.subscriptionId = "stripe_sub_abc123"
// canonical.status = "active"
// canonical.provider.provider = "stripe"
```

### Chargebee Adapter

Maps Chargebee's terminology:

- `subscription_created` → `subscription.created`
- `payment_succeeded` → `invoice.payment_succeeded`
- Chargebee status strings → Canonical status enums
- Unix timestamps → ISO 8601 strings
- Provider IDs prefixed: `cb_sub_123` → `chargebee_cb_sub_123`

### Zuora Adapter

Maps Zuora's terminology:

- `Subscription.Created` → `subscription.created`
- `Invoice.Posted` → `invoice.posted`
- Zuora status strings → Canonical status enums
- ISO date strings preserved
- Provider IDs prefixed: `zuora-sub-123` → `zuora_zuora-sub-123`

## Event Router

The `BillingEventsRouter` manages event subscriptions and routing:

```typescript
const router = new BillingEventsRouter({
  enableAuditLog: true,
  enableDeduplication: true,
  deduplicationWindowSeconds: 300,
});

// Subscribe to events
router.subscribe({
  id: 'invoice-payment-handler',
  eventTypes: ['invoice.payment_succeeded', 'invoice.payment_failed'],
  handler: async (event) => {
    // Handle canonical event
    const invoice = event.data.object as CanonicalInvoice;
    // ... business logic
    return { eventId: event.eventId, status: 'accepted', processedAt: new Date().toISOString() };
  },
  tenantId: 'tenant-1', // Optional tenant filter
});

// Route incoming event
const result = await router.handle(billingEvent);
```

## Event Ingestion Pipeline

`BillingEventIngestionService` wraps the router with tenancy + audit logging guarantees:

```typescript
const ingestion = new BillingEventIngestionService();

ingestion.registerSubscription({
  id: 'collections-handlers',
  eventTypes: ['invoice.payment_failed'],
  handler: async (event) => processCollections(event),
});

await ingestion.ingest('stripe', rawStripeEvent, {
  tenantId: 'tenant-zyx',
  actorId: 'svc.billing-webhooks',
});
```

- ✅ Translates provider payloads via registered adapters
- ✅ Ensures `tenantId` is attached (uses `TenancyContext` fallback)
- ✅ Publishes canonical events through `BillingEventsRouter`
- ✅ Records append-only audit entries via `AuditLogService`

Audit metadata (`provider`, `adapter`, ingestion status, request identifiers) is stored with each log entry, keeping the compliance trail intact.

### CLI Proof

Run the translation CLI to inspect canonical payloads quickly:

```bash
pnpm billing:translate --provider chargebee --resource invoice --tenant tenant-dev
```

Outputs canonical JSON to stdout (or `--output path.json`) using the ACL adapters.

## Enforcement: ESLint Rule

The `no-provider-leakage` rule blocks provider terminology outside adapter boundaries:

```typescript
// ❌ BLOCKED in core code
const stripeId = 'sub_abc123';
import { StripeCustomer } from 'stripe';
const status: StripeSubscriptionStatus = 'active';

// ✅ ALLOWED in core code
const subscriptionId = 'stripe_sub_abc123';
const subscription: CanonicalSubscription = { ... };
const status: SubscriptionStatus = 'active';
```

**Configuration:**

```javascript
{
  files: ['src/**/*.ts', 'apps/**/*.tsx'],
  ignores: [
    'src/integrations/billing/**',
    'tests/integrations/billing/**',
  ],
  rules: {
    'oods/no-provider-leakage': 'error',
  },
}
```

## Testing Strategy

### Unit Tests

Each adapter has comprehensive unit tests:

- Status mapping coverage (all provider states → canonical states)
- Field translation accuracy
- Error handling (missing required fields)
- Edge cases (null values, optional fields)

**Example:**

```typescript
describe('StripeAdapter', () => {
  it('should map Stripe statuses correctly', () => {
    const statuses = [
      ['active', 'active'],
      ['past_due', 'delinquent'],
      ['canceled', 'terminated'],
    ];
    
    statuses.forEach(([stripeStatus, canonicalStatus]) => {
      const subscription = adapter.translateSubscription({
        id: 'sub_test',
        status: stripeStatus,
        // ... minimal required fields
      });
      
      expect(subscription.status).toBe(canonicalStatus);
    });
  });
});
```

### Integration Tests

Verify end-to-end flow:

1. Webhook arrives from provider
2. Adapter translates to canonical type
3. Event router dispatches to handlers
4. Audit log records event

### Visual Proof (Storybook)

The `billing-acl.stories.tsx` demonstrates:

- All three adapters translating real provider payloads
- Canonical objects rendered in UI
- Provider metadata preserved for audit

## Adding a New Provider

To add support for a new billing provider:

1. **Create Adapter**

```typescript
// src/integrations/billing/new-provider-adapter.ts
export class NewProviderAdapter implements BillingAdapter {
  readonly providerName = 'newprovider' as const;
  
  translateSubscription(raw: unknown, tenantId?: string) {
    // Map provider fields to canonical
  }
  
  translateInvoice(raw: unknown, tenantId?: string) {
    // Map provider fields to canonical
  }
  
  translateEvent(raw: unknown, tenantId?: string) {
    // Map provider events to canonical
  }
}
```

2. **Add Tests**

```typescript
// tests/integrations/billing/new-provider.spec.ts
describe('NewProviderAdapter', () => {
  it('should translate subscription', () => {
    // Test translation logic
  });
});
```

3. **Export from Index**

```typescript
// src/integrations/billing/index.ts
export { NewProviderAdapter } from './new-provider-adapter.js';
```

4. **Update ESLint Rule** (if new provider has unique identifiers)

```javascript
// eslint/rules/no-provider-leakage.cjs
const PROVIDER_TERMS = new Set([
  // ... existing
  'newprovider',
  'NewProvider',
]);
```

5. **Add Proof Story**

```typescript
// stories/proofs/billing-acl.stories.tsx
export const NewProviderTranslation: Story = {
  render: () => {
    const adapter = new NewProviderAdapter();
    const subscription = adapter.translateSubscription(payload);
    return <BillingObjectViewer subscription={subscription} />;
  },
};
```

## Migration Guide

### From Direct Provider Integration

**Before (❌ Provider leakage):**

```typescript
import Stripe from 'stripe';

async function getSubscription(id: string) {
  const stripe = new Stripe(process.env.STRIPE_KEY);
  const subscription = await stripe.subscriptions.retrieve(id);
  
  // UI directly consumes Stripe types
  return {
    id: subscription.id,
    status: subscription.status,
    amount: subscription.items.data[0].price.unit_amount,
  };
}
```

**After (✅ Using ACL):**

```typescript
import { StripeAdapter } from '../integrations/billing/stripe-adapter.js';

async function getSubscription(id: string) {
  const stripe = new Stripe(process.env.STRIPE_KEY);
  const rawSubscription = await stripe.subscriptions.retrieve(id);
  
  // Translate via ACL
  const adapter = new StripeAdapter();
  const canonical = adapter.translateSubscription(rawSubscription, currentTenantId);
  
  // UI consumes canonical types
  return canonical;
}
```

### Switching Providers

Because the UI and business logic only depend on canonical types, switching providers requires:

1. Implement new adapter
2. Update webhook routing to use new adapter
3. **No changes to UI or domain logic**

## Best Practices

### 1. Never Return Provider Types from Adapters

```typescript
// ❌ BAD
translateSubscription(raw: unknown): StripeSubscription {
  return raw as StripeSubscription;
}

// ✅ GOOD
translateSubscription(raw: unknown): CanonicalSubscription {
  const stripe = raw as StripeSubscription;
  return {
    subscriptionId: `stripe_${stripe.id}`,
    status: this.mapStatus(stripe.status),
    // ... normalize all fields
  };
}
```

### 2. Prefix Provider IDs

Always prefix internal IDs with provider name to:
- Prevent ID collisions
- Enable quick provider identification in logs
- Support multi-provider environments

```typescript
subscriptionId: `stripe_${stripe.id}`
invoiceId: `chargebee_${cb.id}`
```

### 3. Preserve Provider Metadata

Always include provider metadata for audit trails:

```typescript
provider: {
  provider: 'stripe',
  providerResourceId: stripe.id,
  providerStatus: stripe.status,  // Raw status
  translatedAt: new Date().toISOString(),
  translationVersion: '1.0.0',
}
```

### 4. Handle Missing Fields Gracefully

```typescript
// Use helpers for required vs optional fields
const id = requireField<string>(raw, 'id', 'stripe', 'subscription');
const note = getField<string>(raw, 'description', 'No description');
```

### 5. Test Status Mappings Exhaustively

Provider statuses change over time. Ensure all known statuses are mapped:

```typescript
const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  'active': 'active',
  'past_due': 'delinquent',
  'canceled': 'terminated',
  // ... all known statuses
};

// Fallback for unknown statuses
const status = STRIPE_STATUS_MAP[raw.status] || 'active';
```

## Troubleshooting

### Provider Leakage Detected

If ESLint flags provider leakage:

1. Check if code is in allowed path
2. Replace provider types with canonical types
3. Move provider-specific logic to adapters

### Translation Errors

If adapter throws `TranslationError`:

1. Verify required fields are present in raw payload
2. Check provider payload format hasn't changed
3. Update adapter mapping logic
4. Add test case for new payload structure

### Event Duplication

If events are processed multiple times:

1. Verify `enableDeduplication` is true
2. Check `deduplicationWindowSeconds` is appropriate
3. Ensure provider webhooks are idempotent

## References

- **Mission File:** `cmos/missions/sprint-17/B17.3_billing-acl-provider-adapters.yaml`
- **Research:** `cmos/missions/research/R13.5_Canonical-Model-Subscription-and-Invoice.md`
- **Industry Analysis:** `cmos/Industry-Research/R1.2_A Cross-Platform Analysis of Core Data Models.md`
- **Code:**
  - `src/domain/billing/core.ts` - Canonical types
  - `src/domain/billing/events.ts` - Event system
  - `src/integrations/billing/` - Provider adapters
  - `tests/integrations/billing/` - Adapter tests
  - `stories/proofs/billing-acl.stories.tsx` - Visual proof

## Glossary

- **ACL (Anti-Corruption Layer):** Pattern that isolates external system models from internal domain models
- **Canonical Type:** Provider-agnostic type representing business concept
- **Provider Metadata:** Audit trail preserving original provider context
- **Translation Error:** Error during adapter conversion from provider to canonical format
- **Minor Units:** Currency representation in smallest denomination (e.g., cents for USD)
