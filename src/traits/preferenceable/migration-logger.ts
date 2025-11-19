import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

import type { PreferenceMigrationStrategy } from '@/schemas/preferences/preference-metadata.js';
import TimeService from '@/services/time/index.js';

export type PreferenceMigrationLogStatus =
  | 'started'
  | 'dual_write'
  | 'completed'
  | 'failed'
  | 'rollback';

export interface PreferenceMigrationChange {
  readonly path: string;
  readonly from?: unknown;
  readonly to?: unknown;
}

export interface PreferenceMigrationLogEntry {
  readonly id: string;
  readonly userId: string;
  readonly tenantId?: string;
  readonly strategy: PreferenceMigrationStrategy;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly status: PreferenceMigrationLogStatus;
  readonly message?: string;
  readonly changeSet: readonly PreferenceMigrationChange[];
  readonly appliedBy: string;
  readonly recordedAt: string;
  readonly notes: Record<string, unknown>;
}

export interface PreferenceMigrationLogContext {
  readonly userId: string;
  readonly tenantId?: string;
  readonly strategy: PreferenceMigrationStrategy;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly appliedBy: string;
  readonly notes?: Record<string, unknown>;
}

export interface PreferenceMigrationLogDetails {
  readonly status: PreferenceMigrationLogStatus;
  readonly message?: string;
  readonly changeSet?: readonly PreferenceMigrationChange[];
  readonly error?: unknown;
  readonly notes?: Record<string, unknown>;
}

export interface PreferenceMigrationLogWriter {
  write(entry: PreferenceMigrationLogEntry): void;
}

const DEFAULT_CLOCK = (): string =>
  TimeService.toIsoString(TimeService.nowSystem(), { preserveZone: false });

export class PreferenceMigrationLogger {
  private readonly writer: PreferenceMigrationLogWriter;
  private readonly clock: () => string;

  constructor(writer: PreferenceMigrationLogWriter, options: { clock?: () => string } = {}) {
    this.writer = writer;
    this.clock = options.clock ?? DEFAULT_CLOCK;
  }

  log(context: PreferenceMigrationLogContext, details: PreferenceMigrationLogDetails): PreferenceMigrationLogEntry {
    const notes = {
      ...(context.notes ?? {}),
      ...(details.notes ?? {}),
      ...(details.error ? { error: formatError(details.error) } : {}),
    } satisfies Record<string, unknown>;

    const entry: PreferenceMigrationLogEntry = {
      id: randomUUID(),
      userId: context.userId,
      tenantId: context.tenantId,
      strategy: context.strategy,
      fromVersion: context.fromVersion,
      toVersion: context.toVersion,
      status: details.status,
      message: details.message,
      changeSet: details.changeSet ?? [],
      appliedBy: context.appliedBy,
      recordedAt: this.clock(),
      notes,
    };

    this.writer.write(entry);
    return entry;
  }
}

export class InMemoryMigrationLogWriter implements PreferenceMigrationLogWriter {
  readonly entries: PreferenceMigrationLogEntry[] = [];

  write(entry: PreferenceMigrationLogEntry): void {
    this.entries.push(entry);
  }
}

export class JsonlMigrationLogWriter implements PreferenceMigrationLogWriter {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  write(entry: PreferenceMigrationLogEntry): void {
    const directory = dirname(this.filePath);
    if (directory && directory !== '.') {
      mkdirSync(directory, { recursive: true });
    }
    const payload = `${JSON.stringify(entry)}\n`;
    writeFileSync(this.filePath, payload, { flag: 'a' });
  }
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'unknown error', details: error };
}
