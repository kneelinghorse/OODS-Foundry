import semver from 'semver';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import type { PreferenceMigrationStrategy } from '@/schemas/preferences/preference-metadata.js';

import rawDefinitions from '~/data/preference-schemas/registry.json';

type JsonSchemaDocument = Record<string, unknown>;
export type PreferenceUiSchema = Record<string, unknown>;

export type PreferenceSchemaStatus = 'stable' | 'experimental' | 'deprecated';

export interface PreferenceSchemaMigrationStep {
  readonly description: string;
  readonly fromPath?: string;
  readonly toPath?: string;
  readonly example?: unknown;
}

export interface PreferenceSchemaMigration {
  readonly fromVersion: string;
  readonly strategy: PreferenceMigrationStrategy;
  readonly summary: string;
  readonly steps: readonly PreferenceSchemaMigrationStep[];
}

export interface PreferenceSchemaMetadata {
  readonly status: PreferenceSchemaStatus;
  readonly introducedAt: string;
  readonly deprecatedAt: string | null;
  readonly compatibleWith: readonly string[];
  readonly changelog: readonly string[];
  readonly migrations: readonly PreferenceSchemaMigration[];
  readonly example: PreferenceDocument;
}

export interface PreferenceSchemaDefinition {
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly schema: JsonSchemaDocument;
  readonly uiSchema: PreferenceUiSchema;
  readonly metadata: PreferenceSchemaMetadata;
}

export interface PreferenceSchemaSummary {
  readonly version: string;
  readonly title: string;
  readonly status: PreferenceSchemaStatus;
  readonly introducedAt: string;
  readonly description: string;
  readonly compatibleWith: readonly string[];
}

type RawDefinition = PreferenceSchemaDefinition & {
  readonly metadata: PreferenceSchemaMetadata & {
    readonly migrations?: readonly PreferenceSchemaMigration[];
    readonly compatibleWith?: readonly string[];
    readonly changelog?: readonly string[];
  };
};

const registry = initializeRegistry(rawDefinitions as unknown as RawDefinition[]);
const definitionByVersion = new Map<string, PreferenceSchemaDefinition>(
  registry.map((definition) => [definition.version, definition])
);
const latestVersion = registry[0]?.version;

function initializeRegistry(definitions: RawDefinition[]): PreferenceSchemaDefinition[] {
  const uniqueVersions = new Set<string>();

  const normalized = definitions.map((definition) => {
    const version = normalizeVersion(definition.version);
    if (uniqueVersions.has(version)) {
      throw new Error(`Duplicate preference schema definition for version "${version}".`);
    }
    uniqueVersions.add(version);

    const metadata = {
      ...definition.metadata,
      status: definition.metadata.status ?? 'stable',
      compatibleWith: definition.metadata.compatibleWith ?? [version],
      changelog: definition.metadata.changelog ?? [],
      migrations: (definition.metadata.migrations ?? []).map((migration) => ({
        ...migration,
        steps: migration.steps ?? [],
      })),
    } satisfies PreferenceSchemaMetadata;

    return Object.freeze({
      version,
      title: definition.title,
      description: definition.description,
      schema: definition.schema,
      uiSchema: definition.uiSchema,
      metadata,
    });
  });

  return normalized.sort((a, b) => semver.rcompare(a.version, b.version));
}

function normalizeVersion(version: string): string {
  const normalized = semver.valid(version);
  if (!normalized) {
    throw new Error(`Preference schema version "${version}" is not a valid semver string.`);
  }
  return normalized;
}

export function listPreferenceSchemas(): readonly PreferenceSchemaSummary[] {
  return registry.map((definition) => ({
    version: definition.version,
    title: definition.title,
    status: definition.metadata.status,
    introducedAt: definition.metadata.introducedAt,
    description: definition.description,
    compatibleWith: definition.metadata.compatibleWith,
  }));
}

export function isPreferenceSchemaVersion(version: string): boolean {
  return definitionByVersion.has(version);
}

export function getPreferenceSchema(version: string): PreferenceSchemaDefinition {
  const normalized = normalizeVersion(version);
  const definition = definitionByVersion.get(normalized);
  if (!definition) {
    throw new Error(`Preference schema version "${normalized}" is not registered.`);
  }
  return definition;
}

export function getLatestPreferenceSchema(): PreferenceSchemaDefinition {
  if (!latestVersion) {
    throw new Error('No preference schemas are registered.');
  }
  return getPreferenceSchema(latestVersion);
}

export function resolvePreferenceSchema(version?: string): PreferenceSchemaDefinition {
  return version ? getPreferenceSchema(version) : getLatestPreferenceSchema();
}

export function getPreferenceSchemaVersions(): readonly string[] {
  return registry.map((definition) => definition.version);
}

export function getPreferenceExample(version?: string): PreferenceDocument {
  const definition = resolvePreferenceSchema(version);
  return structuredClone(definition.metadata.example);
}

export function getPreferenceUiSchema(version?: string): PreferenceUiSchema {
  const definition = resolvePreferenceSchema(version);
  return structuredClone(definition.uiSchema);
}
