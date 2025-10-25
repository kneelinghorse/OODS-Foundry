# Billing Lifecycle State Machines

**Version:** 1.0.0  
**Last Updated:** 2025-10-25

## Overview

This document describes the canonical state machines for Subscription (7-state) and Invoice (5-state) lifecycles. These state machines normalize provider-specific statuses into a consistent, event-driven model that prevents vendor terminology leakage and ensures UI consistency.

## Subscription State Machine (7-state model)

### States

| State | Description | Revenue Impact | Modifiable |
|-------|-------------|----------------|------------|
| `future` | Scheduled to start in the future | ❌ No | ✅ Yes |
| `trialing` | In trial period (free access) | ✅ Yes* | ✅ Yes |
| `active` | Active and current | ✅ Yes | ✅ Yes |
| `paused` | Temporarily suspended | ❌ No | ✅ Yes |
| `pending_cancellation` | Scheduled to end at period end | ❌ No | ✅ Yes |
| `delinquent` | Past due with failed payments | ✅ Yes** | ✅ Yes |
| `terminated` | Permanently ended | ❌ No | ❌ No |

*Revenue-generating for tracking purposes, but typically no charges  
**Technically revenue-generating but with collection risk

### State Transitions

```mermaid
stateDiagram-v2
    [*] --> future
    future --> trialing: activate (with trial)
    future --> active: activate (no trial)
    trialing --> active: trial_end
    trialing --> terminated: cancel_immediately
    
    active --> paused: pause
    paused --> active: resume
    
    active --> pending_cancellation: schedule_cancellation
    active --> delinquent: payment_failed
    active --> terminated: cancel_immediately
    
    delinquent --> active: payment_succeeded
    delinquent --> terminated: cancel_immediately
    
    paused --> terminated: cancel_immediately
    pending_cancellation --> terminated: period_end
    pending_cancellation --> terminated: cancel_immediately
    
    terminated --> [*]
```

### Transition Events

| Event | Description | From States | To State |
|-------|-------------|-------------|----------|
| `activate` | Start subscription | `future` | `trialing` or `active` (guard: trial period) |
| `trial_end` | End trial period | `trialing` | `active` |
| `pause` | Pause subscription | `active` | `paused` |
| `resume` | Resume subscription | `paused` | `active` |
| `schedule_cancellation` | Schedule cancellation at period end | `active` | `pending_cancellation` |
| `payment_failed` | Payment failed | `active` | `delinquent` |
| `payment_succeeded` | Payment succeeded | `delinquent` | `active` |
| `cancel_immediately` | Immediate cancellation | Any (except `terminated`) | `terminated` |
| `period_end` | Period end | `pending_cancellation` | `terminated` |

### Guards

**Activation Guard**: Determines whether `activate` transitions to `trialing` or `active`

```typescript
function activationGuard(subscription: CanonicalSubscription): 'trialing' | 'active' {
  return subscription.plan.trialPeriodDays > 0 ? 'trialing' : 'active';
}
```

## Invoice State Machine (5-state model)

### States

| State | Description | Collectible | Editable | Can Void |
|-------|-------------|-------------|----------|----------|
| `draft` | Uncommitted invoice | ❌ No | ✅ Yes | ✅ Yes |
| `posted` | Finalized and sent | ✅ Yes | ❌ No | ✅ Yes |
| `paid` | Fully paid | ❌ No | ❌ No | ❌ No |
| `past_due` | Overdue | ✅ Yes | ❌ No | ✅ Yes |
| `void` | Cancelled/voided | ❌ No | ❌ No | ❌ No |

### State Transitions

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> posted: finalize
    draft --> void: void_invoice
    
    posted --> paid: mark_paid
    posted --> past_due: mark_overdue
    posted --> void: void_invoice
    
    past_due --> paid: payment_received
    past_due --> void: void_invoice
    
    paid --> [*]
    void --> [*]
