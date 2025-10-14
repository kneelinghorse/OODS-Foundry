/**
 * TypeScript Trait Parser
 *
 * Parses TypeScript module trait definitions into validated TraitDefinition objects.
 * Supports importing .ts modules that export default TraitDefinition objects.
 */

import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import vm from 'node:vm';
import type {
  TraitDefinition,
  ParseResult,
  ParseError,
} from '../core/trait-definition';
import { isTraitDefinition } from '../core/trait-definition';

/**
 * Parse a TypeScript trait definition from a file path
 *
 * The TypeScript file must export a default object that conforms to TraitDefinition.
 * Uses dynamic import to load the module.
 */
export async function parseTypeScriptTrait(
  filePath: string
): Promise<ParseResult<TraitDefinition>> {
  const errors: ParseError[] = [];

  try {
    // Convert file path to file URL for dynamic import
    const fileUrl = pathToFileURL(filePath).href;

    // Dynamic import the TypeScript module
    const module = await import(fileUrl);

    if (!module.default) {
      return {
        success: false,
        errors: [
          {
            message: 'TypeScript trait file must export a default object',
            file: filePath,
            code: 'MISSING_DEFAULT_EXPORT',
          },
        ],
      };
    }

    const traitDef = module.default;

    // Validate the structure
    const validationErrors = validateTypeScriptTrait(traitDef, filePath);
    errors.push(...validationErrors);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    // Type check using type guard
    if (!isTraitDefinition(traitDef)) {
      return {
        success: false,
        errors: [
          {
            message: 'Exported object does not conform to TraitDefinition interface',
            file: filePath,
            code: 'INVALID_TRAIT_DEFINITION',
          },
        ],
      };
    }

    return {
      success: true,
      data: traitDef,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          message: `Failed to import TypeScript module: ${
            error instanceof Error ? error.message : String(error)
          }`,
          file: filePath,
          code: 'MODULE_IMPORT_ERROR',
        },
      ],
    };
  }
}

/**
 * Validate a TypeScript trait definition object
 */
function validateTypeScriptTrait(
  obj: unknown,
  filePath?: string
): ParseError[] {
  const errors: ParseError[] = [];

  if (!obj || typeof obj !== 'object') {
    errors.push({
      message: 'Default export must be an object',
      file: filePath,
      code: 'INVALID_EXPORT_TYPE',
    });
    return errors;
  }

  const traitDef = obj as Record<string, unknown>;

  // Check required top-level keys
  if (!traitDef.trait) {
    errors.push({
      message: 'Missing required field: "trait"',
      file: filePath,
      field: 'trait',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (typeof traitDef.trait !== 'object' || traitDef.trait === null) {
    errors.push({
      message: 'Field "trait" must be an object',
      file: filePath,
      field: 'trait',
      code: 'INVALID_FIELD_TYPE',
    });
  } else {
    // Validate trait metadata
    const trait = traitDef.trait as Record<string, unknown>;
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

  if (!traitDef.schema) {
    errors.push({
      message: 'Missing required field: "schema"',
      file: filePath,
      field: 'schema',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (typeof traitDef.schema !== 'object' || traitDef.schema === null) {
    errors.push({
      message: 'Field "schema" must be an object',
      file: filePath,
      field: 'schema',
      code: 'INVALID_FIELD_TYPE',
    });
  }

  // Validate optional array fields
  const arrayFields = ['parameters', 'dependencies', 'actions'];
  for (const field of arrayFields) {
    if (
      traitDef[field] !== undefined &&
      !Array.isArray(traitDef[field])
    ) {
      errors.push({
        message: `Field "${field}" must be an array`,
        file: filePath,
        field,
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  // Validate optional object fields
  const objectFields = ['semantics', 'view_extensions', 'tokens', 'state_machine', 'metadata'];
  for (const field of objectFields) {
    if (
      traitDef[field] !== undefined &&
      (typeof traitDef[field] !== 'object' || traitDef[field] === null)
    ) {
      errors.push({
        message: `Field "${field}" must be an object`,
        file: filePath,
        field,
        code: 'INVALID_FIELD_TYPE',
      });
    }
  }

  // Validate state machine structure if present
  if (traitDef.state_machine) {
    const sm = traitDef.state_machine as Record<string, unknown>;

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

  return errors;
}

/**
 * Extract parameter definitions from a parameterized trait using 'as const' pattern
 *
 * This function looks for parameters defined using the TypeScript 'as const' pattern
 * which provides type-safe parameter definitions (Research R1).
 */
export function extractTypeScriptParameters(definition: TraitDefinition): string[] {
  if (!definition.parameters || definition.parameters.length === 0) {
    return [];
  }

  return definition.parameters.map((param) => param.name);
}

/**
 * Synchronous wrapper for parseTypeScriptTrait
 * Note: This requires the file to be pre-compiled or uses a synchronous loader
 * In practice, the async version should be preferred.
 */
export function parseTypeScriptTraitSync(filePath: string): ParseResult<TraitDefinition> {
  // For synchronous parsing, we need to use require() instead of import()
  // This only works with CommonJS modules or pre-compiled TypeScript
  try {
    // In ESM context, construct a CommonJS require
    const req = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let module: any = req(filePath);

    // If require returned an empty module (possible when package is ESM and the
    // target is a .js file), fall back to evaluating the file as CommonJS via vm
    // to extract module.exports
    const looksEmpty = module && typeof module === 'object' &&
      Object.keys(module).length === 0 && !('default' in module);
    if (looksEmpty) {
      const code = readFileSync(filePath, 'utf-8');
      const mod = { exports: {} as any };
      const wrapped = `(function (exports, require, module, __filename, __dirname) {\n${code}\n})`;
      const script = new vm.Script(wrapped, { filename: filePath });
      const fn = script.runInThisContext();
      fn(mod.exports, req, mod, filePath, dirname(filePath));
      // In this fallback, the user code assigned to module.exports; prefer that
      module = mod.exports;
    }
    
    // Support both ESM default export and CommonJS module.exports
    // For CommonJS (.cjs files), the trait is directly in module.exports
    // For ESM, it's in module.default
    const traitDef = (module && (module as any).default) || (module as any);

    const errors = validateTypeScriptTrait(traitDef, filePath);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    if (!isTraitDefinition(traitDef)) {
      return {
        success: false,
        errors: [
          {
            message: 'Exported object does not conform to TraitDefinition interface',
            file: filePath,
            code: 'INVALID_TRAIT_DEFINITION',
          },
        ],
      };
    }

    return {
      success: true,
      data: traitDef,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          message: `Failed to require TypeScript module: ${
            error instanceof Error ? error.message : String(error)
          }`,
          file: filePath,
          code: 'MODULE_REQUIRE_ERROR',
        },
      ],
    };
  }
}
