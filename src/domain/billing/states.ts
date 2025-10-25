/**
 * Canonical Billing State Machines
 * 
 * Defines the lifecycle state machines for Subscription (7-state) and Invoice (5-state)
 * with explicit transitions, guards, and event-driven logic.
 * 
 * @module domain/billing/states
 */

/**
 * Canonical subscription states (7-state model)
 * 
 * State flow:
 * - future → trialing → active → [paused/pending_cancellation/delinquent] → terminated
 */
export type SubscriptionState =
  | 'future' // Scheduled to start in the future
  | 'trialing' // In trial period
  | 'active' // Active and current
  | 'paused' // Temporarily suspended
  | 'pending_cancellation' // Cancellation scheduled at period end
  | 'delinquent' // Past due with failed payments
  | 'terminated'; // Permanently ended

export const SUBSCRIPTION_STATES = [
  'future',
  'trialing',
  'active',
  'paused',
  'pending_cancellation',
  'delinquent',
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
  | 'payment_failed' // Payment failed (active → delinquent)
  | 'payment_succeeded' // Payment succeeded (delinquent → active)
  | 'cancel_immediately' // Immediate cancellation (any → terminated)
  | 'period_end'; // Period end (pending_cancellation → terminated)

export const SUBSCRIPTION_EVENTS = [
  'activate',
  'trial_end',
  'pause',
  'resume',
  'schedule_cancellation',
  'payment_failed',
  'payment_succeeded',
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
  
  // Active → Pending Cancellation
  {
    from: 'active',
    event: 'schedule_cancellation',
    to: 'pending_cancellation',
    description: 'Schedule cancellation at period end',
  },
  
  // Active ↔ Delinquent
  {
    from: 'active',
    event: 'payment_failed',
    to: 'delinquent',
    description: 'Payment failure triggers delinquency',
  },
  {
    from: 'delinquent',
    event: 'payment_succeeded',
    to: 'active',
    description: 'Successful payment clears delinquency',
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
    from: 'delinquent',
    event: 'cancel_immediately',
    to: 'terminated',
    description: 'Immediate cancellation of delinquent subscription',
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
 */
export function isRevenueGenerating(state: SubscriptionState): boolean {
  return state === 'active' || state === 'trialing' || state === 'delinquent';
}

/**
 * Check if subscription is in a terminal state
 */
export function isTerminalState(state: SubscriptionState): boolean {
  return state === 'terminated';
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
