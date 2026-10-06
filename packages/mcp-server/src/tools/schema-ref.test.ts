/**
 * computeTtlWarning unit tests (s86-m03).
 */
import { describe, it, expect } from 'vitest';
import { computeTtlWarning, createSchemaRef, type SchemaRefRecord } from './schema-ref.js';

/**
 * Pinned-clock factory. Returns both the record and the exact `now` it was
 * anchored to, so tests can pass that same `now` into `computeTtlWarning` and
 * eliminate the race between the two `Date.now()` calls the helper and the
 * production code would otherwise make independently.
 */
function makeRecordAt(now: number, expiresInMs: number): SchemaRefRecord {
  const schema = { version: '2026.02' as const, screens: [{ id: 'test', component: 'Box' }] };
  const record = createSchemaRef(schema, 'test');
  record.expiresAtMs = now + expiresInMs;
  record.expiresAt = new Date(record.expiresAtMs).toISOString();
  return record;
}

describe('computeTtlWarning', () => {
  it('returns undefined when TTL is healthy (> 5 minutes)', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 10 * 60 * 1000); // 10 min
    expect(computeTtlWarning(record, now)).toBeUndefined();
  });

  it('returns undefined when TTL is exactly at threshold boundary (> 5 min)', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 5 * 60 * 1000 + 1); // 5 min + 1ms
    expect(computeTtlWarning(record, now)).toBeUndefined();
  });

  it('returns warning when TTL is under 5 minutes', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 4 * 60 * 1000); // 4 min
    const warning = computeTtlWarning(record, now);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain(record.ref);
    expect(warning!.remainingMs).toBeLessThanOrEqual(4 * 60 * 1000);
    expect(warning!.recommendation).toContain('action=save');
  });

  it('returns warning when TTL is exactly 5 minutes', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 5 * 60 * 1000); // exactly 5 min
    const warning = computeTtlWarning(record, now);
    expect(warning).toBeDefined();
  });

  it('returns warning when TTL is 1 minute', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 60 * 1000); // 1 min
    const warning = computeTtlWarning(record, now);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('1 minute');
  });

  it('returns warning when TTL is 30 seconds', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 30 * 1000);
    const warning = computeTtlWarning(record, now);
    expect(warning).toBeDefined();
    expect(warning!.remainingMs).toBeLessThanOrEqual(30 * 1000);
  });

  it('returns expired warning when TTL is 0', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 0);
    const warning = computeTtlWarning(record, now);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('expired');
    expect(warning!.remainingMs).toBe(0);
  });

  it('returns expired warning when TTL is negative (already expired)', () => {
    const now = Date.now();
    const record = makeRecordAt(now, -1000);
    const warning = computeTtlWarning(record, now);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('expired');
    expect(warning!.remainingMs).toBe(0);
  });

  it('includes actionable recommendation', () => {
    const now = Date.now();
    const record = makeRecordAt(now, 2 * 60 * 1000);
    const warning = computeTtlWarning(record, now);
    expect(warning!.recommendation).toMatch(/action=save|re-compose/);
  });
});
