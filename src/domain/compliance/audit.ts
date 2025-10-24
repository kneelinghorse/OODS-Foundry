/**
 * Audit Log Domain Model
 * 
 * Append-only immutable audit trail with cryptographic hash chain
 * for tamper detection.
 * 
 * @module domain/compliance/audit
 */

import { createHash } from 'crypto';

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit log entry (immutable record)
 */
export interface AuditLogEntry {
  id: string;
  
  /** ISO timestamp */
  timestamp: string;
  
  /** Actor who performed the action */
  actorId: string;
  actorType: 'user' | 'agent' | 'system';
  
  /** Optional tenant/organization scope */
  tenantId?: string;
  
  /** Action performed (e.g., "subscription.pause", "token.approve") */
  action: string;
  
  /** Resource reference (e.g., "subscription:sub_123") */
  resourceRef: string;
  
  /** SHA-256 hash of payload for integrity verification */
  payloadHash: string;
  
  /** Optional metadata (must not contain PII) */
  metadata?: Record<string, unknown>;
  
  /** Severity level */
  severity: AuditSeverity;
  
  /** Hash of previous entry for chain integrity */
  previousHash?: string;
  
  /** Chain sequence number */
  sequenceNumber: number;
}

/**
 * Audit log query filters
 */
export interface AuditLogQuery {
  actorId?: string;
  tenantId?: string;
  action?: string;
  resourceRef?: string;
  severity?: AuditSeverity;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

/**
 * Compute SHA-256 hash of audit entry
 * Used for both payload and chain hash
 */
export function computeAuditHash(data: string | Record<string, unknown>): string {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify hash chain integrity
 * Returns true if the chain is intact, false if tampered
 */
export function verifyChainIntegrity(entries: AuditLogEntry[]): boolean {
  if (entries.length === 0) return true;
  
  // Sort by sequence number
  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    
    // Compute expected hash of previous entry
    const expectedHash = computeEntryHash(prev);
    
    // Verify current entry's previousHash matches
    if (curr.previousHash !== expectedHash) {
      return false;
    }
  }
  
  return true;
}

/**
 * Compute canonical hash of an audit entry
 * Used for chain verification
 */
function computeEntryHash(entry: AuditLogEntry): string {
  const canonical = {
    id: entry.id,
    timestamp: entry.timestamp,
    actorId: entry.actorId,
    action: entry.action,
    resourceRef: entry.resourceRef,
    payloadHash: entry.payloadHash,
    sequenceNumber: entry.sequenceNumber,
  };
  
  return computeAuditHash(canonical);
}

/**
 * Create audit event payload
 * Helper to construct standardized events
 */
export function createAuditEvent(params: {
  actorId: string;
  actorType: 'user' | 'agent' | 'system';
  action: string;
  resourceRef: string;
  payload: Record<string, unknown>;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}): Omit<AuditLogEntry, 'id' | 'timestamp' | 'previousHash' | 'sequenceNumber'> {
  return {
    actorId: params.actorId,
    actorType: params.actorType,
    action: params.action,
    resourceRef: params.resourceRef,
    payloadHash: computeAuditHash(params.payload),
    tenantId: params.tenantId,
    metadata: params.metadata,
    severity: params.severity ?? AuditSeverity.INFO,
  };
}

/**
 * Action categories that require audit logging
 */
export const AUDITED_ACTIONS = [
  // Subscription lifecycle
  'subscription.create',
  'subscription.pause',
  'subscription.resume',
  'subscription.cancel',
  'subscription.refund',
  
  // Overlay publishing
  'overlay.publish',
  'overlay.revert',
  
  // Token governance
  'token.approve',
  'token.reject',
  
  // Compliance admin
  'compliance.grant-role',
  'compliance.revoke-role',
  'compliance.create-permission',
  'compliance.delete-permission',
  
  // Agent operations
  'agent.approve-action',
  'agent.deny-action',
] as const;

export type AuditedAction = typeof AUDITED_ACTIONS[number];

/**
 * Check if an action requires audit logging
 */
export function isAuditedAction(action: string): action is AuditedAction {
  return (AUDITED_ACTIONS as readonly string[]).includes(action);
}

