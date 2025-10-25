/**
 * Billing Events Domain Types
 * 
 * Canonical event types for billing system integration.
 * Events from providers are translated into these canonical types.
 * 
 * @module domain/billing/events
 */

import { DateTime } from 'luxon';
import type {
  CanonicalSubscription,
  CanonicalInvoice,
  CanonicalPaymentIntent,
} from './core.js';
import type { ProviderName } from '../../integrations/billing/adapter.js';

/**
 * Billing event types
 */
export type BillingEventType =
  // Subscription events
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.trial_ending'
  | 'subscription.trial_ended'
  | 'subscription.activated'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.canceled'
  | 'subscription.deleted'
  // Invoice events
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.posted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'invoice.payment_action_required'
  | 'invoice.voided'
  | 'invoice.retry_scheduled'
  // Payment intent events
  | 'payment_intent.created'
  | 'payment_intent.processing'
  | 'payment_intent.succeeded'
  | 'payment_intent.failed'
  | 'payment_intent.canceled';

/**
 * Event severity level
 */
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Canonical billing event
 */
export interface BillingEvent {
  /** Event ID */
  eventId: string;
  
  /** Event type */
  type: BillingEventType;
  
  /** Event severity */
  severity: EventSeverity;
  
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  
  /** Provider information */
  provider: {
    /** Provider name */
    name: ProviderName | 'manual';
    
    /** Provider event ID */
    eventId: string;
    
    /** Provider event type (raw) */
    eventType: string;
    
    /** API version */
    apiVersion?: string;
  };
  
  /** Event data */
  data: {
    /** Object type */
    objectType: 'subscription' | 'invoice' | 'payment_intent';
    
    /** Current object state */
    object: CanonicalSubscription | CanonicalInvoice | CanonicalPaymentIntent;
    
    /** Previous object state (for updates) */
    previousObject?: CanonicalSubscription | CanonicalInvoice | CanonicalPaymentIntent;
  };
  
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Request ID for correlation */
  requestId?: string;
  
  /** Idempotency key */
  idempotencyKey?: string;
  
  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event ingestion result
 */
export interface EventIngestionResult {
  /** Event ID */
  eventId: string;
  
  /** Processing status */
  status: 'accepted' | 'duplicate' | 'rejected' | 'failed';
  
  /** Processing timestamp (ISO 8601) */
  processedAt: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Audit log ID */
  auditLogId?: string;
  
  /** Actions taken */
  actions?: string[];
}

/**
 * Event handler function type
 */
export type EventHandler = (event: BillingEvent) => Promise<EventIngestionResult>;

/**
 * Event router configuration
 */
export interface EventRouterConfig {
  /** Enable audit logging */
  enableAuditLog: boolean;
  
  /** Enable duplicate detection */
  enableDeduplication: boolean;
  
  /** Deduplication window (seconds) */
  deduplicationWindowSeconds: number;
  
  /** Maximum retry attempts */
  maxRetries: number;
  
  /** Retry backoff multiplier */
  retryBackoffMultiplier: number;
}

/**
 * Default event router configuration
 */
export const DEFAULT_EVENT_ROUTER_CONFIG: EventRouterConfig = {
  enableAuditLog: true,
  enableDeduplication: true,
  deduplicationWindowSeconds: 300, // 5 minutes
  maxRetries: 3,
  retryBackoffMultiplier: 2,
};

/**
 * Event filter function type
 */
export type EventFilter = (event: BillingEvent) => boolean;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  
  /** Event types to subscribe to */
  eventTypes: BillingEventType[];
  
  /** Event handler */
  handler: EventHandler;
  
  /** Optional filter */
  filter?: EventFilter;
  
  /** Tenant ID (if tenant-specific) */
  tenantId?: string;
}

/**
 * Billing events router
 * 
 * Routes provider events through the ACL to canonical event handlers.
 */
export class BillingEventsRouter {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private processedEventIds: Set<string> = new Set();
  private config: EventRouterConfig;

  constructor(config: Partial<EventRouterConfig> = {}) {
    this.config = { ...DEFAULT_EVENT_ROUTER_CONFIG, ...config };
  }

  /**
   * Subscribe to billing events
   */
  subscribe(subscription: EventSubscription): void {
    this.subscriptions.set(subscription.id, subscription);
  }

  /**
   * Unsubscribe from billing events
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Handle incoming billing event
   */
  async handle(event: BillingEvent): Promise<EventIngestionResult> {
    // Check for duplicates
    if (this.config.enableDeduplication && this.isDuplicate(event)) {
      return {
        eventId: event.eventId,
        status: 'duplicate',
        processedAt: toIsoString(DateTime.utc()),
      };
    }

    // Mark as processed
    this.markProcessed(event);

    // Find matching subscriptions
    const matchingSubscriptions = this.findMatchingSubscriptions(event);

    if (matchingSubscriptions.length === 0) {
      return {
        eventId: event.eventId,
        status: 'accepted',
        processedAt: toIsoString(DateTime.utc()),
        actions: ['no_handlers'],
      };
    }

    // Execute handlers
    const results = await Promise.allSettled(
      matchingSubscriptions.map((sub) => sub.handler(event))
    );

    // Aggregate results
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      eventId: event.eventId,
      status: failed === 0 ? 'accepted' : 'failed',
      processedAt: toIsoString(DateTime.utc()),
      actions: [
        `handlers_executed:${successful}`,
        failed > 0 ? `handlers_failed:${failed}` : undefined,
      ].filter(Boolean) as string[],
    };
  }

  /**
   * Check if event is a duplicate
   */
  private isDuplicate(event: BillingEvent): boolean {
    return this.processedEventIds.has(event.eventId);
  }

  /**
   * Mark event as processed
   */
  private markProcessed(event: BillingEvent): void {
    this.processedEventIds.add(event.eventId);
    
    // Clean up old entries after deduplication window
    setTimeout(() => {
      this.processedEventIds.delete(event.eventId);
    }, this.config.deduplicationWindowSeconds * 1000);
  }

  /**
   * Find subscriptions matching the event
   */
  private findMatchingSubscriptions(event: BillingEvent): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Check event type
      if (!subscription.eventTypes.includes(event.type)) {
        continue;
      }

      // Check tenant filter
      if (subscription.tenantId && subscription.tenantId !== event.tenantId) {
        continue;
      }

      // Check custom filter
      if (subscription.filter && !subscription.filter(event)) {
        continue;
      }

      matching.push(subscription);
    }

    return matching;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.processedEventIds.clear();
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

/**
 * Create a billing event
 */
export function createBillingEvent(
  type: BillingEventType,
  data: BillingEvent['data'],
  provider: BillingEvent['provider'],
  options: {
    tenantId?: string;
    requestId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  } = {}
): BillingEvent {
  const severity = getEventSeverity(type);
  
  const timestamp = DateTime.utc();
  return {
    eventId: crypto.randomUUID(),
    type,
    severity,
    timestamp: toIsoString(timestamp),
    provider,
    data,
    ...options,
  };
}

/**
 * Determine event severity based on type
 */
function getEventSeverity(type: BillingEventType): EventSeverity {
  if (type.includes('failed') || type.includes('voided')) {
    return 'error';
  }
  if (type.includes('canceled') || type.includes('deleted')) {
    return 'warning';
  }
  if (type.includes('succeeded') || type.includes('payment_action_required')) {
    return 'info';
  }
  return 'info';
}

function toIsoString(dt: DateTime): string {
  return dt.toISO({ suppressMilliseconds: false }) ?? dt.toFormat("yyyy-LL-dd'T'HH:mm:ss.SSSZZ");
}
