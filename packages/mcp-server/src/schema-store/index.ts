import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { UiSchema } from '../schemas/generated.js';
import { createSchemaRef, hydrateSchemaRef, resolveSchemaRef, unavailableSchemaRef } from '../tools/schema-ref.js';
import {
  DEFAULT_SCHEMA_STORE_DIR,
  SCHEMA_STORE_INDEX_FILE,
  type SchemaListFilters,
  type SchemaMetadata,
  type SchemaRecord,
  type SchemaSaveInput,
  type SchemaStoreIndex,
  type SchemaStoreOptions,
} from './types.js';

const INDEX_DOC_VERSION = 1;
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

type ErrnoError = NodeJS.ErrnoException;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): error is ErrnoError {
  return isObject(error) && typeof error.code === 'string' && error.code === 'ENOENT';
}

function isUiSchema(value: unknown): value is UiSchema {
  if (!isObject(value)) return false;
  return typeof value.version === 'string' && Array.isArray(value.screens) && value.screens.length > 0;
}

function normalizeName(name: string): string {
  return name.trim();
}

function assertValidName(name: string): void {
  if (!name) {
    throw new Error('Schema name must be non-empty.');
  }
  if (!SAFE_NAME_PATTERN.test(name)) {
    throw new Error(`Schema name "${name}" is invalid. Use letters, numbers, hyphens, and underscores only.`);
  }
  if (name === SCHEMA_STORE_INDEX_FILE.replace(/\.json$/, '')) {
    throw new Error(`Schema name "${name}" is reserved.`);
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }
  return normalized;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toMetadata(record: SchemaRecord): SchemaMetadata {
  const { schema, ...metadata } = record;
  return metadata;
}

function parseSchemaMetadata(value: unknown): SchemaMetadata | null {
  if (!isObject(value)) return null;
  if (typeof value.name !== 'string' || !value.name.trim()) return null;
  if (typeof value.schemaRef !== 'string' || !value.schemaRef.trim()) return null;
  if (typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version <= 0) return null;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null;

  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  const metadata: SchemaMetadata = {
    name: value.name,
    schemaRef: value.schemaRef,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    tags: normalizeTags(tags),
  };

  if (typeof value.object === 'string' && value.object.trim()) metadata.object = value.object;
  if (typeof value.context === 'string' && value.context.trim()) metadata.context = value.context;
  if (typeof value.author === 'string' && value.author.trim()) metadata.author = value.author;

  return metadata;
}

function parseSchemaRecord(value: unknown, expectedName: string): SchemaRecord {
  if (!isObject(value)) {
    throw new Error(`Schema "${expectedName}" record is invalid (expected object).`);
  }
  if (!isUiSchema(value.schema)) {
    throw new Error(`Schema "${expectedName}" record is invalid (missing UiSchema payload).`);
  }

  const metadata = parseSchemaMetadata(value);
  if (!metadata) {
    throw new Error(`Schema "${expectedName}" record is invalid (metadata fields missing).`);
  }
  if (metadata.name !== expectedName) {
    throw new Error(`Schema file name mismatch for "${expectedName}" (record contains "${metadata.name}").`);
  }

  return {
    ...metadata,
    schema: value.schema,
  };
}

async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath);
}

function resolveStoreDir(projectRoot: string, storeDir?: string): string {
  if (!storeDir) {
    return path.resolve(projectRoot, DEFAULT_SCHEMA_STORE_DIR);
  }
  return path.isAbsolute(storeDir)
    ? path.resolve(storeDir)
    : path.resolve(projectRoot, storeDir);
}

export class SchemaStore {
  readonly projectRoot: string;
  readonly storeDir: string;
  readonly indexPath: string;
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(options: SchemaStoreOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    this.storeDir = resolveStoreDir(this.projectRoot, options.storeDir);
    this.indexPath = path.join(this.storeDir, SCHEMA_STORE_INDEX_FILE);
  }

  private schemaFilePath(name: string): string {
    return path.join(this.storeDir, `${name}.json`);
  }

  private async ensureStoreDir(): Promise<void> {
    await fs.mkdir(this.storeDir, { recursive: true });
  }

