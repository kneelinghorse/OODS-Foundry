#!/usr/bin/env node

/**
 * CLI Command: validate
 *
 * Validates trait definitions using the hybrid validation pipeline (AJV + Zod).
 * Supports multiple output formats: text, JSON, and GitHub Actions annotations.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { load } from 'js-yaml';
import {
  ValidationPipeline,
  ValidationResult,
  ValidationIssue,
  formatAsText,
  formatAsJson,
  formatAsGitHubAnnotations,
  ErrorCodes,
} from '../validation/index.js';

interface CLIOptions {
  path?: string;
  format?: 'text' | 'json' | 'github';
  verbose?: boolean;
  noColor?: boolean;
  showHints?: boolean;
  showCodes?: boolean;
  allErrors?: boolean;
}

const STRUCTURE_VALIDATOR = 'trait-structure';

/**
 * Recursively collect YAML files in a directory.
 */
function collectTraitFiles(dir: string): string[] {
  const files: string[] = [];

  const stats = statSync(dir);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${dir}`);
  }

  function scan(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && (extname(entry.name) === '.yaml' || extname(entry.name) === '.yml')) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

/**
 * Aggregate issues into a summary.
 */
function summarizeIssues(issues: ValidationIssue[]) {
  return issues.reduce(
    (acc, issue) => {
      if (issue.severity === 'error') {
        acc.errors += 1;
      } else if (issue.severity === 'warning') {
        acc.warnings += 1;
      } else if (issue.severity === 'info') {
        acc.info += 1;
      }
      return acc;
    },
    { errors: 0, warnings: 0, info: 0 }
  );
}

/**
 * Aggregate multiple validation results into a single result.
 */
function aggregateValidationResults(results: ValidationResult[]): ValidationResult {
  if (results.length === 0) {
    return {
      valid: true,
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    };
  }

  const issues = results.flatMap((result) => result.issues);
  const summary = summarizeIssues(issues);

  return {
    valid: summary.errors === 0,
    issues,
    summary,
  };
}

/**
 * Create a ValidationResult representing a failed parse.
 */
function createParseErrorResult(filePath: string, error: unknown): ValidationResult {
  const message = error instanceof Error ? error.message : String(error);

  const issue: ValidationIssue = {
    code: ErrorCodes.INVALID_TRAIT_FORMAT,
    message: 'Failed to parse trait file',
    location: { file: filePath, path: '/' },
    fixHint: 'Ensure the trait file is valid YAML and matches the expected structure',
    severity: 'error',
    details: message,
    source: 'cli',
    domain: 'trait',
    at: '/',
  };

  return {
    valid: false,
    issues: [issue],
    summary: { errors: 1, warnings: 0, info: 0 },
  };
}

/**
 * Create a ValidationResult representing an unreadable directory.
 */
function createDirectoryAccessErrorResult(dir: string, error: unknown): ValidationResult {
  const message = error instanceof Error ? error.message : String(error);

  const issue: ValidationIssue = {
    code: ErrorCodes.INVALID_TRAIT_FORMAT,
    message: `Unable to read traits directory: ${dir}`,
    location: { file: dir, path: '/' },
    fixHint: 'Verify the directory exists and that the path is correct',
    severity: 'error',
    details: message,
    source: 'cli',
    domain: 'infrastructure',
    at: '/',
  };

  return {
    valid: false,
    issues: [issue],
    summary: { errors: 1, warnings: 0, info: 0 },
  };
}

/**
 * Create a ValidationResult when no trait files are discovered.
 */
function createNoTraitFilesResult(dir: string): ValidationResult {
  const issue: ValidationIssue = {
    code: ErrorCodes.NO_TRAIT_FILES,
    message: 'No trait definition files found',
    location: { file: dir, path: '/' },
    fixHint: 'Add trait files to the directory or provide a different --path',
    severity: 'info',
    source: 'cli',
    domain: 'infrastructure',
    at: '/',
  };

  return {
    valid: true,
    issues: [issue],
    summary: { errors: 0, warnings: 0, info: 1 },
  };
}

/**
 * Basic trait structure validation.
 * Future missions will layer AJV and Zod validators onto this pipeline.
 */
function validateTraitStructure(data: unknown, filePath: string = 'unknown'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    issues.push({
      code: ErrorCodes.INVALID_TRAIT_FORMAT,
      message: 'Trait file must deserialize to an object',
      location: { file: filePath, path: '/' },
      fixHint: 'Ensure the YAML file contains a top-level object',
      severity: 'error',
      details: `Received type: ${Array.isArray(data) ? 'array' : typeof data}`,
      source: 'cli',
      domain: 'trait',
      at: '/',
    });
    return issues;
  }

  const obj = data as Record<string, unknown>;

  if (!obj.trait) {
    issues.push({
      code: ErrorCodes.MISSING_REQUIRED_FIELD,
      message: "Missing required field 'trait'",
      location: { file: filePath, path: '/' },
      fixHint: "Add a 'trait' section with metadata like name and version",
      severity: 'error',
      source: 'cli',
      domain: 'trait',
      at: '/trait',
    });
  } else if (typeof obj.trait !== 'object' || obj.trait === null || Array.isArray(obj.trait)) {
    issues.push({
      code: ErrorCodes.INVALID_FIELD_TYPE,
      message: "Field 'trait' must be an object",
      location: { file: filePath, path: '/trait' },
      fixHint: "Change 'trait' to an object containing name, version, and description",
      severity: 'error',
      source: 'cli',
      domain: 'trait',
      at: '/trait',
    });
  } else {
    const traitObj = obj.trait as Record<string, unknown>;
    if (typeof traitObj.name !== 'string' || traitObj.name.trim().length === 0) {
      issues.push({
        code: ErrorCodes.MISSING_REQUIRED_FIELD,
        message: "Trait metadata must include a non-empty 'name'",
        location: { file: filePath, path: '/trait/name' },
        fixHint: "Add a name under the 'trait' section (e.g., trait.name: MyTrait)",
        severity: 'error',
        source: 'cli',
        domain: 'trait',
        at: '/trait/name',
      });
    }
    if (traitObj.version !== undefined && typeof traitObj.version !== 'string') {
      issues.push({
        code: ErrorCodes.INVALID_FIELD_TYPE,
        message: "Trait 'version' should be a string (semver)",
        location: { file: filePath, path: '/trait/version' },
        fixHint: "Provide the version as a string, e.g., '1.0.0'",
        severity: 'warning',
        source: 'cli',
        domain: 'trait',
        at: '/trait/version',
      });
    }
  }

  if (!obj.schema) {
    issues.push({
      code: ErrorCodes.MISSING_REQUIRED_FIELD,
      message: "Missing required field 'schema'",
      location: { file: filePath, path: '/' },
      fixHint: "Add a 'schema' section describing trait fields",
      severity: 'error',
      source: 'cli',
      domain: 'trait',
      at: '/schema',
    });
  } else if (typeof obj.schema !== 'object' || obj.schema === null || Array.isArray(obj.schema)) {
    issues.push({
      code: ErrorCodes.INVALID_FIELD_TYPE,
      message: "Field 'schema' must be an object mapping field names",
      location: { file: filePath, path: '/schema' },
      fixHint: "Change 'schema' to an object keyed by field name",
      severity: 'error',
      source: 'cli',
      domain: 'trait',
      at: '/schema',
    });
  }

  if (obj.parameters !== undefined && !Array.isArray(obj.parameters)) {
    issues.push({
      code: ErrorCodes.INVALID_FIELD_TYPE,
      message: "Field 'parameters' must be an array when provided",
      location: { file: filePath, path: '/parameters' },
      fixHint: "Convert 'parameters' to an array of parameter definitions",
      severity: 'error',
      source: 'cli',
      domain: 'parameters',
      at: '/parameters',
    });
  }

  if (Array.isArray(obj.parameters) && obj.parameters.length === 0) {
    issues.push({
      code: ErrorCodes.INVALID_PARAMETER_VALUE,
      message: 'Parameters array is empty',
      location: { file: filePath, path: '/parameters' },
      fixHint: 'Remove the parameters section or provide at least one parameter definition',
      severity: 'warning',
      source: 'cli',
      domain: 'parameters',
      at: '/parameters',
    });
  }

  return issues;
}

/**
 * Run validation against discovered trait files.
 */
function validateTraits(options: CLIOptions = {}): ValidationResult {
  const { path = './traits', allErrors = true } = options;

  let traitFiles: string[];
  try {
    traitFiles = collectTraitFiles(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createDirectoryAccessErrorResult(path, error);
    }
    return createDirectoryAccessErrorResult(path, error);
  }

  if (traitFiles.length === 0) {
    return createNoTraitFilesResult(path);
  }

  const pipeline = new ValidationPipeline({ allErrors });
  pipeline.registerValidator(STRUCTURE_VALIDATOR, (data, filePath) =>
    validateTraitStructure(data, filePath ?? 'unknown')
  );

  const results: ValidationResult[] = traitFiles.map((file) => {
    const relativePath = relative(process.cwd(), file);
    try {
      const content = readFileSync(file, 'utf-8');
      const parsed = load(content);

      if (parsed === undefined) {
        return createParseErrorResult(relativePath, new Error('Trait file parsed as undefined'));
      }

      const validators = [
        () =>
          pipeline.validateWithCustom(STRUCTURE_VALIDATOR, parsed, {
            filePath: relativePath,
            includeWarnings: true,
            includeInfo: true,
          }),
      ];

      return pipeline.validateAll(validators, {
        filePath: relativePath,
        allErrors,
        includeWarnings: true,
        includeInfo: true,
      });
    } catch (error) {
      return createParseErrorResult(relativePath, error);
    }
  });

  return aggregateValidationResults(results);
}

/**
 * Output validation results according to the requested format.
 */
function outputResult(result: ValidationResult, options: CLIOptions = {}): void {
  const {
    format = 'text',
    verbose = false,
    noColor = false,
    showHints = true,
    showCodes = true,
  } = options;

  switch (format) {
    case 'json':
      console.log(formatAsJson(result, verbose));
      break;
    case 'github':
      console.log(formatAsGitHubAnnotations(result));
      break;
    case 'text':
    default:
      console.log(
        formatAsText(result, {
          color: !noColor,
          showHints,
          showCodes,
          showDetails: verbose,
        })
      );
      break;
  }
}

/**
 * Determine exit code according to severity summary.
 */
function determineExitCode(result: ValidationResult): number {
  if (result.summary.errors > 0) {
    return 1;
  }
  if (result.summary.warnings > 0) {
    return 2;
  }
  return 0;
}

/**
 * Parse command line arguments.
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    switch (arg) {
      case '--path':
      case '-p':
        options.path = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as CLIOptions['format'];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--no-color':
        options.noColor = true;
        break;
      case '--no-hints':
        options.showHints = false;
        break;
      case '--no-codes':
        options.showCodes = false;
        break;
      case '--stop-on-error':
        options.allErrors = false;
        break;
      case '--help':
      case '-h':
        console.log(`
Trait Validation Pipeline

Usage: yarn validate [options]

Options:
  -p, --path <dir>        Path to traits directory (default: ./traits)
  -f, --format <type>     Output format: text, json, or github (default: text)
  -v, --verbose           Show detailed information
  --no-color              Disable colored output
  --no-hints              Don't show fix hints
  --no-codes              Don't show error codes
  --stop-on-error         Stop validation on first error
  -h, --help              Show this help message

Output Formats:
  text      - Human-readable colored output (default)
  json      - Machine-readable JSON format
  github    - GitHub Actions annotation format

Exit Codes:
  0 - Validation passed (no errors)
  1 - Validation failed (errors found)
  2 - Warnings only (no errors)

Examples:
  yarn validate
  yarn validate --path ./my-traits --verbose
  yarn validate --format json
  yarn validate --format github --no-color
        `);
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return options;
}

// Execute when run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const result = validateTraits(options);
  outputResult(result, options);
  const exitCode = determineExitCode(result);
  process.exit(exitCode);
}

export { validateTraits };
