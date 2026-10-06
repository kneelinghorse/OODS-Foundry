/**
 * Canonical Billing State Machines
 *
 * Defines the lifecycle state machines for Subscription (8-state) and Invoice (5-state)
 * with explicit transitions, guards, and event-driven logic.
 *
 * @module domain/billing/states
 */

/**
 * Canonical subscription states (8-state model — Stripe-literal split)
 *
 * State flow:
 * - future → trialing → active → [paused/pending_cancellation/past_due → unpaid] → terminated
 *
 * `past_due` and `unpaid` are the Stripe-literal split of the former consolidated
 * `delinquent` state: `past_due` = payment failing but retries ongoing (recoverable,
 * keep access during the grace window); `unpaid` = retries exhausted, no further
 * attempts (access revoked). The distinction is load-bearing — the access-revocation
 * rule cannot be expressed from a status that collapses the two. `terminated` covers
 * Stripe `canceled` + `incomplete_expired`.
 */
export type SubscriptionState =
  | 'future' // Scheduled to start in the future
  | 'trialing' // In trial period
  | 'active' // Active and current
  | 'paused' // Temporarily suspended
  | 'pending_cancellation' // Cancellation scheduled at period end
  | 'past_due' // Payment failed, retries ongoing (recoverable, grace access)
  | 'unpaid' // Retries exhausted, access revoked
  | 'terminated'; // Permanently ended

export const SUBSCRIPTION_STATES = [
  'future',
  'trialing',
  'active',
  'paused',
  'pending_cancellation',
  'past_due',
  'unpaid',
  'terminated',
] as const satisfies ReadonlyArray<SubscriptionState>;

/**
 * Canonical invoice states (5-state model)
 * 
 * State flow:
 * - draft → posted → [paid/past_due] → void
 */
export type InvoiceState =
  | 'draft' // Draft/uncommitted
  | 'posted' // Finalized and sent
  | 'paid' // Fully paid
  | 'past_due' // Overdue
  | 'void'; // Cancelled/voided

export const INVOICE_STATES = [
  'draft',
  'posted',
  'paid',
  'past_due',
  'void',
] as const satisfies ReadonlyArray<InvoiceState>;

/**
 * Subscription state transition events
 */
export type SubscriptionEvent =
  | 'activate' // Start subscription (future → trialing/active)
  | 'trial_end' // End trial period (trialing → active)
  | 'pause' // Pause subscription (active → paused)
  | 'resume' // Resume subscription (paused → active)
  | 'schedule_cancellation' // Schedule cancellation (active → pending_cancellation)
  | 'unschedule_cancellation' // Reverse a scheduled cancellation (pending_cancellation → active)
  | 'payment_failed' // Payment failed (active → past_due)
  | 'payment_succeeded' // Payment succeeded (past_due → active)
  | 'retries_exhausted' // Smart retries exhausted (past_due → unpaid)
  | 'cancel_immediately' // Immediate cancellation (any → terminated)
  | 'period_end'; // Period end (pending_cancellation → terminated)

export const SUBSCRIPTION_EVENTS = [
  'activate',
  'trial_end',
  'pause',
  'resume',
  'schedule_cancellation',
  'unschedule_cancellation',
  'payment_failed',
  'payment_succeeded',
  'retries_exhausted',
  'cancel_immediately',
  'period_end',
] as const satisfies ReadonlyArray<SubscriptionEvent>;

/**
 * Invoice state transition events
 */
export type InvoiceEvent =
  | 'finalize' // Finalize draft (draft → posted)
  | 'mark_paid' // Mark as paid (posted → paid)
  | 'mark_overdue' // Mark as overdue (posted → past_due)
  | 'payment_received' // Receive payment (past_due → paid)
  | 'void_invoice'; // Void invoice (any → void)

export const INVOICE_EVENTS = [
  'finalize',
  'mark_paid',
  'mark_overdue',
  'payment_received',
  'void_invoice',
] as const satisfies ReadonlyArray<InvoiceEvent>;

/**
 * State transition definition
 */
interface StateTransition<TState, TEvent> {
  from: TState;
  event: TEvent;
  to: TState;
  guard?: (context: unknown) => boolean;
  description?: string;
}

/**
 * Subscription state machine definition
 */
