import {
  PreferenceDocument,
  type PreferenceDocumentInput,
  type PreferenceRecord,
  PreferenceValueSchema,
  type PreferenceValue,
  clonePreferenceRecord,
  clonePreferenceValue,
  normalizePreferenceDocument,
} from '@/schemas/preferences/preference-document.js';
import {
  PreferenceMetadataSchema,
  type PreferenceMetadata,
  type PreferenceMetadataInput,
  type PreferenceMigrationRecord,
  PREFERENCE_MIGRATION_STRATEGIES,
  type PreferenceMigrationStrategy,
  SEMVER_PATTERN,
} from '@/schemas/preferences/preference-metadata.js';
import TimeService from '@/services/time/index.js';

const SEGMENT_PATTERN = /^[a-z0-9_-]+$/i;
const DEFAULT_NAMESPACES = ['theme', 'notifications', 'display'] as const;

export type PreferencePath = string | readonly string[];

export interface PreferenceStoreState {
  readonly document?: PreferenceDocumentInput;
}

export interface PreferenceStoreOptions {
  readonly namespaces?: readonly string[];
  readonly allowUnknownNamespaces?: boolean;
  readonly defaults?: PreferenceRecord;
  readonly schemaVersion?: string;
  readonly version?: string;
  readonly clock?: () => string;
}

export interface BumpVersionOptions {
  readonly id?: string;
  readonly strategy?: PreferenceMigrationStrategy;
  readonly notes?: string;
  readonly updatedBy?: string;
}

export type PreferenceStoreSnapshot = PreferenceDocument;

/**
 * Deterministic state manager for the Preferenceable trait.
 * Provides namespace guardrails plus JSONB-friendly snapshots.
 */
export class PreferenceStore {
  private readonly namespaces: Set<string>;
  private readonly allowUnknownNamespaces: boolean;
  private readonly defaultPreferences: PreferenceRecord;
  private readonly clock: () => string;
  private document: PreferenceDocument;

  constructor(state: PreferenceStoreState = {}, options: PreferenceStoreOptions = {}) {
    this.namespaces = new Set(
      (options.namespaces?.length ? options.namespaces : DEFAULT_NAMESPACES).map((segment) =>
        this.normalizeSegment(segment)
      )
    );
    this.allowUnknownNamespaces = Boolean(options.allowUnknownNamespaces);
    this.defaultPreferences = clonePreferenceRecord(options.defaults ?? {});
    this.clock =
      options.clock ??
      (() => TimeService.toIsoString(TimeService.nowSystem(), { preserveZone: false }));

    const baseDocument: PreferenceDocumentInput =
      state.document ??
      ({
        version: options.version ?? options.schemaVersion ?? '1.0.0',
        preferences: this.defaultPreferences,
        metadata: {
          schemaVersion: options.schemaVersion ?? options.version ?? '1.0.0',
          lastUpdated: this.clock(),
          source: 'system',
        },
      } satisfies PreferenceDocumentInput);

    this.document = normalizePreferenceDocument(baseDocument, {
      clock: this.clock,
      defaultVersion: options.version,
      schemaVersion: options.schemaVersion,
    });
  }

  getVersion(): string {
    return this.document.version;
  }

  getSchemaVersion(): string {
    return this.document.metadata.schemaVersion;
  }

  getNamespaces(): readonly string[] {
    return [...this.namespaces];
  }

  getPreferences(): PreferenceRecord {
    return clonePreferenceRecord(this.document.preferences);
  }

  getPreference(path: PreferencePath): PreferenceValue | undefined {
    const segments = this.ensurePathSegments(path);
    if (segments.length === 0) {
      return clonePreferenceRecord(this.document.preferences);
    }

    let cursor: unknown = this.document.preferences;
    for (const segment of segments) {
      if (!isRecord(cursor)) {
        return undefined;
      }
      cursor = cursor[segment];
      if (cursor === undefined) {
        return undefined;
      }
    }

    return clonePreferenceValue(cursor as PreferenceValue);
  }

