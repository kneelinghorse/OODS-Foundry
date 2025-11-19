#!/usr/bin/env tsx

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import type {
  PreferenceDocumentLocator,
  PreferenceDocumentRecord,
  PreferenceDocumentRepository,
} from '@/traits/preferenceable/query/optimized-queries.js';
import {
  InMemoryPreferenceCacheTransport,
  PreferenceCache,
} from '@/traits/preferenceable/cache/preference-cache.js';
import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';

class SyntheticPreferenceRepository implements PreferenceDocumentRepository {
  private readonly sampleDocument: PreferenceDocument;
  private mutationCounter = 0;

  constructor(private readonly latencyMs: number) {
    this.sampleDocument = {
      version: '1.1.0',
      preferences: {
        theme: { mode: 'dark', density: 'comfortable' },
        notifications: {
          project_comment: { email: true, push: true },
          system_announcement: { email: true, push: true },
        },
      },
      metadata: {
        schemaVersion: '1.1.0',
        lastUpdated: '2025-11-19T00:00:00Z',
        source: 'system',
        migrationApplied: [],
      },
    } satisfies PreferenceDocument;
  }

  async fetchDocument(locator: PreferenceDocumentLocator): Promise<PreferenceDocumentRecord | null> {
    void locator;
    await sleep(this.latencyMs);
    return {
      document: this.sampleDocument,
      preferenceMutations: ++this.mutationCounter,
      updatedAt: new Date().toISOString(),
    } satisfies PreferenceDocumentRecord;
  }
}

async function main(): Promise<void> {
  const repository = new SyntheticPreferenceRepository(8);
  const transport = new InMemoryPreferenceCacheTransport();
  const cache = new PreferenceCache(repository, transport);
  const locator = { tenantId: 'bench-tenant', userId: 'bench-user' } as const;
  const iterations = 250;

  // Miss benchmark: invalidate before each fetch so the cache takes the slow path.
  const missDurations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    await cache.invalidate(locator);
    const started = performance.now();
    await cache.getDocument(locator);
    missDurations.push(performance.now() - started);
  }

  // Hit benchmark: warm cache once, then reuse entry.
  await cache.getDocument(locator, { forceRefresh: true });
  const hitDurations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    await cache.getDocument(locator);
    hitDurations.push(performance.now() - started);
  }

  const summary = {
    timestamp: new Date().toISOString(),
    iterations,
    targets: {
      cacheHitMs95: '<=5',
      cacheMissMs95: '<=10',
    },
    results: {
      hit: percentileStats(hitDurations),
      miss: percentileStats(missDurations),
      cache: cache.getMetrics(),
    },
  };

  const outputPath = resolve(process.cwd(), 'diagnostics/preference-cache-benchmarks.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  // eslint-disable-next-line no-console
  console.log('Preference cache benchmark saved to', outputPath);
}

function percentileStats(values: readonly number[]): { p50: number; p95: number; p99: number; avg: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: pickPercentile(sorted, 0.5),
    p95: pickPercentile(sorted, 0.95),
    p99: pickPercentile(sorted, 0.99),
    avg: Number((sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(3)),
  };
}

function pickPercentile(values: readonly number[], percentile: number): number {
  if (!values.length) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.floor(percentile * (values.length - 1)));
  return Number(values[index]!.toFixed(3));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
