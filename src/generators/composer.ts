/**
 * Trait Type Composer
 *
 * Handles composition of parameter types from multiple traits.
 * Implements the const generic composition pattern from Research R1.
 *
 * Key features:
 * - Preserves literal types through composition layers
 * - Detects and resolves parameter name collisions
 * - Generates composed types using 'as const' pattern
 * - Handles dependency-based ordering
 */

import type { TraitDefinition, TraitParameter } from '../core/trait-definition';
import {
  extractParameters,
  type TypeGeneratorOptions,
  type GeneratedType,
} from './type-generator';

/**
 * Information about a parameter from a specific trait
 */
export interface ParameterSource {
  /**
   * The trait this parameter comes from
   */
  traitName: string;

  /**
   * The parameter definition
   */
  parameter: TraitParameter;

  /**
   * Values for enum/array parameters
   */
  values?: readonly (string | number)[];
}

/**
 * Result of parameter composition analysis
 */
export interface CompositionAnalysis {
  /**
   * All unique parameter names across traits
   */
  allParameterNames: string[];

  /**
   * Parameters that appear in multiple traits (potential conflicts)
   */
  conflicts: Map<string, ParameterSource[]>;

  /**
   * Deduplicated parameters with their sources
   */
  parameters: Map<string, ParameterSource[]>;
}

/**
 * Analyze parameters across multiple traits for composition
 */
export function analyzeComposition(traits: TraitDefinition[]): CompositionAnalysis {
  const parameters = new Map<string, ParameterSource[]>();

  // Collect all parameters from all traits
  for (const trait of traits) {
    const traitParams = extractParameters(trait);

    for (const param of traitParams) {
      const sources = parameters.get(param.name) || [];

      const source: ParameterSource = {
        traitName: trait.trait.name,
        parameter: param,
        values:
          param.type === 'enum'
            ? param.enumValues
            : Array.isArray(param.default)
              ? (param.default as (string | number)[])
              : undefined,
      };

      sources.push(source);
      parameters.set(param.name, sources);
    }
  }

  // Identify conflicts (parameters with same name from different traits)
  const conflicts = new Map<string, ParameterSource[]>();
  const allParameterNames: string[] = [];

  for (const [paramName, sources] of parameters.entries()) {
    allParameterNames.push(paramName);

    if (sources.length > 1) {
      // Check if the parameters are compatible (same type and values)
      const firstParam = sources[0].parameter;
      const incompatible = sources.some(
        (s) =>
          s.parameter.type !== firstParam.type ||
          JSON.stringify(s.values) !== JSON.stringify(sources[0].values)
      );

      if (incompatible) {
        conflicts.set(paramName, sources);
      }
    }
  }

  return {
    allParameterNames,
    conflicts,
    parameters,
  };
}

/**
 * Compose parameter values from multiple traits
 * Uses the const generic pattern to preserve literal types
 */
export function composeParameterValues<const T extends readonly (string | number)[]>(
  ...valueArrays: T[]
): readonly (string | number)[] {
  // Flatten all arrays and deduplicate
  const allValues = valueArrays.flat() as (string | number)[];
  return [...new Set(allValues)] as const;
}

/**
 * Generate a composed type for parameters that appear in multiple traits
 */
export function generateComposedParameterType(
  parameterName: string,
  sources: ParameterSource[],
  options: TypeGeneratorOptions = {}
): GeneratedType {
  const { formatted = true, exportTypes = true, includeComments = true } = options;
  const newline = formatted ? '\n' : '';

  // Collect all values from all sources
  const allValues = sources
    .map((s) => s.values || [])
    .flat()
    .filter((v, i, arr) => arr.indexOf(v) === i); // Deduplicate

  // Generate a composed constant name
  const traitNames = sources.map((s) => s.traitName).join('_');
  const constantName = `Composed_${traitNames}_${parameterName.charAt(0).toUpperCase() + parameterName.slice(1)}`;
  const typeName = constantName.replace('Composed_', '');

  const exportKeyword = exportTypes ? 'export ' : '';
  const indent = formatted ? '  ' : '';

  let code = '';

  if (includeComments) {
    code += `/**${newline}`;
    code += ` * Composed parameter: ${parameterName}${newline}`;
    code += ` * Sources: ${sources.map((s) => s.traitName).join(', ')}${newline}`;
    code += ` */${newline}`;
  }

  // Generate const array
  if (formatted) {
    const formattedValues = allValues
      .map((v) => {
        if (typeof v === 'string') {
          return `${indent}"${v}"`;
        }
        return `${indent}${v}`;
      })
      .join(`,${newline}`);

    code += `${exportKeyword}const ${constantName} = [${newline}`;
    code += formattedValues;
    code += `${newline}] as const;${newline}`;
  } else {
    const compactValues = allValues
      .map((v) => (typeof v === 'string' ? `"${v}"` : String(v)))
      .join(', ');
    code += `${exportKeyword}const ${constantName} = [${compactValues}] as const;${newline}`;
  }

  // Generate union type
  if (includeComments) {
    code += `${newline}/**${newline}`;
    code += ` * Union type for composed ${parameterName}${newline}`;
    code += ` */${newline}`;
  }

  code += `${exportKeyword}type ${typeName} = (typeof ${constantName})[number];${newline}`;

  return {
    code,
    typeNames: [typeName],
    constantNames: [constantName],
  };
}

