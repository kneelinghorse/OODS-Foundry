/**
 * Billing State Guards and Helpers
 * 
 * Utilities for deriving subscription states, validating transitions,
 * and ensuring UI consistency with the canonical state machines.
 * 
 * @module utils/billing/state-guards
 */

import { DateTime } from 'luxon';
import type { CanonicalSubscription, CanonicalInvoice } from '../../domain/billing/core.js';
import {
  type SubscriptionState,
  type InvoiceState,
  SUBSCRIPTION_STATES,
  INVOICE_STATES,
  SubscriptionStateMachine,
  InvoiceStateMachine,
} from '../../domain/billing/states.js';

/**
 * Derive delinquency status from subscription and invoice history
 * 
 * When a provider doesn't expose delinquency status directly, we derive it:
 * - If subscription is 'active' but has past_due invoices → derive 'delinquent'
 * - Otherwise, preserve the subscription's current state
 * 
 * @param subscription Current subscription state
 * @param invoices Recent invoices for this subscription
 * @returns Corrected subscription state
 */
export function deriveDelinquency(
  subscription: CanonicalSubscription,
  invoices: CanonicalInvoice[]
): SubscriptionState {
  const currentStatus = subscription.status as SubscriptionState;

  // If already delinquent, keep it
  if (currentStatus === 'delinquent') {
    return 'delinquent';
  }

  // If not active, can't be delinquent
  if (currentStatus !== 'active') {
    return currentStatus;
  }

  // Check for past_due invoices
  const hasPastDueInvoices = invoices.some(
    (inv) => inv.status === 'past_due' && inv.balanceMinor > 0
  );

  if (hasPastDueInvoices) {
    return 'delinquent';
  }

  return currentStatus;
}

/**
 * Validate subscription state against allowed values
 * 
 * Prevents unknown vendor strings from leaking into UI components.
 * 
 * @param status Raw status from provider
 * @returns Valid SubscriptionState or throws error
 */
export function validateSubscriptionState(status: string): SubscriptionState {
  const allowedStates = SUBSCRIPTION_STATES as readonly SubscriptionState[];

  if (allowedStates.includes(status as SubscriptionState)) {
    return status as SubscriptionState;
  }

  throw new Error(
    `Invalid subscription status: '${status}'. ` +
      `Allowed values: ${allowedStates.join(', ')}`
  );
}

/**
 * Validate invoice state against allowed values
 * 
 * Prevents unknown vendor strings from leaking into UI components.
 * 
 * @param status Raw status from provider
 * @returns Valid InvoiceState or throws error
 */
export function validateInvoiceState(status: string): InvoiceState {
  const allowedStates = INVOICE_STATES as readonly InvoiceState[];

  if (allowedStates.includes(status as InvoiceState)) {
    return status as InvoiceState;
  }

  throw new Error(
    `Invalid invoice status: '${status}'. ` +
      `Allowed values: ${allowedStates.join(', ')}`
  );
}

/**
 * Get human-readable state label
 * 
 * @param state Subscription or invoice state
 * @returns Display label
 */
export function getStateLabel(state: SubscriptionState | InvoiceState): string {
  const labels: Record<SubscriptionState | InvoiceState, string> = {
    // Subscription states
    future: 'Future',
    trialing: 'Trialing',
    active: 'Active',
    paused: 'Paused',
    pending_cancellation: 'Pending Cancellation',
    delinquent: 'Delinquent',
    terminated: 'Terminated',
    // Invoice states
    draft: 'Draft',
    posted: 'Posted',
    paid: 'Paid',
    past_due: 'Past Due',
    void: 'Void',
  };

  return labels[state] ?? state;
}

/**
 * Get state severity level for UI styling
 * 
 * Maps states to Statusables intent tokens (info, success, warning, error)
 * 
 * @param state Subscription or invoice state
 * @returns Severity level
 */