  setPreference(path: PreferencePath, value: PreferenceValue): PreferenceValue {
    const segments = this.ensurePathSegments(path);
    if (segments.length === 0) {
      throw new Error('Preference path must contain at least one segment.');
    }
    this.enforceNamespace(segments[0]);

    const sanitized = PreferenceValueSchema.parse(value);
    let cursor: PreferenceRecord = this.document.preferences;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      if (isLeaf) {
        cursor[segment] = clonePreferenceValue(sanitized);
        return;
      }

      const next = cursor[segment];
      if (next == null) {
        const newNode: PreferenceRecord = {};
        cursor[segment] = newNode;
        cursor = newNode;
        return;
      }
      if (!isRecord(next)) {
        throw new Error(`Cannot extend non-object preference segment "${segment}".`);
      }
      cursor = next;
    });

    this.touchMetadata({
      lastUpdated: this.clock(),
    });

    return clonePreferenceValue(sanitized);
  }

  resetToDefaults(): PreferenceStoreSnapshot {
    this.document = {
      ...this.document,
      preferences: clonePreferenceRecord(this.defaultPreferences),
    };

    this.touchMetadata({
      lastUpdated: this.clock(),
      source: 'system',
    });

    return this.toDocument();
  }

  bumpVersion(nextVersion: string, options: BumpVersionOptions = {}): PreferenceStoreSnapshot {
    if (!SEMVER_PATTERN.test(nextVersion)) {
      throw new Error(`Version "${nextVersion}" must follow semver format (e.g., 1.2.0).`);
    }

    const strategy = options.strategy ?? PREFERENCE_MIGRATION_STRATEGIES[0];
    if (!PREFERENCE_MIGRATION_STRATEGIES.includes(strategy)) {
      throw new Error(`Unknown migration strategy "${strategy}".`);
    }

    const record: PreferenceMigrationRecord = {
      id: options.id ?? `migration-${nextVersion}`,
      fromVersion: this.document.version,
      toVersion: nextVersion,
      appliedAt: this.clock(),
      strategy,
      ...(options.notes ? { notes: options.notes } : {}),
    };

    const history: PreferenceMigrationRecord[] = [
      ...this.document.metadata.migrationApplied,
      record,
    ];

    this.document = {
      ...this.document,
      version: nextVersion,
    };

    this.touchMetadata({
      schemaVersion: nextVersion,
      lastUpdated: record.appliedAt,
      migrationApplied: history,
      updatedBy: options.updatedBy ?? this.document.metadata.updatedBy,
      source: 'system',
    });

    return this.toDocument();
  }

  toDocument(): PreferenceStoreSnapshot {
    return {
      ...this.document,
      preferences: clonePreferenceRecord(this.document.preferences),
    };
  }

  private ensurePathSegments(path: PreferencePath): string[] {
    if (Array.isArray(path)) {
      return path.map((segment) => this.normalizeSegment(segment));
    }
    if (typeof path !== 'string') {
      throw new Error('Preference path must be a string or array of strings.');
    }
    return path
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => this.normalizeSegment(segment));
  }

  private normalizeSegment(segment: string): string {
    if (!SEGMENT_PATTERN.test(segment)) {
      throw new Error(
        `Preference segment "${segment}" must match pattern ${SEGMENT_PATTERN.toString()}.`
      );
    }
    return segment.toLowerCase();
  }

  private enforceNamespace(namespace: string): void {
    if (this.allowUnknownNamespaces) {
      return;
    }
    if (!this.namespaces.has(namespace)) {
      throw new Error(
        `Namespace "${namespace}" is not allowed. Accepted namespaces: ${[...this.namespaces].join(
          ', '
        )}`
      );
    }
  }

  private touchMetadata(partial: PreferenceMetadataInput): void {
    const merged = {
      ...this.document.metadata,
      ...partial,
      migrationApplied:
        (partial.migrationApplied as PreferenceMigrationRecord[] | undefined) ??
        this.document.metadata.migrationApplied,
    };

    const nextMetadata: PreferenceMetadata = PreferenceMetadataSchema.parse(merged);
    this.document = {
      ...this.document,
      metadata: nextMetadata,
    };
  }
}

function isRecord(value: unknown): value is PreferenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
