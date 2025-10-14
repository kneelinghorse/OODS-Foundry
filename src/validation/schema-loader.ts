/**
 * Schema Loader
 *
 * Loads JSON Schema files for trait parameter validation with memoization.
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type JsonSchema = Record<string, unknown>;

export interface SchemaLoaderOptions {
  /** Directory containing trait parameter schemas */
  schemaDir?: string;
}

/**
 * Normalizes trait names (PascalCase, camelCase, snake_case) to the
 * kebab-case file naming convention used under `schemas/traits`.
 */
export function normalizeTraitName(traitName: string): string {
  return traitName
    .trim()
    .replace(/\s+/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/**
 * Resolves the schema file name for a given trait.
 */
function schemaFileName(traitName: string): string {
  return `${normalizeTraitName(traitName)}.parameters.schema.json`;
}

export class SchemaLoader {
  private readonly schemaDir: string;
  private readonly cache = new Map<string, JsonSchema>();

  constructor(options: SchemaLoaderOptions = {}) {
    this.schemaDir = resolveDefaultSchemaDir(options.schemaDir);
  }

  /**
   * Load a schema synchronously (used for synchronous validation paths).
   */
  loadSync(traitName: string): JsonSchema {
    const key = normalizeTraitName(traitName);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const filePath = join(this.schemaDir, schemaFileName(traitName));
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Parameter schema not found for trait "${traitName}" (expected at ${filePath})`
      );
    }

    const schema = JSON.parse(raw) as JsonSchema;
    // Remove $schema field as AJV doesn't need it and it can cause issues
    const { $schema: _schema, ...schemaWithoutMeta } = schema;
    this.cache.set(key, schemaWithoutMeta);
    return schemaWithoutMeta;
  }

  /**
   * Load a schema asynchronously (used for async validation paths).
   */
  async load(traitName: string): Promise<JsonSchema> {
    const key = normalizeTraitName(traitName);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const filePath = join(this.schemaDir, schemaFileName(traitName));
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Parameter schema not found for trait "${traitName}" (expected at ${filePath})`
      );
    }

    const schema = JSON.parse(raw) as JsonSchema;
    // Remove $schema field as AJV doesn't need it and it can cause issues
    const { $schema: _schema, ...schemaWithoutMeta } = schema;
    this.cache.set(key, schemaWithoutMeta);
    return schemaWithoutMeta;
  }

  /**
   * Number of cached schemas (exposed for testing and diagnostics).
   */
  getCachedSchemaCount(): number {
    return this.cache.size;
  }

  /**
   * Clears the in-memory schema cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

function resolveDefaultSchemaDir(provided?: string): string {
  if (provided) {
    return resolve(provided);
  }

  const moduleDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const moduleRelative = resolve(moduleDir, '../../schemas/traits');
  if (existsSync(moduleRelative)) {
    return moduleRelative;
  }

  const cwdRelative = resolve(process.cwd(), 'schemas', 'traits');
  if (existsSync(cwdRelative)) {
    return cwdRelative;
  }

  const appRelative = resolve(process.cwd(), 'app', 'schemas', 'traits');
  if (existsSync(appRelative)) {
    return appRelative;
  }

  return moduleRelative;
}
