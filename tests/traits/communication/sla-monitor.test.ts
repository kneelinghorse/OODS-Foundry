import { describe, expect, it } from 'vitest';

import type { SqlExecutor } from '@/traits/authz/runtime-types.js';
import { SLAMonitor } from '@/traits/communication/sla-monitor.js';

class RecordingExecutor implements SqlExecutor {
  readonly statements: { sql: string; params?: readonly unknown[] }[] = [];

  async query(sql: string, params?: readonly unknown[]) {
    this.statements.push({ sql, params });
    return {
      rows: [],
      rowCount: 0,
      fields: [],
      command: 'INSERT',
      oid: 0,
    } as never;
  }
}

describe('SLAMonitor', () => {
  const clock = () => new Date('2025-11-20T12:00:00Z');

  it('persists metrics when tracking deliveries and aggregates time to send', async () => {
    const executor = new RecordingExecutor();
    const monitor = new SLAMonitor(executor, { clock });

    await monitor.trackDelivery(
      'msg-1',
      new Date('2025-11-20T11:59:30Z'),
      new Date('2025-11-20T12:00:00Z'),
      'delivered'
    );
    await monitor.trackDelivery(
      'msg-2',
      new Date('2025-11-20T11:58:30Z'),
      new Date('2025-11-20T12:00:00Z'),
      'delivered'
    );
    await monitor.trackDelivery(
      'msg-3',
      new Date('2025-11-20T11:55:30Z'),
      new Date('2025-11-20T12:00:00Z'),
      'retry_exhausted'
    );
    await monitor.trackDelivery(
      'msg-4',
      new Date('2025-11-20T11:50:00Z'),
      new Date('2025-11-20T12:00:00Z'),
      'delivered'
    );

    const metrics = await monitor.getTimeToSendMetrics(4);

    expect(metrics.count).toBe(4);
    expect(metrics.value).toBeGreaterThan(1000);
    expect(metrics.p50).toBe(90000);
    expect(metrics.p95).toBe(270000);
    expect(executor.statements.length).toBeGreaterThanOrEqual(5);
  });

  it('calculates success and retry exhaustion rates', async () => {
    const executor = new RecordingExecutor();
    const monitor = new SLAMonitor(executor, { clock });

    await monitor.trackDelivery(
      'msg-1',
      new Date('2025-11-20T11:59:30Z'),
      new Date('2025-11-20T12:00:00Z'),
      'delivered'
    );
    await monitor.trackDelivery(
      'msg-2',
      new Date('2025-11-20T11:58:30Z'),
      new Date('2025-11-20T12:00:00Z'),
      'retry_exhausted'
    );

    const success = await monitor.getSuccessRateMetrics(2);
    const exhaustion = await monitor.getRetryExhaustionRate(2);

    expect(success.value).toBe(50);
    expect(exhaustion).toBe(50);
  });
});
