/**
 * Usage Repository Implementations
 *
 * Provides abstractions for storing usage events and summaries with both
 * in-memory and file-backed implementations. The file-backed repository is
 * used by the usage aggregation job to persist daily rollups that downstream
 * services (invoice builder, proofs) can consume.
 *
 * @module services/billing/usage-repositories
 */

import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { DateTime } from 'luxon';
import { UsageEvent, UsageSummary } from '../../domain/billing/usage.js';
import TimeService from '../time';

type SerializedUsageSummary = Omit<UsageSummary, 'business_time' | 'system_time'> & {
  business_time: string;
  system_time: string;
};

/**
 * Repository interface for raw usage events.
 */
export interface UsageEventRepository {
  add(event: UsageEvent): Promise<void>;
  getByDateRange(tenantId: string, startDate: string, endDate: string): Promise<UsageEvent[]>;
  getBySubscription(subscriptionId: string, startDate?: string, endDate?: string): Promise<UsageEvent[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

/**
 * Repository interface for aggregated usage summaries.
 */
export interface UsageSummaryRepository {
  add(summary: UsageSummary): Promise<void>;
  getBySubscription(subscriptionId: string, periodStart?: string, periodEnd?: string): Promise<UsageSummary[]>;
  getByDateRange(tenantId: string, startDate: string, endDate: string): Promise<UsageSummary[]>;
  clear(): Promise<void>;
}

/**
 * In-memory usage event repository (primarily for tests).
 */
export class InMemoryUsageEventRepository implements UsageEventRepository {
  private events: UsageEvent[] = [];

  async add(event: UsageEvent): Promise<void> {
    if (event.idempotencyKey) {
      const exists = this.events.some(
        (e) => e.idempotencyKey === event.idempotencyKey && e.tenantId === event.tenantId
      );
      if (exists) {
        return;
      }
    }

    this.events.push(event);
  }

  async getByDateRange(tenantId: string, startDate: string, endDate: string): Promise<UsageEvent[]> {
    return this.events.filter(
      (event) =>
        event.tenantId === tenantId &&
        event.recordedAt >= startDate &&
        event.recordedAt < endDate
    );
  }

  async getBySubscription(
    subscriptionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<UsageEvent[]> {
    return this.events.filter(
      (event) =>
        event.subscriptionId === subscriptionId &&
        (!startDate || event.recordedAt >= startDate) &&
        (!endDate || event.recordedAt < endDate)
    );
  }

  async clear(): Promise<void> {
    this.events = [];
  }

  async count(): Promise<number> {
    return this.events.length;
  }
}

/**
 * In-memory usage summary repository (primarily for tests).
 */
export class InMemoryUsageSummaryRepository implements UsageSummaryRepository {
  private summaries: UsageSummary[] = [];

  async add(summary: UsageSummary): Promise<void> {
    const index = this.summaries.findIndex(
      (existing) =>
        existing.subscriptionId === summary.subscriptionId &&
        existing.meterName === summary.meterName &&
        existing.periodStart === summary.periodStart
    );

    if (index >= 0) {
      this.summaries[index] = summary;
    } else {
      this.summaries.push(summary);
    }
  }

  async getBySubscription(
    subscriptionId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<UsageSummary[]> {
    return this.summaries.filter(
      (summary) =>
        summary.subscriptionId === subscriptionId &&
        (!periodStart || summary.periodStart >= periodStart) &&
        (!periodEnd || summary.periodEnd <= periodEnd)
    );
  }

  async getByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<UsageSummary[]> {
    return this.summaries.filter(
      (summary) =>
        summary.tenantId === tenantId &&
        summary.periodStart >= startDate &&
        summary.periodEnd <= endDate
    );
  }

  async clear(): Promise<void> {
    this.summaries = [];
  }
}

/**
 * File-backed usage summary repository.
 *
 * Summaries are stored as JSON arrays on disk. The repository performs
 * an upsert for each summary to keep the latest rollup per subscription,
 * meter, and period.
 */
export class FileUsageSummaryRepository implements UsageSummaryRepository {
  private summaries: UsageSummary[] = [];
  private readonly filePath: string;
  private isLoaded = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async add(summary: UsageSummary): Promise<void> {
    await this.load();

    const index = this.summaries.findIndex(
      (existing) =>
        existing.subscriptionId === summary.subscriptionId &&
        existing.meterName === summary.meterName &&
        existing.periodStart === summary.periodStart
    );

    if (index >= 0) {
      this.summaries[index] = summary;
    } else {
      this.summaries.push(summary);
    }

    await this.persist();
  }

  async getBySubscription(
    subscriptionId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<UsageSummary[]> {
    await this.load();

    return this.summaries.filter(
      (summary) =>
        summary.subscriptionId === subscriptionId &&
        (!periodStart || summary.periodStart >= periodStart) &&
        (!periodEnd || summary.periodEnd <= periodEnd)
    );
  }

  async getByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<UsageSummary[]> {
    await this.load();

    return this.summaries.filter(
      (summary) =>
        summary.tenantId === tenantId &&
        summary.periodStart >= startDate &&
        summary.periodEnd <= endDate
    );
  }

  async clear(): Promise<void> {
    this.summaries = [];
    await this.persist();
  }

  private async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as SerializedUsageSummary[];
      this.summaries = parsed.map((summary) => this.hydrate(summary));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.summaries = [];
      await this.ensureDirectory();
      await this.persist();
    }

    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    await this.ensureDirectory();
    const serialized = this.summaries.map((summary) => this.serialize(summary));
    await fs.writeFile(this.filePath, JSON.stringify(serialized, null, 2), 'utf-8');
  }

  private async ensureDirectory(): Promise<void> {
    const directory = dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
  }

  private serialize(summary: UsageSummary): SerializedUsageSummary {
    return {
      ...summary,
      business_time: TimeService.toIsoString(summary.business_time, { preserveZone: true }),
      system_time: TimeService.toIsoString(summary.system_time),
    };
  }

  private hydrate(summary: SerializedUsageSummary): UsageSummary {
    return {
      ...summary,
      business_time: DateTime.fromISO(summary.business_time),
      system_time: TimeService.normalizeToUtc(summary.system_time),
    };
  }
}