  private async readIndex(): Promise<SchemaMetadata[]> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const entries = Array.isArray(parsed)
        ? parsed
        : isObject(parsed) && Array.isArray(parsed.schemas)
          ? parsed.schemas
          : [];
      const metadata = entries
        .map((entry) => parseSchemaMetadata(entry))
        .filter((entry): entry is SchemaMetadata => entry !== null);
      return metadata;
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }
      throw error;
    }
  }

  private async writeIndex(entries: SchemaMetadata[]): Promise<void> {
    const doc: SchemaStoreIndex = {
      version: INDEX_DOC_VERSION,
      updatedAt: nowIso(),
      schemas: entries,
    };
    await this.ensureStoreDir();
    await writeJsonAtomic(this.indexPath, doc);
  }

  private enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(task, task);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async save(input: SchemaSaveInput): Promise<SchemaRecord> {
    const name = normalizeName(input.name);
    assertValidName(name);

    let schema: UiSchema;
    let schemaRef: string;
    if (input.schemaRef) {
      const cached = resolveSchemaRef(input.schemaRef);
      if (!cached.ok) {
        throw new Error(`Cannot save schema "${name}": ${unavailableSchemaRef(input.schemaRef, cached.reason).message} Run design.compose again and save the new schemaRef right away.`);
      }
      schema = cached.schema;
      schemaRef = cached.record.ref;
    } else if (input.schema) {
      schema = structuredClone(input.schema);
      schemaRef = createSchemaRef(schema, 'schema-store-save').ref;
    } else {
      throw new Error('Schema save requires either schemaRef or schema.');
    }

    return this.enqueueMutation(async () => {
      await this.ensureStoreDir();
      const indexEntries = await this.readIndex();
      const existing = indexEntries.find((entry) => entry.name === name);
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      const record: SchemaRecord = {
        name,
        schemaRef,
        schema: structuredClone(schema),
        object: input.object ?? existing?.object,
        context: input.context ?? existing?.context,
        version: existing ? existing.version + 1 : 1,
        author: input.author ?? existing?.author,
        createdAt,
        updatedAt,
        tags: normalizeTags(input.tags ?? existing?.tags ?? []),
      };

      await writeJsonAtomic(this.schemaFilePath(name), record);

      const nextEntries = indexEntries.filter((entry) => entry.name !== name);
      nextEntries.push(toMetadata(record));
      await this.writeIndex(nextEntries);
      return structuredClone(record);
    });
  }

  async load(nameInput: string, version?: number): Promise<SchemaRecord> {
    const name = normalizeName(nameInput);
    assertValidName(name);

    let record: SchemaRecord;
    try {
      const raw = await fs.readFile(this.schemaFilePath(name), 'utf8');
      record = parseSchemaRecord(JSON.parse(raw), name);
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error(`Schema "${name}" not found.`);
      }
      throw error;
    }

    if (typeof version === 'number' && version !== record.version) {
      throw new Error(`Schema "${name}" version ${version} not found (latest is ${record.version}).`);
    }

    const hydrated = hydrateSchemaRef(record.schema, { ref: record.schemaRef, source: 'schema-store-load' });
    return {
      ...record,
      schemaRef: hydrated.ref,
      schema: structuredClone(record.schema),
    };
  }

  async list(filters: SchemaListFilters = {}): Promise<SchemaMetadata[]> {
    const entries = await this.readIndex();
    const tagFilters = normalizeTags(filters.tags);

    return entries
      .filter((entry) => {
        if (filters.object && entry.object !== filters.object) return false;
        if (filters.context && entry.context !== filters.context) return false;
        if (tagFilters.length > 0) {
          const tagSet = new Set(entry.tags);
          const hasTag = tagFilters.some((tag) => tagSet.has(tag));
          if (!hasTag) return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(nameInput: string): Promise<SchemaMetadata> {
    const name = normalizeName(nameInput);
    assertValidName(name);

    return this.enqueueMutation(async () => {
      const entries = await this.readIndex();
      const existing = entries.find((entry) => entry.name === name);
      if (!existing) {
        throw new Error(`Schema "${name}" not found.`);
      }

      try {
        await fs.unlink(this.schemaFilePath(name));
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
      }

      const nextEntries = entries.filter((entry) => entry.name !== name);
      await this.writeIndex(nextEntries);
      return structuredClone(existing);
    });
  }

  async exists(nameInput: string): Promise<boolean> {
    const name = normalizeName(nameInput);
    assertValidName(name);

    const entries = await this.readIndex();
    if (entries.some((entry) => entry.name === name)) {
      return true;
    }

    try {
      await fs.access(this.schemaFilePath(name));
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }
}

export function createSchemaStore(options?: SchemaStoreOptions): SchemaStore {
  return new SchemaStore(options);
}
