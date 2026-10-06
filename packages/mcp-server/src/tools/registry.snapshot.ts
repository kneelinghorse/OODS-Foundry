/**
 * registry.snapshot MCP tool handler.
 * Returns the current mapping registry plus keyed trait/object catalogs in one call.
 */
import type { RegistrySnapshotInput, RegistrySnapshotObjectInfo, RegistrySnapshotOutput, RegistrySnapshotTraitInfo } from './types.js';
import { loadMappings } from './map.shared.js';
import { computeStructuredDataEtag, handle as structuredDataFetchHandle } from './structuredData.fetch.js';
import { ToolError } from '../errors/tool-error.js';
import { liveRegistrySummary } from '../lib/live-registry.js';

type ComponentsPayload = {
  generatedAt?: string;
  traits?: unknown[];
  objects?: unknown[];
};

export async function handle(input: RegistrySnapshotInput): Promise<RegistrySnapshotOutput> {
  const mappingsDoc = loadMappings();
  // s222-m03 (#2502 ruling 15): business objects first; internal ones only with includeInternal.
  const includeInternal = input?.includeInternal === true;
  const componentsResult = await structuredDataFetchHandle({ dataset: 'components', ...(includeInternal ? { includeInternal } : {}) });

  if (!componentsResult.payload || typeof componentsResult.payload !== 'object') {
    throw new ToolError('OODS-N014', 'structuredData.fetch returned no components payload for registry.snapshot.');
  }

  const payload = componentsResult.payload as ComponentsPayload;
  const traits = indexTraits(payload.traits);
  const objects = indexObjects(payload.objects);
  const generatedAt = latestIso([mappingsDoc.generatedAt, componentsResult.generatedAt, payload.generatedAt]);

  const snapshotBase = {
    maps: mappingsDoc.mappings,
    traits,
    objects,
    generatedAt,
    registry: liveRegistrySummary({ includeInternal }),
  };

  return {
    ...snapshotBase,
    etag: computeStructuredDataEtag(snapshotBase),
  };
}

function indexTraits(values: unknown[] | undefined): Record<string, RegistrySnapshotTraitInfo> {
  const output: Record<string, RegistrySnapshotTraitInfo> = Object.create(null);

  for (const value of values ?? []) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name : null;
    const version = typeof entry.version === 'string' ? entry.version : null;
    const description = typeof entry.description === 'string' ? entry.description : '';
    const category = typeof entry.category === 'string' ? entry.category : 'unknown';
    if (!name || !version) continue;

    output[name] = {
      name,
      version,
      description,
      category,
      ...(Array.isArray(entry.tags) ? { tags: entry.tags.filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(entry.contexts)
        ? { contexts: entry.contexts.filter((item): item is string => typeof item === 'string') }
        : {}),
      ...(Array.isArray(entry.viewExtensions)
        ? { viewExtensions: entry.viewExtensions.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') }
        : {}),
      ...(Array.isArray(entry.parameters)
        ? { parameters: entry.parameters.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') }
        : {}),
      ...(entry.schema && typeof entry.schema === 'object' ? { schema: entry.schema as Record<string, unknown> } : {}),
      ...(entry.semantics && typeof entry.semantics === 'object'
        ? { semantics: entry.semantics as Record<string, unknown> }
        : {}),
      ...(entry.tokens && typeof entry.tokens === 'object' ? { tokens: entry.tokens as Record<string, unknown> } : {}),
      ...(Array.isArray(entry.dependencies)
        ? { dependencies: entry.dependencies.filter((item): item is string => typeof item === 'string') }
        : {}),
      ...(entry.metadata && typeof entry.metadata === 'object'
        ? { metadata: entry.metadata as Record<string, unknown> }
        : {}),
      ...(Array.isArray(entry.objects)
        ? { objects: entry.objects.filter((item): item is string => typeof item === 'string') }
        : {}),
      ...(typeof entry.source === 'string' ? { source: entry.source } : {}),
    };
  }

  return output;
}

function indexObjects(values: unknown[] | undefined): Record<string, RegistrySnapshotObjectInfo> {
  const output: Record<string, RegistrySnapshotObjectInfo> = Object.create(null);

  for (const value of values ?? []) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name : null;
    const version = typeof entry.version === 'string' ? entry.version : null;
    const domain = typeof entry.domain === 'string' ? entry.domain : null;
    const description = typeof entry.description === 'string' ? entry.description : '';
    if (!name || !version || !domain) continue;

    output[name] = {
      name,
      version,
      domain,
      description,
      ...(Array.isArray(entry.tags) ? { tags: entry.tags.filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(entry.traits)
        ? {
            traits: entry.traits
              .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
              .map((trait) => ({
                reference: String(trait.reference ?? ''),
                ...(trait.alias === null || typeof trait.alias === 'string' ? { alias: (trait.alias ?? null) as string | null } : {}),
                ...(trait.parameters && typeof trait.parameters === 'object'
                  ? { parameters: trait.parameters as Record<string, unknown> }
                  : {}),
              }))
              .filter((trait) => trait.reference.length > 0),
          }
        : {}),
      ...(Array.isArray(entry.fields) ? { fields: entry.fields.filter((item): item is string => typeof item === 'string') } : {}),
      ...(entry.semantics && typeof entry.semantics === 'object'
        ? { semantics: entry.semantics as Record<string, unknown> }
        : {}),
      ...(entry.tokens && typeof entry.tokens === 'object' ? { tokens: entry.tokens as Record<string, unknown> } : {}),
      ...(entry.metadata && typeof entry.metadata === 'object'
        ? { metadata: entry.metadata as Record<string, unknown> }
        : {}),
      ...(entry.visibility === 'public' || entry.visibility === 'internal' ? { visibility: entry.visibility } : {}),
      ...(typeof entry.source === 'string' ? { source: entry.source } : {}),
    };
  }

  return output;
}

function latestIso(values: Array<string | null | undefined>): string {
  const filtered = values.filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (filtered.length === 0) return new Date(0).toISOString();
  return filtered.sort().at(-1)!;
}
