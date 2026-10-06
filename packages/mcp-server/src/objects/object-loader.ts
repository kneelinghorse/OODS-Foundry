/**
 * Object loader with singleton cache.
 * Scans objects/ and domains/* /objects/ for *.object.yaml files, then the optional repository-objects/ folder and a
 * team's own folder, OODS_OBJECTS_DIR (s213-m03). The repository folder is absent from the published runtime.
 *
 * A team's object that shares a shipped object's name is used in its place, and the replacement is reported (#2352):
 * a team models its own User, Product or Invoice. Two of the team's files declaring one name are ambiguous, so neither
 * is used. Malformed files, unnamed files and unknown traits are reported, never skipped silently.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ObjectDefinition } from './types.js';
import {
  USER_OBJECTS_VARIABLE, byName, duplicateIssue, scanDefinitions, userFolder,
  type DefinitionIssue, type DefinitionSource, type FoundDefinition,
} from './definition-folders.js';
import { hasTrait, listTraits, traitEntry, traitIssues, userTraitsFolder } from './trait-loader.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

const OBJECT_SCAN_ROOTS = [
  path.join(REPO_ROOT, 'objects'),
  path.join(REPO_ROOT, 'domains'),
  // s233-m02: repository integrations keep their definitions without configuring each bridge client.
  // The runtime assembler never includes this folder; its absence is an ordinary empty scan.
  path.join(REPO_ROOT, 'repository-objects'),
];

export interface ObjectIndexEntry {
  name: string;
  file: string;
  /** The file as reports name it (a shipped file relative to the runtime root). */
  shown: string;
  source: DefinitionSource;
  /** The shipped file a team's object is used in place of. */
  replaces?: string;
}

interface ObjectIndex {
  entries: Map<string, ObjectIndexEntry>;
  documents: Map<string, Record<string, unknown>>;
  /** Names whose only definitions were refused, with the issue that says why. */
  refused: Map<string, DefinitionIssue>;
  issues: DefinitionIssue[];
  userFolder: string | null;
}

let objectIndex: ObjectIndex | null = null;
/** name -> parsed ObjectDefinition */
let objectCache: Map<string, ObjectDefinition> = new Map();

function buildIndex(): ObjectIndex {
  const issues: DefinitionIssue[] = [];
  const entries = new Map<string, ObjectIndexEntry>();
  const documents = new Map<string, Record<string, unknown>>();
  const refused = new Map<string, DefinitionIssue>();
  const use = (found: FoundDefinition, replaces?: string) => {
    entries.set(found.name, { name: found.name, file: found.file, shown: found.shown, source: found.source, ...(replaces ? { replaces } : {}) });
    documents.set(found.name, found.document);
  };

  // Shipped folders are layered: core objects, then domain packs. A later shipped file with a name already taken is
  // not served, and says so. None ships today: the saas-billing Subscription, never served, left in s220-m01 (audit F12).
  const shipped = OBJECT_SCAN_ROOTS.flatMap(root => scanDefinitions(root, '.object.yaml', 'object', 'shipped', issues, REPO_ROOT));
  for (const [name, files] of byName(shipped)) {
    use(files[0]!);
    for (const shadowed of files.slice(1)) {
      issues.push({ kind: 'duplicate', severity: 'notice', file: shadowed.shown, name,
        message: `Two shipped files declare the object "${name}": ${files[0]!.shown} is used and ${shadowed.shown} is not.` });
    }
  }

  const folder = userFolder(USER_OBJECTS_VARIABLE);
  if (folder) {
    const own = scanDefinitions(folder, '.object.yaml', 'object', 'user', issues);
    for (const [name, files] of byName(own)) {
      if (files.length > 1) {
        const issue = duplicateIssue('object', name, files);
        issues.push(issue);
        // Neither of the team's files is used; a shipped object of that name is not silently served in their place.
        entries.delete(name); documents.delete(name); refused.set(name, issue);
        continue;
      }
      const replaced = entries.get(name);
      use(files[0]!, replaced?.shown);
      if (replaced) {
        issues.push({ kind: 'replaces-shipped', severity: 'notice', file: files[0]!.shown, name,
          message: `Your object "${name}" (${files[0]!.shown}) is used in place of the shipped one (${replaced.shown}).` });
      }
    }
  }

  // A trait an object names but no folder defines leaves its fields and views out of every screen, so it is reported.
  for (const [name, document] of documents) {
    const traits = Array.isArray(document.traits) ? document.traits : [];
    for (const trait of traits) {
      const traitName = typeof trait === 'object' && trait && typeof (trait as { name?: unknown }).name === 'string' ? (trait as { name: string }).name : undefined;
      if (!traitName || hasTrait(traitName)) continue;
      const entry = entries.get(name)!;
      issues.push({ kind: 'unknown-trait', severity: 'error', file: entry.shown, name,
        message: `The object "${name}" (${entry.shown}) uses the trait "${traitName}", which no shipped or team trait defines; its fields and views are missing from every screen until it exists.` });
    }
  }

  return { entries, documents, refused, issues, userFolder: folder };
}

