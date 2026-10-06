/**
 * object.list — MCP tool returning all domain objects with metadata and optional filters, where each comes from
 * (shipped or the team's folder), and every file that is not in use with the reason (s213-m03).
 * s222-m03 (#2502 ruling 15): business objects come first; OODS Foundry's internal objects are left out, and counted,
 * unless includeInternal is set.
 */

import { definitionRegistryReport, loadObject, objectEntry, type DefinitionRegistryReport } from '../objects/object-loader.js';
import type { DefinitionSource } from '../objects/definition-folders.js';
import type { ObjectDefinition } from '../objects/types.js';
import { listedObjects, objectVisibility, type ObjectVisibility } from '../lib/live-registry.js';

export type ObjectListInput = {
  domain?: string;
  maturity?: string;
  trait?: string;
  /** List OODS Foundry's internal objects too, after the business objects. */
  includeInternal?: boolean;
};

export type ObjectListEntry = {
  name: string;
  domain: string;
  version: string;
  maturity: string | null;
  description: string;
  traits: string[];
  fieldCount: number;
  tags: string[];
  visibility: ObjectVisibility;
  source: DefinitionSource;
  replaces?: string;
};

export type ObjectListOutput = {
  objects: ObjectListEntry[];
  totalCount: number;
  /** Internal objects that match the filters but were left out because includeInternal was not set. */
  hiddenInternal: number;
  filters: {
    domain: string | null;
    maturity: string | null;
    trait: string | null;
  };
  folders: DefinitionRegistryReport['folders'];
  issues: DefinitionRegistryReport['issues'];
};

function toEntry(def: ObjectDefinition): ObjectListEntry {
  const traitNames = (def.traits ?? []).map((t) => t.name);
  const fieldCount = Object.keys(def.schema ?? {}).length;
  const entry = objectEntry(def.object.name);
  return {
    name: def.object.name,
    domain: def.object.domain,
    version: def.object.version,
    maturity: def.metadata?.maturity ?? null,
    description: def.object.description,
    traits: traitNames,
    fieldCount,
    tags: def.object.tags ?? [],
    visibility: objectVisibility(def),
    source: entry?.source ?? 'shipped',
    ...(entry?.replaces ? { replaces: entry.replaces } : {}),
  };
}

export async function handle(input: ObjectListInput): Promise<ObjectListOutput> {
  // Business objects first, then internal ones; the filters apply to both so the hidden count matches them.
  const names = listedObjects({ includeInternal: true }).names;
  let entries: ObjectListEntry[] = [];

  for (const name of names) {
    const def = loadObject(name);
    entries.push(toEntry(def));
  }

  // Apply filters
  if (input.domain) {
    const domainFilter = input.domain.toLowerCase();
    entries = entries.filter(
      (e) => e.domain.toLowerCase() === domainFilter || e.domain.toLowerCase().startsWith(domainFilter + '.'),
    );
  }

  if (input.maturity) {
    const maturityFilter = input.maturity.toLowerCase();
    entries = entries.filter(
      (e) => e.maturity !== null && e.maturity.toLowerCase() === maturityFilter,
    );
  }

  if (input.trait) {
    const traitFilter = input.trait.toLowerCase();
    entries = entries.filter((e) =>
      e.traits.some(
        (t) =>
          t.toLowerCase() === traitFilter ||
          t.toLowerCase().endsWith('/' + traitFilter),
      ),
    );
  }

  const hiddenInternal = input.includeInternal ? 0 : entries.filter((e) => e.visibility === 'internal').length;
  if (!input.includeInternal) entries = entries.filter((e) => e.visibility === 'public');

  const { folders, issues } = definitionRegistryReport();
  return {
    objects: entries,
    totalCount: entries.length,
    hiddenInternal,
    filters: {
      domain: input.domain ?? null,
      maturity: input.maturity ?? null,
      trait: input.trait ?? null,
    },
    folders,
    issues,
  };
}
