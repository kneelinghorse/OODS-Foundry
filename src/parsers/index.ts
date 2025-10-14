/**
 * Unified Trait Parser
 *
 * Provides a single interface for parsing trait definitions from both YAML and TypeScript files.
 * Automatically detects the file format and uses the appropriate parser.
 */

import { extname } from 'path';
import type {
  TraitDefinition,
  ParseResult,
} from '../core/trait-definition';
import { parseYamlTrait, parseYamlTraitFromFile } from './yaml-parser';
import { parseTypeScriptTrait, parseTypeScriptTraitSync } from './ts-parser';
// Object parser imports (used in re-exports below)
import {
  parseObjectDefinition,
  parseObjectDefinitionFromFile,
} from './object-parser';
// Type imports are used in re-exports below

/**
 * Supported trait file formats
 */
export type TraitFileFormat = 'yaml' | 'typescript' | 'unknown';

/**
 * Detect the format of a trait file based on its extension
 */
export function detectTraitFormat(filePath: string): TraitFileFormat {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    default:
      return 'unknown';
  }
}

/**
 * Parse a trait definition file (auto-detects format)
 *
 * Asynchronous version that supports both YAML and TypeScript files.
 * For TypeScript files, uses dynamic import.
 */
export async function parseTrait(filePath: string): Promise<ParseResult<TraitDefinition>> {
  const format = detectTraitFormat(filePath);

  switch (format) {
    case 'yaml':
      return parseYamlTraitFromFile(filePath);

    case 'typescript':
      return await parseTypeScriptTrait(filePath);

    case 'unknown':
      return {
        success: false,
        errors: [
          {
            message: `Unsupported file format: ${extname(filePath)}. Supported formats: .yaml, .yml, .ts`,
            file: filePath,
            code: 'UNSUPPORTED_FORMAT',
          },
        ],
      };
  }
}

/**
 * Parse a trait definition file synchronously (auto-detects format)
 *
 * Note: TypeScript parsing in sync mode has limitations.
 * Prefer the async version when possible.
 */
export function parseTraitSync(filePath: string): ParseResult<TraitDefinition> {
  const format = detectTraitFormat(filePath);

  switch (format) {
    case 'yaml':
      return parseYamlTraitFromFile(filePath);

    case 'typescript':
      return parseTypeScriptTraitSync(filePath);

    case 'unknown':
      return {
        success: false,
        errors: [
          {
            message: `Unsupported file format: ${extname(filePath)}. Supported formats: .yaml, .yml, .ts`,
            file: filePath,
            code: 'UNSUPPORTED_FORMAT',
          },
        ],
      };
  }
}

/**
 * Parse multiple trait definition files
 *
 * Returns an array of parse results, one for each file.
 * Continues parsing all files even if some fail.
 */
export async function parseTraits(
  filePaths: string[]
): Promise<ParseResult<TraitDefinition>[]> {
  const results = await Promise.all(filePaths.map((path) => parseTrait(path)));
  return results;
}

/**
 * Parse multiple trait definition files and filter successful results
 *
 * Returns only the successfully parsed trait definitions.
 * Errors are logged but not returned.
 */
export async function parseTraitsSuccessful(
  filePaths: string[],
  onError?: (filePath: string, errors: ParseResult<TraitDefinition>['errors']) => void
): Promise<TraitDefinition[]> {
  const results = await parseTraits(filePaths);

  const successful: TraitDefinition[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const filePath = filePaths[i];

    if (result.success && result.data) {
      successful.push(result.data);
    } else if (onError) {
      onError(filePath, result.errors);
    }
  }

  return successful;
}

/**
 * Parse a trait definition from a string with explicit format
 */
export async function parseTraitFromString(
  content: string,
  format: 'yaml' | 'typescript',
  filePath?: string
): Promise<ParseResult<TraitDefinition>> {
  switch (format) {
    case 'yaml':
      return parseYamlTrait(content, filePath);

    case 'typescript':
      return {
        success: false,
        errors: [
          {
            message: 'TypeScript parsing from string is not supported. Use file-based parsing.',
            code: 'UNSUPPORTED_OPERATION',
          },
        ],
      };
  }
}

// Re-export parser functions for direct use
export { parseYamlTrait, parseYamlTraitFromFile } from './yaml-parser';
export { parseTypeScriptTrait, parseTypeScriptTraitSync } from './ts-parser';
export { parseObjectDefinition, parseObjectDefinitionFromFile };

// Re-export core types
export type {
  TraitDefinition,
  ParseResult,
  ParseError,
  TraitMetadata,
  TraitParameter,
  SchemaField,
  SemanticMapping,
  ViewExtension,
  TraitAction,
  StateMachine,
  TokenDefinition,
  TraitDependency,
} from '../core/trait-definition';
export type {
  ObjectDefinition,
  ObjectParseResult,
  ObjectParseError,
  ObjectMetadata,
  TraitReference as ObjectTraitReference,
  ObjectResolutions,
  ObjectAdditionalMetadata,
} from '../registry/object-definition';
