import { randomUUID } from 'node:crypto';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import {
  PreferenceMetadataSchema,
  type PreferenceMetadata,
  type PreferenceMigrationRecord,
  type PreferenceMigrationStrategy,
  type PreferenceSource,
  PREFERENCE_MIGRATION_STRATEGIES,
  SEMVER_PATTERN,
} from '@/schemas/preferences/preference-metadata.js';
import TimeService from '@/services/time/index.js';

export interface RecordPreferenceMigrationOptions {
  readonly strategy: PreferenceMigrationStrategy;
  readonly clock?: () => string;
  readonly updatedBy?: string;
  readonly source?: PreferenceSource;
  readonly notes?: string;
  readonly recordId?: string;
}

export interface PreferenceVersionTransition {
  readonly document: PreferenceDocument;
  readonly record?: PreferenceMigrationRecord;
  readonly changed: boolean;
}

export interface RollbackPreferenceVersionOptions {
  readonly clock?: () => string;
  readonly updatedBy?: string;
  readonly source?: PreferenceSource;
}

const DEFAULT_CLOCK = (): string =>
  TimeService.toIsoString(TimeService.nowSystem(), { preserveZone: false });

export function recordPreferenceMigration(
  document: PreferenceDocument,
  toVersion: string,
  options: RecordPreferenceMigrationOptions
): PreferenceVersionTransition {
  const normalizedTarget = normalizeVersion(toVersion);
  const fromVersion = document.metadata.schemaVersion;
  if (fromVersion === normalizedTarget) {
    return {
      document,
      changed: false,
    };
  }

  if (!PREFERENCE_MIGRATION_STRATEGIES.includes(options.strategy)) {
    throw new Error(`Unknown preference migration strategy: ${options.strategy}`);
  }

  const timestamp = (options.clock ?? DEFAULT_CLOCK)();
  const record: PreferenceMigrationRecord = {
    id: options.recordId ?? buildRecordId(options.strategy, fromVersion, normalizedTarget),
    fromVersion,
    toVersion: normalizedTarget,
    appliedAt: timestamp,
    strategy: options.strategy,
    ...(options.notes ? { notes: options.notes } : {}),
  };

  const metadata: PreferenceMetadata = PreferenceMetadataSchema.parse({
    ...document.metadata,
    schemaVersion: normalizedTarget,
    lastUpdated: timestamp,
    source: options.source ?? document.metadata.source ?? 'system',
    updatedBy: options.updatedBy ?? document.metadata.updatedBy,
    migrationApplied: [...document.metadata.migrationApplied, record],
  });

  const nextDocument: PreferenceDocument = structuredClone(document);
  nextDocument.version = normalizedTarget;
  nextDocument.metadata = metadata;

  return {
    document: nextDocument,
    record,
    changed: true,
  };
}

export function rollbackPreferenceVersion(
  document: PreferenceDocument,
  targetVersion: string,
  options: RollbackPreferenceVersionOptions = {}
): PreferenceVersionTransition {
  const normalizedTarget = normalizeVersion(targetVersion);
  const currentVersion = document.metadata.schemaVersion;
  if (currentVersion === normalizedTarget) {
    return {
      document,
      changed: false,
    };
  }

  const history = document.metadata.migrationApplied;
  const latest = history.at(-1);
  if (!latest || latest.fromVersion !== normalizedTarget || latest.toVersion !== currentVersion) {
    throw new Error(
      `Cannot rollback preference document from ${currentVersion} to ${normalizedTarget}. No matching migration record found.`
    );
  }

  const timestamp = (options.clock ?? DEFAULT_CLOCK)();
  const trimmedHistory = history.slice(0, -1);
  const metadata: PreferenceMetadata = PreferenceMetadataSchema.parse({
    ...document.metadata,
    schemaVersion: normalizedTarget,
    lastUpdated: timestamp,
    source: options.source ?? document.metadata.source ?? 'system',
    updatedBy: options.updatedBy ?? document.metadata.updatedBy,
    migrationApplied: trimmedHistory,
  });

  const reverted: PreferenceDocument = structuredClone(document);
  reverted.version = normalizedTarget;
  reverted.metadata = metadata;

  return {
    document: reverted,
    changed: true,
  };
}

function buildRecordId(
  strategy: PreferenceMigrationStrategy,
  fromVersion: string,
  toVersion: string
): string {
  const sanitizedFrom = fromVersion.replace(/\./g, '_');
  const sanitizedTo = toVersion.replace(/\./g, '_');
  return `${strategy}-${sanitizedFrom}-to-${sanitizedTo}-${randomUUID().slice(0, 8)}`;
}

function normalizeVersion(version: string): string {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Preference schema version must follow semver: ${version}`);
  }
  return version;
}