export function getStateSeverity(
  state: SubscriptionState | InvoiceState
): 'info' | 'success' | 'warning' | 'error' {
  // Subscription severity mapping
  if (state === 'active' || state === 'trialing') {
    return 'success';
  }
  if (state === 'delinquent' || state === 'terminated') {
    return 'error';
  }
  if (state === 'pending_cancellation' || state === 'paused') {
    return 'warning';
  }
  if (state === 'future') {
    return 'info';
  }

  // Invoice severity mapping
  if (state === 'paid') {
    return 'success';
  }
  if (state === 'past_due') {
    return 'error';
  }
  if (state === 'void') {
    return 'warning';
  }
  if (state === 'draft' || state === 'posted') {
    return 'info';
  }

  return 'info';
}

/**
 * Check if subscription state allows modification
 * 
 * @param state Current subscription state
 * @returns true if subscription can be modified
 */
export function canModifySubscription(state: SubscriptionState): boolean {
  return state !== 'terminated';
}

/**
 * Check if invoice can be voided
 * 
 * @param state Current invoice state
 * @returns true if invoice can be voided
 */
export function canVoidInvoice(state: InvoiceState): boolean {
  return state !== 'void' && state !== 'paid';
}

/**
 * Get available actions for a subscription in a given state
 * 
 * @param state Current subscription state
 * @returns Array of available action labels
 */
export function getAvailableSubscriptionActions(state: SubscriptionState): string[] {
  const events = SubscriptionStateMachine.getValidTransitions(state);
  
  const actionLabels: Record<string, string> = {
    activate: 'Activate',
    trial_end: 'End Trial',
    pause: 'Pause',
    resume: 'Resume',
    schedule_cancellation: 'Schedule Cancellation',
    payment_failed: 'Mark Payment Failed',
    payment_succeeded: 'Mark Payment Succeeded',
    cancel_immediately: 'Cancel Immediately',
    period_end: 'Apply Period End',
  };

  return events.map((event) => actionLabels[event] ?? event);
}

/**
 * Get available actions for an invoice in a given state
 * 
 * @param state Current invoice state
 * @returns Array of available action labels
 */
export function getAvailableInvoiceActions(state: InvoiceState): string[] {
  const events = InvoiceStateMachine.getValidTransitions(state);
  
  const actionLabels: Record<string, string> = {
    finalize: 'Finalize',
    mark_paid: 'Mark Paid',
    mark_overdue: 'Mark Overdue',
    payment_received: 'Record Payment',
    void_invoice: 'Void Invoice',
  };

  return events.map((event) => actionLabels[event] ?? event);
}

/**
 * Calculate days until subscription state change
 * 
 * @param subscription Current subscription
 * @returns Days until next state change, or null if no scheduled change
 */
export function daysUntilStateChange(subscription: CanonicalSubscription): number | null {
  const now = DateTime.utc();

  // Trial ending
  if (subscription.status === 'trialing' && subscription.trialEndAt) {
    const trialEnd = DateTime.fromISO(subscription.trialEndAt).toUTC();
    const diff = Math.ceil(trialEnd.diff(now, 'days').days ?? 0);
    return Math.max(0, diff);
  }

  // Pending cancellation
  if (subscription.status === 'pending_cancellation' && subscription.cancellationEffectiveAt) {
    const cancelDate = DateTime.fromISO(subscription.cancellationEffectiveAt).toUTC();
    const diff = Math.ceil(cancelDate.diff(now, 'days').days ?? 0);
    return Math.max(0, diff);
  }

  return null;
}

/**
 * Calculate invoice aging in days
 * 
 * @param invoice Current invoice
 * @returns Days overdue, or 0 if not overdue
 */
export function calculateInvoiceAging(invoice: CanonicalInvoice): number {
  if (invoice.status !== 'past_due') {
    return 0;
  }

  const now = DateTime.utc();
  const dueDate = DateTime.fromISO(invoice.dueAt).toUTC();
  const diff = Math.floor(now.diff(dueDate, 'days').days ?? 0);
  
  return Math.max(0, diff);
}

/**
 * Get aging bucket label
 * 
 * @param agingDays Days overdue
 * @returns Aging bucket label
 */
export function getAgingBucket(agingDays: number): string {
  if (agingDays === 0) return 'Current';
  if (agingDays <= 30) return '0-30 days';
  if (agingDays <= 60) return '31-60 days';
  if (agingDays <= 90) return '61-90 days';
  return '90+ days';
}
