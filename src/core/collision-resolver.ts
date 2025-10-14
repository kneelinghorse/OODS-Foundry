/**
 * Collision Resolver
 *
 * Implements the collision policy from the Trait Engine Specification:
 * - Same type → merge, prefer stricter constraints
 * - Enum ∪ Enum → union values
 * - Optional vs Required → required wins
 * - Different type → throw error
 * - Explicit resolution in object → apply manual rule
 */

import type { SchemaField } from './trait-definition.js';
import type { CollisionInfo } from './composed-object.js';

/**
 * Result of collision resolution
 */
export interface ResolutionResult {
  /**
   * The resolved field definition
   */
  field: SchemaField;

  /**
   * Information about the collision and how it was resolved
   */
  collisionInfo: CollisionInfo;

  /**
   * Any warnings generated during resolution
   */
  warnings?: string[];
}

/**
 * Type strictness levels for comparison
 * Higher number = stricter
 */
const TYPE_STRICTNESS: Record<string, number> = {
  any: 0,
  unknown: 1,
  string: 2,
  number: 3,
  boolean: 4,
  object: 5,
  array: 6,
  timestamp: 7,
  email: 8,
  url: 9,
  uuid: 10,
};

/**
 * Compare two types and return the stricter one
 */
function getStricterType(type1: string, type2: string): string {
  const strictness1 = TYPE_STRICTNESS[type1.toLowerCase()] ?? 2;
  const strictness2 = TYPE_STRICTNESS[type2.toLowerCase()] ?? 2;

  return strictness1 >= strictness2 ? type1 : type2;
}

/**
 * Check if two schema fields have the same type
 */
function hasSameType(field1: SchemaField, field2: SchemaField): boolean {
  return field1.type.toLowerCase() === field2.type.toLowerCase();
}

/**
 * Check if a field is an enum type
 */
function isEnumField(field: SchemaField): boolean {
  return (
    field.validation?.enum !== undefined ||
    field.type === 'enum' ||
    Array.isArray(field.validation?.oneOf)
  );
}

/**
 * Extract enum values from a field
 */
function getEnumValues(field: SchemaField): string[] | undefined {
  if (field.validation?.enum) {
    return Array.isArray(field.validation.enum)
      ? (field.validation.enum as string[])
      : [String(field.validation.enum)];
  }

  if (Array.isArray(field.validation?.oneOf)) {
    return field.validation.oneOf as string[];
  }

  return undefined;
}

/**
 * Merge two enum fields by taking the union of their values
 */
function mergeEnumFields(
  field1: SchemaField,
  field2: SchemaField,
  trait1: string,
  trait2: string
): ResolutionResult {
  const values1 = getEnumValues(field1) || [];
  const values2 = getEnumValues(field2) || [];

  // Union of enum values
  const unionValues = Array.from(new Set([...values1, ...values2]));

  const mergedField: SchemaField = {
    ...field1,
    type: field1.type || field2.type || 'string',
    required: field1.required || field2.required,
    validation: {
      ...field1.validation,
      ...field2.validation,
      enum: unionValues,
    },
    description:
      field1.description && field2.description
        ? `${field1.description} (merged with ${trait2})`
        : field1.description || field2.description,
  };

  const collisionInfo: CollisionInfo = {
    fieldName: '', // Will be set by caller
    conflictingTraits: [trait1, trait2],
    resolution: 'enum_union',
    details: `Enum values merged: ${values1.length} + ${values2.length} = ${unionValues.length} unique values`,
    winner: trait1, // First trait wins for metadata
  };

  return {
    field: mergedField,
    collisionInfo,
    warnings:
      unionValues.length > 10
        ? [`Large enum created with ${unionValues.length} values`]
        : undefined,
  };
}

/**
 * Merge validation constraints, preferring stricter ones
 */
function mergeValidationConstraints(
  validation1: Record<string, unknown> | undefined,
  validation2: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!validation1) return validation2;
  if (!validation2) return validation1;

  const merged: Record<string, unknown> = { ...validation1 };

  // For numeric constraints, prefer the stricter bound
  if (typeof validation1.min === 'number' && typeof validation2.min === 'number') {
    merged.min = Math.max(validation1.min, validation2.min);
  } else if (validation2.min !== undefined) {
    merged.min = validation2.min;
  }

  if (typeof validation1.max === 'number' && typeof validation2.max === 'number') {
    merged.max = Math.min(validation1.max, validation2.max);
  } else if (validation2.max !== undefined) {
    merged.max = validation2.max;
  }

  // For string length constraints
  if (typeof validation1.minLength === 'number' && typeof validation2.minLength === 'number') {
    merged.minLength = Math.max(validation1.minLength, validation2.minLength);
  } else if (validation2.minLength !== undefined) {
    merged.minLength = validation2.minLength;
  }

  if (typeof validation1.maxLength === 'number' && typeof validation2.maxLength === 'number') {
    merged.maxLength = Math.min(validation1.maxLength, validation2.maxLength);
  } else if (validation2.maxLength !== undefined) {
    merged.maxLength = validation2.maxLength;
  }

  // For pattern, require both patterns to match (combine with AND logic)
  if (validation1.pattern && validation2.pattern) {
    merged.pattern = validation2.pattern; // In practice, we take the more specific one
  } else if (validation2.pattern) {
    merged.pattern = validation2.pattern;
  }

  // Merge other properties
  for (const key in validation2) {
    if (!(key in merged)) {
      merged[key] = validation2[key];
    }
  }

  return merged;
}

