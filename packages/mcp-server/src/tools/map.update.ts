/**
 * map.update MCP tool handler.
 * Partially updates an existing component-to-trait mapping.
 */
import {
  loadMappings,
  saveMappings,
  computeMappingsEtag,
} from './map.shared.js';
import { checkSubstitution } from './map.create.js';
import { ToolError } from '../errors/tool-error.js';
import { validateSubstitution } from './component-substitution.js';
import type { MapUpdateInput, MapUpdateOutput } from './types.js';

export async function handle(input: MapUpdateInput): Promise<MapUpdateOutput> {
  const doc = loadMappings();

  const index = doc.mappings.findIndex((m) => m.id === input.id);
  if (index === -1) {
    return {
      status: 'error',
      message: `No mapping found with id '${input.id}'. Use map.list to see available mappings.`,
    };
  }

  const mapping = { ...doc.mappings[index] };
  const changes: string[] = [];

  if (input.updates.substitution !== undefined) {
    mapping.substitution = input.updates.substitution;
    changes.push("substitution");
  }
  if (input.updates.substitution !== undefined) {
    validateSubstitution(mapping.substitution);
    try { checkSubstitution(mapping, doc.mappings.filter(item => item.id !== input.id)); }
    catch (error) { throw new ToolError('OODS-V219', error instanceof Error ? error.message : String(error)); }
  }

  // Apply partial updates
  if (input.updates.oodsTraits !== undefined) {
    mapping.oodsTraits = input.updates.oodsTraits;
    changes.push('oodsTraits');
  }

  if (input.updates.confidence !== undefined) {
    mapping.confidence = input.updates.confidence;
    changes.push('confidence');
  }

  if (input.updates.propMappings !== undefined) {
    mapping.propMappings = input.updates.propMappings;
    changes.push('propMappings');
  }

  if (input.updates.projection_variants !== undefined) {
    if (input.updates.projection_variants.length > 0) {
      mapping.projection_variants = input.updates.projection_variants;
    } else {
      delete mapping.projection_variants;
    }
    changes.push('projection_variants');
  }

  if (input.updates.notes !== undefined) {
    mapping.metadata = {
      ...mapping.metadata,
      updatedAt: new Date().toISOString(),
      notes: input.updates.notes,
    };
    changes.push('notes');
  } else {
    mapping.metadata = {
      ...mapping.metadata,
      updatedAt: new Date().toISOString(),
    };
  }

  if (changes.length === 0) {
    return {
      status: 'ok',
      mapping,
      etag: computeMappingsEtag(doc),
      changes: [],
      message: 'No changes applied.',
    };
  }

  doc.mappings[index] = mapping;
  saveMappings(doc);

  return {
    status: 'ok',
    mapping,
    etag: computeMappingsEtag(doc),
    changes,
  };
}
