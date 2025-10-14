/**
 * Type Generator
 *
 * Generates TypeScript type definitions from trait parameter definitions
 * using the 'as const' tuple pattern validated in Research R1.
 *
 * Key principles:
 * - Uses 'as const' assertions for exact literal type preservation
 * - Generates readonly tuples for parameter arrays
 * - Derives union types using (typeof X)[number] pattern
 * - Produces zero-runtime-overhead types
 */

import type { TraitDefinition, TraitParameter } from '../core/trait-definition';

/**
 * Options for type generation
 */
export interface TypeGeneratorOptions {
  /**
   * Include JSDoc comments in generated output
   * @default true
   */
  includeComments?: boolean;

  /**
   * Export generated types
   * @default true
   */
  exportTypes?: boolean;

  /**
   * Generate human-readable formatting
   * @default true
   */
  formatted?: boolean;

  /**
   * Namespace prefix for generated types (to avoid collisions)
   */
  namespace?: string;
}

/**
 * Result of type generation
 */
export interface GeneratedType {
  /**
   * The generated TypeScript code
   */
  code: string;

  /**
   * Type names that were generated
   */
  typeNames: string[];

  /**
   * Constant names that were generated
   */
  constantNames: string[];
}

/**
 * Extract parameters from a trait definition
 */
export function extractParameters(trait: TraitDefinition): TraitParameter[] {
  return trait.parameters || [];
}

/**
 * Check if a trait has any parameters that need type generation
 */
export function hasGeneratableParameters(trait: TraitDefinition): boolean {
  const params = extractParameters(trait);
  return params.some((p) => p.type === 'enum' || p.type === 'string[]' || p.type === 'number[]');
}

/**
 * Generate a type-safe constant name from a parameter name
 */
export function generateConstantName(
  traitName: string,
  parameterName: string,
  namespace?: string
): string {
  const baseName = `${traitName}${capitalize(parameterName)}`;
  return namespace ? `${namespace}_${baseName}` : baseName;
}

/**
 * Generate a type name from a parameter name
 */
export function generateTypeName(
  traitName: string,
  parameterName: string,
  namespace?: string
): string {
  const baseName = `${traitName}${capitalize(parameterName)}`;
  return namespace ? `${namespace}_${baseName}` : baseName;
}

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a 'as const' array declaration for enum parameters
 */
export function generateConstArray(
  constantName: string,
  values: readonly string[] | readonly number[],
  options: TypeGeneratorOptions = {}
): string {
  const { includeComments = true, exportTypes = true, formatted = true } = options;

  const exportKeyword = exportTypes ? 'export ' : '';
  const indent = formatted ? '  ' : '';
  const newline = formatted ? '\n' : '';

  // Format the array values
  const formattedValues = values
    .map((v) => {
      if (typeof v === 'string') {
        return `${indent}"${v}"`;
      }
      return `${indent}${v}`;
    })
    .join(`,${newline}`);

  let code = '';

  if (includeComments) {
    code += `/**${newline}`;
    code += ` * Allowed values for ${constantName}${newline}`;
    code += ` */${newline}`;
  }

  if (formatted) {
    code += `${exportKeyword}const ${constantName} = [${newline}`;
    code += formattedValues;
    code += `${newline}] as const;${newline}`;
  } else {
    const compactValues = values
      .map((v) => (typeof v === 'string' ? `"${v}"` : String(v)))
      .join(', ');
    code += `${exportKeyword}const ${constantName} = [${compactValues}] as const;`;
  }

  return code;
}

/**
 * Generate a union type derived from a const array
 */
export function generateUnionType(
  typeName: string,
  constantName: string,
  options: TypeGeneratorOptions = {}
): string {
  const { includeComments = true, exportTypes = true, formatted = true } = options;

  const exportKeyword = exportTypes ? 'export ' : '';
  const newline = formatted ? '\n' : '';

  let code = '';

  if (includeComments) {
    code += `${newline}/**${newline}`;
    code += ` * Union type derived from ${constantName}${newline}`;
    code += ` */${newline}`;
  }

  code += `${exportKeyword}type ${typeName} = (typeof ${constantName})[number];`;

  return code;
}

/**
 * Generate TypeScript types for a single trait parameter
 */
export function generateParameterType(
  trait: TraitDefinition,
  parameter: TraitParameter,
  options: TypeGeneratorOptions = {}
): GeneratedType | null {
  const traitName = trait.trait.name;

  // Only generate types for enum and array parameters
  if (parameter.type === 'enum') {
    if (!parameter.enumValues || parameter.enumValues.length === 0) {
      return null;
    }

    const constantName = generateConstantName(traitName, parameter.name, options.namespace);
    const typeName = generateTypeName(traitName, parameter.name, options.namespace);

    const constArray = generateConstArray(constantName, parameter.enumValues, options);
    const unionType = generateUnionType(typeName, constantName, options);

    return {
      code: constArray + unionType,
      typeNames: [typeName],
      constantNames: [constantName],
    };
  }

  if (parameter.type === 'string[]' && Array.isArray(parameter.default)) {
    const constantName = generateConstantName(traitName, parameter.name, options.namespace);
    const typeName = generateTypeName(traitName, parameter.name, options.namespace);

    const constArray = generateConstArray(constantName, parameter.default as string[], options);
    const unionType = generateUnionType(typeName, constantName, options);

    return {
      code: constArray + unionType,
      typeNames: [typeName],
      constantNames: [constantName],
    };
  }

  if (parameter.type === 'number[]' && Array.isArray(parameter.default)) {
    const constantName = generateConstantName(traitName, parameter.name, options.namespace);
    const typeName = generateTypeName(traitName, parameter.name, options.namespace);

    const constArray = generateConstArray(constantName, parameter.default as number[], options);
    const unionType = generateUnionType(typeName, constantName, options);

    return {
      code: constArray + unionType,
      typeNames: [typeName],
      constantNames: [constantName],
    };
  }

  // No type generation needed for simple types
  return null;
}

/**
 * Generate TypeScript types for all parameters in a trait
 */
export function generateTraitTypes(
  trait: TraitDefinition,
  options: TypeGeneratorOptions = {}
): GeneratedType {
  const parameters = extractParameters(trait);
  const { formatted = true } = options;
  const newline = formatted ? '\n' : '';

  let code = '';
  const typeNames: string[] = [];
  const constantNames: string[] = [];

  // Generate file header
  code += `/**${newline}`;
  code += ` * Generated types for ${trait.trait.name} trait${newline}`;
  code += ` *${newline}`;
  code += ` * DO NOT EDIT - This file is auto-generated${newline}`;
  code += ` * Generated from: ${trait.trait.name} v${trait.trait.version}${newline}`;
  if (trait.trait.description) {
    code += ` *${newline}`;
    code += ` * ${trait.trait.description}${newline}`;
  }
  code += ` */${newline}${newline}`;

  // Generate types for each parameter
  for (const parameter of parameters) {
    const result = generateParameterType(trait, parameter, options);
    if (result) {
      code += result.code + newline;
      typeNames.push(...result.typeNames);
      constantNames.push(...result.constantNames);
    }
  }

  return {
    code,
    typeNames,
    constantNames,
  };
}

/**
 * Generate a .d.ts file content for a trait
 */
export function generateDeclarationFile(
  trait: TraitDefinition,
  options: TypeGeneratorOptions = {}
): string {
  const result = generateTraitTypes(trait, {
    ...options,
    exportTypes: true,
    formatted: true,
  });

  return result.code;
}
