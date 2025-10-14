import { EventEmitter, once } from 'node:events';
import { resolve as resolvePath } from 'node:path';
import type { ParseError } from '../core/trait-definition.js';
import type { ParameterValidator } from '../validation/parameter-validator.js';
import {
  DEFAULT_IGNORED_DIRECTORIES,
  DEFAULT_OBJECT_EXTENSIONS,
  getObjectFileSnapshot,
  loadObjectFile,
  scanObjectFiles,
  type ObjectFileSnapshot,
  type ObjectLoadFailure,
  type ObjectLoadResult,
  type ObjectLoadSuccess,
} from './loader.js';
import {
  DuplicateObjectError,
  ObjectIndexer,
  normalizeKey,
  type MatchMode,
  type QueryOptions,
  type RegistryRecord,
} from './indexer.js';
import { TraitLoader, type TraitFileExtension } from './trait-loader.js';
import { TraitResolver } from './resolver.js';
import { ObjectComposer, type ResolvedObject } from './object-composer.js';

export type ObjectRegistryRecord = RegistryRecord;

export type DiagnosticEntry =
  | {
      type: 'parse_error';
      errors: ParseError[];
    }
  | {
      type: 'duplicate';
      objectName: string;
      conflictingPath: string;
    };

export type ObjectRegistryErrorEvent =
  | {
      type: 'parse_error';
      filePath: string;
      errors: ParseError[];
    }
  | {
      type: 'duplicate';
      filePath: string;
      objectName: string;
      existingPath: string;
    }
  | {
      type: 'watch_error';
      error: unknown;
    };

export interface ObjectRegistryOptions {
  roots: readonly string[];
  extensions?: readonly string[];
  ignoreDirectories?: readonly string[];
  watch?: boolean;
  pollingIntervalMs?: number;
  autoLoad?: boolean;
  deriveDomainFromPath?: (filePath: string) => string | undefined;
}

interface DuplicatePendingInfo {
  objectName: string;
  conflictingPath: string;
}

export interface ObjectResolveOptions {
  traitResolver?: TraitResolver;
  traitRoots?: readonly string[];
  traitLoaderExtensions?: readonly TraitFileExtension[];
  parameterValidator?: ParameterValidator;
  validateParameters?: boolean;
}

const DEFAULT_POLLING_INTERVAL_MS = 750;

export class ObjectRegistry extends EventEmitter {
  private readonly options: Required<
    Pick<ObjectRegistryOptions, 'roots' | 'watch'>
  > & {
    extensions: readonly string[];
    ignoreDirectories: readonly string[];
    pollingIntervalMs: number;
    deriveDomainFromPath?: (filePath: string) => string | undefined;
  };

  private readonly indexer = new ObjectIndexer();
  private readonly fileToName = new Map<string, string>();
  private readonly diagnostics = new Map<string, DiagnosticEntry[]>();
  private readonly pendingDuplicates = new Map<string, DuplicatePendingInfo>();
  private readonly snapshots = new Map<string, ObjectFileSnapshot>();

  private pollingTimer: NodeJS.Timeout | undefined;
  private isInitialized = false;
  private isRefreshing = false;

  constructor(options: ObjectRegistryOptions) {
    super();
    if (!options.roots || options.roots.length === 0) {
      throw new Error('ObjectRegistry requires at least one root directory.');
    }

    this.options = {
      roots: options.roots.map((root) => resolvePath(root)),
      extensions: options.extensions ?? [...DEFAULT_OBJECT_EXTENSIONS],
      ignoreDirectories: options.ignoreDirectories ?? [...DEFAULT_IGNORED_DIRECTORIES],
      watch: options.watch ?? false,
      pollingIntervalMs: options.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS,
      deriveDomainFromPath: options.deriveDomainFromPath,
    };

    if (options.autoLoad ?? true) {
      this.initialize();
    }
  }

  get size(): number {
    return this.indexer.size;
  }

  get ready(): boolean {
    return this.isInitialized;
  }

  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.refresh('initial');
    this.isInitialized = true;
    this.emit('ready');

