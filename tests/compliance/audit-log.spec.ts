/**
 * Audit Log Service Tests
 * 
 * Unit tests for audit logging, chain integrity,
 * and compliance reporting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogService, resetAuditLogService } from '../../src/services/compliance/audit-service';
import { computeAuditHash } from '../../src/domain/compliance/audit';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    resetAuditLogService();
    service = new AuditLogService();
  });

  describe('Audit Recording', () => {
    it('should record audit event with hash chain', () => {
      const event = service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'subscription.pause',
        resourceRef: 'subscription:sub_123',
        payload: { reason: 'customer request' },
      });

      expect(event.id).toBeTruthy();
      expect(event.actorId).toBe('user_1');
      expect(event.action).toBe('subscription.pause');
      expect(event.resourceRef).toBe('subscription:sub_123');
      expect(event.payloadHash).toBeTruthy();
      expect(event.sequenceNumber).toBe(0);
      expect(event.previousHash).toBeUndefined(); // First entry
      expect(event.system_time.zoneName).toBe('UTC');
      expect(event.business_time.isValid).toBe(true);
    });

    it('should chain subsequent events', () => {
      const event1 = service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'subscription.create',
        resourceRef: 'subscription:sub_123',
        payload: { plan: 'pro' },
      });

      const event2 = service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'subscription.pause',
        resourceRef: 'subscription:sub_123',
        payload: { reason: 'billing issue' },
      });

      expect(event2.previousHash).toBeTruthy();
      expect(event2.sequenceNumber).toBe(1);
      expect(event2.previousHash).not.toBe(event1.previousHash);
    });

    it('should reject events missing required fields', () => {
      expect(() => {
        service.record({
          actorId: '',
          actorType: 'user',
          action: 'test',
          resourceRef: 'test:123',
          payload: {},
        });
      }).toThrow(/Missing required audit event fields/);
    });

    it('should compute consistent payload hashes', () => {
      const payload = { key: 'value', number: 123 };
      const hash1 = computeAuditHash(payload);
      const hash2 = computeAuditHash(payload);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Audit Querying', () => {
    beforeEach(() => {
      // Seed some test events
      service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'subscription.create',
        resourceRef: 'subscription:sub_123',
        payload: { plan: 'pro' },
        tenantId: 'tenant_a',
        severity: 'INFO',
      });

      service.record({
        actorId: 'user_2',
        actorType: 'user',
        action: 'subscription.pause',
        resourceRef: 'subscription:sub_456',
        payload: { reason: 'churn' },
        tenantId: 'tenant_a',
        severity: 'WARNING',
      });

      service.record({
        actorId: 'agent_1',
        actorType: 'agent',
        action: 'token.approve',
        resourceRef: 'token:color-primary',
        payload: { approved: true },
        tenantId: 'tenant_b',
        severity: 'CRITICAL',
      });
    });

    it('should query all events', () => {
      const results = service.query();
      expect(results.length).toBe(3);
    });

    it('should filter by actorId', () => {
      const results = service.query({ actorId: 'user_1' });
      expect(results.length).toBe(1);
      expect(results[0].actorId).toBe('user_1');
    });

    it('should filter by action', () => {
      const results = service.query({ action: 'subscription.pause' });
      expect(results.length).toBe(1);
      expect(results[0].action).toBe('subscription.pause');
    });

    it('should filter by tenantId', () => {
      const results = service.query({ tenantId: 'tenant_a' });
      expect(results.length).toBe(2);
    });

    it('should filter by severity', () => {
      const results = service.query({ severity: 'CRITICAL' });
      expect(results.length).toBe(1);
      expect(results[0].severity).toBe('CRITICAL');
    });

    it('should apply pagination', () => {
      const page1 = service.query({ limit: 2, offset: 0 });
      const page2 = service.query({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(1);
    });
  });

  describe('Chain Integrity', () => {
    it('should verify intact chain', () => {
      service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'test.action',
        resourceRef: 'test:1',
        payload: {},
      });

      service.record({
        actorId: 'user_2',
        actorType: 'user',
        action: 'test.action',
        resourceRef: 'test:2',
        payload: {},
      });

      const verification = service.verifyIntegrity();
      expect(verification.valid).toBe(true);
    });

    it('should detect chain tampering', () => {
      // Record events
      service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'test.action',
        resourceRef: 'test:1',
        payload: {},
      });

      const event2 = service.record({
        actorId: 'user_2',
        actorType: 'user',
        action: 'test.action',
        resourceRef: 'test:2',
        payload: {},
      });

      // Tamper with the chain by manually altering previousHash
      // Note: This is a simulated attack for testing purposes
      // In production, the store would be truly immutable
      const entries = service.query({ limit: 10 });
      if (entries.length > 1) {
        // @ts-expect-error - Simulating tampering for test
        entries[0].previousHash = 'tampered_hash';
      }

      const verification = service.verifyIntegrity();
      expect(verification.valid).toBe(false);
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(() => {
      service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'subscription.create',
        resourceRef: 'subscription:sub_1',
        payload: {},
        severity: 'INFO',
      });

      service.record({
        actorId: 'user_1',
        actorType: 'user',
        action: 'subscription.pause',
        resourceRef: 'subscription:sub_1',
        payload: {},
        severity: 'WARNING',
      });

      service.record({
        actorId: 'user_2',
        actorType: 'user',
        action: 'token.approve',
        resourceRef: 'token:color',
        payload: {},
        severity: 'CRITICAL',
      });
    });

    it('should generate statistics', () => {
      const stats = service.getStatistics();

      expect(stats.totalEvents).toBe(3);
      expect(stats.bySeverity.INFO).toBe(1);
      expect(stats.bySeverity.WARNING).toBe(1);
      expect(stats.bySeverity.CRITICAL).toBe(1);
      expect(stats.byActor.user_1).toBe(2);
      expect(stats.byActor.user_2).toBe(1);
    });

    it('should count events', () => {
      const count = service.count();
      expect(count).toBe(3);

      const countByActor = service.count({ actorId: 'user_1' });
      expect(countByActor).toBe(2);
    });

    it('should export for compliance reporting', () => {
      const exported = service.export();

      expect(exported.length).toBe(3);
      
      // Should be in chronological order
      for (let i = 1; i < exported.length; i++) {
        expect(exported[i].sequenceNumber).toBeGreaterThan(exported[i - 1].sequenceNumber);
      }
    });
  });
});
