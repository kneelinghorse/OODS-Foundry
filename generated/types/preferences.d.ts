/**
 * Canonical preference document + metadata types for the Preferenceable trait.
 * Source: src/schemas/preferences/preference-document.ts
 */

export type PreferencePrimitive = string | number | boolean | null;

export type PreferenceValue =
  | PreferencePrimitive
  | readonly PreferenceValue[]
  | PreferenceRecord;

export interface PreferenceRecord {
  readonly [key: string]: PreferenceValue;
}

export type PreferenceSource = 'user' | 'system' | 'migration' | 'import';
export type PreferenceMigrationStrategy = 'lazy' | 'eager';

export interface PreferenceMigrationRecord {
  id: string;
  fromVersion: string;
  toVersion: string;
  appliedAt: string;
  strategy: PreferenceMigrationStrategy;
  notes?: string;
}

export interface PreferenceMetadata {
  schemaVersion: string;
  lastUpdated: string;
  updatedBy?: string;
  source: PreferenceSource;
  migrationApplied: readonly PreferenceMigrationRecord[];
}

export interface PreferenceDocument {
  version: string;
  preferences: PreferenceRecord;
  metadata: PreferenceMetadata;
}
