#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import type { Message } from '@/schemas/communication/message.js';
import TimeService from '@/services/time/index.js';
import type { SqlExecutor } from '@/traits/authz/runtime-types.js';
import { SLAMonitor } from '@/traits/communication/sla-monitor.js';
import {
  isWithinRange,
  loadCommunicationDataset,
  type CommunicationDataset,
  type DateRange,
} from './communication-shared.js';

export interface AuditReport {
  readonly organizationId: string;
  readonly generatedAt: string;
  readonly windowHours: number;
  readonly totals: {
    readonly messages: number;
    readonly delivered: number;
    readonly failed: number;
    readonly queued: number;
  };
  readonly successRate: number;
  readonly failedDeliveries: number;
  readonly sla: {
    readonly timeToSendMs: number;
    readonly p95: number;
    readonly retryExhaustionRate: number;
  };
}

interface AuditCliOptions {
  readonly organizationId?: string;
  readonly start?: string;
  readonly end?: string;
  readonly format: 'json' | 'text';
  readonly datasetPath?: string;
}

export async function buildAuditReport(
  organizationId: string,
  dataset: CommunicationDataset,
  range?: DateRange
): Promise<AuditReport> {
  const messages = dataset.messages.filter(
    (message) =>
      message.organization_id === organizationId && isWithinRange(message.created_at, range)
  );

  const delivered = messages.filter((message) => message.status === 'delivered' || message.status === 'read').length;
  const failed = messages.filter((message) => message.status === 'failed' || message.status_history.some((entry) => entry.state === 'failed')).length;
  const queued = messages.filter((message) => message.status === 'queued').length;
  const total = messages.length;
  const successRate = total === 0 ? 0 : Number(((delivered / total) * 100).toFixed(3));

  const monitor = new SLAMonitor(new MemoryExecutor(), { channelType: 'all' });
  for (const message of messages) {
    await trackMessageDelivery(monitor, message);
  }

  const windowHours = resolveWindowHours(range);
  const timeToSend = await monitor.getTimeToSendMetrics(windowHours);
  const retryExhaustionRate = await monitor.getRetryExhaustionRate(windowHours);

  return {
    organizationId,
    generatedAt: TimeService.toIsoString(TimeService.nowSystem()),
    windowHours,
    totals: {
      messages: total,
      delivered,
      failed,
      queued,
    },
    successRate,
    failedDeliveries: failed,
    sla: {
      timeToSendMs: timeToSend.value,
      p95: timeToSend.p95,
      retryExhaustionRate,
    },
  } satisfies AuditReport;
}

export function renderAuditReport(report: AuditReport, format: 'json' | 'text'): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  return [
    `Organization: ${report.organizationId}`,
    `Window (hours): ${report.windowHours}`,
    `Messages: ${report.totals.messages}`,
    `Delivered: ${report.totals.delivered}`,
    `Failed deliveries: ${report.failedDeliveries}`,
    `Queued: ${report.totals.queued}`,
    `Success rate: ${report.successRate.toFixed(3)}%`,
    `SLA (p95 time-to-send ms): ${report.sla.p95}`,
    `Retry exhaustion rate: ${report.sla.retryExhaustionRate.toFixed(3)}%`,
  ].join('\n');
}

async function trackMessageDelivery(monitor: SLAMonitor, message: Message): Promise<void> {
  const queuedAtIso = message.queued_at ?? message.created_at ?? TimeService.nowSystem().toISO();
  const sentAtIso = message.sent_at ?? message.delivered_at ?? queuedAtIso;
  const queuedAt = TimeService.normalizeToUtc(queuedAtIso).toJSDate();
  const sentAt = TimeService.normalizeToUtc(sentAtIso).toJSDate();
  await monitor.trackDelivery(message.id, queuedAt, sentAt, message.status);
}

class MemoryExecutor implements SqlExecutor {
  async query<T>(_sql: string, _params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number; command: string; oid: number; fields: [] }> {
    return { rows: [], rowCount: 0, command: 'INSERT', oid: 0, fields: [] };
  }
}

function resolveWindowHours(range?: DateRange): number {
  if (!range?.start || !range?.end) {
    return 24;
  }
  const start = TimeService.normalizeToUtc(range.start).toMillis();
  const end = TimeService.normalizeToUtc(range.end).toMillis();
  if (end <= start) {
    return 24;
  }
  const diffMs = end - start;
  return Math.max(1, Math.round(diffMs / 3_600_000));
}

function parseArgs(argv: string[]): AuditCliOptions {
  let organizationId: string | undefined;
  let start: string | undefined;
  let end: string | undefined;
  let format: 'json' | 'text' = 'json';
  let datasetPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--organization':
      case '--org':
        organizationId = argv[++index];
        break;
      case '--start':
        start = argv[++index];
        break;
      case '--end':
        end = argv[++index];
        break;
      case '--format':
        format = (argv[++index] as AuditCliOptions['format']) ?? 'json';
        break;
      case '--dataset':
        datasetPath = argv[++index];
        break;
      case '--help':
      case '-h':
        return printUsage();
      default:
        break;
    }
  }

  if (!organizationId) {
    return printUsage('Missing required --organization identifier.');
  }

  return { organizationId, start, end, format, datasetPath } satisfies AuditCliOptions;
}

function printUsage(error?: string): never {
  if (error) {
    console.error(`Error: ${error}`);
  }
  console.log(`Usage: pnpm tsx src/cli/communication-audit.ts --organization <uuid> [options]

Options:
  --organization <uuid>  Organization identifier
  --start <ISO>          Optional range start
  --end <ISO>            Optional range end
  --format <json|text>   Output format (default: json)
  --dataset <file>       Optional dataset JSON override
  -h, --help             Show help
`);
  process.exit(error ? 1 : 0);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const dataset = loadCommunicationDataset(options.datasetPath);
  const report = await buildAuditReport(options.organizationId!, dataset, {
    start: options.start,
    end: options.end,
  });
  const payload = renderAuditReport(report, options.format);
  console.log(payload);
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isCliEntry()) {
  void run();
}