export const SUBSCRIPTION_TRANSITIONS: StateTransition<SubscriptionState, SubscriptionEvent>[] = [
  // Future → Trialing/Active
  {
    from: 'future',
    event: 'activate',
    to: 'trialing',
    guard: (ctx: unknown) => {
      const sub = ctx as { trialPeriodDays?: number };
      return (sub.trialPeriodDays ?? 0) > 0;
    },
    description: 'Start trial when trial period configured',
  },
  {
    from: 'future',
    event: 'activate',
    to: 'active',
    guard: (ctx: unknown) => {
      const sub = ctx as { trialPeriodDays?: number };
      return (sub.trialPeriodDays ?? 0) === 0;
    },
    description: 'Start active when no trial period',
  },
  
  // Trialing → Active
  {
    from: 'trialing',
    event: 'trial_end',
    to: 'active',
    description: 'Trial period ends successfully',
  },
  
  // Active ↔ Paused
  {
    from: 'active',
    event: 'pause',
    to: 'paused',
    description: 'Pause active subscription',
  },
  {
    from: 'paused',
    event: 'resume',
    to: 'active',
    description: 'Resume paused subscription',
  },
  
  // Active ↔ Pending Cancellation (reversible until period end)
  {
    from: 'active',
    event: 'schedule_cancellation',
    to: 'pending_cancellation',
    description: 'Schedule cancellation at period end',
  },
  {
    from: 'pending_cancellation',
    event: 'unschedule_cancellation',
    to: 'active',
    description:
      'Reverse a scheduled cancellation before period end (set cancel_at_period_end=false). Reversible only while pending — a terminated subscription cannot be reactivated.',
  },
  
  // Active ↔ Past Due (retries ongoing, recoverable)
  {
    from: 'active',
    event: 'payment_failed',
    to: 'past_due',
    description: 'Payment failure starts the dunning/retry window',
  },
  {
    from: 'past_due',
    event: 'payment_succeeded',
    to: 'active',
    description: 'Successful retry recovers the subscription to active',
  },

  // Past Due → Unpaid (retries exhausted, access revoked)
  {
    from: 'past_due',
    event: 'retries_exhausted',
    to: 'unpaid',
    description: 'Smart retries exhausted — no further attempts, access revoked',
  },

  // Pending Cancellation → Terminated
  {
    from: 'pending_cancellation',
    event: 'period_end',
    to: 'terminated',
    description: 'Cancellation takes effect at period end',
  },
  
  // Any → Terminated
  {
    from: 'trialing',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Immediate cancellation during trial',
  },
  {
    from: 'active',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Immediate cancellation while active',
  },
  {
    from: 'paused',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Immediate cancellation while paused',
  },
  {
    from: 'pending_cancellation',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Cancel immediately instead of at period end',
  },
  {
    from: 'past_due',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Immediate cancellation of a past-due subscription',
  },
  {
    from: 'unpaid',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Immediate cancellation of an unpaid subscription',
  },
  {
    from: 'future',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Cancel future subscription before activation',
  },
];

/**
 * Invoice state machine definition
 */
export const INVOICE_TRANSITIONS: StateTransition<InvoiceState, InvoiceEvent>[] = [
  // Draft → Posted
  {
    from: 'draft',
    event: 'finalize',
    to: 'posted',
    description: 'Finalize and send invoice',
  },
  
  // Posted → Paid
  {
    from: 'posted',
    event: 'mark_paid',
    to: 'paid',
    description: 'Invoice paid in full',
  },
  
  // Posted → Past Due
  {
    from: 'posted',
    event: 'mark_overdue',
    to: 'past_due',
    description: 'Invoice becomes overdue',
  },
  
  // Past Due → Paid
  {
    from: 'past_due',
    event: 'payment_received',
    to: 'paid',
    description: 'Overdue invoice paid',
  },
  
  // Any → Void
  {
    from: 'draft',
    event: 'void_invoice',
    to: 'void',
    description: 'Void draft invoice',
  },
  {
    from: 'posted',
    event: 'void_invoice',
    to: 'void',
    description: 'Void posted invoice',
  },
  {
    from: 'past_due',
    event: 'void_invoice',
    to: 'void',
    description: 'Void overdue invoice',
  },
];

/**
 * Subscription state machine
 */
export class SubscriptionStateMachine {
  /**
   * Get valid transitions from a given state
   */
  static getValidTransitions(state: SubscriptionState): SubscriptionEvent[] {
    return SUBSCRIPTION_TRANSITIONS
      .filter((t) => t.from === state)
      .map((t) => t.event);
  }

  /**
   * Check if a transition is valid
   */
  static canTransition(
    state: SubscriptionState,
    event: SubscriptionEvent,
    context?: unknown
  ): boolean {
    const transitions = SUBSCRIPTION_TRANSITIONS.filter(
      (t) => t.from === state && t.event === event
    );

    if (transitions.length === 0) {
      return false;
    }

    // Check guards
    return transitions.some((t) => !t.guard || t.guard(context));
  }

  /**
   * Execute state transition
   */
  static transition(
    state: SubscriptionState,
    event: SubscriptionEvent,
    context?: unknown
  ): SubscriptionState {
    const validTransitions = SUBSCRIPTION_TRANSITIONS.filter(
      (t) => t.from === state && t.event === event
    );

    if (validTransitions.length === 0) {
      throw new Error(
        `Invalid transition: cannot apply event '${event}' to state '${state}'`
      );
    }

    // Find first transition that passes guard
    const transition = validTransitions.find((t) => !t.guard || t.guard(context));

    if (!transition) {
      throw new Error(
        `Transition guard failed: event '${event}' from state '${state}' rejected by guard`
      );
    }

    return transition.to;
  }