function ensureIndex(): ObjectIndex {
  objectIndex ??= buildIndex();
  return objectIndex;
}

function normalize(raw: Record<string, unknown>): ObjectDefinition {
  return {
    object: raw.object as ObjectDefinition['object'],
    ...(raw.relationships !== undefined ? { relationships: raw.relationships as ObjectDefinition['relationships'] } : {}),
    ...(raw.samples !== undefined ? { samples: raw.samples as ObjectDefinition['samples'] } : {}),
    traits: (raw.traits as ObjectDefinition['traits']) ?? [],
    schema: (raw.schema as ObjectDefinition['schema']) ?? {},
    semantics: (raw.semantics as ObjectDefinition['semantics']) ?? {},
    tokens: (raw.tokens as ObjectDefinition['tokens']) ?? {},
    metadata: (raw.metadata as ObjectDefinition['metadata']) ?? {},
  };
}

/** Parse a definition document the same way the loader does, for a definition not (yet) in a folder. */
export function normalizeObjectDocument(raw: Record<string, unknown>): ObjectDefinition {
  return normalize(raw);
}

/**
 * The sentence every tool gives for a name that is not an object (s206-m03): what was asked for, what exists, and what
 * to do. It keeps "not found", which callers and specs read.
 */
export function unknownObjectMessage(name: string, available: readonly string[], suggestion?: string): string {
  const refused = ensureIndex().refused.get(name);
  if (refused) return `Object "${name}" not found: ${refused.message}`;
  return `Object "${name}" not found.${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${available.join(', ')}. `
    + 'Use one of these names; they are case-sensitive.';
}

/**
 * Load a single object definition by name.
 * Returns a cached result on subsequent calls.
 */
export function loadObject(name: string): ObjectDefinition {
  const cached = objectCache.get(name);
  if (cached) return cached;

  const index = ensureIndex();
  const document = index.documents.get(name);

  if (!document) {
    throw new Error(unknownObjectMessage(name, Array.from(index.entries.keys()).sort()));
  }

  const def = normalize(document);

  objectCache.set(name, def);
  return def;
}

/** List all discovered object names (sorted). */
export function listObjects(): string[] {
  return Array.from(ensureIndex().entries.keys()).sort();
}

/** Load all objects into a name->definition map. */
export function loadAllObjects(): Map<string, ObjectDefinition> {
  const result = new Map<string, ObjectDefinition>();
  for (const name of listObjects()) {
    result.set(name, loadObject(name));
  }
  return result;
}

/** Get the file path for a named object, or undefined if not found. */
export function getObjectFilePath(name: string): string | undefined {
  return ensureIndex().entries.get(name)?.file;
}

/** Where a named object comes from, and the shipped file it replaces when it is a team's. */
export function objectEntry(name: string): ObjectIndexEntry | undefined {
  return ensureIndex().entries.get(name);
}

/** The team's objects folder (OODS_OBJECTS_DIR), resolved, or null when none is set. */
export function userObjectsFolder(): string | null {
  return ensureIndex().userFolder;
}

/** The issue that keeps every definition of this name out of use (two of the team's files declare it), if any. */
export function objectRefusal(name: string): DefinitionIssue | undefined {
  return ensureIndex().refused.get(name);
}

/** Every issue found reading object and trait folders: trait-folder issues first, then object-folder ones. */
export function registryIssues(): DefinitionIssue[] {
  return [...traitIssues(), ...ensureIndex().issues];
}

export interface DefinitionRegistryReport {
  folders: { objects: string | null; traits: string | null };
  objects: { total: number; shipped: number; user: number; replacingShipped: string[] };
  traits: { total: number; shipped: number; user: number };
  issues: DefinitionIssue[];
}

/** What object list, reload, register and health report about the definitions in use and the files that were not used. */
export function definitionRegistryReport(): DefinitionRegistryReport {
  const { entries } = ensureIndex();
  const objects = [...entries.values()];
  const traits = listTraits().map(name => traitEntry(name)!);
  return {
    folders: { objects: userObjectsFolder(), traits: userTraitsFolder() },
    objects: {
      total: objects.length,
      shipped: objects.filter(entry => entry.source === 'shipped').length,
      user: objects.filter(entry => entry.source === 'user').length,
      replacingShipped: objects.filter(entry => entry.replaces).map(entry => entry.name).sort(),
    },
    traits: { total: traits.length, shipped: traits.filter(entry => entry.source === 'shipped').length, user: traits.filter(entry => entry.source === 'user').length },
    issues: registryIssues(),
  };
}

/** Clear all caches. Primarily for testing. */
export function clearObjectCache(): void {
  objectIndex = null;
  objectCache = new Map();
}
