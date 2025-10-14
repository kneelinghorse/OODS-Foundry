/**
 * Validation Types
 *
 * Core type definitions for the trait validation system.
 * Implements the ValidationIssue schema as specified in R2 research.
 */

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Location information for a validation issue
 */
export interface ValidationLocation {
  /** The file path containing the error */
  file: string;
  /** JSON Pointer path to the specific field in error (e.g., "/parameters/initialState") */
  path: string;
  /** Optional line number in the source file */
  line?: number;
  /** Optional column number in the source file */
  column?: number;
}

/**
 * A standardized validation issue payload
 *
 * Designed to match the quality of Rust compiler errors with:
 * - Unique, searchable error codes (TE-XXXX pattern)
 * - Precise location information
 * - Human-readable messages
 * - Actionable fix hints
 */
export interface ValidationIssue {
  /** Unique error code (e.g., 'TE-0101') for searchability and documentation */
  code: string;

  /** Human-readable summary of the problem */
  message: string;

  /** Location information for the error */
  location: ValidationLocation;

  /** Actionable suggestion for fixing the issue (null if no hint available) */
  fixHint: string | null;

  /** Severity level of the issue */
  severity: ValidationSeverity;

  /** Optional additional context or details */
  details?: string;

  /** Identifier of the subsystem or validator that emitted this issue */
  source?: 'ajv' | 'zod' | 'custom' | 'pipeline' | 'cli' | string;

  /** Domain classification of the issue (e.g., parameters, composition, runtime) */
  domain?: 'trait' | 'parameters' | 'composition' | 'runtime' | 'infrastructure' | string;

  /** Optional documentation URL for remediation guidance */
  docsUrl?: string;

  /** Optional related identifiers (e.g., traits, parameters, files) */
  related?: string[];

  /** Raw pointer used by legacy tooling (e.g., AJV schema path) */
  at?: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean;

  /** Array of validation issues found */
  issues: ValidationIssue[];

  /** Count of issues by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Options for validation execution
 */
export interface ValidationOptions {
  /** Whether to stop on first error or collect all errors */
  allErrors?: boolean;

  /** Whether to include warnings in the result */
  includeWarnings?: boolean;

  /** Whether to include info-level messages */
  includeInfo?: boolean;

  /** File path context for error reporting */
  filePath?: string;
}

/**
 * Error code categories for the Trait Engine
 *
 * Format: TE-XXYY where:
 * - XX is the category
 * - YY is the specific error within that category
 */
export enum ErrorCategory {
  /** 01XX - Trait definition structure errors */
  STRUCTURE = '01',

  /** 02XX - Trait parameter validation errors */
  PARAMETERS = '02',

  /** 03XX - Trait composition errors */
  COMPOSITION = '03',

  /** 04XX - Runtime state validation errors */
  RUNTIME = '04',
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Structure errors (01XX)
  INVALID_TRAIT_FORMAT: 'TE-0101',
  MISSING_REQUIRED_FIELD: 'TE-0102',
  INVALID_FIELD_TYPE: 'TE-0103',
  NO_TRAIT_FILES: 'TE-0104',

  // Parameter errors (02XX)
  INVALID_PARAMETER_TYPE: 'TE-0201',
  MISSING_REQUIRED_PARAMETER: 'TE-0202',
  INVALID_PARAMETER_VALUE: 'TE-0203',
  UNKNOWN_PARAMETER: 'TE-0204',

  // Composition errors (03XX)
  PROPERTY_COLLISION: 'TE-0301',
  CIRCULAR_DEPENDENCY: 'TE-0302',
  MISSING_DEPENDENCY: 'TE-0303',
  INCOMPATIBLE_TRAITS: 'TE-0304',
  STATE_OWNERSHIP_CONFLICT: 'TE-0305',
  TOKEN_MAPPING_MISSING: 'TE-0306',
  VIEW_EXTENSION_INVALID: 'TE-0307',
  SEMANTIC_MAPPING_INCOMPLETE: 'TE-0308',

  // Runtime errors (04XX)
  INVALID_STATE_TRANSITION: 'TE-0401',
  MISSING_STATE: 'TE-0402',
} as const;

/**
 * Type for error code values
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
