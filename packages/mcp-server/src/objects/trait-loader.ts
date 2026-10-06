/**
 * Trait loader with singleton cache.
 * Scans traits/{core,lifecycle,financial,content,behavioral,visual,structural,viz}/
 * and domains/* /traits/ for *.trait.yaml files, then a team's own folder, OODS_TRAITS_DIR (s213-m03).
 * Supports lookup by simple name ("Priceable") or category-qualified ("financial/Priceable").
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TraitDefinition } from './types.js';
import {
  USER_TRAITS_VARIABLE, byName, duplicateIssue, scanDefinitions, userFolder,
  type DefinitionIssue, type DefinitionSource, type FoundDefinition,
} from './definition-folders.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

const TRAIT_SCAN_ROOTS = [
  path.join(REPO_ROOT, 'traits'),
  path.join(REPO_ROOT, 'domains'),
];

export interface TraitIndexEntry {
  name: string;
  category: string | null;
  file: string;
  shown: string;
  source: DefinitionSource;
}

interface TraitIndex {
  /** simple name -> entry (e.g. "Priceable") */
  names: Map<string, TraitIndexEntry>;
  /** category/name -> entry (e.g. "financial/Priceable") */
  qualified: Map<string, TraitIndexEntry>;
  documents: Map<string, Record<string, unknown>>;
  refused: Map<string, DefinitionIssue>;
  issues: DefinitionIssue[];
  userFolder: string | null;
}

let traitIndex: TraitIndex | null = null;
/** lookup key -> parsed TraitDefinition */
let traitCache: Map<string, TraitDefinition> = new Map();

/**
 * s213-m03: shipped traits, then a team's folder (OODS_TRAITS_DIR). A team's trait may not reuse a shipped trait's name
 * (#2352): every shipped object composes shipped traits by name, and the composer gives some of them meaning
 * (Stateful, Cancellable, Billable, Priceable, the Mark traits), so a replacement would silently change screens the
 * team never touched. It is refused and reported; the team names its trait differently.
 */
function buildIndex(): TraitIndex {
  const issues: DefinitionIssue[] = [];
  const index: TraitIndex = { names: new Map(), qualified: new Map(), documents: new Map(), refused: new Map(), issues, userFolder: userFolder(USER_TRAITS_VARIABLE) };
  const use = (found: FoundDefinition) => {
    const category = typeof found.header.category === 'string' ? found.header.category : null;
    const entry = { name: found.name, category, file: found.file, shown: found.shown, source: found.source };
    index.names.set(found.name, entry);
    if (category) index.qualified.set(`${category}/${found.name}`, entry);
    index.documents.set(found.name, found.document);
  };

  const shipped = TRAIT_SCAN_ROOTS.flatMap(root => scanDefinitions(root, '.trait.yaml', 'trait', 'shipped', issues, REPO_ROOT));
  for (const [name, files] of byName(shipped)) {
    use(files[0]!);
    for (const shadowed of files.slice(1)) {
      issues.push({ kind: 'duplicate', severity: 'notice', file: shadowed.shown, name,
        message: `Two shipped files declare the trait "${name}": ${files[0]!.shown} is used and ${shadowed.shown} is not.` });
    }
  }

  if (index.userFolder) {
    const own = scanDefinitions(index.userFolder, '.trait.yaml', 'trait', 'user', issues);
    for (const [name, files] of byName(own)) {
      if (files.length > 1) {
        const issue = duplicateIssue('trait', name, files);
        issues.push(issue); index.refused.set(name, issue);
        continue;
      }
      const shippedTrait = index.names.get(name);
      if (shippedTrait) {
        const issue: DefinitionIssue = { kind: 'shipped-name', severity: 'error', file: files[0]!.shown, name,
          message: `Your trait "${name}" (${files[0]!.shown}) is not used: a shipped trait has that name (${shippedTrait.shown}), and shipped objects compose it. Give yours a name of its own.` };
        issues.push(issue);
        continue;
      }
      use(files[0]!);
    }
  }
  return index;
}

function ensureIndex(): TraitIndex {
  traitIndex ??= buildIndex();
  return traitIndex;
}

