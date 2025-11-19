import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';

import { EntitlementService } from '@/traits/authz/entitlement-service.ts';

import { createAuthzTestContext } from '../traits/authz/test-helpers.ts';

const ITERATIONS = 64;

describe('Authz runtime performance', () => {
  it('resolves getUserPermissions under 5ms p99', async () => {
    const context = createAuthzTestContext();
    const service = new EntitlementService(context.executor);

    const durations = await measureIterations(async () => {
      await service.getUserPermissions(context.users.alpha, context.organizations.northwind);
    });

    const stats = summarizeDurations(durations);
    expect(stats.p99).toBeLessThan(5);
    await context.dispose();
  });

  it('evaluates hasPermission checks under 2ms p99', async () => {
    const context = createAuthzTestContext();
    const service = new EntitlementService(context.executor);

    const durations = await measureIterations(async () => {
      await service.hasPermission(context.users.alpha, context.organizations.northwind, 'document:edit');
    });

    const stats = summarizeDurations(durations);
    expect(stats.p99).toBeLessThan(2);
    await context.dispose();
  });

  it('handles 100 concurrent permission resolutions below 50ms total', async () => {
    const context = createAuthzTestContext();
    const service = new EntitlementService(context.executor);

    const started = performance.now();
    await Promise.all(
      Array.from({ length: 100 }, () =>
        service.getUserPermissions(context.users.beta, context.organizations.northwind)
      )
    );
    const total = performance.now() - started;
    expect(total).toBeLessThan(50);
    await context.dispose();
  });
});

async function measureIterations(operation: () => Promise<void>): Promise<number[]> {
  const durations: number[] = [];
  await operation();
  for (let index = 0; index < ITERATIONS; index += 1) {
    const started = performance.now();
    await operation();
    durations.push(performance.now() - started);
  }
  return durations;
}

function summarizeDurations(samples: readonly number[]): { readonly p95: number; readonly p99: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(sorted: readonly number[], threshold: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * threshold));
  return Number(sorted[index]?.toFixed(3));
}
