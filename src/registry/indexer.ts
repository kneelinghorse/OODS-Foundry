import type { ObjectDefinition } from './object-definition.js';

/**
 * Normalize keys used for lookups and indexing.
 * Converts to lowercase and trims surrounding whitespace.
 */
export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export type MatchMode = 'any' | 'all';

export interface RegistryRecordSource {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface RegistryRecord {
  name: string;
  definition: ObjectDefinition;
  traits: readonly string[];
  tags: readonly string[];
  domains: readonly string[];
  source: RegistryRecordSource;
}

export interface QueryOptions {
  traits?: readonly string[];
  tags?: readonly string[];
  domains?: readonly string[];
  traitMatch?: MatchMode;
  tagMatch?: MatchMode;
}

export class DuplicateObjectError extends Error {
  constructor(
    public readonly objectName: string,
    public readonly existingPath: string,
    public readonly incomingPath: string
  ) {
    super(
      `Duplicate object definition "${objectName}" encountered.\n` +
        `Existing source: ${existingPath}\nIncoming source: ${incomingPath}`
    );
    this.name = 'DuplicateObjectError';
  }
}

export class ObjectIndexer {
  private readonly records = new Map<string, RegistryRecord>();
  private readonly traitIndex = new Map<string, Set<string>>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly domainIndex = new Map<string, Set<string>>();

  get size(): number {
    return this.records.size;
  }

  clear(): void {
    this.records.clear();
    this.traitIndex.clear();
    this.tagIndex.clear();
    this.domainIndex.clear();
  }

  has(name: string): boolean {
    return this.records.has(normalizeKey(name));
  }

  get(name: string): RegistryRecord | undefined {
    return this.records.get(normalizeKey(name));
  }

  entries(): Iterable<[string, RegistryRecord]> {
    return this.records.entries();
  }

  list(): RegistryRecord[] {
    return Array.from(this.records.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  add(record: RegistryRecord): void {
    const key = normalizeKey(record.name);
    const existing = this.records.get(key);
    if (existing) {
      if (existing.source.path === record.source.path) {
        // Same file re-registering should be treated as an update.
        this.upsert(record);
        return;
      }

      throw new DuplicateObjectError(record.name, existing.source.path, record.source.path);
    }

    this.records.set(key, record);
    this.indexRecord(record, key);
  }

  upsert(record: RegistryRecord): void {
    const key = normalizeKey(record.name);
    const existing = this.records.get(key);
    if (existing && existing.source.path !== record.source.path) {
      throw new DuplicateObjectError(record.name, existing.source.path, record.source.path);
    }

    if (existing) {
      this.removeFromIndexes(existing, key);
    }

    this.records.set(key, record);
    this.indexRecord(record, key);
  }

  remove(name: string): RegistryRecord | undefined {
    const key = normalizeKey(name);
    const existing = this.records.get(key);
    if (!existing) {
      return undefined;
    }

    this.records.delete(key);
    this.removeFromIndexes(existing, key);
    return existing;
  }

  query(options: QueryOptions = {}): RegistryRecord[] {
    const { traits, tags, domains, traitMatch = 'any', tagMatch = 'all' } = options;

    let candidateNames: Set<string> | undefined = undefined;

    if (traits && traits.length > 0) {
      const traitCandidates = this.lookup(this.traitIndex, traits, traitMatch);
      candidateNames = traitCandidates;
    }

    if (tags && tags.length > 0) {
      const tagCandidates = this.lookup(this.tagIndex, tags, tagMatch);
      candidateNames = candidateNames
        ? intersect(candidateNames, tagCandidates)
        : tagCandidates;
    }

    if (domains && domains.length > 0) {
      const domainCandidates = this.lookup(this.domainIndex, domains, 'any');
      candidateNames = candidateNames
        ? intersect(candidateNames, domainCandidates)
        : domainCandidates;
    }

    const matches = candidateNames
      ? Array.from(candidateNames)
          .map((key) => this.records.get(key))
          .filter((record): record is RegistryRecord => Boolean(record))
      : Array.from(this.records.values());

    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }

  findByTrait(traits: string | readonly string[], match: MatchMode = 'any'): RegistryRecord[] {
    const traitList = Array.isArray(traits) ? traits : [traits];
    return this.query({ traits: traitList, traitMatch: match });
  }

  filterByTags(tags: readonly string[], match: MatchMode = 'all'): RegistryRecord[] {
    return this.query({ tags, tagMatch: match });
  }

  filterByDomains(domains: readonly string[]): RegistryRecord[] {
    return this.query({ domains });
  }

  private indexRecord(record: RegistryRecord, nameKey: string): void {
    addValuesToIndex(this.traitIndex, record.traits, nameKey);
    addValuesToIndex(this.tagIndex, record.tags, nameKey);
    addValuesToIndex(this.domainIndex, record.domains, nameKey);
  }

  private removeFromIndexes(record: RegistryRecord, nameKey: string): void {
    removeValuesFromIndex(this.traitIndex, record.traits, nameKey);
    removeValuesFromIndex(this.tagIndex, record.tags, nameKey);
    removeValuesFromIndex(this.domainIndex, record.domains, nameKey);
  }

  private lookup(
    index: Map<string, Set<string>>,
    values: readonly string[],
    mode: MatchMode
  ): Set<string> {
    const normalized = values
      .map((value) => normalizeKey(value))
      .filter((value) => value.length > 0);

    if (normalized.length === 0) {
      return new Set();
    }

    const sets = normalized
      .map((key) => index.get(key))
      .filter((set): set is Set<string> => Boolean(set));

    if (sets.length === 0) {
      return new Set();
    }

    if (mode === 'any') {
      return union(sets);
    }

    return intersectSets(sets);
  }
}

function addValuesToIndex(index: Map<string, Set<string>>, values: readonly string[], nameKey: string): void {
  const unique = new Set<string>();
  values.forEach((value) => {
    const key = normalizeKey(value);
    if (!key) {
      return;
    }
    unique.add(key);
  });

  unique.forEach((key) => {
    const bucket = index.get(key);
    if (bucket) {
      bucket.add(nameKey);
      return;
    }

    index.set(key, new Set([nameKey]));
  });
}

function removeValuesFromIndex(index: Map<string, Set<string>>, values: readonly string[], nameKey: string): void {
  const unique = new Set<string>();
  values.forEach((value) => {
    const key = normalizeKey(value);
    if (!key) {
      return;
    }
    unique.add(key);
  });

  unique.forEach((key) => {
    const bucket = index.get(key);
    if (!bucket) {
      return;
    }

    bucket.delete(nameKey);
    if (bucket.size === 0) {
      index.delete(key);
    }
  });
}

function union(sets: readonly Set<string>[]): Set<string> {
  const result = new Set<string>();
  sets.forEach((set) => {
    set.forEach((value) => {
      result.add(value);
    });
  });
  return result;
}

function intersectSets(sets: readonly Set<string>[]): Set<string> {
  if (sets.length === 0) {
    return new Set();
  }

  const [first, ...rest] = sets;
  const result = new Set<string>();

  first.forEach((value) => {
    if (rest.every((set) => set.has(value))) {
      result.add(value);
    }
  });

  return result;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  a.forEach((value) => {
    if (b.has(value)) {
      result.add(value);
    }
  });
  return result;
}
