import type { PreferenceDocument, PreferenceValue } from '@/schemas/preferences/preference-document.js';
import type { PreferenceSource } from '@/schemas/preferences/preference-metadata.js';

import { analyzeSchemaCompatibility } from './compatibility-checker.js';
import type { PreferenceMigrationChange } from './migration-logger.js';
import { resolvePreferenceSchema } from './schema-registry.js';
import { recordPreferenceMigration, rollbackPreferenceVersion } from './version-tracker.js';

export interface PreferenceReadRepairOptions {
  readonly targetVersion?: string;
  readonly clock?: () => string;
  readonly updatedBy?: string;
  readonly source?: PreferenceSource;
}

export interface PreferenceReadRepairResult {
  readonly document: PreferenceDocument;
  readonly applied: readonly PreferenceMigrationChange[];
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly changed: boolean;
}

export function applyPreferenceReadRepair(
  document: PreferenceDocument,
  options: PreferenceReadRepairOptions = {}
): PreferenceReadRepairResult {
  const fromVersion = document.metadata.schemaVersion;
  const targetDefinition = resolvePreferenceSchema(options.targetVersion);
  const compatibility = analyzeSchemaCompatibility(fromVersion, targetDefinition.version);
  if (compatibility.level === 'breaking') {
    throw new Error(
      `Preference schema transition ${fromVersion} → ${targetDefinition.version} is breaking. Use the dual-write migrator instead of read-repair.`
    );
  }

  const nextDocument: PreferenceDocument = structuredClone(document);
  const defaults = collectPreferenceDefaults(targetDefinition.schema);
  const changeSet: PreferenceMigrationChange[] = [];

  for (const [path, defaultValue] of defaults.entries()) {
    const fullPath = `preferences.${path}`;
    if (hasPath(nextDocument, fullPath)) {
      continue;
    }
    const cloned = structuredClone(defaultValue) as PreferenceValue;
    setPath(nextDocument, fullPath, cloned);
    changeSet.push({ path: fullPath, from: undefined, to: cloned });
  }

  const requiresVersionUpdate = fromVersion !== targetDefinition.version;
  if (!requiresVersionUpdate && changeSet.length === 0) {
    return {
      document,
      applied: [],
      fromVersion,
      toVersion: targetDefinition.version,
      changed: false,
    };
  }

  const transition = recordPreferenceMigration(nextDocument, targetDefinition.version, {
    strategy: 'lazy',
    clock: options.clock,
    updatedBy: options.updatedBy,
    source: options.source,
    notes: changeSet.length ? `${changeSet.length} preference defaults applied via read-repair.` : undefined,
  });

  return {
    document: transition.document,
    applied: changeSet,
    fromVersion,
    toVersion: targetDefinition.version,
    changed: true,
  };
}

export interface RollbackReadRepairOptions {
  readonly clock?: () => string;
  readonly updatedBy?: string;
  readonly source?: PreferenceSource;
}

export function rollbackPreferenceReadRepair(
  document: PreferenceDocument,
  applied: readonly PreferenceMigrationChange[],
  previousVersion: string,
  options: RollbackReadRepairOptions = {}
): PreferenceDocument {
  if (applied.length === 0 && document.metadata.schemaVersion === previousVersion) {
    return document;
  }

  const reverted: PreferenceDocument = structuredClone(document);
  for (const change of [...applied].reverse()) {
    const pathSegments = change.path.split('.');
    if (typeof change.from === 'undefined') {
      deletePath(reverted, pathSegments);
      continue;
    }
    setPath(reverted, change.path, structuredClone(change.from));
  }

  const transition = rollbackPreferenceVersion(reverted, previousVersion, options);
  return transition.document;
}

type JsonSchemaNode = Record<string, unknown>;

function collectPreferenceDefaults(schema: JsonSchemaNode): Map<string, PreferenceValue> {
  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  const preferencesNode = properties && isRecord(properties.preferences) ? properties.preferences : undefined;
  if (!preferencesNode) {
    return new Map();
  }
  return traverseDefaults(preferencesNode, []);
}

function traverseDefaults(node: JsonSchemaNode, segments: string[]): Map<string, PreferenceValue> {
  const defaults = new Map<string, PreferenceValue>();
  const path = segments.join('.');
  if (Object.prototype.hasOwnProperty.call(node, 'default') && path) {
    defaults.set(path, node.default as PreferenceValue);
  }

  if (isRecord(node.properties)) {
    for (const [key, child] of Object.entries(node.properties)) {
      if (!isRecord(child)) {
        continue;
      }
      const childPath = [...segments, key];
      const childDefaults = traverseDefaults(child, childPath);
      childDefaults.forEach((value, childKey) => defaults.set(childKey, value));
    }
  }

  return defaults;
}

function hasPath(root: PreferenceDocument, path: string): boolean {
  const segments = path.split('.').filter(Boolean);
  let cursor: any = root;
  for (const segment of segments) {
    if (!isRecord(cursor)) {
      return false;
    }
    cursor = cursor[segment];
    if (typeof cursor === 'undefined') {
      return false;
    }
  }
  return true;
}

function setPath(target: PreferenceDocument, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, any> = target as Record<string, any>;
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

function deletePath(target: PreferenceDocument, segments: string[]): void {
  if (segments.length === 0) {
    return;
  }
  let cursor: Record<string, any> = target as Record<string, any>;
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

  const leafKey = segments[segments.length - 1]!;
  delete cursor[leafKey];
  cleanupEmptyParents(parents);
}

function cleanupEmptyParents(parents: { node: Record<string, any>; key: string }[]): void {
  for (const { node, key } of parents.reverse()) {
    const candidate = node[key];
    if (isRecord(candidate) && Object.keys(candidate).length === 0) {
      delete node[key];
    }
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
