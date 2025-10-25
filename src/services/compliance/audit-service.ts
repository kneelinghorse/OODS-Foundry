/**
 * Audit Log Service
 * 
 * Append-only audit logging with cryptographic hash chain
 * for tamper detection and compliance reporting.
 * 
 * @module services/compliance/audit-service
 */

import type { AuditLogEntry, AuditLogQuery } from '../../domain/compliance/audit';
import { AuditSeverity, computeAuditHash, verifyChainIntegrity } from '../../domain/compliance/audit';
import TimeService, { type Tenant } from '../time';

/**
 * In-memory audit log store
 * In production, replace with append-only database table
 */
interface AuditStore {
  entries: AuditLogEntry[];
  sequenceCounter: number;
}

/**
 * Audit Log Service implementation
 */
export class AuditLogService {
  private store: AuditStore;

  constructor(store?: AuditStore) {
    this.store = store ?? {
      entries: [],
      sequenceCounter: 0,
    };
  }

  /**
   * Record an audit event (append-only operation)
   * 
   * @param event - Audit event parameters
   * @returns Created audit log entry
   * @throws Error if payload is missing required fields
   */
  record(event: {
    actorId: string;
    actorType: 'user' | 'agent' | 'system';
    action: string;
    resourceRef: string;
    payload: Record<string, unknown>;
    tenantId?: string;
    metadata?: Record<string, unknown>;
    severity?: AuditSeverity;
    tenantTimezone?: string;
  }): AuditLogEntry {
    // Validate required fields
    if (!event.actorId || !event.action || !event.resourceRef) {
      throw new Error('Missing required audit event fields: actorId, action, resourceRef');
    }

    // Get previous entry for chain linking
    const previousEntry = this.store.entries[this.store.entries.length - 1];
    const previousHash = previousEntry ? this.computeEntryHash(previousEntry) : undefined;

    // Increment sequence
    const sequenceNumber = this.store.sequenceCounter++;

    const tenantContext: Tenant | undefined = event.tenantTimezone
      ? {
          id: event.tenantId ?? 'unknown-tenant',
          timezone: event.tenantTimezone,
        }
      : undefined;

    const dualTimestamp = TimeService.createDualTimestamp(tenantContext);
    const timestampIso = TimeService.toIsoString(dualTimestamp.system_time);
    const uniqueComponent = dualTimestamp.system_time.toMillis().toString(36);
    const randomSegment = Math.random().toString(36).slice(2, 8);

    // Create immutable entry
    const entry: AuditLogEntry = {
      id: `aud_${uniqueComponent}_${randomSegment}`,
      business_time: dualTimestamp.business_time,
      system_time: dualTimestamp.system_time,
      timestamp: timestampIso,
      actorId: event.actorId,
      actorType: event.actorType,
      tenantId: event.tenantId,
      action: event.action,
      resourceRef: event.resourceRef,
      payloadHash: computeAuditHash(event.payload),
      metadata: event.metadata,
      severity: event.severity ?? AuditSeverity.INFO,
      previousHash,
      sequenceNumber,
    };

    // Append to log (immutable operation)
    this.store.entries.push(entry);

    return entry;
  }

  /**
   * Query audit log with filters
   * 
   * @param query - Query filters
   * @returns Matching audit log entries
   */
  query(query: AuditLogQuery = {}): AuditLogEntry[] {
    let results = [...this.store.entries];

    // Apply filters
    if (query.actorId) {
      results = results.filter(e => e.actorId === query.actorId);
    }

    if (query.tenantId) {
      results = results.filter(e => e.tenantId === query.tenantId);
    }

    if (query.action) {
      results = results.filter(e => e.action === query.action);
    }

    if (query.resourceRef) {
      results = results.filter(e => e.resourceRef === query.resourceRef);
    }

    if (query.severity) {
      results = results.filter(e => e.severity === query.severity);
    }

    if (query.startTime) {
      const start = TimeService.normalizeToUtc(query.startTime);
      results = results.filter((e) => e.system_time.toMillis() >= start.toMillis());
    }

    if (query.endTime) {
      const end = TimeService.normalizeToUtc(query.endTime);
      results = results.filter((e) => e.system_time.toMillis() <= end.toMillis());
    }

    // Sort by sequence number (newest first by default)
    results.sort((a, b) => b.sequenceNumber - a.sequenceNumber);

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Verify the integrity of the audit log chain
   * 
   * @returns Verification result
   */
  verifyIntegrity(): { valid: boolean; error?: string } {
    const valid = verifyChainIntegrity(this.store.entries);
    
    if (!valid) {
      return {
        valid: false,
        error: 'Audit log chain integrity violation detected',
      };
    }

    return { valid: true };
  }

  /**
   * Get total count of audit entries
   */
  count(query: Omit<AuditLogQuery, 'limit' | 'offset'> = {}): number {
    const fullQuery: AuditLogQuery = { ...query, limit: Number.MAX_SAFE_INTEGER, offset: 0 };
    return this.query(fullQuery).length;
  }

  /**
   * Get audit statistics for reporting
   */
  getStatistics(query: Omit<AuditLogQuery, 'limit' | 'offset'> = {}): {
    totalEvents: number;
    bySeverity: Record<AuditSeverity, number>;
    byActor: Record<string, number>;
    byAction: Record<string, number>;
  } {
    const entries = this.query({ ...query, limit: Number.MAX_SAFE_INTEGER });

    const stats = {
      totalEvents: entries.length,
      bySeverity: {} as Record<AuditSeverity, number>,
      byActor: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
    };

    for (const entry of entries) {
      // Count by severity
      stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] ?? 0) + 1;

      // Count by actor
      stats.byActor[entry.actorId] = (stats.byActor[entry.actorId] ?? 0) + 1;

      // Count by action
      stats.byAction[entry.action] = (stats.byAction[entry.action] ?? 0) + 1;
    }

    return stats;
  }

  /**
   * Export audit log for compliance reporting
   * Returns entries in chronological order
   */
  export(query: Omit<AuditLogQuery, 'limit' | 'offset'> = {}): AuditLogEntry[] {
    const entries = this.query({ ...query, limit: Number.MAX_SAFE_INTEGER });
    
    // Return in chronological order
    return entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  /**
   * Compute canonical hash of an audit entry
   */
  private computeEntryHash(entry: AuditLogEntry): string {
    const canonical = {
      id: entry.id,
      system_time: TimeService.toIsoString(entry.system_time),
      business_time: TimeService.toIsoString(entry.business_time, { preserveZone: true }),
      actorId: entry.actorId,
      action: entry.action,
      resourceRef: entry.resourceRef,
      payloadHash: entry.payloadHash,
      sequenceNumber: entry.sequenceNumber,
    };
    
    return computeAuditHash(canonical);
  }
}

/**
 * Singleton instance for app-wide usage
 */
let _instance: AuditLogService | null = null;

export function getAuditLogService(): AuditLogService {
  if (!_instance) {
    _instance = new AuditLogService();
  }
  return _instance;
}

/**
 * Reset singleton (testing only)
 */
export function resetAuditLogService(): void {
  _instance = null;
}
