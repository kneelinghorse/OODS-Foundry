/**
 * map.list MCP tool handler.
 * Lists component-to-trait mappings, optionally filtered by external system.
 */
import { loadMappings, computeMappingsEtag } from './map.shared.js';
import type { MapListInput, MapListOutput } from './types.js';

export async function handle(input: MapListInput): Promise<MapListOutput> {
  const doc = loadMappings();

  let mappings = doc.mappings;
  if (input.externalSystem) {
    const filter = input.externalSystem.toLowerCase();
    mappings = mappings.filter((m) => m.externalSystem.toLowerCase() === filter);
  }

  const sortedMappings = [...mappings].sort((left, right) => left.id.localeCompare(right.id));
  const paginationRequested = input.cursor !== undefined || input.limit !== undefined;

  let page = sortedMappings;
  let nextCursor: string | undefined;

  if (paginationRequested) {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    const startIndex = input.cursor
      ? sortedMappings.findIndex((mapping) => mapping.id > input.cursor!)
      : 0;
    const boundedStart = startIndex === -1 ? sortedMappings.length : startIndex;
    page = sortedMappings.slice(boundedStart, boundedStart + limit);
    if (boundedStart + page.length < sortedMappings.length && page.length > 0) {
      nextCursor = page[page.length - 1].id;
    }
  }

  const etag = computeMappingsEtag(doc);

  return {
    mappings: page,
    totalCount: sortedMappings.length,
    stats: {
      mappingCount: doc.stats.mappingCount,
      systemCount: doc.stats.systemCount,
    },
    etag,
    ...(nextCursor ? { nextCursor } : {}),
  };
}