```

### Transition Events

| Event | Description | From States | To State |
|-------|-------------|-------------|----------|
| `finalize` | Finalize and send invoice | `draft` | `posted` |
| `mark_paid` | Mark as paid | `posted` | `paid` |
| `mark_overdue` | Mark as overdue | `posted` | `past_due` |
| `payment_received` | Record payment | `past_due` | `paid` |
| `void_invoice` | Void invoice | `draft`, `posted`, `past_due` | `void` |

## Delinquency Derivation

Some providers (e.g., Chargebee, Zuora) don't expose a `delinquent` subscription status. We derive it from invoice history:

```typescript
function deriveDelinquency(
  subscription: CanonicalSubscription,
  invoices: CanonicalInvoice[]
): SubscriptionState {
  // Already delinquent → preserve
  if (subscription.status === 'delinquent') {
    return 'delinquent';
  }

  // Only active subscriptions can become delinquent
  if (subscription.status !== 'active') {
    return subscription.status;
  }

  // Check for unpaid past_due invoices
  const hasPastDueInvoices = invoices.some(
    (inv) => inv.status === 'past_due' && inv.balanceMinor > 0
  );

  return hasPastDueInvoices ? 'delinquent' : 'active';
}
```

### Derivation Rules

1. **Preserve delinquent**: If already `delinquent`, keep it
2. **Non-active immune**: Only `active` can derive to `delinquent`
3. **Require unpaid balance**: Ignore `past_due` invoices with zero balance
4. **Multi-invoice check**: Any past_due invoice triggers delinquency

## Provider Adapter Integration

All provider adapters MUST translate vendor-specific statuses to canonical states:

### Stripe Mapping

```typescript
const STRIPE_SUBSCRIPTION_MAP: Record<string, SubscriptionState> = {
  'incomplete': 'future',
  'incomplete_expired': 'terminated',
  'trialing': 'trialing',
  'active': 'active',
  'past_due': 'delinquent',
  'canceled': 'terminated',
  'unpaid': 'delinquent',
  'paused': 'paused',
};

const STRIPE_INVOICE_MAP: Record<string, InvoiceState> = {
  'draft': 'draft',
  'open': 'posted',
  'paid': 'paid',
  'uncollectible': 'past_due',
  'void': 'void',
};
```

### Chargebee Mapping

```typescript
const CHARGEBEE_SUBSCRIPTION_MAP: Record<string, SubscriptionState> = {
  'future': 'future',
  'in_trial': 'trialing',
  'active': 'active',
  'non_renewing': 'pending_cancellation',
  'paused': 'paused',
  'cancelled': 'terminated',
  // No native delinquent → derive from invoices
};

const CHARGEBEE_INVOICE_MAP: Record<string, InvoiceState> = {
  'pending': 'draft',
  'posted': 'posted',
  'payment_due': 'past_due',
  'paid': 'paid',
  'voided': 'void',
};
```

### Zuora Mapping

```typescript
const ZUORA_SUBSCRIPTION_MAP: Record<string, SubscriptionState> = {
  'Draft': 'future',
  'PendingActivation': 'future',
  'Active': 'active',
  'Suspended': 'paused',
  'Cancelled': 'terminated',
  'Expired': 'terminated',
  // No native trial/delinquent → derive from context
};

const ZUORA_INVOICE_MAP: Record<string, InvoiceState> = {
  'Draft': 'draft',
  'Posted': 'posted',
  'Cancelled': 'void',
  // Zuora has no paid status → derive from balance
};
```

## Validation and Guards

### State Validation

All UI components MUST validate states before rendering:

```typescript
import { validateSubscriptionState, validateInvoiceState } from '@/utils/billing/state-guards';

// Reject unknown vendor strings
try {
  const state = validateSubscriptionState(rawStatus);
} catch (err) {
  // Log error, fallback to safe default, or reject payload
}
```

### CI Enforcement

The ESLint rule `no-provider-leakage` prevents direct use of provider types:

```typescript
// ❌ BAD: Provider types leak into UI
import type { Stripe } from 'stripe';
function StatusBadge({ status }: { status: Stripe.Subscription.Status }) { }