    if (this.options.watch) {
      this.startWatching();
    }
  }

  async waitUntilReady(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await once(this, 'ready');
  }

  close(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
    this.removeAllListeners();
  }

  reload(): void {
    this.refresh('manual');
  }

  list(): RegistryRecord[] {
    return this.indexer.list();
  }

  getByName(name: string): RegistryRecord | undefined {
    return this.indexer.get(name);
  }

  has(name: string): boolean {
    return this.indexer.has(name);
  }

  searchByTrait(traits: string | readonly string[], match: MatchMode = 'any'): RegistryRecord[] {
    return this.indexer.findByTrait(traits, match);
  }

  filterByTags(tags: readonly string[], match: MatchMode = 'all'): RegistryRecord[] {
    return this.indexer.filterByTags(tags, match);
  }

  filterByDomains(domains: readonly string[]): RegistryRecord[] {
    return this.indexer.filterByDomains(domains);
  }

  query(options: QueryOptions): RegistryRecord[] {
    return this.indexer.query(options);
  }

  async resolve(name: string, options: ObjectResolveOptions = {}): Promise<ResolvedObject> {
    await this.waitUntilReady();

    const record = this.getByName(name);
    if (!record) {
      throw new Error(`Object "${name}" not found in registry.`);
    }

    const traitResolver = options.traitResolver ?? this.createTraitResolver(options);
    const composer = new ObjectComposer({ traitResolver });
    const visited = new Set<string>();

    return this.resolveRecord(record, composer, options, visited);
  }

  getDiagnostics(): Map<string, readonly DiagnosticEntry[]> {
    return new Map(
      Array.from(this.diagnostics.entries()).map(([filePath, entries]) => [
        filePath,
        entries.slice(),
      ])
    );
  }

  getDiagnosticsForPath(filePath: string): readonly DiagnosticEntry[] | undefined {
    const entries = this.diagnostics.get(filePath);
    return entries ? entries.slice() : undefined;
  }

  private async resolveRecord(
    record: RegistryRecord,
    composer: ObjectComposer,
    options: ObjectResolveOptions,
    visited: Set<string>
  ): Promise<ResolvedObject> {
    const key = normalizeKey(record.name);
    if (visited.has(key)) {
      throw new Error(
        `Circular inheritance detected while resolving "${record.name}". ` +
          `Traversal stack: ${Array.from(visited).join(' -> ')} -> ${record.name}`
      );
    }

    visited.add(key);

    try {
      const extendsRef = record.definition.object.extends;
      const baseName =
        typeof extendsRef === 'string'
          ? extendsRef
          : extendsRef && typeof extendsRef === 'object'
            ? extendsRef.name
            : undefined;

      let baseResolved: ResolvedObject | undefined;
      if (baseName) {
        const baseRecord = this.getByName(baseName);
        if (!baseRecord) {
          throw new Error(
            `Base object "${baseName}" referenced by "${record.name}" was not found in the registry.`
          );
        }
        baseResolved = await this.resolveRecord(baseRecord, composer, options, visited);
      }

      return composer.compose(record, {
        base: baseResolved
          ? {
              name: baseResolved.definition.object.name,
              composed: baseResolved.composed,
            }
          : undefined,
      });
    } finally {
      visited.delete(key);
    }
  }

  private createTraitResolver(options: ObjectResolveOptions): TraitResolver {
    const traitRoots = options.traitRoots;
    if (!traitRoots || traitRoots.length === 0) {
      throw new Error(
        'Object resolution requires either a pre-configured TraitResolver or a list of traitRoots.'
      );
    }

    const loader = new TraitLoader({
      roots: traitRoots,
      extensions: options.traitLoaderExtensions,
    });

    return new TraitResolver({
      loader,
      validator: options.parameterValidator,
      validateParameters: options.validateParameters,
    });
  }

  private startWatching(): void {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(() => {
      try {
        this.refresh('poll');
      } catch (error) {
        this.emit('registryError', { type: 'watch_error', error } satisfies ObjectRegistryErrorEvent);
      }
    }, this.options.pollingIntervalMs);

    // Avoid keeping the process alive if nothing else is running.
    this.pollingTimer.unref?.();
  }

  private refresh(_reason: 'initial' | 'manual' | 'poll'): void {
    if (this.isRefreshing) {
      return;
    }
    this.isRefreshing = true;

    try {
      const snapshots = scanObjectFiles({
        roots: this.options.roots,
        extensions: this.options.extensions,
        ignoreDirectories: this.options.ignoreDirectories,
      });

      const nextSnapshotMap = new Map<string, ObjectFileSnapshot>();
      const added: ObjectFileSnapshot[] = [];
      const changed: ObjectFileSnapshot[] = [];

      snapshots.forEach((snapshot) => {
        nextSnapshotMap.set(snapshot.filePath, snapshot);
        const previous = this.snapshots.get(snapshot.filePath);
        if (!previous) {
          added.push(snapshot);
          return;
        }
        if (previous.mtimeMs !== snapshot.mtimeMs || previous.size !== snapshot.size) {
          changed.push(snapshot);
        }
      });

      const removedPaths: string[] = [];
      this.snapshots.forEach((_snapshot, filePath) => {
        if (!nextSnapshotMap.has(filePath)) {
          removedPaths.push(filePath);
        }
      });

      this.snapshots.clear();
      nextSnapshotMap.forEach((snapshot) => {
        this.snapshots.set(snapshot.filePath, snapshot);
      });

      if (removedPaths.length > 0) {
        removedPaths.forEach((filePath) => {
          const removed = this.removeByPath(filePath);
          if (removed) {
            this.emit('removed', removed);
          }
          this.diagnostics.delete(filePath);
          this.pendingDuplicates.delete(filePath);
        });

        if (this.pendingDuplicates.size > 0) {
          this.retryDuplicatesForRemoved(removedPaths);
        }
      }

      added.forEach((snapshot) => {
        this.loadAndIndex(snapshot);
      });

      changed.forEach((snapshot) => {
        this.loadAndIndex(snapshot);
      });
    } finally {
      this.isRefreshing = false;
    }
  }

  private loadAndIndex(snapshot: ObjectFileSnapshot): void {
    let result: ObjectLoadResult;
    try {
      result = loadObjectFile(snapshot.filePath, snapshot);
    } catch (error) {
      this.emit('registryError', { type: 'watch_error', error } satisfies ObjectRegistryErrorEvent);
      return;
    }

    if (result.type === 'error') {
      this.handleParseFailure(result);
      return;
    }

    this.handleSuccessfulLoad(result);
  }

  private handleSuccessfulLoad(result: ObjectLoadSuccess): void {
    const record = this.toRegistryRecord(result);
    const newNameKey = normalizeKey(record.name);
    const previousNameKey = this.fileToName.get(result.filePath);

    if (previousNameKey && previousNameKey !== newNameKey) {
      const removed = this.indexer.remove(previousNameKey);
      if (removed) {
        this.emit('removed', removed);
      }
    }

    try {
      const existedPreviously = Boolean(previousNameKey) || this.indexer.has(record.name);
      this.indexer.upsert(record);
      this.fileToName.set(result.filePath, newNameKey);
      this.diagnostics.delete(result.filePath);
      this.pendingDuplicates.delete(result.filePath);

      const eventType = existedPreviously ? 'updated' : 'added';
      this.emit(eventType, record);
    } catch (error) {
      if (error instanceof DuplicateObjectError) {
        this.recordDuplicate(result.filePath, error);
        return;
      }

      throw error;
    }
  }

  private handleParseFailure(result: ObjectLoadFailure): void {
    this.diagnostics.set(result.filePath, [
      {
        type: 'parse_error',
        errors: result.errors,
      },
    ]);
    this.pendingDuplicates.delete(result.filePath);
    const removed = this.removeByPath(result.filePath);
    if (removed) {
      this.emit('removed', removed);
    }
    this.emit('registryError', {
      type: 'parse_error',
      filePath: result.filePath,
      errors: result.errors,
    } satisfies ObjectRegistryErrorEvent);
  }

  private recordDuplicate(filePath: string, error: DuplicateObjectError): void {
    this.pendingDuplicates.set(filePath, {
      objectName: error.objectName,
      conflictingPath: error.existingPath,
    });

    this.diagnostics.set(filePath, [
      {
        type: 'duplicate',
        objectName: error.objectName,
        conflictingPath: error.existingPath,
      },
    ]);

    this.emit('registryError', {
      type: 'duplicate',
      filePath,
      objectName: error.objectName,
      existingPath: error.existingPath,
    } satisfies ObjectRegistryErrorEvent);
  }

  private retryDuplicatesForRemoved(removedPaths: readonly string[]): void {
    const lookup = new Set(removedPaths);
    const candidates = Array.from(this.pendingDuplicates.entries()).filter(([, info]) =>
      lookup.has(info.conflictingPath)
    );

    candidates.forEach(([filePath]) => {
      const snapshot = getObjectFileSnapshot(filePath);
      if (!snapshot) {
        this.diagnostics.delete(filePath);
        this.pendingDuplicates.delete(filePath);
        return;
      }

      // Remove first so loadAndIndex can detect this as a fresh addition.
      this.pendingDuplicates.delete(filePath);
      this.loadAndIndex(snapshot);
    });
  }

  private removeByPath(filePath: string): RegistryRecord | undefined {
    const nameKey = this.fileToName.get(filePath);
    if (!nameKey) {
      return undefined;
    }

    this.fileToName.delete(filePath);
    return this.indexer.remove(nameKey);
  }

  private toRegistryRecord(result: ObjectLoadSuccess): RegistryRecord {
    const traits = new Set<string>();
    result.definition.traits.forEach((trait) => {
      if (trait.name) {
        traits.add(trait.name);
      }
      if (trait.alias) {
        traits.add(trait.alias);
      }
      if (trait.namespace && trait.name) {
        traits.add(`${trait.namespace}/${trait.name}`);
      }
    });

    const tags = new Set(
      (result.definition.object.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
    );

    const domains = new Set<string>();
    const declaredDomain = result.definition.object.domain;
    if (declaredDomain) {
      domains.add(declaredDomain);
    }

    const derivedDomain = this.options.deriveDomainFromPath?.(result.filePath);
    if (derivedDomain) {
      domains.add(derivedDomain);
    }

    return {
      name: result.definition.object.name,
      definition: result.definition,
      traits: Array.from(traits),
      tags: Array.from(tags),
      domains: Array.from(domains),
      source: {
        path: result.filePath,
        mtimeMs: result.mtimeMs,
        size: result.size,
      },
    };
  }
}
