#!/usr/bin/env tsx
/**
 * Usage Aggregation Job
 *
 * Aggregates recorded usage events into daily summaries and persists them
 * for downstream consumers (invoice builder, proofs, analytics).
 *
 * Usage:
 *   pnpm usage:aggregate --tenant tenant_001
 *   pnpm usage:aggregate --tenant tenant_001 --events ./artifacts/usage/events.json
 *   pnpm usage:aggregate --tenant tenant_001 --start 2025-01-01 --end 2025-01-02
 *
 * Options:
 *   --tenant <id>        Tenant identifier (required)
 *   --start <iso-date>   Aggregation window start (inclusive, defaults to yesterday at 00:00 UTC)
 *   --end <iso-date>     Aggregation window end (exclusive, defaults to today at 00:00 UTC)
 *   --period <window>    Aggregation period: daily|weekly|monthly (default: daily)
 *   --events <path>      JSON file containing usage event inputs (default: artifacts/usage/events.json)
 *   --summaries <path>   Output file for usage summaries (default: artifacts/usage/summaries.json)
 *   --dry-run            Do not persist summaries, only print results
 *   --help               Display usage information
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { UsageAggregator } from '../../src/services/billing/usage-aggregator.js';
import { FileUsageSummaryRepository } from '../../src/services/billing/usage-repositories.js';
import type { UsageEventInput, AggregationPeriod } from '../../src/domain/billing/usage.js';

interface CliOptions {
  tenantId?: string;
  start?: string;
  end?: string;
  period: AggregationPeriod;
  eventsPath: string;
  summariesPath: string;
  dryRun: boolean;
  help: boolean;
}

const DEFAULT_EVENTS_PATH = resolve('artifacts/usage/events.json');
const DEFAULT_SUMMARIES_PATH = resolve('artifacts/usage/summaries.json');

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    period: 'daily',
    eventsPath: DEFAULT_EVENTS_PATH,
    summariesPath: DEFAULT_SUMMARIES_PATH,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--tenant':
        options.tenantId = argv[++i];
        break;
      case '--start':
        options.start = argv[++i];
        break;
      case '--end':
        options.end = argv[++i];
        break;
      case '--period':
        options.period = (argv[++i] as AggregationPeriod) ?? 'daily';
        break;
      case '--events':
        options.eventsPath = resolve(argv[++i]);
        break;
      case '--summaries':
        options.summariesPath = resolve(argv[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function usage(): void {
  console.log(`
Usage: pnpm usage:aggregate --tenant <tenant-id> [options]

Options:
  --tenant <id>        Tenant identifier (required)
  --start <iso-date>   Aggregation window start (inclusive, ISO 8601)
  --end <iso-date>     Aggregation window end (exclusive, ISO 8601)
  --period <window>    Aggregation period: daily|weekly|monthly
  --events <path>      JSON file containing usage event inputs
  --summaries <path>   Output JSON file for usage summaries
  --dry-run            Skip writing summaries to disk (prints only)
  --help, -h           Show this help message

Examples:
  pnpm usage:aggregate --tenant tenant_001
  pnpm usage:sample sub_001 --format json > artifacts/usage/events.json
  pnpm usage:aggregate --tenant tenant_001 --start 2025-01-01 --end 2025-01-02
  `.trim());
}

async function loadEvents(path: string): Promise<UsageEventInput[]> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed as UsageEventInput[];
    }
    if (Array.isArray(parsed.events)) {
      return parsed.events as UsageEventInput[];
    }
    return [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function defaultDateRange(): { start: string; end: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  return {
    start: yesterday.toISOString(),
    end: today.toISOString(),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || !options.tenantId) {
    usage();
    if (!options.tenantId) {
      process.exitCode = 1;
    }
    return;
  }

  const window = {
    ...defaultDateRange(),
    ...(options.start ? { start: new Date(options.start).toISOString() } : {}),
    ...(options.end ? { end: new Date(options.end).toISOString() } : {}),
  };

  const events = await loadEvents(options.eventsPath);
  const tenantEvents = events.filter((event) => event.tenantId === options.tenantId);

  const summaryRepository = options.dryRun
    ? undefined
    : new FileUsageSummaryRepository(options.summariesPath);

  const aggregator = new UsageAggregator({
    summaryRepository,
  });

  if (tenantEvents.length === 0) {
    console.warn(
      `⚠️  No usage events found for tenant "${options.tenantId}" in ${options.eventsPath}`
    );
  } else {
    await aggregator.recordEvents(tenantEvents);
  }

  const result = await aggregator.aggregate(window, {
    period: options.period,
    tenantId: options.tenantId,
  });

  if (!options.dryRun) {
    console.log(
      `✅ Aggregated ${result.eventCount} events into ${result.summaries.length} summaries for ${options.tenantId}`
    );
    console.log(`   → Written to ${options.summariesPath}`);
  } else {
    console.log(
      `🧪 Dry run: ${result.eventCount} events → ${result.summaries.length} summaries (not persisted)`
    );
  }

  console.log(JSON.stringify(result.summaries, null, 2));
}

main().catch((error) => {
  console.error('Usage aggregation failed:', error);
  process.exitCode = 1;
});

