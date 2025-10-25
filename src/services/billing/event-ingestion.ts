/**
 * Billing Event Ingestion Service
 *
 * Routes provider webhooks through the Billing ACL adapters, publishes
 * canonical events via the BillingEventsRouter, and records audit entries
 * with tenancy metadata.
 *
 * @module services/billing/event-ingestion
 */

import type { AuditLogEntry } from '../../domain/compliance/audit.js';
import type {
  BillingEvent,
  EventIngestionResult,
  EventSubscription,
} from '../../domain/billing/events.js';
import { BillingEventsRouter } from '../../domain/billing/events.js';
import {
  type BillingAdapter,
  type ProviderName,
} from '../../integrations/billing/adapter.js';
import {
  ChargebeeAdapter,
  StripeAdapter,
  ZuoraAdapter,
} from '../../integrations/billing/index.js';
import { AuditLogService } from '../compliance/audit-service.js';
import { TenancyContext } from '../tenancy/tenancy-context.js';

/**
 * Default actor identifier used when none is provided.
 */
const DEFAULT_ACTOR_ID = 'system.billing-acl';

/**
 * Default audit action identifier.
 */
const AUDIT_ACTION = 'billing.event.ingested';

/**
 * Additional metadata captured alongside audit entries.
 */
export interface BillingEventAuditMetadata {
  provider?: ProviderName;
  adapter?: string;
  ingestionStatus?: EventIngestionResult['status'];
  [key: string]: unknown;
}

/**
 * Context supplied when ingesting provider events.
 */
export interface BillingEventIngestionContext {
  tenantId?: string;
  actorId?: string;
  actorType?: 'user' | 'agent' | 'system';
  metadata?: BillingEventAuditMetadata;
  tenantTimezone?: string;
}

/**
 * Result returned after ingesting a provider event.
 */
export interface BillingEventIngestionResult {
  event: BillingEvent;
  ingestion: EventIngestionResult;
  auditEntry: AuditLogEntry;
}

/**
 * Billing Event Ingestion Service
 *
 * - Translates provider payloads via ACL adapters
 * - Publishes canonical events through the BillingEventsRouter
 * - Records append-only audit entries with tenancy metadata
 */
export class BillingEventIngestionService {
  private readonly adapters: Map<ProviderName, BillingAdapter>;
  private readonly router: BillingEventsRouter;
  private readonly audit: AuditLogService;

  constructor(options: {
    adapters?: Partial<Record<ProviderName, BillingAdapter>>;
    router?: BillingEventsRouter;
    auditService?: AuditLogService;
  } = {}) {
    const adapterRegistry = new Map<ProviderName, BillingAdapter>();

    if (options.adapters) {
      for (const adapter of Object.values(options.adapters)) {
        if (adapter) {
          adapterRegistry.set(adapter.providerName, adapter);
        }
      }
    }

    const ensureAdapter = (createAdapter: () => BillingAdapter) => {
      const adapter = createAdapter();
      if (!adapterRegistry.has(adapter.providerName)) {
        adapterRegistry.set(adapter.providerName, adapter);
      }
    };

    ensureAdapter(() => new StripeAdapter());
    ensureAdapter(() => new ChargebeeAdapter());
    ensureAdapter(() => new ZuoraAdapter());

    this.adapters = adapterRegistry;

    this.router = options.router ?? new BillingEventsRouter();
    this.audit = options.auditService ?? new AuditLogService();
  }

  /**
   * Register an additional billing adapter.
   */
  registerAdapter(adapter: BillingAdapter): void {
    this.adapters.set(adapter.providerName, adapter);
  }

  /**
   * Register a billing event subscription with the underlying router.
   */
  registerSubscription(subscription: EventSubscription): void {
    this.router.subscribe(subscription);
  }

  /**
   * Ingest a provider event.
   *
   * @param provider - Billing provider identifier
   * @param rawEvent - Provider payload (webhook)
   * @param context - Optional tenancy/audit context
   *
   * @returns Canonical event, router result, and audit entry
   */
  async ingest(
    provider: ProviderName,
    rawEvent: unknown,
    context: BillingEventIngestionContext = {}
  ): Promise<BillingEventIngestionResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`No billing adapter registered for provider: ${provider}`);
    }

    const resolvedTenantId =
      context.tenantId ?? TenancyContext.getCurrentTenantId() ?? undefined;

    const canonicalEvent = adapter.translateEvent(rawEvent, resolvedTenantId);
    const eventWithTenant: BillingEvent = resolvedTenantId
      ? {
          ...canonicalEvent,
          tenantId: canonicalEvent.tenantId ?? resolvedTenantId,
        }
      : canonicalEvent;

    const ingestionResult = await this.router.handle(eventWithTenant);

    const auditEntry = this.audit.record({
      actorId: context.actorId ?? DEFAULT_ACTOR_ID,
      actorType: context.actorType ?? 'system',
      action: AUDIT_ACTION,
      resourceRef: `billing-event::${eventWithTenant.eventId}`,
      tenantId: eventWithTenant.tenantId,
      tenantTimezone: context.tenantTimezone,
      payload: {
        providerEventId: eventWithTenant.provider.eventId,
        providerEventType: eventWithTenant.provider.eventType,
        canonicalEventType: eventWithTenant.type,
        severity: eventWithTenant.severity,
        ingestionStatus: ingestionResult.status,
        actions: ingestionResult.actions,
        metadata: eventWithTenant.metadata,
      },
      metadata: {
        provider,
        adapter: adapter.providerName,
        requestId: eventWithTenant.requestId,
        idempotencyKey: eventWithTenant.idempotencyKey,
        ...context.metadata,
      },
    });

    return {
      event: eventWithTenant,
      ingestion: ingestionResult,
      auditEntry,
    };
  }

  /**
   * Access the underlying router (mainly for testing).
   */
  getRouter(): BillingEventsRouter {
    return this.router;
  }

  /**
   * Access the audit service (mainly for testing).
   */
  getAuditService(): AuditLogService {
    return this.audit;
  }
}