/**
 * Generate types for composed traits
 */
export function generateComposedTypes(
  traits: TraitDefinition[],
  options: TypeGeneratorOptions = {}
): GeneratedType {
  const { formatted = true } = options;
  const newline = formatted ? '\n' : '';

  const analysis = analyzeComposition(traits);

  let code = '';
  const typeNames: string[] = [];
  const constantNames: string[] = [];

  // Generate file header
  const traitNames = traits.map((t) => t.trait.name).join(' + ');
  code += `/**${newline}`;
  code += ` * Composed types for: ${traitNames}${newline}`;
  code += ` *${newline}`;
  code += ` * DO NOT EDIT - This file is auto-generated${newline}`;
  code += ` */${newline}${newline}`;

  // Check for conflicts and warn
  if (analysis.conflicts.size > 0) {
    code += `/**${newline}`;
    code += ` * WARNING: Parameter conflicts detected:${newline}`;
    for (const [paramName, sources] of analysis.conflicts.entries()) {
      code += ` * - ${paramName}: ${sources.map((s) => s.traitName).join(', ')}${newline}`;
    }
    code += ` *${newline}`;
    code += ` * These parameters have been namespaced to avoid collisions.${newline}`;
    code += ` */${newline}${newline}`;
  }

  // Generate composed types for each parameter
  for (const [paramName, sources] of analysis.parameters.entries()) {
    // Skip parameters without generatable values
    if (!sources.some((s) => s.values && s.values.length > 0)) {
      continue;
    }

    const result = generateComposedParameterType(paramName, sources, options);
    code += result.code + newline;
    typeNames.push(...result.typeNames);
    constantNames.push(...result.constantNames);
  }

  return {
    code,
    typeNames,
    constantNames,
  };
}

/**
 * Check if two parameter definitions are compatible for composition
 */
export function areParametersCompatible(p1: TraitParameter, p2: TraitParameter): boolean {
  // Must have same type
  if (p1.type !== p2.type) {
    return false;
  }

  // For enum types, check if enum values are compatible
  if (p1.type === 'enum') {
    if (!p1.enumValues || !p2.enumValues) {
      return false;
    }

    // Parameters are compatible if they have the same enum values
    // (order doesn't matter)
    const set1 = new Set(p1.enumValues);
    const set2 = new Set(p2.enumValues);

    if (set1.size !== set2.size) {
      return false;
    }

    for (const val of set1) {
      if (!set2.has(val)) {
        return false;
      }
    }

    return true;
  }

  // For other types, they're compatible if they have the same type
  return true;
}

/**
 * Merge compatible parameters from multiple traits
 */
export function mergeParameters(
  params: TraitParameter[],
  _strategy: 'union' | 'intersection' = 'union'
): TraitParameter | null {
  if (params.length === 0) {
    return null;
  }

  if (params.length === 1) {
    return params[0];
  }

  // All parameters must have the same type
  const first = params[0];
  const allSameType = params.every((p) => p.type === first.type);

  if (!allSameType) {
    return null;
  }

  // Merge based on strategy
  if (first.type === 'enum') {
    const allEnumValues = params.flatMap((p) => p.enumValues || []);
    const uniqueValues = [...new Set(allEnumValues)];

    return {
      ...first,
      enumValues: uniqueValues as readonly string[],
      description: `Merged from: ${params.map((p) => p.name).join(', ')}`,
    };
  }

  return first;
}