// ✅ GOOD: Canonical types only
import type { SubscriptionState } from '@/domain/billing/states';
function StatusBadge({ status }: { status: SubscriptionState }) { }
```

## Token Integration

Each state maps to semantic tokens for consistent UI rendering:

### Subscription State → Statusables Map

```json
{
  "subscription.status.future": {
    "intent": "info",
    "icon": "calendar",
    "label": "Future"
  },
  "subscription.status.trialing": {
    "intent": "success",
    "icon": "experiment",
    "label": "Trialing"
  },
  "subscription.status.active": {
    "intent": "success",
    "icon": "check_circle",
    "label": "Active"
  },
  "subscription.status.paused": {
    "intent": "warning",
    "icon": "pause",
    "label": "Paused"
  },
  "subscription.status.pending_cancellation": {
    "intent": "warning",
    "icon": "event_busy",
    "label": "Pending Cancellation"
  },
  "subscription.status.delinquent": {
    "intent": "error",
    "icon": "error",
    "label": "Delinquent"
  },
  "subscription.status.terminated": {
    "intent": "error",
    "icon": "cancel",
    "label": "Terminated"
  }
}
```

### Invoice State → Statusables Map

```json
{
  "invoice.status.draft": {
    "intent": "info",
    "icon": "draft",
    "label": "Draft"
  },
  "invoice.status.posted": {
    "intent": "info",
    "icon": "send",
    "label": "Posted"
  },
  "invoice.status.paid": {
    "intent": "success",
    "icon": "check_circle",
    "label": "Paid"
  },
  "invoice.status.past_due": {
    "intent": "error",
    "icon": "error",
    "label": "Past Due"
  },
  "invoice.status.void": {
    "intent": "warning",
    "icon": "cancel",
    "label": "Void"
  }
}
```

## Storybook Documentation

Visual lifecycle documentation is available in Storybook:

- **Subscription Lifecycle**: `Domains/Billing/Subscription Lifecycle`
- **Invoice Lifecycle**: `Domains/Billing/Invoice Lifecycle`

Each story demonstrates:
- Current state badge with severity mapping
- Available actions for the state
- Valid transitions from the state
- State machine flow diagram

## Testing

Comprehensive test coverage (50 tests) validates:

- ✅ All valid state transitions
- ✅ Invalid transition rejection
- ✅ Guard logic (trial period)
- ✅ Delinquency derivation
- ✅ State validation
- ✅ Helper functions (revenue, terminal, collectible)
- ✅ Time-based calculations (aging, days until change)

Run tests:

```bash
pnpm test tests/domain/billing/states.spec.ts
```

## API Reference

### State Machines

```typescript
import {
  SubscriptionStateMachine,
  InvoiceStateMachine,
  type SubscriptionState,
  type InvoiceState,
  type SubscriptionEvent,
  type InvoiceEvent,
} from '@/domain/billing/states';

// Check if transition is valid
SubscriptionStateMachine.canTransition('active', 'pause'); // true

// Execute transition
const nextState = SubscriptionStateMachine.transition('active', 'pause'); // 'paused'

// Get valid events from current state
const events = SubscriptionStateMachine.getValidTransitions('active');
// ['pause', 'schedule_cancellation', 'payment_failed', 'cancel_immediately']
```

### State Guards

```typescript
import {
  deriveDelinquency,
  validateSubscriptionState,
  getStateLabel,
  getStateSeverity,
  getAvailableSubscriptionActions,
  daysUntilStateChange,
  calculateInvoiceAging,
} from '@/utils/billing/state-guards';

// Derive delinquency from invoices
const correctedState = deriveDelinquency(subscription, invoices);

// Validate state
const state = validateSubscriptionState(rawStatus); // throws if invalid

// Get UI metadata
const label = getStateLabel('active'); // "Active"
const severity = getStateSeverity('delinquent'); // "error"
const actions = getAvailableSubscriptionActions('active');
```

## Migration from Legacy States

### Old → New Mapping

| Legacy Status | New State | Notes |
|---------------|-----------|-------|
| `past_due` | `delinquent` | Subscription only |
| `canceled` | `terminated` | More accurate terminology |
| `cancelled` | `terminated` | UK spelling normalized |
| `unpaid` | `delinquent` | Stripe-specific |
| `non_renewing` | `pending_cancellation` | Chargebee-specific |

### Migration Script Placeholder

```typescript
// Future: Historical data migration
// See: scripts/migrations/normalize-billing-states.ts
```

## FAQ

**Q: Why "delinquent" instead of "past_due"?**  
A: `past_due` is an invoice state. Subscriptions with failed payments are `delinquent` to avoid state name collisions.

**Q: Can I skip state validation?**  
A: No. ESLint enforces validation. Unvalidated vendor strings will leak into UI and break token mappings.

**Q: What happens if a provider adds a new status?**  
A: The adapter will throw an error. Add a mapping to the adapter's translation table.

**Q: How do I handle "incomplete" subscriptions?**  
A: Map to `future` and use payment intent status separately.

**Q: Can terminated subscriptions be reactivated?**  
A: No. Create a new subscription. `terminated` is a terminal state.

## References

- [Industry Research: State Machine Maturity](../../cmos/Industry-Research/R1.2_A%20Cross-Platform%20Analysis%20of%20Core%20Data%20Models-%20Archetypes,%20Convergence,%20and%20Divergence%20in%20User,%20Account,%20and%20Subscription%20Schemas.md)
- [Direction Check: Sprint 17 Mandate](../../cmos/docs/OODS%20Direction-Check-for-sprint-17.md)
- [Research: Canonical Billing Model](../../cmos/missions/research/R13.5_Canonical-Model-Subscription-and-Invoice.md)
- [Billing ACL Documentation](./billing-acl.md)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-25 | Initial release: 7-state subscription, 5-state invoice, delinquency derivation |

