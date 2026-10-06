/**
 * map.delete MCP tool handler.
 * Removes a component-to-trait mapping by ID.
 */
import {
  loadMappings,
  saveMappings,
  computeMappingsEtag,
} from './map.shared.js';
import type { MapDeleteInput, MapDeleteOutput } from './types.js';

export async function handle(input: MapDeleteInput): Promise<MapDeleteOutput> {
  const doc = loadMappings();

  const index = doc.mappings.findIndex((m) => m.id === input.id);
  if (index === -1) {
    return {
      status: 'error',
      message: `No mapping found with id '${input.id}'. Use map.list to see available mappings.`,
    };
  }

  const deleted = doc.mappings[index];
  doc.mappings.splice(index, 1);
  saveMappings(doc);

  return {
    status: 'ok',
    deleted: {
      id: deleted.id,
      externalSystem: deleted.externalSystem,
      externalComponent: deleted.externalComponent,
    },
    etag: computeMappingsEtag(doc),
  };
}
