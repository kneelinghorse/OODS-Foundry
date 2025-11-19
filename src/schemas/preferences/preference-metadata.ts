import { z } from 'zod';

import TimeService from '@/services/time/index.js';

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const PREFERENCE_SOURCES = ['user', 'system', 'migration', 'import'] as const;
export type PreferenceSource = (typeof PREFERENCE_SOURCES)[number];

export const PREFERENCE_MIGRATION_STRATEGIES = ['lazy', 'eager'] as const;
export type PreferenceMigrationStrategy = (typeof PREFERENCE_MIGRATION_STRATEGIES)[number];

const PreferenceMigrationSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3)
      .max(80),
    fromVersion: z.string().regex(SEMVER_PATTERN, 'fromVersion must follow semver (e.g., 1.0.0).'),
    toVersion: z.string().regex(SEMVER_PATTERN, 'toVersion must follow semver (e.g., 1.1.0).'),
    appliedAt: z.string().datetime({ offset: true }),
    strategy: z.enum(PREFERENCE_MIGRATION_STRATEGIES).default('lazy'),
    notes: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .optional(),
  })
  .strict();

export type PreferenceMigrationRecord = z.infer<typeof PreferenceMigrationSchema>;
export type PreferenceMigrationRecordInput = z.input<typeof PreferenceMigrationSchema>;

export const PreferenceMetadataSchema = z
  .object({
    schemaVersion: z.string().regex(SEMVER_PATTERN, 'schemaVersion must follow semver (e.g., 1.0.0).'),
    lastUpdated: z.string().datetime({ offset: true }),
    updatedBy: z
      .string()
      .trim()
      .min(2)
      .max(128)
      .optional(),
    source: z.enum(PREFERENCE_SOURCES).default('user'),
    migrationApplied: z.array(PreferenceMigrationSchema).default([]),
  })
  .strict();

export type PreferenceMetadata = z.infer<typeof PreferenceMetadataSchema>;
export type PreferenceMetadataInput = Partial<z.input<typeof PreferenceMetadataSchema>>;

export interface NormalizePreferenceMetadataOptions {
  readonly clock?: () => string;
  readonly schemaVersionFallback?: string;
  readonly updatedBy?: string;
  readonly source?: PreferenceSource;
}

export function normalizePreferenceMetadata(
  input: PreferenceMetadataInput,
  options: NormalizePreferenceMetadataOptions = {}
): PreferenceMetadata {
  const clock =
    options.clock ??
    (() => TimeService.toIsoString(TimeService.nowSystem(), { preserveZone: false }));

  const payload: PreferenceMetadataInput = {
    schemaVersion: input.schemaVersion ?? options.schemaVersionFallback ?? '1.0.0',
    lastUpdated: input.lastUpdated ?? clock(),
    source: input.source ?? options.source ?? 'user',
    updatedBy: input.updatedBy ?? options.updatedBy,
    migrationApplied: input.migrationApplied ?? [],
  };

  if (input.migrationApplied) {
    payload.migrationApplied = input.migrationApplied;
  }

  const metadata = PreferenceMetadataSchema.parse(payload);
  const sortedMigrations = [...metadata.migrationApplied].sort((a, b) =>
    a.appliedAt.localeCompare(b.appliedAt)
  );

  return {
    ...metadata,
    migrationApplied: sortedMigrations,
  };
}
