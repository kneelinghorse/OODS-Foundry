/**
 * Schema Merger
 *
 * Handles merging of schema objects from multiple traits.
 * Implements deep merge with collision detection and resolution.
 */

import type { SchemaField } from '../trait-definition.js';
import { resolveCollision, type ResolutionResult } from '../collision-resolver.js';

/**
 * Result of schema merge operation
 */
export interface SchemaMergeResult {
  /**
   * The merged schema
   */
  schema: Record<string, SchemaField>;

  /**
   * Collisions that were resolved
   */
  resolutions: ResolutionResult[];

  /**
   * Warnings generated during merge
   */
  warnings: string[];
}

/**
 * Merge two schema objects
 *
 * @param base - The base schema (lower priority)
 * @param overlay - The overlay schema (higher priority)
 * @param baseName - Name of the base trait (for collision reporting)
 * @param overlayName - Name of the overlay trait (for collision reporting)
 * @param manualResolutions - Optional manual resolution rules
 */
export function mergeSchemas(
  base: Record<string, SchemaField>,
  overlay: Record<string, SchemaField>,
  baseName: string,
  overlayName: string,
  manualResolutions?: Record<
    string,
    {
      strategy: 'prefer_trait' | 'use_first' | 'use_last' | 'merge';
      traitName?: string;
    }
  >
): SchemaMergeResult {
  const merged: Record<string, SchemaField> = { ...base };
  const resolutions: ResolutionResult[] = [];
  const warnings: string[] = [];

  // Process each field in the overlay
  for (const [fieldName, overlayField] of Object.entries(overlay)) {
    const baseField = base[fieldName];

    if (!baseField) {
      // No collision - just add the field
      merged[fieldName] = overlayField;
    } else {
      // Collision detected - resolve it
      try {
        const resolution = resolveCollision(
          fieldName,
          baseField,
          overlayField,
          baseName,
          overlayName,
          manualResolutions?.[fieldName]
        );

        merged[fieldName] = resolution.field;
        resolutions.push(resolution);

        if (resolution.warnings) {
          warnings.push(...resolution.warnings);
        }
      } catch (error) {
        // Re-throw with more context
        throw new Error(
          `Failed to resolve collision for field "${fieldName}" between ${baseName} and ${overlayName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return {
    schema: merged,
    resolutions,
    warnings,
  };
}

/**
 * Merge multiple schemas in sequence
 *
 * @param schemas - Array of schemas with their source names
 * @param manualResolutions - Optional manual resolution rules
 */
export function mergeMultipleSchemas(
  schemas: Array<{ schema: Record<string, SchemaField>; sourceName: string }>,
  manualResolutions?: Record<
    string,
    {
      strategy: 'prefer_trait' | 'use_first' | 'use_last' | 'merge';
      traitName?: string;
    }
  >
): SchemaMergeResult {
  if (schemas.length === 0) {
    return {
      schema: {},
      resolutions: [],
      warnings: [],
    };
  }

  if (schemas.length === 1) {
    return {
      schema: schemas[0].schema,
      resolutions: [],
      warnings: [],
    };
  }

  // Merge sequentially from left to right
  let result: SchemaMergeResult = {
    schema: schemas[0].schema,
    resolutions: [],
    warnings: [],
  };

  for (let i = 1; i < schemas.length; i++) {
    const nextMerge = mergeSchemas(
      result.schema,
      schemas[i].schema,
      i === 1 ? schemas[0].sourceName : 'merged',
      schemas[i].sourceName,
      manualResolutions
    );

    result = {
      schema: nextMerge.schema,
      resolutions: [...result.resolutions, ...nextMerge.resolutions],
      warnings: [...result.warnings, ...nextMerge.warnings],
    };
  }

  return result;
}