function normalize(raw: Record<string, unknown>): TraitDefinition {
  return {
    trait: raw.trait as TraitDefinition['trait'],
    parameters: (raw.parameters as TraitDefinition['parameters']) ?? [],
    schema: (raw.schema as TraitDefinition['schema']) ?? {},
    semantics: (raw.semantics as TraitDefinition['semantics']) ?? {},
    view_extensions: (raw.view_extensions as TraitDefinition['view_extensions']) ?? {},
    tokens: (raw.tokens as TraitDefinition['tokens']) ?? {},
    events: raw.events as TraitDefinition['events'] | undefined,
    state_machine: raw.state_machine as TraitDefinition['state_machine'] | undefined,
    actions: raw.actions as TraitDefinition['actions'] | undefined,
    dependencies: (raw.dependencies as TraitDefinition['dependencies']) ?? [],
    metadata: (raw.metadata as TraitDefinition['metadata']) ?? {},
  };
}

/**
 * Resolve a trait name to its index entry.
 * Accepts "Priceable", "financial/Priceable", or any category-qualified form.
 */
function resolveTraitEntry(name: string): TraitIndexEntry | undefined {
  const { names, qualified } = ensureIndex();

  // Try exact match on simple name first
  const byName = names.get(name);
  if (byName) return byName;

  // Try qualified match (e.g. "financial/Priceable")
  const byQualified = qualified.get(name);
  if (byQualified) return byQualified;

  // Try resolving "lifecycle/Stateful" -> map directory prefix to category
  // The YAML category might differ from the directory name, so also try
  // matching the second segment as a simple name
  if (name.includes('/')) {
    const simpleName = name.split('/').pop()!;
    const bySimple = names.get(simpleName);
    if (bySimple) return bySimple;
  }

  return undefined;
}

/**
 * Load a single trait definition by name.
 * Accepts simple ("Priceable") or category-qualified ("financial/Priceable") forms.
 * Returns a cached result on subsequent calls.
 */
export function loadTrait(name: string): TraitDefinition {
  const cached = traitCache.get(name);
  if (cached) return cached;

  const entry = resolveTraitEntry(name);

  if (!entry) {
    const { names, refused } = ensureIndex();
    const problem = refused.get(name.split('/').pop()!);
    if (problem) throw new Error(`Trait "${name}" not found: ${problem.message}`);
    const available = Array.from(names.keys()).sort();
    throw new Error(
      `Trait "${name}" not found. Available: ${available.join(', ')}`,
    );
  }

  const def = normalize(ensureIndex().documents.get(entry.name)!);

  // Cache under both the requested key and the canonical name
  traitCache.set(name, def);
  if (def.trait.name !== name) {
    traitCache.set(def.trait.name, def);
  }

  return def;
}

/** List all discovered trait names (sorted, simple names only). */
export function listTraits(): string[] {
  return Array.from(ensureIndex().names.keys()).sort();
}

/** Load all traits into a name->definition map (keyed by canonical trait name). */
export function loadAllTraits(): Map<string, TraitDefinition> {
  const result = new Map<string, TraitDefinition>();
  for (const name of listTraits()) {
    result.set(name, loadTrait(name));
  }
  return result;
}

/** Get the file path for a named trait, or undefined if not found. */
export function getTraitFilePath(name: string): string | undefined {
  return resolveTraitEntry(name)?.file;
}

/** Whether a trait of this name (simple or category-qualified) is in use. */
export function hasTrait(name: string): boolean {
  return resolveTraitEntry(name) !== undefined;
}

/** Where a named trait comes from. */
export function traitEntry(name: string): TraitIndexEntry | undefined {
  return resolveTraitEntry(name);
}

/** The team's traits folder (OODS_TRAITS_DIR), resolved, or null when none is set. */
export function userTraitsFolder(): string | null {
  return ensureIndex().userFolder;
}

/** The issue that keeps every definition of this trait name out of use (two of the team's files declare it), if any. */
export function traitRefusal(name: string): DefinitionIssue | undefined {
  return ensureIndex().refused.get(name);
}

/** Every issue found reading the trait folders. */
export function traitIssues(): DefinitionIssue[] {
  return ensureIndex().issues;
}

/** Clear all caches. Primarily for testing. */
export function clearTraitCache(): void {
  traitIndex = null;
  traitCache = new Map();
}
