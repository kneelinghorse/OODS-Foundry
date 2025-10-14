/**
 * YAML Trait Parser
 *
 * Parses YAML trait definition files into validated TraitDefinition objects.
 * Provides detailed error messages with file and line number information.
 */

import { load as yamlLoad } from 'js-yaml';
import { readFileSync } from 'fs';
import type {
  TraitDefinition,
  ParseResult,
  ParseError,
} from '../core/trait-definition';

/**
 * Parse a YAML trait definition from a file path
 */
export function parseYamlTraitFromFile(filePath: string): ParseResult<TraitDefinition> {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    return parseYamlTrait(fileContent, filePath);
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          code: 'FILE_READ_ERROR',
        },
      ],
    };
  }
}

/**
 * Parse a YAML trait definition from a string
 */
export function parseYamlTrait(
  content: string,
  filePath?: string
): ParseResult<TraitDefinition> {
  const errors: ParseError[] = [];

  try {
    // Parse YAML with line number tracking
    const parsed = yamlLoad(content, {
      filename: filePath,
      onWarning: (warning) => {
        errors.push({
          message: warning.message,
          file: filePath,
          line: warning.mark?.line,
          column: warning.mark?.column,
          code: 'YAML_WARNING',
        });
      },
    });

    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        errors: [
          {
            message: 'Invalid YAML: Expected an object at root level',
            file: filePath,
            code: 'INVALID_ROOT',
          },
        ],
      };
    }

    const traitDef = parsed as Record<string, unknown>;

    // Validate required top-level keys
    const validationErrors = validateTraitStructure(traitDef, filePath);
    errors.push(...validationErrors);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    // Transform to TraitDefinition
    const definition = transformToTraitDefinition(traitDef);

    return {
      success: true,
      data: definition,
    };
  } catch (error) {
    const yamlError = error as { mark?: { line: number; column: number } };
    return {
      success: false,
      errors: [
        {
          message: `YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          line: yamlError.mark?.line,
          column: yamlError.mark?.column,
          code: 'YAML_PARSE_ERROR',
        },
      ],
    };
  }
}

/**
 * Validate the structure of a trait definition
 */
function validateTraitStructure(
  obj: Record<string, unknown>,
  filePath?: string
): ParseError[] {
  const errors: ParseError[] = [];

  // Check required top-level keys
  if (!obj.trait) {
    errors.push({
      message: 'Missing required field: "trait"',
      file: filePath,
      field: 'trait',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (typeof obj.trait !== 'object' || obj.trait === null) {
    errors.push({
      message: 'Field "trait" must be an object',
      file: filePath,
      field: 'trait',
      code: 'INVALID_FIELD_TYPE',
    });
  } else {
    // Validate trait metadata
    const trait = obj.trait as Record<string, unknown>;
    if (!trait.name || typeof trait.name !== 'string') {
      errors.push({
        message: 'Field "trait.name" is required and must be a string',
        file: filePath,
        field: 'trait.name',
        code: 'MISSING_REQUIRED_FIELD',
      });
    }
    if (!trait.version || typeof trait.version !== 'string') {
      errors.push({
        message: 'Field "trait.version" is required and must be a string',
        file: filePath,
        field: 'trait.version',
        code: 'MISSING_REQUIRED_FIELD',
      });
    }
  }

  if (!obj.schema) {
    errors.push({
      message: 'Missing required field: "schema"',
      file: filePath,
      field: 'schema',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (typeof obj.schema !== 'object' || obj.schema === null) {
    errors.push({
      message: 'Field "schema" must be an object',
      file: filePath,
      field: 'schema',
      code: 'INVALID_FIELD_TYPE',
    });
  }

  // Validate optional fields have correct types
  if (obj.parameters !== undefined) {
    if (!Array.isArray(obj.parameters)) {
      errors.push({
        message: 'Field "parameters" must be an array',
        file: filePath,
        field: 'parameters',
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  if (obj.semantics !== undefined) {
    if (typeof obj.semantics !== 'object' || obj.semantics === null) {
      errors.push({
        message: 'Field "semantics" must be an object',
        file: filePath,
        field: 'semantics',
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  if (obj.view_extensions !== undefined) {
    if (typeof obj.view_extensions !== 'object' || obj.view_extensions === null) {
      errors.push({
        message: 'Field "view_extensions" must be an object',
        file: filePath,
        field: 'view_extensions',
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  if (obj.tokens !== undefined) {
    if (typeof obj.tokens !== 'object' || obj.tokens === null) {
      errors.push({
        message: 'Field "tokens" must be an object',
        file: filePath,
        field: 'tokens',
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  if (obj.dependencies !== undefined) {
    if (!Array.isArray(obj.dependencies)) {
      errors.push({
        message: 'Field "dependencies" must be an array',
        file: filePath,
        field: 'dependencies',
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  if (obj.actions !== undefined) {
    if (!Array.isArray(obj.actions)) {
      errors.push({
        message: 'Field "actions" must be an array',
        file: filePath,
        field: 'actions',
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  if (obj.state_machine !== undefined) {
    if (typeof obj.state_machine !== 'object' || obj.state_machine === null) {
      errors.push({
        message: 'Field "state_machine" must be an object',
        file: filePath,
        field: 'state_machine',
        code: 'INVALID_FIELD_TYPE',
      });
    } else {
      const sm = obj.state_machine as Record<string, unknown>;
      if (!Array.isArray(sm.states) || sm.states.length === 0) {
        errors.push({
          message: 'Field "state_machine.states" must be a non-empty array',
          file: filePath,
          field: 'state_machine.states',
          code: 'INVALID_FIELD_VALUE',
        });
      }
      if (!sm.initial || typeof sm.initial !== 'string') {
        errors.push({
          message: 'Field "state_machine.initial" is required and must be a string',
          file: filePath,
          field: 'state_machine.initial',
          code: 'MISSING_REQUIRED_FIELD',
        });
      }
      if (!Array.isArray(sm.transitions)) {
        errors.push({
          message: 'Field "state_machine.transitions" must be an array',
          file: filePath,
          field: 'state_machine.transitions',
          code: 'INVALID_FIELD_TYPE',
        });
      }
    }
  }

  return errors;
}

/**
 * Transform parsed YAML object to TraitDefinition
 */
function transformToTraitDefinition(obj: Record<string, unknown>): TraitDefinition {
  return {
    trait: obj.trait as TraitDefinition['trait'],
    parameters: obj.parameters as TraitDefinition['parameters'],
    schema: obj.schema as TraitDefinition['schema'],
    semantics: obj.semantics as TraitDefinition['semantics'],
    view_extensions: obj.view_extensions as TraitDefinition['view_extensions'],
    tokens: obj.tokens as TraitDefinition['tokens'],
    dependencies: obj.dependencies as TraitDefinition['dependencies'],
    actions: obj.actions as TraitDefinition['actions'],
    state_machine: obj.state_machine as TraitDefinition['state_machine'],
    metadata: obj.metadata as TraitDefinition['metadata'],
  };
}

/**
 * Extract parameter definitions from a parameterized trait
 */
export function extractParameters(definition: TraitDefinition): string[] {
  if (!definition.parameters || definition.parameters.length === 0) {
    return [];
  }

  return definition.parameters.map((param) => param.name);
}
