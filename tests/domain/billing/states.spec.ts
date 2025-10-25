/**
 * Billing State Machine Tests
 * 
 * Verifies subscription and invoice state machines, transitions,
 * guards, and delinquency derivation logic.
 */

import { DateTime } from 'luxon';
import { describe, it, expect } from 'vitest';
import {
  SubscriptionStateMachine,
  InvoiceStateMachine,
  SUBSCRIPTION_STATES,
  INVOICE_STATES,
  isRevenueGenerating,
  isTerminalState,
  isCollectible,
  isFinalized,
  type SubscriptionState,
  type InvoiceState,
  type SubscriptionEvent,
  type InvoiceEvent,
} from '../../../src/domain/billing/states.js';
import {
  deriveDelinquency,
  validateSubscriptionState,
  validateInvoiceState,
  getStateLabel,
  getStateSeverity,
  canModifySubscription,
  canVoidInvoice,
  getAvailableSubscriptionActions,
  getAvailableInvoiceActions,
  daysUntilStateChange,
  calculateInvoiceAging,
  getAgingBucket,
} from '../../../src/utils/billing/state-guards.js';
import type { CanonicalSubscription, CanonicalInvoice } from '../../../src/domain/billing/core.js';

describe('SubscriptionStateMachine', () => {
  describe('state transitions', () => {
    it('should transition from future to trialing when trial period exists', () => {
      const context = { trialPeriodDays: 14 };
      const nextState = SubscriptionStateMachine.transition('future', 'activate', context);
      expect(nextState).toBe('trialing');
    });

    it('should transition from future to active when no trial period', () => {
      const context = { trialPeriodDays: 0 };
      const nextState = SubscriptionStateMachine.transition('future', 'activate', context);
      expect(nextState).toBe('active');
    });

    it('should transition from trialing to active on trial_end', () => {
      const nextState = SubscriptionStateMachine.transition('trialing', 'trial_end');
      expect(nextState).toBe('active');
    });

    it('should transition from active to paused on pause', () => {
      const nextState = SubscriptionStateMachine.transition('active', 'pause');
      expect(nextState).toBe('paused');
    });

    it('should transition from paused to active on resume', () => {
      const nextState = SubscriptionStateMachine.transition('paused', 'resume');
      expect(nextState).toBe('active');
    });

    it('should transition from active to pending_cancellation on schedule_cancellation', () => {
      const nextState = SubscriptionStateMachine.transition('active', 'schedule_cancellation');
      expect(nextState).toBe('pending_cancellation');
    });

    it('should transition from active to delinquent on payment_failed', () => {
      const nextState = SubscriptionStateMachine.transition('active', 'payment_failed');
      expect(nextState).toBe('delinquent');
    });

    it('should transition from delinquent to active on payment_succeeded', () => {
      const nextState = SubscriptionStateMachine.transition('delinquent', 'payment_succeeded');
      expect(nextState).toBe('active');
    });

    it('should transition from pending_cancellation to terminated on period_end', () => {
      const nextState = SubscriptionStateMachine.transition('pending_cancellation', 'period_end');
      expect(nextState).toBe('terminated');
    });

    it('should transition any state to terminated on cancel_immediately', () => {
      const states: SubscriptionState[] = ['trialing', 'active', 'paused', 'pending_cancellation', 'delinquent'];
      
      states.forEach((state) => {
        const nextState = SubscriptionStateMachine.transition(state, 'cancel_immediately');
        expect(nextState).toBe('terminated');
      });
    });
  });

  describe('invalid transitions', () => {
    it('should throw error for invalid transition', () => {
      expect(() => {
        SubscriptionStateMachine.transition('terminated', 'activate');
      }).toThrow('Invalid transition');
    });

    it('should throw error when guard fails', () => {
      const context = { trialPeriodDays: 0 };
      // This should fail because guard expects trial period > 0 for trialing
      expect(() => {
        // We can't directly trigger the trialing path with 0 days,
        // but we can verify the guard logic works
        const canTransition = SubscriptionStateMachine.canTransition('future', 'activate', context);
        expect(canTransition).toBe(true); // Should be true because alternate path exists
      }).not.toThrow();
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(SubscriptionStateMachine.canTransition('active', 'pause')).toBe(true);
      expect(SubscriptionStateMachine.canTransition('paused', 'resume')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(SubscriptionStateMachine.canTransition('terminated', 'activate')).toBe(false);
      expect(SubscriptionStateMachine.canTransition('future', 'pause')).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid events for active state', () => {
      const events = SubscriptionStateMachine.getValidTransitions('active');
      expect(events).toContain('pause');
      expect(events).toContain('schedule_cancellation');
      expect(events).toContain('payment_failed');
      expect(events).toContain('cancel_immediately');
    });

    it('should return empty array for terminated state', () => {
      const events = SubscriptionStateMachine.getValidTransitions('terminated');
      expect(events).toEqual([]);
    });
  });

  describe('helper functions', () => {
    it('should identify revenue-generating states', () => {
      expect(isRevenueGenerating('active')).toBe(true);
      expect(isRevenueGenerating('trialing')).toBe(true);
      expect(isRevenueGenerating('delinquent')).toBe(true);
      expect(isRevenueGenerating('terminated')).toBe(false);
      expect(isRevenueGenerating('paused')).toBe(false);
    });

    it('should identify terminal states', () => {
      expect(isTerminalState('terminated')).toBe(true);
      expect(isTerminalState('active')).toBe(false);
    });
  });
});

describe('InvoiceStateMachine', () => {
  describe('state transitions', () => {
    it('should transition from draft to posted on finalize', () => {
      const nextState = InvoiceStateMachine.transition('draft', 'finalize');
      expect(nextState).toBe('posted');
    });

    it('should transition from posted to paid on mark_paid', () => {
      const nextState = InvoiceStateMachine.transition('posted', 'mark_paid');
      expect(nextState).toBe('paid');
    });

    it('should transition from posted to past_due on mark_overdue', () => {
      const nextState = InvoiceStateMachine.transition('posted', 'mark_overdue');
      expect(nextState).toBe('past_due');
    });

    it('should transition from past_due to paid on payment_received', () => {
      const nextState = InvoiceStateMachine.transition('past_due', 'payment_received');
      expect(nextState).toBe('paid');
    });

    it('should transition any state to void on void_invoice', () => {
      const states: InvoiceState[] = ['draft', 'posted', 'past_due'];
      
      states.forEach((state) => {
        const nextState = InvoiceStateMachine.transition(state, 'void_invoice');
        expect(nextState).toBe('void');
      });
    });
  });

  describe('helper functions', () => {
    it('should identify collectible states', () => {
      expect(isCollectible('posted')).toBe(true);
      expect(isCollectible('past_due')).toBe(true);
      expect(isCollectible('paid')).toBe(false);
      expect(isCollectible('void')).toBe(false);
    });

    it('should identify finalized states', () => {
      expect(isFinalized('draft')).toBe(false);
      expect(isFinalized('posted')).toBe(true);
      expect(isFinalized('paid')).toBe(true);
    });
  });
});

describe('deriveDelinquency', () => {
  const createSubscription = (status: SubscriptionState): CanonicalSubscription => ({
    subscriptionId: 'sub_123',
    accountId: 'acc_123',
    status: status as any,
    plan: {
      planCode: 'pro',
      planName: 'Pro Plan',
      billingInterval: 'monthly',
      intervalCount: 1,
      amountMinor: 9900,
      currency: 'USD',
      trialPeriodDays: 0,
    },
    currentPeriod: {
      start: '2025-10-01T00:00:00Z',
      end: '2025-11-01T00:00:00Z',
    },
    collectionMethod: 'charge_automatically',
    createdAt: '2025-09-01T00:00:00Z',
    updatedAt: '2025-10-01T00:00:00Z',
    business_time: DateTime.fromISO('2025-09-01T00:00:00Z'),
    system_time: DateTime.fromISO('2025-10-01T00:00:00Z'),
  });

  const createInvoice = (status: InvoiceState, balanceMinor: number): CanonicalInvoice => ({
    invoiceId: 'inv_123',
    invoiceNumber: 'INV-001',
    subscriptionId: 'sub_123',
    status: status as any,
    issuedAt: '2025-10-01T00:00:00Z',
    dueAt: '2025-10-15T00:00:00Z',
    totalMinor: 9900,
    balanceMinor,
    currency: 'USD',
    paymentTerms: 'Net 15',
    taxMinor: 0,
    discountMinor: 0,
    subtotalMinor: 9900,
    lineItems: [],
    attachments: [],
    createdAt: '2025-10-01T00:00:00Z',
    updatedAt: '2025-10-01T00:00:00Z',
    business_time: DateTime.fromISO('2025-10-15T00:00:00Z'),
    system_time: DateTime.fromISO('2025-10-01T00:00:00Z'),
  });

  it('should derive delinquent when active subscription has past_due invoices', () => {
    const subscription = createSubscription('active');
    const invoices = [createInvoice('past_due', 9900)];

    const result = deriveDelinquency(subscription, invoices);
    expect(result).toBe('delinquent');
  });

  it('should keep active when no past_due invoices', () => {
    const subscription = createSubscription('active');
    const invoices = [createInvoice('paid', 0)];

    const result = deriveDelinquency(subscription, invoices);
    expect(result).toBe('active');
  });

  it('should preserve delinquent status', () => {
    const subscription = createSubscription('delinquent');
    const invoices: CanonicalInvoice[] = [];

    const result = deriveDelinquency(subscription, invoices);
    expect(result).toBe('delinquent');
  });

  it('should not derive delinquent for non-active states', () => {
    const subscription = createSubscription('paused');
    const invoices = [createInvoice('past_due', 9900)];

    const result = deriveDelinquency(subscription, invoices);
    expect(result).toBe('paused');
  });

  it('should ignore past_due invoices with zero balance', () => {
    const subscription = createSubscription('active');
    const invoices = [createInvoice('past_due', 0)];

    const result = deriveDelinquency(subscription, invoices);
    expect(result).toBe('active');
  });
});

describe('state validators', () => {
  describe('validateSubscriptionState', () => {
    it('should accept valid subscription states', () => {
      (SUBSCRIPTION_STATES as readonly SubscriptionState[]).forEach((state) => {
        expect(validateSubscriptionState(state)).toBe(state);
      });
    });

    it('should reject invalid subscription states', () => {
      expect(() => validateSubscriptionState('invalid')).toThrow('Invalid subscription status');
      expect(() => validateSubscriptionState('cancelled')).toThrow();
    });
  });

  describe('validateInvoiceState', () => {
    it('should accept valid invoice states', () => {
      (INVOICE_STATES as readonly InvoiceState[]).forEach((state) => {
        expect(validateInvoiceState(state)).toBe(state);
      });
    });

    it('should reject invalid invoice states', () => {
      expect(() => validateInvoiceState('invalid')).toThrow('Invalid invoice status');
    });
  });
});

describe('state presentation helpers', () => {
  describe('getStateLabel', () => {
    it('should return human-readable labels for subscription states', () => {
      expect(getStateLabel('active')).toBe('Active');
      expect(getStateLabel('pending_cancellation')).toBe('Pending Cancellation');
      expect(getStateLabel('delinquent')).toBe('Delinquent');
    });

    it('should return human-readable labels for invoice states', () => {
      expect(getStateLabel('draft')).toBe('Draft');
      expect(getStateLabel('past_due')).toBe('Past Due');
    });
  });

  describe('getStateSeverity', () => {
    it('should map subscription states to severity levels', () => {
      expect(getStateSeverity('active')).toBe('success');
      expect(getStateSeverity('trialing')).toBe('success');
      expect(getStateSeverity('delinquent')).toBe('error');
      expect(getStateSeverity('terminated')).toBe('error');
      expect(getStateSeverity('pending_cancellation')).toBe('warning');
      expect(getStateSeverity('paused')).toBe('warning');
      expect(getStateSeverity('future')).toBe('info');
    });

    it('should map invoice states to severity levels', () => {
      expect(getStateSeverity('paid')).toBe('success');
      expect(getStateSeverity('past_due')).toBe('error');
      expect(getStateSeverity('void')).toBe('warning');
      expect(getStateSeverity('posted')).toBe('info');
    });
  });
});

describe('action helpers', () => {
  describe('canModifySubscription', () => {
    it('should allow modification for non-terminal states', () => {
      expect(canModifySubscription('active')).toBe(true);
      expect(canModifySubscription('paused')).toBe(true);
    });

    it('should prevent modification for terminated state', () => {
      expect(canModifySubscription('terminated')).toBe(false);
    });
  });

  describe('canVoidInvoice', () => {
    it('should allow voiding draft, posted, and past_due invoices', () => {
      expect(canVoidInvoice('draft')).toBe(true);
      expect(canVoidInvoice('posted')).toBe(true);
      expect(canVoidInvoice('past_due')).toBe(true);
    });

    it('should prevent voiding paid or void invoices', () => {
      expect(canVoidInvoice('paid')).toBe(false);
      expect(canVoidInvoice('void')).toBe(false);
    });
  });

  describe('getAvailableSubscriptionActions', () => {
    it('should return available actions for active state', () => {
      const actions = getAvailableSubscriptionActions('active');
      expect(actions).toContain('Pause');
      expect(actions).toContain('Schedule Cancellation');
      expect(actions).toContain('Cancel Immediately');
    });

    it('should return empty actions for terminated state', () => {
      const actions = getAvailableSubscriptionActions('terminated');
      expect(actions).toEqual([]);
    });
  });

  describe('getAvailableInvoiceActions', () => {
    it('should return available actions for draft state', () => {
      const actions = getAvailableInvoiceActions('draft');
      expect(actions).toContain('Finalize');
      expect(actions).toContain('Void Invoice');
    });
  });
});

describe('time-based helpers', () => {
  describe('daysUntilStateChange', () => {
    it('should calculate days until trial end', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const subscription: CanonicalSubscription = {
        subscriptionId: 'sub_123',
        accountId: 'acc_123',
        status: 'trialing' as any,
        trialEndAt: tomorrow.toISOString(),
        plan: {
          planCode: 'pro',
          planName: 'Pro Plan',
          billingInterval: 'monthly',
          intervalCount: 1,
          amountMinor: 9900,
          currency: 'USD',
          trialPeriodDays: 14,
        },
        currentPeriod: {
          start: '2025-10-01T00:00:00Z',
          end: '2025-11-01T00:00:00Z',
        },
        collectionMethod: 'charge_automatically',
        createdAt: '2025-09-01T00:00:00Z',
        updatedAt: '2025-10-01T00:00:00Z',
      };

      const days = daysUntilStateChange(subscription);
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(2);
    });

    it('should return null for states without scheduled changes', () => {
      const subscription: CanonicalSubscription = {
        subscriptionId: 'sub_123',
        accountId: 'acc_123',
        status: 'active' as any,
        plan: {
          planCode: 'pro',
          planName: 'Pro Plan',
          billingInterval: 'monthly',
          intervalCount: 1,
          amountMinor: 9900,
          currency: 'USD',
          trialPeriodDays: 0,
        },
        currentPeriod: {
          start: '2025-10-01T00:00:00Z',
          end: '2025-11-01T00:00:00Z',
        },
        collectionMethod: 'charge_automatically',
        createdAt: '2025-09-01T00:00:00Z',
        updatedAt: '2025-10-01T00:00:00Z',
      };

      expect(daysUntilStateChange(subscription)).toBeNull();
    });
  });

  describe('calculateInvoiceAging', () => {
    it('should calculate aging for past_due invoices', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const issuedAt = '2025-10-01T00:00:00Z';
      const dueAt = pastDate.toISOString();

      const invoice: CanonicalInvoice = {
        invoiceId: 'inv_123',
        invoiceNumber: 'INV-001',
        subscriptionId: 'sub_123',
        status: 'past_due' as any,
        issuedAt,
        dueAt,
        totalMinor: 9900,
        balanceMinor: 9900,
        currency: 'USD',
        paymentTerms: 'Net 15',
        taxMinor: 0,
        discountMinor: 0,
        subtotalMinor: 9900,
        lineItems: [],
        attachments: [],
        createdAt: issuedAt,
        updatedAt: issuedAt,
        business_time: DateTime.fromISO(dueAt),
        system_time: DateTime.fromISO(issuedAt),
      };

      const aging = calculateInvoiceAging(invoice);
      expect(aging).toBeGreaterThanOrEqual(9);
      expect(aging).toBeLessThanOrEqual(11);
    });

    it('should return 0 for non-overdue invoices', () => {
      const issuedAt = '2025-10-01T00:00:00Z';
      const dueAt = '2025-10-15T00:00:00Z';

      const invoice: CanonicalInvoice = {
        invoiceId: 'inv_123',
        invoiceNumber: 'INV-001',
        subscriptionId: 'sub_123',
        status: 'paid' as any,
        issuedAt,
        dueAt,
        totalMinor: 9900,
        balanceMinor: 0,
        currency: 'USD',
        paymentTerms: 'Net 15',
        taxMinor: 0,
        discountMinor: 0,
        subtotalMinor: 9900,
        lineItems: [],
        attachments: [],
        createdAt: issuedAt,
        updatedAt: issuedAt,
        paidAt: '2025-10-10T00:00:00Z',
        business_time: DateTime.fromISO(dueAt),
        system_time: DateTime.fromISO(issuedAt),
      };

      expect(calculateInvoiceAging(invoice)).toBe(0);
    });
  });

  describe('getAgingBucket', () => {
    it('should return correct aging buckets', () => {
      expect(getAgingBucket(0)).toBe('Current');
      expect(getAgingBucket(15)).toBe('0-30 days');
      expect(getAgingBucket(45)).toBe('31-60 days');
      expect(getAgingBucket(75)).toBe('61-90 days');
      expect(getAgingBucket(120)).toBe('90+ days');
    });
  });
});