  /**
   * Get transition description
   */
  static getTransitionDescription(
    state: SubscriptionState,
    event: SubscriptionEvent
  ): string | undefined {
    const transition = SUBSCRIPTION_TRANSITIONS.find(
      (t) => t.from === state && t.event === event
    );
    return transition?.description;
  }
}

/**
 * Invoice state machine
 */
export class InvoiceStateMachine {
  /**
   * Get valid transitions from a given state
   */
  static getValidTransitions(state: InvoiceState): InvoiceEvent[] {
    return INVOICE_TRANSITIONS
      .filter((t) => t.from === state)
      .map((t) => t.event);
  }

  /**
   * Check if a transition is valid
   */
  static canTransition(
    state: InvoiceState,
    event: InvoiceEvent,
    context?: unknown
  ): boolean {
    const transitions = INVOICE_TRANSITIONS.filter(
      (t) => t.from === state && t.event === event
    );

    if (transitions.length === 0) {
      return false;
    }

    // Check guards
    return transitions.some((t) => !t.guard || t.guard(context));
  }

  /**
   * Execute state transition
   */
  static transition(
    state: InvoiceState,
    event: InvoiceEvent,
    context?: unknown
  ): InvoiceState {
    const validTransitions = INVOICE_TRANSITIONS.filter(
      (t) => t.from === state && t.event === event
    );

    if (validTransitions.length === 0) {
      throw new Error(
        `Invalid transition: cannot apply event '${event}' to state '${state}'`
      );
    }

    // Find first transition that passes guard
    const transition = validTransitions.find((t) => !t.guard || t.guard(context));

    if (!transition) {
      throw new Error(
        `Transition guard failed: event '${event}' from state '${state}' rejected by guard`
      );
    }

    return transition.to;
  }

  /**
   * Get transition description
   */
  static getTransitionDescription(
    state: InvoiceState,
    event: InvoiceEvent
  ): string | undefined {
    const transition = INVOICE_TRANSITIONS.find(
      (t) => t.from === state && t.event === event
    );
    return transition?.description;
  }
}

/**
 * Check if subscription is in a revenue-generating state
 *
 * `past_due` (retries ongoing) remains revenue-generating with collection risk;
 * `unpaid` (retries exhausted → access revoked) is NOT revenue-generating.
 *
 * MIGRATION (MRR/ARR SEMANTIC FLIP, s126-m02): the former consolidated `delinquent`
 * was entirely revenue-generating. Splitting it into past_due + unpaid moves the
 * "retries exhausted / access revoked" portion OUT of the revenue-generating set.
 * Any MRR/ARR dashboard consuming isRevenueGenerating will see subscriptions that
 * reach `unpaid` drop out of recognized revenue — this is intentional and matches
 * Stripe's access-revocation guidance (docs.stripe.com/billing/revenue-recovery/smart-retries).
 */
export function isRevenueGenerating(state: SubscriptionState): boolean {
  return state === 'active' || state === 'trialing' || state === 'past_due';
}

/**
 * Check if subscription is in a terminal state
 */
export function isTerminalState(state: SubscriptionState): boolean {
  return state === 'terminated';
}

/**
 * Status-driven service-access decision (dunning lifecycle).
 *
 * Encodes Stripe's smart-retries access guidance: keep service access while payment
 * retries are still ongoing (`past_due` = GRACE window), and REVOKE access once retries
 * are exhausted (`unpaid`). This rule is the reason the consolidated `delinquent` had to
 * be split into past_due + unpaid (s126-m01): a status that collapses the two cannot
 * express it.
 *
 * - active / trialing: full access
 * - pending_cancellation: still within the paid period → keep access until period end
 * - past_due: GRACE — retries ongoing, keep access
 * - unpaid: REVOKE — retries exhausted (Stripe explicit guidance)
 * - paused: suspended → no access
 * - future: not yet started → no access
 * - terminated: ended → no access
 *
 * Source: docs.stripe.com/billing/revenue-recovery/smart-retries.
 */
export function hasServiceAccess(state: SubscriptionState): boolean {
  switch (state) {
    case 'active':
    case 'trialing':
    case 'pending_cancellation':
    case 'past_due':
      return true;
    case 'unpaid':
    case 'paused':
    case 'future':
    case 'terminated':
      return false;
  }
}

/**
 * Check if invoice is collectible
 */
export function isCollectible(state: InvoiceState): boolean {
  return state === 'posted' || state === 'past_due';
}

/**
 * Check if invoice is finalized
 */
export function isFinalized(state: InvoiceState): boolean {
  return state !== 'draft';
}
