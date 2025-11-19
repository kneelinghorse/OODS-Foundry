import type {
  PreferenceSchemaDefinition,
  PreferenceSchemaMetadata,
  PreferenceSchemaMigration,
} from './schema-registry.js';
import { getPreferenceSchema } from './schema-registry.js';

export type SchemaCompatibilityLevel = 'identical' | 'backward' | 'breaking';

export interface SchemaDiffSummary {
  readonly addedFields: readonly string[];
  readonly removedFields: readonly string[];
  readonly typeChanges: readonly string[];
  readonly requiredChanges: readonly string[];
}

export interface SchemaCompatibilityReport {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly level: SchemaCompatibilityLevel;
  readonly declaredCompatible: boolean;
  readonly diff: SchemaDiffSummary;
  readonly metadata: PreferenceSchemaMetadata;
}

interface FlatProperty {
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
}

export function analyzeSchemaCompatibility(fromVersion: string, toVersion: string): SchemaCompatibilityReport {
  const previous = getPreferenceSchema(fromVersion);
  const next = getPreferenceSchema(toVersion);
  const diff = diffSchemas(previous, next);
  const level = computeCompatibilityLevel(diff);
  const declaredCompatible = next.metadata.compatibleWith.includes(fromVersion);

  return {
    fromVersion: previous.version,
    toVersion: next.version,
    level,
    declaredCompatible,
    diff,
    metadata: next.metadata,
  };
}

export function generateMigrationPlan(
  fromVersion: string,
  toVersion: string
): PreferenceSchemaMigration | undefined {
  const target = getPreferenceSchema(toVersion);
  return target.metadata.migrations.find((migration) => migration.fromVersion === fromVersion);
}

function diffSchemas(previous: PreferenceSchemaDefinition, next: PreferenceSchemaDefinition): SchemaDiffSummary {
  const previousMap = flattenSchema(previous.schema);
  const nextMap = flattenSchema(next.schema);

  const addedFields: string[] = [];
  const removedFields: string[] = [];
  const typeChanges: string[] = [];
  const requiredChanges: string[] = [];

  for (const path of previousMap.keys()) {
    if (!nextMap.has(path)) {
      removedFields.push(path);
    }
  }

  for (const [path, property] of nextMap.entries()) {
    const prior = previousMap.get(path);
    if (!prior) {
      addedFields.push(path);
      if (property.required) {
        requiredChanges.push(path);
      }
      continue;
    }

    if (prior.type !== property.type) {
      typeChanges.push(path);
      continue;
    }

    if (!prior.required && property.required) {
      requiredChanges.push(path);
    }
  }

  return {
    addedFields: addedFields.sort(),
    removedFields: removedFields.sort(),
    typeChanges: typeChanges.sort(),
    requiredChanges: requiredChanges.sort(),
  };
}

function computeCompatibilityLevel(diff: SchemaDiffSummary): SchemaCompatibilityLevel {
  const hasBreakingChange =
    diff.removedFields.length > 0 || diff.typeChanges.length > 0 || diff.requiredChanges.length > 0;

  if (!hasBreakingChange && diff.addedFields.length === 0) {
    return 'identical';
  }

  if (hasBreakingChange) {
    return 'breaking';
  }

  return 'backward';
}

function flattenSchema(
  schema: Record<string, unknown>,
  context: { path: string; required: boolean } = { path: '', required: true }
): Map<string, FlatProperty> {
  const map = new Map<string, FlatProperty>();
  const currentPath = context.path;
  if (currentPath) {
    map.set(currentPath, {
      path: currentPath,
      type: describeType(schema),
      required: context.required,
    });
  }

  if (isRecord(schema.properties)) {
    const requiredSet = new Set<string>(
      Array.isArray(schema.required) ? schema.required.map((value) => String(value)) : []
    );
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!isRecord(value)) {
        continue;
      }
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      const childRequired = requiredSet.has(key);
      const childMap = flattenSchema(value, { path: childPath, required: childRequired });
      childMap.forEach((entry, path) => map.set(path, entry));
    }
  }

  if (isRecord(schema.items)) {
    const arrayPath = `${currentPath}[]`;
    map.set(arrayPath, {
      path: arrayPath,
      type: `array<${describeType(schema.items)}>`,
      required: context.required,
    });
    const childMap = flattenSchema(schema.items, { path: arrayPath, required: true });
    childMap.forEach((entry, path) => map.set(path, entry));
  }

  return map;
}

function describeType(schema: Record<string, unknown>): string {
  const type = schema.type;
  if (typeof type === 'string') {
    return type;
  }
  if (Array.isArray(type)) {
    return type.sort().join('|');
  }
  if (schema.enum && Array.isArray(schema.enum)) {
    return `enum(${schema.enum.length})`;
  }
  if (isRecord(schema.properties)) {
    return 'object';
  }
  if (isRecord(schema.items)) {
    return `array<${describeType(schema.items)}>`;
  }
  return 'unknown';
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