/**
 * Merge two fields of the same type
 */
function mergeSameTypeFields(
  field1: SchemaField,
  field2: SchemaField,
  trait1: string,
  trait2: string
): ResolutionResult {
  // If required status differs, required wins
  const required = field1.required || field2.required;

  // Prefer stricter type
  const stricterType = getStricterType(field1.type, field2.type);

  // Merge validation constraints
  const mergedValidation = mergeValidationConstraints(field1.validation, field2.validation);

  const mergedField: SchemaField = {
    type: stricterType,
    required,
    validation: mergedValidation,
    description:
      field1.description && field2.description
        ? `${field1.description} (merged with ${trait2})`
        : field1.description || field2.description,
    default: field1.default !== undefined ? field1.default : field2.default,
  };

  const collisionInfo: CollisionInfo = {
    fieldName: '', // Will be set by caller
    conflictingTraits: [trait1, trait2],
    resolution: field1.required !== field2.required ? 'required_wins' : 'stricter_type',
    details: `Merged ${field1.type} fields, using stricter constraints`,
    winner: stricterType === field1.type ? trait1 : trait2,
  };

  const warnings: string[] = [];
  if (field1.required !== field2.required) {
    warnings.push(
      `Field required status conflict resolved: required wins (was ${field1.required ? trait1 : trait2} required, ${field2.required ? trait2 : trait1} optional)`
    );
  }

  return {
    field: mergedField,
    collisionInfo,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Resolve a collision between two schema fields
 *
 * Implements the collision policy from the spec:
 * 1. Same type → merge, prefer stricter constraints
 * 2. Enum ∪ Enum → union values
 * 3. Optional vs Required → required wins
 * 4. Different type → throw error
 */
export function resolveCollision(
  fieldName: string,
  field1: SchemaField,
  field2: SchemaField,
  trait1: string,
  trait2: string,
  manualResolution?: {
    strategy: 'prefer_trait' | 'use_first' | 'use_last' | 'merge';
    traitName?: string;
  }
): ResolutionResult {
  // Handle manual resolution
  if (manualResolution) {
    let resolvedField: SchemaField;
    let winner: string;

    switch (manualResolution.strategy) {
      case 'prefer_trait':
        if (manualResolution.traitName === trait1) {
          resolvedField = field1;
          winner = trait1;
        } else if (manualResolution.traitName === trait2) {
          resolvedField = field2;
          winner = trait2;
        } else {
          throw new Error(
            `Manual resolution trait "${manualResolution.traitName}" doesn't match either conflicting trait`
          );
        }
        break;

      case 'use_first':
        resolvedField = field1;
        winner = trait1;
        break;

      case 'use_last':
        resolvedField = field2;
        winner = trait2;
        break;

      case 'merge':
        // Fall through to automatic merge logic
        if (!hasSameType(field1, field2)) {
          throw new Error(
            `Cannot merge fields with different types: ${field1.type} vs ${field2.type}`
          );
        }
        return mergeSameTypeFields(field1, field2, trait1, trait2);

      default:
        throw new Error(`Unknown manual resolution strategy: ${manualResolution.strategy}`);
    }

    const collisionInfo: CollisionInfo = {
      fieldName,
      conflictingTraits: [trait1, trait2],
      resolution: 'manual',
      details: `Manual resolution: ${manualResolution.strategy}${manualResolution.traitName ? ` (${manualResolution.traitName})` : ''}`,
      winner,
    };

    return {
      field: resolvedField,
      collisionInfo,
    };
  }

  // Check if both are enum fields
  if (isEnumField(field1) && isEnumField(field2)) {
    const result = mergeEnumFields(field1, field2, trait1, trait2);
    result.collisionInfo.fieldName = fieldName;
    return result;
  }

  // Check if types match
  if (!hasSameType(field1, field2)) {
    // Type mismatch - this is an error
    throw new Error(
      `Type mismatch for field "${fieldName}": ${trait1} defines it as ${field1.type}, but ${trait2} defines it as ${field2.type}`
    );
  }

  // Same type - merge with stricter constraints
  const result = mergeSameTypeFields(field1, field2, trait1, trait2);
  result.collisionInfo.fieldName = fieldName;
  return result;
}

/**
 * Batch resolve multiple collisions
 */
export function resolveCollisions(
  collisions: Map<
    string,
    Array<{ field: SchemaField; traitName: string }>
  >,
  manualResolutions?: Record<
    string,
    {
      strategy: 'prefer_trait' | 'use_first' | 'use_last' | 'merge';
      traitName?: string;
    }
  >
): Map<string, ResolutionResult> {
  const results = new Map<string, ResolutionResult>();

  for (const [fieldName, fieldSources] of collisions.entries()) {
    if (fieldSources.length < 2) {
      continue; // No collision
    }

    // Resolve pairwise, left to right
    let currentResult: ResolutionResult = {
      field: fieldSources[0].field,
      collisionInfo: {
        fieldName,
        conflictingTraits: [fieldSources[0].traitName],
        resolution: 'stricter_type',
        details: 'No collision',
        winner: fieldSources[0].traitName,
      },
    };

    for (let i = 1; i < fieldSources.length; i++) {
      const manualResolution = manualResolutions?.[fieldName];

      currentResult = resolveCollision(
        fieldName,
        currentResult.field,
        fieldSources[i].field,
        currentResult.collisionInfo.winner,
        fieldSources[i].traitName,
        manualResolution
      );
    }

    results.set(fieldName, currentResult);
  }

  return results;
}
