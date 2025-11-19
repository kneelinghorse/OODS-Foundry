import type {
  PreferenceDocument,
  PreferenceRecord,
  PreferenceValue,
} from '@/schemas/preferences/preference-document.js';
import type { PreferenceSource } from '@/schemas/preferences/preference-metadata.js';

import type { PreferenceMigrationChange } from './migration-logger.js';
import type {
  PreferenceSchemaMigration,
  PreferenceSchemaMigrationStep,
} from './schema-registry.js';
import { resolvePreferenceSchema } from './schema-registry.js';
import { generateMigrationPlan } from './compatibility-checker.js';
import { recordPreferenceMigration } from './version-tracker.js';

export interface DualWriteMigrationOptions {
  readonly targetVersion?: string;
  readonly plan?: PreferenceSchemaMigration;
  readonly clock?: () => string;
  readonly updatedBy?: string;
  readonly source?: PreferenceSource;
}

export interface DualWriteMigrationResult {
  readonly plan: PreferenceSchemaMigration;
  readonly legacyDocument: PreferenceDocument;
  readonly nextDocument: PreferenceDocument;
  readonly changes: readonly PreferenceMigrationChange[];
  readonly fromVersion: string;
  readonly toVersion: string;
}

export function runDualWriteMigration(
  document: PreferenceDocument,
  options: DualWriteMigrationOptions = {}
): DualWriteMigrationResult {
  const fromVersion = document.metadata.schemaVersion;
  const targetDefinition = resolvePreferenceSchema(options.targetVersion);
  const plan = options.plan ?? generateMigrationPlan(fromVersion, targetDefinition.version);
  if (!plan) {
    throw new Error(`No migration plan registered for ${fromVersion} → ${targetDefinition.version}.`);
  }
  if (plan.strategy !== 'eager') {
    throw new Error('Dual-write migrator requires an eager migration plan.');
  }

  const legacyDocument: PreferenceDocument = structuredClone(document);
  const nextDocument: PreferenceDocument = structuredClone(document);
  const changeSet: PreferenceMigrationChange[] = [];

  for (const step of plan.steps) {
    const applied = applyMigrationStep(nextDocument, step);
    if (applied) {
      changeSet.push(applied);
    }
  }

  const transition = recordPreferenceMigration(nextDocument, targetDefinition.version, {
    strategy: 'eager',
    clock: options.clock,
    updatedBy: options.updatedBy,
    source: options.source,
    notes: plan.summary,
  });

  return {
    plan,
    legacyDocument,
    nextDocument: transition.document,
    changes: changeSet,
    fromVersion,
    toVersion: targetDefinition.version,
  };
}

function applyMigrationStep(
  document: PreferenceDocument,
  step: PreferenceSchemaMigrationStep
): PreferenceMigrationChange | undefined {
  const targetPath = step.toPath ?? step.fromPath;
  if (!targetPath) {
    return undefined;
  }

  const sourcePath = step.fromPath ?? step.toPath ?? targetPath;
  const previousValue = getPathValue(document, targetPath);
  const sourceValue = getPathValue(document, sourcePath);
  const nextValue = transformStepValue(sourceValue, step);

  if (typeof nextValue === 'undefined' && typeof previousValue === 'undefined') {
    return undefined;
  }

  if (typeof nextValue === 'undefined') {
    deletePath(document, targetPath);
    return { path: targetPath, from: previousValue, to: undefined };
  }

  setPath(document, targetPath, nextValue);
  if (step.fromPath && step.fromPath !== targetPath) {
    deletePath(document, step.fromPath);
  }

  return { path: targetPath, from: previousValue, to: nextValue };
}

function transformStepValue(value: unknown, step: PreferenceSchemaMigrationStep): PreferenceValue | undefined {
  if (Array.isArray(value) && isRecord(step.example)) {
    return convertChannelsArray(value, step.example);
  }
  if (typeof value === 'undefined') {
    if (typeof step.example !== 'undefined') {
      return structuredClone(step.example) as PreferenceValue;
    }
    return undefined;
  }
  if (isRecord(value)) {
    return structuredClone(value as PreferenceRecord);
  }
  return structuredClone(value as PreferenceValue);
}

function convertChannelsArray(values: readonly unknown[], template: Record<string, unknown>): PreferenceRecord {
  const selected = new Set(values.filter((entry): entry is string => typeof entry === 'string'));
  const result: PreferenceRecord = {};

  for (const [channel, blueprint] of Object.entries(template)) {
    if (isRecord(blueprint)) {
      const clone = structuredClone(blueprint);
      if ('enabled' in clone) {
        (clone as Record<string, unknown>).enabled = selected.has(channel);
      }
      result[channel] = clone as PreferenceValue;
      continue;
    }
    result[channel] = selected.has(channel) ? true : structuredClone(blueprint as PreferenceValue);
  }

  for (const channel of selected) {
    if (!(channel in result)) {
      result[channel] = { enabled: true };
    }
  }

  return result;
}

function getPathValue(document: PreferenceDocument, path: string | undefined): unknown {
  if (!path) {
    return undefined;
  }
  const segments = path.split('.').filter(Boolean);
  let cursor: any = document;
  for (const segment of segments) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
    if (typeof cursor === 'undefined') {
      return undefined;
    }
  }
  return cursor;
}

function setPath(document: PreferenceDocument, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, any> = document as Record<string, any>;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const isLeaf = index === segments.length - 1;
    if (isLeaf) {
      cursor[segment] = value;
      return;
    }
    const next = cursor[segment];
    if (!isRecord(next)) {
      const newNode: Record<string, unknown> = {};
      cursor[segment] = newNode;
      cursor = newNode;
      continue;
    }
    cursor = next;
  }
}

function deletePath(document: PreferenceDocument, path: string): void {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, any> = document as Record<string, any>;
  const parents: { node: Record<string, any>; key: string }[] = [];

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!;
    const next = cursor[key];
    if (!isRecord(next)) {
      return;
    }
    parents.push({ node: cursor, key });
    cursor = next;
  }

  const leaf = segments[segments.length - 1]!;
  delete cursor[leaf];
  cleanupEmpty(parents);
}

function cleanupEmpty(parents: { node: Record<string, any>; key: string }[]): void {
  for (const { node, key } of parents.reverse()) {
    const value = node[key];
    if (isRecord(value) && Object.keys(value).length === 0) {
      delete node[key];
    }
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
